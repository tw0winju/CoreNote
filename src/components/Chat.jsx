import { useEffect } from "react";
import { C, sans, serif } from "../theme";

function CopyButton({ text, id, copiedKey, onCopy }) {
  return (
    <button
      onClick={() => onCopy(text, id)}
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        border: `1px solid ${C.line}`,
        background: C.paper,
        color: C.inkSoft,
        fontSize: 11,
        padding: "2px 7px",
        borderRadius: 5,
        cursor: "pointer",
        fontFamily: sans,
        opacity: 0.8,
      }}
    >
      {copiedKey === id ? "✓" : "복사"}
    </button>
  );
}

function SourceCard({ s, isOpen, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: "8px 12px",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <span
          style={{
            background: C.accentSoft,
            color: C.accent,
            fontWeight: 700,
            borderRadius: 6,
            padding: "1px 6px",
            fontSize: 11,
          }}
        >
          {s.n}
        </span>
        <span
          style={{
            fontWeight: 500,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {s.docName}
        </span>
        <span style={{ marginLeft: "auto", color: C.inkSoft, fontSize: 11, flexShrink: 0 }}>
          유사도 {s.score}
        </span>
      </div>
      {isOpen && (
        <div
          style={{
            marginTop: 7,
            paddingTop: 7,
            borderTop: `1px dashed ${C.line}`,
            fontSize: 12.5,
            color: C.inkSoft,
            lineHeight: 1.6,
          }}
        >
          {s.snippet}…
        </div>
      )}
    </div>
  );
}

function SessionsPanel({ sessions, onLoad, onDelete }) {
  if (sessions.length === 0)
    return (
      <div style={{ padding: "12px 0 8px", fontSize: 13, color: C.inkSoft }}>
        저장된 세션이 없어요.
      </div>
    );

  return (
    <div
      style={{
        maxHeight: 220,
        overflowY: "auto",
        display: "grid",
        gap: 6,
        padding: "8px 0",
      }}
    >
      {sessions.map((s) => (
        <div
          key={s.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: 9,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.name}
            </div>
            <div style={{ fontSize: 11, color: C.inkSoft }}>
              {new Date(s.savedAt).toLocaleString("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}{" "}
              · {s.conversation.length}턴
            </div>
          </div>
          <button
            onClick={() => onLoad(s)}
            style={{
              border: `1px solid ${C.line}`,
              background: "transparent",
              padding: "3px 10px",
              borderRadius: 6,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: sans,
              flexShrink: 0,
            }}
          >
            불러오기
          </button>
          <button
            onClick={() => onDelete(s.id)}
            style={{
              border: "none",
              background: "transparent",
              color: C.inkSoft,
              fontSize: 16,
              lineHeight: 1,
              cursor: "pointer",
              padding: "0 2px",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export default function Chat({ chat, docs: docsHook }) {
  const {
    question,
    setQuestion,
    asking,
    askError,
    result,
    openSrc,
    setOpenSrc,
    conversation,
    openConvSrc,
    setOpenConvSrc,
    copiedKey,
    copyText,
    exportConversation,
    clearConversation,
    ask,
    scrollRef,
    sessions,
    showSessions,
    setShowSessions,
    savingName,
    setSavingName,
    showSaveInput,
    setShowSaveInput,
    saveSession,
    loadSession,
    deleteSession,
  } = chat;

  const { selectedDocs, docs, setSelectedDocs } = docsHook;

  // 새 메시지가 오면 스크롤 최하단으로
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation.length, result?.answer, scrollRef]);

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* ── 헤더 ── */}
      <div style={{ flexShrink: 0 }}>
        <h2
          style={{
            fontFamily: serif,
            fontSize: 18,
            fontWeight: 700,
            margin: "0 0 10px",
            display: "flex",
            alignItems: "center",
            gap: 9,
            flexWrap: "wrap",
          }}
        >
          <span style={{ width: 6, height: 17, background: C.accent, borderRadius: 3 }} />
          질문하기
          <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
            {/* 세션 저장 */}
            {conversation.length > 0 && (
              <>
                {showSaveInput ? (
                  <div style={{ display: "flex", gap: 5 }}>
                    <input
                      autoFocus
                      value={savingName}
                      onChange={(e) => setSavingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveSession();
                        if (e.key === "Escape") {
                          setShowSaveInput(false);
                          setSavingName("");
                        }
                      }}
                      placeholder="세션 이름"
                      style={{
                        padding: "2px 8px",
                        borderRadius: 6,
                        border: `1px solid ${C.accent}`,
                        fontFamily: sans,
                        fontSize: 12.5,
                        background: C.card,
                        outline: "none",
                        width: 120,
                      }}
                    />
                    <button
                      onClick={saveSession}
                      style={{
                        border: "none",
                        background: C.ink,
                        color: C.paper,
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 12.5,
                        cursor: "pointer",
                        fontFamily: sans,
                      }}
                    >
                      저장
                    </button>
                    <button
                      onClick={() => {
                        setShowSaveInput(false);
                        setSavingName("");
                      }}
                      style={{
                        border: `1px solid ${C.line}`,
                        background: "transparent",
                        padding: "2px 7px",
                        borderRadius: 6,
                        fontSize: 12.5,
                        cursor: "pointer",
                        fontFamily: sans,
                      }}
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowSaveInput(true)}
                    style={{
                      border: `1px solid ${C.line}`,
                      background: "transparent",
                      color: C.inkSoft,
                      fontSize: 12.5,
                      cursor: "pointer",
                      padding: "2px 8px",
                      fontFamily: sans,
                      borderRadius: 6,
                    }}
                  >
                    💾 세션 저장
                  </button>
                )}
              </>
            )}

            {/* 세션 목록 */}
            <button
              onClick={() => setShowSessions((v) => !v)}
              style={{
                border: `1px solid ${showSessions ? C.accent : C.line}`,
                background: showSessions ? C.accentSoft : "transparent",
                color: showSessions ? C.accent : C.inkSoft,
                fontSize: 12.5,
                cursor: "pointer",
                padding: "2px 8px",
                fontFamily: sans,
                borderRadius: 6,
              }}
            >
              📋 세션 {sessions.length > 0 ? `(${sessions.length})` : ""}
            </button>

            {conversation.length > 0 && (
              <>
                <button
                  onClick={exportConversation}
                  style={{
                    border: `1px solid ${C.line}`,
                    background: "transparent",
                    color: C.inkSoft,
                    fontSize: 12.5,
                    cursor: "pointer",
                    padding: "2px 8px",
                    fontFamily: sans,
                    borderRadius: 6,
                  }}
                >
                  내보내기
                </button>
                <button
                  onClick={clearConversation}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: C.inkSoft,
                    fontSize: 12.5,
                    cursor: "pointer",
                    padding: "2px 6px",
                    fontFamily: sans,
                  }}
                >
                  초기화
                </button>
              </>
            )}
          </div>
        </h2>

        {/* 세션 목록 패널 */}
        {showSessions && (
          <div
            style={{
              marginBottom: 12,
              padding: "10px 14px",
              background: C.paper2,
              border: `1px solid ${C.line}`,
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>저장된 세션</div>
            <SessionsPanel sessions={sessions} onLoad={loadSession} onDelete={deleteSession} />
          </div>
        )}
      </div>

      {/* ── 대화 스크롤 영역 ── */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: 4,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* 대화가 없을 때 안내 */}
        {conversation.length === 0 && !asking && !result && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 14, lineHeight: 2 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
              자료를 추가하고 질문해 보세요.
              <br />
              관련 부분을 찾아 출처와 함께 답합니다.
            </div>
          </div>
        )}

        {/* 대화 기록 */}
        {conversation.map((item, idx) => (
          <div key={idx} style={{ display: "grid", gap: 8 }}>
            {/* 질문 버블 */}
            <div
              style={{
                background: C.paper2,
                border: `1px solid ${C.line}`,
                borderRadius: "12px 12px 4px 12px",
                padding: "10px 14px",
                fontSize: 14,
                color: C.inkSoft,
                maxWidth: "82%",
                marginLeft: "auto",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {item.q}
            </div>

            {/* 답변 버블 */}
            <div
              style={{
                position: "relative",
                background: C.card,
                border: `1px solid ${C.line}`,
                borderLeft: `4px solid ${C.accentSoft}`,
                borderRadius: "0 12px 12px 0",
                padding: "14px 50px 14px 18px",
                fontSize: 14.5,
                lineHeight: 1.75,
                whiteSpace: "pre-wrap",
              }}
            >
              {item.a}
              <CopyButton text={item.a} id={idx} copiedKey={copiedKey} onCopy={copyText} />
            </div>

            {/* 출처 토글 */}
            {item.sources?.length > 0 && (
              <div style={{ paddingLeft: 4 }}>
                <button
                  onClick={() =>
                    setOpenConvSrc(openConvSrc?.turn === idx ? null : { turn: idx, srcN: null })
                  }
                  style={{
                    border: "none",
                    background: "transparent",
                    color: C.inkSoft,
                    fontSize: 12.5,
                    cursor: "pointer",
                    padding: 0,
                    fontFamily: sans,
                  }}
                >
                  출처 {item.sources.length}개 {openConvSrc?.turn === idx ? "▲" : "▼"}
                </button>
                {openConvSrc?.turn === idx && (
                  <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                    {item.sources.map((s) => (
                      <SourceCard
                        key={s.n}
                        s={s}
                        isOpen={openConvSrc?.srcN === s.n}
                        onToggle={() =>
                          setOpenConvSrc({
                            turn: idx,
                            srcN: openConvSrc?.srcN === s.n ? null : s.n,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* 로딩 스피너 */}
        {asking && !result?.answer && (
          <div
            className="rise"
            style={{ textAlign: "center", padding: "24px 0", color: C.inkSoft }}
          >
            <span
              className="spin"
              style={{
                width: 28,
                height: 28,
                border: `3px solid ${C.accentSoft}`,
                borderTopColor: C.accent,
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
            <div style={{ fontSize: 13.5, marginTop: 10 }}>관련 부분을 찾아 답을 만드는 중…</div>
          </div>
        )}

        {/* 스트리밍 결과 */}
        {result && (
          <div className="rise" style={{ display: "grid", gap: 8 }}>
            {/* 현재 질문 표시 */}
            <div
              style={{
                background: C.paper2,
                border: `1px solid ${C.line}`,
                borderRadius: "12px 12px 4px 12px",
                padding: "10px 14px",
                fontSize: 14,
                color: C.inkSoft,
                maxWidth: "82%",
                marginLeft: "auto",
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {question}
            </div>

            <div
              style={{
                position: "relative",
                background: C.card,
                border: `1px solid ${C.line}`,
                borderLeft: `4px solid ${C.accent}`,
                borderRadius: "0 12px 12px 0",
                padding: "14px 50px 14px 18px",
                fontSize: 14.5,
                lineHeight: 1.75,
                whiteSpace: "pre-wrap",
              }}
            >
              {result.answer}
              <CopyButton
                text={result.answer || ""}
                id="current"
                copiedKey={copiedKey}
                onCopy={copyText}
              />
            </div>

            {result.sources?.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 12.5,
                    color: C.inkSoft,
                    marginBottom: 6,
                    fontWeight: 600,
                    paddingLeft: 4,
                  }}
                >
                  출처
                </div>
                <div style={{ display: "grid", gap: 7 }}>
                  {result.sources.map((s) => (
                    <SourceCard
                      key={s.n}
                      s={s}
                      isOpen={openSrc === s.n}
                      onToggle={() => setOpenSrc(openSrc === s.n ? null : s.n)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 스크롤 앵커 */}
        <div style={{ flexShrink: 0, height: 1 }} />
      </div>

      {/* ── 입력 영역 (하단 고정) ── */}
      <div style={{ flexShrink: 0, paddingTop: 10 }}>
        {/* 검색 범위 표시 */}
        {selectedDocs.size > 0 && (
          <div style={{ fontSize: 12.5, color: C.accent, marginBottom: 7 }}>
            {selectedDocs.size}개 문서 범위로 검색 중 ·{" "}
            <span
              style={{ cursor: "pointer", textDecoration: "underline" }}
              onClick={() => setSelectedDocs(new Set())}
            >
              전체 해제
            </span>
          </div>
        )}

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") ask(selectedDocs);
          }}
          placeholder="내 자료에 대해 물어보세요. (Ctrl+Enter로 질문)"
          rows={3}
          style={{
            width: "100%",
            resize: "none",
            fontFamily: sans,
            fontSize: 14.5,
            color: C.ink,
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: "12px 14px",
            outline: "none",
            lineHeight: 1.6,
            boxSizing: "border-box",
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            marginTop: 8,
            gap: 10,
          }}
        >
          {askError && <span style={{ fontSize: 13, color: C.accent, flex: 1 }}>{askError}</span>}
          <button
            onClick={() => ask(selectedDocs)}
            disabled={asking || !question.trim() || docs.length === 0}
            style={{
              border: "none",
              background: asking || !question.trim() || docs.length === 0 ? C.line : C.ink,
              color: C.paper,
              padding: "9px 22px",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              cursor: asking || !question.trim() || docs.length === 0 ? "default" : "pointer",
              flexShrink: 0,
            }}
          >
            {asking ? "찾는 중…" : "질문"}
          </button>
        </div>
      </div>
    </section>
  );
}
