// 编辑器搜索 Hook

import { useCallback, useState } from 'react';
import { Editor } from '@tiptap/react';

// 扩展 Window 类型以支持 find 方法
declare global {
  interface Window {
    find(
      searchString: string,
      caseSensitive?: boolean,
      backwards?: boolean,
      wrapAround?: boolean,
      wholeWord?: boolean,
      searchInFrames?: boolean,
      showDialog?: boolean
    ): boolean;
  }
}

interface SearchState {
  query: string;
  results: number;
  currentIndex: number;
}

interface SearchMatch {
  from: number;
  to: number;
}

export function useEditorSearch(editor: Editor | null) {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    results: 0,
    currentIndex: 0,
  });
  const [matches, setMatches] = useState<SearchMatch[]>([]);

  // 查找所有匹配项
  const findMatches = useCallback(
    (query: string): SearchMatch[] => {
      if (!editor || !query) return [];

      const text = editor.getText();
      const foundMatches: SearchMatch[] = [];
      const lowerQuery = query.toLowerCase();
      const lowerText = text.toLowerCase();

      let pos = 0;
      let index = lowerText.indexOf(lowerQuery, pos);

      while (index !== -1) {
        foundMatches.push({
          from: index,
          to: index + query.length,
        });
        pos = index + 1;
        index = lowerText.indexOf(lowerQuery, pos);
      }

      return foundMatches;
    },
    [editor]
  );

  // 滚动到匹配位置
  const scrollToMatch = useCallback(
    (query: string) => {
      if (!editor || !query) return;

      // 使用 window.find 进行原生搜索高亮
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }

      // 聚焦编辑器
      editor.commands.focus();

      // 使用 window.find 高亮
      window.find(query, false, false, true, false, false, false);
    },
    [editor]
  );

  const search = useCallback(
    (query: string) => {
      if (!editor || !query.trim()) {
        setSearchState({ query: '', results: 0, currentIndex: 0 });
        setMatches([]);
        return;
      }

      const foundMatches = findMatches(query);
      setMatches(foundMatches);
      setSearchState({
        query,
        results: foundMatches.length,
        currentIndex: foundMatches.length > 0 ? 1 : 0,
      });

      // 跳转到第一个匹配项
      if (foundMatches.length > 0) {
        scrollToMatch(query);
      }
    },
    [editor, findMatches, scrollToMatch]
  );

  const goToNext = useCallback(() => {
    if (matches.length === 0 || !searchState.query) return;

    const nextIndex = searchState.currentIndex >= matches.length ? 1 : searchState.currentIndex + 1;
    setSearchState((prev) => ({ ...prev, currentIndex: nextIndex }));

    // 使用 window.find 跳到下一个
    window.find(searchState.query, false, false, true, false, false, false);
  }, [matches, searchState]);

  const goToPrevious = useCallback(() => {
    if (matches.length === 0 || !searchState.query) return;

    const prevIndex = searchState.currentIndex <= 1 ? matches.length : searchState.currentIndex - 1;
    setSearchState((prev) => ({ ...prev, currentIndex: prevIndex }));

    // 使用 window.find 反向搜索
    window.find(searchState.query, false, true, true, false, false, false);
  }, [matches, searchState]);

  const clearSearch = useCallback(() => {
    setSearchState({ query: '', results: 0, currentIndex: 0 });
    setMatches([]);
    // 清除选择
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }, []);

  return {
    ...searchState,
    search,
    goToNext,
    goToPrevious,
    clearSearch,
  };
}
