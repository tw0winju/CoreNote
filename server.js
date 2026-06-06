import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";
import * as lancedb from "@lancedb/lancedb";

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

app.use(cors());
app.use(express.json({ limit: "64mb" }));

// ---------- 설정 ----------
const DEFAULT_SETTINGS = {
  chatModel: process.env.OLLAMA_MODEL || "qwen3:8b",
  embedModel: process.env.EMBED_MODEL || "bge-m3",
  maxChunkChars: Number(process.env.MAX_CHUNK_CHARS || 1200),
  topK: Number(process.env.TOP_K || 5),
  hydeEnabled: false,
  rerankEnabled: false,
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
    if (fs.existsSync(DOCS_PATH)) return JSON.parse(fs.readFileSync(DOCS_PATH, "utf8"));
  } catch (e) {
    console.error("[docs load]", e);
  }
  return [];
}
let docs = loadDocs();
function saveDocs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DOCS_PATH, JSON.stringify(docs));
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
  if (!chunksTable) chunksTable = await db.createTable("chunks", records);
  else await chunksTable.add(records);
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

async function extractText(base64, filename = "") {
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
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const r = await parser.getText();
  if (parser.destroy) await parser.destroy();
  return normalize(r.text || "");
}

async function extractTextOCR(buf, onProgress) {
  const pdfjsLib = await import("pdfjs-dist");
  const { createCanvas } = await import("canvas");
  const { createWorker } = await import("tesseract.js");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  const pdfDoc = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const numPages = pdfDoc.numPages;
  const worker = await createWorker("kor+eng");
  let fullText = "";
  try {
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const ctx = canvas.getContext("2d");
      await page.render({ canvasContext: ctx, viewport }).promise;
      const {
        data: { text },
      } = await worker.recognize(canvas.toBuffer("image/png"));
      fullText += text + "\n\n";
      if (onProgress) onProgress(pageNum, numPages);
    }
  } finally {
    await worker.terminate();
  }
  return fullText.trim();
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

// ---------- LLM 재순위화 (G) ----------
async function llmRerank(question, candidates) {
  const listing = candidates.map((c, i) => `[${i + 1}] ${c.text.slice(0, 300)}`).join("\n\n");
  const prompt = `다음 구절들이 질문과 관련된 순서대로 번호만 쉼표로 출력하시오.\n\n질문: ${question}\n\n${listing}`;
  try {
    const res = await ollamaFetch("/api/chat", {
      model: settings.chatModel,
      messages: [{ role: "user", content: prompt }],
      stream: false,
      options: { temperature: 0 },
    });
    if (!res.ok) return null;
    const raw = ((await res.json()).message?.content || "").replace(
      /<think>[\s\S]*?<\/think>/g,
      "",
    );
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
async function indexTextSSE(text, name, hash, send) {
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
  docs.push({ id: docId, name, addedAt: Date.now(), chunkCount: chunks.length, hash });
  saveDocs();
  return { docId, chunkCount: chunks.length };
}

// ---------- SSE 오류 헬퍼 ----------
function sseErr(send, e) {
  const m = String(e.message || "");
  if (m === "OLLAMA_DOWN" || m === "OLLAMA_FETCH")
    send({ type: "error", error: "Ollama 서버에 연결할 수 없습니다. 실행 중인지 확인하세요." });
  else if (m === "EMBED_MODEL_MISSING")
    send({
      type: "error",
      error: `임베딩 모델(${settings.embedModel})이 없습니다. 'ollama pull ${settings.embedModel}' 을 실행하세요.`,
    });
  else send({ type: "error", error: "처리 중 오류가 발생했습니다." });
}

// ---------- 1) 문서 색인 (파일) ----------
app.post("/api/index", async (req, res) => {
  const { file, pdf, filename } = req.body;
  const fileData = file || pdf;
  if (!fileData) return res.status(400).json({ error: "파일 데이터가 없습니다." });

  const hash = crypto.createHash("sha256").update(Buffer.from(fileData, "base64")).digest("hex");
  const dup = docs.find((d) => d.hash === hash);
  if (dup) return res.status(409).json({ error: `이미 추가된 문서입니다. (${dup.name})` });

  const ext = path.extname(filename || "").toLowerCase();
  const buf = Buffer.from(fileData, "base64");

  let text;
  try {
    text = await extractText(fileData, filename || "");
  } catch (e) {
    console.error("[extract]", e);
    return res.status(422).json({ error: "파일에서 텍스트를 추출하지 못했습니다." });
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
        text = await extractTextOCR(buf, (cur, total) => {
          send({ type: "status", message: `OCR 중… (${cur}/${total} 페이지)` });
        });
      } catch (e) {
        console.error("[ocr]", e);
        send({ type: "error", error: "OCR 처리 중 오류가 발생했습니다." });
        return res.end();
      }
      if (text.length < 30) {
        send({
          type: "error",
          error: "OCR로도 텍스트를 추출하지 못했습니다. 이미지 품질을 확인하세요.",
        });
        return res.end();
      }
    }
    const { docId, chunkCount } = await indexTextSSE(text, filename || "문서", hash, send);
    send({ type: "done", docId, name: filename || "문서", chunkCount });
    res.end();
  } catch (e) {
    sseErr(send, e);
    res.end();
  }
});

// ---------- 2) URL 색인 ----------
app.post("/api/index-url", async (req, res) => {
  const { url } = req.body;
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
    const { docId, chunkCount } = await indexTextSSE(text, title, hash, send);
    send({ type: "done", docId, name: title, chunkCount });
    res.end();
  } catch (e) {
    sseErr(send, e);
    res.end();
  }
});

// ---------- 3) 자료 목록 / 이름 변경 / 삭제 ----------
app.get("/api/docs", (_req, res) => {
  res.json({ docs: docs.slice().sort((a, b) => b.addedAt - a.addedAt) });
});

app.patch("/api/docs/:id", (req, res) => {
  const name = req.body.name?.trim();
  if (!name) return res.status(400).json({ error: "이름이 없습니다." });
  const doc = docs.find((d) => d.id === req.params.id);
  if (!doc) return res.status(404).json({ error: "문서를 찾을 수 없습니다." });
  doc.name = name;
  saveDocs();
  res.json({ ok: true, name });
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
  res.json({ ok: true });
});

// ---------- 4) 설정 ----------
app.get("/api/settings", (_req, res) => res.json(settings));
app.post("/api/settings", (req, res) => {
  const { chatModel, embedModel, maxChunkChars, topK, hydeEnabled, rerankEnabled } = req.body;
  if (chatModel !== undefined) settings.chatModel = String(chatModel).trim();
  if (embedModel !== undefined) settings.embedModel = String(embedModel).trim();
  if (maxChunkChars !== undefined) settings.maxChunkChars = Math.max(200, Number(maxChunkChars));
  if (topK !== undefined) settings.topK = Math.max(1, Number(topK));
  if (hydeEnabled !== undefined) settings.hydeEnabled = Boolean(hydeEnabled);
  if (rerankEnabled !== undefined) settings.rerankEnabled = Boolean(rerankEnabled);
  saveSettings();
  res.json(settings);
});

// ---------- 5) 질문(검색 + 답변, SSE 스트리밍) ----------
app.post("/api/ask", async (req, res) => {
  const { question, history = [], docIds } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ error: "질문을 입력하세요." });
  if (docs.length === 0) return res.status(400).json({ error: "먼저 문서를 추가하세요." });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);

  try {
    const table = await getTable();
    if (!table) {
      send({ type: "error", error: "먼저 문서를 추가하세요." });
      return res.end();
    }

    // F: HyDE — 가상 답변을 임베딩해 검색 정확도 향상
    let queryText = question;
    if (settings.hydeEnabled) {
      try {
        const hydeRes = await ollamaFetch("/api/chat", {
          model: settings.chatModel,
          messages: [
            {
              role: "system",
              content: "사용자 질문에 대해 간결하게 한 문단으로 가상 답변을 작성하시오.",
            },
            { role: "user", content: question },
          ],
          stream: false,
          options: { temperature: 0.5 },
        });
        if (hydeRes.ok) queryText = (await hydeRes.json()).message?.content || question;
      } catch {}
    }

    const qvec = (await embed(queryText))[0];

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

    const scored = candidates.slice(0, settings.topK).map((c) => ({
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
        snippet: s.c.text.slice(0, 300),
      })),
    });

    const docName = (c) => docs.find((d) => d.id === c.docId)?.name || c.docName;
    const context = scored.map((s, i) => `[${i + 1}] (${docName(s.c)}) ${s.c.text}`).join("\n\n");
    const prompt = `아래 [참고자료]에 있는 내용만 근거로 사용자의 질문에 한국어로 답하세요.
- 자료에 없는 내용은 지어내지 말고 "자료에서 찾을 수 없습니다"라고 답합니다.
- 답에 사용한 근거는 문장 끝에 [번호] 형식으로 표시합니다.

[참고자료]
${context}

[질문]
${question}`;

    const safeHistory = Array.isArray(history) ? history.slice(-20) : [];
    const ollamaRes = await ollamaFetch("/api/chat", {
      model: settings.chatModel,
      messages: [
        { role: "system", content: "너는 제공된 자료에만 근거해 답하는 정확한 도우미야." },
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
