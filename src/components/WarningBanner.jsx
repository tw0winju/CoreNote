import { C } from "../theme";

export default function WarningBanner({ health }) {
  if (!health || (health.ollama && health.chatInstalled && health.embedInstalled)) return null;

  const msg = !health.ollama
    ? "⚠ Ollama에 연결할 수 없어요. Ollama가 실행 중인지 확인하세요."
    : !health.embedInstalled
      ? `⚠ 임베딩 모델(${health.embedModel})이 없어요. 터미널에서 'ollama pull ${health.embedModel}' 실행.`
      : `⚠ 답변 모델(${health.chatModel})이 없어요. 터미널에서 'ollama pull ${health.chatModel}' 실행.`;

  return (
    <div
      style={{
        background: "#fbeee6",
        border: `1px solid ${C.accentSoft}`,
        color: "#7a3417",
        borderRadius: 12,
        padding: "12px 16px",
        fontSize: 13.5,
        marginBottom: 22,
        lineHeight: 1.6,
      }}
    >
      {msg}
    </div>
  );
}
