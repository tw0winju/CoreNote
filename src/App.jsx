import React, { useState, useEffect, useRef } from "react";

const C = {
  paper: "#f4efe4",
  paper2: "#ece4d3",
  ink: "#221d15",
  inkSoft: "#6a5f4d",
  accent: "#b5512a",
  accentSoft: "#ecd7c0",
  line: "#d9cfbb",
  card: "#fcf9f1",
};
const sans = "'IBM Plex Sans KR', sans-serif";
const serif = "'Gowun Batang', serif";

export default function App() {
  const [health, setHealth] = useState(null);
  const [docs, setDocs] = useState([]);
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState("");
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [result, setResult] = useState(null);
  const [openSrc, setOpenSrc] = useState(null);
  const inputRef = useRef(null);

  const loadDocs = async () => {
    try {
      const r = await fetch("/api/docs");
      const d = await r.json();
      setDocs(d.docs || []);
    } catch {}
  };
  const loadHealth = async () => {
    try {
      const r = await fetch("/api/health");
      setHealth(r.ok ? await r.json() : { ollama: false });
    } catch {
      setHealth({ ollama: false });
    }
  };
  useEffect(() => {
    loadHealth();
    loadDocs();
  }, []);

  const uploadFile = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf") {
      setIndexError("PDF 파일만 추가할 수 있어요.");
      return;
    }
    setIndexError("");
    setIndexing(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = String(reader.result).split(",")[1];
        const r = await fetch("/api/index", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pdf: base64, filename: f.name }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "색인 실패");
        await loadDocs();
        await loadHealth();
      } catch (e) {
        setIndexError(e.message || "색인 중 오류가 발생했어요.");
      } finally {
        setIndexing(false);
      }
    };
    reader.onerror = () => {
      setIndexError("파일을 읽지 못했어요.");
      setIndexing(false);
    };
    reader.readAsDataURL(f);
  };

  const removeDoc = async (id) => {
    try {
      await fetch(`/api/docs/${id}`, { method: "DELETE" });
      await loadDocs();
    } catch {}
  };

  const ask = async () => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError("");
    setResult(null);
    setOpenSrc(null);
    try {
      const r = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "질문 처리 실패");
      setResult(d);
    } catch (e) {
      setAskError(e.message || "질문 처리 중 오류가 발생했어요.");
    } finally {
      setAsking(false);
    }
  };

  const warn = health && (!health.ollama || !health.chatInstalled || !health.embedInstalled);

  return (
    <div
      style={{
        fontFamily: sans,
        color: C.ink,
        minHeight: "100vh",
        background: `radial-gradient(circle at 18% 12%, ${C.paper2}, ${C.paper} 55%)`,
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 22px 80px" }}>
        <header style={{ marginBottom: 26 }}>
          <div style={{ fontSize: 12, letterSpacing: "0.3em", textTransform: "uppercase", color: C.accent, fontWeight: 600 }}>
            Local RAG · 내 자료 검색
          </div>
          <h1 style={{ fontFamily: serif, fontSize: 42, lineHeight: 1.1, margin: "8px 0 6px", fontWeight: 700 }}>코어노트</h1>
          <p style={{ color: C.inkSoft, fontSize: 15.5, margin: 0, maxWidth: 560 }}>
            PDF를 추가해두고, 내 자료 전체에 질문하세요. 관련 부분을 찾아 <b>출처와 함께</b> 답합니다. 전부 내 컴퓨터에서 동작해요.
          </p>
        </header>

        {warn && (
          <div
            style={{
              background: "#fbeee6",
              border: `1px solid ${C.accentSoft}`,
              color: "#7a3417",
              borderRadius: 12,
              padding: "12px 16px",
              fontSize: 13.5,
              marginBottom: 22,
              lineHeight: 1.6,
            }}
          >
            {!health.ollama
              ? "⚠ Ollama에 연결할 수 없어요. Ollama가 실행 중인지 확인하세요."
              : !health.embedInstalled
              ? `⚠ 임베딩 모델(${health.embedModel})이 없어요. 터미널에서 'ollama pull ${health.embedModel}' 실행.`
              : `⚠ 답변 모델(${health.chatModel})이 없어요. 터미널에서 'ollama pull ${health.chatModel}' 실행.`}
          </div>
        )}

        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* Library */}
          <section style={{ flex: "1 1 300px", minWidth: 280 }}>
            <h2 style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 6, height: 17, background: C.accent, borderRadius: 3 }} /> 내 자료 ({docs.length})
            </h2>

            <div
              onClick={() => !indexing && inputRef.current && inputRef.current.click()}
              className="zone"
              style={{
                border: `2px dashed ${C.line}`,
                borderRadius: 14,
                padding: "20px 16px",
                textAlign: "center",
                cursor: indexing ? "default" : "pointer",
                marginBottom: 14,
                transition: "all .2s",
              }}
            >
              {indexing ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: C.inkSoft, fontSize: 14 }}>
                  <span className="spin" style={{ width: 18, height: 18, border: `2px solid ${C.accentSoft}`, borderTopColor: C.accent, borderRadius: "50%", display: "inline-block" }} />
                  색인 중…
                </div>
              ) : (
                <div style={{ color: C.inkSoft, fontSize: 14 }}>
                  <b style={{ color: C.accent }}>＋ PDF 추가</b>
                  <div style={{ fontSize: 12.5, marginTop: 3 }}>클릭해서 파일 선택</div>
                </div>
              )}
              <input ref={inputRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={(e) => uploadFile(e.target.files[0])} />
            </div>
            {indexError && <div style={{ color: C.accent, fontSize: 13, marginBottom: 12 }}>{indexError}</div>}

            <div style={{ display: "grid", gap: 8 }}>
              {docs.length === 0 && !indexing && (
                <div style={{ color: C.inkSoft, fontSize: 13.5, padding: "8px 2px" }}>아직 자료가 없어요. PDF를 추가해 시작하세요.</div>
              )}
              {docs.map((d) => (
                <div
                  key={d.id}
                  style={{
                    background: C.card,
                    border: `1px solid ${C.line}`,
                    borderRadius: 10,
                    padding: "11px 13px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: C.inkSoft }}>{d.chunkCount}개 조각</div>
                  </div>
                  <button
                    onClick={() => removeDoc(d.id)}
                    title="삭제"
                    style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 18, lineHeight: 1, padding: 4 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Ask */}
          <section style={{ flex: "1 1 440px", minWidth: 300 }}>
            <h2 style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 6, height: 17, background: C.accent, borderRadius: 3 }} /> 질문하기
            </h2>

            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === "Enter") ask();
              }}
              placeholder="내 자료에 대해 물어보세요. 예) 광합성에서 캘빈 회로는 어디서 일어나?"
              rows={3}
              style={{
                width: "100%",
                resize: "vertical",
                fontFamily: sans,
                fontSize: 15,
                color: C.ink,
                background: C.card,
                border: `1px solid ${C.line}`,
                borderRadius: 12,
                padding: "13px 15px",
                outline: "none",
                lineHeight: 1.6,
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <span style={{ fontSize: 12, color: C.inkSoft }}>Ctrl+Enter 로도 질문</span>
              <button
                onClick={ask}
                disabled={asking || !question.trim() || docs.length === 0}
                style={{
                  border: "none",
                  background: asking || !question.trim() || docs.length === 0 ? C.line : C.ink,
                  color: C.paper,
                  padding: "9px 20px",
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: asking || !question.trim() || docs.length === 0 ? "default" : "pointer",
                }}
              >
                {asking ? "찾는 중…" : "질문"}
              </button>
            </div>
            {askError && <div style={{ color: C.accent, fontSize: 13.5, marginTop: 12 }}>{askError}</div>}

            {asking && (
              <div className="rise" style={{ textAlign: "center", padding: "38px 0", color: C.inkSoft }}>
                <span className="spin" style={{ width: 30, height: 30, border: `3px solid ${C.accentSoft}`, borderTopColor: C.accent, borderRadius: "50%", display: "inline-block" }} />
                <div style={{ fontSize: 13.5, marginTop: 12 }}>관련 부분을 찾아 답을 만드는 중…</div>
              </div>
            )}

            {result && (
              <div className="rise" style={{ marginTop: 18 }}>
                <div
                  style={{
                    background: C.card,
                    border: `1px solid ${C.line}`,
                    borderLeft: `4px solid ${C.accent}`,
                    borderRadius: "0 12px 12px 0",
                    padding: "16px 18px",
                    fontSize: 15.5,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {result.answer}
                </div>

                {result.sources && result.sources.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 8, fontWeight: 600 }}>출처</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {result.sources.map((s) => (
                        <div
                          key={s.n}
                          className="qcard"
                          onClick={() => setOpenSrc(openSrc === s.n ? null : s.n)}
                          style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 13px", cursor: "pointer", transition: "box-shadow .2s" }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5 }}>
                            <span style={{ background: C.accentSoft, color: C.accent, fontWeight: 700, borderRadius: 6, padding: "1px 7px", fontSize: 12 }}>{s.n}</span>
                            <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.docName}</span>
                            <span style={{ marginLeft: "auto", color: C.inkSoft, fontSize: 12 }}>유사도 {s.score}</span>
                          </div>
                          {openSrc === s.n && (
                            <div style={{ marginTop: 9, paddingTop: 9, borderTop: `1px dashed ${C.line}`, fontSize: 13, color: C.inkSoft, lineHeight: 1.6 }}>
                              {s.snippet}…
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
