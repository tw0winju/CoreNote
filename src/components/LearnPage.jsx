import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { C, sans, serif } from "../theme";
import { postQuiz, postSummary } from "../api";

function StatCard({ icon, value, label }) {
  return (
    <div
      style={{
        background: C.card,
        border: `1px solid ${C.line}`,
        borderRadius: 14,
        padding: "16px 20px",
        textAlign: "center",
        flex: 1,
      }}
    >
      <div style={{ fontSize: 22, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 26, fontWeight: 700, fontFamily: serif, color: C.ink }}>{value}</div>
      <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function FavoritesPanel({ favorites, onRemove }) {
  const [expandedId, setExpandedId] = useState(null);

  if (favorites.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: C.inkSoft,
          fontSize: 13,
          gap: 8,
          padding: 24,
        }}
      >
        <div style={{ fontSize: 28 }}>☆</div>
        <div style={{ textAlign: "center", lineHeight: 1.7 }}>
          아직 저장된 항목이 없어요.
          <br />
          대화에서 ☆ 버튼으로 저장해보세요.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto" }}>
      {favorites.map((f) => {
        const isOpen = expandedId === f.id;
        return (
          <div
            key={f.id}
            style={{
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              overflow: "hidden",
            }}
          >
            <div
              onClick={() => setExpandedId(isOpen ? null : f.id)}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <div
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: 500,
                  color: C.ink,
                  lineHeight: 1.5,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: isOpen ? "unset" : 2,
                  WebkitBoxOrient: "vertical",
                  textOverflow: "ellipsis",
                }}
              >
                {f.q}
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: C.inkSoft }}>
                  {new Date(f.savedAt).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" })}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onRemove(f.id); }}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: C.inkSoft,
                    fontSize: 14,
                    cursor: "pointer",
                    padding: "0 2px",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>
            {isOpen && (
              <div
                style={{
                  padding: "0 12px 12px",
                  borderTop: `1px dashed ${C.line}`,
                  paddingTop: 10,
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: C.ink,
                  maxHeight: 240,
                  overflowY: "auto",
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{f.a}</ReactMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuizPanel({ docs }) {
  const [selectedDocId, setSelectedDocId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [done, setDone] = useState(false);

  const generate = async () => {
    if (!selectedDocId) return;
    setLoading(true);
    setError("");
    setQuestions([]);
    setCurrent(0);
    setShowAnswer(false);
    setShowHint(false);
    setScore({ correct: 0, total: 0 });
    setDone(false);
    try {
      const data = await postQuiz(selectedDocId, 5);
      if (data.error) throw new Error(data.error);
      if (!data.questions?.length) throw new Error("퀴즈를 생성하지 못했어요.");
      setQuestions(data.questions);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const answer = (correct) => {
    const newScore = { correct: score.correct + (correct ? 1 : 0), total: score.total + 1 };
    setScore(newScore);
    if (current + 1 >= questions.length) {
      setDone(true);
    } else {
      setCurrent((c) => c + 1);
      setShowAnswer(false);
      setShowHint(false);
    }
  };

  const q = questions[current];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <select
          value={selectedDocId}
          onChange={(e) => setSelectedDocId(e.target.value)}
          style={{
            flex: 1,
            padding: "7px 10px",
            borderRadius: 8,
            border: `1px solid ${C.line}`,
            fontFamily: sans,
            fontSize: 13,
            background: C.card,
            color: C.ink,
          }}
        >
          <option value="">문서 선택...</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={!selectedDocId || loading}
          style={{
            border: "none",
            background: selectedDocId && !loading ? C.ink : C.line,
            color: selectedDocId && !loading ? C.paper : C.inkSoft,
            padding: "7px 16px",
            borderRadius: 8,
            fontSize: 13,
            fontFamily: sans,
            cursor: selectedDocId && !loading ? "pointer" : "default",
            flexShrink: 0,
          }}
        >
          {loading ? "생성 중…" : "퀴즈 생성"}
        </button>
      </div>

      {error && (
        <div style={{ fontSize: 13, color: "#e74c3c", padding: "8px 12px", background: "#fdf2f2", borderRadius: 8 }}>
          {error}
        </div>
      )}

      {questions.length > 0 && !done && q && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: C.inkSoft }}>
              {current + 1} / {questions.length}
            </span>
            <span style={{ fontSize: 12, color: C.inkSoft }}>
              맞춤: {score.correct} / {score.total}
            </span>
          </div>
          <div
            style={{
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 10,
              padding: "14px 16px",
              fontSize: 14,
              lineHeight: 1.6,
              fontWeight: 500,
            }}
          >
            {q.q}
          </div>

          {!showAnswer && (
            <div style={{ display: "flex", gap: 8 }}>
              {q.hint && (
                <button
                  onClick={() => setShowHint((v) => !v)}
                  style={{
                    border: `1px solid ${C.line}`,
                    background: "transparent",
                    color: C.inkSoft,
                    padding: "6px 12px",
                    borderRadius: 7,
                    fontSize: 12,
                    fontFamily: sans,
                    cursor: "pointer",
                  }}
                >
                  {showHint ? "힌트 숨기기" : "💡 힌트"}
                </button>
              )}
              <button
                onClick={() => setShowAnswer(true)}
                style={{
                  flex: 1,
                  border: "none",
                  background: C.ink,
                  color: C.paper,
                  padding: "6px 0",
                  borderRadius: 7,
                  fontSize: 13,
                  fontFamily: sans,
                  cursor: "pointer",
                }}
              >
                정답 보기
              </button>
            </div>
          )}

          {showHint && !showAnswer && (
            <div
              style={{
                fontSize: 12.5,
                color: C.inkSoft,
                background: C.paper2,
                borderRadius: 7,
                padding: "8px 12px",
                lineHeight: 1.5,
              }}
            >
              💡 {q.hint}
            </div>
          )}

          {showAnswer && (
            <>
              <div
                style={{
                  background: C.accentSoft,
                  border: `1px solid ${C.accent}`,
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: C.ink,
                }}
              >
                <span style={{ fontWeight: 600, color: C.accent, marginRight: 6 }}>정답:</span>
                {q.a}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => answer(false)}
                  style={{
                    flex: 1,
                    border: `1px solid ${C.line}`,
                    background: "transparent",
                    color: C.inkSoft,
                    padding: "7px 0",
                    borderRadius: 7,
                    fontSize: 13,
                    fontFamily: sans,
                    cursor: "pointer",
                  }}
                >
                  ✗ 틀렸어요
                </button>
                <button
                  onClick={() => answer(true)}
                  style={{
                    flex: 1,
                    border: "none",
                    background: C.ink,
                    color: C.paper,
                    padding: "7px 0",
                    borderRadius: 7,
                    fontSize: 13,
                    fontFamily: sans,
                    cursor: "pointer",
                  }}
                >
                  ✓ 맞췄어요
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {done && (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>
            {score.correct === questions.length ? "🎉" : score.correct >= questions.length / 2 ? "👍" : "📚"}
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, fontFamily: serif, marginBottom: 4 }}>
            {score.correct} / {questions.length}
          </div>
          <div style={{ fontSize: 13, color: C.inkSoft, marginBottom: 16 }}>
            {score.correct === questions.length
              ? "완벽해요!"
              : score.correct >= questions.length / 2
              ? "잘 하고 있어요!"
              : "조금 더 복습해봐요!"}
          </div>
          <button
            onClick={generate}
            style={{
              border: "none",
              background: C.ink,
              color: C.paper,
              padding: "8px 20px",
              borderRadius: 8,
              fontSize: 13,
              fontFamily: sans,
              cursor: "pointer",
            }}
          >
            다시 풀기
          </button>
        </div>
      )}

      {questions.length === 0 && !loading && !error && (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: C.inkSoft,
            fontSize: 13,
            padding: "24px 0",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 28 }}>🎯</div>
          문서를 선택하고 퀴즈를 생성해보세요.
        </div>
      )}
    </div>
  );
}

function SummaryPanel({ docs }) {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(null);

  const fetchSummary = async (docId) => {
    if (summaries[docId]) {
      setSelectedDocId(docId);
      return;
    }
    setSelectedDocId(docId);
    setLoading(docId);
    try {
      const data = await postSummary(docId);
      setSummaries((prev) => ({ ...prev, [docId]: data.summary || data.error || "요약 실패" }));
    } catch {
      setSummaries((prev) => ({ ...prev, [docId]: "요약 생성 중 오류가 발생했어요." }));
    } finally {
      setLoading(null);
    }
  };

  if (docs.length === 0) {
    return (
      <div style={{ fontSize: 13, color: C.inkSoft, padding: "12px 0" }}>
        색인된 문서가 없어요.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {docs.map((d) => (
          <button
            key={d.id}
            onClick={() => fetchSummary(d.id)}
            style={{
              border: `1px solid ${selectedDocId === d.id ? C.accent : C.line}`,
              background: selectedDocId === d.id ? C.accentSoft : "transparent",
              color: selectedDocId === d.id ? C.accent : C.inkSoft,
              padding: "5px 12px",
              borderRadius: 20,
              fontSize: 12.5,
              fontFamily: sans,
              cursor: "pointer",
              fontWeight: selectedDocId === d.id ? 600 : 400,
            }}
          >
            {d.name}
          </button>
        ))}
      </div>

      {selectedDocId && (
        <div
          style={{
            background: C.card,
            border: `1px solid ${C.line}`,
            borderRadius: 12,
            padding: "14px 16px",
            fontSize: 13.5,
            lineHeight: 1.7,
          }}
        >
          {loading === selectedDocId ? (
            <div style={{ color: C.inkSoft, display: "flex", alignItems: "center", gap: 8 }}>
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
              요약 생성 중…
            </div>
          ) : (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaries[selectedDocId] || ""}</ReactMarkdown>
          )}
        </div>
      )}
    </div>
  );
}

export default function LearnPage({ chat, docs: docsHook, memory }) {
  const { favorites, removeFavorite, sessions, conversation } = chat;
  const { docs } = docsHook;
  const { memories } = memory;

  const totalQuestions =
    conversation.length + sessions.reduce((s, sess) => s + (sess.conversation?.length || 0), 0);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        padding: "0 24px 16px",
        gap: 16,
      }}
    >
      {/* 통계 카드 */}
      <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
        <StatCard icon="💬" value={totalQuestions} label="총 질문 수" />
        <StatCard icon="★" value={favorites.length} label="즐겨찾기" />
        <StatCard icon="🧠" value={memories.length} label="기억" />
        <StatCard icon="📄" value={docs.length} label="색인 문서" />
      </div>

      {/* 메인 2열 */}
      <div style={{ flex: 1, display: "flex", gap: 16, overflow: "hidden", minHeight: 0 }}>
        {/* 즐겨찾기 */}
        <div
          style={{
            flex: "0 0 340px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontFamily: serif,
              fontSize: 15,
              fontWeight: 700,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>★</span> 즐겨찾기 복습
            {favorites.length > 0 && (
              <span style={{ fontSize: 12, color: C.inkSoft, fontWeight: 400, fontFamily: sans }}>
                {favorites.length}개
              </span>
            )}
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <FavoritesPanel favorites={favorites} onRemove={removeFavorite} />
          </div>
        </div>

        {/* 퀴즈 */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            overflow: "hidden",
          }}
        >
          <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, flexShrink: 0 }}>
            🎯 퀴즈
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            <QuizPanel docs={docs} />
          </div>
        </div>
      </div>

      {/* 문서 요약 */}
      <div
        style={{
          flexShrink: 0,
          background: C.card,
          border: `1px solid ${C.line}`,
          borderRadius: 14,
          padding: "14px 18px",
        }}
      >
        <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 700, marginBottom: 10 }}>
          📄 문서 요약
        </div>
        <SummaryPanel docs={docs} />
      </div>
    </div>
  );
}
