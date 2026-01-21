// PPT 编辑器容器组件
// 用于嵌入 PPTist 编辑器 iframe 并处理通信

import { useEffect, useRef, useState, useCallback } from 'react';
import { save } from '@tauri-apps/plugin-dialog';
import { safeInvoke } from '../../../utils/tauri';
import { PptistBridge } from '../services/pptistBridge';
import { usePptStore } from '../stores/pptStore';
import { PptData } from '../../../types';
import './PptEditorContainer.css';

interface PptEditorContainerProps {
  pptId: string;
  initialData?: PptData;
  onClose: () => void;
}

export function PptEditorContainer({
  pptId,
  initialData,
  onClose,
}: PptEditorContainerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const bridgeRef = useRef<PptistBridge | null>(null);
  const { savePpt } = usePptStore();

  const [ready, setReady] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化桥接
  useEffect(() => {
    if (!iframeRef.current) return;

    const bridge = new PptistBridge(iframeRef.current);
    bridgeRef.current = bridge;

    // 监听编辑器准备就绪
    bridge.onReady(() => {
      setReady(true);
      if (initialData) {
        bridge.load(initialData);
      }
    });

    // 监听数据变化
    bridge.onChanged(() => {
      setIsDirty(true);
    });

    // iframe 加载完成后发送初始化消息
    const handleIframeLoad = () => {
      // PPTist 加载后会发送 PPT_READY 消息
      // 如果没有收到，可能是 PPTist 还未集成
      setTimeout(() => {
        if (!ready) {
          setError('PPTist 编辑器未响应，请确保已正确配置');
        }
      }, 5000);
    };

    iframeRef.current.addEventListener('load', handleIframeLoad);

    return () => {
      bridge.destroy();
      iframeRef.current?.removeEventListener('load', handleIframeLoad);
    };
  }, [initialData, ready]);

  // 保存
  const handleSave = useCallback(async () => {
    if (!bridgeRef.current || saving) return;

    setSaving(true);
    setError(null);

    try {
      const data = await bridgeRef.current.getData();
      await savePpt(pptId, data);
      setIsDirty(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [pptId, savePpt, saving]);

  // 导出 PPTX
  const handleExportPptx = useCallback(async () => {
    if (!bridgeRef.current || exporting) return;

    setExporting(true);
    setError(null);

    try {
      const blob = await bridgeRef.current.exportPptx();
      const path = await save({
        defaultPath: 'presentation.pptx',
        filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
      });

      if (path) {
        const buffer = await blob.arrayBuffer();
        // 使用 Tauri invoke 写入文件
        await safeInvoke('write_binary_file', {
          path,
          data: Array.from(new Uint8Array(buffer))
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  // 导出 PDF
  const handleExportPdf = useCallback(async () => {
    if (!bridgeRef.current || exporting) return;

    setExporting(true);
    setError(null);

    try {
      const blob = await bridgeRef.current.exportPdf();
      const path = await save({
        defaultPath: 'presentation.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      });

      if (path) {
        const buffer = await blob.arrayBuffer();
        // 使用 Tauri invoke 写入文件
        await safeInvoke('write_binary_file', {
          path,
          data: Array.from(new Uint8Array(buffer))
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }, [exporting]);

  // 演示模式
  const handlePresent = useCallback(() => {
    bridgeRef.current?.startPresentation();
  }, []);

  // 关闭前确认
  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('有未保存的更改，确定要关闭吗？');
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, onClose]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S 保存
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl/Cmd + Z 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        bridgeRef.current?.undo();
      }
      // Ctrl/Cmd + Shift + Z 重做
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        bridgeRef.current?.redo();
      }
      // F5 演示
      if (e.key === 'F5') {
        e.preventDefault();
        handlePresent();
      }
      // Escape 关闭
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handlePresent, handleClose]);

  return (
    <div className="ppt-editor-container">
      {/* 工具栏 */}
      <div className="ppt-editor-toolbar">
        <div className="toolbar-left">
          <button
            className="toolbar-btn"
            onClick={handleSave}
            disabled={!isDirty || saving}
            title="保存 (Ctrl+S)"
          >
            <span className="material-icon">{saving ? 'sync' : 'save'}</span>
            <span>{saving ? '保存中...' : '保存'}</span>
          </button>

          <div className="toolbar-divider" />

          <button
            className="toolbar-btn"
            onClick={handlePresent}
            disabled={!ready}
            title="演示 (F5)"
          >
            <span className="material-icon">slideshow</span>
            <span>演示</span>
          </button>
        </div>

        <div className="toolbar-center">
          {isDirty && <span className="unsaved-indicator">未保存</span>}
          {error && <span className="error-indicator">{error}</span>}
        </div>

        <div className="toolbar-right">
          <div className="export-dropdown">
            <button
              className="toolbar-btn"
              disabled={!ready || exporting}
              title="导出"
            >
              <span className="material-icon">download</span>
              <span>{exporting ? '导出中...' : '导出'}</span>
              <span className="material-icon dropdown-arrow">expand_more</span>
            </button>
            <div className="dropdown-menu">
              <button onClick={handleExportPptx} disabled={exporting}>
                <span className="material-icon">description</span>
                导出 PPTX
              </button>
              <button onClick={handleExportPdf} disabled={exporting}>
                <span className="material-icon">picture_as_pdf</span>
                导出 PDF
              </button>
            </div>
          </div>

          <div className="toolbar-divider" />

          <button
            className="toolbar-btn close-btn"
            onClick={handleClose}
            title="关闭 (Esc)"
          >
            <span className="material-icon">close</span>
          </button>
        </div>
      </div>

      {/* iframe 容器 */}
      <div className="ppt-editor-iframe-wrapper">
        {!ready && (
          <div className="ppt-editor-loading">
            <span className="material-icon rotating">sync</span>
            <p>加载编辑器...</p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src="./pptist/index.html"
          title="PPT Editor"
          className="pptist-iframe"
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    </div>
  );
}
