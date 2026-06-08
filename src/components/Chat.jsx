import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { C, sans, shadow } from "../theme";

// ── 인용 번호 클릭 ────────────────────────────────────────────────────────────
function processCitations(children, onCitationClick) {
  if (!onCitationClick) return children;
  return (Array.isArray(children) ? children : [children]).map((child, ci) => {
    if (typeof child === "string") {
      const parts = child.split(/(\[\d+\])/);
      if (parts.length === 1) return child;
      return parts.map((part, i) => {
        const m = part.match(/^\[(\d+)\]$/);
        if (m) {
          return (
            <sup
              key={`${ci}-${i}`}
              onClick={(e) => {
                e.stopPropagation();
                onCitationClick(Number(m[1]));
              }}
              title={`출처 ${m[1]} 보기`}
              style={{ color: C.accent, fontWeight: 700, cursor: "pointer", userSelect: "none" }}
            >
              {part}
            </sup>
          );
        }
        return part;
      });
    }
    return child;
  });
}

function highlight(text, query) {
  if (!query || !text) return text;
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 1);
  if (!words.length) return text;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.split(pattern).map((part, i) =>
    i % 2 === 1 ? (
      <mark
        key={i}
        style={{ background: C.accentSoft, color: C.accent, borderRadius: 2, padding: "0 1px" }}
      >
        {part}
      </mark>
    ) : (
      part
    ),
  );
}

const mdComponents = (onCitationClick) => ({
  p: ({ children }) => (
    <p style={{ margin: "0 0 8px", lineHeight: 1.75 }}>
      {processCitations(children, onCitationClick)}
    </p>
  ),
  li: ({ children }) => (
    <li style={{ margin: "2px 0", lineHeight: 1.65 }}>
      {processCitations(children, onCitationClick)}
    </li>
  ),
  ul: ({ children }) => <ul style={{ paddingLeft: 20, margin: "4px 0 8px" }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ paddingLeft: 20, margin: "4px 0 8px" }}>{children}</ol>,
  h1: ({ children }) => (
    <h1 style={{ fontSize: 17, fontWeight: 700, margin: "14px 0 6px" }}>{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: 15, fontWeight: 700, margin: "12px 0 5px" }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: 14, fontWeight: 600, margin: "10px 0 4px" }}>{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote
      style={{
        borderLeft: `3px solid ${C.accentSoft}`,
        paddingLeft: 12,
        margin: "8px 0",
        color: C.inkSoft,
      }}
    >
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code
        style={{
          background: C.paper2,
          padding: "1px 5px",
          borderRadius: 4,
          fontSize: "0.88em",
          fontFamily: "monospace",
        }}
      >
        {children}
      </code>
    ) : (
      <pre
        style={{
          background: C.paper2,
          padding: "12px 14px",
          borderRadius: "var(--radius-sm)",
          overflowX: "auto",
          margin: "8px 0",
        }}
      >
        <code style={{ fontFamily: "monospace", fontSize: 13, lineHeight: 1.5 }}>{children}</code>
      </pre>
    ),
  pre: ({ children }) => <>{children}</>,
  table: ({ children }) => (
    <table style={{ borderCollapse: "collapse", width: "100%", margin: "8px 0", fontSize: 13 }}>
      {children}
    </table>
  ),
  th: ({ children }) => (
    <th
      style={{
        border: `1px solid ${C.line}`,
        padding: "4px 8px",
        background: C.paper2,
        fontWeight: 600,
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{ border: `1px solid ${C.line}`, padding: "4px 8px" }}>{children}</td>
  ),
});

// ── 답변 버블 ────────────────────────────────────────────────────────────────
function AnswerBubble({ text, id, copiedKey, onCopy, streaming, onCitationClick }) {
  const components = mdComponents(onCitationClick);
  return (
    <div
      style={{
        position: "relative",
        background: C.card,
        borderRadius: "4px 16px 16px 16px",
        padding: "14px 48px 14px 16px",
        fontSize: 14.5,
        lineHeight: 1.75,
        boxShadow: streaming ? `0 0 0 2px ${C.accent}40, ${shadow.sm}` : shadow.xs,
        transition: "box-shadow .3s",
      }}
    >
      <ReactMarkdown components={components}>{text}</ReactMarkdown>
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
          opacity: 0.75,
        }}
      >
        {copiedKey === id ? "✓" : "복사"}
      </button>
    </div>
  );
}

// ── 출처 카드 ────────────────────────────────────────────────────────────────
function SourceCard({ s, isOpen, onToggle, query }) {
  return (
    <div
      onClick={onToggle}
      style={{
        background: C.paper,
        border: `1px solid ${C.line}`,
        borderRadius: "var(--radius-sm)",
        padding: "8px 12px",
        cursor: "pointer",
        transition: "background .12s",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <span
          style={{
            background: C.accentSoft,
            color: C.accent,
            fontWeight: 700,
            borderRadius: 5,
            padding: "1px 6px",
            fontSize: 11,
            flexShrink: 0,
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
            flex: 1,
          }}
        >
          {s.docName}
        </span>
        <span style={{ marginLeft: "auto", color: C.inkSoft, fontSize: 11, flexShrink: 0 }}>
          {s.score}
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
          {highlight(s.snippet, query)}…
        </div>
      )}
    </div>
  );
}

// ── 로딩 점 애니메이션 ───────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "16px 4px" }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: C.accent,
            display: "inline-block",
            animation: `pulse-dot 1.4s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ── Chat ─────────────────────────────────────────────────────────────────────
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
    regenerate,
    navigateHistory,
    scrollRef,
    attachedImage,
    setAttachedImage,
    cancelAsk,
    fullContext,
    setFullContext,
  } = chat;

  const { selectedDocs, docs, setSelectedDocs } = docsHook;
  const imgInputRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setAttachedImage({ base64: dataUrl.split(",")[1], name: file.name, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [conversation.length, result?.answer, scrollRef]);

  useEffect(() => {
    if (!showExportMenu) return;
    const close = () => setShowExportMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showExportMenu]);

  return (
    <section
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: C.card,
        borderRadius: "var(--radius-lg)",
        boxShadow: shadow.sm,
      }}
    >
      {/* 라이트박스 */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            src={lightbox}
            alt="확대"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain" }}
          />
        </div>
      )}

      {/* 대화 헤더 */}
      {conversation.length > 0 && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
            padding: "12px 16px 0",
          }}
        >
          <div style={{ position: "relative" }}>
            <GhostBtn onClick={() => setShowExportMenu((v) => !v)}>내보내기 ▾</GhostBtn>
            {showExportMenu && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  background: C.card,
                  border: `1px solid ${C.line}`,
                  borderRadius: 8,
                  boxShadow: shadow.sm,
                  overflow: "hidden",
                  zIndex: 50,
                  minWidth: 130,
                }}
              >
                {[
                  { fmt: "pdf", label: "PDF로 저장" },
                  { fmt: "html", label: "HTML로 저장" },
                  { fmt: "txt", label: "TXT로 저장" },
                ].map(({ fmt, label }) => (
                  <button
                    key={fmt}
                    onClick={() => {
                      exportConversation(fmt);
                      setShowExportMenu(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "9px 14px",
                      background: "none",
                      border: "none",
                      color: C.ink,
                      fontSize: 13,
                      cursor: "pointer",
                      fontFamily: sans,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.accentSoft)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <GhostBtn onClick={clearConversation}>초기화</GhostBtn>
        </div>
      )}

      {/* 대화 스크롤 영역 */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {conversation.length === 0 && !asking && !result && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ textAlign: "center", color: C.inkSoft, fontSize: 14, lineHeight: 2 }}>
              <div style={{ fontSize: 36, marginBottom: 10, opacity: 0.6 }}>💬</div>
              자료를 추가하고 질문해 보세요.
              <br />
              관련 부분을 찾아 <b style={{ color: C.ink }}>출처와 함께</b> 답합니다.
            </div>
          </div>
        )}

        {conversation.map((item, idx) => {
          const isLast = idx === conversation.length - 1;
          const handleCitation = (n) => setOpenConvSrc({ turn: idx, srcN: n });

          return (
            <div key={idx} style={{ display: "grid", gap: 8 }}>
              {/* 사용자 버블 */}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div
                  style={{
                    background: C.userBubble,
                    color: "#fff",
                    borderRadius: "16px 4px 16px 16px",
                    padding: "10px 15px",
                    fontSize: 14,
                    maxWidth: "80%",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    boxShadow: shadow.xs,
                  }}
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt="첨부"
                      onClick={() => setLightbox(item.image)}
                      style={{
                        display: "block",
                        maxWidth: "100%",
                        maxHeight: 160,
                        borderRadius: 8,
                        marginBottom: 7,
                        objectFit: "contain",
                        cursor: "zoom-in",
                        opacity: 0.92,
                      }}
                    />
                  )}
                  {item.q}
                </div>
              </div>

              {/* 답변 버블 */}
              <AnswerBubble
                text={item.a}
                id={idx}
                copiedKey={copiedKey}
                onCopy={copyText}
                streaming={false}
                onCitationClick={handleCitation}
              />

              {/* 액션 버튼 */}
              {isLast && !asking && (
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <GhostBtn onClick={() => regenerate(selectedDocs)}>↺ 재생성</GhostBtn>
                </div>
              )}

              {/* 출처 */}
              {item.sources?.length > 0 && (
                <div>
                  <button
                    onClick={() =>
                      setOpenConvSrc(openConvSrc?.turn === idx ? null : { turn: idx, srcN: null })
                    }
                    style={{
                      border: "none",
                      background: "transparent",
                      color: C.inkSoft,
                      fontSize: 12,
                      cursor: "pointer",
                      padding: "2px 4px",
                      fontFamily: sans,
                    }}
                  >
                    출처 {item.sources.length}개 {openConvSrc?.turn === idx ? "▲" : "▼"}
                  </button>
                  {openConvSrc?.turn === idx && (
                    <div style={{ display: "grid", gap: 5, marginTop: 6 }}>
                      {item.sources.map((s) => (
                        <SourceCard
                          key={s.n}
                          s={s}
                          query={item.q}
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
          );
        })}

        {/* 로딩 */}
        {asking && !result?.answer && (
          <div className="rise">
            <div
              style={{
                background: C.card,
                borderRadius: "4px 16px 16px 16px",
                padding: "10px 16px",
                boxShadow: shadow.xs,
                display: "inline-block",
              }}
            >
              <ThinkingDots />
              {result?.status && (
                <div style={{ fontSize: 12.5, color: C.inkSoft, marginTop: 2 }}>
                  {result.status}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 스트리밍 결과 */}
        {result && (
          <div className="rise" style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div
                style={{
                  background: C.userBubble,
                  color: "#fff",
                  borderRadius: "16px 4px 16px 16px",
                  padding: "10px 15px",
                  fontSize: 14,
                  maxWidth: "80%",
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                  boxShadow: shadow.xs,
                }}
              >
                {question}
              </div>
            </div>
            <AnswerBubble
              text={result.answer || ""}
              id="current"
              copiedKey={copiedKey}
              onCopy={copyText}
              streaming={true}
              onCitationClick={(n) => setOpenSrc(n)}
            />
            {result.sources?.length > 0 && (
              <div>
                <div
                  style={{
                    fontSize: 12,
                    color: C.inkSoft,
                    marginBottom: 5,
                    fontWeight: 600,
                    paddingLeft: 2,
                  }}
                >
                  출처
                </div>
                <div style={{ display: "grid", gap: 5 }}>
                  {result.sources.map((s) => (
                    <SourceCard
                      key={s.n}
                      s={s}
                      query={question}
                      isOpen={openSrc === s.n}
                      onToggle={() => setOpenSrc(openSrc === s.n ? null : s.n)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ flexShrink: 0, height: 1 }} />
      </div>

      {/* ── 입력 영역 ── */}
      <div style={{ flexShrink: 0, padding: "12px 16px 16px" }}>
        {/* 범위 표시 */}
        {selectedDocs.size > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
              flexWrap: "wrap",
              fontSize: 12.5,
            }}
          >
            <span
              style={{
                background: C.accentSoft,
                color: C.accent,
                borderRadius: 99,
                padding: "3px 10px",
                fontWeight: 500,
              }}
            >
              {selectedDocs.size}개 문서 범위
            </span>
            <span
              style={{ color: C.inkSoft, cursor: "pointer", fontSize: 12 }}
              onClick={() => setSelectedDocs(new Set())}
            >
              전체 해제
            </span>
            <button
              onClick={() => setFullContext((v) => !v)}
              style={{
                border: `1px solid ${fullContext ? C.accent : C.line}`,
                background: fullContext ? C.accentSoft : "transparent",
                color: fullContext ? C.accent : C.inkSoft,
                fontSize: 12,
                padding: "3px 10px",
                borderRadius: 99,
                cursor: "pointer",
                fontFamily: sans,
                fontWeight: fullContext ? 600 : 400,
                transition: "all .15s",
              }}
            >
              전체 내용
            </button>
          </div>
        )}

        {/* 이미지 미리보기 */}
        {attachedImage && (
          <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
            <img
              src={attachedImage.preview}
              alt="첨부"
              style={{
                maxHeight: 90,
                maxWidth: 160,
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${C.line}`,
                objectFit: "contain",
                display: "block",
              }}
            />
            <button
              onClick={() => setAttachedImage(null)}
              style={{
                position: "absolute",
                top: -6,
                right: -6,
                width: 18,
                height: 18,
                borderRadius: "50%",
                border: "none",
                background: C.inkSoft,
                color: C.paper,
                fontSize: 11,
                lineHeight: 1,
                cursor: "pointer",
                padding: 0,
              }}
            >
              ×
            </button>
          </div>
        )}

        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            handleImageFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />

        {/* 텍스트 입력 박스 */}
        <div
          style={{
            border: `1.5px solid ${C.line}`,
            borderRadius: "var(--radius-md)",
            background: C.paper,
            transition: "border-color .15s, box-shadow .15s",
            overflow: "hidden",
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = C.accent;
            e.currentTarget.style.boxShadow = `0 0 0 3px ${C.accentSoft}`;
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = "";
            e.currentTarget.style.boxShadow = "";
          }}
        >
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onPaste={(e) => {
              const img = Array.from(e.clipboardData?.items || []).find((it) =>
                it.type.startsWith("image/"),
              );
              if (img) {
                e.preventDefault();
                handleImageFile(img.getAsFile());
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault();
                ask(selectedDocs);
                return;
              }
              if (e.key === "ArrowUp" && e.target.selectionStart === 0 && !e.shiftKey) {
                e.preventDefault();
                navigateHistory(-1);
              }
              if (
                e.key === "ArrowDown" &&
                e.target.selectionStart === e.target.value.length &&
                !e.shiftKey
              ) {
                e.preventDefault();
                navigateHistory(1);
              }
            }}
            placeholder="내 자료에 대해 물어보세요. (Enter 질문 · Shift+Enter 줄바꿈)"
            rows={3}
            style={{
              width: "100%",
              resize: "none",
              fontFamily: sans,
              fontSize: 14,
              color: C.ink,
              background: "transparent",
              border: "none",
              padding: "12px 14px 8px",
              outline: "none",
              lineHeight: 1.65,
              boxSizing: "border-box",
            }}
          />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: "6px 10px 10px",
              gap: 8,
            }}
          >
            {askError && (
              <span style={{ fontSize: 12.5, color: C.error, flex: 1 }}>{askError}</span>
            )}

            <button
              onClick={() => imgInputRef.current?.click()}
              title="이미지 첨부"
              disabled={asking}
              style={{
                border: `1px solid ${attachedImage ? C.accent : C.line}`,
                background: attachedImage ? C.accentSoft : "transparent",
                color: attachedImage ? C.accent : C.inkSoft,
                borderRadius: "var(--radius-sm)",
                padding: "6px 10px",
                fontSize: 15,
                cursor: asking ? "default" : "pointer",
                lineHeight: 1,
              }}
            >
              🖼
            </button>

            {asking ? (
              <button
                onClick={cancelAsk}
                style={{
                  border: `1.5px solid ${C.accent}`,
                  background: "transparent",
                  color: C.accent,
                  padding: "7px 18px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: sans,
                  transition: "all .15s",
                }}
              >
                ■ 중단
              </button>
            ) : (
              <button
                onClick={() => ask(selectedDocs)}
                disabled={!question.trim() || docs.length === 0}
                style={{
                  border: "none",
                  background: !question.trim() || docs.length === 0 ? C.line : C.accent,
                  color: !question.trim() || docs.length === 0 ? C.inkSoft : "#fff",
                  padding: "7px 20px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: 13.5,
                  fontWeight: 600,
                  cursor: !question.trim() || docs.length === 0 ? "default" : "pointer",
                  fontFamily: sans,
                  transition: "all .15s",
                }}
              >
                질문
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function GhostBtn({ children, onClick, active, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        border: `1px solid ${active ? C.accent : C.line}`,
        background: active ? C.accentSoft : "transparent",
        color: active ? C.accent : C.inkSoft,
        fontSize: 12,
        cursor: "pointer",
        padding: "3px 10px",
        borderRadius: 6,
        fontFamily: sans,
        transition: "all .12s",
      }}
    >
      {children}
    </button>
  );
}
