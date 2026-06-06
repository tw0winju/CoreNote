import { useState, useEffect } from "react";
import { fetchSettings, postSettings } from "../api";

export default function useSettings(onSaved) {
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState(null);

  const load = async () => {
    try {
      setSettingsForm(await fetchSettings());
    } catch {}
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    try {
      await postSettings(settingsForm);
      setShowSettings(false);
      onSaved?.();
    } catch {}
  };

  return { showSettings, setShowSettings, settingsForm, setSettingsForm, save };
}
