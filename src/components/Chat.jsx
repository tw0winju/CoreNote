import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { C, sans } from "../theme";

// 출처 [N] 인용 번호 클릭 가능하게 변환
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
      <mark key={i} style={{ background: "#fff3cd", borderRadius: 2, padding: "0 1px" }}>
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
    <li style={{ margin: "2px 0", lineHeight: 1.6 }}>
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
          borderRadius: 3,
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
          borderRadius: 8,
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

function AnswerBubble({ text, id, copiedKey, onCopy, streaming, onCitationClick }) {
  const components = mdComponents(onCitationClick);
  return (
    <div
      style={{
        position: "relative",
        background: C.card,
        border: `1px solid ${C.line}`,
        borderLeft: `4px solid ${streaming ? C.accent : C.accentSoft}`,
        borderRadius: "0 12px 12px 0",
        padding: "14px 50px 14px 18px",
        fontSize: 14.5,
        lineHeight: 1.75,
      }}
    >
      <ReactMarkdown components={components}>
        {text}
      </ReactMarkdown>
      <CopyButton text={text} id={id} copiedKey={copiedKey} onCopy={onCopy} />
    </div>
  );
}

function SourceCard({ s, isOpen, onToggle, query }) {
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
          {highlight(s.snippet, query)}…
        </div>
      )}
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
    regenerate,
    navigateHistory,
    scrollRef,
    toggleFavorite,
    isFavorited,
    attachedImage,
    setAttachedImage,
    cancelAsk,
    fullContext,
    setFullContext,
  } = chat;

  const { selectedDocs, docs, setSelectedDocs } = docsHook;
  const imgInputRef = useRef(null);
  const [lightbox, setLightbox] = useState(null);

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const base64 = dataUrl.split(",")[1];
      setAttachedImage({ base64, name: file.name, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  };

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
      {/* 라이트박스 */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img
            src={lightbox}
            alt="확대 이미지"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 10, objectFit: "contain", boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}
          />
        </div>
      )}

      {/* ── 헤더 ── */}
      {conversation.length > 0 && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-end",
            gap: 6,
            marginBottom: 8,
          }}
        >
          <button
            onClick={exportConversation}
            style={{
              border: `1px solid ${C.line}`,
              background: "transparent",
              color: C.inkSoft,
              fontSize: 12.5,
              cursor: "pointer",
              padding: "3px 9px",
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
              padding: "3px 7px",
              fontFamily: sans,
            }}
          >
            초기화
          </button>
        </div>
      )}

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

        {conversation.map((item, idx) => {
          const isLast = idx === conversation.length - 1;
          const handleCitation = (n) => setOpenConvSrc({ turn: idx, srcN: n });

          return (
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
                {item.image && (
                  <img
                    src={item.image}
                    alt="첨부 이미지"
                    onClick={() => setLightbox(item.image)}
                    style={{ display: "block", maxWidth: "100%", maxHeight: 160, borderRadius: 6, marginBottom: 6, objectFit: "contain", cursor: "zoom-in" }}
                  />
                )}
                {item.q}
              </div>

              {/* 답변 */}
              <AnswerBubble
                text={item.a}
                id={idx}
                copiedKey={copiedKey}
                onCopy={copyText}
                streaming={false}
                onCitationClick={handleCitation}
              />

              {/* 재생성 + 즐겨찾기 버튼 */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                <button
                  onClick={() => toggleFavorite(item)}
                  title={isFavorited(item.q, item.a) ? "즐겨찾기 해제" : "즐겨찾기 저장"}
                  style={{
                    border: `1px solid ${isFavorited(item.q, item.a) ? C.accent : C.line}`,
                    background: isFavorited(item.q, item.a) ? C.accentSoft : "transparent",
                    color: isFavorited(item.q, item.a) ? C.accent : C.inkSoft,
                    fontSize: 12,
                    cursor: "pointer",
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontFamily: sans,
                  }}
                >
                  {isFavorited(item.q, item.a) ? "★ 저장됨" : "☆ 저장"}
                </button>
                {isLast && !asking && (
                  <button
                    onClick={() => regenerate(selectedDocs)}
                    style={{
                      border: `1px solid ${C.line}`,
                      background: "transparent",
                      color: C.inkSoft,
                      fontSize: 12,
                      cursor: "pointer",
                      padding: "3px 9px",
                      borderRadius: 6,
                      fontFamily: sans,
                    }}
                  >
                    ↺ 재생성
                  </button>
                )}
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
            <div style={{ fontSize: 13.5, marginTop: 10 }}>
              {result?.status || "관련 부분을 찾아 답을 만드는 중…"}
            </div>
          </div>
        )}

        {/* 스트리밍 결과 */}
        {result && (
          <div className="rise" style={{ display: "grid", gap: 8 }}>
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
      <div style={{ flexShrink: 0, paddingTop: 10 }}>
        {selectedDocs.size > 0 && (
          <div style={{ fontSize: 12.5, color: C.accent, marginBottom: 7, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span>
              {selectedDocs.size}개 문서 범위로 검색 중 ·{" "}
              <span
                style={{ cursor: "pointer", textDecoration: "underline" }}
                onClick={() => setSelectedDocs(new Set())}
              >
                전체 해제
              </span>
            </span>
            <button
              onClick={() => setFullContext((v) => !v)}
              title="선택 문서의 전체 내용을 컨텍스트로 사용"
              style={{
                border: `1px solid ${fullContext ? C.accent : C.line}`,
                background: fullContext ? C.accentSoft : "transparent",
                color: fullContext ? C.accent : C.inkSoft,
                fontSize: 11.5,
                padding: "2px 8px",
                borderRadius: 6,
                cursor: "pointer",
                fontFamily: sans,
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
              alt="첨부 이미지"
              style={{ maxHeight: 100, maxWidth: 180, borderRadius: 8, border: `1px solid ${C.line}`, objectFit: "contain", display: "block" }}
            />
            <button
              onClick={() => setAttachedImage(null)}
              style={{
                position: "absolute", top: -6, right: -6,
                width: 18, height: 18, borderRadius: "50%",
                border: "none", background: C.inkSoft, color: C.paper,
                fontSize: 11, lineHeight: 1, cursor: "pointer", padding: 0,
              }}
            >×</button>
          </div>
        )}

        {/* 숨김 파일 입력 */}
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => { handleImageFile(e.target.files?.[0]); e.target.value = ""; }}
        />

        <textarea
          value={question}
          onChange={(e) => {
            setQuestion(e.target.value);
          }}
          onPaste={(e) => {
            const items = Array.from(e.clipboardData?.items || []);
            const imgItem = items.find((it) => it.type.startsWith("image/"));
            if (imgItem) {
              e.preventDefault();
              handleImageFile(imgItem.getAsFile());
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              ask(selectedDocs);
              return;
            }
            // ↑: 커서가 맨 앞일 때 이전 질문
            if (e.key === "ArrowUp" && e.target.selectionStart === 0 && !e.shiftKey) {
              e.preventDefault();
              navigateHistory(-1);
            }
            // ↓: 커서가 맨 뒤일 때 다음 질문
            if (
              e.key === "ArrowDown" &&
              e.target.selectionStart === e.target.value.length &&
              !e.shiftKey
            ) {
              e.preventDefault();
              navigateHistory(1);
            }
          }}
          placeholder="내 자료에 대해 물어보세요. (Enter로 질문 / Shift+Enter 줄바꿈 / 이미지 붙여넣기 가능)"
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
            onClick={() => imgInputRef.current?.click()}
            title="이미지 첨부 (OCR로 텍스트 추출)"
            disabled={asking}
            style={{
              border: `1px solid ${attachedImage ? C.accent : C.line}`,
              background: attachedImage ? C.accentSoft : "transparent",
              color: attachedImage ? C.accent : C.inkSoft,
              borderRadius: 10,
              padding: "9px 12px",
              fontSize: 15,
              cursor: asking ? "default" : "pointer",
              lineHeight: 1,
            }}
          >🖼</button>
          {asking ? (
            <button
              onClick={cancelAsk}
              style={{
                border: `1px solid ${C.accent}`,
                background: "transparent",
                color: C.accent,
                padding: "9px 22px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
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
                background: !question.trim() || docs.length === 0 ? C.line : C.ink,
                color: C.paper,
                padding: "9px 22px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                cursor: !question.trim() || docs.length === 0 ? "default" : "pointer",
                flexShrink: 0,
              }}
            >
              질문
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
