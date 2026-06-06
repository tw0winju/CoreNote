import { C, sans, serif } from "../theme";

export default function Header({ onSettings }) {
  return (
    <header
      style={{
        marginBottom: 26,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <div>
        <div
          style={{
            fontSize: 12,
            letterSpacing: "0.3em",
            textTransform: "uppercase",
            color: C.accent,
            fontWeight: 600,
          }}
        >
          Local RAG · 내 자료 검색
        </div>
        <h1
          style={{
            fontFamily: serif,
            fontSize: 42,
            lineHeight: 1.1,
            margin: "8px 0 6px",
            fontWeight: 700,
          }}
        >
          코어노트
        </h1>
        <p style={{ color: C.inkSoft, fontSize: 15.5, margin: 0, maxWidth: 560, fontFamily: sans }}>
          PDF를 추가해두고, 내 자료 전체에 질문하세요. 관련 부분을 찾아 <b>출처와 함께</b> 답합니다.
          전부 내 컴퓨터에서 동작해요.
        </p>
      </div>
      <button
        onClick={onSettings}
        style={{
          border: `1px solid ${C.line}`,
          background: C.card,
          color: C.inkSoft,
          borderRadius: 8,
          padding: "6px 14px",
          fontSize: 13.5,
          cursor: "pointer",
          marginTop: 6,
          flexShrink: 0,
          fontFamily: sans,
        }}
      >
        ⚙ 설정
      </button>
    </header>
  );
}
