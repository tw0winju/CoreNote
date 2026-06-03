import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 3001;
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
const MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const MAX_CHUNK_CHARS = Number(process.env.MAX_CHUNK_CHARS || 6000);
const MAX_CHUNKS = Number(process.env.MAX_CHUNKS || 12);
const MAX_PDF_MB = 50;

app.use(cors());
app.use(express.json({ limit: "64mb" }));

function clean(s) {
  return String(s)
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json|```/g, "")
    .trim();
}

function chunkText(text, maxChars) {
  const paragraphs = text.split(/\n\s*\n/).flatMap((p) => {
    if (p.length <= maxChars) return [p];
    const pieces = [];
    for (let i = 0; i < p.length; i += maxChars) pieces.push(p.slice(i, i + maxChars));
    return pieces;
  });
  const chunks = [];
  let cur = "";
  for (const p of paragraphs) {
    if (cur && cur.length + 2 + p.length > maxChars) {
      chunks.push(cur.trim());
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

// 재시도 포함 Ollama 호출. 네트워크·HTTP 오류는 최대 retries회 재시도.
async function ollamaChat(messages, { json = false, retries = 2 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt));
    try {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages,
          stream: false,
          ...(json ? { format: "json" } : {}),
          options: { temperature: 0.3 },
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (res.status === 404 || /not found|pull/i.test(body)) {
          throw Object.assign(new Error("MODEL_MISSING"), { fatal: true });
        }
        throw new Error(`OLLAMA_HTTP_${res.status}`);
      }
      const data = await res.json();
      return data.message?.content ?? "";
    } catch (e) {
      if (e.fatal) throw e;
      const code = e?.cause?.code || e?.code || "";
      if (code === "ECONNREFUSED") throw Object.assign(new Error("OLLAMA_DOWN"), { fatal: true });
      lastErr = e;
      if (attempt < retries) console.warn(`[ollamaChat] retry ${attempt + 1}/${retries}:`, e.message);
    }
  }
  throw lastErr;
}

// JSON 파싱 — 직접 파싱 실패 시 응답에서 JSON 객체 추출 시도
function parseResult(raw) {
  const s = clean(raw);
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// 각 필드에 기본값을 보장해 렌더링 오류 방지
function normalizeResult(parsed) {
  return {
    title: typeof parsed.title === "string" ? parsed.title : "제목 없음",
    oneLineSummary: typeof parsed.oneLineSummary === "string" ? parsed.oneLineSummary : "",
    summary: Array.isArray(parsed.summary) ? parsed.summary.filter((s) => typeof s === "string") : [],
    concepts: Array.isArray(parsed.concepts) ? parsed.concepts.filter((c) => c && typeof c.term === "string") : [],
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.filter((k) => typeof k === "string") : [],
    quiz: Array.isArray(parsed.quiz) ? parsed.quiz.filter((q) => q && typeof q.question === "string") : [],
  };
}

const FINAL_PROMPT = `아래 학습 자료를 학생이 빠르게 이해·복습할 수 있도록 정리하세요.

반드시 아래 구조의 JSON 객체 하나만 출력합니다. 설명 문장이나 코드펜스 없이 오직 JSON만 출력하세요.

{
  "title": "문서의 제목 또는 핵심 주제",
  "oneLineSummary": "문서 전체를 한 문장으로 압축한 요약",
  "summary": ["핵심 요약 포인트", "..."],
  "concepts": [{"term": "핵심 용어/개념", "explanation": "이해하기 쉬운 설명"}],
  "keyPoints": ["시험·복습에 중요한 암기 포인트", "..."],
  "quiz": [{"question": "복습용 질문", "answer": "정답과 간단한 해설"}]
}

규칙:
- summary 4~7개, concepts 3~8개, keyPoints 3~6개, quiz 3~5개.
- 모든 설명은 한국어로 작성(전문 용어는 원어 병기 가능).
- 자료에 실제로 있는 내용에만 근거하고 지어내지 않는다.
- 각 항목은 구체적으로 작성하고, 항목 간 중복 없이 핵심만 담는다.
- quiz의 answer는 단순 단어가 아닌 학습에 도움이 되는 충분한 설명을 포함한다.`;

app.post("/api/summarize", async (req, res) => {
  // SSE 설정
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (data) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch {}
  };

  const { pdf } = req.body;
  if (!pdf) {
    send({ type: "error", message: "PDF 데이터가 없습니다." });
    return res.end();
  }

  // 파일 크기 검증 (base64 → 실제 바이트 추정)
  if (pdf.length * 0.75 > MAX_PDF_MB * 1024 * 1024) {
    send({ type: "error", message: `파일이 너무 큽니다. ${MAX_PDF_MB}MB 이하의 PDF만 지원합니다.` });
    return res.end();
  }

  // 1) PDF → 텍스트
  let text = "";
  try {
    send({ type: "progress", step: "extract", message: "PDF에서 텍스트 추출 중..." });
    const buf = Buffer.from(pdf, "base64");
    const parser = new PDFParse({ data: new Uint8Array(buf) });
    const r = await parser.getText();
    if (parser.destroy) await parser.destroy();
    text = (r.text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  } catch (e) {
    console.error("[PDF extract]", e);
    send({ type: "error", message: "PDF에서 텍스트를 추출하지 못했습니다. 스캔된 이미지 PDF라면 OCR이 필요합니다." });
    return res.end();
  }
  if (text.length < 30) {
    send({ type: "error", message: "읽을 수 있는 텍스트가 거의 없습니다. 스캔 이미지 PDF는 OCR이 필요해요." });
    return res.end();
  }

  // 2) 청킹 → map(병렬) → reduce
  try {
    const all = chunkText(text, MAX_CHUNK_CHARS);
    const chunks = all.slice(0, MAX_CHUNKS);
    const truncated = all.length > MAX_CHUNKS;

    let sourceForFinal;
    if (chunks.length === 1) {
      send({ type: "progress", step: "map", current: 1, total: 1, message: "내용 분석 중..." });
      sourceForFinal = chunks[0];
    } else {
      send({ type: "progress", step: "map", current: 0, total: chunks.length, message: `문서를 ${chunks.length}개 구간으로 나눠 분석합니다...` });

      // 청크별 요약을 병렬로 처리
      let completed = 0;
      const partials = await Promise.all(
        chunks.map((chunk, i) =>
          ollamaChat([
            { role: "system", content: "당신은 학습 자료를 정리하는 도우미입니다." },
            {
              role: "user",
              content: `다음은 문서의 ${i + 1}/${chunks.length} 부분입니다. 핵심 내용을 한국어 불릿(- )으로 빠짐없이 정리하세요. 정리 외 잡담은 하지 마세요.\n\n${chunk}`,
            },
          ]).then((out) => {
            completed++;
            send({ type: "progress", step: "map", current: completed, total: chunks.length, message: `구간 ${completed}/${chunks.length} 분석 완료` });
            return clean(out);
          })
        )
      );
      sourceForFinal = partials.join("\n");
    }

    send({ type: "progress", step: "reduce", message: "최종 정리 중..." });
    const raw = await ollamaChat(
      [
        { role: "system", content: "당신은 학생의 학습을 돕는 전문 튜터입니다. 항상 유효한 JSON만 출력합니다." },
        { role: "user", content: `${FINAL_PROMPT}\n\n[정리 대상]\n${sourceForFinal}` },
      ],
      { json: true }
    );

    const parsed = parseResult(raw);
    if (!parsed) {
      console.error("[JSON parse] raw:", clean(raw).slice(0, 400));
      send({ type: "error", message: "결과를 정리된 형식으로 변환하지 못했습니다. 다시 시도해 주세요." });
      return res.end();
    }

    const result = normalizeResult(parsed);
    if (truncated) result._note = `문서가 길어 앞 ${MAX_CHUNKS}개 구간(전체 ${all.length}개)만 정리했습니다. 뒷부분 내용이 누락되었을 수 있어요.`;
    send({ type: "done", result });
    res.end();
  } catch (e) {
    const m = String(e.message || "");
    console.error("[summarize]", m);
    if (m === "OLLAMA_DOWN")
      send({ type: "error", message: "Ollama 서버에 연결할 수 없습니다. Ollama가 실행 중인지 확인하세요." });
    else if (m === "MODEL_MISSING")
      send({ type: "error", message: `모델(${MODEL})이 없습니다. 터미널에서 'ollama pull ${MODEL}' 을 실행하세요.` });
    else
      send({ type: "error", message: "요약 처리 중 오류가 발생했습니다." });
    res.end();
  }
});

// 헬스 체크 (Ollama 연결 + 모델 존재 확인)
app.get("/api/health", async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await r.json();
    const models = (data.models || []).map((m) => m.name);
    res.json({ ollama: true, model: MODEL, modelInstalled: models.some((n) => n.startsWith(MODEL.split(":")[0])), models });
  } catch {
    res.status(503).json({ ollama: false });
  }
});

// 프로덕션: 빌드된 프론트엔드(dist) 서빙. dev 에서는 Vite(5173)가 담당.
const dist = path.join(__dirname, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`코어노트 서버 실행 중 -> http://localhost:${PORT}`);
  console.log(`Ollama: ${OLLAMA_URL} | 모델: ${MODEL}`);
});
