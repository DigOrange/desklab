// 编辑器工具栏

import { Editor } from '@tiptap/react';
import './EditorToolbar.css';

interface EditorToolbarProps {
  editor: Editor | null;
}

interface ToolButton {
  icon: string;
  title: string;
  action: () => void;
  isActive?: () => boolean;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  if (!editor) return null;

  const tools: ToolButton[] = [
    {
      icon: 'format_bold',
      title: '粗体 (Cmd+B)',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
    },
    {
      icon: 'format_italic',
      title: '斜体 (Cmd+I)',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
    },
    {
      icon: 'strikethrough_s',
      title: '删除线',
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: () => editor.isActive('strike'),
    },
    {
      icon: 'code',
      title: '行内代码',
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive('code'),
    },
  ];

  const headingTools: ToolButton[] = [
    {
      icon: 'title',
      title: '标题 1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive('heading', { level: 1 }),
    },
    {
      icon: 'format_h2',
      title: '标题 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive('heading', { level: 2 }),
    },
    {
      icon: 'format_h3',
      title: '标题 3',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editor.isActive('heading', { level: 3 }),
    },
  ];

  const listTools: ToolButton[] = [
    {
      icon: 'format_list_bulleted',
      title: '无序列表',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
    },
    {
      icon: 'format_list_numbered',
      title: '有序列表',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
    },
    {
      icon: 'checklist',
      title: '任务列表',
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: () => editor.isActive('taskList'),
    },
  ];

  const blockTools: ToolButton[] = [
    {
      icon: 'format_quote',
      title: '引用',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive('blockquote'),
    },
    {
      icon: 'code_blocks',
      title: '代码块',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.isActive('codeBlock'),
    },
    {
      icon: 'horizontal_rule',
      title: '分割线',
      action: () => editor.chain().focus().setHorizontalRule().run(),
    },
  ];

  const insertTools: ToolButton[] = [
    {
      icon: 'gesture',
      title: '插入画布',
      action: () => editor.chain().focus().insertCanvasBlock().run(),
      isActive: () => editor.isActive('canvasBlock'),
    },
  ];

  const renderGroup = (tools: ToolButton[]) => (
    <div className="toolbar-group">
      {tools.map((tool, index) => (
        <button
          key={index}
          className={`toolbar-btn ${tool.isActive?.() ? 'active' : ''}`}
          onClick={tool.action}
          title={tool.title}
        >
          <span className="material-icon">{tool.icon}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="editor-toolbar">
      {renderGroup(tools)}
      <div className="toolbar-divider" />
      {renderGroup(headingTools)}
      <div className="toolbar-divider" />
      {renderGroup(listTools)}
      <div className="toolbar-divider" />
      {renderGroup(blockTools)}
      <div className="toolbar-divider" />
      {renderGroup(insertTools)}
    </div>
  );
}
