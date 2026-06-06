import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { PDFParse } from "pdf-parse";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 3001;
const OLLAMA_URL = (process.env.OLLAMA_URL || "http://localhost:11434").replace(/\/+$/, "");
const CHAT_MODEL = process.env.OLLAMA_MODEL || "qwen3:8b";
const EMBED_MODEL = process.env.EMBED_MODEL || "bge-m3";
const MAX_CHUNK_CHARS = Number(process.env.MAX_CHUNK_CHARS || 1200);
const TOP_K = Number(process.env.TOP_K || 5);

const DATA_DIR = path.join(__dirname, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

app.use(cors());
app.use(express.json({ limit: "64mb" }));

// ---------- 영속 벡터 저장소 (파일 기반) ----------
function loadStore() {
  try {
    if (fs.existsSync(STORE_PATH)) return JSON.parse(fs.readFileSync(STORE_PATH, "utf8"));
  } catch (e) {
    console.error("[store load]", e);
  }
  return { docs: [], chunks: [] };
}
let store = loadStore();
function saveStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store));
}

// ---------- 유틸 ----------
function clean(s) {
  return String(s).replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```/g, "").trim();
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

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

async function extractText(base64) {
  const buf = Buffer.from(base64, "base64");
  const parser = new PDFParse({ data: new Uint8Array(buf) });
  const r = await parser.getText();
  if (parser.destroy) await parser.destroy();
  return (r.text || "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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
    throw new Error(code === "ECONNREFUSED" ? "OLLAMA_DOWN" : "OLLAMA_FETCH");
  }
  return res;
}

async function embed(input) {
  // input: string | string[]  ->  반환: number[][]
  const res = await ollamaFetch("/api/embed", { model: EMBED_MODEL, input });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    if (res.status === 404 || /not found|pull/i.test(b)) throw new Error("EMBED_MODEL_MISSING");
    throw new Error(`OLLAMA_HTTP_${res.status}`);
  }
  const data = await res.json();
  return data.embeddings || [];
}

async function chat(messages) {
  const res = await ollamaFetch("/api/chat", { model: CHAT_MODEL, messages, stream: false, options: { temperature: 0.2 } });
  if (!res.ok) {
    const b = await res.text().catch(() => "");
    if (res.status === 404 || /not found|pull/i.test(b)) throw new Error("CHAT_MODEL_MISSING");
    throw new Error(`OLLAMA_HTTP_${res.status}`);
  }
  const data = await res.json();
  return data.message?.content ?? "";
}

function mapErr(res, e) {
  const m = String(e.message || "");
  console.error("[err]", m);
  if (m === "OLLAMA_DOWN" || m === "OLLAMA_FETCH")
    return res.status(503).json({ error: "Ollama 서버에 연결할 수 없습니다. 실행 중인지 확인하세요." });
  if (m === "EMBED_MODEL_MISSING")
    return res.status(424).json({ error: `임베딩 모델(${EMBED_MODEL})이 없습니다. 'ollama pull ${EMBED_MODEL}' 을 실행하세요.` });
  if (m === "CHAT_MODEL_MISSING")
    return res.status(424).json({ error: `모델(${CHAT_MODEL})이 없습니다. 'ollama pull ${CHAT_MODEL}' 을 실행하세요.` });
  return res.status(502).json({ error: "처리 중 오류가 발생했습니다." });
}

// ---------- 1) 문서 색인 ----------
app.post("/api/index", async (req, res) => {
  const { pdf, filename } = req.body;
  if (!pdf) return res.status(400).json({ error: "PDF 데이터가 없습니다." });

  let text;
  try {
    text = await extractText(pdf);
  } catch (e) {
    console.error("[extract]", e);
    return res.status(422).json({ error: "PDF에서 텍스트를 추출하지 못했습니다. 스캔 이미지 PDF는 OCR이 필요합니다." });
  }
  if (text.length < 30) return res.status(422).json({ error: "읽을 수 있는 텍스트가 거의 없습니다(스캔 PDF일 수 있음)." });

  try {
    const chunks = chunkText(text, MAX_CHUNK_CHARS);
    const vectors = [];
    const BATCH = 16;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const part = await embed(chunks.slice(i, i + BATCH));
      vectors.push(...part);
    }
    const docId = crypto.randomUUID();
    const name = filename || "문서";
    chunks.forEach((t, idx) => {
      store.chunks.push({ id: crypto.randomUUID(), docId, docName: name, index: idx, text: t, embedding: vectors[idx] });
    });
    store.docs.push({ id: docId, name, addedAt: Date.now(), chunkCount: chunks.length });
    saveStore();
    res.json({ docId, name, chunkCount: chunks.length });
  } catch (e) {
    mapErr(res, e);
  }
});

// ---------- 2) 자료 목록 / 삭제 ----------
app.get("/api/docs", (_req, res) => {
  res.json({ docs: store.docs.slice().sort((a, b) => b.addedAt - a.addedAt) });
});

app.delete("/api/docs/:id", (req, res) => {
  const id = req.params.id;
  store.chunks = store.chunks.filter((c) => c.docId !== id);
  store.docs = store.docs.filter((d) => d.id !== id);
  saveStore();
  res.json({ ok: true });
});

// ---------- 3) 질문(검색 + 답변) ----------
app.post("/api/ask", async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) return res.status(400).json({ error: "질문을 입력하세요." });
  if (store.chunks.length === 0) return res.status(400).json({ error: "먼저 문서를 추가하세요." });

  try {
    const qvec = (await embed(question))[0];
    const scored = store.chunks
      .map((c) => ({ c, score: cosine(qvec, c.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);

    const context = scored.map((s, i) => `[${i + 1}] (${s.c.docName}) ${s.c.text}`).join("\n\n");
    const prompt = `아래 [참고자료]에 있는 내용만 근거로 사용자의 질문에 한국어로 답하세요.
- 자료에 없는 내용은 지어내지 말고 "자료에서 찾을 수 없습니다"라고 답합니다.
- 답에 사용한 근거는 문장 끝에 [번호] 형식으로 표시합니다.

[참고자료]
${context}

[질문]
${question}`;

    const answer = clean(
      await chat([
        { role: "system", content: "너는 제공된 자료에만 근거해 답하는 정확한 도우미야." },
        { role: "user", content: prompt },
      ])
    );

    res.json({
      answer,
      sources: scored.map((s, i) => ({
        n: i + 1,
        docName: s.c.docName,
        index: s.c.index,
        score: Number(s.score.toFixed(3)),
        snippet: s.c.text.slice(0, 300),
      })),
    });
  } catch (e) {
    mapErr(res, e);
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
      chatModel: CHAT_MODEL,
      embedModel: EMBED_MODEL,
      chatInstalled: has(CHAT_MODEL),
      embedInstalled: has(EMBED_MODEL),
      docCount: store.docs.length,
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
  console.log(`Ollama: ${OLLAMA_URL} | 답변: ${CHAT_MODEL} | 임베딩: ${EMBED_MODEL}`);
});
