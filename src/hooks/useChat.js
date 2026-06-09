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
      const el = document.createElement("a");
      el.href = URL.createObjectURL(blob);
      el.download = `corenote-${ts}.txt`;
      el.click();
      return;
    }

    const turns = conversation
      .map(
        (item) => `
  <div class="turn">
    <div class="user-row">
      ${item.image ? `<img src="${item.image}" class="user-img" alt="첨부 이미지">` : ""}
      <div class="user-bubble">${escHtml(item.q).replace(/\n/g, "<br>")}</div>
    </div>
    <div class="asst-bubble">${mdToHtml(item.a)}</div>
    ${
      item.sources?.length > 0
        ? `<div class="sources"><span class="src-label">출처</span>${item.sources.map((s) => `<span class="src-chip">${escHtml(s.docName)}</span>`).join("")}</div>`
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
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #f5f6fb; --card: #ffffff; --ink: #16182e; --ink-soft: #6b7090;
    --accent: #5b52d6; --accent-soft: #ede9ff; --line: rgba(16,18,46,.09);
    --code-bg: #ebecf5; --code-bg2: #282c34; --src-bg: #f0f0f8; --src-color: #6b7090;
    --shadow: 0 2px 8px rgba(16,18,46,.08);
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0d0e16; --card: #191b28; --ink: #dfe1f0; --ink-soft: #7a7f9e;
      --accent: #7b73f5; --accent-soft: #221d48; --line: rgba(255,255,255,.07);
      --code-bg: #12141e; --code-bg2: #0d0e16; --src-bg: #12141e; --src-color: #7a7f9e;
      --shadow: 0 2px 8px rgba(0,0,0,.35);
    }
  }

  body {
    font-family: "IBM Plex Sans KR", -apple-system, sans-serif;
    background: var(--bg); color: var(--ink);
    font-size: 15px; line-height: 1.7;
    padding: 0; margin: 0;
  }

  .page-header {
    position: sticky; top: 0; z-index: 10;
    background: var(--card); border-bottom: 1px solid var(--line);
    padding: 14px 20px; display: flex; align-items: baseline; gap: 10px;
    box-shadow: var(--shadow);
  }
  .page-header h1 { font-size: 16px; font-weight: 600; }
  .page-header .meta { font-size: 12px; color: var(--ink-soft); }

  .chat-wrap { max-width: 780px; margin: 0 auto; padding: 20px 16px 40px; display: flex; flex-direction: column; gap: 24px; }

  .turn { display: flex; flex-direction: column; gap: 8px; }

  /* 사용자 버블 */
  .user-row { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
  .user-img { max-width: min(260px, 70%); border-radius: 10px; object-fit: contain; }
  .user-bubble {
    background: var(--accent); color: #fff;
    border-radius: 16px 4px 16px 16px;
    padding: 10px 15px; font-size: 14px; line-height: 1.6;
    max-width: 80%; word-break: break-word;
    box-shadow: 0 1px 3px rgba(0,0,0,.15);
  }

  /* 어시스턴트 버블 */
  .asst-bubble {
    background: var(--card);
    border-radius: 4px 16px 16px 16px;
    padding: 14px 16px; font-size: 14.5px; line-height: 1.75;
    box-shadow: var(--shadow); word-break: break-word;
  }
  .asst-bubble p { margin: 0 0 8px; }
  .asst-bubble p:last-child { margin-bottom: 0; }
  .asst-bubble h1 { font-size: 17px; font-weight: 700; margin: 14px 0 6px; }
  .asst-bubble h2 { font-size: 15px; font-weight: 700; margin: 12px 0 5px; }
  .asst-bubble h3 { font-size: 14px; font-weight: 600; margin: 10px 0 4px; }
  .asst-bubble ul, .asst-bubble ol { padding-left: 20px; margin: 4px 0 8px; }
  .asst-bubble li { margin-bottom: 3px; line-height: 1.65; }
  .asst-bubble strong { font-weight: 600; }
  .asst-bubble em { font-style: italic; }
  .asst-bubble blockquote {
    border-left: 3px solid var(--accent-soft); padding-left: 12px;
    margin: 8px 0; color: var(--ink-soft);
  }
  .asst-bubble code {
    background: var(--code-bg); border-radius: 4px;
    padding: 1px 5px; font-size: 13px; font-family: monospace;
  }
  .code-wrap {
    border: 1px solid var(--line); border-radius: 8px;
    overflow: hidden; margin: 8px 0;
  }
  .code-header {
    background: var(--code-bg); color: var(--ink-soft);
    font-size: 11px; font-family: monospace;
    padding: 5px 12px; border-bottom: 1px solid var(--line);
    letter-spacing: .04em;
  }
  .code-wrap pre {
    background: var(--code-bg2, #1e1e2e);
    padding: 12px 14px; overflow-x: auto; margin: 0;
    white-space: pre; tab-size: 2;
  }
  .code-wrap pre code {
    background: none; padding: 0; font-size: 13px;
    line-height: 1.6; font-family: monospace;
    white-space: pre;
  }
  .asst-bubble table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 13px; }
  .asst-bubble th { border: 1px solid var(--line); padding: 4px 8px; background: var(--code-bg); font-weight: 600; }
  .asst-bubble td { border: 1px solid var(--line); padding: 4px 8px; }

  /* 출처 */
  .sources { display: flex; align-items: center; flex-wrap: wrap; gap: 5px; padding-left: 4px; }
  .src-label { font-size: 11.5px; color: var(--ink-soft); margin-right: 2px; }
  .src-chip {
    font-size: 11.5px; color: var(--src-color);
    background: var(--src-bg); border-radius: 5px;
    padding: 2px 8px;
  }

  @media (max-width: 600px) {
    .user-bubble { max-width: 90%; }
    .asst-bubble { font-size: 14px; }
  }
  @media print {
    .page-header { position: static; box-shadow: none; }
    .turn { break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page-header">
  <h1>코어노트 대화 기록</h1>
  <span class="meta">${date} · ${conversation.length}개 대화</span>
</div>
<div class="chat-wrap">
${turns}
</div>
</body>
</html>`;

    if (format === "html") {
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const el = document.createElement("a");
      el.href = URL.createObjectURL(blob);
      el.download = `corenote-${ts}.html`;
      el.click();
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
    const MARK = "CODEBLOCK";
    const blocks = [];

    // 코드 블록을 먼저 추출 — 언어명 캡처 후 헤더로 표시
    let s = md.replace(/```([\w]*)\n?([\s\S]*?)```/gm, (_, lang, code) => {
      const label = lang || "code";
      blocks.push(
        `<div class="code-wrap"><div class="code-header">${escHtml(label)}</div>` +
          `<pre><code>${escHtml(code)}</code></pre></div>`,
      );
      return `[[${MARK}${blocks.length - 1}]]`;
    });

    // HTML 이스케이프 (플레이스홀더는 영향 없음)
    s = s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    // 인라인 코드
    s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    // 굵게/기울임
    s = s.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

    // 줄 단위 블록 처리
    const lines = s.split("\n");
    const out = [];
    let listBuf = [];
    let listTag = "";

    const flush = () => {
      if (listBuf.length) {
        out.push(`<${listTag}>${listBuf.join("")}</${listTag}>`);
        listBuf = [];
        listTag = "";
      }
    };

    for (const line of lines) {
      // 코드 블록 플레이스홀더는 그대로 출력 (절대 <p>로 감싸지 않음)
      if (line.includes(`[[${MARK}`)) {
        flush();
        out.push(line);
        continue;
      }

      const h3 = line.match(/^### (.+)/);
      const h2 = line.match(/^## (.+)/);
      const h1 = line.match(/^# (.+)/);
      const ul = line.match(/^[-*] (.+)/);
      const ol = line.match(/^\d+\. (.+)/);
      const bq = line.match(/^> (.+)/);

      if (h3) {
        flush();
        out.push(`<h3>${h3[1]}</h3>`);
      } else if (h2) {
        flush();
        out.push(`<h2>${h2[1]}</h2>`);
      } else if (h1) {
        flush();
        out.push(`<h1>${h1[1]}</h1>`);
      } else if (ul) {
        if (listTag !== "ul") {
          flush();
          listTag = "ul";
        }
        listBuf.push(`<li>${ul[1]}</li>`);
      } else if (ol) {
        if (listTag !== "ol") {
          flush();
          listTag = "ol";
        }
        listBuf.push(`<li>${ol[1]}</li>`);
      } else if (bq) {
        flush();
        out.push(`<blockquote>${bq[1]}</blockquote>`);
      } else if (line.trim() === "") {
        flush();
      } else {
        flush();
        out.push(`<p>${line}</p>`);
      }
    }
    flush();

    let result = out.join("");
    blocks.forEach((b, i) => {
      result = result.replace(`[[${MARK}${i}]]`, b);
    });
    return result;
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
