import { C, sans } from "../theme";
import useDocs from "../hooks/useDocs";
import useIndexing from "../hooks/useIndexing";
import useChat from "../hooks/useChat";
import useSettings from "../hooks/useSettings";
import WarningBanner from "./WarningBanner";
import SettingsModal from "./SettingsModal";
import SessionSidebar from "./SessionSidebar";
import Library from "./Library";
import Chat from "./Chat";

export default function App() {
  const docsHook = useDocs();
  const settingsHook = useSettings(docsHook.loadHealth);
  const indexingHook = useIndexing(async () => {
    await docsHook.loadDocs();
    await docsHook.loadHealth();
  });
  const chatHook = useChat();

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

      {/* 세션 사이드바 */}
      <SessionSidebar chat={chatHook} />

      {/* 메인 영역 */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: `radial-gradient(circle at 60% 10%, ${C.paper2}, ${C.paper} 60%)`,
        }}
      >
        {/* 상단바: 경고 + 설정 */}
        <div
          style={{
            flexShrink: 0,
            padding: "18px 24px 10px",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            <WarningBanner health={docsHook.health} />
          </div>
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

        {/* 콘텐츠 2열 */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            padding: "0 24px 16px",
            display: "flex",
            gap: 20,
          }}
        >
          {/* 라이브러리 */}
          <div style={{ flex: "0 0 300px", overflowY: "auto", paddingRight: 4 }}>
            <Library docs={docsHook} indexing={indexingHook} />
          </div>

          {/* 채팅 */}
          <Chat chat={chatHook} docs={docsHook} />
        </div>
      </div>
    </div>
  );
}
