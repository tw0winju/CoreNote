import { useState } from "react";
import { C, sans, serif } from "../theme";
import MemoryPanel from "./MemoryPanel";

export default function SessionSidebar({ chat, memory }) {
  const {
    conversation,
    sessions,
    loadSession,
    deleteSession,
    clearConversation,
    saveSession,
    savingName,
    setSavingName,
    showSaveInput,
    setShowSaveInput,
  } = chat;

  const [activeId, setActiveId] = useState(null);

  const handleLoad = (s) => {
    loadSession(s);
    setActiveId(s.id);
  };

  const handleNew = () => {
    clearConversation();
    setActiveId(null);
  };

  const handleSave = () => {
    saveSession();
    setActiveId(null); // 저장 후 activeId는 저장된 세션 id로 갱신하기 어려우므로 초기화
  };

  return (
    <div
      style={{
        width: 200,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: C.paper2,
        borderRight: `1px solid ${C.line}`,
        overflow: "hidden",
      }}
    >
      {/* 앱 이름 */}
      <div
        style={{
          padding: "20px 16px 14px",
          fontFamily: serif,
          fontSize: 16,
          fontWeight: 700,
          letterSpacing: "-0.3px",
          color: C.ink,
          flexShrink: 0,
        }}
      >
        CoreNote
      </div>

      {/* 새 대화 버튼 */}
      <div style={{ padding: "0 10px 10px", flexShrink: 0 }}>
        <button
          onClick={handleNew}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            background: "transparent",
            cursor: "pointer",
            fontFamily: sans,
            fontSize: 13.5,
            color: C.inkSoft,
            transition: "all .15s",
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>✏</span>새 대화
        </button>
      </div>

      {/* 구분선 */}
      <div style={{ height: 1, background: C.line, margin: "0 12px 8px", flexShrink: 0 }} />

      {/* 세션 목록 (스크롤) */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px" }}>
        {/* 현재 대화 */}
        {conversation.length > 0 && (
          <SessionItem
            label="현재 대화"
            sub={`${conversation.length}턴`}
            isActive={activeId === null}
            onClick={() => setActiveId(null)}
            onSave={() => setShowSaveInput((v) => !v)}
            showSaveIcon
          />
        )}

        {/* 세션 이름 저장 인풋 */}
        {showSaveInput && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: "6px 4px 4px" }}>
            <input
              autoFocus
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") {
                  setShowSaveInput(false);
                  setSavingName("");
                }
              }}
              placeholder="세션 이름 (Enter)"
              style={{
                width: "100%",
                padding: "5px 8px",
                borderRadius: 7,
                border: `1px solid ${C.accent}`,
                fontFamily: sans,
                fontSize: 12,
                background: C.card,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1,
                  border: "none",
                  background: C.ink,
                  color: C.paper,
                  padding: "4px 0",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: sans,
                }}
              >
                저장
              </button>
              <button
                onClick={() => {
                  setShowSaveInput(false);
                  setSavingName("");
                }}
                style={{
                  flex: 1,
                  border: `1px solid ${C.line}`,
                  background: "transparent",
                  padding: "4px 0",
                  borderRadius: 6,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: sans,
                }}
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* 저장된 세션 */}
        {sessions.length > 0 && (
          <>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: C.inkSoft,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "8px 4px 4px",
              }}
            >
              저장된 세션
            </div>
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                label={s.name}
                sub={new Date(s.savedAt).toLocaleString("ko-KR", {
                  month: "numeric",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                isActive={activeId === s.id}
                onClick={() => handleLoad(s)}
                onDelete={() => deleteSession(s.id)}
              />
            ))}
          </>
        )}

        {sessions.length === 0 && conversation.length === 0 && (
          <div style={{ fontSize: 12, color: C.inkSoft, padding: "8px 4px", lineHeight: 1.6 }}>
            대화 후 💾로 저장하면 여기에 표시돼요.
          </div>
        )}
      </div>

      {/* 기억 패널 */}
      {memory && (
        <MemoryPanel
          memories={memory.memories}
          onAdd={memory.addMemory}
          onDelete={memory.removeMemory}
        />
      )}
    </div>
  );
}

function SessionItem({ label, sub, isActive, onClick, onDelete, onSave, showSaveIcon }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 8px",
        borderRadius: 8,
        cursor: "pointer",
        background: isActive ? C.accentSoft : hovered ? "rgba(0,0,0,0.04)" : "transparent",
        marginBottom: 2,
        transition: "background .1s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? C.accent : C.ink,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 11, color: C.inkSoft, marginTop: 1 }}>{sub}</div>
      </div>

      {/* 저장 아이콘 (현재 대화) */}
      {showSaveIcon && (hovered || isActive) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSave();
          }}
          title="세션 저장"
          style={{
            border: "none",
            background: "transparent",
            fontSize: 13,
            cursor: "pointer",
            padding: "1px 3px",
            color: C.inkSoft,
            flexShrink: 0,
          }}
        >
          💾
        </button>
      )}

      {/* 삭제 버튼 */}
      {onDelete && hovered && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="삭제"
          style={{
            border: "none",
            background: "transparent",
            color: C.inkSoft,
            fontSize: 15,
            lineHeight: 1,
            cursor: "pointer",
            padding: "0 2px",
            flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
