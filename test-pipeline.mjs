/**
 * 코어노트 전체 파이프라인 테스트
 * - Mock Ollama 서버를 직접 띄워 외부 의존성 없이 동작
 * - 임시 데이터 디렉터리 사용 (실제 data/ 무관)
 */

import { createServer } from "http";
import { spawn } from "child_process";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir, platform } from "os";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const MOCK_PORT = 21434;
const APP_PORT  = 13001;
const EMBED_DIM = 768;

let passed = 0, failed = 0;
function ok(label)   { console.log(`  ✓ ${label}`); passed++; }
function fail(label, e) { console.log(`  ✗ ${label}: ${e?.message || e}`); failed++; }

// ── Mock Ollama ──────────────────────────────────────────────────────────────
function startMockOllama() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        if (req.url === "/api/tags") {
          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify({ models: [{ name: "qwen3:8b" }, { name: "bge-m3" }] }));
        }
        if (req.url === "/api/embed") {
          const { input } = JSON.parse(body);
          const inputs = Array.isArray(input) ? input : [input];
          const embeddings = inputs.map((text) => {
            const seed = [...Buffer.from(text.slice(0, 64))].reduce((a, b) => a + b, 0);
            return Array.from({ length: EMBED_DIM }, (_, i) => Math.sin(seed * 0.01 + i) * 0.1);
          });
          res.writeHead(200, { "content-type": "application/json" });
          return res.end(JSON.stringify({ embeddings }));
        }
        if (req.url === "/api/chat") {
          res.writeHead(200, { "content-type": "application/json" });
          const words = ["이것은", "테스트", "답변입니다.", "자료에서", "찾은", "내용입니다. [1]"];
          for (const w of words)
            res.write(JSON.stringify({ message: { content: w + " " }, done: false }) + "\n");
          res.write(JSON.stringify({ message: { content: "" }, done: true }) + "\n");
          return res.end();
        }
        res.writeHead(404); res.end();
      });
    });
    server.listen(MOCK_PORT, () => resolve(server));
  });
}

// ── App server ───────────────────────────────────────────────────────────────
function startApp(dataDir) {
  return new Promise((resolve, reject) => {
    const proc = spawn("node", ["server.js"], {
      cwd: __dirname,
      env: {
        ...process.env,
        PORT: String(APP_PORT),
        OLLAMA_URL: `http://localhost:${MOCK_PORT}`,
        DATA_DIR: dataDir,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const timeout = setTimeout(() => reject(new Error("서버 시작 타임아웃")), 15000);
    proc.stdout.on("data", (d) => {
      if (d.toString().includes("실행 중")) { clearTimeout(timeout); resolve(proc); }
    });
    proc.stderr.on("data", (d) => {
      // LanceDB native module warnings 무시
      const s = d.toString();
      if (!s.includes("ExperimentalWarning") && !s.includes("DeprecationWarning"))
        process.stderr.write("  [server] " + s);
    });
    proc.on("error", reject);
  });
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  const r = await fetch(`http://localhost:${APP_PORT}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return r;
}

async function readSSE(r) {
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "", events = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try { events.push(JSON.parse(line.slice(6))); } catch {}
    }
  }
  return events;
}

// ── Test helpers ─────────────────────────────────────────────────────────────
function makeBase64(text) {
  return Buffer.from(text).toString("base64");
}

const SAMPLE_TEXT = `
광합성(光合成, Photosynthesis)은 식물, 조류, 일부 세균이 빛 에너지를 화학 에너지로 전환하는 과정이다.

엽록체에서 일어나는 광합성은 크게 명반응과 암반응(캘빈 회로)으로 나뉜다.
명반응은 틸라코이드 막에서 일어나며 ATP와 NADPH를 생성한다.
캘빈 회로는 엽록체 기질(스트로마)에서 진행되며 CO2를 고정하여 포도당을 합성한다.

광합성의 전체 반응식: 6CO2 + 6H2O + 빛에너지 → C6H12O6 + 6O2
`.trim();

// ── Main ─────────────────────────────────────────────────────────────────────
const dataDir = mkdtempSync(join(tmpdir(), "corenote-test-"));
let mockServer, appProc;

try {
  console.log("\n코어노트 파이프라인 테스트 시작\n");

  // 서버 기동
  console.log("[ 환경 준비 ]");
  mockServer = await startMockOllama();
  ok(`Mock Ollama 시작 (port ${MOCK_PORT})`);
  appProc = await startApp(dataDir);
  ok(`앱 서버 시작 (port ${APP_PORT})`);

  // ── 1. 헬스 체크 ─────────────────────────────────────────────────────────
  console.log("\n[ 1. 헬스 체크 ]");
  try {
    const r = await api("GET", "/api/health");
    const d = await r.json();
    if (d.ollama) ok("Ollama 연결 확인"); else fail("Ollama 연결", "ollama=false");
    if (d.chatInstalled) ok(`답변 모델 확인 (${d.chatModel})`); else fail("답변 모델 없음");
    if (d.embedInstalled) ok(`임베딩 모델 확인 (${d.embedModel})`); else fail("임베딩 모델 없음");
  } catch (e) { fail("헬스 체크", e); }

  // ── 2. 문서 없을 때 목록 ─────────────────────────────────────────────────
  console.log("\n[ 2. 초기 상태 ]");
  try {
    const r = await api("GET", "/api/docs");
    const d = await r.json();
    if (d.docs.length === 0) ok("문서 목록 비어있음");
    else fail("초기 문서 목록", `${d.docs.length}개가 있어야 0개`);
  } catch (e) { fail("문서 목록", e); }

  // ── 3. 문서 없을 때 질문 ──────────────────────────────────────────────────
  try {
    const r = await api("POST", "/api/ask", { question: "광합성이란?" });
    if (r.status === 400) ok("문서 없을 때 400 응답"); else fail("문서 없을 때 400", `status=${r.status}`);
  } catch (e) { fail("문서 없을 때 400", e); }

  // ── 4. 문서 색인 ─────────────────────────────────────────────────────────
  console.log("\n[ 3. 문서 색인 ]");
  let docId;
  try {
    const r = await api("POST", "/api/index", {
      file: makeBase64(SAMPLE_TEXT),
      filename: "광합성.txt",
    });
    if (!r.ok) { fail("색인 요청", `status=${r.status}`); throw new Error("skip"); }
    const events = await readSSE(r);
    const progressEvents = events.filter(e => e.type === "progress");
    const doneEvent = events.find(e => e.type === "done");
    if (progressEvents.length > 0) ok(`진행률 이벤트 수신 (${progressEvents.length}회)`);
    else fail("진행률 이벤트 없음");
    if (doneEvent?.docId) { docId = doneEvent.docId; ok(`색인 완료 (${doneEvent.chunkCount}개 청크, id=${docId.slice(0, 8)}…)`); }
    else fail("done 이벤트 없음", JSON.stringify(events.slice(-2)));
  } catch (e) { if (e.message !== "skip") fail("문서 색인", e); }

  // ── 5. 중복 문서 방지 ──────────────────────────────────────────────────────
  console.log("\n[ 4. 중복 방지 ]");
  try {
    const r = await api("POST", "/api/index", {
      file: makeBase64(SAMPLE_TEXT),
      filename: "광합성_복사본.txt",
    });
    if (r.status === 409) ok("동일 내용 재업로드 → 409 Conflict");
    else fail("중복 방지", `status=${r.status}`);
  } catch (e) { fail("중복 방지", e); }

  // ── 6. 문서 목록 확인 ─────────────────────────────────────────────────────
  console.log("\n[ 5. 문서 목록 ]");
  try {
    const r = await api("GET", "/api/docs");
    const d = await r.json();
    if (d.docs.length === 1) ok(`문서 1개 확인 (${d.docs[0].name})`);
    else fail("문서 목록", `${d.docs.length}개`);
    if (d.docs[0].hash) ok("hash 필드 존재");
    else fail("hash 필드 없음");
  } catch (e) { fail("문서 목록", e); }

  // ── 7. 질문/답변 ──────────────────────────────────────────────────────────
  console.log("\n[ 6. 질문 / 답변 스트리밍 ]");
  let answerText = "";
  try {
    const r = await api("POST", "/api/ask", { question: "캘빈 회로는 어디서 일어나?" });
    if (!r.ok) { fail("질문 요청", `status=${r.status}`); throw new Error("skip"); }
    const events = await readSSE(r);
    const tokens = events.filter(e => e.type === "token");
    const srcEvent = events.find(e => e.type === "sources");
    answerText = tokens.map(e => e.text).join("");
    if (tokens.length > 0) ok(`토큰 스트리밍 수신 (${tokens.length}개 토큰)`);
    else fail("토큰 없음");
    if (answerText.length > 0) ok(`답변 생성 완료: "${answerText.slice(0, 40)}…"`);
    else fail("답변 비어있음");
    if (srcEvent?.sources?.length > 0) ok(`출처 수신 (${srcEvent.sources.length}개, 유사도 ${srcEvent.sources[0].score})`);
    else fail("출처 없음");
  } catch (e) { if (e.message !== "skip") fail("질문/답변", e); }

  // ── 8. 대화 맥락 유지 ──────────────────────────────────────────────────────
  console.log("\n[ 7. 대화 맥락 유지 ]");
  try {
    const history = [
      { role: "user", content: "캘빈 회로는 어디서 일어나?" },
      { role: "assistant", content: answerText || "엽록체 기질에서 일어납니다." },
    ];
    const r = await api("POST", "/api/ask", { question: "그것에 대해 더 설명해줘", history });
    if (!r.ok) { fail("후속 질문", `status=${r.status}`); throw new Error("skip"); }
    const events = await readSSE(r);
    const tokens = events.filter(e => e.type === "token");
    if (tokens.length > 0) ok(`후속 질문 토큰 수신 (${tokens.length}개)`);
    else fail("후속 질문 토큰 없음");
  } catch (e) { if (e.message !== "skip") fail("대화 맥락", e); }

  // ── 9. docIds 필터 ─────────────────────────────────────────────────────────
  console.log("\n[ 8. 문서 범위 지정 ]");
  try {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const r = await api("POST", "/api/ask", { question: "광합성이란?", docIds: [fakeId] });
    const events = await readSSE(r);
    const errEvent = events.find(e => e.type === "error");
    if (errEvent) ok(`존재하지 않는 docId → 오류 메시지: "${errEvent.error}"`);
    else fail("존재하지 않는 docId 처리");
  } catch (e) { fail("docIds 필터", e); }

  if (docId) {
    const r = await api("POST", "/api/ask", { question: "광합성이란?", docIds: [docId] });
    const events = await readSSE(r);
    const tokens = events.filter(e => e.type === "token");
    if (tokens.length > 0) ok(`docId 필터 검색 성공 (${tokens.length}개 토큰)`);
    else fail("docId 필터 검색 실패");
  }

  // ── 10. 문서 삭제 ──────────────────────────────────────────────────────────
  console.log("\n[ 9. 문서 삭제 ]");
  if (docId) {
    try {
      const r = await api("DELETE", `/api/docs/${docId}`);
      const d = await r.json();
      if (d.ok) ok("문서 삭제 성공");
      else fail("문서 삭제", JSON.stringify(d));
    } catch (e) { fail("문서 삭제", e); }
    try {
      const r = await api("GET", "/api/docs");
      const d = await r.json();
      if (d.docs.length === 0) ok("삭제 후 목록 비어있음");
      else fail("삭제 후 목록", `${d.docs.length}개 남음`);
    } catch (e) { fail("삭제 후 목록", e); }
    try {
      const r = await api("POST", "/api/ask", { question: "광합성이란?" });
      if (r.status === 400) ok("삭제 후 질문 → 400 응답");
      else fail("삭제 후 질문", `status=${r.status}`);
    } catch (e) { fail("삭제 후 질문", e); }
  }

} finally {
  appProc?.kill();
  mockServer?.close();
  try { rmSync(dataDir, { recursive: true }); } catch {}

  const total = passed + failed;
  console.log(`\n${"─".repeat(40)}`);
  console.log(`결과: ${passed}/${total} 통과${failed > 0 ? `  (실패 ${failed}개)` : ""}`);
  if (failed > 0) process.exit(1);
}
