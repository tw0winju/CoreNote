import { C, sans } from "../theme";

export default function WarningBanner({ health }) {
  if (!health || (health.ollama && health.chatInstalled && health.embedInstalled)) return null;

  const msg = !health.ollama
    ? "Ollama에 연결할 수 없어요. Ollama가 실행 중인지 확인하세요."
    : !health.embedInstalled
      ? `임베딩 모델(${health.embedModel})이 없어요. 'ollama pull ${health.embedModel}' 실행.`
      : `답변 모델(${health.chatModel})이 없어요. 'ollama pull ${health.chatModel}' 실행.`;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: "rgba(234, 88, 12, 0.1)",
        border: "1px solid rgba(234, 88, 12, 0.25)",
        color: "#c2410c",
        borderRadius: "var(--radius-sm)",
        padding: "6px 12px",
        fontSize: 13,
        fontFamily: sans,
        lineHeight: 1.5,
      }}
    >
      <span style={{ fontSize: 14 }}>⚠</span>
      {msg}
    </div>
  );
}
