import { useEffect, useCallback, useState, useRef } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useSourcesStore, useFilteredSources } from '../stores/sourcesStore';
import { SourceItem } from './SourceItem';
import { DropZone } from './DropZone';
import { SourcePreview } from './SourcePreview';
import { useFileDrop } from '../hooks/useFileDrop';
import { supportedExtensions } from '../../../types';
import './SourcesPanel.css';

interface SourcesPanelProps {
  projectId: string;
}

export function SourcesPanel({ projectId }: SourcesPanelProps) {
  const {
    sources: allSources,
    selectedIds,
    highlightedId,
    loading,
    importing,
    error,
    searchQuery,
    fetchSources,
    importSources,
    importFolder,
    deleteSource,
    toggleSelect,
    selectAll,
    clearSelection,
    setSearchQuery,
    clearError,
  } = useSourcesStore();

  const sources = useFilteredSources();
  const [activeSourceId, setActiveSourceId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 初始加载
  useEffect(() => {
    fetchSources(projectId);
  }, [projectId, fetchSources]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 引用高亮时同步预览
  useEffect(() => {
    if (highlightedId) {
      setActiveSourceId(highlightedId);
    }
  }, [highlightedId]);

  // 来源变化时维护预览目标
  useEffect(() => {
    if (allSources.length === 0) {
      setActiveSourceId(null);
      return;
    }
    if (!activeSourceId) {
      setActiveSourceId(allSources[0].id);
      return;
    }
    if (!allSources.some((source) => source.id === activeSourceId)) {
      setActiveSourceId(allSources[0].id);
    }
  }, [allSources, activeSourceId]);

  // 处理文件选择
  const handleAddSource = useCallback(async () => {
    setShowDropdown(false);
    try {
      const selected = await open({
        multiple: true,
        filters: [
          {
            name: '支持的文件',
            extensions: supportedExtensions,
          },
        ],
      });

      if (selected && selected.length > 0) {
        await importSources(projectId, selected);
      }
    } catch (e) {
      console.error('选择文件失败:', e);
    }
  }, [projectId, importSources]);

  // 处理文件夹选择
  const handleAddFolder = useCallback(async () => {
    setShowDropdown(false);
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      });

      if (selected) {
        await importFolder(projectId, selected);
      }
    } catch (e) {
      console.error('选择文件夹失败:', e);
    }
  }, [projectId, importFolder]);

  const handleFileDrop = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0 || importing) return;
      try {
        await importSources(projectId, paths);
      } catch (e) {
        console.error('拖拽导入失败:', e);
      }
    },
    [projectId, importing, importSources]
  );

  const { isDragging } = useFileDrop(handleFileDrop);

  // 处理全选
  const handleSelectAllChange = useCallback(() => {
    if (selectedIds.size === sources.length && sources.length > 0) {
      clearSelection();
    } else {
      selectAll();
    }
  }, [selectedIds.size, sources.length, clearSelection, selectAll]);

  // 处理搜索
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchQuery(e.target.value);
    },
    [setSearchQuery]
  );

  const isAllSelected = sources.length > 0 && selectedIds.size === sources.length;
  const hasSelection = selectedIds.size > 0;
  const activeSource = activeSourceId
    ? allSources.find((source) => source.id === activeSourceId) ?? null
    : null;

  return (
    <div className="sources-panel-content">
      <DropZone active={isDragging} />

      {/* 错误提示 */}
      {error && (
        <div className="sources-error">
          <span>{error}</span>
          <button onClick={clearError} className="error-close">
            <span className="material-icon">close</span>
          </button>
        </div>
      )}

      {/* 添加来源按钮（带下拉菜单） */}
      <div className="add-source-wrapper" ref={dropdownRef}>
        <button
          className="add-source-btn"
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={importing}
        >
          <span className="material-icon">{importing ? 'hourglass_empty' : 'add'}</span>
          {importing ? '导入中...' : '添加来源'}
          <span className="material-icon dropdown-arrow">expand_more</span>
        </button>
        {showDropdown && (
          <div className="add-source-dropdown">
            <button className="dropdown-item" onClick={handleAddSource}>
              <span className="material-icon">insert_drive_file</span>
              添加文件
            </button>
            <button className="dropdown-item" onClick={handleAddFolder}>
              <span className="material-icon">folder</span>
              添加文件夹
            </button>
          </div>
        )}
      </div>

      {importing && (
        <div className="sources-importing">
          <span className="material-icon rotating">sync</span>
          <span>正在导入来源...</span>
        </div>
      )}

      {/* 来源搜索 */}
      <div className="source-search">
        <span className="material-icon search-icon">search</span>
        <input
          type="text"
          placeholder="搜索来源..."
          className="search-input"
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      {/* 来源列表 */}
      <div className="sources-body">
        <div className="sources-list">
          {sources.length > 0 && (
            <div className="sources-select-all">
              <span>
                {hasSelection
                  ? `已选择 ${selectedIds.size} / ${sources.length}`
                  : '选择所有来源'}
              </span>
              <input
                type="checkbox"
                className="source-checkbox"
                checked={isAllSelected}
                onChange={handleSelectAllChange}
              />
            </div>
          )}

          {loading ? (
            <div className="sources-loading">
              <span className="material-icon rotating">sync</span>
              <span>加载中...</span>
            </div>
          ) : sources.length === 0 ? (
            <div className="empty-sources">
              <span className="material-icon empty-icon">folder_open</span>
              <p className="empty-title">暂无来源</p>
              <p className="empty-hint">拖拽文件或点击上方按钮添加</p>
            </div>
          ) : (
            <div className="sources-items">
              {sources.map((source) => (
                <SourceItem
                  key={source.id}
                  source={source}
                  isSelected={selectedIds.has(source.id)}
                  isHighlighted={highlightedId === source.id}
                  isActive={activeSourceId === source.id}
                  onToggleSelect={toggleSelect}
                  onDelete={deleteSource}
                  onPreview={setActiveSourceId}
                />
              ))}
            </div>
          )}
        </div>

        <SourcePreview source={activeSource} />
      </div>
    </div>
  );
}
