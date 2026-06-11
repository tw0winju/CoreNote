import { useRef, useState } from "react";
import { C, sans, shadow } from "../theme";

// ── 폴더 행 ───────────────────────────────────────────────────────────────────
function FolderRow({ folder, docs, docsHook, onDrop, isFolderDragging, onFolderDragStart, onFolderDragEnd }) {
  const {
    selectedDocs,
    toggleFolder,
    removeFolder,
    renameFolderId,
    renameFolderName,
    setRenameFolderName,
    startRenameFolder,
    cancelRenameFolder,
    commitRenameFolder,
  } = docsHook;

  const [open, setOpen] = useState(true);
  const [dropOver, setDropOver] = useState(false);
  const folderDocs = docs.filter((d) => d.folderId === folder.id);
  const selectedCount = folderDocs.filter((d) => selectedDocs.has(d.id)).length;
  const allSelected = folderDocs.length > 0 && selectedCount === folderDocs.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div
      onDragOver={(e) => {
        if (isFolderDragging || e.dataTransfer.types.includes("application/folder")) return;
        e.preventDefault();
        setDropOver(true);
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        if (isFolderDragging || e.dataTransfer.types.includes("application/folder")) return;
        e.preventDefault();
        setDropOver(false);
        const d = e.dataTransfer.getData("docId");
        if (d) onDrop(d, folder.id);
      }}
    >
      {/* 폴더 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 8px",
          borderRadius: "var(--radius-sm)",
          background: dropOver ? C.accentSoft : C.paper2,
          border: `1px solid ${dropOver ? C.accent : C.line}`,
          marginBottom: 4,
          transition: "all .15s",
        }}
      >
        {/* 드래그 핸들 */}
        <div
          draggable
          onDragStart={(e) => { e.stopPropagation(); onFolderDragStart?.(e, folder.id); }}
          onDragEnd={(e) => { e.stopPropagation(); onFolderDragEnd?.(); }}
          title="드래그하여 순서 변경"
          style={{ cursor: "grab", color: C.inkSoft, fontSize: 11, lineHeight: 1, flexShrink: 0, padding: "0 1px", userSelect: "none" }}
        >
          ⠿
        </div>
        {/* 전체 선택 */}
        <button
          onClick={() => toggleFolder(folder.id)}
          title={allSelected ? "해제" : "전체 선택"}
          style={{
            width: 15,
            height: 15,
            flexShrink: 0,
            padding: 0,
            cursor: "pointer",
            border: `2px solid ${allSelected || someSelected ? C.accent : C.line}`,
            borderRadius: "50%",
            background: allSelected ? C.accent : someSelected ? C.accentSoft : "transparent",
            position: "relative",
          }}
        >
          {someSelected && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 9,
                color: C.accent,
                lineHeight: 1,
              }}
            >
              —
            </span>
          )}
        </button>

        {/* 아이콘 + 이름 */}
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            fontSize: 13,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            gap: 4,
            flex: 1,
            minWidth: 0,
            fontFamily: sans,
          }}
        >
          <span style={{ fontSize: 13 }}>{open ? "📂" : "📁"}</span>
          {renameFolderId === folder.id ? (
            <input
              autoFocus
              value={renameFolderName}
              onChange={(e) => setRenameFolderName(e.target.value)}
              onBlur={commitRenameFolder}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRenameFolder();
                if (e.key === "Escape") cancelRenameFolder();
              }}
              onClick={(e) => e.stopPropagation()}
              style={{
                flex: 1,
                padding: "1px 5px",
                border: `1px solid ${C.accent}`,
                borderRadius: 4,
                fontFamily: sans,
                fontSize: 13,
                background: C.card,
                color: C.ink,
              }}
            />
          ) : (
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: C.ink,
              }}
            >
              {folder.name}
            </span>
          )}
          <span style={{ fontSize: 10.5, color: C.inkSoft, flexShrink: 0 }}>
            {folderDocs.length}
          </span>
        </button>

        {renameFolderId !== folder.id && (
          <IconAction onClick={() => startRenameFolder(folder)} title="이름 변경">
            ✎
          </IconAction>
        )}
        <IconAction onClick={() => removeFolder(folder.id)} title="폴더 삭제">
          ×
        </IconAction>
      </div>

      {open && (
        <div style={{ paddingLeft: 12, display: "grid", gap: 4, marginBottom: 4 }}>
          {folderDocs.length === 0 && (
            <div style={{ fontSize: 12, color: C.inkSoft, padding: "3px 6px" }}>비어 있음</div>
          )}
          {folderDocs.map((d) => (
            <DocRow key={d.id} doc={d} docsHook={docsHook} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── 문서 행 ───────────────────────────────────────────────────────────────────
function DocRow({ doc, docsHook }) {
  const {
    selectedDocs,
    toggleDoc,
    removeDoc,
    moveDoc,
    folders,
    renameId,
    renameName,
    setRenameName,
    startRename,
    cancelRename,
    commitRename,
  } = docsHook;

  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const selected = selectedDocs.has(doc.id);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("docId", doc.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => toggleDoc(doc.id)}
      style={{
        background: selected ? C.accentSoft : C.card,
        borderRadius: "var(--radius-sm)",
        padding: "8px 10px",
        border: `1px solid ${selected ? C.accent : C.line}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "pointer",
        transition: "all .12s",
        boxShadow: selected ? `0 0 0 2px ${C.accentSoft}` : shadow.xs,
      }}
    >
      {/* 선택 원형 */}
      <div
        style={{
          width: 14,
          height: 14,
          flexShrink: 0,
          border: `2px solid ${selected ? C.accent : C.line}`,
          borderRadius: "50%",
          background: selected ? C.accent : "transparent",
          transition: "all .12s",
        }}
      />

      <div style={{ minWidth: 0, flex: 1 }}>
        {renameId === doc.id ? (
          <input
            autoFocus
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") cancelRename();
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              padding: "2px 5px",
              border: `1px solid ${C.accent}`,
              borderRadius: 4,
              fontFamily: sans,
              fontSize: 12.5,
              background: C.card,
              color: C.ink,
            }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                color: selected ? C.accent : C.ink,
              }}
            >
              {doc.name}
            </span>
            <IconAction
              onClick={(e) => {
                e.stopPropagation();
                startRename(doc);
              }}
              title="이름 변경"
              small
            >
              ✎
            </IconAction>
          </div>
        )}
        <div style={{ fontSize: 10.5, color: C.inkSoft, marginTop: 1 }}>
          {doc.chunkCount}개 조각
        </div>
      </div>

      {/* 폴더 이동 */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <IconAction
          onClick={(e) => {
            e.stopPropagation();
            setShowMoveMenu((v) => !v);
          }}
          title="폴더 이동"
        >
          📂
        </IconAction>
        {showMoveMenu && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "100%",
              zIndex: 50,
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: "var(--radius-sm)",
              boxShadow: shadow.md,
              minWidth: 130,
              padding: 4,
            }}
          >
            <MoveItem
              label="📄 루트"
              active={doc.folderId === null}
              onClick={(e) => {
                e.stopPropagation();
                moveDoc(doc.id, null);
                setShowMoveMenu(false);
              }}
            />
            {folders.map((f) => (
              <MoveItem
                key={f.id}
                label={`📁 ${f.name}`}
                active={doc.folderId === f.id}
                onClick={(e) => {
                  e.stopPropagation();
                  moveDoc(doc.id, f.id);
                  setShowMoveMenu(false);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* 삭제 */}
      <IconAction
        onClick={(e) => {
          e.stopPropagation();
          removeDoc(doc.id);
        }}
        title="삭제"
      >
        ×
      </IconAction>
    </div>
  );
}

function MoveItem({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "6px 10px",
        fontSize: 12.5,
        border: "none",
        background: active ? C.accentSoft : "transparent",
        color: active ? C.accent : C.ink,
        cursor: "pointer",
        borderRadius: 5,
        fontFamily: sans,
      }}
    >
      {label}
    </button>
  );
}

function IconAction({ children, onClick, title, small }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        border: "none",
        background: "transparent",
        color: C.inkSoft,
        fontSize: small ? 11 : 14,
        lineHeight: 1,
        cursor: "pointer",
        padding: small ? "0 1px" : "0 2px",
        opacity: 0.55,
        flexShrink: 0,
        transition: "opacity .12s",
      }}
    >
      {children}
    </button>
  );
}

// ── Library ───────────────────────────────────────────────────────────────────
export default function Library({ docs: docsHook, indexing: indexingHook }) {
  const { docs, folders, moveDoc, createFolder } = docsHook;

  const {
    indexing,
    indexError,
    spinnerMsg,
    uploadMode,
    setUploadMode,
    urlInput,
    setUrlInput,
    uploadFiles,
    uploadUrl,
    pageFrom,
    setPageFrom,
    pageTo,
    setPageTo,
    targetFolderId,
    setTargetFolderId,
  } = indexingHook;

  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [rootDropOver, setRootDropOver] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [docSearch, setDocSearch] = useState("");
  const [folderDragId, setFolderDragId] = useState(null);
  const [folderOverIdx, setFolderOverIdx] = useState(null);

  const searchLower = docSearch.toLowerCase();
  const filteredDocs = docSearch
    ? docs.filter((d) => d.name.toLowerCase().includes(searchLower))
    : docs;
  const rootDocs = filteredDocs.filter((d) => !d.folderId);
  const visibleFolders = docSearch
    ? folders.filter(
        (f) =>
          f.name.toLowerCase().includes(searchLower) ||
          filteredDocs.some((d) => d.folderId === f.id),
      )
    : folders;

  const handleDocDrop = (docId, folderId) => moveDoc(docId, folderId);

  const handleFolderDragStart = (e, folderId) => {
    e.dataTransfer.setData("application/folder", folderId);
    e.dataTransfer.effectAllowed = "move";
    setFolderDragId(folderId);
  };

  const handleFolderDragEnd = () => {
    setFolderDragId(null);
    setFolderOverIdx(null);
  };

  const handleFolderReorder = (e, idx) => {
    const draggedId = e.dataTransfer.getData("application/folder");
    if (!draggedId) return;
    e.preventDefault();
    const from = visibleFolders.findIndex((f) => f.id === draggedId);
    const to = folderOverIdx ?? idx;
    if (from !== -1 && to !== from && to !== from + 1) {
      const next = [...visibleFolders];
      const [removed] = next.splice(from, 1);
      next.splice(from < to ? to - 1 : to, 0, removed);
      docsHook.reorderFolders(next.map((f) => f.id));
    }
    setFolderDragId(null);
    setFolderOverIdx(null);
  };

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    await createFolder(name);
    setNewFolderName("");
    setShowNewFolder(false);
  };

  return (
    <section style={{ width: "100%" }}>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 14,
        }}
      >
        <h2 style={{ fontFamily: sans, fontSize: 14, fontWeight: 700, margin: 0, color: C.ink }}>
          내 자료
          <span style={{ fontWeight: 400, color: C.inkSoft, fontSize: 12.5, marginLeft: 5 }}>
            {docs.length}개
          </span>
        </h2>
      </div>

      {/* 업로드 모드 탭 */}
      <div
        style={{
          display: "flex",
          background: C.paper2,
          borderRadius: "var(--radius-sm)",
          padding: 3,
          marginBottom: 12,
          gap: 2,
        }}
      >
        {[
          ["file", "파일"],
          ["url", "URL"],
        ].map(([mode, label]) => (
          <button
            key={mode}
            onClick={() => setUploadMode(mode)}
            style={{
              flex: 1,
              border: "none",
              background: uploadMode === mode ? C.card : "transparent",
              color: uploadMode === mode ? C.ink : C.inkSoft,
              borderRadius: 6,
              padding: "5px 0",
              fontSize: 12.5,
              fontWeight: uploadMode === mode ? 600 : 400,
              cursor: "pointer",
              fontFamily: sans,
              boxShadow: uploadMode === mode ? shadow.xs : "none",
              transition: "all .15s",
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
            onDragOver={(e) => {
              e.preventDefault();
              if (!indexing) setDragging(true);
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              if (!indexing) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (!indexing) uploadFiles(e.dataTransfer.files);
            }}
            className="zone"
            style={{
              border: `1.5px dashed ${dragging ? C.accent : C.line}`,
              borderRadius: "var(--radius-md)",
              padding: "18px 14px",
              textAlign: "center",
              cursor: indexing ? "default" : "pointer",
              marginBottom: 10,
              transition: "all .2s",
              background: dragging ? C.accentSoft : C.paper,
            }}
          >
            {indexing ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  color: C.inkSoft,
                  fontSize: 13.5,
                }}
              >
                <span
                  className="spin"
                  style={{
                    width: 16,
                    height: 16,
                    border: `2px solid ${C.accentSoft}`,
                    borderTopColor: C.accent,
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                {spinnerMsg}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 24, marginBottom: 6, opacity: 0.5 }}>📎</div>
                <div style={{ color: C.accent, fontWeight: 600, fontSize: 13.5 }}>자료 추가</div>
                <div style={{ fontSize: 12, color: C.inkSoft, marginTop: 3 }}>
                  PDF · TXT · MD · DOCX
                </div>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.txt,.md,.docx"
              style={{ display: "none" }}
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </div>

          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            <StyledSelect
              value={targetFolderId ?? ""}
              onChange={(e) => setTargetFolderId(e.target.value || null)}
              disabled={indexing}
            >
              <option value="">📄 루트</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </StyledSelect>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 14,
              fontSize: 12.5,
              color: C.inkSoft,
            }}
          >
            <span style={{ flexShrink: 0 }}>PDF 페이지</span>
            <PageInput
              value={pageFrom}
              onChange={(e) => setPageFrom(e.target.value)}
              placeholder="시작"
              disabled={indexing}
            />
            <span>~</span>
            <PageInput
              value={pageTo}
              onChange={(e) => setPageTo(e.target.value)}
              placeholder="끝"
              disabled={indexing}
            />
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6 }}>
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
                padding: "8px 11px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${C.line}`,
                fontFamily: sans,
                fontSize: 13,
                background: C.paper,
                color: C.ink,
                outline: "none",
              }}
            />
            <button
              onClick={uploadUrl}
              disabled={indexing || !urlInput.trim()}
              style={{
                border: "none",
                background: indexing || !urlInput.trim() ? C.line : C.accent,
                color: indexing || !urlInput.trim() ? C.inkSoft : "#fff",
                padding: "8px 14px",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                cursor: indexing || !urlInput.trim() ? "default" : "pointer",
                fontFamily: sans,
              }}
            >
              {indexing ? "…" : "추가"}
            </button>
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <StyledSelect
              value={targetFolderId ?? ""}
              onChange={(e) => setTargetFolderId(e.target.value || null)}
              disabled={indexing}
            >
              <option value="">📄 루트</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </StyledSelect>
            {indexing && (
              <span
                style={{
                  fontSize: 12.5,
                  color: C.inkSoft,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span
                  className="spin"
                  style={{
                    width: 12,
                    height: 12,
                    border: `2px solid ${C.accentSoft}`,
                    borderTopColor: C.accent,
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
                {spinnerMsg}
              </span>
            )}
          </div>
        </div>
      )}

      {indexError && (
        <div
          style={{
            color: C.error,
            fontSize: 12.5,
            marginBottom: 10,
            padding: "6px 10px",
            background: C.errorSoft,
            borderRadius: "var(--radius-sm)",
            border: `1px solid ${C.errorLine}`,
          }}
        >
          {indexError}
        </div>
      )}

      {/* 새 폴더 */}
      <div style={{ marginBottom: 10 }}>
        {showNewFolder ? (
          <div style={{ display: "flex", gap: 5 }}>
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateFolder();
                if (e.key === "Escape") {
                  setShowNewFolder(false);
                  setNewFolderName("");
                }
              }}
              placeholder="폴더 이름"
              style={{
                flex: 1,
                padding: "5px 9px",
                borderRadius: "var(--radius-sm)",
                border: `1px solid ${C.accent}`,
                fontFamily: sans,
                fontSize: 12.5,
                background: C.card,
                color: C.ink,
                outline: "none",
              }}
            />
            <button
              onClick={handleCreateFolder}
              style={{
                border: "none",
                background: C.accent,
                color: "#fff",
                padding: "5px 11px",
                borderRadius: "var(--radius-sm)",
                fontSize: 12.5,
                cursor: "pointer",
                fontFamily: sans,
              }}
            >
              만들기
            </button>
            <button
              onClick={() => {
                setShowNewFolder(false);
                setNewFolderName("");
              }}
              style={{
                border: `1px solid ${C.line}`,
                background: "transparent",
                color: C.inkSoft,
                padding: "5px 9px",
                borderRadius: "var(--radius-sm)",
                fontSize: 12.5,
                cursor: "pointer",
                fontFamily: sans,
              }}
            >
              취소
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewFolder(true)}
            style={{
              border: `1px dashed ${C.line}`,
              background: "transparent",
              color: C.inkSoft,
              padding: "5px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: 12.5,
              cursor: "pointer",
              fontFamily: sans,
              width: "100%",
              transition: "all .15s",
            }}
          >
            + 새 폴더
          </button>
        )}
      </div>

      {/* 문서 검색 */}
      {docs.length > 0 && (
        <div style={{ marginBottom: 10, position: "relative" }}>
          <span
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              fontSize: 13,
              color: C.inkSoft,
              pointerEvents: "none",
            }}
          >
            🔍
          </span>
          <input
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            placeholder="자료 검색…"
            style={{
              width: "100%",
              padding: "6px 10px 6px 30px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${C.line}`,
              fontFamily: sans,
              fontSize: 12.5,
              background: C.paper,
              color: C.ink,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>
      )}

      {/* 자료 목록 */}
      <div style={{ display: "grid", gap: 5 }}>
        {docs.length === 0 && !indexing && (
          <div
            style={{
              color: C.inkSoft,
              fontSize: 13,
              padding: "12px 2px",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8, opacity: 0.4 }}>📂</div>
            PDF를 추가해 시작하세요.
          </div>
        )}
        {docSearch && filteredDocs.length === 0 && (
          <div style={{ color: C.inkSoft, fontSize: 12.5, padding: "6px 2px" }}>
            일치하는 자료가 없어요.
          </div>
        )}

        {visibleFolders.map((folder, idx) => (
          <div
            key={folder.id}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes("application/folder")) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              setFolderOverIdx(e.clientY < rect.top + rect.height / 2 ? idx : idx + 1);
            }}
            onDrop={(e) => handleFolderReorder(e, idx)}
          >
            {folderDragId && folderOverIdx === idx && (
              <div style={{ height: 2, background: C.accent, borderRadius: 1, marginBottom: 3 }} />
            )}
            <div style={{ opacity: folderDragId === folder.id ? 0.4 : 1 }}>
              <FolderRow
                folder={folder}
                docs={filteredDocs}
                docsHook={docsHook}
                onDrop={handleDocDrop}
                isFolderDragging={!!folderDragId}
                onFolderDragStart={handleFolderDragStart}
                onFolderDragEnd={handleFolderDragEnd}
              />
            </div>
          </div>
        ))}
        {folderDragId && folderOverIdx === visibleFolders.length && (
          <div style={{ height: 2, background: C.accent, borderRadius: 1, marginBottom: 3 }} />
        )}

        <div
          onDragOver={(e) => {
            if (e.dataTransfer.types.includes("application/folder")) return;
            e.preventDefault();
            setRootDropOver(true);
          }}
          onDragLeave={() => setRootDropOver(false)}
          onDrop={(e) => {
            if (e.dataTransfer.types.includes("application/folder")) return;
            e.preventDefault();
            setRootDropOver(false);
            const d = e.dataTransfer.getData("docId");
            if (d) handleDocDrop(d, null);
          }}
          style={{
            display: "grid",
            gap: 4,
            borderRadius: "var(--radius-sm)",
            padding: rootDropOver ? 5 : 0,
            border: rootDropOver ? `1.5px dashed ${C.accent}` : "1.5px dashed transparent",
            transition: "all .15s",
          }}
        >
          {rootDocs.length === 0 && folders.length > 0 && (
            <div
              style={{ fontSize: 11.5, color: C.inkSoft, padding: "4px 6px", textAlign: "center" }}
            >
              드래그해서 루트로 이동
            </div>
          )}
          {rootDocs.map((d) => (
            <DocRow key={d.id} doc={d} docsHook={docsHook} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StyledSelect({ children, ...props }) {
  return (
    <select
      {...props}
      style={{
        width: "100%",
        padding: "5px 8px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${C.line}`,
        fontFamily: sans,
        fontSize: 12.5,
        background: C.paper,
        color: C.ink,
        cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

function PageInput(props) {
  return (
    <input
      type="number"
      min={1}
      {...props}
      style={{
        flex: 1,
        minWidth: 0,
        padding: "5px 7px",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${C.line}`,
        fontFamily: sans,
        fontSize: 12.5,
        background: C.paper,
        color: C.ink,
        outline: "none",
      }}
    />
  );
}
