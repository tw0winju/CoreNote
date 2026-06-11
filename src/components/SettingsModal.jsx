import { C, sans, shadow } from "../theme";
import { PROMPT_PRESETS } from "../prompts";

function Toggle({ checked, onChange }) {
  return (
    <div
      className="toggle-track"
      onClick={() => onChange(!checked)}
      style={{ background: checked ? C.accent : C.line }}
    >
      <div
        className="toggle-thumb"
        style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
      />
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          fontSize: 12.5,
          color: C.inkSoft,
          display: "block",
          marginBottom: 5,
          fontWeight: 500,
        }}
      >
        {label}
      </label>
      {children}
      {hint && <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function TextInput({ value, onChange, type = "text" }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      style={{
        width: "100%",
        padding: "8px 11px",
        borderRadius: "var(--radius-sm)",
        border: `1.5px solid ${C.line}`,
        fontFamily: sans,
        fontSize: 13.5,
        background: C.paper,
        color: C.ink,
        boxSizing: "border-box",
        outline: "none",
        transition: "border-color .15s",
      }}
      onFocus={(e) => (e.target.style.borderColor = C.accent)}
      onBlur={(e) => (e.target.style.borderColor = "")}
    />
  );
}

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
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: C.card,
          borderRadius: "var(--radius-lg)",
          padding: "28px 30px",
          width: "100%",
          maxWidth: 520,
          boxShadow: shadow.lg,
          maxHeight: "90vh",
          overflowY: "auto",
          border: `1px solid ${C.line}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 22,
          }}
        >
          <h3 style={{ fontFamily: sans, fontSize: 17, margin: 0, fontWeight: 700, color: C.ink }}>
            설정
          </h3>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "transparent",
              color: C.inkSoft,
              fontSize: 20,
              lineHeight: 1,
              cursor: "pointer",
              padding: "0 4px",
            }}
          >
            ×
          </button>
        </div>

        {/* 모델 */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>모델</SectionLabel>
          <div style={{ display: "grid", gap: 12 }}>
            <Field label="답변 모델">
              <TextInput
                value={form.chatModel || ""}
                onChange={(e) => set("chatModel", e.target.value)}
              />
            </Field>
            <Field label="임베딩 모델">
              <TextInput
                value={form.embedModel || ""}
                onChange={(e) => set("embedModel", e.target.value)}
              />
            </Field>
            <Field label="요약 모델" hint="요약 전용 모델. 소형 모델 사용 시 3~5배 빠릅니다.">
              <TextInput
                value={form.summaryModel || ""}
                onChange={(e) => set("summaryModel", e.target.value)}
              />
            </Field>
          </div>
        </div>

        <Divider />

        {/* 검색 설정 */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>검색</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="청크 크기 (자)">
              <TextInput
                type="number"
                value={form.maxChunkChars || ""}
                onChange={(e) => set("maxChunkChars", Number(e.target.value))}
              />
            </Field>
            <Field label="검색 결과 수">
              <TextInput
                type="number"
                value={form.topK || ""}
                onChange={(e) => set("topK", Number(e.target.value))}
              />
            </Field>
          </div>
        </div>

        <Divider />

        {/* 고급 기능 토글 */}
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>고급 기능</SectionLabel>
          <div style={{ display: "grid", gap: 8 }}>
            {[
              {
                key: "hydeEnabled",
                label: "HyDE 검색 향상",
                desc: "가상 답변으로 검색 정확도를 높입니다. 추가 LLM 호출이 발생합니다.",
              },
              {
                key: "rerankEnabled",
                label: "LLM 재순위화",
                desc: "검색 결과를 LLM으로 재정렬합니다. 추가 LLM 호출이 발생합니다.",
              },
              {
                key: "memoryEnabled",
                label: "대화 기억",
                desc: "대화 후 중요한 내용을 자동으로 기억해 다음 대화에 활용합니다.",
              },
            ].map(({ key, label, desc }) => (
              <div
                key={key}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  background: C.paper,
                  borderRadius: "var(--radius-sm)",
                  border: `1px solid ${C.line}`,
                  cursor: "pointer",
                }}
                onClick={() => set(key, !form[key])}
              >
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: C.ink, marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 12, color: C.inkSoft, lineHeight: 1.5 }}>{desc}</div>
                </div>
                <Toggle checked={!!form[key]} onChange={(v) => set(key, v)} />
              </div>
            ))}
          </div>
        </div>

        <Divider />

        {/* 시스템 프롬프트 */}
        <div style={{ marginBottom: 6 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <SectionLabel noMargin>시스템 프롬프트</SectionLabel>
            <div style={{ display: "flex", gap: 4 }}>
              {PROMPT_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => set("systemPrompt", p.value)}
                  style={{
                    border: `1px solid ${form.systemPrompt === p.value ? C.accent : C.line}`,
                    background: form.systemPrompt === p.value ? C.accentSoft : "transparent",
                    color: form.systemPrompt === p.value ? C.accent : C.inkSoft,
                    padding: "3px 10px",
                    borderRadius: 99,
                    fontSize: 11.5,
                    cursor: "pointer",
                    fontFamily: sans,
                    fontWeight: form.systemPrompt === p.value ? 600 : 400,
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            value={form.systemPrompt || ""}
            onChange={(e) => set("systemPrompt", e.target.value)}
            rows={4}
            style={{
              width: "100%",
              padding: "9px 11px",
              borderRadius: "var(--radius-sm)",
              border: `1.5px solid ${C.line}`,
              fontFamily: sans,
              fontSize: 13,
              background: C.paper,
              color: C.ink,
              boxSizing: "border-box",
              resize: "vertical",
              lineHeight: 1.6,
              outline: "none",
              transition: "border-color .15s",
            }}
            onFocus={(e) => (e.target.style.borderColor = C.accent)}
            onBlur={(e) => (e.target.style.borderColor = "")}
          />
          <div style={{ fontSize: 11.5, color: C.inkSoft, marginTop: 4 }}>
            AI의 역할·톤을 지정합니다. 빈칸이면 기본값이 사용됩니다.
          </div>
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              border: `1px solid ${C.line}`,
              background: "transparent",
              color: C.inkSoft,
              padding: "8px 18px",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontFamily: sans,
              fontSize: 13.5,
              transition: "all .15s",
            }}
          >
            취소
          </button>
          <button
            onClick={onSave}
            style={{
              border: "none",
              background: C.accent,
              color: "#fff",
              padding: "8px 22px",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontFamily: sans,
              fontSize: 13.5,
              fontWeight: 600,
              transition: "all .15s",
            }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children, noMargin }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: C.inkSoft,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        marginBottom: noMargin ? 0 : 10,
      }}
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.line, margin: "4px 0 18px" }} />;
}
