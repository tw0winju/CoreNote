import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";
import * as lancedb from "@lancedb/lancedb";
import {
  DEFAULT_SYSTEM_PROMPT,
  HYDE_SYSTEM_PROMPT,
  rerankPrompt,
  memoryExtractPrompt,
  quizMcPrompt,
  quizTfPrompt,
  quizSaPrompt,
  summaryPrompt,
  batchSummaryPrompt,
  ragPrompt,
  ragFullContextPrompt,
} from "./prompts.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 3001;
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
const OVERLAP_CHARS = Number(process.env.OVERLAP_CHARS || 200);

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DOCS_PATH = path.join(DATA_DIR, "docs.json");
const LANCEDB_DIR = path.join(DATA_DIR, "lancedb");
const OLD_STORE_PATH = path.join(DATA_DIR, "store.json");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
const SUMMARIES_PATH = path.join(DATA_DIR, "summaries.json");

app.use(cors());
app.use(express.json({ limit: "300mb" }));

// JSON 파싱 오류(413 Too Large 등)를 HTML 대신 JSON으로 반환
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large")
    return res.status(413).json({ error: "파일이 너무 큽니다. 페이지 범위를 나눠서 색인하세요." });
  next(err);
});

// ---------- 설정 ----------
const DEFAULT_SETTINGS = {
  chatModel: process.env.OLLAMA_MODEL || "qwen3:8b",
  embedModel: process.env.EMBED_MODEL || "bge-m3",
  maxChunkChars: Number(process.env.MAX_CHUNK_CHARS || 1200),
  topK: Number(process.env.TOP_K || 5),
  hydeEnabled: false,
  rerankEnabled: false,
  memoryEnabled: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH))
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}
let settings = loadSettings();
function saveSettings() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// ---------- 문서 메타 ----------
function loadDocs() {
  try {
    if (fs.existsSync(DOCS_PATH)) {
      const raw = JSON.parse(fs.readFileSync(DOCS_PATH, "utf8"));
      // 구버전 배열 포맷 → 새 포맷으로 마이그레이션
      if (Array.isArray(raw)) return { docs: raw, folders: [] };
      return { docs: raw.docs || [], folders: raw.folders || [] };
    }
  } catch (e) {
    console.error("[docs load]", e);
  }
  return { docs: [], folders: [] };
}
let { docs, folders } = loadDocs();
function saveDocs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DOCS_PATH, JSON.stringify({ docs, folders }));
}

// ---------- 요약 캐시 ----------
function loadSummaries() {
  try {
    if (fs.existsSync(SUMMARIES_PATH)) return JSON.parse(fs.readFileSync(SUMMARIES_PATH, "utf8"));
  } catch {}
  return {};
}
let summaryCache = loadSummaries();
function saveSummaryCache() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SUMMARIES_PATH, JSON.stringify(summaryCache, null, 2));
}

// ---------- LanceDB ----------
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const db = await lancedb.connect(LANCEDB_DIR);
let chunksTable = null;

async function getTable() {
  if (chunksTable) return chunksTable;
  const names = await db.tableNames();
  if (names.includes("chunks")) chunksTable = await db.openTable("chunks");
  return chunksTable;
}
async function addToTable(records) {
  await getTable(); // 기존 테이블이 있으면 chunksTable 세팅
  if (!chunksTable) {
    chunksTable = await db.createTable("chunks", records);
  } else {
    await chunksTable.add(records);
  }
}

// ---------- store.json → LanceDB 마이그레이션 ----------
if (fs.existsSync(OLD_STORE_PATH)) {
  try {
    const old = JSON.parse(fs.readFileSync(OLD_STORE_PATH, "utf8"));
    if (old.chunks?.length) {
      console.log(`[migration] store.json → LanceDB (${old.chunks.length}개 청크)`);
      await addToTable(
        old.chunks.map((c) => ({
          id: c.id,
          docId: c.docId,
          docName: c.docName,
          index: c.index,
          text: c.text,
          vector: Array.from(c.embedding),
        })),
      );
      docs = old.docs || [];
      saveDocs();
    }
    fs.renameSync(OLD_STORE_PATH, OLD_STORE_PATH + ".migrated");
    console.log("[migration] 완료");
  } catch (e) {
    console.error("[migration error]", e);
  }
}

// ---------- 유틸 ----------
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
    } else cur = cur ? cur + "\n\n" + p : p;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

function cosine(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

async function extractPdfPages(buf, pageFrom, pageTo) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${path.join(__dirname, "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")}`;
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const from = Math.max(1, pageFrom || 1);
  const to = Math.min(pdfDoc.numPages, pageTo || pdfDoc.numPages);
  let fullText = "";
  for (let pageNum = from; pageNum <= to; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const content = await page.getTextContent();
    fullText += content.items.map((item) => item.str).join(" ") + "\n\n";
  }
  return fullText.trim();
}

async function extractText(base64, filename = "", pageFrom = null, pageTo = null) {
  const ext = path.extname(filename).toLowerCase();
  const buf = Buffer.from(base64, "base64");
  const normalize = (s) =>
    s
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  if (ext === ".txt" || ext === ".md") return normalize(buf.toString("utf8"));
  if (ext === ".docx") {
    const { extractRawText } = await import("mammoth");
    return normalize((await extractRawText({ buffer: buf })).value || "");
  }
  if (ext === ".pdf" && (pageFrom || pageTo)) {
    return normalize(await extractPdfPages(buf, pageFrom, pageTo));
  }
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const r = await parser.getText();
  if (parser.destroy) await parser.destroy();
  return normalize(r.text || "");
}

async function extractTextOCR(buf, onProgress, pageFrom = null, pageTo = null) {
  const os = await import("os");
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const { createWorker } = await import("tesseract.js");
  const execFileAsync = promisify(execFile);

  const CONCURRENCY = os.cpus().length; // 전체 코어 활용 (워커는 모델 1회 로드 후 재사용)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "corenote-ocr-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const outPrefix = path.join(tmpDir, "page");
  try {
    fs.writeFileSync(pdfPath, buf);

    // 150dpi: 200dpi 대비 이미지 44% 축소 → OCR 속도 향상, 인쇄 텍스트 인식에 충분
    const args = ["-r", "150", "-png"];
    if (pageFrom) args.push("-f", String(pageFrom));
    if (pageTo) args.push("-l", String(pageTo));
    args.push(pdfPath, outPrefix);
    await execFileAsync("pdftoppm", args);

    const pngFiles = fs
      .readdirSync(tmpDir)
      .filter((f) => f.endsWith(".png"))
      .sort();
    if (!pngFiles.length) throw new Error("PDF 페이지 이미지 변환 실패");

    // 병렬 워커로 OCR (4x 동시 처리)
    const workers = await Promise.all(
      Array.from({ length: CONCURRENCY }, () => createWorker("kor+eng")),
    );
    const results = new Array(pngFiles.length).fill("");
    let completed = 0;
    try {
      await Promise.all(
        workers.map(async (worker, wi) => {
          for (let i = wi; i < pngFiles.length; i += CONCURRENCY) {
            const {
              data: { text },
            } = await worker.recognize(path.join(tmpDir, pngFiles[i]));
            results[i] = text;
            completed++;
            if (onProgress) onProgress(completed, pngFiles.length);
          }
        }),
      );
    } finally {
      await Promise.all(workers.map((w) => w.terminate()));
    }
    return results.join("\n\n").trim();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------- Ollama 호출 ----------
async function ollamaFetch(pathname, body) {
  let res;
  try {
    res = await fetch(`${OLLAMA_URL}${pathname}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    const code = e?.cause?.code || e?.code || "";
    throw new Error(code === "ECONNREFUSED" ? "OLLAMA_DOWN" : "OLLAMA_FETCH", { cause: e });
  }
  return res;
}

// stream:false는 Ollama가 전체 생성 후 헤더를 보내 undici headersTimeout에 걸림.
// stream:true로 호출해 토큰을 즉시 수신하고 누적 반환한다.
// think:false — qwen3 계열의 불필요한 <think> 토큰 생성 방지 (속도 향상).
async function ollamaGenerate(messages, options = {}) {
  const res = await ollamaFetch("/api/chat", {
    model: settings.chatModel,
    messages,
    stream: true,
    think: false,
    options,
  });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    if (res.status === 404 || /not found|pull/i.test(b)) throw new Error("CHAT_MODEL_MISSING");
    throw new Error(`OLLAMA_HTTP_${res.status}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "",
    content = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          if (obj.message?.content) content += obj.message.content;
        } catch {}
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

async function embed(input) {
  const res = await ollamaFetch("/api/embed", { model: settings.embedModel, input });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    if (res.status === 404 || /not found|pull/i.test(b)) throw new Error("EMBED_MODEL_MISSING");
    throw new Error(`OLLAMA_HTTP_${res.status}`);
  }
  return (await res.json()).embeddings || [];
}

// ---------- BM25 + RRF ----------
function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s一-鿿가-힯]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function bm25Scores(query, chunks, k1 = 1.5, b = 0.75) {
  const qTerms = new Set(tokenize(query));
  if (!qTerms.size) return chunks.map(() => 0);
  const tok = chunks.map((c) => {
    const t = tokenize(c.text);
    const f = {};
    for (const w of t) f[w] = (f[w] || 0) + 1;
    return { f, len: t.length };
  });
  const N = chunks.length;
  const avgdl = tok.reduce((s, t) => s + t.len, 0) / (N || 1);
  const df = {};
  for (const term of qTerms) df[term] = tok.filter((t) => t.f[term] > 0).length;
  return tok.map(({ f, len }) => {
    let score = 0;
    for (const term of qTerms) {
      const freq = f[term] || 0;
      if (!freq) continue;
      const idf = Math.log((N - df[term] + 0.5) / (df[term] + 0.5) + 1);
      score += (idf * (freq * (k1 + 1))) / (freq + k1 * (1 - b + (b * len) / avgdl));
    }
    return score;
  });
}

function rankOf(scores) {
  const order = [...scores.keys()].sort((a, b) => scores[b] - scores[a]);
  const rank = new Array(scores.length);
  order.forEach((idx, r) => {
    rank[idx] = r;
  });
  return rank;
}

// ---------- MMR (다양성 기반 선택) ----------
function mmr(candidates, qvec, k, lambda = 0.7) {
  if (candidates.length <= k) return candidates;
  const vecs = candidates.map((c) => Array.from(c.vector));
  const simQ = vecs.map((v) => cosine(qvec, v));
  const selected = [];
  const remaining = new Set(candidates.keys());

  let first = [...remaining].reduce((b, i) => (simQ[i] > simQ[b] ? i : b), 0);
  selected.push(first);
  remaining.delete(first);

  while (selected.length < k && remaining.size > 0) {
    let bestScore = -Infinity,
      bestIdx = -1;
    for (const i of remaining) {
      const maxSim = Math.max(...selected.map((j) => cosine(vecs[i], vecs[j])));
      const score = lambda * simQ[i] - (1 - lambda) * maxSim;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx === -1) break;
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }
  return selected.map((i) => candidates[i]);
}

// ---------- LLM 재순위화 (G) ----------
async function llmRerank(question, candidates) {
  const listing = candidates.map((c, i) => `[${i + 1}] ${c.text.slice(0, 300)}`).join("\n\n");
  const prompt = rerankPrompt(question, listing);
  try {
    const raw = await ollamaGenerate([{ role: "user", content: prompt }], { temperature: 0 });
    const order = raw
      .match(/\d+/g)
      ?.map(Number)
      .filter((n) => n >= 1 && n <= candidates.length);
    if (!order?.length) return null;
    const seen = new Set();
    const reranked = [];
    for (const idx of order) {
      if (!seen.has(idx - 1)) {
        seen.add(idx - 1);
        reranked.push(candidates[idx - 1]);
      }
    }
    for (let i = 0; i < candidates.length; i++) {
      if (!seen.has(i)) reranked.push(candidates[i]);
    }
    return reranked;
  } catch {
    return null;
  }
}

// ---------- 공통 색인 로직 ----------
async function indexTextSSE(text, name, hash, send, folderId = null) {
  const rawChunks = chunkText(text, settings.maxChunkChars);
  const chunks = rawChunks.map((chunk, i) =>
    i === 0 || OVERLAP_CHARS <= 0 ? chunk : rawChunks[i - 1].slice(-OVERLAP_CHARS) + "\n\n" + chunk,
  );
  const total = chunks.length;
  const docId = crypto.randomUUID();
  const records = [];
  const BATCH = 16;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vecs = await embed(batch);
    if (!vecs || vecs.length < batch.length)
      throw new Error(`임베딩 결과 부족: 요청 ${batch.length}개, 수신 ${vecs?.length ?? 0}개`);
    batch.forEach((t, j) =>
      records.push({
        id: crypto.randomUUID(),
        docId,
        docName: name,
        index: i + j,
        text: t,
        vector: vecs[j],
      }),
    );
    send({ type: "progress", done: Math.min(i + BATCH, total), total });
  }
  await addToTable(records);
  docs.push({
    id: docId,
    name,
    addedAt: Date.now(),
    chunkCount: chunks.length,
    hash,
    folderId: folderId ?? null,
  });
  saveDocs();
  return { docId, chunkCount: chunks.length };
}

// ---------- SSE 오류 헬퍼 ----------
function sseErr(send, e) {
  console.error("[sseErr]", e);
  const m = String(e.message || "");
  if (m === "OLLAMA_DOWN" || m === "OLLAMA_FETCH")
    send({ type: "error", error: "Ollama 서버에 연결할 수 없습니다. 실행 중인지 확인하세요." });
  else if (m === "EMBED_MODEL_MISSING")
    send({
      type: "error",
      error: `임베딩 모델(${settings.embedModel})이 없습니다. 'ollama pull ${settings.embedModel}' 을 실행하세요.`,
    });
  else if (m.startsWith("OLLAMA_HTTP_"))
    send({ type: "error", error: `Ollama 오류 (${m.slice(12)}) — 서버 로그를 확인하세요.` });
  else send({ type: "error", error: `처리 중 오류가 발생했습니다: ${m}` });
}

// ---------- 1) 문서 색인 (파일) ----------
app.post("/api/index", async (req, res) => {
  const { file, pdf, filename, pageFrom, pageTo, folderId } = req.body;
  const fileData = file || pdf;
  if (!fileData) return res.status(400).json({ error: "파일 데이터가 없습니다." });

  // 페이지 범위를 해시에 포함 → 같은 파일을 다른 범위로 색인 허용
  const rangeKey = pageFrom || pageTo ? `|${pageFrom ?? 1}-${pageTo ?? "end"}` : "";
  const hash = crypto
    .createHash("sha256")
    .update(Buffer.from(fileData, "base64"))
    .update(rangeKey)
    .digest("hex");
  const dup = docs.find((d) => d.hash === hash);
  if (dup) return res.status(409).json({ error: `이미 추가된 문서입니다. (${dup.name})` });

  const ext = path.extname(filename || "").toLowerCase();
  const buf = Buffer.from(fileData, "base64");

  const baseName = filename || "문서";
  const docName =
    pageFrom || pageTo ? `${baseName} (${pageFrom ?? 1}~${pageTo ?? "끝"}페이지)` : baseName;

  let text = "";
  try {
    text = await extractText(fileData, filename || "", pageFrom ?? null, pageTo ?? null);
  } catch (e) {
    if (ext !== ".pdf") {
      console.error("[extract]", e);
      return res.status(422).json({ error: "파일에서 텍스트를 추출하지 못했습니다." });
    }
    // 스캔 PDF 등 구조 파싱 실패 → OCR로 넘김
    console.warn("[extract] PDF 텍스트 추출 실패, OCR 시도:", e.message);
  }

  const needsOCR = text.length < 30 && ext === ".pdf";
  if (!needsOCR && text.length < 30)
    return res.status(422).json({ error: "읽을 수 있는 텍스트가 거의 없습니다." });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    if (needsOCR) {
      send({ type: "status", message: "스캔 PDF 감지 — OCR 시작 중…" });
      try {
        text = await extractTextOCR(
          buf,
          (cur, total) => {
            send({ type: "status", message: `OCR 중… (${cur}/${total} 페이지)` });
          },
          pageFrom ?? null,
          pageTo ?? null,
        );
      } catch (e) {
        console.error("[ocr]", e);
        send({ type: "error", error: "OCR 처리 중 오류가 발생했습니다." });
        return res.end();
      }
      // 제어 문자·null 바이트 제거 (임베딩 오류 방지)
      /* eslint-disable no-control-regex */
      text = text
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      /* eslint-enable no-control-regex */
      if (text.length < 30) {
        send({
          type: "error",
          error: "OCR로도 텍스트를 추출하지 못했습니다. 이미지 품질을 확인하세요.",
        });
        return res.end();
      }
    }
    const { docId, chunkCount } = await indexTextSSE(text, docName, hash, send, folderId ?? null);
    send({ type: "done", docId, name: docName, chunkCount });
    res.end();
  } catch (e) {
    sseErr(send, e);
    res.end();
  }
});

// ---------- 2) URL 색인 ----------
app.post("/api/index-url", async (req, res) => {
  const { url, folderId: urlFolderId } = req.body;
  if (!url?.trim()) return res.status(400).json({ error: "URL이 없습니다." });

  let html;
  try {
    const r = await fetch(url.trim(), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; CoreNote/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return res.status(422).json({ error: `URL 응답 오류 (${r.status})` });
    html = await r.text();
  } catch {
    return res.status(422).json({ error: "URL을 불러오지 못했습니다." });
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().slice(0, 80) : new URL(url.trim()).hostname;

  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length < 30)
    return res.status(422).json({ error: "페이지에서 텍스트를 추출하지 못했습니다." });

  const hash = crypto.createHash("sha256").update(text).digest("hex");
  const dup = docs.find((d) => d.hash === hash);
  if (dup) return res.status(409).json({ error: `이미 추가된 문서입니다. (${dup.name})` });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const { docId, chunkCount } = await indexTextSSE(text, title, hash, send, urlFolderId ?? null);
    send({ type: "done", docId, name: title, chunkCount });
    res.end();
  } catch (e) {
    sseErr(send, e);
    res.end();
  }
});

// ---------- 3) 자료 목록 / 이름 변경 / 삭제 ----------
app.get("/api/docs", (_req, res) => {
  res.json({
    docs: docs.slice().sort((a, b) => b.addedAt - a.addedAt),
    folders: folders.slice().sort((a, b) => a.name.localeCompare(b.name)),
  });
});

app.get("/api/docs/:id/text", async (req, res) => {
  const id = req.params.id;
  try {
    const table = await getTable();
    if (!table) return res.status(404).json({ error: "문서를 찾을 수 없어요." });
    const chunks = await table.query().where(`docId = '${id}'`).toArray();
    if (!chunks.length) return res.status(404).json({ error: "문서를 찾을 수 없어요." });
    chunks.sort((a, b) => a.index - b.index);
    // overlap 제거
    const parts = chunks.map((chunk, i) => {
      if (i === 0) return chunk.text;
      const prev = chunks[i - 1];
      if (chunk.index !== prev.index + 1) return chunk.text;
      const sepIdx = chunk.text.indexOf("\n\n");
      if (sepIdx !== -1 && sepIdx <= OVERLAP_CHARS + 2) return chunk.text.slice(sepIdx + 2);
      return chunk.text;
    });
    res.json({ text: parts.join("\n\n") });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch("/api/docs/:id", (req, res) => {
  const doc = docs.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "문서를 찾을 수 없습니다." });
  if (req.body.name !== undefined) {
    const name = req.body.name.trim();
    if (!name) return res.status(400).json({ error: "이름이 없습니다." });
    doc.name = name;
  }
  if ("folderId" in req.body) doc.folderId = req.body.folderId; // null = 루트
  saveDocs();
  res.json({ ok: true });
});

// ---------- 폴더 ----------
app.post("/api/folders", (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: "폴더 이름이 없습니다." });
  const id = crypto.randomUUID();
  folders.push({ id, name, createdAt: Date.now() });
  saveDocs();
  res.json({ id, name });
});

app.patch("/api/folders/:id", (req, res) => {
  const folder = folders.find((f) => f.id === req.params.id);
  if (!folder) return res.status(404).json({ error: "폴더를 찾을 수 없습니다." });
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: "이름이 없습니다." });
  folder.name = name;
  saveDocs();
  res.json({ ok: true });
});

app.delete("/api/folders/:id", (req, res) => {
  const id = req.params.id;
  folders = folders.filter((f) => f.id !== id);
  docs.forEach((d) => {
    if (d.folderId === id) d.folderId = null;
  });
  saveDocs();
  res.json({ ok: true });
});

app.delete("/api/docs/:id", async (req, res) => {
  const id = req.params.id;
  try {
    const table = await getTable();
    if (table) await table.delete(`docId = '${id}'`);
  } catch (e) {
    console.error("[delete chunks]", e);
  }
  docs = docs.filter((d) => d.id !== id);
  saveDocs();
  if (summaryCache[id]) {
    delete summaryCache[id];
    saveSummaryCache();
  }
  res.json({ ok: true });
});

// ---------- 4) 설정 ----------
app.get("/api/settings", (_req, res) => res.json(settings));
app.post("/api/settings", (req, res) => {
  const {
    chatModel,
    embedModel,
    maxChunkChars,
    topK,
    hydeEnabled,
    rerankEnabled,
    systemPrompt,
    memoryEnabled,
  } = req.body;
  if (chatModel !== undefined) settings.chatModel = String(chatModel).trim();
  if (embedModel !== undefined) settings.embedModel = String(embedModel).trim();
  if (maxChunkChars !== undefined) settings.maxChunkChars = Math.max(200, Number(maxChunkChars));
  if (topK !== undefined) settings.topK = Math.max(1, Number(topK));
  if (hydeEnabled !== undefined) settings.hydeEnabled = Boolean(hydeEnabled);
  if (rerankEnabled !== undefined) settings.rerankEnabled = Boolean(rerankEnabled);
  if (systemPrompt !== undefined) settings.systemPrompt = String(systemPrompt);
  if (memoryEnabled !== undefined) settings.memoryEnabled = Boolean(memoryEnabled);
  saveSettings();
  res.json(settings);
});

// ---------- 기억 ----------
const MEMORY_PATH = path.join(DATA_DIR, "memory.json");

function loadMemories() {
  try {
    if (fs.existsSync(MEMORY_PATH)) return JSON.parse(fs.readFileSync(MEMORY_PATH, "utf8"));
  } catch {}
  return [];
}
let memories = loadMemories();
function saveMemories() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memories, null, 2));
}

app.get("/api/memories", (_req, res) => res.json(memories));

app.post("/api/memories", (req, res) => {
  const content = req.body.content?.trim();
  if (!content) return res.status(400).json({ error: "내용이 없습니다." });
  const m = { id: crypto.randomUUID(), content, createdAt: Date.now(), source: "manual" };
  memories.unshift(m);
  saveMemories();
  res.json(m);
});

app.delete("/api/memories/:id", (req, res) => {
  memories = memories.filter((m) => m.id !== req.params.id);
  saveMemories();
  res.json({ ok: true });
});

app.post("/api/memories/extract", async (req, res) => {
  const { q, a } = req.body;
  if (!q || !a) return res.json({ extracted: [] });
  try {
    const prompt = memoryExtractPrompt(q, a);

    const cleaned = await ollamaGenerate([{ role: "user", content: prompt }], { temperature: 0.1 });
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return res.json({ extracted: [] });

    const extracted = JSON.parse(match[0])
      .filter((s) => typeof s === "string" && s.trim().length > 0)
      .slice(0, 3);

    for (const content of extracted) {
      memories.unshift({
        id: crypto.randomUUID(),
        content: content.trim(),
        createdAt: Date.now(),
        source: "auto",
      });
    }
    if (extracted.length > 0) saveMemories();
    res.json({ extracted });
  } catch {
    res.json({ extracted: [] });
  }
});

// ---------- 퀴즈 생성 ----------
app.post("/api/quiz", async (req, res) => {
  const { docId, count = 10, type = "mc" } = req.body;
  if (!docId) return res.status(400).json({ error: "docId가 필요합니다." });
  try {
    const table = await getTable();
    if (!table) return res.status(404).json({ error: "문서를 찾을 수 없어요." });
    const chunks = await table.query().where(`docId = '${docId}'`).toArray();
    if (!chunks.length) return res.status(404).json({ error: "문서를 찾을 수 없어요." });
    chunks.sort((a, b) => a.index - b.index);
    const step = Math.max(1, Math.floor(chunks.length / 12));
    const sampled = chunks.filter((_, i) => i % step === 0).slice(0, 12);
    const text = sampled
      .map((c) => c.text)
      .join("\n\n")
      .slice(0, 4500);
    const prompt =
      type === "tf" ? quizTfPrompt(count, text) :
      type === "sa" ? quizSaPrompt(count, text) :
      quizMcPrompt(count, text);
    const cleaned = await ollamaGenerate([{ role: "user", content: prompt }], { temperature: 0.4 });
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return res.status(502).json({ error: "퀴즈 파싱 실패" });
    const questions = JSON.parse(match[0])
      .filter((q) => {
        if (!q.q || !q.a) return false;
        if (type === "mc" && !q.options?.length) return false;
        return true;
      })
      .slice(0, count);
    res.json({ questions });
  } catch (e) {
    res.status(502).json({ error: e.message || "퀴즈 생성 중 오류" });
  }
});

// ---------- 문서 요약 (SSE, 다중패스) ----------
const SUMMARY_BATCH_CHARS = 22000; // ~11k 토큰 — 32k 컨텍스트에서 안전한 배치 크기

app.post("/api/summary", async (req, res) => {
  const { docId, force = false } = req.body;
  if (!docId) return res.status(400).json({ error: "docId가 필요합니다." });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  // 캐시 히트
  if (!force && summaryCache[docId]) {
    send({ type: "done", summary: summaryCache[docId], cached: true });
    return res.end();
  }

  try {
    const table = await getTable();
    if (!table) {
      send({ type: "error", error: "문서를 찾을 수 없어요." });
      return res.end();
    }

    const chunks = await table.query().where(`docId = '${docId}'`).toArray();
    if (!chunks.length) {
      send({ type: "error", error: "문서를 찾을 수 없어요." });
      return res.end();
    }
    chunks.sort((a, b) => a.index - b.index);

    // 인접 청크 overlap 제거
    const textParts = chunks.map((chunk, i) => {
      if (i === 0) return chunk.text;
      const prev = chunks[i - 1];
      if (chunk.index !== prev.index + 1) return chunk.text;
      const sepIdx = chunk.text.indexOf("\n\n");
      if (sepIdx !== -1 && sepIdx <= OVERLAP_CHARS + 2) return chunk.text.slice(sepIdx + 2);
      return chunk.text;
    });

    // 배치 분할
    const batches = [];
    let cur = [],
      curLen = 0;
    for (const part of textParts) {
      if (curLen + part.length > SUMMARY_BATCH_CHARS && cur.length > 0) {
        batches.push(cur.join("\n\n"));
        cur = [part];
        curLen = part.length;
      } else {
        cur.push(part);
        curLen += part.length;
      }
    }
    if (cur.length > 0) batches.push(cur.join("\n\n"));

    const callLLM = (prompt) =>
      ollamaGenerate([{ role: "user", content: prompt }], { temperature: 0.2 });

    let summary;
    if (batches.length === 1) {
      send({ type: "progress", message: "요약 생성 중…" });
      summary = await callLLM(summaryPrompt(batches[0]));
    } else {
      const subSummaries = [];
      for (let i = 0; i < batches.length; i++) {
        send({ type: "progress", message: `내용 분석 중… (${i + 1}/${batches.length} 파트)` });
        const sub = await callLLM(batchSummaryPrompt(i + 1, batches.length, batches[i]));
        subSummaries.push(sub);
      }
      // 통합 LLM 호출 생략 — 각 배치 요약을 그대로 이어붙임 (정보 손실 방지)
      summary = subSummaries.join("\n\n---\n\n");
    }

    summaryCache[docId] = summary;
    saveSummaryCache();
    send({ type: "done", summary });
    res.end();
  } catch (e) {
    send({ type: "error", error: e.message || "요약 생성 중 오류" });
    res.end();
  }
});

// ---------- 5) 질문(검색 + 답변, SSE 스트리밍) ----------
app.post("/api/ask", async (req, res) => {
  const { question, history = [], docIds, image, fullContext = false } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ error: "질문을 입력하세요." });
  if (docs.length === 0) return res.status(400).json({ error: "먼저 문서를 추가하세요." });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    // 이미지 OCR: base64 이미지 → 텍스트 추출
    let imageText = "";
    if (image) {
      try {
        send({ type: "status", message: "이미지 OCR 중…" });
        const { createWorker } = await import("tesseract.js");
        const worker = await createWorker("kor+eng");
        const buf = Buffer.from(image, "base64");
        const {
          data: { text },
        } = await worker.recognize(buf);
        await worker.terminate();
        /* eslint-disable no-control-regex */
        imageText = text
          .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        /* eslint-enable no-control-regex */
      } catch (e) {
        console.error("[image-ocr]", e);
      }
    }

    const table = await getTable();
    if (!table) {
      send({ type: "error", error: "먼저 문서를 추가하세요." });
      return res.end();
    }

    // ── 전체 문서 모드 ──────────────────────────────────────────────────────
    if (fullContext && docIds?.length > 0) {
      send({ type: "status", message: "전체 문서 내용 불러오는 중…" });

      // 1. 지정 문서의 모든 청크를 인덱스 순으로 수집
      let allChunks = [];
      for (const docId of docIds) {
        const chunks = await table.query().where(`docId = '${docId}'`).toArray();
        chunks.sort((a, b) => a.index - b.index);
        allChunks.push(...chunks);
      }

      if (allChunks.length === 0) {
        send({ type: "error", error: "선택한 문서에서 내용을 찾지 못했습니다." });
        return res.end();
      }

      // 2. BM25 필터링: 하위 20% 제거 (단, 5개 이하면 스킵)
      if (allChunks.length > 5) {
        const scores = bm25Scores(question, allChunks);
        const sorted = [...scores].sort((a, b) => a - b);
        const threshold = sorted[Math.floor(sorted.length * 0.2)];
        allChunks = allChunks.filter((_, i) => scores[i] >= threshold);
      }

      // 3. 겹침 제거: 연속 청크면 앞 OVERLAP_CHARS + "\n\n" 접두어 제거
      const textParts = allChunks.map((chunk, i) => {
        if (i === 0) return chunk.text;
        const prev = allChunks[i - 1];
        if (chunk.index !== prev.index + 1) return chunk.text;
        const sepIdx = chunk.text.indexOf("\n\n");
        if (sepIdx !== -1 && sepIdx <= OVERLAP_CHARS + 2) return chunk.text.slice(sepIdx + 2);
        return chunk.text;
      });

      const context = textParts.join("\n\n");
      const imageBlock = imageText ? `\n\n[첨부 이미지에서 추출한 텍스트]\n${imageText}` : "";
      const prompt = ragFullContextPrompt(context, imageBlock, question);

      const docNames = [
        ...new Set(allChunks.map((c) => docs.find((d) => d.id === c.docId)?.name || c.docName)),
      ];
      send({
        type: "sources",
        sources: docNames.map((name, i) => ({
          n: i + 1,
          docName: name,
          index: 0,
          score: 1,
          snippet: `전체 내용 (${allChunks.filter((c) => (docs.find((d) => d.id === c.docId)?.name || c.docName) === name).length}개 조각)`,
        })),
      });

      const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
      const memoryBlock =
        settings.memoryEnabled && memories.length > 0
          ? "\n\n[기억]\n" +
            memories
              .slice(0, 15)
              .map((m) => `- ${m.content}`)
              .join("\n")
          : "";
      const ollamaRes = await ollamaFetch("/api/chat", {
        model: settings.chatModel,
        messages: [
          { role: "system", content: settings.systemPrompt + memoryBlock },
          ...safeHistory,
          { role: "user", content: prompt },
        ],
        stream: true,
        options: { temperature: 0.2 },
      });

      if (!ollamaRes.ok) {
        const b = await ollamaRes.text().catch(() => "");
        if (ollamaRes.status === 404 || /not found|pull/i.test(b))
          send({
            type: "error",
            error: `모델(${settings.chatModel})이 없습니다. 'ollama pull ${settings.chatModel}' 을 실행하세요.`,
          });
        else send({ type: "error", error: "처리 중 오류가 발생했습니다." });
        return res.end();
      }

      let inThink = false,
        tail = "";
      const processToken = (token) => {
        if (inThink) {
          if (token.includes("</think>")) {
            inThink = false;
            tail = token.split("</think>").slice(1).join("");
          }
          return;
        }
        if (token.includes("<think>")) {
          inThink = true;
          const pre = token.split("<think>")[0];
          if (pre) send({ type: "token", text: pre });
          return;
        }
        const combined = tail + token;
        tail = "";
        const out = combined.replace(/```(?:\w+\n?)?/g, "");
        if (out) send({ type: "token", text: out });
      };

      const reader2 = ollamaRes.body.getReader();
      const dec2 = new TextDecoder();
      let lb2 = "";
      while (true) {
        const { done, value } = await reader2.read();
        if (done) break;
        lb2 += dec2.decode(value, { stream: true });
        const lines = lb2.split("\n");
        lb2 = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const chunk = JSON.parse(line);
            if (chunk.message?.content) processToken(chunk.message.content);
          } catch {}
        }
      }
      if (!inThink && tail) {
        const c = tail.replace(/```(?:\w+\n?)?/g, "");
        if (c) send({ type: "token", text: c });
      }
      return res.end();
    }
    // ────────────────────────────────────────────────────────────────────────

    // F: HyDE — 가상 답변을 임베딩해 검색 정확도 향상
    let queryText = question;
    if (settings.hydeEnabled) {
      try {
        const hydeText = await ollamaGenerate(
          [
            { role: "system", content: HYDE_SYSTEM_PROMPT },
            { role: "user", content: question },
          ],
          { temperature: 0.5 },
        );
        if (hydeText) queryText = hydeText;
      } catch {}
    }

    const embedResult = await embed(queryText);
    const qvec = embedResult[0];
    if (!qvec) throw new Error("질문 임베딩 결과가 없습니다. 임베딩 모델을 확인하세요.");

    let search = table.vectorSearch(qvec).limit(settings.topK * 4);
    if (docIds?.length > 0)
      search = search.where(docIds.map((id) => `docId = '${id}'`).join(" OR "));
    let candidates = await search.toArray();

    if (candidates.length === 0) {
      send({ type: "error", error: "선택한 문서에서 관련 내용을 찾지 못했습니다." });
      return res.end();
    }

    // 하이브리드 재순위화 (BM25 + 코사인 RRF)
    const cosScores = candidates.map((c) => cosine(qvec, Array.from(c.vector)));
    const bm25 = bm25Scores(question, candidates);
    const K = 60;
    const cosRank = rankOf(cosScores);
    const bm25Rank = rankOf(bm25);
    const rrf = candidates.map((_, i) => 1 / (K + cosRank[i]) + 1 / (K + bm25Rank[i]));
    candidates = [...candidates.keys()]
      .sort((a, b) => rrf[b] - rrf[a])
      .slice(0, settings.topK * 2)
      .map((i) => candidates[i]);

    // G: LLM 재순위화 (선택적)
    if (settings.rerankEnabled && candidates.length > 1) {
      const reranked = await llmRerank(question, candidates);
      if (reranked) candidates = reranked;
    }

    // MMR로 다양성 확보 후 topK 선택
    const diversified = mmr(candidates, qvec, settings.topK);
    const scored = diversified.map((c) => ({
      c,
      score: cosine(qvec, Array.from(c.vector)),
    }));

    // 출처 먼저 전송
    send({
      type: "sources",
      sources: scored.map((s, i) => ({
        n: i + 1,
        docName: docs.find((d) => d.id === s.c.docId)?.name || s.c.docName,
        index: s.c.index,
        score: Number(s.score.toFixed(3)),
        snippet: s.c.text.slice(0, 600),
      })),
    });

    const docName = (c) => docs.find((d) => d.id === c.docId)?.name || c.docName;

    // 이웃 청크 확장: 앞뒤 청크 포함해 더 풍부한 컨텍스트 구성
    const contextParts = await Promise.all(
      scored.map(async ({ c }, i) => {
        let text = c.text;
        try {
          const t = await getTable();
          const neighbors = await t
            .query()
            .where(`docId = '${c.docId}' AND index >= ${c.index - 1} AND index <= ${c.index + 1}`)
            .toArray();
          neighbors.sort((a, b) => a.index - b.index);
          if (neighbors.length > 1) text = neighbors.map((n) => n.text).join("\n");
        } catch {}
        return `[${i + 1}] (${docName(c)}) ${text}`;
      }),
    );
    const context = contextParts.join("\n\n");
    const imageBlock = imageText ? `\n\n[첨부 이미지에서 추출한 텍스트]\n${imageText}` : "";
    const prompt = ragPrompt(context, imageBlock, question);

    const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
    const memoryBlock =
      settings.memoryEnabled && memories.length > 0
        ? "\n\n[기억]\n" +
          memories
            .slice(0, 15)
            .map((m) => `- ${m.content}`)
            .join("\n")
        : "";
    const ollamaRes = await ollamaFetch("/api/chat", {
      model: settings.chatModel,
      messages: [
        { role: "system", content: settings.systemPrompt + memoryBlock },
        ...safeHistory,
        { role: "user", content: prompt },
      ],
      stream: true,
      options: { temperature: 0.2 },
    });

    if (!ollamaRes.ok) {
      const b = await ollamaRes.text().catch(() => "");
      if (ollamaRes.status === 404 || /not found|pull/i.test(b))
        send({
          type: "error",
          error: `모델(${settings.chatModel})이 없습니다. 'ollama pull ${settings.chatModel}' 을 실행하세요.`,
        });
      else send({ type: "error", error: "처리 중 오류가 발생했습니다." });
      return res.end();
    }

    // <think> 블록 실시간 필터
    let inThink = false,
      tail = "";
    const processToken = (token) => {
      tail += token;
      let out = "";
      while (tail) {
        if (inThink) {
          const i = tail.indexOf("</think>");
          if (i !== -1) {
            inThink = false;
            tail = tail.slice(i + 8);
          } else {
            tail = tail.slice(Math.max(0, tail.length - 7));
            break;
          }
        } else {
          const i = tail.indexOf("<think>");
          if (i !== -1) {
            out += tail.slice(0, i);
            inThink = true;
            tail = tail.slice(i + 7);
          } else {
            const safe = Math.max(0, tail.length - 6);
            out += tail.slice(0, safe);
            tail = tail.slice(safe);
            break;
          }
        }
      }
      const cleaned = out.replace(/```(?:\w+\n?)?/g, "");
      if (cleaned) send({ type: "token", text: cleaned });
    };

    const reader = ollamaRes.body.getReader();
    const decoder = new TextDecoder();
    let lineBuf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      lineBuf += decoder.decode(value, { stream: true });
      const lines = lineBuf.split("\n");
      lineBuf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          if (chunk.message?.content) processToken(chunk.message.content);
        } catch {}
      }
    }
    if (!inThink && tail) {
      const c = tail.replace(/```(?:\w+\n?)?/g, "");
      if (c) send({ type: "token", text: c });
    }
    res.end();
  } catch (e) {
    sseErr(send, e);
    res.end();
  }
});

// ---------- 헬스 체크 ----------
app.get("/api/health", async (_req, res) => {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`);
    const data = await r.json();
    const names = (data.models || []).map((m) => m.name);
    const has = (m) => names.some((n) => n === m || n.startsWith(m.split(":")[0]));
    res.json({
      ollama: true,
      chatModel: settings.chatModel,
      embedModel: settings.embedModel,
      chatInstalled: has(settings.chatModel),
      embedInstalled: has(settings.embedModel),
      docCount: docs.length,
    });
  } catch {
    res.status(503).json({ ollama: false });
  }
});

// ---------- 프로덕션 정적 서빙 ----------
const dist = path.join(__dirname, "dist");
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, () => {
  console.log(`코어노트(RAG) 서버 실행 중 -> http://localhost:${PORT}`);
  console.log(
    `Ollama: ${OLLAMA_URL} | 답변: ${settings.chatModel} | 임베딩: ${settings.embedModel}`,
  );
});
