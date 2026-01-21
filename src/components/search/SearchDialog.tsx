import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { safeInvoke } from '../../utils/tauri';
import { useNavigate } from 'react-router-dom';
import type { SearchResult, SearchFilters } from '../../types';
import './SearchDialog.css';

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'project', label: '项目', icon: 'folder' },
  { value: 'source', label: '来源', icon: 'description' },
  { value: 'note', label: '笔记', icon: 'note' },
  { value: 'canvas', label: '画布', icon: 'gesture' },
] as const;

const TIME_OPTIONS = [
  { value: 'all', label: '全部时间' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '最近一周' },
  { value: 'month', label: '最近一月' },
  { value: 'year', label: '最近一年' },
] as const;

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [semanticMode, setSemanticMode] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>({
    types: ['project', 'source', 'note', 'canvas'],
    timeRange: 'all',
  });
  const inputRef = useRef<HTMLInputElement>(null);

  // 计算时间过滤的截止日期
  const getTimeThreshold = useCallback((range: SearchFilters['timeRange']): Date | null => {
    const now = new Date();
    switch (range) {
      case 'today':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default:
        return null;
    }
  }, []);

  // 过滤结果
  const filteredResults = useMemo(() => {
    let filtered = results;

    // 类型过滤
    if (filters.types.length < 4) {
      filtered = filtered.filter((r) => filters.types.includes(r.type));
    }

    // 时间过滤
    const threshold = getTimeThreshold(filters.timeRange);
    if (threshold) {
      filtered = filtered.filter((r) => new Date(r.updatedAt) >= threshold);
    }

    return filtered;
  }, [results, filters, getTimeThreshold]);

  // 搜索防抖
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const command = semanticMode ? 'search_semantic' : 'search_global';
        const searchResults = await safeInvoke<SearchResult[]>(command, {
          query: query.trim(),
          limit: 50, // 增加限制以便过滤后有更多结果
        });
        setResults(searchResults);
        setSelectedIndex(0);
      } catch (e) {
        console.error('Search failed:', e);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, semanticMode]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
      setSemanticMode(false);
      setShowFilters(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filteredResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredResults[selectedIndex]) {
            handleSelect(filteredResults[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredResults, selectedIndex, onClose]
  );

  const handleSelect = (result: SearchResult) => {
    onClose();
    // 根据结果类型跳转
    if (result.type === 'project') {
      navigate(`/project/${result.id}`);
    } else if (result.type === 'canvas') {
      // 画布跳转到对应项目的画布页面
      navigate(`/project/${result.projectId}?tab=canvas&canvasId=${result.id}`);
    } else {
      // source 或 note 跳转到对应项目
      navigate(`/project/${result.projectId}`);
    }
  };

  const toggleTypeFilter = (type: 'project' | 'source' | 'note' | 'canvas') => {
    setFilters((prev) => {
      const types = prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type];
      // 至少保留一个类型
      return { ...prev, types: types.length > 0 ? types : prev.types };
    });
    setSelectedIndex(0);
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'project':
        return 'folder';
      case 'source':
        return 'description';
      case 'note':
        return 'note';
      case 'canvas':
        return 'gesture';
      default:
        return 'search';
    }
  };

  const getResultTypeLabel = (type: string) => {
    switch (type) {
      case 'project':
        return '项目';
      case 'source':
        return '来源';
      case 'note':
        return '笔记';
      case 'canvas':
        return '画布';
      default:
        return '';
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 30) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  // 检查是否有激活的过滤器
  const hasActiveFilters = filters.types.length < 4 || filters.timeRange !== 'all';

  if (!open) return null;

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <span className="material-icon search-icon">search</span>
          <input
            ref={inputRef}
            type="text"
            className="search-input"
            placeholder="搜索项目、来源、笔记..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button
            type="button"
            className={`search-filter-toggle ${hasActiveFilters ? 'has-filters' : ''}`}
            onClick={() => setShowFilters((prev) => !prev)}
            title="过滤器"
          >
            <span className="material-icon">tune</span>
          </button>
          <button
            type="button"
            className={`search-mode-toggle ${semanticMode ? 'active' : ''}`}
            onClick={() => setSemanticMode((prev) => !prev)}
          >
            <span className="material-icon">auto_awesome</span>
            语义
          </button>
          <kbd className="search-shortcut">ESC</kbd>
        </div>

        {/* 过滤器面板 */}
        {showFilters && (
          <div className="search-filters">
            <div className="filter-section">
              <span className="filter-label">类型</span>
              <div className="filter-chips">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`filter-chip ${filters.types.includes(opt.value) ? 'active' : ''}`}
                    onClick={() => toggleTypeFilter(opt.value)}
                  >
                    <span className="material-icon">{opt.icon}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="filter-section">
              <span className="filter-label">时间</span>
              <select
                className="filter-select"
                value={filters.timeRange}
                onChange={(e) => {
                  setFilters((prev) => ({
                    ...prev,
                    timeRange: e.target.value as SearchFilters['timeRange'],
                  }));
                  setSelectedIndex(0);
                }}
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {hasActiveFilters && (
              <button
                className="filter-clear"
                onClick={() => {
                  setFilters({ types: ['project', 'source', 'note', 'canvas'], timeRange: 'all' });
                  setSelectedIndex(0);
                }}
              >
                清除过滤
              </button>
            )}
          </div>
        )}

        <div className="search-results">
          {loading && (
            <div className="search-loading">
              <span>搜索中...</span>
            </div>
          )}

          {!loading && query && filteredResults.length === 0 && (
            <div className="search-empty">
              <span className="material-icon">search_off</span>
              <p>未找到 "{query}" 相关结果</p>
              {hasActiveFilters && (
                <p className="search-empty-hint">尝试调整过滤条件</p>
              )}
            </div>
          )}

          {!loading && filteredResults.length > 0 && (
            <ul className="results-list">
              {filteredResults.map((result, index) => (
                <li key={`${result.type}-${result.id}`}>
                  <button
                    className={`result-item ${index === selectedIndex ? 'selected' : ''}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  >
                    <span className="material-icon result-icon">
                      {getResultIcon(result.type)}
                    </span>
                    <div className="result-content">
                      <span className="result-title">{result.title}</span>
                      {result.snippet && result.snippet !== result.title && (
                        <span className="result-snippet">{result.snippet}</span>
                      )}
                    </div>
                    {result.score !== undefined && (
                      <span className="result-score">
                        {(result.score * 100).toFixed(0)}%
                      </span>
                    )}
                    <span className="result-time">{formatRelativeTime(result.updatedAt)}</span>
                    <span className="result-type">{getResultTypeLabel(result.type)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!loading && !query && (
            <div className="search-hint">
              <p>输入关键词开始搜索</p>
              <div className="search-tips">
                <span><kbd>↑</kbd><kbd>↓</kbd> 导航</span>
                <span><kbd>Enter</kbd> 选择</span>
                <span><kbd>ESC</kbd> 关闭</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
