import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStudioStore } from '../features/studio/stores/studioStore';
import { StudioHeader } from '../features/studio/components/StudioHeader';
import { StudioLayout } from '../features/studio/components/StudioLayout';
import { AiConfigDialog } from '../features/studio/components/AiConfigDialog';
import './StudioPage.css';

export function StudioPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, loading, error, fetchProject, clearProject } = useStudioStore();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
    }
    return () => clearProject();
  }, [projectId, fetchProject, clearProject]);

  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  const handleOpenSettings = useCallback(() => {
    setShowSettings(true);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
  }, []);

  if (loading) {
    return (
      <div className="studio-page">
        <div className="studio-loading">
          <div className="loading-spinner"></div>
          <span>加载中...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="studio-page">
        <div className="studio-error">
          <span className="material-icon error-icon">error_outline</span>
          <p className="error-text">{error || '项目不存在'}</p>
          <button className="back-home-btn" onClick={handleBack}>
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-page">
      <StudioHeader
        project={project}
        onBack={handleBack}
        onSettings={handleOpenSettings}
      />
      <StudioLayout projectId={project.id} />
      <AiConfigDialog isOpen={showSettings} onClose={handleCloseSettings} />
    </div>
  );
}
