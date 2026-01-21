// 思维导图编辑器组件
// 封装 simple-mind-map 提供完整思维导图功能

import { useState, useEffect, useCallback, useRef } from 'react';
import MindMap from 'simple-mind-map';
// 导入必要的插件
import Drag from 'simple-mind-map/src/plugins/Drag.js';
import Select from 'simple-mind-map/src/plugins/Select.js';
import Export from 'simple-mind-map/src/plugins/Export.js';
import KeyboardNavigation from 'simple-mind-map/src/plugins/KeyboardNavigation.js';
import RichText from 'simple-mind-map/src/plugins/RichText.js';
import MiniMap from 'simple-mind-map/src/plugins/MiniMap.js';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { useMindMapStore } from '../stores/mindmapStore';
import { parseImportFile } from '../utils/importParser';
import { OutlinePanel } from './OutlinePanel';
import { NodeStylePanel } from './NodeStylePanel';
import { NodeContentPanel } from './NodeContentPanel';
import type { MindMapData, MindMapLayout, MindMapNode } from '../../../types';
import { DEFAULT_MINDMAP_DATA } from '../../../types';
import './MindMapEditor.css';

// 注册插件
MindMap.usePlugin(Drag);
MindMap.usePlugin(Select);
MindMap.usePlugin(Export);
MindMap.usePlugin(KeyboardNavigation);
MindMap.usePlugin(RichText);
MindMap.usePlugin(MiniMap);

// 主题选项
const THEME_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'default', label: '默认' },
  { value: 'classic', label: '经典' },
  { value: 'classic2', label: '经典2' },
  { value: 'classic3', label: '经典3' },
  { value: 'classic4', label: '经典4' },
  { value: 'dark', label: '深色' },
  { value: 'dark2', label: '深色2' },
  { value: 'skyGreen', label: '天空绿' },
  { value: 'classic5', label: '经典5' },
  { value: 'classic6', label: '经典6' },
  { value: 'minions', label: '小黄人' },
  { value: 'pinkGrape', label: '粉红葡萄' },
  { value: 'mint', label: '薄荷' },
  { value: 'gold', label: '金色' },
  { value: 'vitalityOrange', label: '活力橙' },
  { value: 'greenLeaf', label: '绿叶' },
  { value: 'romanticPurple', label: '浪漫紫' },
  { value: 'freshRed', label: '清新红' },
  { value: 'freshGreen', label: '清新绿' },
  { value: 'blackHumour', label: '黑色幽默' },
  { value: 'lateNightOffice', label: '深夜办公室' },
  { value: 'blackGold', label: '黑金' },
  { value: 'autumn', label: '秋天' },
  { value: 'avocado', label: '牛油果' },
  { value: 'orangeJuice', label: '橙汁' },
  { value: 'simpleBlack', label: '简洁黑' },
  { value: 'course', label: '课程' },
  { value: 'blueSky', label: '蓝天' },
  { value: 'brainImpairedPink', label: '脑残粉' },
  { value: 'morandi', label: '莫兰迪' },
  { value: 'earthYellow', label: '大地黄' },
  { value: 'freshGreen2', label: '清新绿2' },
];

// 布局选项
const LAYOUT_OPTIONS: readonly { value: MindMapLayout; label: string }[] = [
  { value: 'logicalStructure', label: '逻辑结构图' },
  { value: 'mindMap', label: '思维导图' },
  { value: 'organizationStructure', label: '组织架构图' },
  { value: 'catalogOrganization', label: '目录组织图' },
  { value: 'timeline', label: '时间线' },
  { value: 'fishbone', label: '鱼骨图' },
];

interface MindMapEditorProps {
  mindmapId: string;
  onClose?: () => void;
}

// 下载文件的辅助函数
function downloadFile(content: string | Blob, filename: string, mimeType?: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// 直接从 URL 下载（如 data URL）
function downloadFromUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
}

export function MindMapEditor({ mindmapId, onClose }: MindMapEditorProps) {
  const {
    currentMindMap,
    currentData,
    loading,
    error,
    loadMindMap,
    saveMindMap,
    renameMindMap,
    setTheme: storeSetTheme,
    setLayout: storeSetLayout,
  } = useMindMapStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [showOutlinePanel, setShowOutlinePanel] = useState(false);
  const [showStylePanel, setShowStylePanel] = useState(false);
  const [showContentPanel, setShowContentPanel] = useState(false);
  const [outlineData, setOutlineData] = useState<MindMapNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<unknown | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const miniMapRef = useRef<HTMLDivElement>(null);
  const mindMapRef = useRef<MindMap | null>(null);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);

  // 加载思维导图数据
  useEffect(() => {
    isInitializedRef.current = false;
    loadMindMap(mindmapId);
  }, [mindmapId, loadMindMap]);

  // 初始化思维导图
  useEffect(() => {
    if (!containerRef.current || loading || !currentData) return;

    // 销毁之前的实例
    if (mindMapRef.current) {
      mindMapRef.current.destroy();
      mindMapRef.current = null;
    }

    // 创建思维导图实例
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mindMap = new MindMap({
      el: containerRef.current,
      data: currentData.root || DEFAULT_MINDMAP_DATA.root,
      theme: currentData.theme?.template || 'default',
      layout: currentData.layout || 'logicalStructure',
      // 基础配置
      readonly: false,
      enableShortcutOnlyWhenMouseInSvg: true,
      // 展开按钮
      alwaysShowExpandBtn: true,
      // 字体
      defaultInsertSecondLevelNodeText: '分支主题',
      defaultInsertBelowSecondLevelNodeText: '子主题',
    } as any);

    mindMapRef.current = mindMap;

    // 初始化小地图
    if (miniMapRef.current && mindMap.miniMap) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mindMap.miniMap as any).init(miniMapRef.current, {
        width: 180,
        height: 100,
      });
    }

    // 监听数据变化
    mindMap.on('data_change', () => {
      // 同步大纲数据
      const rootNode = mindMap.getData(false) as unknown as MindMapNode;
      setOutlineData(rootNode);

      if (!isInitializedRef.current) {
        isInitializedRef.current = true;
        return;
      }
      handleAutoSave();
    });

    // 初始设置大纲数据
    const initialRoot = mindMap.getData(false) as unknown as MindMapNode;
    setOutlineData(initialRoot);

    // 监听节点选中事件
    mindMap.on('node_active', (node: unknown) => {
      setSelectedNode(node);
    });

    // 清理
    return () => {
      if (mindMapRef.current) {
        mindMapRef.current.destroy();
        mindMapRef.current = null;
      }
    };
  }, [currentData, loading]);

  // 自动保存（防抖）
  const handleAutoSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!mindMapRef.current) return;

      setSaving(true);
      try {
        // getData(true) 返回完整数据: { layout, root, theme, view }
        // getData(false) 或 getData() 返回节点树: { data: {...}, children: [...] }
        const rawData = mindMapRef.current.getData(false);
        console.log('MindMap getData result:', JSON.stringify(rawData).substring(0, 500));

        // rawData 是节点树，格式为 { data: {...}, children: [...] }
        const rootNode = rawData as unknown as MindMapNode;
        const theme = mindMapRef.current.getTheme();
        const layout = mindMapRef.current.getLayout();
        console.log('Theme:', theme, 'Layout:', layout);

        const mindMapData: MindMapData = {
          root: rootNode,
          theme: { template: theme },
          layout: layout as MindMapLayout,
        };
        console.log('Saving mindMapData:', JSON.stringify(mindMapData).substring(0, 500));
        await saveMindMap(mindmapId, mindMapData);
        setLastSaved(new Date());
      } catch (e) {
        console.error('保存思维导图失败:', e);
      } finally {
        setSaving(false);
      }
    }, 2000);
  }, [mindmapId, saveMindMap]);

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
    setEditTitle(currentMindMap?.title || '');
    setIsEditingTitle(true);
  }, [currentMindMap]);

  // 保存标题
  const handleSaveTitle = useCallback(async () => {
    if (editTitle.trim() && currentMindMap) {
      await renameMindMap(currentMindMap.id, editTitle.trim());
    }
    setIsEditingTitle(false);
  }, [editTitle, currentMindMap, renameMindMap]);

  // 取消编辑
  const handleCancelEdit = useCallback(() => {
    setIsEditingTitle(false);
  }, []);

  // 手动保存
  const handleManualSave = useCallback(async () => {
    if (!mindMapRef.current || saving) return;

    setSaving(true);
    try {
      // getData(false) 返回节点树: { data: {...}, children: [...] }
      const rootNode = mindMapRef.current.getData(false) as unknown as MindMapNode;
      const mindMapData: MindMapData = {
        root: rootNode,
        theme: { template: mindMapRef.current.getTheme() },
        layout: mindMapRef.current.getLayout() as MindMapLayout,
      };
      await saveMindMap(mindmapId, mindMapData);
      setLastSaved(new Date());
    } catch (e) {
      console.error('保存思维导图失败:', e);
    } finally {
      setSaving(false);
    }
  }, [mindmapId, saveMindMap, saving]);

  // 切换主题
  const handleThemeChange = useCallback(async (theme: string) => {
    if (!mindMapRef.current || !currentMindMap) return;
    mindMapRef.current.setTheme(theme);
    await storeSetTheme(currentMindMap.id, theme);
    setShowThemePanel(false);
  }, [currentMindMap, storeSetTheme]);

  // 切换布局
  const handleLayoutChange = useCallback(async (layout: MindMapLayout) => {
    if (!mindMapRef.current || !currentMindMap) return;
    mindMapRef.current.setLayout(layout);
    await storeSetLayout(currentMindMap.id, layout);
    setShowLayoutPanel(false);
  }, [currentMindMap, storeSetLayout]);

  // 导出为 PNG
  const handleExportPng = useCallback(async () => {
    if (!mindMapRef.current) return;

    try {
      const filename = currentMindMap?.title || 'mindmap';
      const result = await mindMapRef.current.export('png', true, filename);
      if (result) {
        downloadFromUrl(result, `${filename}.png`);
      }
    } catch (e) {
      console.error('导出 PNG 失败:', e);
    }
  }, [currentMindMap]);

  // 导出为 SVG
  const handleExportSvg = useCallback(async () => {
    if (!mindMapRef.current) return;

    try {
      const filename = currentMindMap?.title || 'mindmap';
      const result = await mindMapRef.current.export('svg', true, filename);
      if (result) {
        downloadFile(result, `${filename}.svg`, 'image/svg+xml');
      }
    } catch (e) {
      console.error('导出 SVG 失败:', e);
    }
  }, [currentMindMap]);

  // 导出为 JSON
  const handleExportJson = useCallback(async () => {
    if (!mindMapRef.current) return;

    try {
      const filename = currentMindMap?.title || 'mindmap';
      const rootNode = mindMapRef.current.getData(false);
      const json = JSON.stringify({
        root: rootNode,
        theme: { template: mindMapRef.current.getTheme() },
        layout: mindMapRef.current.getLayout()
      }, null, 2);
      downloadFile(json, `${filename}.json`, 'application/json');
    } catch (e) {
      console.error('导出 JSON 失败:', e);
    }
  }, [currentMindMap]);

  // 导入文件
  const handleImport = useCallback(async (type: 'json' | 'markdown' | 'auto') => {
    setShowImportPanel(false);

    try {
      const filters = type === 'json'
        ? [{ name: 'JSON', extensions: ['json'] }]
        : type === 'markdown'
          ? [{ name: 'Markdown', extensions: ['md', 'markdown', 'txt'] }]
          : [{ name: '思维导图文件', extensions: ['json', 'md', 'markdown', 'txt'] }];

      const selected = await open({
        multiple: false,
        filters,
      });

      if (!selected) return;

      const filePath = typeof selected === 'string' ? selected : selected;
      const content = await readTextFile(filePath);
      const filename = filePath.split('/').pop() || filePath.split('\\').pop() || 'import';

      const importedData = parseImportFile(content, filename);

      if (!importedData || !importedData.root) {
        console.error('无法解析导入文件');
        return;
      }

      // 设置导入的数据到思维导图
      if (mindMapRef.current) {
        mindMapRef.current.setData(importedData.root);
        if (importedData.theme?.template) {
          mindMapRef.current.setTheme(importedData.theme.template);
        }
        if (importedData.layout) {
          mindMapRef.current.setLayout(importedData.layout);
        }
        // 触发保存
        handleAutoSave();
      }
    } catch (e) {
      console.error('导入失败:', e);
    }
  }, [handleAutoSave]);

  // 大纲面板：修改节点文本
  const handleOutlineNodeTextChange = useCallback((nodeId: string, newText: string) => {
    if (!mindMapRef.current) return;

    // 使用 simple-mind-map API 通过 uid 找到并修改节点
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mindMap = mindMapRef.current as any;
    const node = mindMap.renderer.findNodeByUid(nodeId);
    if (node) {
      mindMap.execCommand('SET_NODE_TEXT', node, newText);
    }
  }, []);

  // 大纲面板：选中节点
  const handleOutlineNodeSelect = useCallback((nodeId: string) => {
    if (!mindMapRef.current) return;

    // 通过 uid 找到节点并选中
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mindMap = mindMapRef.current as any;
    const node = mindMap.renderer.findNodeByUid(nodeId);
    if (node) {
      mindMap.execCommand('GO_TARGET_NODE', node);
    }
  }, []);

  // 节点样式面板：应用样式
  const handleNodeStyleChange = useCallback((style: Record<string, unknown>) => {
    if (!mindMapRef.current || !selectedNode) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mindMap = mindMapRef.current as any;
    mindMap.execCommand('SET_NODE_STYLE', selectedNode, style);
  }, [selectedNode]);

  // 节点内容面板：设置图标
  const handleIconChange = useCallback((icons: string[]) => {
    if (!mindMapRef.current || !selectedNode) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mindMap = mindMapRef.current as any;
    mindMap.execCommand('SET_NODE_ICON', selectedNode, icons);
  }, [selectedNode]);

  // 节点内容面板：设置图片
  const handleImageChange = useCallback((imageUrl: string) => {
    if (!mindMapRef.current || !selectedNode) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mindMap = mindMapRef.current as any;
    mindMap.execCommand('SET_NODE_IMAGE', selectedNode, { url: imageUrl, width: 100, height: 100 });
  }, [selectedNode]);

  // 节点内容面板：设置超链接
  const handleHyperlinkChange = useCallback((url: string, title?: string) => {
    if (!mindMapRef.current || !selectedNode) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mindMap = mindMapRef.current as any;
    mindMap.execCommand('SET_NODE_HYPERLINK', selectedNode, url, title || '');
  }, [selectedNode]);

  // 节点内容面板：设置备注
  const handleNoteChange = useCallback((note: string) => {
    if (!mindMapRef.current || !selectedNode) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mindMap = mindMapRef.current as any;
    mindMap.execCommand('SET_NODE_NOTE', selectedNode, note);
  }, [selectedNode]);

  // 节点内容面板：设置标签
  const handleTagChange = useCallback((tags: string[]) => {
    if (!mindMapRef.current || !selectedNode) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mindMap = mindMapRef.current as any;
    mindMap.execCommand('SET_NODE_TAG', selectedNode, tags);
  }, [selectedNode]);

  // 放大
  const handleZoomIn = useCallback(() => {
    if (!mindMapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mindMapRef.current.view as any).enlarge();
  }, []);

  // 缩小
  const handleZoomOut = useCallback(() => {
    if (!mindMapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mindMapRef.current.view as any).narrow();
  }, []);

  // 适应画布
  const handleFit = useCallback(() => {
    if (!mindMapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mindMapRef.current.view as any).fit();
  }, []);

  // 回到中心
  const handleCenter = useCallback(() => {
    if (!mindMapRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mindMapRef.current.renderer as any).setRootNodeCenter();
  }, []);

  if (loading) {
    return (
      <div className="mindmap-editor-loading">
        <span className="material-icon rotating">sync</span>
        <span>加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mindmap-editor-error">
        <span className="material-icon">error</span>
        <span>{error}</span>
        <button onClick={onClose}>关闭</button>
      </div>
    );
  }

  return (
    <div className="mindmap-editor">
      {/* 头部工具栏 */}
      <div className="mindmap-editor-header">
        <div className="mindmap-title">
          <span className="material-icon">account_tree</span>
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
              {currentMindMap?.title || '新思维导图'}
            </span>
          )}
        </div>

        <div className="mindmap-actions">
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

          <div className="action-group">
            <button
              className={`action-btn ${showThemePanel ? 'active' : ''}`}
              onClick={() => { setShowThemePanel(!showThemePanel); setShowLayoutPanel(false); }}
              title="主题"
            >
              <span className="material-icon">palette</span>
            </button>
            {showThemePanel && (
              <div className="dropdown-panel theme-panel">
                <div className="panel-header">选择主题</div>
                <div className="theme-grid">
                  {THEME_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`theme-option ${currentMindMap?.theme === opt.value ? 'active' : ''}`}
                      onClick={() => handleThemeChange(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="action-group">
            <button
              className={`action-btn ${showLayoutPanel ? 'active' : ''}`}
              onClick={() => { setShowLayoutPanel(!showLayoutPanel); setShowThemePanel(false); }}
              title="布局"
            >
              <span className="material-icon">grid_view</span>
            </button>
            {showLayoutPanel && (
              <div className="dropdown-panel layout-panel">
                <div className="panel-header">选择布局</div>
                <div className="layout-list">
                  {LAYOUT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      className={`layout-option ${currentMindMap?.layout === opt.value ? 'active' : ''}`}
                      onClick={() => handleLayoutChange(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="action-divider" />

          <button className="action-btn" onClick={handleZoomIn} title="放大">
            <span className="material-icon">zoom_in</span>
          </button>
          <button className="action-btn" onClick={handleZoomOut} title="缩小">
            <span className="material-icon">zoom_out</span>
          </button>
          <button className="action-btn" onClick={handleFit} title="适应画布">
            <span className="material-icon">fit_screen</span>
          </button>
          <button className="action-btn" onClick={handleCenter} title="回到中心">
            <span className="material-icon">center_focus_strong</span>
          </button>

          <div className="action-divider" />

          <button
            className={`action-btn ${showMiniMap ? 'active' : ''}`}
            onClick={() => setShowMiniMap(!showMiniMap)}
            title="小地图"
          >
            <span className="material-icon">map</span>
          </button>

          <button
            className={`action-btn ${showOutlinePanel ? 'active' : ''}`}
            onClick={() => setShowOutlinePanel(!showOutlinePanel)}
            title="大纲视图"
          >
            <span className="material-icon">format_list_bulleted</span>
          </button>

          <button
            className={`action-btn ${showStylePanel ? 'active' : ''}`}
            onClick={() => setShowStylePanel(!showStylePanel)}
            title="节点样式"
          >
            <span className="material-icon">format_paint</span>
          </button>

          <button
            className={`action-btn ${showContentPanel ? 'active' : ''}`}
            onClick={() => setShowContentPanel(!showContentPanel)}
            title="节点内容"
          >
            <span className="material-icon">edit_note</span>
          </button>

          <div className="action-divider" />

          {/* 导入按钮 */}
          <div className="action-group">
            <button
              className={`action-btn ${showImportPanel ? 'active' : ''}`}
              onClick={() => { setShowImportPanel(!showImportPanel); setShowThemePanel(false); setShowLayoutPanel(false); }}
              title="导入"
            >
              <span className="material-icon">file_upload</span>
            </button>
            {showImportPanel && (
              <div className="dropdown-panel import-panel">
                <div className="panel-header">导入思维导图</div>
                <div className="import-list">
                  <button className="import-option" onClick={() => handleImport('json')}>
                    <span className="material-icon">data_object</span>
                    <span>JSON 文件</span>
                  </button>
                  <button className="import-option" onClick={() => handleImport('markdown')}>
                    <span className="material-icon">description</span>
                    <span>Markdown 大纲</span>
                  </button>
                  <button className="import-option" onClick={() => handleImport('auto')}>
                    <span className="material-icon">auto_fix_high</span>
                    <span>自动识别</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button className="action-btn" onClick={handleExportPng} title="导出 PNG">
            <span className="material-icon">image</span>
          </button>
          <button className="action-btn" onClick={handleExportSvg} title="导出 SVG">
            <span className="material-icon">code</span>
          </button>
          <button className="action-btn" onClick={handleExportJson} title="导出 JSON">
            <span className="material-icon">data_object</span>
          </button>

          {onClose && (
            <>
              <div className="action-divider" />
              <button className="action-btn close-btn" onClick={onClose} title="关闭">
                <span className="material-icon">close</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 主体区域：思维导图 + 大纲面板 */}
      <div className="mindmap-body">
        {/* 思维导图容器 */}
        <div className="mindmap-container" ref={containerRef} />

        {/* 大纲面板 */}
        {showOutlinePanel && (
          <OutlinePanel
            data={outlineData}
            onNodeTextChange={handleOutlineNodeTextChange}
            onNodeSelect={handleOutlineNodeSelect}
          />
        )}

        {/* 样式面板 */}
        {showStylePanel && (
          <NodeStylePanel
            selectedNode={selectedNode}
            onStyleChange={handleNodeStyleChange}
          />
        )}

        {/* 内容面板 */}
        {showContentPanel && (
          <NodeContentPanel
            selectedNode={selectedNode}
            onIconChange={handleIconChange}
            onImageChange={handleImageChange}
            onHyperlinkChange={handleHyperlinkChange}
            onNoteChange={handleNoteChange}
            onTagChange={handleTagChange}
          />
        )}
      </div>

      {/* 小地图 */}
      {showMiniMap && (
        <div className="mindmap-minimap" ref={miniMapRef} />
      )}

      {/* 快捷键提示 */}
      <div className="mindmap-shortcuts-hint">
        <span>Tab 添加子节点</span>
        <span>Enter 添加同级节点</span>
        <span>Delete 删除节点</span>
        <span>双击编辑文本</span>
      </div>
    </div>
  );
}
