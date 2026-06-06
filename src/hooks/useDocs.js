import { useState, useEffect } from "react";
import { fetchDocs, fetchHealth, deleteDoc, patchDocName } from "../api";

export default function useDocs() {
  const [docs, setDocs] = useState([]);
  const [health, setHealth] = useState(null);
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [renameId, setRenameId] = useState(null);
  const [renameName, setRenameName] = useState("");

  const loadDocs = async () => {
    try {
      const d = await fetchDocs();
      setDocs(d.docs || []);
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

  return {
    docs,
    health,
    selectedDocs,
    renameId,
    renameName,
    setRenameName,
    loadDocs,
    loadHealth,
    removeDoc,
    toggleDoc,
    startRename,
    cancelRename,
    commitRename,
  };
}
