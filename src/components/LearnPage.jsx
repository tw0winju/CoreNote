import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { C, sans, serif } from "../theme";
import { postQuiz, postSummary, readSSE } from "../api";

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

// ── 즐겨찾기 ─────────────────────────────────────────────────────────────────

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
                  {new Date(f.savedAt).toLocaleDateString("ko-KR", {
                    month: "numeric",
                    day: "numeric",
                  })}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(f.id);
                  }}
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
                <ReactMarkdown>{f.a}</ReactMarkdown>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 퀴즈 ─────────────────────────────────────────────────────────────────────

function QuizPanel({ docs, folders }) {
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
    <div style={{ display: "flex", flexDirection: "column", gap: 10, height: "100%" }}>
      {/* 문서 선택 트리 */}
      <div
        style={{
          border: `1px solid ${C.line}`,
          borderRadius: 8,
          padding: 4,
          maxHeight: 160,
          overflowY: "auto",
          flexShrink: 0,
          background: C.paper,
        }}
      >
        <DocTree
          docs={docs}
          folders={folders}
          selectedId={selectedDocId}
          onSelect={(id) => {
            setSelectedDocId(id);
            setQuestions([]);
            setDone(false);
            setError("");
          }}
        />
      </div>

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

      {error && (
        <div
          style={{
            fontSize: 13,
            color: "#e74c3c",
            padding: "8px 12px",
            background: "#fdf2f2",
            borderRadius: 8,
            flexShrink: 0,
          }}
        >
          {error}
        </div>
      )}

      {questions.length > 0 && !done && q && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto" }}>
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
            {score.correct === questions.length
              ? "🎉"
              : score.correct >= questions.length / 2
                ? "👍"
                : "📚"}
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

// ── 요약 ─────────────────────────────────────────────────────────────────────

function SummaryPanel({ docs, folders }) {
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [summaries, setSummaries] = useState({});
  const [cached, setCached] = useState({});
  const [loading, setLoading] = useState(null);
  const [progress, setProgress] = useState("");

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

  const regenerate = (e) => {
    e.stopPropagation();
    if (selectedDocId) fetchSummary(selectedDocId, true);
  };

  return (
    <div style={{ display: "flex", gap: 12, flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* 왼쪽: 문서 트리 */}
      <div
        style={{
          width: 200,
          flexShrink: 0,
          overflowY: "auto",
          borderRight: `1px solid ${C.line}`,
          paddingRight: 10,
        }}
      >
        <DocTree
          docs={docs}
          folders={folders}
          selectedId={selectedDocId}
          onSelect={(id) => fetchSummary(id)}
        />
      </div>

      {/* 오른쪽: 요약 내용 */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {!selectedDocId && (
          <div style={{ fontSize: 13, color: C.inkSoft, paddingTop: 8 }}>
            왼쪽에서 문서를 선택하면 요약이 표시됩니다.
          </div>
        )}
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
        {selectedDocId && loading !== selectedDocId && summaries[selectedDocId] && (
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
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
              <button
                onClick={regenerate}
                style={{
                  border: `1px solid ${C.line}`,
                  background: "transparent",
                  color: C.inkSoft,
                  fontSize: 11.5,
                  padding: "2px 10px",
                  borderRadius: 5,
                  cursor: "pointer",
                  fontFamily: sans,
                  marginLeft: "auto",
                }}
              >
                재생성
              </button>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.7, flex: 1 }}>
              <ReactMarkdown>{summaries[selectedDocId]}</ReactMarkdown>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── LearnPage ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "summary", label: "📄 요약" },
  { id: "quiz", label: "🎯 퀴즈" },
  { id: "favorites", label: "★ 즐겨찾기" },
];

export default function LearnPage({ chat, docs: docsHook }) {
  const { favorites, removeFavorite } = chat;
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
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              {tab.label}
              {tab.id === "favorites" && favorites.length > 0 && (
                <span
                  style={{
                    fontSize: 10.5,
                    background: active ? C.accentSoft : C.line,
                    color: active ? C.accent : C.inkSoft,
                    borderRadius: 99,
                    padding: "1px 6px",
                    fontWeight: 600,
                  }}
                >
                  {favorites.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        {activeTab === "favorites" && (
          <div style={{ height: "100%", overflowY: "auto" }}>
            <FavoritesPanel favorites={favorites} onRemove={removeFavorite} />
          </div>
        )}
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
