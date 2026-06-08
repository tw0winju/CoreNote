import { useState } from "react";
import { C, sans } from "../theme";
import MemoryPanel from "./MemoryPanel";

export default function SessionSidebar({ chat, memory, page, setPage }) {
  const {
    conversation, sessions,
    loadSession, deleteSession, clearConversation,
    saveSession, savingName, setSavingName,
    showSaveInput, setShowSaveInput,
  } = chat;

  const [activeId, setActiveId] = useState(null);

  const handleLoad = (s) => { loadSession(s); setActiveId(s.id); };
  const handleNew  = () => { clearConversation(); setActiveId(null); };
  const handleSave = () => { saveSession(); setActiveId(null); };

  return (
    <div
      style={{
        width: 216,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        background: C.sidebar,
        overflow: "hidden",
        userSelect: "none",
      }}
    >
      {/* 로고 */}
      <div style={{ padding: "18px 16px 12px", display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
        <div
          style={{
            width: 30, height: 30, borderRadius: 9,
            background: C.accent,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, flexShrink: 0,
          }}
        >
          📖
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>
          CoreNote
        </span>
      </div>

      {/* 페이지 탭 */}
      <div style={{ padding: "0 8px 6px", flexShrink: 0 }}>
        {[
          { key: "main",  icon: "💬", label: "대화" },
          { key: "learn", icon: "📖", label: "학습" },
        ].map(({ key, icon, label }) => {
          const active = page === key;
          return (
            <button
              key={key}
              onClick={() => setPage(key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 10px",
                border: "none",
                borderRadius: "var(--radius-sm)",
                background: active ? C.sidebarActive : "transparent",
                cursor: "pointer",
                fontFamily: sans,
                fontSize: 13.5,
                color: active ? "#fff" : C.sidebarSoft,
                fontWeight: active ? 600 : 400,
                transition: "all .14s",
                marginBottom: 2,
                textAlign: "left",
              }}
            >
              <span style={{ fontSize: 14 }}>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>

      <Divider />

      {/* 새 대화 */}
      <div style={{ padding: "4px 8px 8px", flexShrink: 0 }}>
        <button
          onClick={handleNew}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "var(--radius-sm)",
            background: "transparent",
            cursor: "pointer",
            fontFamily: sans,
            fontSize: 13,
            color: C.sidebarSoft,
            transition: "all .14s",
          }}
        >
          <span style={{ fontSize: 13 }}>✏</span>새 대화
        </button>
      </div>

      {/* 세션 목록 */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 6px" }}>
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

        {showSaveInput && (
          <div style={{ padding: "4px 2px 6px", display: "flex", flexDirection: "column", gap: 4 }}>
            <input
              autoFocus
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") { setShowSaveInput(false); setSavingName(""); }
              }}
              placeholder="세션 이름 (Enter)"
              style={{
                padding: "6px 9px",
                borderRadius: 7,
                border: "1px solid rgba(255,255,255,0.14)",
                fontFamily: sans,
                fontSize: 12,
                background: "rgba(255,255,255,0.07)",
                color: "#fff",
                outline: "none",
                width: "100%",
              }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1, border: "none", background: C.accent, color: "#fff",
                  padding: "4px 0", borderRadius: 6, fontSize: 12, cursor: "pointer", fontFamily: sans,
                }}
              >저장</button>
              <button
                onClick={() => { setShowSaveInput(false); setSavingName(""); }}
                style={{
                  flex: 1, border: "1px solid rgba(255,255,255,0.1)", background: "transparent",
                  color: C.sidebarSoft, padding: "4px 0", borderRadius: 6,
                  fontSize: 12, cursor: "pointer", fontFamily: sans,
                }}
              >취소</button>
            </div>
          </div>
        )}

        {sessions.length > 0 && (
          <>
            <SectionLabel>저장된 세션</SectionLabel>
            {sessions.map((s) => (
              <SessionItem
                key={s.id}
                label={s.name}
                sub={new Date(s.savedAt).toLocaleString("ko-KR", {
                  month: "numeric", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
                isActive={activeId === s.id}
                onClick={() => handleLoad(s)}
                onDelete={() => deleteSession(s.id)}
              />
            ))}
          </>
        )}

        {sessions.length === 0 && conversation.length === 0 && (
          <div style={{ fontSize: 11.5, color: "rgba(255,255,255,0.22)", padding: "10px 6px", lineHeight: 1.65 }}>
            대화 후 💾로 저장하면 여기에 표시돼요.
          </div>
        )}
      </div>

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
        padding: "6px 8px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        background: isActive ? C.sidebarActive : hovered ? C.sidebarHover : "transparent",
        marginBottom: 1,
        transition: "background .12s",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: isActive ? 600 : 400,
            color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.28)", marginTop: 1 }}>{sub}</div>
      </div>

      {showSaveIcon && (hovered || isActive) && (
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          title="세션 저장"
          style={{
            border: "none", background: "transparent",
            fontSize: 12, cursor: "pointer", padding: "1px 3px",
            color: "rgba(255,255,255,0.35)", flexShrink: 0,
          }}
        >💾</button>
      )}

      {onDelete && hovered && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="삭제"
          style={{
            border: "none", background: "transparent",
            color: "rgba(255,255,255,0.3)", fontSize: 14,
            lineHeight: 1, cursor: "pointer", padding: "0 2px", flexShrink: 0,
          }}
        >×</button>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "2px 12px 6px" }} />;
}

function SectionLabel({ children }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: "rgba(255,255,255,0.28)",
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        padding: "10px 6px 4px",
      }}
    >
      {children}
    </div>
  );
}
