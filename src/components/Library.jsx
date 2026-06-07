import { useRef, useState } from "react";
import { C, sans, serif } from "../theme";

function FolderRow({ folder, docs, docsHook, onDrop }) {
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
    renameId,
    renameName,
    setRenameName,
    startRename,
    cancelRename,
    commitRename,
    removeDoc,
    toggleDoc,
    moveDoc,
    folders,
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
        e.preventDefault();
        setDropOver(true);
      }}
      onDragLeave={() => setDropOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropOver(false);
        const docId = e.dataTransfer.getData("docId");
        if (docId) onDrop(docId, folder.id);
      }}
    >
      {/* 폴더 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 10px",
          borderRadius: 9,
          background: dropOver ? C.accentSoft : C.paper2,
          border: `1px solid ${dropOver ? C.accent : C.line}`,
          marginBottom: 4,
          transition: "all .15s",
        }}
      >
        {/* 폴더 전체 선택 버튼 */}
        <button
          onClick={() => toggleFolder(folder.id)}
          title={allSelected ? "폴더 선택 해제" : "폴더 전체 선택"}
          style={{
            width: 16,
            height: 16,
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

        {/* 폴더 아이콘 + 열기/닫기 */}
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            fontSize: 14,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            gap: 4,
            flex: 1,
            minWidth: 0,
            fontFamily: sans,
          }}
        >
          <span>{open ? "📂" : "📁"}</span>
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
              }}
            />
          ) : (
            <span
              style={{
                fontSize: 13,
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
          <span style={{ fontSize: 11, color: C.inkSoft, flexShrink: 0 }}>
            {folderDocs.length}개
          </span>
        </button>

        {/* 폴더 이름 변경 */}
        {renameFolderId !== folder.id && (
          <button
            onClick={() => startRenameFolder(folder)}
            title="이름 변경"
            style={{
              border: "none",
              background: "transparent",
              color: C.inkSoft,
              fontSize: 12,
              cursor: "pointer",
              padding: "0 2px",
              opacity: 0.6,
            }}
          >
            ✎
          </button>
        )}

        {/* 폴더 삭제 */}
        <button
          onClick={() => removeFolder(folder.id)}
          title="폴더 삭제 (파일은 루트로 이동)"
          style={{
            border: "none",
            background: "transparent",
            color: C.inkSoft,
            fontSize: 16,
            lineHeight: 1,
            padding: "0 2px",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      {/* 폴더 내 문서 */}
      {open && (
        <div style={{ paddingLeft: 14, display: "grid", gap: 5, marginBottom: 4 }}>
          {folderDocs.length === 0 && (
            <div style={{ fontSize: 12, color: C.inkSoft, padding: "4px 6px" }}>비어 있음</div>
          )}
          {folderDocs.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              docsHook={docsHook}
              folders={folders}
              renameId={renameId}
              renameName={renameName}
              setRenameName={setRenameName}
              startRename={startRename}
              cancelRename={cancelRename}
              commitRename={commitRename}
              selectedDocs={selectedDocs}
              toggleDoc={toggleDoc}
              removeDoc={removeDoc}
              moveDoc={moveDoc}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocRow({
  doc,
  folders,
  renameId,
  renameName,
  setRenameName,
  startRename,
  cancelRename,
  commitRename,
  selectedDocs,
  toggleDoc,
  removeDoc,
  moveDoc,
}) {
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("docId", doc.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      style={{
        background: C.card,
        borderRadius: 9,
        padding: "8px 10px",
        border: `1px solid ${selectedDocs.has(doc.id) ? C.accent : C.line}`,
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: "grab",
      }}
    >
      {/* 검색 범위 토글 */}
      <button
        onClick={() => toggleDoc(doc.id)}
        title={selectedDocs.has(doc.id) ? "검색 범위 해제" : "이 문서만 검색"}
        style={{
          width: 14,
          height: 14,
          flexShrink: 0,
          padding: 0,
          cursor: "pointer",
          border: `2px solid ${selectedDocs.has(doc.id) ? C.accent : C.line}`,
          borderRadius: "50%",
          background: selectedDocs.has(doc.id) ? C.accent : "transparent",
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
            style={{
              width: "100%",
              padding: "2px 5px",
              border: `1px solid ${C.accent}`,
              borderRadius: 4,
              fontFamily: sans,
              fontSize: 13,
              background: C.card,
            }}
          />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {doc.name}
            </span>
            <button
              onClick={() => startRename(doc)}
              title="이름 변경"
              style={{
                border: "none",
                background: "transparent",
                color: C.inkSoft,
                fontSize: 11,
                cursor: "pointer",
                padding: "0 1px",
                opacity: 0.5,
                flexShrink: 0,
              }}
            >
              ✎
            </button>
          </div>
        )}
        <div style={{ fontSize: 11, color: C.inkSoft }}>{doc.chunkCount}개 조각</div>
      </div>

      {/* 폴더 이동 버튼 */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setShowMoveMenu((v) => !v)}
          title="폴더 이동"
          style={{
            border: "none",
            background: "transparent",
            fontSize: 13,
            cursor: "pointer",
            padding: "0 2px",
            color: C.inkSoft,
            opacity: 0.7,
          }}
        >
          📂
        </button>
        {showMoveMenu && (
          <div
            style={{
              position: "absolute",
              right: 0,
              top: "100%",
              zIndex: 50,
              background: C.card,
              border: `1px solid ${C.line}`,
              borderRadius: 8,
              boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
              minWidth: 130,
              padding: 4,
            }}
          >
            <button
              onClick={() => {
                moveDoc(doc.id, null);
                setShowMoveMenu(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "6px 10px",
                fontSize: 13,
                border: "none",
                background: doc.folderId === null ? C.accentSoft : "transparent",
                cursor: "pointer",
                borderRadius: 5,
                fontFamily: sans,
                color: C.ink,
              }}
            >
              📄 루트
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  moveDoc(doc.id, f.id);
                  setShowMoveMenu(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "6px 10px",
                  fontSize: 13,
                  border: "none",
                  background: doc.folderId === f.id ? C.accentSoft : "transparent",
                  cursor: "pointer",
                  borderRadius: 5,
                  fontFamily: sans,
                  color: C.ink,
                }}
              >
                📁 {f.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 삭제 */}
      <button
        onClick={() => removeDoc(doc.id)}
        title="삭제"
        style={{
          border: "none",
          background: "transparent",
          color: C.inkSoft,
          fontSize: 16,
          lineHeight: 1,
          padding: "0 2px",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        ×
      </button>
    </div>
  );
}

export default function Library({ docs: docsHook, indexing: indexingHook }) {
  const {
    docs,
    folders,
    selectedDocs,
    renameId,
    renameName,
    setRenameName,
    toggleDoc,
    removeDoc,
    startRename,
    cancelRename,
    commitRename,
    moveDoc,
    createFolder,
  } = docsHook;

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

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    await createFolder(name);
    setNewFolderName("");
    setShowNewFolder(false);
  };

  return (
    <section style={{ width: "100%" }}>
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
              border: `2px dashed ${dragging ? C.accent : C.line}`,
              borderRadius: 14,
              padding: "20px 16px",
              textAlign: "center",
              cursor: indexing ? "default" : "pointer",
              marginBottom: 10,
              transition: "all .2s",
              background: dragging ? C.accentSoft : "transparent",
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
              multiple
              accept=".pdf,.txt,.md,.docx"
              style={{ display: "none" }}
              onChange={(e) => uploadFiles(e.target.files)}
            />
          </div>

          {/* 업로드 옵션: 폴더 선택 */}
          <div style={{ marginBottom: 6 }}>
            <select
              value={targetFolderId ?? ""}
              onChange={(e) => setTargetFolderId(e.target.value || null)}
              disabled={indexing}
              style={{
                width: "100%",
                padding: "4px 7px",
                borderRadius: 7,
                border: `1px solid ${C.line}`,
                fontFamily: sans,
                fontSize: 13,
                background: C.card,
                color: C.ink,
                cursor: "pointer",
              }}
            >
              <option value="">📄 루트</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* PDF 페이지 범위 */}
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
            <span style={{ flexShrink: 0 }}>PDF 페이지</span>
            <input
              type="number"
              min={1}
              value={pageFrom}
              onChange={(e) => setPageFrom(e.target.value)}
              placeholder="시작"
              disabled={indexing}
              style={{
                flex: 1,
                minWidth: 0,
                padding: "4px 7px",
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
                flex: 1,
                minWidth: 0,
                padding: "4px 7px",
                borderRadius: 7,
                border: `1px solid ${C.line}`,
                fontFamily: sans,
                fontSize: 13,
                background: C.card,
                outline: "none",
              }}
            />
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
          {/* URL 업로드 폴더 선택 */}
          <div
            style={{
              marginTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 13,
              color: C.inkSoft,
            }}
          >
            <select
              value={targetFolderId ?? ""}
              onChange={(e) => setTargetFolderId(e.target.value || null)}
              disabled={indexing}
              style={{
                padding: "4px 7px",
                borderRadius: 7,
                border: `1px solid ${C.line}`,
                fontFamily: sans,
                fontSize: 13,
                background: C.card,
                color: C.ink,
              }}
            >
              <option value="">📄 루트</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name}
                </option>
              ))}
            </select>
            {indexing && (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
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
        </div>
      )}

      {indexError && (
        <div style={{ color: C.accent, fontSize: 13, marginBottom: 12 }}>{indexError}</div>
      )}

      {/* 새 폴더 만들기 */}
      <div style={{ marginBottom: 10 }}>
        {showNewFolder ? (
          <div style={{ display: "flex", gap: 6 }}>
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
                borderRadius: 8,
                border: `1px solid ${C.accent}`,
                fontFamily: sans,
                fontSize: 13,
                background: C.card,
                outline: "none",
              }}
            />
            <button
              onClick={handleCreateFolder}
              style={{
                border: "none",
                background: C.ink,
                color: C.paper,
                padding: "5px 12px",
                borderRadius: 8,
                fontSize: 13,
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
                padding: "5px 10px",
                borderRadius: 8,
                fontSize: 13,
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
              borderRadius: 8,
              fontSize: 13,
              cursor: "pointer",
              fontFamily: sans,
              width: "100%",
            }}
          >
            + 새 폴더
          </button>
        )}
      </div>

      {/* 문서 검색 */}
      {docs.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <input
            value={docSearch}
            onChange={(e) => setDocSearch(e.target.value)}
            placeholder="자료 검색…"
            style={{
              width: "100%",
              padding: "6px 10px",
              borderRadius: 8,
              border: `1px solid ${C.line}`,
              fontFamily: sans,
              fontSize: 13,
              background: C.card,
              outline: "none",
              boxSizing: "border-box",
              color: C.ink,
            }}
          />
        </div>
      )}

      {/* 자료 목록 */}
      <div style={{ display: "grid", gap: 6 }}>
        {docs.length === 0 && !indexing && (
          <div style={{ color: C.inkSoft, fontSize: 13.5, padding: "8px 2px" }}>
            아직 자료가 없어요. PDF를 추가해 시작하세요.
          </div>
        )}

        {docSearch && filteredDocs.length === 0 && (
          <div style={{ color: C.inkSoft, fontSize: 13, padding: "6px 2px" }}>
            일치하는 자료가 없어요.
          </div>
        )}

        {/* 폴더 */}
        {visibleFolders.map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            docs={filteredDocs}
            docsHook={docsHook}
            onDrop={handleDocDrop}
          />
        ))}

        {/* 루트 문서 (드롭 영역) */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setRootDropOver(true);
          }}
          onDragLeave={() => setRootDropOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setRootDropOver(false);
            const docId = e.dataTransfer.getData("docId");
            if (docId) handleDocDrop(docId, null);
          }}
          style={{
            display: "grid",
            gap: 6,
            borderRadius: 9,
            padding: rootDropOver ? "6px" : "0",
            border: rootDropOver ? `2px dashed ${C.accent}` : "2px dashed transparent",
            transition: "all .15s",
          }}
        >
          {rootDocs.length === 0 && folders.length > 0 && (
            <div
              style={{ fontSize: 12, color: C.inkSoft, padding: "4px 6px", textAlign: "center" }}
            >
              여기로 드래그해서 루트로 이동
            </div>
          )}
          {rootDocs.map((d) => (
            <DocRow
              key={d.id}
              doc={d}
              folders={folders}
              renameId={renameId}
              renameName={renameName}
              setRenameName={setRenameName}
              startRename={startRename}
              cancelRename={cancelRename}
              commitRename={commitRename}
              selectedDocs={selectedDocs}
              toggleDoc={toggleDoc}
              removeDoc={removeDoc}
              moveDoc={moveDoc}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
