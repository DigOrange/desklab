// 笔记编辑器

import { useEffect, useState, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';

import { CanvasBlock } from '../extensions/CanvasBlock';
import { useNoteStore } from '../stores/noteStore';
import { useAutoSave } from '../hooks/useAutoSave';
import { useMermaidRenderer } from '../hooks/useMermaidRenderer';
import { useAiEdit } from '../hooks/useAiEdit';
import { EditorToolbar } from './EditorToolbar';
import { SearchBar } from './SearchBar';
import { StatusBar } from './StatusBar';
import { AiEditBubble } from './AiEditBubble';
import { AiEditPreview } from './AiEditPreview';
import { markdownToHtml, htmlToMarkdown } from '../utils/markdown';
import { exportNoteWithDialog, ExportFormatInfo } from '../../../services/export';
import './NoteEditor.css';

const lowlight = createLowlight(common);

interface NoteEditorProps {
  noteId: string;
  onClose?: () => void;
}

export function NoteEditor({ noteId, onClose }: NoteEditorProps) {
  const {
    note,
    content,
    saveStatus,
    isDirty,
    lastSaved,
    loadNote,
    updateContent,
    saveNote,
    renameNote,
  } = useNoteStore();
  const [wordCount, setWordCount] = useState(0);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const initialLoadDoneRef = useRef(false); // 用于 onUpdate 回调中访问最新值
  const [showSearch, setShowSearch] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 导出格式
  const exportFormats: ExportFormatInfo[] = [
    { id: 'markdown', name: 'Markdown', extension: 'md', description: '纯文本 Markdown 格式' },
    { id: 'pdf', name: 'PDF', extension: 'pdf', description: '便携式文档格式' },
    { id: 'docx', name: 'Word', extension: 'docx', description: 'Microsoft Word 格式' },
  ];

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
      }),
      Placeholder.configure({
        placeholder: '开始输入...',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      CodeBlockLowlight.configure({
        lowlight,
      }),
      CanvasBlock,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // 使用 ref 来访问最新值，避免闭包陷阱
      if (!initialLoadDoneRef.current) return;

      const html = editor.getHTML();
      const markdown = htmlToMarkdown(html);
      updateContent(markdown);

      // 更新字数统计
      const text = editor.getText();
      setWordCount(text.length);
    },
  });

  // 加载笔记
  useEffect(() => {
    setInitialLoadDone(false);
    initialLoadDoneRef.current = false;
    loadNote(noteId);
  }, [noteId, loadNote]);

  // 内容加载后设置编辑器
  useEffect(() => {
    // 等待 note 加载完成后再设置编辑器内容
    // 必须检查 note.id === noteId 确保是当前笔记，避免竞态条件
    // （切换笔记时，旧的 note 数据可能还在，loadNote 是异步的）
    if (editor && note && note.id === noteId && !initialLoadDone) {
      if (content) {
        const html = markdownToHtml(content);
        editor.commands.setContent(html);
        setWordCount(editor.getText().length);
      }
      setInitialLoadDone(true);
      initialLoadDoneRef.current = true;
    }
  }, [editor, note, noteId, content, initialLoadDone]);

  // 自动保存
  const handleSave = useCallback(
    async (id: string, c: string) => {
      await saveNote(id, c);
    },
    [saveNote]
  );

  useAutoSave(noteId, content, isDirty, handleSave);

  // Mermaid 图表渲染
  useMermaidRenderer(editor);

  // AI 编辑功能
  const aiEdit = useAiEdit({ editor });

  // 开始编辑标题
  const handleStartEditTitle = useCallback(() => {
    setEditTitle(note?.title || '');
    setIsEditingTitle(true);
  }, [note?.title]);

  // 保存标题
  const handleSaveTitle = useCallback(async () => {
    const newTitle = editTitle.trim();
    if (newTitle && newTitle !== note?.title) {
      await renameNote(noteId, newTitle);
    }
    setIsEditingTitle(false);
  }, [editTitle, note?.title, noteId, renameNote]);

  // 标题编辑键盘处理
  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleSaveTitle();
      }
      if (e.key === 'Escape') {
        setIsEditingTitle(false);
      }
    },
    [handleSaveTitle]
  );

  // 导出笔记
  const handleExport = useCallback(async (format: ExportFormatInfo) => {
    if (!note) return;

    setExporting(true);
    setShowExportMenu(false);

    try {
      const success = await exportNoteWithDialog(noteId, format, note.title);
      if (success) {
        console.log(`笔记已导出为 ${format.name}`);
      }
    } catch (e) {
      console.error('导出失败:', e);
    }

    setExporting(false);
  }, [note, noteId]);

  // 点击外部关闭导出菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };

    if (showExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showExportMenu]);

  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+S 保存
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (noteId && content) {
          saveNote(noteId, content);
        }
      }
      // Cmd+F 搜索
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      // Escape 关闭搜索
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [noteId, content, saveNote, showSearch]);

  if (!editor) return null;

  return (
    <div className="note-editor">
      <div className="note-editor-header">
        <div className="note-title">
          <span className="material-icon">description</span>
          {isEditingTitle ? (
            <input
              type="text"
              className="title-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={handleTitleKeyDown}
              autoFocus
            />
          ) : (
            <span
              className="title-text"
              onClick={handleStartEditTitle}
              title="点击编辑标题"
            >
              {note?.title || '未命名笔记'}
            </span>
          )}
        </div>
        <div className="header-actions">
          <div className="export-wrapper" ref={exportMenuRef}>
            <button
              className="header-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={exporting}
              title="导出笔记"
            >
              <span className="material-icon">{exporting ? 'hourglass_empty' : 'download'}</span>
            </button>
            {showExportMenu && (
              <div className="export-menu">
                <div className="export-menu-title">导出为</div>
                {exportFormats.map((format) => (
                  <button
                    key={format.id}
                    className="export-menu-item"
                    onClick={() => handleExport(format)}
                  >
                    <span className="format-name">{format.name}</span>
                    <span className="format-ext">.{format.extension}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            className="header-btn"
            onClick={() => setShowSearch(!showSearch)}
            title="搜索 (Cmd+F)"
          >
            <span className="material-icon">search</span>
          </button>
          {onClose && (
            <button className="close-btn" onClick={onClose} title="关闭">
              <span className="material-icon">close</span>
            </button>
          )}
        </div>
      </div>
      <EditorToolbar editor={editor} />
      {showSearch && (
        <SearchBar editor={editor} onClose={() => setShowSearch(false)} />
      )}
      <div className="editor-content-wrapper">
        <EditorContent editor={editor} className="editor-content" />
      </div>
      <StatusBar
        saveStatus={saveStatus}
        wordCount={wordCount}
        lastSaved={lastSaved}
      />

      {/* AI 编辑浮动菜单 */}
      <AiEditBubble
        editor={editor}
        onAiEdit={aiEdit.startEdit}
        disabled={aiEdit.isLoading}
      />

      {/* AI 编辑预览对话框 */}
      <AiEditPreview
        isOpen={aiEdit.isOpen}
        action={aiEdit.action}
        originalText={aiEdit.originalText}
        result={aiEdit.result}
        isLoading={aiEdit.isLoading}
        error={aiEdit.error}
        customPrompt={aiEdit.customPrompt}
        onAccept={aiEdit.accept}
        onReject={aiEdit.reject}
        onRegenerate={aiEdit.regenerate}
        onClose={aiEdit.close}
        onCustomPromptChange={aiEdit.setCustomPrompt}
      />
    </div>
  );
}
