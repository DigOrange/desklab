import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjectStore, useFilteredProjects } from '../features/project/stores/projectStore';
import { useWorkspaceStore } from '../features/workspace/stores/workspaceStore';
import { WorkspaceSidebar } from '../features/workspace/components/WorkspaceSidebar';
import { ProjectGrid } from '../features/project/components/ProjectGrid';
import { EmptyState } from '../features/project/components/EmptyState';
import { CreateProjectDialog } from '../features/project/components/CreateProjectDialog';
import { SearchDialog } from '../components/search/SearchDialog';
import { Dialog } from '../components/common/Dialog';
import { useSearchShortcut } from '../hooks/useSearchShortcut';
import { CreateProjectData } from '../types';
import './HomePage.css';

export function HomePage() {
  const navigate = useNavigate();
  const {
    loading,
    error,
    activeWorkspace,
    fetchProjects,
    createProject,
    renameProject,
    deleteProject,
    toggleStar,
    setActiveWorkspace,
  } = useProjectStore();

  const { workspaces, recentAccesses, fetchWorkspaces, fetchRecentAccesses } = useWorkspaceStore();
  const filteredProjects = useFilteredProjects();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSearchDialog, setShowSearchDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // 全局搜索快捷键 Cmd+K / Ctrl+K
  useSearchShortcut(useCallback(() => setShowSearchDialog(true), []));

  useEffect(() => {
    fetchProjects();
    fetchWorkspaces();
    fetchRecentAccesses();
  }, [fetchProjects, fetchWorkspaces, fetchRecentAccesses]);

  const handleCreateProject = async (data: CreateProjectData) => {
    await createProject(data);
  };

  const handleOpenProject = (id: string) => {
    navigate(`/project/${id}`);
  };

  const handleRenameProject = async (id: string, name: string) => {
    try {
      await renameProject(id, name);
    } catch (e) {
      console.error('Rename failed:', e);
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteProject(deleteConfirm);
      setDeleteConfirm(null);
    } catch (e) {
      console.error('Delete failed:', e);
    }
  };

  const handleToggleStar = async (id: string) => {
    try {
      await toggleStar(id);
    } catch (e) {
      console.error('Toggle star failed:', e);
    }
  };

  const projectToDelete = deleteConfirm
    ? filteredProjects.find((p) => p.id === deleteConfirm)
    : null;

  return (
    <div className="home-page">
      <WorkspaceSidebar
        workspaces={workspaces}
        activeWorkspace={activeWorkspace}
        onSelectWorkspace={setActiveWorkspace}
        recentAccesses={recentAccesses}
        onOpenProject={handleOpenProject}
      />

      <main className="main-content">
        <header className="content-header">
          <h2 className="content-title">
            {activeWorkspace
              ? workspaces.find((w) => w.id === activeWorkspace)?.name || '全部项目'
              : '全部项目'}
          </h2>
          <button
            className="btn-create"
            onClick={() => setShowCreateDialog(true)}
          >
            + 新建项目
          </button>
        </header>

        {loading ? (
          <div className="loading-state">加载中...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : filteredProjects.length === 0 ? (
          <EmptyState onCreateProject={() => setShowCreateDialog(true)} />
        ) : (
          <ProjectGrid
            projects={filteredProjects}
            onOpen={handleOpenProject}
            onRename={handleRenameProject}
            onDelete={(id) => setDeleteConfirm(id)}
            onToggleStar={handleToggleStar}
          />
        )}
      </main>

      <CreateProjectDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onSubmit={handleCreateProject}
        workspaces={workspaces}
      />

      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="确认删除"
      >
        <div className="delete-confirm">
          <p>
            确定要删除项目 <strong>{projectToDelete?.name}</strong> 吗？
          </p>
          <p className="warning">此操作不可撤销，项目中的所有文件都将被删除。</p>
          <div className="dialog-actions">
            <button
              className="btn-secondary"
              onClick={() => setDeleteConfirm(null)}
            >
              取消
            </button>
            <button className="btn-danger" onClick={handleDeleteProject}>
              删除
            </button>
          </div>
        </div>
      </Dialog>

      <SearchDialog
        open={showSearchDialog}
        onClose={() => setShowSearchDialog(false)}
      />
    </div>
  );
}
