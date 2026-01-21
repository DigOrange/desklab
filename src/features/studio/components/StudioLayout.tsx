import { useState, useCallback } from 'react';
import { usePanelLayout } from '../hooks/usePanelLayout';
import { Panel } from './Panel';
import { CollapsedPanel } from './CollapsedPanel';
import { SourcesPanel } from './SourcesPanel';
import { ChatPanel } from './ChatPanel';
import { WorkspacePanel } from './WorkspacePanel';
import { PanelResizer } from './PanelResizer';
import './StudioLayout.css';

interface StudioLayoutProps {
  projectId: string;
}

// 编辑器打开时的工作区宽度
const EDITOR_EXPANDED_WIDTH = 600;
// 工作区宽度限制
const MIN_WORKSPACE_WIDTH = 280;
const MAX_WORKSPACE_WIDTH = 1200;

export function StudioLayout({ projectId }: StudioLayoutProps) {
  const {
    sourcesCollapsed,
    workspaceCollapsed,
    sourcesWidth,
    workspaceWidth,
    toggleSources,
    toggleWorkspace,
    setWorkspaceWidth,
  } = usePanelLayout();

  const [editorOpen, setEditorOpen] = useState(false);

  // 处理编辑器打开/关闭
  const handleEditorOpen = useCallback((isOpen: boolean) => {
    setEditorOpen(isOpen);
    if (isOpen) {
      // 编辑器打开时，扩展工作区宽度
      setWorkspaceWidth(Math.max(workspaceWidth, EDITOR_EXPANDED_WIDTH));
    }
  }, [workspaceWidth, setWorkspaceWidth]);

  // 计算实际工作区宽度
  const actualWorkspaceWidth = editorOpen
    ? Math.max(workspaceWidth, EDITOR_EXPANDED_WIDTH)
    : workspaceWidth;

  // 处理拖动调整工作区宽度
  const handleWorkspaceResize = useCallback((delta: number) => {
    // 向左拖动（delta 为正）应该增加宽度
    setWorkspaceWidth((prev) => {
      const newWidth = prev + delta;
      return Math.min(MAX_WORKSPACE_WIDTH, Math.max(MIN_WORKSPACE_WIDTH, newWidth));
    });
  }, [setWorkspaceWidth]);

  return (
    <main className="studio-layout">
      {/* 来源面板 */}
      {sourcesCollapsed ? (
        <CollapsedPanel
          position="left"
          label="来源"
          icon="folder_open"
          onExpand={toggleSources}
        />
      ) : (
        <Panel
          className="sources-panel"
          style={{ width: sourcesWidth }}
          title="来源"
          collapsible
          collapseIcon="chevron_left"
          onCollapse={toggleSources}
        >
          <SourcesPanel projectId={projectId} />
        </Panel>
      )}

      {/* 对话面板 - 始终显示，flex-1 */}
      <Panel className="chat-panel" title="对话">
        <ChatPanel projectId={projectId} />
      </Panel>

      {/* 拖动调整工作区宽度 - 仅在工作区展开时显示 */}
      {!workspaceCollapsed && (
        <PanelResizer
          position="right"
          onResize={handleWorkspaceResize}
        />
      )}

      {/* 工作区面板 */}
      {workspaceCollapsed ? (
        <CollapsedPanel
          position="right"
          label="工作区"
          icon="dashboard"
          onExpand={toggleWorkspace}
        />
      ) : (
        <Panel
          className={`workspace-panel ${editorOpen ? 'editor-expanded' : ''}`}
          style={{ width: actualWorkspaceWidth }}
          title="工作区"
          collapsible
          collapseIcon="chevron_right"
          onCollapse={toggleWorkspace}
        >
          <WorkspacePanel projectId={projectId} onEditorOpen={handleEditorOpen} />
        </Panel>
      )}
    </main>
  );
}
