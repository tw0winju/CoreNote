import { useEffect, useState } from "react";
import { C, sans } from "../theme";
import useDocs from "../hooks/useDocs";
import useIndexing from "../hooks/useIndexing";
import useChat from "../hooks/useChat";
import useMemory from "../hooks/useMemory";
import useSettings from "../hooks/useSettings";
import WarningBanner from "./WarningBanner";
import SettingsModal from "./SettingsModal";
import SessionSidebar from "./SessionSidebar";
import Library from "./Library";
import Chat from "./Chat";
import LearnPage from "./LearnPage";

export default function App() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("corenote_theme") === "dark");
  const [page, setPage] = useState("main");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("corenote_theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const docsHook = useDocs();
  const settingsHook = useSettings(docsHook.loadHealth);
  const indexingHook = useIndexing(async () => {
    await docsHook.loadDocs();
    await docsHook.loadHealth();
  });
  const memoryHook = useMemory();
  const chatHook = useChat(memoryHook.refresh);

  return (
    <div
      style={{
        fontFamily: sans,
        color: C.ink,
        height: "100vh",
        display: "flex",
        overflow: "hidden",
        background: C.paper,
      }}
    >
      {settingsHook.showSettings && settingsHook.settingsForm && (
        <SettingsModal
          form={settingsHook.settingsForm}
          setForm={settingsHook.setSettingsForm}
          onSave={settingsHook.save}
          onClose={() => settingsHook.setShowSettings(false)}
        />
      )}

      <SessionSidebar chat={chatHook} memory={memoryHook} />

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: `radial-gradient(circle at 60% 10%, ${C.paper2}, ${C.paper} 60%)`,
        }}
      >
        {/* 상단바 */}
        <div
          style={{
            flexShrink: 0,
            padding: "18px 24px 10px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          {/* 페이지 탭 */}
          <div style={{ display: "flex", gap: 4, flexShrink: 0, alignSelf: "center" }}>
            {[["main", "💬 대화"], ["learn", "📖 학습"]].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPage(key)}
                style={{
                  border: `1px solid ${page === key ? C.accent : C.line}`,
                  background: page === key ? C.accentSoft : "transparent",
                  color: page === key ? C.accent : C.inkSoft,
                  padding: "5px 13px",
                  borderRadius: 8,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: sans,
                  fontWeight: page === key ? 600 : 400,
                  transition: "all .15s",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }}>
            {page === "main" && <WarningBanner health={docsHook.health} />}
          </div>

          {/* 다크모드 토글 */}
          <button
            onClick={() => setDarkMode((v) => !v)}
            title={darkMode ? "라이트 모드" : "다크 모드"}
            style={{
              border: `1px solid ${C.line}`,
              background: "transparent",
              color: C.inkSoft,
              borderRadius: 8,
              padding: "5px 10px",
              fontSize: 15,
              cursor: "pointer",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            {darkMode ? "☀" : "☾"}
          </button>

          <button
            onClick={() => settingsHook.setShowSettings(true)}
            title="설정"
            style={{
              border: `1px solid ${C.line}`,
              background: "transparent",
              color: C.inkSoft,
              borderRadius: 8,
              padding: "5px 10px",
              fontSize: 16,
              cursor: "pointer",
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            ⚙
          </button>
        </div>

        {/* 콘텐츠 영역 */}
        {page === "main" ? (
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              padding: "0 24px 16px",
              display: "flex",
              gap: 20,
            }}
          >
            <div style={{ flex: "0 0 300px", overflowY: "auto", paddingRight: 4 }}>
              <Library docs={docsHook} indexing={indexingHook} />
            </div>
            <Chat chat={chatHook} docs={docsHook} />
          </div>
        ) : (
          <LearnPage chat={chatHook} docs={docsHook} memory={memoryHook} />
        )}
      </div>
    </div>
  );
}
