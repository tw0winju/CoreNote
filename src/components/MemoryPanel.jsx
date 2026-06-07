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
    <div style={{ borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>
      {/* 헤더 토글 */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "10px 16px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          fontFamily: sans,
          fontSize: 12.5,
          color: C.inkSoft,
        }}
      >
        <span style={{ fontSize: 13 }}>🧠</span>
        <span style={{ flex: 1, textAlign: "left", fontWeight: 600 }}>
          기억 {memories.length > 0 ? `(${memories.length})` : ""}
        </span>
        <span style={{ fontSize: 10 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 10px 10px" }}>
          {/* 기억 목록 */}
          <div
            style={{
              maxHeight: 220,
              overflowY: "auto",
              display: "grid",
              gap: 5,
              marginBottom: 8,
            }}
          >
            {memories.length === 0 && (
              <div style={{ fontSize: 12, color: C.inkSoft, padding: "4px 2px", lineHeight: 1.5 }}>
                아직 기억이 없어요.
                <br />
                대화하면 자동으로 생성돼요.
              </div>
            )}
            {memories.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  background: C.paper2,
                  borderRadius: 8,
                  padding: "6px 8px",
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              >
                <span style={{ fontSize: 11, color: C.inkSoft, flexShrink: 0, marginTop: 1 }}>
                  {m.source === "auto" ? "✦" : "✎"}
                </span>
                <span style={{ flex: 1, color: C.ink }}>{m.content}</span>
                <button
                  onClick={() => onDelete(m.id)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: C.inkSoft,
                    fontSize: 14,
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

          {/* 직접 추가 */}
          {showInput ? (
            <div style={{ display: "flex", gap: 4 }}>
              <input
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAdd();
                  if (e.key === "Escape") { setShowInput(false); setInput(""); }
                }}
                placeholder="기억할 내용"
                style={{
                  flex: 1,
                  padding: "4px 7px",
                  borderRadius: 7,
                  border: `1px solid ${C.accent}`,
                  fontFamily: sans,
                  fontSize: 12,
                  background: C.card,
                  outline: "none",
                }}
              />
              <button
                onClick={handleAdd}
                style={{
                  border: "none",
                  background: C.ink,
                  color: C.paper,
                  padding: "4px 9px",
                  borderRadius: 7,
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
                border: `1px dashed ${C.line}`,
                background: "transparent",
                color: C.inkSoft,
                padding: "4px 0",
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
