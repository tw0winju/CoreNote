// ── 문서 ──────────────────────────────────────────────────────────────────────
export const fetchDocs = () => fetch("/api/docs").then((r) => r.json());
export const fetchHealth = () =>
  fetch("/api/health").then((r) => (r.ok ? r.json() : { ollama: false }));
export const deleteDoc = (id) => fetch(`/api/docs/${id}`, { method: "DELETE" });
export const patchDocName = (id, name) =>
  fetch(`/api/docs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
export const patchDocFolder = (id, folderId) =>
  fetch(`/api/docs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderId }),
  });

// ── 폴더 ──────────────────────────────────────────────────────────────────────
export const postFolder = (name) =>
  fetch("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }).then((r) => r.json());
export const patchFolderName = (id, name) =>
  fetch(`/api/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
export const deleteFolder = (id) => fetch(`/api/folders/${id}`, { method: "DELETE" });

// ── 색인 ──────────────────────────────────────────────────────────────────────
export const postIndexFile = (base64, filename, pageFrom = null, pageTo = null, folderId = null) =>
  fetch("/api/index", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: base64,
      filename,
      ...(pageFrom != null && { pageFrom }),
      ...(pageTo != null && { pageTo }),
      ...(folderId != null && { folderId }),
    }),
  });

export const postIndexUrl = (url, folderId = null) =>
  fetch("/api/index-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, ...(folderId != null && { folderId }) }),
  });

// ── 질문 ──────────────────────────────────────────────────────────────────────
export const postAsk = (question, history, docIds) =>
  fetch("/api/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      history,
      ...(docIds?.size > 0 && { docIds: [...docIds] }),
    }),
  });

// ── 설정 ──────────────────────────────────────────────────────────────────────
export const fetchSettings = () => fetch("/api/settings").then((r) => r.json());
export const postSettings = (data) =>
  fetch("/api/settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

// ── SSE 파서 ──────────────────────────────────────────────────────────────────
// error 이벤트는 자동으로 throw. 나머지는 handlers[type](event)로 디스패치.
export async function readSSE(response, handlers) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let event;
      try {
        event = JSON.parse(line.slice(6));
      } catch {
        continue;
      }
      if (event.type === "error") throw new Error(event.error);
      await handlers[event.type]?.(event);
    }
  }
}
