// 画布编辑器组件
// 封装 Excalidraw 提供完整绘图功能

import { useState, useEffect, useCallback, useRef } from 'react';
import { Excalidraw, exportToBlob, exportToSvg, MainMenu, WelcomeScreen } from '@excalidraw/excalidraw';
import type { ExcalidrawImperativeAPI, AppState } from '@excalidraw/excalidraw/types';
import { useCanvasStore } from '../stores/canvasStore';
import { useThemeStore } from '../../../stores/themeStore';
import type { CanvasData } from '../../../types';
import './CanvasEditor.css';
// 引入 Excalidraw 样式
import '@excalidraw/excalidraw/index.css';

interface CanvasEditorProps {
  canvasId: string;
  onClose?: () => void;
}

export function CanvasEditor({ canvasId, onClose }: CanvasEditorProps) {
  const {
    currentCanvas,
    currentData,
    loading,
    error,
    loadCanvas,
    saveCanvas,
    renameCanvas,
  } = useCanvasStore();

  const { theme, toggleTheme } = useThemeStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const excalidrawAPIRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const isInitializedRef = useRef(false);

  // 加载画布数据
  useEffect(() => {
    isInitializedRef.current = false;
    loadCanvas(canvasId);
  }, [canvasId, loadCanvas]);

  // 自动保存（防抖）
  const handleChange = useCallback(
    (elements: readonly unknown[], appState: AppState, files: unknown) => {
      // 跳过初始加载时的变更
      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        return;
      }

      // 取消之前的保存计时器
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // 设置新的保存计时器（2秒后保存）
      saveTimeoutRef.current = setTimeout(async () => {
        setSaving(true);
        try {
          const data: CanvasData = {
            elements: elements as unknown[],
            appState: {
              viewBackgroundColor: appState.viewBackgroundColor,
              gridSize: appState.gridSize,
            },
            files: files as Record<string, unknown>,
          };
          await saveCanvas(canvasId, data);
          setLastSaved(new Date());
        } catch (e) {
          console.error('保存画布失败:', e);
        } finally {
          setSaving(false);
        }
      }, 2000);
    },
    [canvasId, saveCanvas]
  );

  // 清理定时器
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // 开始编辑标题
  const handleStartEditTitle = useCallback(() => {
    setEditTitle(currentCanvas?.title || '');
    setIsEditingTitle(true);
  }, [currentCanvas]);

  // 保存标题
  const handleSaveTitle = useCallback(async () => {
    if (editTitle.trim() && currentCanvas) {
      await renameCanvas(currentCanvas.id, editTitle.trim());
    }
    setIsEditingTitle(false);
  }, [editTitle, currentCanvas, renameCanvas]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  // 手动保存
  const handleManualSave = useCallback(async () => {
    if (!excalidrawAPIRef.current || saving) return;

    setSaving(true);
    try {
      const elements = excalidrawAPIRef.current.getSceneElements();
      const appState = excalidrawAPIRef.current.getAppState();
      const files = excalidrawAPIRef.current.getFiles();

      const data: CanvasData = {
        elements: elements as unknown[],
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files: files as Record<string, unknown>,
      };
      await saveCanvas(canvasId, data);
      setLastSaved(new Date());
    } catch (e) {
      console.error('保存画布失败:', e);
    } finally {
      setSaving(false);
    }
  }, [canvasId, saveCanvas, saving]);

  // 导出为 PNG
  const handleExportPng = useCallback(async () => {
    if (!excalidrawAPIRef.current) return;

    const elements = excalidrawAPIRef.current.getSceneElements();
    const appState = excalidrawAPIRef.current.getAppState();
    const files = excalidrawAPIRef.current.getFiles();

    const blob = await exportToBlob({
      elements,
      appState: { ...appState, exportWithDarkMode: theme === 'dark' },
      files,
      mimeType: 'image/png',
      quality: 1,
    });

    // 下载文件
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentCanvas?.title || 'canvas'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentCanvas, theme]);

  // 导出为 SVG
  const handleExportSvg = useCallback(async () => {
    if (!excalidrawAPIRef.current) return;

    const elements = excalidrawAPIRef.current.getSceneElements();
    const appState = excalidrawAPIRef.current.getAppState();
    const files = excalidrawAPIRef.current.getFiles();

    const svg = await exportToSvg({
      elements,
      appState: { ...appState, exportWithDarkMode: theme === 'dark' },
      files,
    });

    // 下载文件
    const svgString = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentCanvas?.title || 'canvas'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [currentCanvas, theme]);

  // 重置画布
  const handleResetCanvas = useCallback(() => {
    if (excalidrawAPIRef.current) {
      excalidrawAPIRef.current.resetScene();
    }
  }, []);

  if (loading) {
    return (
      <div className="canvas-editor-loading">
        <span className="material-icon rotating">sync</span>
        <span>加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="canvas-editor-error">
        <span className="material-icon">error</span>
        <span>{error}</span>
        <button onClick={onClose}>关闭</button>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initialData = currentData
    ? {
        elements: currentData.elements,
        appState: {
          ...currentData.appState,
          theme,
        },
        files: currentData.files,
      } as any
    : {
        appState: {
          viewBackgroundColor: '#ffffff',
          theme,
        },
      };

  return (
    <div className={`canvas-editor ${theme === 'dark' ? 'dark-theme' : ''}`}>
      {/* 头部工具栏 */}
      <div className="canvas-editor-header">
        <div className="canvas-title">
          <span className="material-icon">draw</span>
          {isEditingTitle ? (
            <input
              type="text"
              className="title-input"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') handleCancelEdit();
              }}
              autoFocus
            />
          ) : (
            <span className="title-text" onClick={handleStartEditTitle}>
              {currentCanvas?.title || '新画布'}
            </span>
          )}
        </div>

        <div className="canvas-actions">
          <span className="save-status">
            {saving ? (
              <>
                <span className="material-icon rotating">sync</span>
                保存中...
              </>
            ) : lastSaved ? (
              <>
                <span className="material-icon">check_circle</span>
                已保存
              </>
            ) : null}
          </span>

          <button className="action-btn" onClick={handleManualSave} title="保存 (Ctrl+S)" disabled={saving}>
            <span className="material-icon">save</span>
          </button>
          <button className="action-btn" onClick={toggleTheme} title={theme === 'light' ? '切换暗色主题' : '切换亮色主题'}>
            <span className="material-icon">{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
          </button>
          <button className="action-btn" onClick={handleExportPng} title="导出 PNG">
            <span className="material-icon">image</span>
          </button>
          <button className="action-btn" onClick={handleExportSvg} title="导出 SVG">
            <span className="material-icon">code</span>
          </button>
          <button className="action-btn" onClick={handleResetCanvas} title="重置画布">
            <span className="material-icon">refresh</span>
          </button>
          {onClose && (
            <button className="action-btn close-btn" onClick={onClose} title="关闭">
              <span className="material-icon">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Excalidraw 编辑器 */}
      <div className="canvas-container">
        <Excalidraw
          excalidrawAPI={(api) => { excalidrawAPIRef.current = api; }}
          initialData={initialData}
          onChange={handleChange}
          langCode="zh-CN"
          theme={theme}
          UIOptions={{
            canvasActions: {
              loadScene: true,
              export: { saveFileToDisk: true },
              saveToActiveFile: false,
              clearCanvas: true,
              changeViewBackgroundColor: true,
              toggleTheme: true,
            },
            tools: {
              image: true,
            },
          }}
          gridModeEnabled={true}
        >
          {/* 自定义主菜单 */}
          <MainMenu>
            <MainMenu.DefaultItems.LoadScene />
            <MainMenu.DefaultItems.Export />
            <MainMenu.DefaultItems.SaveAsImage />
            <MainMenu.DefaultItems.ClearCanvas />
            <MainMenu.DefaultItems.ToggleTheme />
            <MainMenu.DefaultItems.ChangeCanvasBackground />
            <MainMenu.Separator />
            <MainMenu.DefaultItems.Help />
          </MainMenu>

          {/* 欢迎屏幕 */}
          <WelcomeScreen>
            <WelcomeScreen.Center>
              <WelcomeScreen.Center.Logo>
                <span className="material-icon" style={{ fontSize: 48 }}>draw</span>
              </WelcomeScreen.Center.Logo>
              <WelcomeScreen.Center.Heading>
                DeskLab 画布
              </WelcomeScreen.Center.Heading>
              <WelcomeScreen.Center.Menu>
                <WelcomeScreen.Center.MenuItemLoadScene />
                <WelcomeScreen.Center.MenuItemHelp />
              </WelcomeScreen.Center.Menu>
            </WelcomeScreen.Center>
          </WelcomeScreen>
        </Excalidraw>
      </div>
    </div>
  );
}
