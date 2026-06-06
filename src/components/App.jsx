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
        minHeight: "100vh",
        background: `radial-gradient(circle at 18% 12%, ${C.paper2}, ${C.paper} 55%)`,
      }}
    >
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "48px 22px 80px" }}>
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

        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Library docs={docsHook} indexing={indexingHook} />
          <Chat chat={chatHook} docs={docsHook} />
        </div>
      </div>
    </div>
  );
}
