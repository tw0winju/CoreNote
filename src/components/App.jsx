import { C, sans } from "../theme";
import useDocs from "../hooks/useDocs";
import useIndexing from "../hooks/useIndexing";
import useChat from "../hooks/useChat";
import useSettings from "../hooks/useSettings";
import Header from "./Header";
import WarningBanner from "./WarningBanner";
import SettingsModal from "./SettingsModal";
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
        flexDirection: "column",
        overflow: "hidden",
        background: `radial-gradient(circle at 18% 12%, ${C.paper2}, ${C.paper} 55%)`,
      }}
    >
      {/* 상단 헤더 영역 */}
      <div
        style={{
          flexShrink: 0,
          maxWidth: 1080,
          width: "100%",
          margin: "0 auto",
          padding: "28px 22px 14px",
          boxSizing: "border-box",
        }}
      >
        <Header onSettings={() => settingsHook.setShowSettings(true)} />

        {settingsHook.showSettings && settingsHook.settingsForm && (
          <SettingsModal
            form={settingsHook.settingsForm}
            setForm={settingsHook.setSettingsForm}
            onSave={settingsHook.save}
            onClose={() => settingsHook.setShowSettings(false)}
          />
        )}

        <WarningBanner health={docsHook.health} />
      </div>

      {/* 메인 2열 영역 */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          maxWidth: 1080,
          width: "100%",
          margin: "0 auto",
          padding: "0 22px 16px",
          boxSizing: "border-box",
          display: "flex",
          gap: 22,
        }}
      >
        {/* 라이브러리 패널 (내부 스크롤) */}
        <div
          style={{
            flex: "0 0 310px",
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          <Library docs={docsHook} indexing={indexingHook} />
        </div>

        {/* 채팅 패널 */}
        <Chat chat={chatHook} docs={docsHook} />
      </div>
    </div>
  );
}
