import { useRef } from "react";
import { C, sans, serif } from "../theme";

export default function Library({ docs: docsHook, indexing: indexingHook }) {
  const {
    docs,
    selectedDocs,
    renameId,
    renameName,
    setRenameName,
    toggleDoc,
    removeDoc,
    startRename,
    cancelRename,
    commitRename,
  } = docsHook;

  const {
    indexing,
    indexError,
    spinnerMsg,
    uploadMode,
    setUploadMode,
    urlInput,
    setUrlInput,
    uploadFile,
    uploadUrl,
    pageFrom,
    setPageFrom,
    pageTo,
    setPageTo,
  } = indexingHook;

  const inputRef = useRef(null);

  return (
    <section style={{ flex: "1 1 300px", minWidth: 280 }}>
      <h2
        style={{
          fontFamily: serif,
          fontSize: 18,
          fontWeight: 700,
          margin: "0 0 12px",
          display: "flex",
          alignItems: "center",
          gap: 9,
        }}
      >
        <span style={{ width: 6, height: 17, background: C.accent, borderRadius: 3 }} />내 자료 (
        {docs.length})
      </h2>

      {/* 업로드 모드 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[
          ["file", "파일"],
          ["url", "URL"],
        ].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setUploadMode(mode)}
            style={{
              border: `1px solid ${uploadMode === mode ? C.accent : C.line}`,
              background: uploadMode === mode ? C.accentSoft : "transparent",
              color: uploadMode === mode ? C.accent : C.inkSoft,
              borderRadius: 8,
              padding: "4px 12px",
              fontSize: 13,
              cursor: "pointer",
              fontFamily: sans,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 파일 업로드 */}
      {uploadMode === "file" ? (
        <>
          <div
            onClick={() => !indexing && inputRef.current?.click()}
            className="zone"
            style={{
              border: `2px dashed ${C.line}`,
              borderRadius: 14,
              padding: "20px 16px",
              textAlign: "center",
              cursor: indexing ? "default" : "pointer",
              marginBottom: 14,
              transition: "all .2s",
            }}
          >
            {indexing ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  color: C.inkSoft,
                  fontSize: 14,
                }}
              >
                <span
                  className="spin"
                  style={{
                    width: 18,
                    height: 18,
                    border: `2px solid ${C.accentSoft}`,
                    borderTopColor: C.accent,
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                {spinnerMsg}
              </div>
            ) : (
              <div style={{ color: C.inkSoft, fontSize: 14 }}>
                <b style={{ color: C.accent }}>＋ 자료 추가</b>
                <div style={{ fontSize: 12.5, marginTop: 3 }}>PDF · TXT · MD · DOCX</div>
              </div>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.txt,.md,.docx"
              style={{ display: "none" }}
              onChange={(e) => uploadFile(e.target.files[0])}
            />
          </div>
          {/* PDF 페이지 범위 (선택) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 14,
              fontSize: 13,
              color: C.inkSoft,
            }}
          >
            <span>PDF 페이지</span>
            <input
              type="number"
              min={1}
              value={pageFrom}
              onChange={(e) => setPageFrom(e.target.value)}
              placeholder="시작"
              disabled={indexing}
              style={{
                width: 58,
                padding: "4px 8px",
                borderRadius: 7,
                border: `1px solid ${C.line}`,
                fontFamily: sans,
                fontSize: 13,
                background: C.card,
                outline: "none",
              }}
            />
            <span>~</span>
            <input
              type="number"
              min={1}
              value={pageTo}
              onChange={(e) => setPageTo(e.target.value)}
              placeholder="끝"
              disabled={indexing}
              style={{
                width: 58,
                padding: "4px 8px",
                borderRadius: 7,
                border: `1px solid ${C.line}`,
                fontFamily: sans,
                fontSize: 13,
                background: C.card,
                outline: "none",
              }}
            />
            <span style={{ fontSize: 12 }}>선택</span>
          </div>
        </>
      ) : (
        /* URL 색인 */
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !indexing) uploadUrl();
              }}
              placeholder="https://…"
              disabled={indexing}
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: 10,
                border: `1px solid ${C.line}`,
                fontFamily: sans,
                fontSize: 13.5,
                background: C.card,
                outline: "none",
              }}
            />
            <button
              onClick={uploadUrl}
              disabled={indexing || !urlInput.trim()}
              style={{
                border: "none",
                background: indexing || !urlInput.trim() ? C.line : C.ink,
                color: C.paper,
                padding: "9px 14px",
                borderRadius: 10,
                fontSize: 13.5,
                cursor: indexing || !urlInput.trim() ? "default" : "pointer",
                fontFamily: sans,
              }}
            >
              {indexing ? "…" : "추가"}
            </button>
          </div>
          {indexing && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                color: C.inkSoft,
                fontSize: 13,
                marginTop: 8,
              }}
            >
              <span
                className="spin"
                style={{
                  width: 14,
                  height: 14,
                  border: `2px solid ${C.accentSoft}`,
                  borderTopColor: C.accent,
                  borderRadius: "50%",
                  display: "inline-block",
                }}
              />
              {spinnerMsg}
            </div>
          )}
        </div>
      )}

      {indexError && (
        <div style={{ color: C.accent, fontSize: 13, marginBottom: 12 }}>{indexError}</div>
      )}

      {/* 문서 목록 */}
      <div style={{ display: "grid", gap: 8 }}>
        {docs.length === 0 && !indexing && (
          <div style={{ color: C.inkSoft, fontSize: 13.5, padding: "8px 2px" }}>
            아직 자료가 없어요. PDF를 추가해 시작하세요.
          </div>
        )}
        {docs.map((d) => (
          <div
            key={d.id}
            style={{
              background: C.card,
              borderRadius: 10,
              padding: "11px 13px",
              border: `1px solid ${selectedDocs.has(d.id) ? C.accent : C.line}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            {/* 문서 범위 선택 토글 */}
            <button
              onClick={() => toggleDoc(d.id)}
              title={selectedDocs.has(d.id) ? "검색 범위 해제" : "이 문서만 검색"}
              style={{
                width: 16,
                height: 16,
                flexShrink: 0,
                padding: 0,
                cursor: "pointer",
                border: `2px solid ${selectedDocs.has(d.id) ? C.accent : C.line}`,
                borderRadius: "50%",
                background: selectedDocs.has(d.id) ? C.accent : "transparent",
              }}
            />

            <div style={{ minWidth: 0, flex: 1 }}>
              {/* 인라인 이름 변경 */}
              {renameId === d.id ? (
                <input
                  autoFocus
                  value={renameName}
                  onChange={(e) => setRenameName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") cancelRename();
                  }}
                  style={{
                    width: "100%",
                    padding: "2px 6px",
                    border: `1px solid ${C.accent}`,
                    borderRadius: 5,
                    fontFamily: sans,
                    fontSize: 14,
                    background: C.card,
                  }}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 500,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.name}
                  </span>
                  <button
                    onClick={() => startRename(d)}
                    title="이름 변경"
                    style={{
                      border: "none",
                      background: "transparent",
                      color: C.inkSoft,
                      fontSize: 12,
                      cursor: "pointer",
                      padding: "0 2px",
                      opacity: 0.5,
                      lineHeight: 1,
                      flexShrink: 0,
                    }}
                  >
                    ✎
                  </button>
                </div>
              )}
              <div style={{ fontSize: 12, color: C.inkSoft }}>{d.chunkCount}개 조각</div>
            </div>

            <button
              onClick={() => removeDoc(d.id)}
              title="삭제"
              style={{
                border: "none",
                background: "transparent",
                color: C.inkSoft,
                fontSize: 18,
                lineHeight: 1,
                padding: 4,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
