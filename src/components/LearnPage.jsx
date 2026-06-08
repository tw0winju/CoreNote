import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { C, sans } from "../theme";
import { postQuiz, postSummary, readSSE, fetchDocText } from "../api";

// ── 공용 디렉터리 트리 ────────────────────────────────────────────────────────

function DocItem({ doc, selected, onSelect, indent = false }) {
  return (
    <div
      onClick={() => onSelect(doc.id)}
      title={doc.name}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: `4px 8px 4px ${indent ? 20 : 8}px`,
        borderRadius: 6,
        cursor: "pointer",
        background: selected ? C.accentSoft : "transparent",
        color: selected ? C.accent : C.ink,
        fontSize: 12.5,
        fontWeight: selected ? 600 : 400,
        transition: "background 0.12s",
      }}
    >
      <span style={{ fontSize: 11, flexShrink: 0, opacity: 0.6 }}>📄</span>
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {doc.name}
      </span>
    </div>
  );
}

function DocTree({ docs, folders, selectedId, onSelect }) {
  const [openFolders, setOpenFolders] = useState(() => new Set(folders.map((f) => f.id)));

  const toggle = (id) =>
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const rootDocs = docs.filter((d) => !d.folderId);
  const visibleFolders = folders.filter((f) => docs.some((d) => d.folderId === f.id));

  if (docs.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: C.inkSoft, padding: "8px 4px" }}>
        색인된 문서가 없어요.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {visibleFolders.map((folder) => {
        const folderDocs = docs.filter((d) => d.folderId === folder.id);
        const isOpen = openFolders.has(folder.id);
        return (
          <div key={folder.id}>
            <div
              onClick={() => toggle(folder.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 8px",
                cursor: "pointer",
                borderRadius: 6,
                fontSize: 12.5,
                fontWeight: 500,
                color: C.inkSoft,
                userSelect: "none",
              }}
            >
              <span style={{ fontSize: 9, width: 10, flexShrink: 0 }}>{isOpen ? "▼" : "▶"}</span>
              <span style={{ fontSize: 12, flexShrink: 0 }}>📁</span>
              <span
                style={{
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {folder.name}
              </span>
              <span style={{ fontSize: 11, flexShrink: 0 }}>{folderDocs.length}</span>
            </div>
            {isOpen &&
              folderDocs.map((doc) => (
                <DocItem
                  key={doc.id}
                  doc={doc}
                  selected={selectedId === doc.id}
                  onSelect={onSelect}
                  indent
                />
              ))}
          </div>
        );
      })}
      {rootDocs.map((doc) => (
        <DocItem key={doc.id} doc={doc} selected={selectedId === doc.id} onSelect={onSelect} />
      ))}
    </div>
  );
}

// ── 퀴즈 ─────────────────────────────────────────────────────────────────────

const QUIZ_TYPES = [
  { id: "mc", label: "4지선다" },
  { id: "tf", label: "O / X" },
  { id: "sa", label: "주관식" },
];

const GREEN = "rgba(34,197,94,0.12)";
const GREEN_BORDER = "rgba(34,197,94,0.45)";
const GREEN_TEXT = "#16a34a";
const RED = "rgba(239,68,68,0.08)";
const RED_BORDER = "rgba(239,68,68,0.4)";

function QuestionCard({ idx, q, quizType, answer, setAnswer, submitted, showHint, toggleHint }) {
  const gradeable = quizType !== "sa";
  const isCorrect = gradeable && submitted && answer?.toUpperCase() === q.a?.toUpperCase();
  const isWrong = gradeable && submitted && !!answer && !isCorrect;

  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${submitted && gradeable ? (isCorrect ? GREEN_BORDER : isWrong ? RED_BORDER : C.line) : C.line}`,
        borderRadius: 12,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flexShrink: 0,
      }}
    >
      {/* 번호 + 질문 */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <span
          style={{
            flexShrink: 0,
            width: 24,
            height: 24,
            borderRadius: "50%",
            background:
              submitted && gradeable
                ? isCorrect
                  ? GREEN
                  : isWrong
                    ? RED
                    : C.accentSoft
                : C.accentSoft,
            color:
              submitted && gradeable
                ? isCorrect
                  ? GREEN_TEXT
                  : isWrong
                    ? "var(--c-error)"
                    : C.accent
                : C.accent,
            fontSize: 12,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {idx + 1}
        </span>
        <div style={{ fontSize: 14, lineHeight: 1.6, color: C.ink, fontWeight: 500 }}>{q.q}</div>
      </div>

      {/* 4지선다 선택지 */}
      {quizType === "mc" &&
        q.options?.map((opt, oi) => {
          const letter = ["A", "B", "C", "D"][oi];
          const selected = answer === letter;
          const correct = submitted && q.a?.toUpperCase() === letter;
          const wrong = submitted && selected && !correct;
          return (
            <button
              key={oi}
              onClick={() => !submitted && setAnswer(letter)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                border: `1px solid ${correct ? GREEN_BORDER : wrong ? RED_BORDER : selected ? C.accent : C.line}`,
                background: correct ? GREEN : wrong ? RED : selected ? C.accentSoft : "transparent",
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13.5,
                fontFamily: sans,
                cursor: submitted ? "default" : "pointer",
                textAlign: "left",
                color: correct
                  ? GREEN_TEXT
                  : wrong
                    ? "var(--c-error)"
                    : selected
                      ? C.accent
                      : C.ink,
                fontWeight: selected || correct ? 600 : 400,
                transition: "all .12s",
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  border: `1.5px solid ${correct ? GREEN_TEXT : wrong ? "var(--c-error)" : selected ? C.accent : C.line}`,
                  background: correct
                    ? "rgba(34,197,94,0.2)"
                    : wrong
                      ? "rgba(239,68,68,0.12)"
                      : selected
                        ? C.accent
                        : "transparent",
                  color: correct
                    ? GREEN_TEXT
                    : wrong
                      ? "var(--c-error)"
                      : selected
                        ? "#fff"
                        : C.inkSoft,
                }}
              >
                {letter}
              </span>
              <span style={{ flex: 1 }}>{opt.replace(/^[A-D]\.\s*/, "")}</span>
              {correct && <span style={{ fontSize: 13 }}>✓</span>}
              {wrong && <span style={{ fontSize: 13 }}>✗</span>}
            </button>
          );
        })}

      {/* O/X 선택지 */}
      {quizType === "tf" && (
        <div style={{ display: "flex", gap: 8 }}>
          {["O", "X"].map((v) => {
            const selected = answer === v;
            const correct = submitted && q.a?.toUpperCase() === v;
            const wrong = submitted && selected && !correct;
            return (
              <button
                key={v}
                onClick={() => !submitted && setAnswer(v)}
                style={{
                  flex: 1,
                  border: `1.5px solid ${correct ? GREEN_BORDER : wrong ? RED_BORDER : selected ? C.accent : C.line}`,
                  background: correct
                    ? GREEN
                    : wrong
                      ? RED
                      : selected
                        ? C.accentSoft
                        : "transparent",
                  color: correct
                    ? GREEN_TEXT
                    : wrong
                      ? "var(--c-error)"
                      : selected
                        ? C.accent
                        : C.inkSoft,
                  borderRadius: 10,
                  padding: "10px 0",
                  fontSize: 22,
                  fontFamily: sans,
                  fontWeight: 700,
                  cursor: submitted ? "default" : "pointer",
                  transition: "all .12s",
                }}
              >
                {v}
              </button>
            );
          })}
        </div>
      )}

      {/* 주관식 입력 */}
      {quizType === "sa" && (
        <>
          <textarea
            value={answer || ""}
            onChange={(e) => !submitted && setAnswer(e.target.value)}
            placeholder="답을 입력하세요…"
            rows={2}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${submitted ? C.line : C.line}`,
              fontFamily: sans,
              fontSize: 13,
              background: submitted ? C.paper2 : C.paper,
              color: C.ink,
              resize: "none",
              outline: "none",
              boxSizing: "border-box",
              lineHeight: 1.5,
              cursor: submitted ? "default" : "text",
            }}
          />
          {submitted && (
            <div
              style={{
                background: GREEN,
                border: `1px solid ${GREEN_BORDER}`,
                borderRadius: 8,
                padding: "8px 12px",
                fontSize: 13,
                color: GREEN_TEXT,
                lineHeight: 1.5,
              }}
            >
              <span style={{ fontWeight: 700 }}>정답: </span>
              {q.a}
            </div>
          )}
        </>
      )}

      {/* 힌트 (채점 전) */}
      {q.hint && !submitted && (
        <div>
          <button
            onClick={toggleHint}
            style={{
              border: "none",
              background: "transparent",
              color: C.inkSoft,
              fontSize: 12,
              padding: 0,
              cursor: "pointer",
              fontFamily: sans,
            }}
          >
            {showHint ? "힌트 숨기기 ▲" : "💡 힌트 보기 ▼"}
          </button>
          {showHint && (
            <div
              style={{
                marginTop: 5,
                fontSize: 12.5,
                color: C.inkSoft,
                background: C.paper2,
                borderRadius: 7,
                padding: "7px 10px",
                lineHeight: 1.5,
              }}
            >
              {q.hint}
            </div>
          )}
        </div>
      )}

      {/* 틀렸을 때 정답 표시 (MC/TF) */}
      {submitted && gradeable && isWrong && (
        <div
          style={{
            fontSize: 12.5,
            color: GREEN_TEXT,
            background: GREEN,
            borderRadius: 7,
            padding: "6px 10px",
          }}
        >
          정답: <strong>{q.a}</strong>
          {q.hint && <span style={{ color: C.inkSoft }}> · {q.hint}</span>}
        </div>
      )}
    </div>
  );
}

function QuizPanel({ docs, folders }) {
  const [selectedDocId, setSelectedDocId] = useState("");
  const [selectedTypes, setSelectedTypes] = useState(new Set(["mc"]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [showHints, setShowHints] = useState({});

  const reset = (keepQuestions = false) => {
    setAnswers({});
    setSubmitted(false);
    setShowHints({});
    if (!keepQuestions) setQuestions([]);
  };

  const selectDoc = (id) => {
    setSelectedDocId(id);
    reset();
    setError("");
  };

  const toggleType = (id) => {
    setSelectedTypes((prev) => {
      if (prev.has(id) && prev.size === 1) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    reset();
    setError("");
  };

  const generate = async () => {
    if (!selectedDocId) return;
    setLoading(true);
    setError("");
    reset();
    try {
      const data = await postQuiz(selectedDocId, 10, [...selectedTypes]);
      if (data.error) throw new Error(data.error);
      if (!data.questions?.length) throw new Error("퀴즈를 생성하지 못했어요.");
      setQuestions(data.questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const gradableQs = questions.filter((q) => q.type !== "sa");
  const hasGradable = gradableQs.length > 0;
  const hasSa = questions.some((q) => q.type === "sa");
  const allAnswered =
    questions.length > 0 &&
    questions.every((_, i) => answers[i] !== undefined && answers[i] !== "");
  const correctCount = submitted
    ? questions.filter(
        (q, i) => q.type !== "sa" && answers[i]?.toUpperCase() === q.a?.toUpperCase(),
      ).length
    : 0;

  const submitLabel = !hasGradable ? "정답 보기" : "채점하기";

  return (
    <div style={{ display: "flex", gap: 14, height: "100%", overflow: "hidden" }}>
      {/* 왼쪽 패널: 유형·문서·생성 */}
      <div
        style={{
          width: 176,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
        }}
      >
        {/* 유형 다중 선택 */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.inkSoft,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            유형 (중복 선택 가능)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {QUIZ_TYPES.map(({ id, label }) => {
              const active = selectedTypes.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleType(id)}
                  style={{
                    border: `1px solid ${active ? C.accent : C.line}`,
                    background: active ? C.accentSoft : "transparent",
                    color: active ? C.accent : C.inkSoft,
                    borderRadius: 7,
                    padding: "6px 12px",
                    fontSize: 13,
                    fontFamily: sans,
                    fontWeight: active ? 600 : 400,
                    cursor: "pointer",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    transition: "all .15s",
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      flexShrink: 0,
                      borderRadius: 3,
                      border: `1.5px solid ${active ? C.accent : C.line}`,
                      background: active ? C.accent : "transparent",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 9,
                      color: "#fff",
                    }}
                  >
                    {active ? "✓" : ""}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 문서 선택 */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: C.inkSoft,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 5,
            }}
          >
            문서
          </div>
          <div
            style={{
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              padding: 4,
              background: C.paper,
            }}
          >
            <DocTree
              docs={docs}
              folders={folders}
              selectedId={selectedDocId}
              onSelect={selectDoc}
            />
          </div>
        </div>

        <button
          onClick={generate}
          disabled={!selectedDocId || loading}
          style={{
            border: "none",
            background: selectedDocId && !loading ? C.accent : C.line,
            color: selectedDocId && !loading ? "#fff" : C.inkSoft,
            padding: "8px 0",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: sans,
            fontWeight: 600,
            cursor: selectedDocId && !loading ? "pointer" : "default",
            transition: "all .15s",
          }}
        >
          {loading ? "생성 중…" : "퀴즈 생성"}
        </button>

        {error && (
          <div
            style={{
              fontSize: 12.5,
              color: C.error,
              background: C.errorSoft,
              border: `1px solid ${C.errorLine}`,
              borderRadius: 7,
              padding: "7px 10px",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
      </div>

      {/* 오른쪽: 문제 목록 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* 빈 상태 */}
        {questions.length === 0 && !loading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: C.inkSoft,
              fontSize: 13,
              gap: 6,
            }}
          >
            <div style={{ fontSize: 28 }}>🎯</div>
            문서를 선택하고 퀴즈를 생성해보세요.
          </div>
        )}

        {/* 로딩 */}
        {loading && (
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.inkSoft,
              gap: 8,
            }}
          >
            <span
              className="spin"
              style={{
                width: 16,
                height: 16,
                border: `2px solid ${C.accentSoft}`,
                borderTopColor: C.accent,
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
            퀴즈 생성 중…
          </div>
        )}

        {questions.length > 0 && (
          <>
            {/* 채점 결과 배너 */}
            {submitted && (
              <div
                style={{
                  flexShrink: 0,
                  marginBottom: 12,
                  padding: "10px 16px",
                  background: hasGradable && correctCount === gradableQs.length ? GREEN : C.paper2,
                  border: `1px solid ${hasGradable && correctCount === gradableQs.length ? GREEN_BORDER : C.line}`,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {hasGradable ? (
                  <>
                    <span style={{ fontSize: 20 }}>
                      {correctCount === gradableQs.length
                        ? "🎉"
                        : correctCount >= gradableQs.length / 2
                          ? "👍"
                          : "📚"}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>
                      {correctCount} / {gradableQs.length}
                    </span>
                    <span style={{ fontSize: 13, color: C.inkSoft }}>
                      {correctCount === gradableQs.length
                        ? "완벽해요!"
                        : correctCount >= gradableQs.length / 2
                          ? "잘 하고 있어요!"
                          : "조금 더 복습해봐요!"}
                      {hasSa &&
                        ` · 주관식 ${questions.filter((q) => q.type === "sa").length}문제는 직접 확인`}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 13, color: C.inkSoft }}>
                    정답이 공개됐어요. 직접 비교해 보세요.
                  </span>
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button
                    onClick={() => reset(true)}
                    style={{
                      border: `1px solid ${C.line}`,
                      background: "transparent",
                      color: C.inkSoft,
                      padding: "4px 12px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontFamily: sans,
                      cursor: "pointer",
                    }}
                  >
                    다시 풀기
                  </button>
                  <button
                    onClick={generate}
                    style={{
                      border: "none",
                      background: C.accent,
                      color: "#fff",
                      padding: "4px 12px",
                      borderRadius: 6,
                      fontSize: 12.5,
                      fontFamily: sans,
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    새 퀴즈
                  </button>
                </div>
              </div>
            )}

            {/* 문제 목록 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              {questions.map((q, i) => (
                <QuestionCard
                  key={i}
                  idx={i}
                  q={q}
                  quizType={q.type}
                  answer={answers[i]}
                  setAnswer={(v) => setAnswers((prev) => ({ ...prev, [i]: v }))}
                  submitted={submitted}
                  showHint={!!showHints[i]}
                  toggleHint={() => setShowHints((prev) => ({ ...prev, [i]: !prev[i] }))}
                />
              ))}

              {/* 채점 버튼 */}
              {!submitted && (
                <button
                  onClick={() => setSubmitted(true)}
                  disabled={!allAnswered}
                  style={{
                    flexShrink: 0,
                    border: "none",
                    background: allAnswered ? C.accent : C.line,
                    color: allAnswered ? "#fff" : C.inkSoft,
                    padding: "11px 0",
                    borderRadius: 10,
                    fontSize: 14,
                    fontFamily: sans,
                    fontWeight: 600,
                    cursor: allAnswered ? "pointer" : "default",
                    marginTop: 4,
                    transition: "all .15s",
                  }}
                >
                  {submitLabel}
                </button>
              )}
              <div style={{ height: 8, flexShrink: 0 }} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── 마크다운 렌더러 (테이블 포함) ─────────────────────────────────────────────

function MdContent({ children }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        table: ({ children: c }) => (
          <table
            style={{ borderCollapse: "collapse", width: "100%", margin: "8px 0", fontSize: 13 }}
          >
            {c}
          </table>
        ),
        th: ({ children: c }) => (
          <th
            style={{
              border: `1px solid ${C.line}`,
              padding: "5px 10px",
              background: C.paper2,
              fontWeight: 600,
              textAlign: "left",
            }}
          >
            {c}
          </th>
        ),
        td: ({ children: c }) => (
          <td style={{ border: `1px solid ${C.line}`, padding: "5px 10px" }}>{c}</td>
        ),
      }}
    >
      {children}
    </ReactMarkdown>
  );
}

// ── 요약 ─────────────────────────────────────────────────────────────────────

function SummaryPanel({ docs, folders }) {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [cached, setCached] = useState({});
  const [loading, setLoading] = useState(null);
  const [progress, setProgress] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const [originals, setOriginals] = useState({});
  const [origLoading, setOrigLoading] = useState(false);

  const fetchSummary = async (docId, force = false) => {
    setSelectedDocId(docId);
    if (!force && summaries[docId]) return;
    setLoading(docId);
    setProgress("");
    try {
      const r = await postSummary(docId, force);
      if (!r.ok) throw new Error("요약 요청 실패");
      await readSSE(r, {
        progress: (e) => setProgress(e.message),
        done: (e) => {
          setSummaries((prev) => ({ ...prev, [docId]: e.summary || "요약 실패" }));
          setCached((prev) => ({ ...prev, [docId]: !!e.cached }));
          setProgress("");
        },
      });
    } catch {
      setSummaries((prev) => ({ ...prev, [docId]: "요약 생성 중 오류가 발생했어요." }));
    } finally {
      setLoading(null);
    }
  };

  const loadOriginal = async (docId) => {
    if (originals[docId]) return;
    setOrigLoading(true);
    try {
      const data = await fetchDocText(docId);
      setOriginals((prev) => ({ ...prev, [docId]: data.text || "" }));
    } catch {
      setOriginals((prev) => ({ ...prev, [docId]: "원본 텍스트를 불러오지 못했어요." }));
    } finally {
      setOrigLoading(false);
    }
  };

  const toggleOriginal = () => {
    const next = !showOriginal;
    setShowOriginal(next);
    if (next && selectedDocId) loadOriginal(selectedDocId);
  };

  const handleSelect = (id) => {
    fetchSummary(id);
    if (showOriginal) loadOriginal(id);
  };

  const hasSummary = selectedDocId && loading !== selectedDocId && summaries[selectedDocId];

  return (
    <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* 왼쪽: 문서 트리 */}
      <div
        style={{
          width: 180,
          flexShrink: 0,
          overflowY: "auto",
          borderRight: `1px solid ${C.line}`,
          paddingRight: 10,
        }}
      >
        <DocTree docs={docs} folders={folders} selectedId={selectedDocId} onSelect={handleSelect} />
      </div>

      {/* 오른쪽: 콘텐츠 */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          overflow: "hidden",
        }}
      >
        {/* 툴바 */}
        {hasSummary && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {cached[selectedDocId] && (
              <span
                style={{
                  fontSize: 11,
                  color: C.inkSoft,
                  background: C.paper2,
                  border: `1px solid ${C.line}`,
                  borderRadius: 4,
                  padding: "1px 6px",
                }}
              >
                캐시됨
              </span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {/* 원본 보기 토글 */}
              <button
                onClick={toggleOriginal}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  border: `1px solid ${showOriginal ? C.accent : C.line}`,
                  background: showOriginal ? C.accentSoft : "transparent",
                  color: showOriginal ? C.accent : C.inkSoft,
                  fontSize: 12,
                  padding: "3px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: sans,
                  fontWeight: showOriginal ? 600 : 400,
                  transition: "all .15s",
                }}
              >
                <span style={{ fontSize: 13 }}>📄</span>
                원본 {showOriginal ? "숨기기" : "보기"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchSummary(selectedDocId, true);
                }}
                style={{
                  border: `1px solid ${C.line}`,
                  background: "transparent",
                  color: C.inkSoft,
                  fontSize: 12,
                  padding: "3px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontFamily: sans,
                }}
              >
                재생성
              </button>
            </div>
          </div>
        )}

        {/* 빈 상태 */}
        {!selectedDocId && (
          <div style={{ fontSize: 13, color: C.inkSoft, paddingTop: 8 }}>
            왼쪽에서 문서를 선택하면 요약이 표시됩니다.
          </div>
        )}

        {/* 로딩 */}
        {selectedDocId && loading === selectedDocId && (
          <div
            style={{
              color: C.inkSoft,
              display: "flex",
              alignItems: "center",
              gap: 8,
              paddingTop: 8,
            }}
          >
            <span
              className="spin"
              style={{
                width: 16,
                height: 16,
                border: `2px solid ${C.accentSoft}`,
                borderTopColor: C.accent,
                borderRadius: "50%",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {progress || "요약 생성 중…"}
          </div>
        )}

        {/* 분할/단독 뷰 */}
        {hasSummary && (
          <div style={{ flex: 1, minHeight: 0, display: "flex", gap: 10, overflow: "hidden" }}>
            {/* 원본 패널 */}
            {showOriginal && (
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                  background: C.paper,
                  borderRadius: "var(--radius-md)",
                  border: `1px solid ${C.line}`,
                }}
              >
                <div
                  style={{
                    padding: "8px 12px",
                    borderBottom: `1px solid ${C.line}`,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: C.inkSoft,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  원본
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
                  {origLoading && !originals[selectedDocId] ? (
                    <div style={{ color: C.inkSoft, fontSize: 13 }}>불러오는 중…</div>
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 12.5,
                        lineHeight: 1.7,
                        color: C.ink,
                        fontFamily: "'IBM Plex Sans KR', sans-serif",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {originals[selectedDocId] || ""}
                    </pre>
                  )}
                </div>
              </div>
            )}

            {/* 요약 패널 */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                background: C.paper,
                borderRadius: "var(--radius-md)",
                border: `1px solid ${C.line}`,
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: `1px solid ${C.line}`,
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: C.inkSoft,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  flexShrink: 0,
                }}
              >
                요약
              </div>
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "12px 14px",
                  fontSize: 13.5,
                  lineHeight: 1.7,
                }}
              >
                <MdContent>{summaries[selectedDocId]}</MdContent>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── LearnPage ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "summary", label: "📄 요약" },
  { id: "quiz", label: "🎯 퀴즈" },
];

export default function LearnPage({ chat: _chat, docs: docsHook }) {
  const { docs, folders } = docsHook;
  const [activeTab, setActiveTab] = useState("summary");

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: "0 24px 16px",
        gap: 0,
      }}
    >
      {/* 탭 헤더 — pill 스타일 */}
      <div
        style={{
          display: "flex",
          gap: 4,
          flexShrink: 0,
          marginBottom: 16,
          background: C.paper2,
          borderRadius: 10,
          padding: 4,
          alignSelf: "flex-start",
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                border: "none",
                background: active ? C.card : "transparent",
                color: active ? C.ink : C.inkSoft,
                fontFamily: sans,
                fontSize: 13,
                fontWeight: active ? 600 : 400,
                padding: "6px 16px",
                borderRadius: 7,
                cursor: "pointer",
                transition: "all .15s",
                boxShadow: active ? "var(--shadow-xs)" : "none",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        {activeTab === "quiz" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <QuizPanel docs={docs} folders={folders} />
          </div>
        )}
        {activeTab === "summary" && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <SummaryPanel docs={docs} folders={folders} />
          </div>
        )}
      </div>
    </div>
  );
}
