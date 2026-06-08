import { useEffect, useState } from "react";
import { C, sans, shadow } from "../theme";
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

      <SessionSidebar chat={chatHook} memory={memoryHook} page={page} setPage={setPage} />

      {/* 메인 콘텐츠 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: C.paper,
        }}
      >
        {/* 상단바 */}
        <div
          style={{
            flexShrink: 0,
            height: 52,
            padding: "0 20px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: `1px solid ${C.line}`,
            background: C.card,
          }}
        >
          {page === "main" && (
            <div style={{ flex: 1 }}>
              <WarningBanner health={docsHook.health} />
            </div>
          )}
          {page !== "main" && <div style={{ flex: 1 }} />}

          <IconBtn
            title={darkMode ? "라이트 모드" : "다크 모드"}
            onClick={() => setDarkMode((v) => !v)}
          >
            {darkMode ? "☀" : "☾"}
          </IconBtn>
          <IconBtn title="설정" onClick={() => settingsHook.setShowSettings(true)}>
            ⚙
          </IconBtn>
        </div>

        {/* 페이지 */}
        {page === "main" ? (
          <div
            style={{
              flex: 1,
              overflow: "hidden",
              padding: "20px",
              display: "flex",
              gap: 16,
            }}
          >
            <div
              style={{
                flex: "0 0 300px",
                overflowY: "auto",
                background: C.card,
                borderRadius: "var(--radius-lg)",
                padding: "18px",
                boxShadow: shadow.sm,
              }}
            >
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

function IconBtn({ children, title, onClick }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        border: `1px solid ${C.line}`,
        background: "transparent",
        color: C.inkSoft,
        borderRadius: "var(--radius-sm)",
        padding: "5px 10px",
        fontSize: 15,
        lineHeight: 1,
        transition: "all .15s",
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
