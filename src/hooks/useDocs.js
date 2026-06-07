import { useState, useEffect } from "react";
import {
  fetchDocs,
  fetchHealth,
  deleteDoc,
  patchDocName,
  patchDocFolder,
  postFolder,
  patchFolderName,
  deleteFolder,
} from "../api";

export default function useDocs() {
  const [docs, setDocs] = useState([]);
  const [folders, setFolders] = useState([]);
  const [health, setHealth] = useState(null);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [renameId, setRenameId] = useState(null);
  const [renameName, setRenameName] = useState("");
  const [renameFolderId, setRenameFolderId] = useState(null);
  const [renameFolderName, setRenameFolderName] = useState("");

  const loadDocs = async () => {
    try {
      const d = await fetchDocs();
      setDocs(d.docs || []);
      setFolders(d.folders || []);
    } catch {}
  };

  const loadHealth = async () => {
    try {
      setHealth(await fetchHealth());
    } catch {
      setHealth({ ollama: false });
    }
  };

  useEffect(() => {
    loadDocs();
    loadHealth();
  }, []);

  const removeDoc = async (id) => {
    try {
      await deleteDoc(id);
      setSelectedDocs((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      await loadDocs();
    } catch {}
  };

  const toggleDoc = (id) =>
    setSelectedDocs((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  const startRename = (doc) => {
    setRenameId(doc.id);
    setRenameName(doc.name);
  };
  const cancelRename = () => setRenameId(null);

  const commitRename = async () => {
    if (!renameName.trim()) {
      cancelRename();
      return;
    }
    try {
      await patchDocName(renameId, renameName.trim());
      setRenameId(null);
      await loadDocs();
    } catch {}
  };

  const moveDoc = async (docId, folderId) => {
    try {
      await patchDocFolder(docId, folderId);
      await loadDocs();
    } catch {}
  };

  // 폴더 선택 토글 (폴더 내 전체 문서 선택/해제)
  const toggleFolder = (folderId) => {
    const ids = docs.filter((d) => d.folderId === folderId).map((d) => d.id);
    if (!ids.length) return;
    const allSelected = ids.every((id) => selectedDocs.has(id));
    setSelectedDocs((prev) => {
      const s = new Set(prev);
      if (allSelected) ids.forEach((id) => s.delete(id));
      else ids.forEach((id) => s.add(id));
      return s;
    });
  };

  const createFolder = async (name) => {
    try {
      const f = await postFolder(name);
      await loadDocs();
      return f.id;
    } catch {}
  };

  const startRenameFolder = (folder) => {
    setRenameFolderId(folder.id);
    setRenameFolderName(folder.name);
  };
  const cancelRenameFolder = () => setRenameFolderId(null);

  const commitRenameFolder = async () => {
    if (!renameFolderName.trim()) {
      cancelRenameFolder();
      return;
    }
    try {
      await patchFolderName(renameFolderId, renameFolderName.trim());
      setRenameFolderId(null);
      await loadDocs();
    } catch {}
  };

  const removeFolder = async (id) => {
    try {
      await deleteFolder(id);
      setSelectedDocs((prev) => {
        const removed = docs.filter((d) => d.folderId === id).map((d) => d.id);
        const s = new Set(prev);
        removed.forEach((rid) => s.delete(rid));
        return s;
      });
      await loadDocs();
    } catch {}
  };

  return {
    docs,
    folders,
    health,
    selectedDocs,
    setSelectedDocs,
    renameId,
    renameName,
    setRenameName,
    renameFolderId,
    renameFolderName,
    setRenameFolderName,
    loadDocs,
    loadHealth,
    removeDoc,
    toggleDoc,
    toggleFolder,
    startRename,
    cancelRename,
    commitRename,
    moveDoc,
    createFolder,
    startRenameFolder,
    cancelRenameFolder,
    commitRenameFolder,
    removeFolder,
  };
}
