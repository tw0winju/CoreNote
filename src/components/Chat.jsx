import React from "react";
import { C, sans, serif } from "../theme";

function CopyButton({ text, id, copiedKey, onCopy }) {
  return (
    <button
      onClick={() => onCopy(text, id)}
      style={{
        position: "absolute", top: 8, right: 8,
        border: `1px solid ${C.line}`, background: C.paper, color: C.inkSoft,
        fontSize: 11, padding: "2px 7px", borderRadius: 5, cursor: "pointer", fontFamily: sans,
      }}
    >
      {copiedKey === id ? "✓" : "복사"}
    </button>
  );
}

function SourceCard({ s, isOpen, onToggle }) {
  return (
    <div onClick={onToggle}
      style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 12px", cursor: "pointer" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <span style={{ background: C.accentSoft, color: C.accent, fontWeight: 700, borderRadius: 6, padding: "1px 6px", fontSize: 11 }}>
          {s.n}
        </span>
        <span style={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {s.docName}
        </span>
        <span style={{ marginLeft: "auto", color: C.inkSoft, fontSize: 11 }}>유사도 {s.score}</span>
      </div>
      {isOpen && (
        <div style={{ marginTop: 7, paddingTop: 7, borderTop: `1px dashed ${C.line}`, fontSize: 12.5, color: C.inkSoft, lineHeight: 1.6 }}>
          {s.snippet}…
        </div>
      )}
    </div>
  );
}

export default function Chat({ chat, docs: docsHook }) {
  const {
    question, setQuestion, asking, askError,
    result, openSrc, setOpenSrc,
    conversation, openConvSrc, setOpenConvSrc,
    copiedKey, copyText, exportConversation, clearConversation, ask,
  } = chat;

  const { selectedDocs, docs } = docsHook;

  return (
    <section style={{ flex: "1 1 440px", minWidth: 300 }}>
      <h2 style={{ fontFamily: serif, fontSize: 18, fontWeight: 700, margin: "0 0 12px", display: "flex", alignItems: "center", gap: 9 }}>
        <span style={{ width: 6, height: 17, background: C.accent, borderRadius: 3 }} />
        질문하기
        {conversation.length > 0 && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={exportConversation}
              style={{ border: `1px solid ${C.line}`, background: "transparent", color: C.inkSoft, fontSize: 12.5, cursor: "pointer", padding: "2px 8px", fontFamily: sans, borderRadius: 6 }}>
              내보내기
            </button>
            <button onClick={clearConversation}
              style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 12.5, cursor: "pointer", padding: "2px 6px", fontFamily: sans }}>
              대화 초기화
            </button>
          </div>
        )}
      </h2>

      {/* 대화 기록 */}
      {conversation.length > 0 && (
        <div style={{ display: "grid", gap: 16, marginBottom: 20 }}>
          {conversation.map((item, idx) => (
            <div key={idx} style={{ display: "grid", gap: 8 }}>
              {/* 질문 버블 */}
              <div style={{
                background: C.paper2, border: `1px solid ${C.line}`,
                borderRadius: "12px 12px 4px 12px", padding: "10px 14px",
                fontSize: 14, color: C.inkSoft, maxWidth: "88%", marginLeft: "auto", lineHeight: 1.5,
              }}>
                {item.q}
              </div>

              {/* 답변 버블 */}
              <div style={{
                position: "relative", background: C.card, border: `1px solid ${C.line}`,
                borderLeft: `4px solid ${C.accentSoft}`, borderRadius: "0 12px 12px 0",
                padding: "14px 44px 14px 16px", fontSize: 15, lineHeight: 1.7, whiteSpace: "pre-wrap",
              }}>
                {item.a}
                <CopyButton text={item.a} id={idx} copiedKey={copiedKey} onCopy={copyText} />
              </div>

              {/* 출처 토글 */}
              {item.sources?.length > 0 && (
                <div style={{ paddingLeft: 4 }}>
                  <button
                    onClick={() => setOpenConvSrc(openConvSrc?.turn === idx ? null : { turn: idx, srcN: null })}
                    style={{ border: "none", background: "transparent", color: C.inkSoft, fontSize: 12.5, cursor: "pointer", padding: 0, fontFamily: sans }}
                  >
                    출처 {item.sources.length}개 {openConvSrc?.turn === idx ? "▲" : "▼"}
                  </button>
                  {openConvSrc?.turn === idx && (
                    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                      {item.sources.map((s) => (
                        <SourceCard key={s.n} s={s}
                          isOpen={openConvSrc?.srcN === s.n}
                          onToggle={() => setOpenConvSrc({ turn: idx, srcN: openConvSrc?.srcN === s.n ? null : s.n })}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 문서 범위 표시 */}
      {selectedDocs.size > 0 && (
        <div style={{ fontSize: 12.5, color: C.accent, marginBottom: 8 }}>
          {selectedDocs.size}개 문서 범위로 검색 중 ·{" "}
          <span style={{ cursor: "pointer", textDecoration: "underline" }}
            onClick={() => docsHook.setSelectedDocs?.(new Set())}>
            전체 해제
          </span>
        </div>
      )}

      {/* 입력창 */}
      <textarea
        value={question} onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") ask(selectedDocs); }}
        placeholder="내 자료에 대해 물어보세요. 예) 광합성에서 캘빈 회로는 어디서 일어나?"
        rows={3}
        style={{
          width: "100%", resize: "vertical", fontFamily: sans, fontSize: 15,
          color: C.ink, background: C.card, border: `1px solid ${C.line}`,
          borderRadius: 12, padding: "13px 15px", outline: "none", lineHeight: 1.6,
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <span style={{ fontSize: 12, color: C.inkSoft }}>Ctrl+Enter 로도 질문</span>
        <button
          onClick={() => ask(selectedDocs)}
          disabled={asking || !question.trim() || docs.length === 0}
          style={{
            border: "none",
            background: asking || !question.trim() || docs.length === 0 ? C.line : C.ink,
            color: C.paper, padding: "9px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600,
            cursor: asking || !question.trim() || docs.length === 0 ? "default" : "pointer",
          }}
        >
          {asking ? "찾는 중…" : "질문"}
        </button>
      </div>
      {askError && <div style={{ color: C.accent, fontSize: 13.5, marginTop: 12 }}>{askError}</div>}

      {/* 검색 중 스피너 */}
      {asking && !result?.answer && (
        <div className="rise" style={{ textAlign: "center", padding: "38px 0", color: C.inkSoft }}>
          <span className="spin" style={{ width: 30, height: 30, border: `3px solid ${C.accentSoft}`, borderTopColor: C.accent, borderRadius: "50%", display: "inline-block" }} />
          <div style={{ fontSize: 13.5, marginTop: 12 }}>관련 부분을 찾아 답을 만드는 중…</div>
        </div>
      )}

      {/* 스트리밍 결과 */}
      {result && (
        <div className="rise" style={{ marginTop: 18 }}>
          <div style={{
            position: "relative", background: C.card, border: `1px solid ${C.line}`,
            borderLeft: `4px solid ${C.accent}`, borderRadius: "0 12px 12px 0",
            padding: "16px 44px 16px 18px", fontSize: 15.5, lineHeight: 1.7, whiteSpace: "pre-wrap",
          }}>
            {result.answer}
            <CopyButton text={result.answer || ""} id="current" copiedKey={copiedKey} onCopy={copyText} />
          </div>

          {result.sources?.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 8, fontWeight: 600 }}>출처</div>
              <div style={{ display: "grid", gap: 8 }}>
                {result.sources.map((s) => (
                  <SourceCard key={s.n} s={s}
                    isOpen={openSrc === s.n}
                    onToggle={() => setOpenSrc(openSrc === s.n ? null : s.n)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
