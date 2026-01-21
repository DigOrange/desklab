import { useState } from 'react';
import { Dialog } from '../../../components/common/Dialog';
import { IconPicker } from './IconPicker';
import { CreateProjectData, ProjectIcon, Workspace } from '../../../types';
import { DEFAULT_ICON } from '../../../data/icons';
import './CreateProjectDialog.css';

interface CreateProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: CreateProjectData) => Promise<void>;
  workspaces: Workspace[];
}

export function CreateProjectDialog({
  open,
  onClose,
  onSubmit,
  workspaces,
}: CreateProjectDialogProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<ProjectIcon>(DEFAULT_ICON);
  const [workspace, setWorkspace] = useState('default');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setName('');
    setIcon(DEFAULT_ICON);
    setWorkspace('default');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('请输入项目名称');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({ name: name.trim(), icon, workspace });
      handleClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} title="新建项目">
      <div className="create-project-form">
        <div className="form-row">
          <IconPicker value={icon} onChange={setIcon} />
          <div className="form-field flex-1">
            <label>项目名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={handleKeyDown}
              placeholder="输入项目名称"
              autoFocus
              className={error ? 'error' : ''}
            />
            {error && <span className="error-text">{error}</span>}
          </div>
        </div>

        <div className="form-field">
          <label>工作空间</label>
          <select
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name}
              </option>
            ))}
          </select>
        </div>

        <div className="dialog-actions">
          <button type="button" className="btn-secondary" onClick={handleClose}>
            取消
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? '创建中...' : '创建'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
