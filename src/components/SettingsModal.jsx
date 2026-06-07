import { C, sans, serif } from "../theme";

export default function SettingsModal({ form, setForm, onSave, onClose }) {
  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.4)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.paper,
          borderRadius: 18,
          padding: "28px 32px",
          width: "100%",
          maxWidth: 520,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h3 style={{ fontFamily: serif, fontSize: 20, margin: "0 0 20px", fontWeight: 700 }}>
          설정
        </h3>

        {[
          { key: "chatModel", label: "답변 모델" },
          { key: "embedModel", label: "임베딩 모델" },
        ].map(({ key, label }) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: C.inkSoft, display: "block", marginBottom: 4 }}>
              {label}
            </label>
            <input
              value={form[key] || ""}
              onChange={(e) => set(key, e.target.value)}
              style={{
                width: "100%",
                padding: "7px 10px",
                borderRadius: 8,
                border: `1px solid ${C.line}`,
                fontFamily: sans,
                fontSize: 14,
                background: C.card,
                boxSizing: "border-box",
              }}
            />
          </div>
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          {[
            { key: "maxChunkChars", label: "청크 크기 (자)" },
            { key: "topK", label: "검색 결과 수" },
          ].map(({ key, label }) => (
            <div key={key}>
              <label style={{ fontSize: 13, color: C.inkSoft, display: "block", marginBottom: 4 }}>
                {label}
              </label>
              <input
                type="number"
                value={form[key] || ""}
                onChange={(e) => set(key, Number(e.target.value))}
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: `1px solid ${C.line}`,
                  fontFamily: sans,
                  fontSize: 14,
                  background: C.card,
                  boxSizing: "border-box",
                }}
              />
            </div>
          ))}
        </div>

        {[
          {
            key: "hydeEnabled",
            label: "HyDE 검색 향상",
            desc: "질문 전 가상 답변을 생성해 검색 정확도를 높입니다. 추가 LLM 호출이 발생합니다.",
          },
          {
            key: "rerankEnabled",
            label: "LLM 재순위화",
            desc: "검색 결과를 LLM으로 재정렬합니다. 추가 LLM 호출이 발생합니다.",
          },
        ].map(({ key, label, desc }) => (
          <div
            key={key}
            style={{
              marginBottom: 10,
              padding: "10px 12px",
              background: C.card,
              borderRadius: 10,
              border: `1px solid ${C.line}`,
            }}
          >
            <label
              style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}
            >
              <input
                type="checkbox"
                checked={!!form[key]}
                onChange={(e) => set(key, e.target.checked)}
                style={{ marginTop: 2 }}
              />
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 2 }}>{desc}</div>
              </div>
            </label>
          </div>
        ))}

        {/* 시스템 프롬프트 */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, color: C.inkSoft, display: "block", marginBottom: 4 }}>
            시스템 프롬프트
          </label>
          <textarea
            value={form.systemPrompt || ""}
            onChange={(e) => set("systemPrompt", e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "7px 10px",
              borderRadius: 8,
              border: `1px solid ${C.line}`,
              fontFamily: sans,
              fontSize: 13,
              background: C.card,
              boxSizing: "border-box",
              resize: "vertical",
              lineHeight: 1.5,
              outline: "none",
            }}
          />
          <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 3 }}>
            AI의 역할·톤을 지정합니다. 빈칸이면 기본값이 사용됩니다.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button
            onClick={onClose}
            style={{
              border: `1px solid ${C.line}`,
              background: "transparent",
              padding: "8px 16px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: sans,
            }}
          >
            취소
          </button>
          <button
            onClick={onSave}
            style={{
              border: "none",
              background: C.ink,
              color: C.paper,
              padding: "8px 18px",
              borderRadius: 8,
              cursor: "pointer",
              fontFamily: sans,
              fontWeight: 600,
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
