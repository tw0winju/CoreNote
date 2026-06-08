import { useEffect, useRef, useState } from "react";
import { extractMemory, postAsk, readSSE } from "../api";

const SESSIONS_KEY = "corenote_sessions";
const CONV_DRAFT_KEY = "corenote_conv_draft";
const HISTORY_KEY = "corenote_q_history";
const FAVORITES_KEY = "corenote_favorites";

const readSessions = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  } catch {
    return [];
  }
};

export default function useChat(onMemoryExtracted) {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [result, setResult] = useState(null);
  const [openSrc, setOpenSrc] = useState(null);
  const [openConvSrc, setOpenConvSrc] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [sessions, setSessions] = useState(readSessions);
  const [showSessions, setShowSessions] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
    } catch {
      return [];
    }
  });

  // 대화 임시 저장 (세션 새로고침 복원)
  const [conversation, setConversation] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(CONV_DRAFT_KEY) || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    sessionStorage.setItem(CONV_DRAFT_KEY, JSON.stringify(conversation));
  }, [conversation]);

  // 질문 히스토리
  const [questionHistory, setQuestionHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  });
  const [historyIdx, setHistoryIdx] = useState(-1);
  const historyDraftRef = useRef("");

  const navigateHistory = (dir) => {
    if (dir < 0) {
      // 이전 질문으로
      if (historyIdx === -1) historyDraftRef.current = question;
      const next = Math.min(historyIdx + 1, questionHistory.length - 1);
      if (next >= 0) {
        setHistoryIdx(next);
        setQuestion(questionHistory[next]);
      }
    } else {
      // 최근 질문으로
      if (historyIdx === -1) return;
      const next = historyIdx - 1;
      setHistoryIdx(next);
      setQuestion(next === -1 ? historyDraftRef.current : questionHistory[next]);
    }
  };

  const scrollRef = useRef(null);

  const scrollToBottom = () => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  };

  const copyText = (text, key) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(key);
        setTimeout(() => setCopiedKey(null), 2000);
      })
      .catch(() => {});
  };

  const exportConversation = () => {
    const lines = ["# 코어노트 대화 기록", `\n*${new Date().toLocaleDateString("ko-KR")}*\n`];
    for (const item of conversation) {
      lines.push(`---\n\n**Q: ${item.q}**\n\n${item.a}`);
      if (item.sources?.length > 0)
        lines.push(
          "\n출처: " + item.sources.map((s) => `${s.docName} (유사도 ${s.score})`).join(", "),
        );
    }
    const blob = new Blob([lines.join("\n\n")], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `corenote-${Date.now()}.md`;
    a.click();
  };

  const clearConversation = () => {
    setConversation([]);
    setResult(null);
    setAskError("");
    setOpenConvSrc(null);
    sessionStorage.removeItem(CONV_DRAFT_KEY);
  };

  const saveSession = () => {
    if (!conversation.length) return;
    const name =
      savingName.trim() ||
      `세션 ${new Date().toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`;
    const session = {
      id: Date.now().toString(),
      name,
      savedAt: Date.now(),
      conversation: [...conversation],
    };
    const updated = [session, ...sessions];
    setSessions(updated);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
    setSavingName("");
    setShowSaveInput(false);
  };

  const loadSession = (session) => {
    setConversation(session.conversation);
    setResult(null);
    setAskError("");
    setOpenConvSrc(null);
    setShowSessions(false);
    setTimeout(scrollToBottom, 50);
  };

  const deleteSession = (id) => {
    const updated = sessions.filter((s) => s.id !== id);
    setSessions(updated);
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(updated));
  };

  const toggleFavorite = (item) => {
    setFavorites((prev) => {
      const exists = prev.find((f) => f.q === item.q && f.a === item.a);
      const next = exists
        ? prev.filter((f) => !(f.q === item.q && f.a === item.a))
        : [{ ...item, id: Date.now().toString(), savedAt: Date.now() }, ...prev];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const removeFavorite = (id) => {
    setFavorites((prev) => {
      const next = prev.filter((f) => f.id !== id);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };

  const isFavorited = (q, a) => favorites.some((f) => f.q === q && f.a === a);

  const [attachedImage, setAttachedImage] = useState(null); // { base64, name, preview }
  const [fullContext, setFullContext] = useState(false);
  const abortRef = useRef(null);

  const cancelAsk = () => {
    abortRef.current?.abort();
  };

  const _doAsk = async (q, history, selectedDocs, image = null, fc = false) => {
    const controller = new AbortController();
    abortRef.current = controller;

    setAsking(true);
    setAskError("");
    setResult(null);
    setOpenSrc(null);
    setHistoryIdx(-1);

    // 히스토리 저장
    setQuestionHistory((prev) => {
      const next = [q, ...prev.filter((h) => h !== q)].slice(0, 50);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      return next;
    });

    let answer = "",
      sources = [];
    try {
      const r = await postAsk(
        q,
        history,
        selectedDocs,
        image?.base64 ?? null,
        controller.signal,
        fc,
      );
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "질문 처리 실패");
      }
      await readSSE(
        r,
        {
          status: (e) =>
            setResult((p) => ({ ...(p || { sources: [], answer: "" }), status: e.message })),
          token: (e) => {
            answer += e.text;
            setResult((p) => ({ ...(p || { sources: [] }), answer, status: null }));
            scrollToBottom();
          },
          sources: (e) => {
            sources = e.sources;
            setResult((p) => ({ ...(p || { answer: "" }), sources }));
          },
        },
        controller.signal,
      );

      setConversation((prev) => [
        ...prev,
        { q, a: answer, sources, image: image?.preview ?? null },
      ]);
      setResult(null);
      setQuestion("");
      setAttachedImage(null);
      // 기억 자동 추출 (fire-and-forget)
      extractMemory(q, answer)
        .then(({ extracted }) => {
          if (extracted?.length > 0) onMemoryExtracted?.();
        })
        .catch(() => {});
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      setResult(null);
      if (e.name !== "AbortError") {
        setAskError(e.message || "질문 처리 중 오류가 발생했어요.");
      } else if (answer) {
        // 취소 시 지금까지 받은 답변 저장
        setConversation((prev) => [
          ...prev,
          { q, a: answer, sources, image: image?.preview ?? null },
        ]);
        setQuestion("");
        setAttachedImage(null);
      }
    } finally {
      setAsking(false);
      abortRef.current = null;
    }
  };

  const ask = (selectedDocs) => {
    const q = question.trim();
    if (!q || asking) return;
    const history = conversation.flatMap(({ q: cq, a: ca }) => [
      { role: "user", content: cq },
      { role: "assistant", content: ca },
    ]);
    _doAsk(q, history, selectedDocs, attachedImage, fullContext);
  };

  const regenerate = (selectedDocs) => {
    if (!conversation.length || asking) return;
    const lastItem = conversation[conversation.length - 1];
    const prevConv = conversation.slice(0, -1);
    const prevHistory = prevConv.flatMap(({ q: cq, a: ca }) => [
      { role: "user", content: cq },
      { role: "assistant", content: ca },
    ]);
    setConversation(prevConv);
    _doAsk(lastItem.q, prevHistory, selectedDocs);
  };

  return {
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
    favorites,
    toggleFavorite,
    removeFavorite,
    isFavorited,
    attachedImage,
    setAttachedImage,
    cancelAsk,
    fullContext,
    setFullContext,
  };
}
