// 编辑器搜索栏

import { useState, useEffect, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { useEditorSearch } from '../hooks/useEditorSearch';
import './SearchBar.css';

interface SearchBarProps {
  editor: Editor | null;
  onClose: () => void;
}

export function SearchBar({ editor, onClose }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = useState('');
  const { results, currentIndex, search, goToNext, goToPrevious, clearSearch } =
    useEditorSearch(editor);

  // 自动聚焦输入框
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // 处理输入变化
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    search(value);
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) {
        goToPrevious();
      } else {
        goToNext();
      }
    }
  };

  // 关闭搜索栏
  const handleClose = () => {
    clearSearch();
    setInputValue('');
    onClose();
  };

  return (
    <div className="search-bar">
      <div className="search-input-wrapper">
        <span className="material-icon search-icon">search</span>
        <input
          ref={inputRef}
          type="text"
          className="search-input"
          placeholder="搜索..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
        {inputValue && (
          <span className="search-count">
            {results > 0 ? `${currentIndex}/${results}` : '无结果'}
          </span>
        )}
      </div>

      <div className="search-actions">
        <button
          className="search-btn"
          onClick={goToPrevious}
          disabled={results === 0}
          title="上一个 (Shift+Enter)"
        >
          <span className="material-icon">keyboard_arrow_up</span>
        </button>
        <button
          className="search-btn"
          onClick={goToNext}
          disabled={results === 0}
          title="下一个 (Enter)"
        >
          <span className="material-icon">keyboard_arrow_down</span>
        </button>
        <button className="search-btn" onClick={handleClose} title="关闭 (Esc)">
          <span className="material-icon">close</span>
        </button>
      </div>
    </div>
  );
}
