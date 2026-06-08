import { useState } from "react";
import { C, sans } from "../theme";

export default function MemoryPanel({ memories, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleAdd = () => {
    if (!input.trim()) return;
    onAdd(input.trim());
    setInput("");
    setShowInput(false);
  };

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: sans,
          fontSize: 12.5,
          color: "rgba(255,255,255,0.38)",
        }}
      >
        <span style={{ fontSize: 13 }}>🧠</span>
        <span
          style={{ flex: 1, textAlign: "left", fontWeight: 600, color: "rgba(255,255,255,0.45)" }}
        >
          기억 {memories.length > 0 ? `(${memories.length})` : ""}
        </span>
        <span style={{ fontSize: 9 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 10px 12px" }}>
          <div
            style={{ maxHeight: 200, overflowY: "auto", display: "grid", gap: 4, marginBottom: 7 }}
          >
            {memories.length === 0 && (
              <div
                style={{
                  fontSize: 11.5,
                  color: "rgba(255,255,255,0.22)",
                  padding: "4px 2px",
                  lineHeight: 1.6,
                }}
              >
                아직 기억이 없어요.
              </div>
            )}
            {memories.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 5,
                  background: "rgba(255,255,255,0.05)",
                  borderRadius: 7,
                  padding: "6px 8px",
                  fontSize: 11.5,
                  lineHeight: 1.55,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.28)",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {m.source === "auto" ? "✦" : "✎"}
                </span>
                <span style={{ flex: 1, color: "rgba(255,255,255,0.6)" }}>{m.content}</span>
                <button
                  onClick={() => onDelete(m.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "rgba(255,255,255,0.22)",
                    fontSize: 13,
                    lineHeight: 1,
                    cursor: "pointer",
                    padding: "0 1px",
                    flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {showInput ? (
            <div style={{ display: "flex", gap: 4 }}>
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") {
                    setShowInput(false);
                    setInput("");
                  }
                }}
                placeholder="기억할 내용"
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.14)",
                  fontFamily: sans,
                  fontSize: 12,
                  background: "rgba(255,255,255,0.07)",
                  color: "#fff",
                  outline: "none",
                }}
              />
              <button
                onClick={handleAdd}
                style={{
                  border: "none",
                  background: C.accent,
                  color: "#fff",
                  padding: "5px 9px",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: sans,
                }}
              >
                추가
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowInput(true)}
              style={{
                width: "100%",
                border: "1px dashed rgba(255,255,255,0.11)",
                background: "transparent",
                color: "rgba(255,255,255,0.28)",
                padding: "5px 0",
                borderRadius: 7,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: sans,
              }}
            >
              + 직접 추가
            </button>
          )}
        </div>
      )}
    </div>
  );
}
