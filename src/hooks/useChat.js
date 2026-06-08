import { useEffect, useRef, useState } from "react";
import { extractMemory, postAsk, readSSE } from "../api";

const SESSIONS_KEY = "corenote_sessions";
const CONV_DRAFT_KEY = "corenote_conv_draft";
const HISTORY_KEY = "corenote_q_history";

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

  const exportConversation = (format = "txt") => {
    const date = new Date().toLocaleDateString("ko-KR");
    // eslint-disable-next-line react-hooks/purity
    const ts = Date.now();

    if (format === "txt") {
      const lines = [`코어노트 대화 기록\n${date}\n`];
      for (const item of conversation) {
        lines.push(`${"─".repeat(40)}\n\nQ: ${item.q}\n\nA: ${item.a}`);
        if (item.sources?.length > 0)
          lines.push(
            "\n출처: " + item.sources.map((s) => `${s.docName} (유사도 ${s.score})`).join(", "),
          );
      }
      const blob = new Blob([lines.join("\n\n")], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `corenote-${ts}.txt`;
      a.click();
      return;
    }

    const htmlBody = conversation
      .map(
        (item) => `
      <div class="card">
        <div class="q"><span class="badge">Q</span>${escHtml(item.q)}</div>
        ${item.image ? `<img src="${item.image}" class="thumb" alt="첨부 이미지">` : ""}
        <div class="a"><span class="badge a-badge">A</span><div class="md">${mdToHtml(item.a)}</div></div>
        ${
          item.sources?.length > 0
            ? `<div class="src">출처: ${item.sources.map((s) => `<span class="chip">${escHtml(s.docName)}</span>`).join(" ")}</div>`
            : ""
        }
      </div>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>코어노트 대화 기록</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background: #f5f5f5; color: #1a1a1a; padding: 16px; font-size: 15px; line-height: 1.7; }
  h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .meta { color: #666; font-size: 13px; margin-bottom: 20px; }
  .card { background: #fff; border-radius: 12px; padding: 18px; margin-bottom: 16px;
          box-shadow: 0 1px 4px rgba(0,0,0,.08); }
  .badge { display: inline-block; font-size: 11px; font-weight: 700; border-radius: 4px;
           padding: 1px 6px; margin-right: 8px; vertical-align: middle; flex-shrink: 0; }
  .q { font-weight: 600; display: flex; align-items: flex-start; gap: 6px;
       padding-bottom: 12px; border-bottom: 1px solid #eee; margin-bottom: 12px; }
  .q .badge { background: #e0e7ff; color: #3730a3; margin-top: 3px; }
  .a { display: flex; align-items: flex-start; gap: 6px; }
  .a-badge { background: #d1fae5; color: #065f46; margin-top: 3px; }
  .md { flex: 1; }
  .md h1,.md h2,.md h3 { margin: 12px 0 6px; font-size: 1em; }
  .md p { margin-bottom: 8px; }
  .md ul,.md ol { padding-left: 20px; margin-bottom: 8px; }
  .md li { margin-bottom: 4px; }
  .md code { background: #f3f4f6; border-radius: 3px; padding: 1px 5px; font-size: 13px; }
  .md pre { background: #f3f4f6; border-radius: 6px; padding: 12px; overflow-x: auto;
            font-size: 13px; margin-bottom: 8px; }
  .md pre code { background: none; padding: 0; }
  .md strong { font-weight: 600; }
  .thumb { max-width: 100%; border-radius: 8px; margin: 8px 0; }
  .src { margin-top: 10px; font-size: 12px; color: #888; }
  .chip { display: inline-block; background: #f0f0f0; border-radius: 4px;
          padding: 1px 7px; margin-right: 4px; }
  @media print { body { background: #fff; padding: 0; }
    .card { box-shadow: none; border: 1px solid #ddd; break-inside: avoid; } }
  @media (prefers-color-scheme: dark) {
    body { background: #111; color: #e5e5e5; }
    .card { background: #1e1e1e; box-shadow: none; }
    .q { border-color: #333; }
    .md code,.md pre { background: #2a2a2a; }
    .chip { background: #2a2a2a; }
    .src { color: #777; }
  }
</style>
</head>
<body>
<h1>코어노트 대화 기록</h1>
<p class="meta">${date} · ${conversation.length}개 대화</p>
${htmlBody}
</body>
</html>`;

    if (format === "html") {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `corenote-${ts}.html`;
      a.click();
    } else if (format === "pdf") {
      const win = window.open("", "_blank");
      win.document.write(html);
      win.document.close();
      win.onload = () => win.print();
    }
  };

  function escHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function mdToHtml(md) {
    return md
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/```[\w]*\n?([\s\S]*?)```/g, (_, c) => `<pre><code>${c.trim()}</code></pre>`)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/^### (.+)$/gm, "<h3>$1</h3>")
      .replace(/^## (.+)$/gm, "<h2>$1</h2>")
      .replace(/^# (.+)$/gm, "<h1>$1</h1>")
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>")
      .replace(/\n{2,}/g, "</p><p>")
      .replace(/\n/g, "<br>")
      .replace(/^(?!<[hup])(.+)/, "<p>$1")
      .replace(/([^>])$/, "$1</p>");
  }

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
    attachedImage,
    setAttachedImage,
    cancelAsk,
    fullContext,
    setFullContext,
  };
}
