import { useState, useRef } from "react";
import { postAsk, readSSE } from "../api";

const SESSIONS_KEY = "corenote_sessions";

const readSessions = () => {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
  } catch {
    return [];
  }
};

export default function useChat() {
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState("");
  const [result, setResult] = useState(null);
  const [openSrc, setOpenSrc] = useState(null);
  const [conversation, setConversation] = useState([]);
  const [openConvSrc, setOpenConvSrc] = useState(null);
  const [copiedKey, setCopiedKey] = useState(null);
  const [sessions, setSessions] = useState(readSessions);
  const [showSessions, setShowSessions] = useState(false);
  const [savingName, setSavingName] = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);

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

  const ask = async (selectedDocs) => {
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setAskError("");
    setResult(null);
    setOpenSrc(null);

    const history = conversation.flatMap(({ q: cq, a: ca }) => [
      { role: "user", content: cq },
      { role: "assistant", content: ca },
    ]);

    try {
      const r = await postAsk(q, history, selectedDocs);
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "질문 처리 실패");
      }

      let answer = "",
        sources = [];
      await readSSE(r, {
        token: (e) => {
          answer += e.text;
          setResult((p) => ({ ...(p || { sources: [] }), answer }));
          scrollToBottom();
        },
        sources: (e) => {
          sources = e.sources;
          setResult((p) => ({ ...(p || { answer: "" }), sources }));
        },
      });

      setConversation((prev) => [...prev, { q, a: answer, sources }]);
      setResult(null);
      setQuestion("");
      setTimeout(scrollToBottom, 50);
    } catch (e) {
      setResult(null);
      setAskError(e.message || "질문 처리 중 오류가 발생했어요.");
    } finally {
      setAsking(false);
    }
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
  };
}
