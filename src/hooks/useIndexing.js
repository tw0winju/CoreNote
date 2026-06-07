import { useState } from "react";
import { postIndexFile, postIndexUrl, readSSE } from "../api";

export default function useIndexing(onIndexed) {
  const [indexing, setIndexing] = useState(false);
  const [indexError, setIndexError] = useState("");
  const [indexStatus, setIndexStatus] = useState("");
  const [indexProgress, setIndexProgress] = useState(null);
  const [uploadMode, setUploadMode] = useState("file");
  const [urlInput, setUrlInput] = useState("");
  const [pageFrom, setPageFrom] = useState("");
  const [pageTo, setPageTo] = useState("");
  const [targetFolderId, setTargetFolderId] = useState(null);

  const begin = () => {
    setIndexing(true);
    setIndexError("");
    setIndexProgress(null);
    setIndexStatus("");
  };
  const end = () => {
    setIndexing(false);
    setIndexProgress(null);
    setIndexStatus("");
  };

  const run = async (fetchFn, onSuccess) => {
    begin();
    try {
      const r = await fetchFn();
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error || "색인 실패");
      }
      await readSSE(r, {
        progress: (e) => {
          setIndexStatus("");
          setIndexProgress({ done: e.done, total: e.total });
        },
        status: (e) => setIndexStatus(e.message),
        done: async () => await onIndexed(),
      });
      onSuccess?.();
    } catch (e) {
      setIndexError(e.message || "색인 중 오류가 발생했어요.");
    } finally {
      end();
    }
  };

  const uploadFile = (f) => {
    if (!f) return;
    const ext = f.name.split(".").pop().toLowerCase();
    if (!["pdf", "txt", "md", "docx"].includes(ext)) {
      setIndexError("PDF, TXT, MD, DOCX 파일만 추가할 수 있어요.");
      return;
    }
    const reader = new FileReader();
    const from = pageFrom ? Number(pageFrom) : null;
    const to = pageTo ? Number(pageTo) : null;
    reader.onload = () =>
      run(
        () => postIndexFile(String(reader.result).split(",")[1], f.name, from, to, targetFolderId),
        () => {
          setPageFrom("");
          setPageTo("");
        },
      );
    reader.onerror = () => setIndexError("파일을 읽지 못했어요.");
    reader.readAsDataURL(f);
  };

  const uploadUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    run(
      () => postIndexUrl(url, targetFolderId),
      () => setUrlInput(""),
    );
  };

  const spinnerMsg =
    indexStatus ||
    (indexProgress
      ? `임베딩 중… (${indexProgress.done}/${indexProgress.total})`
      : "텍스트 추출 중…");

  return {
    indexing,
    indexError,
    spinnerMsg,
    uploadMode,
    setUploadMode,
    urlInput,
    setUrlInput,
    uploadFile,
    uploadUrl,
    pageFrom,
    setPageFrom,
    pageTo,
    setPageTo,
    targetFolderId,
    setTargetFolderId,
  };
}
