import { useState } from "react";
import { postIndexFile, postIndexUrl, readSSE } from "../api";

const VALID_EXTS = ["pdf", "txt", "md", "docx"];

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
  const [queueInfo, setQueueInfo] = useState(null);

  const readBase64 = (f) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(",")[1]);
      reader.onerror = () => reject(new Error("파일을 읽지 못했어요."));
      reader.readAsDataURL(f);
    });

  const processSSE = async (r) => {
    await readSSE(r, {
      progress: (e) => {
        setIndexStatus("");
        setIndexProgress({ done: e.done, total: e.total });
      },
      status: (e) => setIndexStatus(e.message),
      done: async () => await onIndexed(),
    });
  };

  const uploadFiles = async (files) => {
    const arr = Array.from(files).filter((f) =>
      VALID_EXTS.includes(f.name.split(".").pop().toLowerCase()),
    );
    if (!arr.length) {
      setIndexError("PDF, TXT, MD, DOCX 파일만 추가할 수 있어요.");
      return;
    }
    const from = pageFrom ? Number(pageFrom) : null;
    const to = pageTo ? Number(pageTo) : null;
    setIndexError("");
    setIndexing(true);
    try {
      for (let i = 0; i < arr.length; i++) {
        if (arr.length > 1) setQueueInfo({ cur: i + 1, total: arr.length });
        setIndexProgress(null);
        setIndexStatus("");
        const base64 = await readBase64(arr[i]);
        const r = await postIndexFile(base64, arr[i].name, from, to, targetFolderId);
        if (!r.ok) {
          let msg = "색인 실패";
          try {
            const d = await r.json();
            msg = d.error || msg;
          } catch {
            if (r.status === 413) msg = "파일이 너무 큽니다. 페이지 범위를 나눠서 색인하세요.";
            else msg = `서버 오류 (${r.status})`;
          }
          throw new Error(msg);
        }
        await processSSE(r);
      }
      setPageFrom("");
      setPageTo("");
    } catch (e) {
      setIndexError(e.message || "색인 중 오류가 발생했어요.");
    } finally {
      setIndexing(false);
      setIndexProgress(null);
      setIndexStatus("");
      setQueueInfo(null);
    }
  };

  const uploadFile = (f) => {
    if (!f) return;
    uploadFiles([f]);
  };

  const uploadUrl = async () => {
    const url = urlInput.trim();
    if (!url) return;
    setIndexError("");
    setIndexing(true);
    setIndexProgress(null);
    setIndexStatus("");
    try {
      const r = await postIndexUrl(url, targetFolderId);
      if (!r.ok) {
        let msg = "색인 실패";
        try {
          const d = await r.json();
          msg = d.error || msg;
        } catch {
          msg = `서버 오류 (${r.status})`;
        }
        throw new Error(msg);
      }
      await processSSE(r);
      setUrlInput("");
    } catch (e) {
      setIndexError(e.message || "색인 중 오류가 발생했어요.");
    } finally {
      setIndexing(false);
      setIndexProgress(null);
      setIndexStatus("");
    }
  };

  const queueSuffix = queueInfo ? ` (${queueInfo.cur}/${queueInfo.total})` : "";
  const spinnerMsg =
    (indexStatus ||
      (indexProgress
        ? `임베딩 중… (${indexProgress.done}/${indexProgress.total})`
        : "텍스트 추출 중…")) + queueSuffix;

  return {
    indexing,
    indexError,
    spinnerMsg,
    uploadMode,
    setUploadMode,
    urlInput,
    setUrlInput,
    uploadFile,
    uploadFiles,
    uploadUrl,
    pageFrom,
    setPageFrom,
    pageTo,
    setPageTo,
    targetFolderId,
    setTargetFolderId,
  };
}
