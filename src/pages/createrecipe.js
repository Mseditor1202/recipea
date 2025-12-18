import React, { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

const Main = ({ activeNote, onUpdateNote }) => {
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");

  useEffect(() => {
    if (!activeNote) return;
    setDraftTitle(activeNote.title || "");
    setDraftContent(activeNote.content || "");
  }, [activeNote]);

  const onSaveNote = useCallback(() => {
    if (!activeNote) return;
    onUpdateNote({
      ...activeNote,
      title: draftTitle,
      content: draftContent,
      modDate: Date.now(),
    });
  }, [activeNote, draftTitle, draftContent, onUpdateNote]);

  if (!activeNote) {
    return <div className="no-active-note">ノートが選択されていません</div>;
  }

  const isDirty =
    draftTitle !== (activeNote.title || "") ||
    draftContent !== (activeNote.content || "");

  return (
    <div className="app-main">
      <div className="app-main-note-edit">
        <input
          id="title"
          type="text"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          placeholder="タイトル"
        />
        <textarea
          id="content"
          placeholder="ノートの内容を記入"
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
        ></textarea>
        {isDirty && <button onClick={onSaveNote}>保存</button>}
      </div>
      <div className="app-main-note-preview">
        <h1 className="preview-title">{draftTitle}</h1>
        <div className="markdown-preview">
          <ReactMarkdown>{draftContent}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
};

export default Main;
