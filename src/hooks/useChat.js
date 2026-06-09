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

    const tocItems = conversation
      .map(
        (item, i) =>
          `<a href="#q${i + 1}" class="toc-btn">Q${i + 1}. ${escHtml(item.q.substring(0, 28))}${item.q.length > 28 ? "…" : ""}</a>`,
      )
      .join("");

    const turns = conversation
      .map(
        (item, i) => `
  <div class="qa-card" id="q${i + 1}">
    <div class="qa-q">
      <div class="qa-num">${i + 1}</div>
      <div class="qa-q-text">${escHtml(item.q).replace(/\n/g, "<br>")}</div>
    </div>
    ${item.image ? `<div class="qa-img-wrap"><img src="${item.image}" class="qa-img" alt="첨부 이미지"></div>` : ""}
    <div class="qa-a">${mdToHtml(item.a)}</div>
    ${
      item.sources?.length > 0
        ? `<div class="qa-sources"><span class="src-label">출처</span>${item.sources.map((s) => `<span class="src-chip">${escHtml(s.docName)}</span>`).join("")}</div>`
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
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css">
<script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: #0f1117; --surface: #1a1d27; --surface2: #242736;
    --border: #2e3347; --accent: #7c6af5; --accent2: #4ecdc4;
    --text: #e8eaf0; --text-muted: #8b91a8;
  }

  body { font-family: "Noto Sans KR", -apple-system, sans-serif; background: var(--bg); color: var(--text); font-size: 15px; line-height: 1.7; }

  /* 헤더 */
  .page-header {
    position: sticky; top: 0; z-index: 100;
    background: linear-gradient(135deg, #1a1d27 0%, #242736 100%);
    border-bottom: 1px solid var(--border);
    padding: 14px 24px;
    box-shadow: 0 2px 20px rgba(0,0,0,.45);
  }
  .header-inner { max-width: 920px; margin: 0 auto; display: flex; align-items: baseline; justify-content: space-between; }
  .header-title { font-size: 17px; font-weight: 600; color: var(--text); }
  .header-title span { color: var(--accent); }
  .header-meta { font-size: 12px; color: var(--text-muted); }

  /* TOC */
  .toc-bar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 10px 0; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; }
  .toc-bar::-webkit-scrollbar { height: 3px; }
  .toc-bar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .toc-inner { display: inline-flex; gap: 8px; padding: 0 24px; }
  .toc-btn {
    display: inline-block; background: var(--surface2); color: var(--text-muted);
    border-radius: 20px; padding: 5px 14px; font-size: 12.5px; text-decoration: none;
    border: 1px solid var(--border); white-space: nowrap;
    max-width: 200px; overflow: hidden; text-overflow: ellipsis;
  }
  .toc-btn:hover { background: var(--accent); color: #fff; border-color: var(--accent); }

  /* 본문 */
  .content { max-width: 920px; margin: 0 auto; padding: 28px 24px 60px; display: flex; flex-direction: column; gap: 28px; }

  /* Q&A 카드 */
  .qa-card { background: var(--surface); border-radius: 12px; border: 1px solid var(--border); overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,.3); }

  .qa-q { background: linear-gradient(135deg, #1e2035 0%, #252839 100%); padding: 18px 22px; border-bottom: 1px solid var(--border); display: flex; align-items: flex-start; gap: 12px; }
  .qa-num { display: flex; align-items: center; justify-content: center; min-width: 26px; height: 26px; background: var(--accent); color: #fff; border-radius: 50%; font-size: 12px; font-weight: 700; flex-shrink: 0; margin-top: 2px; }
  .qa-q-text { font-size: 15px; font-weight: 500; color: #f0f1ff; line-height: 1.6; word-break: break-word; }

  .qa-img-wrap { padding: 0 22px; border-bottom: 1px solid var(--border); background: #13151f; }
  .qa-img { max-width: 360px; width: 100%; border-radius: 6px; display: block; padding: 12px 0; }

  .qa-a { padding: 20px 22px; }
  .qa-a p { margin: 0 0 10px; color: var(--text); line-height: 1.75; }
  .qa-a p:last-child { margin-bottom: 0; }
  .qa-a h1 { font-size: 18px; font-weight: 700; margin: 18px 0 8px; color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  .qa-a h2 { font-size: 16px; font-weight: 700; margin: 14px 0 6px; color: var(--text); }
  .qa-a h3 { font-size: 14.5px; font-weight: 600; margin: 12px 0 5px; color: var(--accent2); }
  .qa-a ul, .qa-a ol { padding-left: 22px; margin: 6px 0 10px; }
  .qa-a li { margin-bottom: 4px; line-height: 1.65; }
  .qa-a strong { font-weight: 600; color: #fff; }
  .qa-a em { font-style: italic; color: var(--text-muted); }
  .qa-a blockquote { border-left: 3px solid var(--accent); padding: 8px 14px; margin: 10px 0; color: var(--text-muted); background: var(--surface2); border-radius: 0 6px 6px 0; }
  .qa-a code { background: var(--surface2); color: var(--accent2); border-radius: 4px; padding: 1px 6px; font-size: 13px; font-family: "JetBrains Mono", monospace; }
  .qa-a table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 13.5px; }
  .qa-a th { border: 1px solid var(--border); padding: 7px 10px; background: var(--surface2); font-weight: 600; color: var(--accent2); }
  .qa-a td { border: 1px solid var(--border); padding: 7px 10px; color: var(--text); }

  /* 코드 블록 */
  .code-wrap { border: 1px solid var(--border); border-radius: 8px; overflow: hidden; margin: 12px 0; }
  .code-header { background: var(--surface2); color: var(--text-muted); font-size: 11.5px; font-family: "JetBrains Mono", monospace; padding: 6px 14px; border-bottom: 1px solid var(--border); letter-spacing: .06em; display: flex; align-items: center; gap: 8px; }
  .dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
  .dot-r { background: #ff5f57; } .dot-y { background: #ffbd2e; } .dot-g { background: #28c941; }
  .lang-label { text-transform: uppercase; letter-spacing: .08em; }
  .code-wrap pre { margin: 0; overflow-x: auto; tab-size: 2; }
  .code-wrap pre code.hljs { font-family: "JetBrains Mono", monospace !important; font-size: 13px !important; line-height: 1.6 !important; display: block !important; padding: 14px !important; background: #1e2030 !important; }

  /* 출처 */
  .qa-sources { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 12px 22px 18px; border-top: 1px solid var(--border); }
  .src-label { font-size: 11.5px; color: var(--text-muted); margin-right: 4px; }
  .src-chip { font-size: 11.5px; color: var(--accent2); background: rgba(78,205,196,.12); border: 1px solid rgba(78,205,196,.28); border-radius: 5px; padding: 2px 9px; }

  @media (max-width: 600px) {
    .content { padding: 16px 12px 40px; }
    .qa-q, .qa-a { padding: 14px 16px; }
    .qa-sources { padding: 10px 16px 14px; }
    .header-inner { flex-direction: column; gap: 4px; }
    .toc-inner { padding: 0 12px; }
  }
  @media print {
    .page-header { position: static; }
    .toc-bar { display: none; }
    .qa-card { break-inside: avoid; box-shadow: none; }
  }
</style>
</head>
<body>
<div class="page-header">
  <div class="header-inner">
    <div class="header-title"><span>Core</span>Note 대화 기록</div>
    <div class="header-meta">${date} · ${conversation.length}개 질문</div>
  </div>
</div>
<div class="toc-bar"><div class="toc-inner">${tocItems}</div></div>
<div class="content">
${turns}
</div>
<script>document.addEventListener('DOMContentLoaded', () => { document.querySelectorAll('pre code[class^="language-"]').forEach(el => hljs.highlightElement(el)); });</script>
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
      const cls = lang ? ` class="language-${escHtml(lang)}"` : "";
      blocks.push(
        `<div class="code-wrap"><div class="code-header">` +
          `<span class="dot dot-r"></span><span class="dot dot-y"></span><span class="dot dot-g"></span>` +
          `<span class="lang-label">${escHtml(label)}</span></div>` +
          `<pre><code${cls}>${escHtml(code)}</code></pre></div>`,
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
