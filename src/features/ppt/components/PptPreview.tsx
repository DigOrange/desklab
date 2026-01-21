// PPT 预览和编辑组件
// 提供 PPT 幻灯片的预览和编辑功能，支持添加文本、形状、图片等元素
// 支持元素拖拽、缩放、属性编辑、层级管理等进阶功能

import { useState, useEffect, useCallback, useRef } from 'react';
import { safeInvoke } from '../../../utils/tauri';
import { save } from '@tauri-apps/plugin-dialog';
import { usePptStore } from '../stores/pptStore';
import type { PptData, PptistSlide, PptistElement, PptTheme, SlideSize, SlideTransition, PptTableElement, PptChartElement, ChartType } from '../../../types';
import { useElementDrag } from '../hooks/useElementDrag';
import { useElementLayer } from '../hooks/useElementLayer';
import { ResizeHandles } from './ResizeHandles';
import { TextPropertiesPanel } from './TextPropertiesPanel';
import { ShapePropertiesPanel } from './ShapePropertiesPanel';
import { LinePropertiesPanel } from './LinePropertiesPanel';
import { TablePropertiesPanel } from './TablePropertiesPanel';
import { ChartPropertiesPanel } from './ChartPropertiesPanel';
import { TableElement, createDefaultTable } from './TableElement';
import { ChartElement, createDefaultChart, CHART_TYPES } from './ChartElement';
import { DesignPanel } from './DesignPanel';
import { SpeakerNotesPanel } from './SpeakerNotesPanel';
import './PptPreview.css';

// 幻灯片画布默认尺寸常量
const DEFAULT_SLIDE_WIDTH = 1000;
const DEFAULT_SLIDE_HEIGHT = 562.5;

// 预设主题模板
const THEME_TEMPLATES: readonly { id: string; name: string; theme: PptTheme }[] = [
  {
    id: 'default',
    name: '默认',
    theme: {
      themeColor: '#5AA7A0',
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'blue',
    name: '商务蓝',
    theme: {
      themeColor: '#2563eb',
      fontColor: '#1e293b',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#f8fafc',
    },
  },
  {
    id: 'orange',
    name: '活力橙',
    theme: {
      themeColor: '#f97316',
      fontColor: '#1c1917',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#fffbeb',
    },
  },
  {
    id: 'purple',
    name: '优雅紫',
    theme: {
      themeColor: '#7c3aed',
      fontColor: '#1e1b4b',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#faf5ff',
    },
  },
  {
    id: 'green',
    name: '自然绿',
    theme: {
      themeColor: '#16a34a',
      fontColor: '#14532d',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#f0fdf4',
    },
  },
  {
    id: 'dark',
    name: '深色',
    theme: {
      themeColor: '#60a5fa',
      fontColor: '#f1f5f9',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#1e293b',
    },
  },
] as const;

interface PptPreviewProps {
  pptId: string;
  onClose: () => void;
}

type ViewMode = 'preview' | 'edit';

type ContextMenuType = 'slide' | 'element';

interface ContextMenuState {
  x: number;
  y: number;
  type: ContextMenuType;
  targetId?: string;
}

// 生成唯一 ID
function generateId(): string {
  return `el-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// 元素属性面板组件 - 根据元素类型渲染对应的属性面板
interface ElementPropertiesPanelProps {
  element: PptistElement;
  onUpdate: (updates: Partial<PptistElement>) => void;
  onClose: () => void;
}

function ElementPropertiesPanel({ element, onUpdate, onClose }: ElementPropertiesPanelProps): JSX.Element | null {
  const { type } = element;

  if (type === 'text') {
    return <TextPropertiesPanel element={element} onUpdate={onUpdate} onClose={onClose} />;
  }
  if (type === 'shape') {
    return <ShapePropertiesPanel element={element} onUpdate={onUpdate} onClose={onClose} />;
  }
  if (type === 'line') {
    return <LinePropertiesPanel element={element} onUpdate={onUpdate} onClose={onClose} />;
  }
  if (type === 'table') {
    return <TablePropertiesPanel element={element as unknown as PptTableElement} onUpdate={onUpdate as (updates: Partial<PptTableElement>) => void} onClose={onClose} />;
  }
  if (type === 'chart') {
    return <ChartPropertiesPanel element={element as unknown as PptChartElement} onUpdate={onUpdate as (updates: Partial<PptChartElement>) => void} onClose={onClose} />;
  }
  return null;
}

// 更新幻灯片数组的辅助函数
function updateSlides(
  slides: PptistSlide[],
  slideIndex: number,
  updater: (slide: PptistSlide) => PptistSlide
): PptistSlide[] {
  const newSlides = [...slides];
  newSlides[slideIndex] = updater(newSlides[slideIndex]);
  return newSlides;
}

// 向幻灯片添加元素
function addElementToSlide(slide: PptistSlide, element: PptistElement): PptistSlide {
  return {
    ...slide,
    elements: [...slide.elements, element],
  };
}

export function PptPreview({ pptId, onClose }: PptPreviewProps) {
  const { loadPpt, currentPptData, savePpt, loading, error } = usePptStore();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [editedData, setEditedData] = useState<PptData | null>(null);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showPropertiesPanel, setShowPropertiesPanel] = useState(false);
  const [showDesignPanel, setShowDesignPanel] = useState(false);
  const [showSpeakerNotes, setShowSpeakerNotes] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const slideContainerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  // 计算缩放比例 - 依赖于当前幻灯片尺寸
  const currentSlideWidth = editedData?.slideSize?.width || DEFAULT_SLIDE_WIDTH;

  useEffect(() => {
    const updateScale = () => {
      if (slideContainerRef.current) {
        const containerWidth = slideContainerRef.current.clientWidth;
        const newScale = containerWidth / currentSlideWidth;
        setScale(newScale);
      }
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [currentSlideWidth]);

  // 加载 PPT 数据
  useEffect(() => {
    loadPpt(pptId);
  }, [pptId, loadPpt]);

  // 当数据加载完成后，初始化编辑数据
  useEffect(() => {
    if (currentPptData) {
      setEditedData(currentPptData);
    }
  }, [currentPptData]);

  // 获取当前幻灯片
  const currentSlide = editedData?.slides[currentSlideIndex];

  // 计算实际幻灯片尺寸
  const slideWidth = editedData?.slideSize?.width || DEFAULT_SLIDE_WIDTH;
  const slideHeight = editedData?.slideSize?.height || DEFAULT_SLIDE_HEIGHT;

  // 获取选中的元素
  const selectedElement = currentSlide?.elements.find(
    (el) => el.id === selectedElementId
  );

  // 更新当前幻灯片的辅助函数
  const updateCurrentSlide = useCallback(
    (updatedSlide: PptistSlide) => {
      if (!editedData) return;
      const newSlides = [...editedData.slides];
      newSlides[currentSlideIndex] = updatedSlide;
      setEditedData({ ...editedData, slides: newSlides });
      setIsDirty(true);
    },
    [editedData, currentSlideIndex]
  );

  // 元素层级管理
  const { bringToFront, sendToBack, bringForward, sendBackward, getLayerInfo } =
    useElementLayer({
      slide: currentSlide || { id: '', elements: [] },
      onUpdateSlide: updateCurrentSlide,
    });

  // 元素拖拽
  const { isDragging, handleDragStart } = useElementDrag({
    slideWidth,
    slideHeight,
    scale,
    onPositionChange: (elementId, left, top) => {
      if (!editedData) return;
      const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) => ({
        ...slide,
        elements: slide.elements.map((el) =>
          el.id === elementId ? { ...el, left, top } : el
        ),
      }));
      setEditedData({ ...editedData, slides: newSlides });
    },
    onDragEnd: () => {
      setIsDirty(true);
    },
  });

  // 键盘导航和快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editedData) return;

      // 编辑模式下的快捷键
      if (viewMode === 'edit') {
        // Delete 键删除选中元素
        if (e.key === 'Delete' && selectedElementId) {
          e.preventDefault();
          handleDeleteElement(selectedElementId);
          return;
        }

        // Escape 取消选中或关闭面板
        if (e.key === 'Escape') {
          if (showSpeakerNotes) {
            setShowSpeakerNotes(false);
          } else if (showDesignPanel) {
            setShowDesignPanel(false);
          } else if (showThemePanel) {
            setShowThemePanel(false);
          } else if (showPropertiesPanel) {
            setShowPropertiesPanel(false);
          } else if (selectedElementId) {
            setSelectedElementId(null);
          } else {
            handleClose();
          }
          return;
        }

        // 层级快捷键
        if (selectedElementId && (e.ctrlKey || e.metaKey)) {
          if (e.key === ']') {
            e.preventDefault();
            if (e.shiftKey) {
              bringToFront(selectedElementId);
            } else {
              bringForward(selectedElementId);
            }
            return;
          }
          if (e.key === '[') {
            e.preventDefault();
            if (e.shiftKey) {
              sendToBack(selectedElementId);
            } else {
              sendBackward(selectedElementId);
            }
            return;
          }
        }
      }

      // 预览模式下的导航
      if (viewMode === 'preview') {
        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
            break;
          case 'ArrowRight':
          case 'ArrowDown':
          case ' ':
            e.preventDefault();
            setCurrentSlideIndex((prev) =>
              Math.min(editedData.slides.length - 1, prev + 1)
            );
            break;
          case 'Home':
            setCurrentSlideIndex(0);
            break;
          case 'End':
            setCurrentSlideIndex(editedData.slides.length - 1);
            break;
          case 'Escape':
            if (showThemePanel) {
              setShowThemePanel(false);
            } else {
              handleClose();
            }
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    editedData,
    viewMode,
    showThemePanel,
    showPropertiesPanel,
    showDesignPanel,
    showSpeakerNotes,
    selectedElementId,
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
  ]);

  // 点击外部关闭右键菜单
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    if (contextMenu) {
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
    }
  }, [contextMenu]);

  const handlePrevSlide = useCallback(() => {
    setCurrentSlideIndex((prev) => Math.max(0, prev - 1));
  }, []);

  const handleNextSlide = useCallback(() => {
    if (!editedData) return;
    setCurrentSlideIndex((prev) =>
      Math.min(editedData.slides.length - 1, prev + 1)
    );
  }, [editedData]);

  // 切换模式
  const handleEdit = useCallback(() => {
    setViewMode('edit');
    setSelectedElementId(null);
    setShowPropertiesPanel(false);
  }, []);

  const handlePreview = useCallback(() => {
    setViewMode('preview');
    setSelectedElementId(null);
    setShowPropertiesPanel(false);
  }, []);

  // 应用主题
  const handleApplyTheme = useCallback(
    (theme: PptTheme) => {
      if (!editedData) return;

      const newData: PptData = {
        ...editedData,
        theme,
        slides: editedData.slides.map((slide) => ({
          ...slide,
          background: {
            ...slide.background,
            type: 'solid',
            color: theme.backgroundColor,
          },
          elements: slide.elements.map((el) => ({
            ...el,
            defaultColor: el.type === 'text' ? theme.fontColor : undefined,
          })),
        })),
      };

      setEditedData(newData);
      setIsDirty(true);
      setShowThemePanel(false);
    },
    [editedData]
  );

  // 更新单个幻灯片（用于 DesignPanel）
  const handleUpdateSlide = useCallback(
    (updates: Partial<PptistSlide>) => {
      if (!editedData) return;
      const newSlides = [...editedData.slides];
      newSlides[currentSlideIndex] = {
        ...newSlides[currentSlideIndex],
        ...updates,
      };
      setEditedData({ ...editedData, slides: newSlides });
      setIsDirty(true);
    },
    [editedData, currentSlideIndex]
  );

  // 更新所有幻灯片（用于 DesignPanel）
  const handleUpdateAllSlides = useCallback(
    (updater: (slide: PptistSlide) => PptistSlide) => {
      if (!editedData) return;
      const newSlides = editedData.slides.map(updater);
      setEditedData({ ...editedData, slides: newSlides });
      setIsDirty(true);
    },
    [editedData]
  );

  // 更新全局主题（用于 DesignPanel）
  const handleUpdateTheme = useCallback(
    (newTheme: PptTheme) => {
      if (!editedData) return;
      setEditedData({ ...editedData, theme: newTheme });
      setIsDirty(true);
    },
    [editedData]
  );

  // 更新演讲者备注
  const handleUpdateNotes = useCallback(
    (notes: string) => {
      if (!editedData) return;
      const newSlides = [...editedData.slides];
      newSlides[currentSlideIndex] = {
        ...newSlides[currentSlideIndex],
        notes,
      };
      setEditedData({ ...editedData, slides: newSlides });
      setIsDirty(true);
    },
    [editedData, currentSlideIndex]
  );

  // 更新幻灯片尺寸
  const handleUpdateSlideSize = useCallback(
    (size: SlideSize) => {
      if (!editedData) return;
      setEditedData({ ...editedData, slideSize: size });
      setIsDirty(true);
    },
    [editedData]
  );

  // 更新默认切换效果
  const handleUpdateDefaultTransition = useCallback(
    (transition: SlideTransition) => {
      if (!editedData) return;
      setEditedData({ ...editedData, defaultTransition: transition });
      setIsDirty(true);
    },
    [editedData]
  );

  // 添加新幻灯片
  const handleAddSlide = useCallback(() => {
    if (!editedData) return;

    const newSlide: PptistSlide = {
      id: generateId(),
      elements: [
        {
          id: generateId(),
          type: 'text',
          content: '点击添加标题',
          left: 100,
          top: 100,
          width: 800,
          height: 80,
          rotate: 0,
          fontSize: 36,
          fontWeight: 'bold',
          textAlign: 'center',
          defaultColor: editedData.theme?.fontColor || '#333333',
        },
      ],
      background: {
        type: 'solid',
        color: editedData.theme?.backgroundColor || '#ffffff',
      },
    };

    const newSlides = [...editedData.slides];
    newSlides.splice(currentSlideIndex + 1, 0, newSlide);

    setEditedData({ ...editedData, slides: newSlides });
    setCurrentSlideIndex(currentSlideIndex + 1);
    setIsDirty(true);
  }, [editedData, currentSlideIndex]);

  // 复制幻灯片
  const handleDuplicateSlide = useCallback(() => {
    if (!editedData) return;

    const currentSlide = editedData.slides[currentSlideIndex];
    const duplicatedSlide: PptistSlide = {
      ...currentSlide,
      id: generateId(),
      elements: currentSlide.elements.map((el) => ({
        ...el,
        id: generateId(),
      })),
    };

    const newSlides = [...editedData.slides];
    newSlides.splice(currentSlideIndex + 1, 0, duplicatedSlide);

    setEditedData({ ...editedData, slides: newSlides });
    setCurrentSlideIndex(currentSlideIndex + 1);
    setIsDirty(true);
  }, [editedData, currentSlideIndex]);

  // 删除幻灯片
  const handleDeleteSlide = useCallback(() => {
    if (!editedData || editedData.slides.length <= 1) return;

    const newSlides = editedData.slides.filter((_, i) => i !== currentSlideIndex);
    const newIndex = Math.min(currentSlideIndex, newSlides.length - 1);

    setEditedData({ ...editedData, slides: newSlides });
    setCurrentSlideIndex(newIndex);
    setIsDirty(true);
  }, [editedData, currentSlideIndex]);

  // 添加文本框
  const handleAddText = useCallback(() => {
    if (!editedData) return;

    const newElement: PptistElement = {
      id: generateId(),
      type: 'text',
      content: '双击编辑文本',
      left: 300,
      top: 250,
      width: 400,
      height: 60,
      rotate: 0,
      fontSize: 24,
      textAlign: 'left',
      defaultColor: editedData.theme?.fontColor || '#333333',
    };

    const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) =>
      addElementToSlide(slide, newElement)
    );

    setEditedData({ ...editedData, slides: newSlides });
    setSelectedElementId(newElement.id);
    setIsDirty(true);
  }, [editedData, currentSlideIndex]);

  // 添加形状
  const handleAddShape = useCallback(
    (shapeType: string) => {
      if (!editedData) return;

      const newElement: PptistElement = {
        id: generateId(),
        type: 'shape',
        content: '',
        left: 350,
        top: 200,
        width: 200,
        height: 150,
        rotate: 0,
        shapeType,
        fill: editedData.theme?.themeColor || '#5AA7A0',
        fillOpacity: 1,
        stroke: 'transparent',
        strokeWidth: 0,
      };

      const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) =>
        addElementToSlide(slide, newElement)
      );

      setEditedData({ ...editedData, slides: newSlides });
      setSelectedElementId(newElement.id);
      setIsDirty(true);
    },
    [editedData, currentSlideIndex]
  );

  // 添加线条
  const handleAddLine = useCallback(
    (lineType: 'line' | 'arrow' | 'double-arrow') => {
      if (!editedData) return;

      const newElement: PptistElement = {
        id: generateId(),
        type: 'line',
        content: '',
        left: 300,
        top: 280,
        width: 400,
        height: 2,
        rotate: 0,
        lineType,
        stroke: editedData.theme?.themeColor || '#5AA7A0',
        strokeWidth: 2,
        strokeStyle: 'solid',
      };

      const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) =>
        addElementToSlide(slide, newElement)
      );

      setEditedData({ ...editedData, slides: newSlides });
      setSelectedElementId(newElement.id);
      setIsDirty(true);
    },
    [editedData, currentSlideIndex]
  );

  // 添加表格
  const handleAddTable = useCallback(() => {
    if (!editedData) return;

    const tableData = createDefaultTable(3, 3);
    const newElement: PptistElement = {
      id: generateId(),
      type: 'table',
      left: 200,
      top: 150,
      width: 600,
      height: 160,
      rotate: 0,
      ...tableData,
    };

    const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) =>
      addElementToSlide(slide, newElement)
    );
    setEditedData({ ...editedData, slides: newSlides });
    setSelectedElementId(newElement.id);
    setIsDirty(true);
  }, [editedData, currentSlideIndex]);

  // 添加图表
  const handleAddChart = useCallback((chartType: ChartType = 'bar') => {
    if (!editedData) return;

    const chartData = createDefaultChart(chartType);
    const newElement: PptistElement = {
      id: generateId(),
      type: 'chart',
      left: 200,
      top: 120,
      width: 600,
      height: 350,
      rotate: 0,
      ...chartData,
    };

    const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) =>
      addElementToSlide(slide, newElement)
    );
    setEditedData({ ...editedData, slides: newSlides });
    setSelectedElementId(newElement.id);
    setIsDirty(true);
  }, [editedData, currentSlideIndex]);

  // 添加图片
  const handleAddImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImageSelected = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!editedData || !e.target.files?.[0]) return;

      const file = e.target.files[0];
      const reader = new FileReader();

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;

        const newElement: PptistElement = {
          id: generateId(),
          type: 'image',
          content: dataUrl,
          left: 300,
          top: 150,
          width: 400,
          height: 300,
          rotate: 0,
        };

        const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) =>
          addElementToSlide(slide, newElement)
        );

        setEditedData({ ...editedData, slides: newSlides });
        setSelectedElementId(newElement.id);
        setIsDirty(true);
      };

      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [editedData, currentSlideIndex]
  );

  // 删除元素
  const handleDeleteElement = useCallback(
    (elementId: string) => {
      if (!editedData) return;

      const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) => ({
        ...slide,
        elements: slide.elements.filter((el) => el.id !== elementId),
      }));

      setEditedData({ ...editedData, slides: newSlides });
      setSelectedElementId(null);
      setShowPropertiesPanel(false);
      setIsDirty(true);
    },
    [editedData, currentSlideIndex]
  );

  // 更新元素属性
  const handleUpdateElement = useCallback(
    (elementId: string, updates: Partial<PptistElement>) => {
      if (!editedData) return;

      const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) => ({
        ...slide,
        elements: slide.elements.map((el) =>
          el.id === elementId ? { ...el, ...updates } : el
        ),
      }));

      setEditedData({ ...editedData, slides: newSlides });
      setIsDirty(true);
    },
    [editedData, currentSlideIndex]
  );

  // 处理元素选择
  const handleSelectElement = useCallback(
    (id: string | null) => {
      setSelectedElementId(id);
      // 选中元素时显示属性面板
      if (id && viewMode === 'edit') {
        setShowPropertiesPanel(true);
      }
    },
    [viewMode]
  );

  // 右键菜单处理
  const handleSlideContextMenu = useCallback(
    (e: React.MouseEvent, slideIndex: number) => {
      e.preventDefault();
      setCurrentSlideIndex(slideIndex);
      setContextMenu({ x: e.clientX, y: e.clientY, type: 'slide' });
    },
    []
  );

  const handleElementContextMenu = useCallback(
    (e: React.MouseEvent, elementId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedElementId(elementId);
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        type: 'element',
        targetId: elementId,
      });
    },
    []
  );

  // 复制元素
  const handleCopyElement = useCallback(
    (elementId: string) => {
      if (!editedData || !currentSlide) return;

      const element = currentSlide.elements.find((el) => el.id === elementId);
      if (!element) return;

      const newElement = {
        ...element,
        id: generateId(),
        left: element.left + 20,
        top: element.top + 20,
      };

      const newSlides = updateSlides(editedData.slides, currentSlideIndex, (slide) =>
        addElementToSlide(slide, newElement)
      );

      setEditedData({ ...editedData, slides: newSlides });
      setSelectedElementId(newElement.id);
      setIsDirty(true);
    },
    [editedData, currentSlide, currentSlideIndex]
  );

  // 保存
  const handleSave = useCallback(async () => {
    if (!editedData || saving) return;

    setSaving(true);
    try {
      await savePpt(pptId, editedData);
      setIsDirty(false);
    } catch (e) {
      console.error('保存失败:', e);
    } finally {
      setSaving(false);
    }
  }, [editedData, pptId, savePpt, saving]);

  // 导出为 PPTX
  const handleExport = useCallback(async () => {
    if (exporting) return;

    // 如果有未保存的更改，先保存
    if (isDirty && editedData) {
      setSaving(true);
      try {
        await savePpt(pptId, editedData);
        setIsDirty(false);
      } catch (e) {
        console.error('保存失败:', e);
        return;
      } finally {
        setSaving(false);
      }
    }

    setExporting(true);
    try {
      // 打开保存对话框
      const filePath = await save({
        filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
        defaultPath: 'presentation.pptx',
      });

      if (filePath) {
        await safeInvoke('ppt_export', { id: pptId, outputPath: filePath });
        console.log('导出成功:', filePath);
      }
    } catch (e) {
      console.error('导出失败:', e);
    } finally {
      setExporting(false);
    }
  }, [exporting, isDirty, editedData, pptId, savePpt]);

  // 关闭
  const handleClose = useCallback(() => {
    if (isDirty) {
      const confirmed = window.confirm('有未保存的更改，确定要关闭吗？');
      if (!confirmed) return;
    }
    onClose();
  }, [isDirty, onClose]);

  if (loading) {
    return (
      <div className="ppt-preview-loading">
        <span className="material-icon rotating">sync</span>
        <p>加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="ppt-preview-error">
        <span className="material-icon">error</span>
        <p>{error}</p>
        <button onClick={onClose}>关闭</button>
      </div>
    );
  }

  if (!editedData || !currentSlide) {
    return null;
  }

  const theme = editedData.theme;
  const layerInfo = selectedElementId ? getLayerInfo(selectedElementId) : null;

  return (
    <div className="ppt-preview">
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageSelected}
      />

      {/* 工具栏 */}
      <div className="ppt-preview-toolbar">
        <div className="toolbar-left">
          <div className="mode-switcher">
            <button
              className={`mode-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={handlePreview}
              title="预览模式"
            >
              <span className="material-icon">visibility</span>
              <span>预览</span>
            </button>
            <button
              className={`mode-btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={handleEdit}
              title="编辑模式"
            >
              <span className="material-icon">edit</span>
              <span>编辑</span>
            </button>
          </div>

          <div className="toolbar-divider" />

          <span className="slide-counter">
            {currentSlideIndex + 1} / {editedData.slides.length}
          </span>
        </div>

        <div className="toolbar-center">
          <button
            className="nav-btn"
            onClick={handlePrevSlide}
            disabled={currentSlideIndex === 0}
            title="上一页 (←)"
          >
            <span className="material-icon">chevron_left</span>
          </button>
          <button
            className="nav-btn"
            onClick={handleNextSlide}
            disabled={currentSlideIndex === editedData.slides.length - 1}
            title="下一页 (→)"
          >
            <span className="material-icon">chevron_right</span>
          </button>
        </div>

        <div className="toolbar-right">
          <button
            className="toolbar-btn theme-btn"
            onClick={() => setShowThemePanel(!showThemePanel)}
            title="主题模板"
          >
            <span className="material-icon">palette</span>
            <span>主题</span>
          </button>

          <button
            className={`toolbar-btn design-btn ${showDesignPanel ? 'active' : ''}`}
            onClick={() => setShowDesignPanel(!showDesignPanel)}
            title="设计面板"
          >
            <span className="material-icon">design_services</span>
            <span>设计</span>
          </button>

          <button
            className="toolbar-btn"
            onClick={handleExport}
            disabled={exporting}
            title="导出为 PPTX"
          >
            <span className="material-icon">{exporting ? 'sync' : 'download'}</span>
            <span>{exporting ? '导出中...' : '导出'}</span>
          </button>

          {isDirty && (
            <button
              className="toolbar-btn save-btn"
              onClick={handleSave}
              disabled={saving}
            >
              <span className="material-icon">{saving ? 'sync' : 'save'}</span>
              <span>{saving ? '保存中...' : '保存'}</span>
            </button>
          )}

          <button className="toolbar-btn close-btn" onClick={handleClose}>
            <span className="material-icon">close</span>
          </button>
        </div>
      </div>

      {/* 编辑工具栏 - 仅在编辑模式显示 */}
      {viewMode === 'edit' && (
        <div className="edit-toolbar">
          <div className="edit-toolbar-group">
            <button
              className="edit-tool-btn edit-tool-btn-with-label"
              onClick={handleAddSlide}
              title="添加幻灯片"
            >
              <span className="material-icon">add</span>
              <span>新建页</span>
            </button>
            <button
              className="edit-tool-btn"
              onClick={handleDuplicateSlide}
              title="复制幻灯片"
            >
              <span className="material-icon">content_copy</span>
            </button>
            <button
              className="edit-tool-btn"
              onClick={handleDeleteSlide}
              disabled={editedData.slides.length <= 1}
              title="删除幻灯片"
            >
              <span className="material-icon">delete</span>
            </button>
          </div>

          <div className="edit-toolbar-divider" />

          <div className="edit-toolbar-group">
            <button
              className="edit-tool-btn edit-tool-btn-with-label"
              onClick={handleAddText}
              title="添加文本框"
            >
              <span className="material-icon">text_fields</span>
              <span>文本</span>
            </button>
            <button
              className="edit-tool-btn"
              onClick={() => handleAddShape('rect')}
              title="添加矩形"
            >
              <span className="material-icon">rectangle</span>
            </button>
            <button
              className="edit-tool-btn"
              onClick={() => handleAddShape('circle')}
              title="添加圆形"
            >
              <span className="material-icon">circle</span>
            </button>
            <button
              className="edit-tool-btn"
              onClick={() => handleAddShape('rounded')}
              title="添加圆角矩形"
            >
              <span className="material-icon">rounded_corner</span>
            </button>
          </div>

          <div className="edit-toolbar-divider" />

          <div className="edit-toolbar-group">
            <button
              className="edit-tool-btn edit-tool-btn-with-label"
              onClick={handleAddImage}
              title="添加图片"
            >
              <span className="material-icon">image</span>
              <span>图片</span>
            </button>
            <button
              className="edit-tool-btn edit-tool-btn-with-label"
              onClick={handleAddTable}
              title="添加表格"
            >
              <span className="material-icon">table_chart</span>
              <span>表格</span>
            </button>
            <div className="chart-dropdown">
              <button
                className="edit-tool-btn edit-tool-btn-with-label"
                title="添加图表"
              >
                <span className="material-icon">bar_chart</span>
                <span>图表</span>
              </button>
              <div className="chart-dropdown-menu">
                {CHART_TYPES.map((ct) => (
                  <button
                    key={ct.type}
                    onClick={() => handleAddChart(ct.type)}
                  >
                    <span className="material-icon">{ct.icon}</span>
                    {ct.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="edit-toolbar-divider" />

          <div className="edit-toolbar-group">
            <button
              className="edit-tool-btn"
              onClick={() => handleAddLine('line')}
              title="添加直线"
            >
              <span className="material-icon">horizontal_rule</span>
            </button>
            <button
              className="edit-tool-btn"
              onClick={() => handleAddLine('arrow')}
              title="添加箭头"
            >
              <span className="material-icon">east</span>
            </button>
            <button
              className="edit-tool-btn"
              onClick={() => handleAddLine('double-arrow')}
              title="添加双向箭头"
            >
              <span className="material-icon">swap_horiz</span>
            </button>
          </div>

          {selectedElementId && (
            <>
              <div className="edit-toolbar-divider" />
              <div className="edit-toolbar-group">
                <button
                  className="edit-tool-btn"
                  onClick={() => setShowPropertiesPanel(!showPropertiesPanel)}
                  title="属性设置"
                >
                  <span className="material-icon">tune</span>
                </button>
                <div className="layer-dropdown">
                  <button
                    className="edit-tool-btn"
                    title="层级"
                  >
                    <span className="material-icon">layers</span>
                  </button>
                  <div className="layer-dropdown-menu">
                    <button
                      onClick={() => bringToFront(selectedElementId)}
                      disabled={layerInfo?.isTop}
                    >
                      <span className="material-icon">vertical_align_top</span>
                      置于顶层
                      <span className="shortcut">⌘⇧]</span>
                    </button>
                    <button
                      onClick={() => bringForward(selectedElementId)}
                      disabled={layerInfo?.isTop}
                    >
                      <span className="material-icon">arrow_upward</span>
                      上移一层
                      <span className="shortcut">⌘]</span>
                    </button>
                    <button
                      onClick={() => sendBackward(selectedElementId)}
                      disabled={layerInfo?.isBottom}
                    >
                      <span className="material-icon">arrow_downward</span>
                      下移一层
                      <span className="shortcut">⌘[</span>
                    </button>
                    <button
                      onClick={() => sendToBack(selectedElementId)}
                      disabled={layerInfo?.isBottom}
                    >
                      <span className="material-icon">vertical_align_bottom</span>
                      置于底层
                      <span className="shortcut">⌘⇧[</span>
                    </button>
                  </div>
                </div>
                <button
                  className="edit-tool-btn"
                  onClick={() => handleDeleteElement(selectedElementId)}
                  title="删除元素 (Delete)"
                  style={{ color: '#dc2626' }}
                >
                  <span className="material-icon">delete_forever</span>
                </button>
              </div>
            </>
          )}

          <div className="edit-toolbar-divider" />

          <div className="edit-toolbar-group">
            <button
              className={`edit-tool-btn edit-tool-btn-with-label ${showSpeakerNotes ? 'active' : ''}`}
              onClick={() => setShowSpeakerNotes(!showSpeakerNotes)}
              title="演讲者备注"
            >
              <span className="material-icon">speaker_notes</span>
              <span>备注</span>
            </button>
          </div>
        </div>
      )}

      {/* 主题面板 */}
      {showThemePanel && (
        <div className="theme-panel">
          <div className="theme-panel-header">
            <h3>选择主题</h3>
            <button onClick={() => setShowThemePanel(false)}>
              <span className="material-icon">close</span>
            </button>
          </div>
          <div className="theme-grid">
            {THEME_TEMPLATES.map((template) => (
              <button
                key={template.id}
                className={`theme-card ${theme?.themeColor === template.theme.themeColor ? 'active' : ''}`}
                onClick={() => handleApplyTheme(template.theme)}
              >
                <div
                  className="theme-preview"
                  style={{
                    backgroundColor: template.theme.backgroundColor,
                    borderColor: template.theme.themeColor,
                  }}
                >
                  <div
                    className="theme-title-bar"
                    style={{ backgroundColor: template.theme.themeColor }}
                  />
                  <div
                    className="theme-text"
                    style={{ color: template.theme.fontColor }}
                  >
                    Aa
                  </div>
                </div>
                <span className="theme-name">{template.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 属性面板 */}
      {showPropertiesPanel && selectedElement && viewMode === 'edit' && (
        <ElementPropertiesPanel
          element={selectedElement}
          onUpdate={(updates) => handleUpdateElement(selectedElement.id, updates)}
          onClose={() => setShowPropertiesPanel(false)}
        />
      )}

      {/* 设计面板 */}
      {showDesignPanel && editedData && currentSlide && (
        <DesignPanel
          pptData={editedData}
          currentSlide={currentSlide}
          currentSlideIndex={currentSlideIndex}
          onUpdateSlide={handleUpdateSlide}
          onUpdateAllSlides={handleUpdateAllSlides}
          onUpdateTheme={handleUpdateTheme}
          onUpdateSlideSize={handleUpdateSlideSize}
          onUpdateDefaultTransition={handleUpdateDefaultTransition}
          onClose={() => setShowDesignPanel(false)}
        />
      )}

      {/* 主内容区域 */}
      <div className="ppt-preview-main">
        {/* 缩略图侧边栏 */}
        <div className="ppt-preview-sidebar">
          {editedData.slides.map((slide, index) => (
            <button
              key={slide.id}
              className={`thumbnail-item ${index === currentSlideIndex ? 'active' : ''}`}
              onClick={() => setCurrentSlideIndex(index)}
              onContextMenu={(e) => handleSlideContextMenu(e, index)}
            >
              <span className="thumbnail-number">{index + 1}</span>
              <div className="thumbnail-preview">
                <SlideRenderer
                  slide={slide}
                  theme={theme}
                  mini
                  slideWidth={slideWidth}
                  slideHeight={slideHeight}
                />
              </div>
            </button>
          ))}
        </div>

        {/* 幻灯片预览/编辑区域 */}
        <div
          className="ppt-preview-content"
          onClick={() => viewMode === 'edit' && handleSelectElement(null)}
        >
          <div className="slide-container" ref={slideContainerRef}>
            <SlideRenderer
              slide={currentSlide}
              theme={theme}
              editable={viewMode === 'edit'}
              selectedElementId={selectedElementId}
              scale={scale}
              slideWidth={slideWidth}
              slideHeight={slideHeight}
              onSelectElement={handleSelectElement}
              onUpdateElement={handleUpdateElement}
              onContextMenu={handleElementContextMenu}
              onDragStart={handleDragStart}
              isDragging={isDragging}
            />
          </div>
        </div>
      </div>

      {/* 演讲者备注面板 */}
      {showSpeakerNotes && viewMode === 'edit' && editedData && currentSlide && (
        <SpeakerNotesPanel
          notes={currentSlide.notes || ''}
          slideIndex={currentSlideIndex}
          totalSlides={editedData.slides.length}
          onUpdateNotes={handleUpdateNotes}
          onClose={() => setShowSpeakerNotes(false)}
        />
      )}

      {/* 右键菜单 */}
      {contextMenu && (
        <div
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'slide' && (
            <>
              <button className="context-menu-item" onClick={handleAddSlide}>
                <span className="material-icon">add</span>
                新建幻灯片
              </button>
              <button className="context-menu-item" onClick={handleDuplicateSlide}>
                <span className="material-icon">content_copy</span>
                复制幻灯片
              </button>
              <div className="context-menu-divider" />
              <button
                className="context-menu-item danger"
                onClick={handleDeleteSlide}
                disabled={editedData.slides.length <= 1}
              >
                <span className="material-icon">delete</span>
                删除幻灯片
              </button>
            </>
          )}
          {contextMenu.type === 'element' && contextMenu.targetId && (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  handleCopyElement(contextMenu.targetId!);
                  setContextMenu(null);
                }}
              >
                <span className="material-icon">content_copy</span>
                复制元素
              </button>
              <div className="context-menu-divider" />
              <button
                className="context-menu-item"
                onClick={() => {
                  bringToFront(contextMenu.targetId!);
                  setContextMenu(null);
                }}
              >
                <span className="material-icon">vertical_align_top</span>
                置于顶层
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  sendToBack(contextMenu.targetId!);
                  setContextMenu(null);
                }}
              >
                <span className="material-icon">vertical_align_bottom</span>
                置于底层
              </button>
              <div className="context-menu-divider" />
              <button
                className="context-menu-item danger"
                onClick={() => {
                  handleDeleteElement(contextMenu.targetId!);
                  setContextMenu(null);
                }}
              >
                <span className="material-icon">delete</span>
                删除元素
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 幻灯片渲染组件
interface SlideRendererProps {
  slide: PptistSlide;
  theme?: PptTheme;
  mini?: boolean;
  editable?: boolean;
  selectedElementId?: string | null;
  scale?: number;
  slideWidth?: number;
  slideHeight?: number;
  onSelectElement?: (id: string | null) => void;
  onUpdateElement?: (elementId: string, updates: Partial<PptistElement>) => void;
  onContextMenu?: (e: React.MouseEvent, elementId: string) => void;
  onDragStart?: (
    e: React.MouseEvent,
    elementId: string,
    left: number,
    top: number
  ) => void;
  isDragging?: boolean;
}

function SlideRenderer({
  slide,
  theme,
  mini,
  editable,
  selectedElementId,
  scale = 1,
  slideWidth = DEFAULT_SLIDE_WIDTH,
  slideHeight = DEFAULT_SLIDE_HEIGHT,
  onSelectElement,
  onUpdateElement,
  onContextMenu,
  onDragStart,
  isDragging,
}: SlideRendererProps) {
  const bgColor = slide.background?.color || theme?.backgroundColor || '#ffffff';

  // 计算渐变背景样式
  let backgroundStyle: React.CSSProperties = { backgroundColor: bgColor };
  if (slide.background?.type === 'gradient' && slide.background.gradient) {
    const { angle = 90, colors = ['#ffffff', '#e0e0e0'] } = slide.background.gradient;
    backgroundStyle = {
      background: `linear-gradient(${angle}deg, ${colors[0]}, ${colors[1]})`,
    };
  }

  return (
    <div
      className={`slide-renderer ${mini ? 'mini' : ''}`}
      style={backgroundStyle}
    >
      {slide.elements.map((element) => (
        <SlideElement
          key={element.id}
          element={element}
          theme={theme}
          mini={mini}
          editable={editable}
          isSelected={selectedElementId === element.id}
          scale={scale}
          slideWidth={slideWidth}
          slideHeight={slideHeight}
          onSelect={onSelectElement}
          onUpdate={onUpdateElement}
          onContextMenu={onContextMenu}
          onDragStart={onDragStart}
          isDragging={isDragging && selectedElementId === element.id}
        />
      ))}
    </div>
  );
}

// 幻灯片元素组件
interface SlideElementProps {
  element: PptistElement;
  theme?: PptTheme;
  mini?: boolean;
  editable?: boolean;
  isSelected?: boolean;
  scale?: number;
  slideWidth?: number;
  slideHeight?: number;
  onSelect?: (id: string | null) => void;
  onUpdate?: (elementId: string, updates: Partial<PptistElement>) => void;
  onContextMenu?: (e: React.MouseEvent, elementId: string) => void;
  onDragStart?: (
    e: React.MouseEvent,
    elementId: string,
    left: number,
    top: number
  ) => void;
  isDragging?: boolean;
}

function SlideElement({
  element,
  theme,
  mini,
  editable,
  isSelected,
  scale = 1,
  slideWidth = DEFAULT_SLIDE_WIDTH,
  slideHeight = DEFAULT_SLIDE_HEIGHT,
  onSelect,
  onUpdate,
  onContextMenu,
  onDragStart,
  isDragging,
}: SlideElementProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(element.content || '');

  // 从 element 中提取样式
  const extra = element as Record<string, unknown>;
  const fontSize = (extra.fontSize as number) || 24;
  const fontWeight = (extra.fontWeight as string) || 'normal';
  const fontStyle = (extra.fontStyle as string) || 'normal';
  const textDecoration = (extra.textDecoration as string) || 'none';
  const textAlign = (extra.textAlign as 'left' | 'center' | 'right') || 'left';
  const lineHeight = (extra.lineHeight as number) || 1.4;
  const fontFamily = (extra.fontFamily as string) || 'Microsoft YaHei';
  const color = (extra.defaultColor as string) || theme?.fontColor || '#333333';
  const fill = (extra.fill as string) || theme?.themeColor || '#5AA7A0';
  const fillOpacity = (extra.fillOpacity as number) ?? 1;
  const stroke = (extra.stroke as string) || 'transparent';
  const strokeWidth = (extra.strokeWidth as number) || 0;
  const strokeStyle = (extra.strokeStyle as string) || 'solid';
  const borderRadius = (extra.borderRadius as number) || 0;
  const shapeType = (extra.shapeType as string) || 'rect';

  const handleClick = (e: React.MouseEvent) => {
    if (editable && !mini) {
      e.stopPropagation();
      onSelect?.(element.id);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editable && !mini && !isEditing && onDragStart) {
      e.preventDefault();
      onDragStart(e, element.id, element.left, element.top);
    }
  };

  const handleDoubleClick = () => {
    if (editable && !mini && element.type === 'text') {
      setIsEditing(true);
      setEditValue(element.content || '');
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (editValue !== element.content && onUpdate) {
      onUpdate(element.id, { content: editValue });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleBlur();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(element.content || '');
    }
  };

  const handleContextMenuLocal = (e: React.MouseEvent) => {
    if (editable && !mini && onContextMenu) {
      onContextMenu(e, element.id);
    }
  };

  // 处理缩放调整
  const handleResize = (
    _elementId: string,
    updates: { left?: number; top?: number; width?: number; height?: number }
  ) => {
    if (onUpdate) {
      onUpdate(element.id, updates);
    }
  };

  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${(element.left / slideWidth) * 100}%`,
    top: `${(element.top / slideHeight) * 100}%`,
    width: `${(element.width / slideWidth) * 100}%`,
    height: `${(element.height / slideHeight) * 100}%`,
    transform: element.rotate ? `rotate(${element.rotate}deg)` : undefined,
    cursor: editable && !mini ? (isDragging ? 'grabbing' : 'grab') : 'default',
  };

  // 渲染线条元素
  if (element.type === 'line') {
    const lineType = (extra.lineType as string) || 'line';
    const lineStroke = (extra.stroke as string) || '#5AA7A0';
    const lineStrokeWidth = (extra.strokeWidth as number) || 2;
    const lineStrokeStyle = (extra.strokeStyle as string) || 'solid';

    // 计算线条的实际像素尺寸
    const lineWidth = element.width;
    const lineHeight = Math.max(element.height, lineStrokeWidth + 10);

    const lineStyle: React.CSSProperties = {
      ...style,
      height: `${(lineHeight / slideHeight) * 100}%`,
      overflow: 'visible',
    };

    // 根据线条样式设置 stroke-dasharray
    let strokeDasharray = 'none';
    if (lineStrokeStyle === 'dashed') {
      strokeDasharray = '8,4';
    } else if (lineStrokeStyle === 'dotted') {
      strokeDasharray = '2,3';
    }

    return (
      <div
        className={`slide-element line-element ${editable && !mini ? 'editable' : ''} ${isSelected ? 'selected' : ''}`}
        style={lineStyle}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenuLocal}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${lineWidth} ${lineHeight}`}
          preserveAspectRatio="none"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <marker
              id={`arrowhead-${element.id}`}
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={lineStroke}
              />
            </marker>
            <marker
              id={`arrowhead-start-${element.id}`}
              markerWidth="10"
              markerHeight="7"
              refX="1"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="10 0, 0 3.5, 10 7"
                fill={lineStroke}
              />
            </marker>
          </defs>
          <line
            x1="5"
            y1={lineHeight / 2}
            x2={lineWidth - 5}
            y2={lineHeight / 2}
            stroke={lineStroke}
            strokeWidth={lineStrokeWidth}
            strokeDasharray={strokeDasharray}
            markerEnd={lineType === 'arrow' || lineType === 'double-arrow' ? `url(#arrowhead-${element.id})` : undefined}
            markerStart={lineType === 'double-arrow' ? `url(#arrowhead-start-${element.id})` : undefined}
          />
        </svg>
        {isSelected && editable && !mini && (
          <ResizeHandles
            elementId={element.id}
            elementLeft={element.left}
            elementTop={element.top}
            elementWidth={element.width}
            elementHeight={element.height}
            scale={scale}
            minWidth={40}
            minHeight={2}
            onResize={handleResize}
          />
        )}
      </div>
    );
  }

  // 渲染形状元素
  if (element.type === 'shape') {
    let shapeStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      backgroundColor: fill,
      opacity: fillOpacity,
      border:
        strokeWidth > 0 ? `${strokeWidth}px ${strokeStyle} ${stroke}` : 'none',
    };

    if (shapeType === 'circle') {
      shapeStyle.borderRadius = '50%';
    } else if (shapeType === 'rounded') {
      shapeStyle.borderRadius = borderRadius > 0 ? `${borderRadius}px` : '12px';
    } else {
      shapeStyle.borderRadius = borderRadius > 0 ? `${borderRadius}px` : '4px';
    }

    return (
      <div
        className={`slide-element shape-element ${editable && !mini ? 'editable' : ''} ${isSelected ? 'selected' : ''}`}
        style={style}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenuLocal}
      >
        <div style={shapeStyle} />
        {isSelected && editable && !mini && (
          <ResizeHandles
            elementId={element.id}
            elementLeft={element.left}
            elementTop={element.top}
            elementWidth={element.width}
            elementHeight={element.height}
            scale={scale}
            minWidth={20}
            minHeight={20}
            onResize={handleResize}
          />
        )}
      </div>
    );
  }

  // 渲染图片元素
  if (element.type === 'image') {
    return (
      <div
        className={`slide-element image-element ${editable && !mini ? 'editable' : ''} ${isSelected ? 'selected' : ''}`}
        style={style}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenuLocal}
      >
        <img src={element.content} alt="" />
        {isSelected && editable && !mini && (
          <ResizeHandles
            elementId={element.id}
            elementLeft={element.left}
            elementTop={element.top}
            elementWidth={element.width}
            elementHeight={element.height}
            scale={scale}
            minWidth={40}
            minHeight={40}
            onResize={handleResize}
          />
        )}
      </div>
    );
  }

  // 渲染文本元素
  if (element.type === 'text') {
    const textStyle: React.CSSProperties = {
      ...style,
      fontSize: mini ? `${fontSize * 0.12}px` : `${fontSize}px`,
      fontWeight,
      fontStyle,
      textDecoration,
      fontFamily,
      textAlign: textAlign as 'left' | 'center' | 'right',
      color,
      lineHeight,
      overflow: 'hidden',
    };

    if (isEditing) {
      return (
        <textarea
          className="slide-element-editor"
          style={textStyle}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      );
    }

    return (
      <div
        className={`slide-element text-element ${editable && !mini ? 'editable' : ''} ${isSelected ? 'selected' : ''}`}
        style={textStyle}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenuLocal}
        title={editable && !mini ? '双击编辑文本' : undefined}
      >
        {element.content}
        {isSelected && editable && !mini && (
          <ResizeHandles
            elementId={element.id}
            elementLeft={element.left}
            elementTop={element.top}
            elementWidth={element.width}
            elementHeight={element.height}
            scale={scale}
            minWidth={40}
            minHeight={20}
            onResize={handleResize}
          />
        )}
      </div>
    );
  }

  // 渲染表格元素
  if (element.type === 'table') {
    return (
      <div
        className={`slide-element table-element ${editable && !mini ? 'editable' : ''} ${isSelected ? 'selected' : ''}`}
        style={style}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenuLocal}
      >
        <TableElement
          element={element as unknown as PptTableElement}
          editable={editable && !mini}
          mini={mini}
          onUpdate={onUpdate ? (updates) => onUpdate(element.id, updates as Partial<PptistElement>) : undefined}
        />
        {isSelected && editable && !mini && (
          <ResizeHandles
            elementId={element.id}
            elementLeft={element.left}
            elementTop={element.top}
            elementWidth={element.width}
            elementHeight={element.height}
            scale={scale}
            minWidth={100}
            minHeight={60}
            onResize={handleResize}
          />
        )}
      </div>
    );
  }

  // 渲染图表元素
  if (element.type === 'chart') {
    return (
      <div
        className={`slide-element chart-element ${editable && !mini ? 'editable' : ''} ${isSelected ? 'selected' : ''}`}
        style={style}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onContextMenu={handleContextMenuLocal}
      >
        <ChartElement
          element={element as unknown as PptChartElement}
          mini={mini}
          onUpdate={onUpdate ? (updates) => onUpdate(element.id, updates as Partial<PptistElement>) : undefined}
        />
        {isSelected && editable && !mini && (
          <ResizeHandles
            elementId={element.id}
            elementLeft={element.left}
            elementTop={element.top}
            elementWidth={element.width}
            elementHeight={element.height}
            scale={scale}
            minWidth={200}
            minHeight={150}
            onResize={handleResize}
          />
        )}
      </div>
    );
  }

  return null;
}
