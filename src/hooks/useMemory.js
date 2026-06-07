import { useEffect, useState } from "react";
import { fetchMemories, postMemory, deleteMemory } from "../api";

export default function useMemory() {
  const [memories, setMemories] = useState([]);

  const load = async () => {
    try {
      setMemories(await fetchMemories());
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const addMemory = async (content) => {
    try {
      const m = await postMemory(content);
      setMemories((prev) => [m, ...prev]);
    } catch {}
  };

  const removeMemory = async (id) => {
    try {
      await deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
    } catch {}
  };

  // 외부에서 추출 완료 후 목록 갱신 시 호출
  const refresh = load;

  return { memories, addMemory, removeMemory, refresh };
}
