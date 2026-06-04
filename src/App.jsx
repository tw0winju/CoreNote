import React, { useState, useRef, useEffect } from "react";

const C = {
  paper: "#f4efe4",
  paper2: "#ece4d3",
  ink: "#221d15",
  inkSoft: "#6a5f4d",
  accent: "#b5512a",
  accentSoft: "#ecd7c0",
  line: "#d9cfbb",
  card: "#fcf9f1",
  warn: "#fef3c7",
  warnText: "#92400e",
  green: "#dcfce7",
  greenText: "#166534",
  greenBorder: "#86efac",
  red: "#fee2e2",
  redText: "#991b1b",
  redBorder: "#fca5a5",
};
const sans = "'IBM Plex Sans KR', sans-serif";
const serif = "'Gowun Batang', serif";

// ── IndexedDB ──────────────────────────────────────────────────────
const DB_NAME = "corenote";
const DB_VER = 2;
const STORE = "history";
const MAX_HISTORY = 100;
const REVIEW_DAYS = [1, 3, 7, 14, 30];

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true })
          .createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbSave(item) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const addReq = store.add({ ...item, createdAt: Date.now() });
    let newId = null;
    addReq.onsuccess = () => { newId = addReq.result; };
    tx.oncomplete = () => resolve(newId);
    tx.onerror = () => reject(tx.error);
  });
}

async function dbLoad() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).index("createdAt").getAll();
    req.onsuccess = () => resolve([...req.result].reverse());
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function dbUpdate(id, updates) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const req = store.get(id);
    req.onsuccess = () => { if (req.result) store.put({ ...req.result, ...updates }); };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ── Utils ──────────────────────────────────────────────────────────
const MAX_FILE_MB = 50;
const DEFAULT_DIR = "기본";

function fisherYates(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function reviewStatus(item) {
  if (!item.nextReview) return null;
  const days = Math.ceil((item.nextReview - Date.now()) / 86400000);
  if (days <= 0) return { text: "복습 필요!", urgent: true };
  if (days === 1) return { text: "내일 복습", urgent: false };
  return { text: `${days}일 후 복습`, urgent: false };
}

// ── App ────────────────────────────────────────────────────────────
export default function App() {
  const [status, setStatus]     = useState("idle");
  const [fileName, setFileName] = useState("");
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState("");
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied]     = useState(false);
  const [progress, setProgress] = useState({ message: "" });
  const [history, setHistory]   = useState([]);

  // 폴더
  const [selectedDir, setSelectedDir]   = useState(DEFAULT_DIR);
  const [newDirName, setNewDirName]     = useState("");
  const [addingDir, setAddingDir]       = useState(false);
  const [collapsed, setCollapsed]       = useState({});

  // 퀴즈
  const [revealed, setRevealed]           = useState({});
  const [quizResults, setQuizResults]     = useState({});
  const [showWrongOnly, setShowWrongOnly] = useState(false);
  const [quizOrder, setQuizOrder]         = useState([]);
  const [mcSelected, setMcSelected]       = useState({});

  // 메모
  const [memos, setMemos]             = useState({});
  const [editingMemo, setEditingMemo] = useState(null);

  // 히스토리 추적
  const [currentHid, setCurrentHid] = useState(null);

  // 페이지
  const [page, setPage]           = useState("main"); // "main" | "monitor"

  // 리소스 모니터
  const [liveStats, setLiveStats] = useState({ tokensPerSec: 0, vramBytes: 0, vramTotal: 0, modelName: null, expiresAt: null });
  const [contextLength, setContextLength] = useState(null);
  const [lastTokens, setLastTokens]       = useState(null); // { prompt, eval, total }
  const [elapsed, setElapsed]     = useState(0);
  const [eta, setEta]             = useState(null);
  const [ollamaOk, setOllamaOk]   = useState(null);
  const [statsUpdatedAt, setStatsUpdatedAt] = useState(null);

  const inputRef    = useRef(null);
  const abortRef    = useRef(null);
  const newDirRef   = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => { dbLoad().then(setHistory).catch(() => {}); }, []);

  // 모델 컨텍스트 길이 (최초 1회)
  useEffect(() => {
    fetch("/api/modelinfo").then((r) => r.json()).then((d) => {
      if (d.ok && d.contextLength) setContextLength(d.contextLength);
    }).catch(() => {});
  }, []);

  // Ollama 상태 폴링 (idle 화면 뱃지용)
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch("/api/health").then((res) => res.json());
        setOllamaOk(r.ollama && r.modelInstalled);
      } catch { setOllamaOk(false); }
    };
    check();
    const id = setInterval(check, 15000);
    return () => clearInterval(id);
  }, []);

  // 경과 시간 타이머 (처리 중에만)
  useEffect(() => {
    if (status !== "processing") { setElapsed(0); setEta(null); return; }
    const id = setInterval(() => {
      if (startTimeRef.current) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  // VRAM 폴링 (처리 중 또는 모니터 페이지에서)
  useEffect(() => {
    if (status !== "processing" && page !== "monitor") return;
    const interval = page === "monitor" ? 2000 : 3000;
    const poll = async () => {
      try {
        const r = await fetch("/api/stats").then((res) => res.json());
        if (r.ok && r.models?.length) {
          const m = r.models[0];
          setLiveStats((prev) => ({ ...prev, vramBytes: m.size_vram || 0, vramTotal: m.size || 0, modelName: m.name || null, expiresAt: m.expires_at || null }));
        } else {
          setLiveStats((prev) => ({ ...prev, vramBytes: 0, vramTotal: 0, modelName: null, expiresAt: null }));
        }
        setStatsUpdatedAt(Date.now());
      } catch {}
    };
    poll();
    const id = setInterval(poll, interval);
    return () => clearInterval(id);
  }, [status, page]);

  // 폴더 목록 (히스토리에서 추출)
  const directories = [...new Set(history.map((h) => h.directory || DEFAULT_DIR))].sort((a, b) =>
    a === DEFAULT_DIR ? -1 : b === DEFAULT_DIR ? 1 : a.localeCompare(b, "ko")
  );

  // 폴더별 그룹
  const grouped = directories.reduce((acc, dir) => {
    acc[dir] = history.filter((h) => (h.directory || DEFAULT_DIR) === dir);
    return acc;
  }, {});

  const toggleCollapse = (dir) => setCollapsed((c) => ({ ...c, [dir]: !c[dir] }));

  const confirmNewDir = () => {
    const name = newDirName.trim();
    if (!name) return;
    setSelectedDir(name);
    setNewDirName("");
    setAddingDir(false);
  };

  // ── 퀴즈 helpers ──
  const initQuiz = (quiz) => {
    setQuizOrder((quiz || []).map((_, i) => i));
    setQuizResults({});
    setShowWrongOnly(false);
    setRevealed({});
    setMcSelected({});
  };
  const shuffleQuiz = () => { setQuizOrder(fisherYates((result.quiz || []).map((_, i) => i))); setRevealed({}); setMcSelected({}); };
  const resetQuiz = () => {
    initQuiz(result?.quiz);
    if (currentHid) dbUpdate(currentHid, { quizResults: {}, mcSelected: {} }).catch(() => {});
  };

  // 퀴즈 결과 변경 + DB 저장
  const markQuiz = (i, val) => {
    const next = { ...quizResults, [i]: val };
    setQuizResults(next);
    if (currentHid) dbUpdate(currentHid, { quizResults: next, mcSelected }).catch(() => {});
  };
  const unmarkQuiz = (i) => {
    const next = { ...quizResults };
    delete next[i];
    setQuizResults(next);
    if (currentHid) dbUpdate(currentHid, { quizResults: next, mcSelected }).catch(() => {});
  };
  const pickMc = (i, oi, isCorrect) => {
    const nextMc  = { ...mcSelected, [i]: oi };
    const nextRes = { ...quizResults, [i]: isCorrect ? "correct" : "wrong" };
    setMcSelected(nextMc);
    setQuizResults(nextRes);
    if (currentHid) dbUpdate(currentHid, { quizResults: nextRes, mcSelected: nextMc }).catch(() => {});
  };

  // ── 메모 helpers ──
  const handleMemoBlur = (key, value) => {
    setEditingMemo(null);
    const next = { ...memos, [key]: value };
    setMemos(next);
    if (currentHid) dbUpdate(currentHid, { memos: next }).catch(() => {});
  };

  // ── 간격 반복 ──
  const markReviewed = async () => {
    if (!currentHid) return;
    const item = history.find((h) => h.id === currentHid);
    const cnt = (item?.reviewCount || 0) + 1;
    const days = REVIEW_DAYS[Math.min(cnt - 1, REVIEW_DAYS.length - 1)];
    await dbUpdate(currentHid, { reviewCount: cnt, nextReview: Date.now() + days * 86400000 }).catch(() => {});
    setHistory(await dbLoad().catch(() => history));
  };

  // ── SSE 요약 ──
  const summarize = async (base64, name) => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    startTimeRef.current = Date.now();
    setLiveStats({ tokensPerSec: 0, vramBytes: 0, vramTotal: 0 });
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdf: base64 }),
        signal: ctrl.signal,
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          let ev;
          try { ev = JSON.parse(part.slice(6)); } catch { continue; }
          if (ev.type === "progress") {
            setProgress(ev);
            if (ev.tokensPerSec > 0) setLiveStats((prev) => ({ ...prev, tokensPerSec: ev.tokensPerSec }));
            if (ev.step === "map" && ev.current > 0 && ev.total > 1 && startTimeRef.current) {
              const ms = Date.now() - startTimeRef.current;
              const avgMs = ms / ev.current;
              setEta(avgMs * (ev.total - ev.current + 1));
            }
          }
          if (ev.type === "done") {
            setResult(ev.result);
            setStatus("done");
            if (ev.tokens) setLastTokens(ev.tokens);
            initQuiz(ev.result.quiz);
            setMemos({});
            setCurrentHid(null);
            dbSave({
              directory: selectedDir,
              fileName: name,
              title: ev.result.title || name,
              result: ev.result,
              memos: {},
              quizResults: {},
              mcSelected: {},
              nextReview: Date.now() + 86400000,
              reviewCount: 0,
            }).then(async (newId) => {
              setCurrentHid(newId);
              setHistory(await dbLoad().catch(() => []));
            }).catch(() => {});
          }
          if (ev.type === "error") { setError(ev.message); setStatus("error"); }
        }
      }
    } catch (e) {
      if (e.name === "AbortError") return;
      setError("정리하는 중 문제가 생겼어요. 잠시 후 다시 시도하거나 다른 PDF로 시도해 주세요.");
      setStatus("error");
    }
  };

  const handleFile = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf") { setError("PDF 파일만 업로드할 수 있어요."); setStatus("error"); return; }
    if (f.size > MAX_FILE_MB * 1024 * 1024) { setError(`파일이 너무 큽니다. ${MAX_FILE_MB}MB 이하만 지원해요.`); setStatus("error"); return; }
    setError(""); setResult(null); setFileName(f.name);
    setProgress({ message: "PDF 읽는 중..." }); setStatus("processing");
    const reader = new FileReader();
    reader.onload = () => summarize(String(reader.result).split(",")[1], f.name);
    reader.onerror = () => { setError("파일을 읽는 중 오류가 발생했어요."); setStatus("error"); };
    reader.readAsDataURL(f);
  };

  const reset = () => {
    abortRef.current?.abort();
    setStatus("idle"); setResult(null); setError(""); setFileName("");
    setCopied(false); setProgress({ message: "" });
    setRevealed({}); setQuizResults({}); setShowWrongOnly(false); setQuizOrder([]); setMcSelected({});
    setMemos({}); setEditingMemo(null); setCurrentHid(null);
  };

  const loadFromHistory = (item) => {
    setFileName(item.fileName); setResult(item.result); setStatus("done");
    setCopied(false);
    const savedResults = item.quizResults || {};
    const savedMc     = item.mcSelected  || {};
    setQuizOrder((item.result?.quiz || []).map((_, i) => i));
    setQuizResults(savedResults);
    setMcSelected(savedMc);
    setRevealed(Object.fromEntries(Object.keys(savedResults).map((k) => [k, true])));
    setShowWrongOnly(false);
    setMemos(item.memos || {}); setEditingMemo(null);
    setCurrentHid(item.id); setSelectedDir(item.directory || DEFAULT_DIR);
  };

  const removeHistory = async (e, id) => {
    e.stopPropagation();
    await dbDelete(id).catch(() => {});
    setHistory((h) => h.filter((i) => i.id !== id));
    if (currentHid === id) reset();
  };

  // ── 내보내기 ──
  const buildMd = () => {
    if (!result) return "";
    const L = [];
    L.push(`# ${result.title}\n`);
    if (result.sections) {
      // 새 형식
      L.push(`> ${result.summary}\n`);
      (result.sections || []).forEach((sec, si) => {
        L.push(`\n## ${String(si + 1).padStart(2, "0")}. ${sec.title}`);
        (sec.topics || []).forEach((topic) => {
          L.push(`\n### ${topic.title}`);
          L.push(`**내용:**`);
          (topic.content || []).forEach((c) => L.push(`- ${c}`));
          if (topic.easyExplanation) {
            L.push(`\n**쉬운 설명:**`);
            L.push(`> ${topic.easyExplanation}`);
          }
        });
      });
    } else {
      // 구 형식
      L.push(`> ${result.oneLineSummary}\n`);
      L.push(`## 핵심 요약`);
      (result.summary || []).forEach((s, i) => L.push(`${i + 1}. ${s}`));
      L.push(`\n## 주요 개념`);
      (result.concepts || []).forEach((c, i) => {
        L.push(`**${c.term}**: ${c.explanation}`);
        if (memos[`c${i}`]) L.push(`  > 메모: ${memos[`c${i}`]}`);
      });
      L.push(`\n## 암기 포인트`);
      (result.keyPoints || []).forEach((k) => L.push(`- ${k}`));
    }
    L.push(`\n## 복습 퀴즈`);
    (result.quiz || []).forEach((q, i) => {
      if (q.type === "mc") {
        L.push(`**Q${i + 1}. [4지선다] ${q.question}**`);
        (q.options || []).forEach((opt, oi) => L.push(`  ${String.fromCharCode(65 + oi)}. ${opt}${oi === q.correct ? " ✓" : ""}`));
        if (q.answer) L.push(`  > ${q.answer}`);
        L.push("");
      } else {
        L.push(`**Q${i + 1}. ${q.question}**\n> ${q.answer}\n`);
      }
    });
    return L.join("\n");
  };

  const copyAll = () => {
    navigator.clipboard.writeText(buildMd()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  const downloadMd = () => {
    const blob = new Blob([buildMd()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(result.title || fileName).replace(/[\\/:*?"<>|]/g, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdf = () => {
    const prev = document.title;
    document.title = `${(result.title || fileName).replace(/[\\/:*?"<>|]/g, "_")} 요약본`;
    window.print();
    setTimeout(() => { document.title = prev; }, 1000);
  };

  const fmtDate = (ts) => new Date(ts).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  const fmtTime = (secs) => { const m = Math.floor(secs / 60); const s = secs % 60; return m > 0 ? `${m}분 ${s}초` : `${s}초`; };

  // ── 퀴즈 표시 ──
  const orderedQuiz = quizOrder.length === (result?.quiz?.length || 0) && quizOrder.length > 0
    ? quizOrder.map((i) => ({ q: result.quiz[i], i }))
    : (result?.quiz || []).map((q, i) => ({ q, i }));
  const displayedQuiz = showWrongOnly ? orderedQuiz.filter(({ i }) => quizResults[i] === "wrong") : orderedQuiz;
  const wrongCnt   = Object.values(quizResults).filter((v) => v === "wrong").length;
  const correctCnt = Object.values(quizResults).filter((v) => v === "correct").length;
  const totalQ     = result?.quiz?.length || 0;
  const allDone    = totalQ > 0 && Object.keys(quizResults).length === totalQ;

  const btn   = { border: `1px solid ${C.line}`, background: C.card, color: C.ink, padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer" };
  const btnSm = { ...btn, padding: "6px 11px", fontSize: 12 };

  return (
    <div style={{ fontFamily: sans, color: C.ink, minHeight: "100vh", background: `radial-gradient(circle at 18% 12%, ${C.paper2}, ${C.paper} 55%)` }}>
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "clamp(28px,5vw,56px) clamp(16px,4vw,24px) 90px" }}>

        {/* Header */}
        <header style={{ marginBottom: 40, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <div className="no-print" style={{ fontSize: 12, letterSpacing: "0.32em", textTransform: "uppercase", color: C.accent, fontWeight: 600 }}>AI Study Assistant</div>
            <h1 style={{ fontFamily: serif, fontSize: "clamp(32px,6vw,46px)", lineHeight: 1.1, margin: "10px 0 8px", fontWeight: 700 }}>코어노트</h1>
            <p className="no-print" style={{ color: C.inkSoft, fontSize: 16, margin: 0, maxWidth: 520 }}>
              PDF 강의 자료를 올리면, 핵심 요약부터 개념 정리·암기 포인트·복습 퀴즈까지 한 번에 만들어 드려요.
            </p>
          </div>
          <button
            className="no-print"
            onClick={() => setPage((p) => p === "monitor" ? "main" : "monitor")}
            style={{ border: `1px solid ${page === "monitor" ? C.accent : C.line}`, background: page === "monitor" ? C.accentSoft : C.card, color: page === "monitor" ? C.accent : C.ink, padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", flexShrink: 0, marginTop: 6 }}
          >
            📊 모니터
          </button>
        </header>

        {/* ── Upload ── */}
        {page === "main" && (status === "idle" || status === "error") && (
          <div className="rise no-print">

            {/* Ollama 상태 뱃지 */}
            <div style={{ marginBottom: 18 }}>
              {ollamaOk === null ? (
                <span style={{ fontSize: 12, color: C.inkSoft }}>Ollama 연결 확인 중...</span>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, padding: "4px 11px", borderRadius: 20, background: ollamaOk ? C.green : C.red, color: ollamaOk ? C.greenText : C.redText }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
                  {ollamaOk ? "Ollama 준비됨" : "Ollama 연결 안 됨"}
                </span>
              )}
            </div>

            {/* 폴더 선택 */}
            <div style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: C.inkSoft, flexShrink: 0 }}>저장할 폴더</span>
              {addingDir ? (
                <input
                  ref={newDirRef}
                  autoFocus
                  value={newDirName}
                  onChange={(e) => setNewDirName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmNewDir(); if (e.key === "Escape") { setAddingDir(false); setNewDirName(""); } }}
                  onBlur={confirmNewDir}
                  placeholder="폴더 이름 입력 후 Enter"
                  style={{ border: `1px solid ${C.accent}`, borderRadius: 8, padding: "5px 10px", fontSize: 13, fontFamily: sans, background: C.card, color: C.ink, outline: "none", width: 200 }}
                />
              ) : (
                <select
                  value={selectedDir}
                  onChange={(e) => setSelectedDir(e.target.value)}
                  style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 10px", fontSize: 13, fontFamily: sans, background: C.card, color: C.ink, cursor: "pointer" }}
                >
                  {[...new Set([DEFAULT_DIR, ...directories, selectedDir])].map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => { setAddingDir(true); setNewDirName(""); }}
                style={{ ...btnSm, color: C.accent, borderColor: C.accent }}
              >
                + 새 폴더
              </button>
            </div>

            {/* 드롭존 */}
            <div
              className="zone"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
              style={{ border: `2px dashed ${dragging ? C.accent : C.line}`, background: dragging ? C.card : "transparent", borderRadius: 18, padding: "clamp(32px,5vw,56px) 28px", textAlign: "center", transition: "all .2s", cursor: "pointer" }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 14, background: C.accentSoft, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 16V4M12 4l-4 4M12 4l4 4" /><path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                </svg>
              </div>
              <div style={{ fontFamily: serif, fontSize: 21, fontWeight: 700, marginBottom: 6 }}>PDF를 여기에 끌어다 놓으세요</div>
              <div style={{ color: C.inkSoft, fontSize: 14 }}>
                또는 클릭해서 파일을 선택하세요 (최대 {MAX_FILE_MB}MB)
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: C.accent, fontWeight: 600 }}>
                📁 {selectedDir}
              </div>
              <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => handleFile(e.target.files[0])} />
            </div>
            {error && <div style={{ marginTop: 16, color: C.accent, fontSize: 14, textAlign: "center" }}>{error}</div>}

            {/* 히스토리 — 폴더별 그룹 */}
            {history.length > 0 && (
              <div style={{ marginTop: 36 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft, letterSpacing: "0.08em", marginBottom: 14 }}>
                  정리 기록
                </div>
                {directories.map((dir) => (
                  <div key={dir} style={{ marginBottom: 12 }}>
                    {/* 폴더 헤더 */}
                    <div
                      onClick={() => toggleCollapse(dir)}
                      style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px", cursor: "pointer", userSelect: "none" }}
                    >
                      <span style={{ fontSize: 15 }}>📁</span>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{dir}</span>
                      <span style={{ fontSize: 12, color: C.inkSoft }}>({grouped[dir].length})</span>
                      <span style={{ marginLeft: "auto", fontSize: 12, color: C.inkSoft, transform: collapsed[dir] ? "rotate(-90deg)" : "rotate(0)", transition: "transform .2s", display: "inline-block" }}>▼</span>
                    </div>

                    {/* 폴더 내 항목 */}
                    {!collapsed[dir] && (
                      <div style={{ display: "grid", gap: 6, paddingLeft: 8, borderLeft: `2px solid ${C.line}`, marginLeft: 8 }}>
                        {grouped[dir].map((item) => {
                          const rev = reviewStatus(item);
                          return (
                            <div
                              key={item.id}
                              className="hist-item"
                              onClick={() => loadFromHistory(item)}
                              style={{ background: C.card, border: `1px solid ${rev?.urgent ? C.accent : C.line}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}
                            >
                              <div style={{ minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                  <span style={{ fontWeight: 600, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</span>
                                  {rev && (
                                    <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0, color: rev.urgent ? C.accent : C.inkSoft, background: rev.urgent ? C.accentSoft : C.paper2, padding: "1px 6px", borderRadius: 4 }}>
                                      {rev.text}
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 2 }}>{item.fileName} · {fmtDate(item.createdAt)}</div>
                              </div>
                              <button onClick={(e) => removeHistory(e, item.id)} style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 18, lineHeight: 1, padding: "2px 5px", borderRadius: 5, flexShrink: 0, cursor: "pointer" }}>×</button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Processing ── */}
        {page === "main" && status === "processing" && (
          <div className="rise no-print" style={{ textAlign: "center", padding: "52px 20px" }}>
            <div className="spin" style={{ width: 44, height: 44, border: `3px solid ${C.accentSoft}`, borderTopColor: C.accent, borderRadius: "50%", margin: "0 auto 20px" }} />
            <div style={{ fontFamily: serif, fontSize: 20, fontWeight: 700 }}>읽고 정리하는 중…</div>
            <div style={{ color: C.inkSoft, fontSize: 14, marginTop: 6 }}>{progress.message || fileName}</div>

            {/* 진행 바 */}
            {progress.step === "map" && progress.total > 1 && (
              <div style={{ maxWidth: 300, margin: "18px auto 0" }}>
                <div style={{ background: C.line, borderRadius: 6, height: 7, overflow: "hidden" }}>
                  <div style={{ background: C.accent, height: "100%", borderRadius: 6, width: `${((progress.current || 0) / progress.total) * 100}%`, transition: "width 0.5s ease" }} />
                </div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 5 }}>{progress.current || 0} / {progress.total} 구간</div>
              </div>
            )}
            {progress.step === "compress" && (
              <div style={{ maxWidth: 300, margin: "18px auto 0", background: C.warn, border: "1px solid #fde68a", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: C.warnText }}>
                ⚡ {progress.message}
              </div>
            )}

            {/* 처리 중 토큰 사용량 */}
            {(() => {
              const tokens = progress.step === "reduce" ? progress.estimatedTokens : progress.totalTokensUsed;
              const max = contextLength || progress.contextLength;
              if (!tokens) return null;
              const ratio = max ? tokens / max : null;
              const color = ratio > 0.85 ? "#ef4444" : ratio > 0.6 ? "#f59e0b" : C.accent;
              const label = progress.step === "reduce" ? "최종 요약 입력 (추정)" : "분석 입력량 (추정)";
              return (
                <div style={{ maxWidth: 300, margin: "14px auto 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.inkSoft, marginBottom: 4 }}>
                    <span>{label}</span>
                    <span style={{ fontWeight: 600 }}>
                      {tokens.toLocaleString()}{max ? ` / ${max.toLocaleString()}` : ""} tokens
                    </span>
                  </div>
                  {max && (
                    <div style={{ background: C.line, borderRadius: 6, height: 6, overflow: "hidden" }}>
                      <div style={{ background: color, width: `${Math.min(100, ratio * 100)}%`, height: "100%", borderRadius: 6, transition: "width 0.5s ease" }} />
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ marginTop: 22, display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setPage("monitor")}
                style={{ border: `1px solid ${C.line}`, background: C.card, color: C.inkSoft, padding: "7px 16px", borderRadius: 9, fontSize: 13, cursor: "pointer" }}
              >
                📊 실시간 통계 보기 →
              </button>
              <button
                onClick={reset}
                style={{ border: `1px solid ${C.line}`, background: C.card, color: C.accent, padding: "7px 16px", borderRadius: 9, fontSize: 13, cursor: "pointer" }}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── Result ── */}
        {page === "main" && status === "done" && result && (
          <div className="rise">
            {result._note && (
              <div style={{ background: C.warn, color: C.warnText, border: "1px solid #fde68a", borderRadius: 10, padding: "10px 16px", fontSize: 13, marginBottom: 18 }}>
                ⚠ {result._note}
              </div>
            )}

            {/* 툴바 */}
            <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: C.inkSoft, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ background: C.accentSoft, color: C.accent, fontWeight: 600, padding: "3px 9px", borderRadius: 6, fontSize: 12, flexShrink: 0 }}>📁 {selectedDir}</span>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fileName}</span>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {currentHid && <button onClick={markReviewed} style={{ ...btn, background: C.accentSoft, color: C.accent, borderColor: "#c97a52" }}>복습 완료</button>}
                <button onClick={copyAll} style={btn}>{copied ? "복사됨 ✓" : "전체 복사"}</button>
                <button onClick={downloadMd} style={btn}>MD 저장</button>
                <button onClick={downloadPdf} style={btn}>PDF 저장</button>
                <button onClick={() => window.print()} style={btn}>인쇄</button>
                <button onClick={reset} style={{ ...btn, border: "none", background: C.ink, color: C.paper }}>새 PDF</button>
              </div>
            </div>

            <h2 style={{ fontFamily: serif, fontSize: "clamp(22px,4vw,32px)", fontWeight: 700, margin: "0 0 14px", lineHeight: 1.2 }}>{result.title}</h2>
            {(result.sections ? result.summary : result.oneLineSummary) && (
              <div style={{ borderLeft: `4px solid ${C.accent}`, background: C.card, padding: "16px 20px", borderRadius: "0 12px 12px 0", fontSize: 17, fontFamily: serif, lineHeight: 1.55, marginBottom: 34 }}>
                {result.sections ? result.summary : result.oneLineSummary}
              </div>
            )}

            {/* ── 새 형식: 섹션별 정리 ── */}
            {result.sections && (result.sections || []).map((sec, si) => (
              <Section key={si} title={sec.title}>
                <div style={{ display: "grid", gap: 16 }}>
                  {(sec.topics || []).map((topic, ti) => (
                    <div key={ti} style={{ border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
                      <div style={{ background: C.paper2, padding: "10px 18px", fontFamily: serif, fontWeight: 700, fontSize: 16, borderBottom: `1px solid ${C.line}` }}>
                        {topic.title}
                      </div>
                      <div style={{ padding: "14px 18px" }}>
                        <ul style={{ margin: 0, paddingLeft: 22, display: "grid", gap: 4 }}>
                          {(topic.content || []).map((c, ci) => (
                            <li key={ci} style={{ lineHeight: 1.75, fontSize: 14.5, color: C.ink }}>{c}</li>
                          ))}
                        </ul>
                      </div>
                      {topic.easyExplanation && (
                        <div style={{ background: C.warn, borderTop: `1px dashed ${C.line}`, padding: "12px 18px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.warnText, marginBottom: 6, letterSpacing: "0.06em" }}>쉬운 설명</div>
                          <div style={{ fontSize: 14, lineHeight: 1.75, color: C.warnText, whiteSpace: "pre-wrap" }}>{topic.easyExplanation}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Section>
            ))}

            {/* ── 구 형식: 핵심 요약 / 주요 개념 / 암기 포인트 ── */}
            {!result.sections && (
              <>
                <Section title="핵심 요약">
                  <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
                    {(result.summary || []).map((s, i) => (
                      <li key={i} style={{ display: "flex", gap: 12, padding: "9px 0", lineHeight: 1.6 }}>
                        <span style={{ color: C.accent, fontWeight: 700, flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </Section>

                <Section title="주요 개념">
                  <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                    {(result.concepts || []).map((c, i) => {
                      const key = `c${i}`;
                      return (
                        <div key={i} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "14px 18px" }}>
                          <div style={{ fontFamily: serif, fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{c.term}</div>
                          <div style={{ color: C.inkSoft, fontSize: 14.5, lineHeight: 1.6 }}>{c.explanation}</div>
                          {memos[key] && editingMemo !== key && (
                            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px dashed ${C.line}`, fontSize: 13, color: C.ink, lineHeight: 1.5 }}>{memos[key]}</div>
                          )}
                          {editingMemo === key ? (
                            <textarea className="no-print" autoFocus defaultValue={memos[key] || ""} onBlur={(e) => handleMemoBlur(key, e.target.value)} placeholder="내 메모..." style={{ marginTop: 10, width: "100%", minHeight: 56, resize: "vertical", border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, fontFamily: sans, background: "#fffdf7", color: C.ink, boxSizing: "border-box" }} />
                          ) : (
                            <div className="no-print" onClick={() => setEditingMemo(key)} style={{ marginTop: 8, fontSize: 12, color: C.accent, cursor: "pointer", fontStyle: "italic" }}>
                              {memos[key] ? "✏ 수정" : "+ 메모 추가"}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Section>

                <Section title="암기 포인트">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {(result.keyPoints || []).map((k, i) => (
                      <div key={i} style={{ background: C.accentSoft, color: "#7a3417", borderRadius: 10, padding: "10px 14px", fontSize: 14, lineHeight: 1.5, flex: "1 1 220px" }}>{k}</div>
                    ))}
                  </div>
                </Section>
              </>
            )}

            {/* 복습 퀴즈 */}
            <Section title="복습 퀴즈">
              <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={shuffleQuiz} style={btnSm}>셔플</button>
                {wrongCnt > 0 && (
                  <button onClick={() => setShowWrongOnly((v) => !v)} style={{ ...btnSm, background: showWrongOnly ? C.red : C.card, color: showWrongOnly ? C.redText : C.ink, borderColor: showWrongOnly ? C.redBorder : C.line }}>
                    오답만 보기 ({wrongCnt})
                  </button>
                )}
                {Object.keys(quizResults).length > 0 && (
                  <>
                    <span style={{ fontSize: 12, color: C.inkSoft }}>✓ {correctCnt} · ✗ {wrongCnt} · ? {totalQ - Object.keys(quizResults).length}</span>
                    <button onClick={resetQuiz} style={{ ...btnSm, marginLeft: "auto" }}>초기화</button>
                  </>
                )}
              </div>

              {allDone && (
                <div style={{ background: wrongCnt === 0 ? C.green : C.warn, border: `1px solid ${wrongCnt === 0 ? C.greenBorder : "#fde68a"}`, borderRadius: 10, padding: "10px 16px", fontSize: 13, marginBottom: 14, color: wrongCnt === 0 ? C.greenText : C.warnText }}>
                  {wrongCnt === 0 ? "완벽해요! 모든 문제를 맞혔습니다 🎉" : `${totalQ}문제 중 ${correctCnt}개 정답 · 오답 ${wrongCnt}개를 다시 복습하세요.`}
                </div>
              )}

              {displayedQuiz.length === 0 && showWrongOnly && (
                <div style={{ color: C.inkSoft, fontSize: 14, textAlign: "center", padding: "24px 0" }}>오답이 없습니다!</div>
              )}

              <div style={{ display: "grid", gap: 10 }}>
                {displayedQuiz.map(({ q, i }) => {
                  const ev = quizResults[i];
                  return (
                    <div key={i} style={{ background: ev === "correct" ? C.green : ev === "wrong" ? C.red : C.card, border: `1px solid ${ev === "correct" ? C.greenBorder : ev === "wrong" ? C.redBorder : C.line}`, borderRadius: 12, padding: "15px 18px", transition: "background .2s, border-color .2s" }}>

                      {/* 질문 + 유형 뱃지 */}
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ color: C.accent, fontWeight: 700, fontSize: 15, flexShrink: 0, lineHeight: 1.5 }}>Q{i + 1}.</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, fontSize: 15, lineHeight: 1.5 }}>{q.question}</span>
                          <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: q.type === "mc" ? C.accentSoft : C.paper2, color: q.type === "mc" ? C.accent : C.inkSoft, verticalAlign: "middle", whiteSpace: "nowrap" }}>
                            {q.type === "mc" ? "4지선다" : "주관식"}
                          </span>
                        </div>
                      </div>

                      {q.type === "mc" ? (
                        /* ── 4지선다 ── */
                        <>
                          <div className="no-print" style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                            {(q.options || []).map((opt, oi) => {
                              const selected = mcSelected[i] === oi;
                              const isCorrect = oi === q.correct;
                              const answered = mcSelected[i] !== undefined;
                              let bg = C.paper2, border = C.line, color = C.ink;
                              if (answered) {
                                if (isCorrect)        { bg = C.green; border = C.greenBorder; color = C.greenText; }
                                else if (selected)    { bg = C.red;   border = C.redBorder;   color = C.redText; }
                                else                  { bg = C.paper; color = C.inkSoft; }
                              }
                              return (
                                <button
                                  key={oi}
                                  disabled={answered}
                                  onClick={() => pickMc(i, oi, isCorrect)}
                                  style={{ background: bg, border: `1px solid ${border}`, color, borderRadius: 9, padding: "9px 12px", fontSize: 13.5, cursor: answered ? "default" : "pointer", textAlign: "left", lineHeight: 1.4, transition: "background .15s, border-color .15s", fontFamily: sans }}
                                >
                                  <span style={{ fontWeight: 700, marginRight: 5, opacity: 0.65 }}>{String.fromCharCode(65 + oi)}.</span>
                                  {opt}
                                  {answered && isCorrect && <span style={{ marginLeft: 5 }}>✓</span>}
                                  {answered && selected && !isCorrect && <span style={{ marginLeft: 5 }}>✗</span>}
                                </button>
                              );
                            })}
                          </div>
                          {mcSelected[i] !== undefined && q.answer && (
                            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${C.line}`, color: C.inkSoft, fontSize: 14, lineHeight: 1.6 }}>{q.answer}</div>
                          )}
                        {/* 인쇄 전용: 보기 목록 + 정답 표시 */}
                        <div className="print-only" style={{ marginTop: 12 }}>
                          {(q.options || []).map((opt, oi) => (
                            <div key={oi} style={{ padding: "3px 0", fontWeight: oi === q.correct ? 700 : 400, color: oi === q.correct ? C.greenText : C.ink, fontSize: 14 }}>
                              {String.fromCharCode(65 + oi)}. {opt}{oi === q.correct ? " ✓" : ""}
                            </div>
                          ))}
                          {q.answer && <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.line}`, color: C.inkSoft, fontSize: 13 }}>해설: {q.answer}</div>}
                        </div>
                        </>
                      ) : (
                        /* ── 주관식 ── */
                        <>
                          {revealed[i] ? (
                            <>
                              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}`, color: C.inkSoft, fontSize: 14.5, lineHeight: 1.6 }}>{q.answer}</div>
                              {!ev && (
                                <div className="no-print" style={{ display: "flex", gap: 8, marginTop: 10 }}>
                                  <button onClick={() => markQuiz(i, "correct")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${C.greenBorder}`, background: C.green, color: C.greenText, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>알았어 ✓</button>
                                  <button onClick={() => markQuiz(i, "wrong")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${C.redBorder}`, background: C.red, color: C.redText, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>몰랐어 ✗</button>
                                </div>
                              )}
                              {ev === "correct" && <div className="no-print" style={{ marginTop: 8, fontSize: 12, color: C.greenText, fontWeight: 600 }}>✓ 알고 있었어요!</div>}
                              {ev === "wrong" && (
                                <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                                  <span style={{ fontSize: 12, color: C.redText, fontWeight: 600 }}>✗ 다시 복습하세요</span>
                                  <button onClick={() => unmarkQuiz(i)} style={{ fontSize: 11, color: C.inkSoft, background: "transparent", border: "none", textDecoration: "underline", cursor: "pointer" }}>취소</button>
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <div className="no-print" style={{ marginTop: 8, fontSize: 12.5, color: C.accent, cursor: "pointer" }} onClick={() => setRevealed((r) => ({ ...r, [i]: true }))}>탭하면 정답 보기</div>
                              <div className="print-only" style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}`, color: C.inkSoft, fontSize: 14.5, lineHeight: 1.6 }}>{q.answer}</div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
        )}

        {/* ── Monitor Page ── */}
        {page === "monitor" && (
          <div className="rise">

            {/* 상단 바 */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
              <button onClick={() => setPage("main")} style={{ border: `1px solid ${C.line}`, background: C.card, color: C.ink, padding: "7px 14px", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>← 돌아가기</button>
              <h2 style={{ fontFamily: serif, fontSize: 22, fontWeight: 700, margin: 0 }}>LLM 모니터</h2>
              {statsUpdatedAt && (
                <span style={{ marginLeft: "auto", fontSize: 11, color: C.inkSoft }}>
                  업데이트 {new Date(statsUpdatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              )}
            </div>

            {/* 연결 상태 */}
            <MonSection title="연결 상태">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ollamaOk ? "#22c55e" : "#ef4444", display: "inline-block", flexShrink: 0 }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{ollamaOk === null ? "확인 중..." : ollamaOk ? "Ollama 서버 연결됨" : "Ollama 서버 연결 안 됨"}</span>
                </div>
                {ollamaOk && (
                  <div style={{ paddingLeft: 18, fontSize: 13, color: C.inkSoft }}>
                    모델: <span style={{ color: C.ink, fontWeight: 600 }}>{liveStats.modelName || "qwen3:8b"}</span>
                    {liveStats.modelName ? <span style={{ marginLeft: 8, color: C.greenText, fontWeight: 600, fontSize: 12, background: C.green, padding: "1px 7px", borderRadius: 4 }}>VRAM 로드됨</span>
                    : <span style={{ marginLeft: 8, color: C.inkSoft, fontSize: 12 }}>대기 중</span>}
                  </div>
                )}
              </div>
            </MonSection>

            {/* 처리 진행 상황 (처리 중에만) */}
            {status === "processing" && (
              <MonSection title="처리 진행 상황">
                <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 12 }}>{progress.message}</div>
                {progress.step === "map" && progress.total > 1 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.inkSoft, marginBottom: 5 }}>
                      <span>청크 처리</span>
                      <span>{progress.current || 0} / {progress.total} 구간</span>
                    </div>
                    <div style={{ background: C.line, borderRadius: 6, height: 8, overflow: "hidden" }}>
                      <div style={{ background: C.accent, height: "100%", borderRadius: 6, width: `${((progress.current || 0) / progress.total) * 100}%`, transition: "width 0.5s ease" }} />
                    </div>
                  </div>
                )}
                {progress.step === "reduce" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div className="spin" style={{ width: 14, height: 14, border: `2px solid ${C.accentSoft}`, borderTopColor: C.accent, borderRadius: "50%", flexShrink: 0 }} />
                    <span style={{ fontSize: 13 }}>최종 JSON 생성 중...</span>
                  </div>
                )}
              </MonSection>
            )}

            {/* 리소스 통계 */}
            <MonSection title="리소스 통계">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
                {[
                  { icon: "⚡", label: "생성 속도", value: liveStats.tokensPerSec > 0 ? `${liveStats.tokensPerSec} tok/s` : "—" },
                  { icon: "🖥", label: "VRAM 사용", value: liveStats.vramBytes > 0 ? `${(liveStats.vramBytes / 1e9).toFixed(1)} GB` : "—" },
                  { icon: "⏱", label: "경과 시간", value: elapsed > 0 ? fmtTime(elapsed) : status === "done" ? "완료" : "—" },
                  { icon: "⏳", label: "예상 완료", value: status !== "processing" ? "—" : progress.step === "reduce" ? "마무리 중..." : eta !== null ? `~${fmtTime(Math.ceil(eta / 1000))} 남음` : "계산 중..." },
                ].map(({ icon, label, value }) => (
                  <div key={label} style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 16px" }}>
                    <div style={{ fontSize: 11, color: C.inkSoft, marginBottom: 4 }}>{icon} {label}</div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
            </MonSection>

            {/* 컨텍스트 사용량 */}
            {(lastTokens || contextLength || progress.estimatedTokens || progress.totalTokensUsed) && (() => {
              const maxTokens = contextLength || progress.contextLength;
              // 처리 중: reduce면 estimatedTokens, map이면 totalTokensUsed
              const liveTokens = progress.estimatedTokens || progress.totalTokensUsed;
              const displayTokens = lastTokens ? lastTokens.prompt : liveTokens;
              const ratio = displayTokens && maxTokens ? displayTokens / maxTokens : null;
              const barColor = ratio > 0.85 ? "#ef4444" : ratio > 0.6 ? "#f59e0b" : C.accent;
              const liveLabel = progress.step === "reduce" ? "최종 요약 입력 (추정)" : "분석 입력량 (추정)";
              return (
                <MonSection title="컨텍스트 사용량">
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 14 }}>
                      <span style={{ color: C.inkSoft }}>최대 컨텍스트</span>
                      <span style={{ fontWeight: 700, fontFamily: serif, fontSize: 16 }}>
                        {maxTokens ? maxTokens.toLocaleString() : "—"}
                        <span style={{ fontSize: 12, fontWeight: 400, color: C.inkSoft, marginLeft: 6 }}>tokens</span>
                      </span>
                    </div>
                    {displayTokens && (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", fontSize: 14 }}>
                          <span style={{ color: C.inkSoft }}>
                            {lastTokens ? "요약 입력" : liveLabel}
                          </span>
                          <span style={{ fontWeight: 700, fontFamily: serif, fontSize: 16 }}>
                            {displayTokens.toLocaleString()}
                            {maxTokens ? ` / ${maxTokens.toLocaleString()}` : ""}
                            <span style={{ fontSize: 12, fontWeight: 400, color: C.inkSoft, marginLeft: 6 }}>tokens</span>
                          </span>
                        </div>
                        {maxTokens && (
                          <>
                            <div style={{ background: C.line, borderRadius: 6, height: 8, overflow: "hidden" }}>
                              <div style={{ background: barColor, width: `${Math.min(100, ratio * 100)}%`, height: "100%", borderRadius: 6, transition: "width 0.5s ease" }} />
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.inkSoft }}>
                              <span>{Math.round(ratio * 100)}% 사용</span>
                              <span>여유 {(maxTokens - displayTokens).toLocaleString()} tokens</span>
                            </div>
                          </>
                        )}
                        {lastTokens && (
                          <div style={{ display: "flex", gap: 16, fontSize: 13, color: C.inkSoft, paddingTop: 6, borderTop: `1px solid ${C.line}` }}>
                            <span>입력 <b style={{ color: C.ink }}>{lastTokens.prompt.toLocaleString()}</b></span>
                            <span>생성 <b style={{ color: C.ink }}>{lastTokens.eval.toLocaleString()}</b></span>
                            <span>합계 <b style={{ color: C.ink }}>{lastTokens.total.toLocaleString()}</b></span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </MonSection>
              );
            })()}

            {/* 모델 상세 (VRAM에 로드된 경우) */}
            {liveStats.vramTotal > 0 && (
              <MonSection title="로드된 모델">
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span style={{ color: C.inkSoft }}>모델</span>
                    <span style={{ fontWeight: 600 }}>{liveStats.modelName}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span style={{ color: C.inkSoft }}>전체 크기</span>
                    <span style={{ fontWeight: 600 }}>{(liveStats.vramTotal / 1e9).toFixed(1)} GB</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                    <span style={{ color: C.inkSoft }}>VRAM 적재</span>
                    <span style={{ fontWeight: 600 }}>{(liveStats.vramBytes / 1e9).toFixed(1)} GB</span>
                  </div>
                  {liveStats.expiresAt && (
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
                      <span style={{ color: C.inkSoft }}>자동 해제 예정</span>
                      <span style={{ fontWeight: 600 }}>{new Date(liveStats.expiresAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  )}
                </div>

                {/* VRAM 적재율 바 */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.inkSoft, marginBottom: 5 }}>
                    <span>VRAM 적재율</span>
                    <span style={{ fontWeight: 700 }}>{Math.min(100, Math.round((liveStats.vramBytes / liveStats.vramTotal) * 100))}%</span>
                  </div>
                  <div style={{ background: C.line, borderRadius: 6, height: 8, overflow: "hidden" }}>
                    <div style={{ background: C.accent, width: `${Math.min(100, (liveStats.vramBytes / liveStats.vramTotal) * 100)}%`, height: "100%", borderRadius: 6, transition: "width 1s ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.inkSoft, marginTop: 4 }}>
                    <span>0 GB</span>
                    <span>{(liveStats.vramTotal / 1e9).toFixed(1)} GB</span>
                  </div>
                </div>
              </MonSection>
            )}

            {/* 모델 미로드 안내 */}
            {ollamaOk && !liveStats.modelName && (
              <div style={{ color: C.inkSoft, fontSize: 13, textAlign: "center", padding: "20px 0" }}>
                현재 VRAM에 로드된 모델이 없습니다. PDF를 처리하면 모델이 로드됩니다.
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

function MonSection({ title, children }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontFamily: "'Gowun Batang', serif", fontSize: 16, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8, color: "#221d15" }}>
        <span style={{ width: 4, height: 16, background: "#b5512a", borderRadius: 2, display: "inline-block" }} />
        {title}
      </h3>
      <div style={{ background: "#fcf9f1", border: "1px solid #d9cfbb", borderRadius: 12, padding: "16px 20px" }}>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={{ marginBottom: 34 }}>
      <h3 style={{ fontFamily: serif, fontSize: 19, fontWeight: 700, margin: "0 0 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 6, height: 18, background: C.accent, borderRadius: 3, display: "inline-block" }} />
        {title}
      </h3>
      {children}
    </section>
  );
}
