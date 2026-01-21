// PPT 设计面板组件
// 提供背景设置、全局主题、预置主题、尺寸设置、切换效果等功能
// 参考 PPTist 设计，位于编辑器右侧

import { useState, useCallback, useEffect } from 'react';
import type {
  PptData,
  PptistSlide,
  PptTheme,
  SlideSize,
  SlideSizePreset,
  SlideTransition,
  TransitionType,
  TransitionDirection
} from '../../../types';
import './DesignPanel.css';

// 预置主题
interface PresetTheme {
  id: string;
  name: string;
  colors: readonly string[];
  theme: PptTheme;
}

const PRESET_THEMES: readonly PresetTheme[] = [
  {
    id: 'default',
    name: '默认',
    colors: ['#5AA7A0', '#4A90A0', '#F5A623', '#333333', '#FFFFFF'],
    theme: {
      themeColor: '#5AA7A0',
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'business-blue',
    name: '商务蓝',
    colors: ['#1E88E5', '#1565C0', '#FF6F00', '#1e293b', '#FFFFFF'],
    theme: {
      themeColor: '#1E88E5',
      fontColor: '#1e293b',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'vitality-orange',
    name: '活力橙',
    colors: ['#FF6F00', '#E65100', '#1E88E5', '#1c1917', '#fffbeb'],
    theme: {
      themeColor: '#FF6F00',
      fontColor: '#1c1917',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#fffbeb',
    },
  },
  {
    id: 'elegant-purple',
    name: '优雅紫',
    colors: ['#7B1FA2', '#6A1B9A', '#FFC107', '#1e1b4b', '#faf5ff'],
    theme: {
      themeColor: '#7B1FA2',
      fontColor: '#1e1b4b',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#faf5ff',
    },
  },
  {
    id: 'nature-green',
    name: '自然绿',
    colors: ['#43A047', '#2E7D32', '#FF5722', '#14532d', '#f0fdf4'],
    theme: {
      themeColor: '#43A047',
      fontColor: '#14532d',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#f0fdf4',
    },
  },
  {
    id: 'dark-mode',
    name: '深色',
    colors: ['#90CAF9', '#64B5F6', '#FF8A65', '#f1f5f9', '#1E1E1E'],
    theme: {
      themeColor: '#90CAF9',
      fontColor: '#f1f5f9',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#1E1E1E',
    },
  },
  {
    id: 'minimalist',
    name: '极简',
    colors: ['#212121', '#424242', '#FF5252', '#333333', '#FAFAFA'],
    theme: {
      themeColor: '#212121',
      fontColor: '#333333',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#FAFAFA',
    },
  },
  {
    id: 'warm-red',
    name: '温暖红',
    colors: ['#E53935', '#C62828', '#FFC107', '#1c1917', '#FFFFFF'],
    theme: {
      themeColor: '#E53935',
      fontColor: '#1c1917',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'ocean-blue',
    name: '海洋蓝',
    colors: ['#0288D1', '#01579B', '#00BCD4', '#0c4a6e', '#FFFFFF'],
    theme: {
      themeColor: '#0288D1',
      fontColor: '#0c4a6e',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'forest',
    name: '森林',
    colors: ['#558B2F', '#33691E', '#8D6E63', '#1a2e05', '#FFFFFF'],
    theme: {
      themeColor: '#558B2F',
      fontColor: '#1a2e05',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#ffffff',
    },
  },
  {
    id: 'sunset',
    name: '日落',
    colors: ['#F57C00', '#EF6C00', '#D32F2F', '#431407', '#FFF8E1'],
    theme: {
      themeColor: '#F57C00',
      fontColor: '#431407',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#FFF8E1',
    },
  },
  {
    id: 'tech',
    name: '科技',
    colors: ['#00BCD4', '#0097A7', '#7C4DFF', '#164e63', '#ECEFF1'],
    theme: {
      themeColor: '#00BCD4',
      fontColor: '#164e63',
      fontName: 'Microsoft YaHei',
      backgroundColor: '#ECEFF1',
    },
  },
] as const;

// 背景类型
type BackgroundType = 'solid' | 'gradient';

// 渐变方向
interface GradientDirection {
  value: number;
  label: string;
  title: string;
}

const GRADIENT_DIRECTIONS: readonly GradientDirection[] = [
  { value: 0, label: '→', title: '从左到右' },
  { value: 45, label: '↗', title: '从左下到右上' },
  { value: 90, label: '↑', title: '从下到上' },
  { value: 135, label: '↖', title: '从右下到左上' },
  { value: 180, label: '←', title: '从右到左' },
  { value: 225, label: '↙', title: '从右上到左下' },
  { value: 270, label: '↓', title: '从上到下' },
  { value: 315, label: '↘', title: '从左上到右下' },
] as const;

// 幻灯片尺寸预设
interface SizePreset {
  preset: SlideSizePreset;
  label: string;
  width: number;
  height: number;
}

const SIZE_PRESETS: readonly SizePreset[] = [
  { preset: '16:9', label: '16:9 宽屏', width: 1000, height: 562.5 },
  { preset: '4:3', label: '4:3 标准', width: 1000, height: 750 },
  { preset: '16:10', label: '16:10', width: 1000, height: 625 },
  { preset: 'A4', label: 'A4 纵向', width: 794, height: 1123 },
] as const;

// 切换效果预设
interface TransitionPreset {
  type: TransitionType;
  label: string;
  icon: string;
}

const TRANSITION_TYPES: readonly TransitionPreset[] = [
  { type: 'none', label: '无', icon: 'block' },
  { type: 'fade', label: '淡入淡出', icon: 'blur_on' },
  { type: 'slide', label: '滑动', icon: 'swap_horiz' },
  { type: 'push', label: '推入', icon: 'arrow_forward' },
  { type: 'wipe', label: '擦除', icon: 'gradient' },
  { type: 'zoom', label: '缩放', icon: 'zoom_in' },
  { type: 'flip', label: '翻转', icon: 'flip' },
] as const;

// 切换方向
interface DirectionPreset {
  direction: TransitionDirection;
  label: string;
  icon: string;
}

const TRANSITION_DIRECTIONS: readonly DirectionPreset[] = [
  { direction: 'left', label: '向左', icon: 'arrow_back' },
  { direction: 'right', label: '向右', icon: 'arrow_forward' },
  { direction: 'up', label: '向上', icon: 'arrow_upward' },
  { direction: 'down', label: '向下', icon: 'arrow_downward' },
] as const;

// 切换时长预设（毫秒）
interface DurationPreset {
  value: number;
  label: string;
}

const DURATION_PRESETS: readonly DurationPreset[] = [
  { value: 300, label: '快速' },
  { value: 500, label: '中速' },
  { value: 800, label: '慢速' },
  { value: 1200, label: '很慢' },
] as const;

interface DesignPanelProps {
  pptData: PptData;
  currentSlide: PptistSlide;
  currentSlideIndex: number;
  onUpdateSlide: (updates: Partial<PptistSlide>) => void;
  onUpdateAllSlides: (updater: (slide: PptistSlide) => PptistSlide) => void;
  onUpdateTheme: (theme: PptTheme) => void;
  onUpdateSlideSize: (size: SlideSize) => void;
  onUpdateDefaultTransition: (transition: SlideTransition) => void;
  onClose: () => void;
}

export function DesignPanel({
  pptData,
  currentSlide,
  currentSlideIndex,
  onUpdateSlide,
  onUpdateAllSlides,
  onUpdateTheme,
  onUpdateSlideSize,
  onUpdateDefaultTransition,
  onClose,
}: DesignPanelProps) {
  const [activeTab, setActiveTab] = useState<'design' | 'transition'>('design');
  const [backgroundType, setBackgroundType] = useState<BackgroundType>(
    currentSlide.background?.type === 'gradient' ? 'gradient' : 'solid'
  );
  const [gradientAngle, setGradientAngle] = useState(
    currentSlide.background?.gradient?.angle || 90
  );
  const [gradientColor1, setGradientColor1] = useState(
    currentSlide.background?.gradient?.colors?.[0] || '#ffffff'
  );
  const [gradientColor2, setGradientColor2] = useState(
    currentSlide.background?.gradient?.colors?.[1] || '#e0e0e0'
  );

  // 切换效果状态
  const currentTransition = currentSlide.transition || pptData.defaultTransition || {
    type: 'none' as TransitionType,
    duration: 500,
  };
  const [transitionType, setTransitionType] = useState<TransitionType>(currentTransition.type);
  const [transitionDirection, setTransitionDirection] = useState<TransitionDirection>(
    currentTransition.direction || 'left'
  );
  const [transitionDuration, setTransitionDuration] = useState(currentTransition.duration);

  // 同步切换效果状态
  useEffect(() => {
    const t = currentSlide.transition || pptData.defaultTransition || { type: 'none' as TransitionType, duration: 500 };
    setTransitionType(t.type);
    setTransitionDirection(t.direction || 'left');
    setTransitionDuration(t.duration);
  }, [currentSlide.transition, pptData.defaultTransition]);

  const theme = pptData.theme;
  const slideSize = pptData.slideSize || { preset: '16:9' as SlideSizePreset, width: 1000, height: 562.5 };

  // 更新背景色
  const handleBackgroundColorChange = useCallback(
    (color: string) => {
      onUpdateSlide({
        background: {
          type: 'solid',
          color,
        },
      });
    },
    [onUpdateSlide]
  );

  // 更新渐变背景
  const handleGradientChange = useCallback(
    (angle: number, color1: string, color2: string) => {
      setGradientAngle(angle);
      setGradientColor1(color1);
      setGradientColor2(color2);
      onUpdateSlide({
        background: {
          type: 'gradient',
          gradient: {
            type: 'linear',
            angle,
            colors: [color1, color2],
          },
        },
      });
    },
    [onUpdateSlide]
  );

  // 应用背景到全部幻灯片
  const handleApplyBackgroundToAll = useCallback(() => {
    const bg = currentSlide.background;
    onUpdateAllSlides((slide) => ({
      ...slide,
      background: bg,
    }));
  }, [currentSlide.background, onUpdateAllSlides]);

  // 应用主题到全部幻灯片
  const handleApplyThemeToAll = useCallback(
    (newTheme: PptTheme) => {
      onUpdateTheme(newTheme);
      onUpdateAllSlides((slide) => ({
        ...slide,
        background: {
          type: 'solid',
          color: newTheme.backgroundColor,
        },
        elements: slide.elements.map((el) => ({
          ...el,
          defaultColor: el.type === 'text' ? newTheme.fontColor : el.defaultColor,
        })),
      }));
    },
    [onUpdateTheme, onUpdateAllSlides]
  );

  // 更新主题色
  const handleThemeColorChange = useCallback(
    (themeColor: string) => {
      if (theme) {
        onUpdateTheme({
          ...theme,
          themeColor,
        });
      }
    },
    [theme, onUpdateTheme]
  );

  // 更新字体颜色
  const handleFontColorChange = useCallback(
    (fontColor: string) => {
      if (theme) {
        onUpdateTheme({
          ...theme,
          fontColor,
        });
      }
    },
    [theme, onUpdateTheme]
  );

  // 更新幻灯片尺寸
  const handleSizeChange = useCallback(
    (preset: SlideSizePreset) => {
      const sizePreset = SIZE_PRESETS.find((s) => s.preset === preset);
      if (sizePreset) {
        onUpdateSlideSize({
          preset,
          width: sizePreset.width,
          height: sizePreset.height,
        });
      }
    },
    [onUpdateSlideSize]
  );

  // 更新当前幻灯片切换效果
  const handleTransitionChange = useCallback(
    (type: TransitionType, direction?: TransitionDirection, duration?: number) => {
      const newTransition: SlideTransition = {
        type,
        direction: direction || transitionDirection,
        duration: duration || transitionDuration,
      };
      setTransitionType(type);
      if (direction) setTransitionDirection(direction);
      if (duration) setTransitionDuration(duration);
      onUpdateSlide({ transition: newTransition });
    },
    [transitionDirection, transitionDuration, onUpdateSlide]
  );

  // 应用切换效果到全部幻灯片
  const handleApplyTransitionToAll = useCallback(() => {
    const transition: SlideTransition = {
      type: transitionType,
      direction: transitionDirection,
      duration: transitionDuration,
    };
    onUpdateDefaultTransition(transition);
    onUpdateAllSlides((slide) => ({
      ...slide,
      transition,
    }));
  }, [transitionType, transitionDirection, transitionDuration, onUpdateDefaultTransition, onUpdateAllSlides]);

  return (
    <div className="design-panel">
      <div className="design-panel-header">
        <div className="design-panel-tabs">
          <button
            className={`tab-btn ${activeTab === 'design' ? 'active' : ''}`}
            onClick={() => setActiveTab('design')}
          >
            设计
          </button>
          <button
            className={`tab-btn ${activeTab === 'transition' ? 'active' : ''}`}
            onClick={() => setActiveTab('transition')}
          >
            切换
          </button>
        </div>
        <button className="close-btn" onClick={onClose}>
          <span className="material-icon">close</span>
        </button>
      </div>

      <div className="design-panel-content">
        {activeTab === 'design' && (
          <>
            {/* 背景填充 */}
            <div className="panel-section">
              <div className="section-header">
                <span>背景填充</span>
              </div>
              <div className="section-content">
                <div className="background-type-selector">
                  <button
                    className={`type-btn ${backgroundType === 'solid' ? 'active' : ''}`}
                    onClick={() => setBackgroundType('solid')}
                  >
                    纯色
                  </button>
                  <button
                    className={`type-btn ${backgroundType === 'gradient' ? 'active' : ''}`}
                    onClick={() => setBackgroundType('gradient')}
                  >
                    渐变
                  </button>
                </div>

                {backgroundType === 'solid' && (
                  <div className="color-picker-row">
                    <label>颜色</label>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={currentSlide.background?.color || '#ffffff'}
                        onChange={(e) => handleBackgroundColorChange(e.target.value)}
                      />
                      <span className="color-value">
                        {currentSlide.background?.color || '#ffffff'}
                      </span>
                    </div>
                  </div>
                )}

                {backgroundType === 'gradient' && (
                  <>
                    <div className="color-picker-row">
                      <label>颜色 1</label>
                      <div className="color-input-group">
                        <input
                          type="color"
                          value={gradientColor1}
                          onChange={(e) =>
                            handleGradientChange(gradientAngle, e.target.value, gradientColor2)
                          }
                        />
                        <span className="color-value">{gradientColor1}</span>
                      </div>
                    </div>
                    <div className="color-picker-row">
                      <label>颜色 2</label>
                      <div className="color-input-group">
                        <input
                          type="color"
                          value={gradientColor2}
                          onChange={(e) =>
                            handleGradientChange(gradientAngle, gradientColor1, e.target.value)
                          }
                        />
                        <span className="color-value">{gradientColor2}</span>
                      </div>
                    </div>
                    <div className="gradient-direction">
                      <label>方向</label>
                      <div className="direction-buttons">
                        {GRADIENT_DIRECTIONS.map((dir) => (
                          <button
                            key={dir.value}
                            className={`direction-btn ${gradientAngle === dir.value ? 'active' : ''}`}
                            onClick={() =>
                              handleGradientChange(dir.value, gradientColor1, gradientColor2)
                            }
                            title={dir.title}
                          >
                            {dir.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <button
                  className="apply-all-btn"
                  onClick={handleApplyBackgroundToAll}
                >
                  <span className="material-icon">done_all</span>
                  应用背景到全部
                </button>
              </div>
            </div>

            {/* 幻灯片信息 */}
            <div className="panel-section">
              <div className="section-header">
                <span>幻灯片</span>
              </div>
              <div className="section-content">
                <div className="slide-info">
                  <span>页码: {currentSlideIndex + 1} / {pptData.slides.length}</span>
                </div>
                <div className="slide-info">
                  <span>尺寸: {slideSize.width} × {slideSize.height}</span>
                </div>
                <div className="size-selector">
                  <label>画布尺寸</label>
                  <div className="size-buttons">
                    {SIZE_PRESETS.map((size) => (
                      <button
                        key={size.preset}
                        className={`size-btn ${slideSize.preset === size.preset ? 'active' : ''}`}
                        onClick={() => handleSizeChange(size.preset)}
                        title={`${size.width} × ${size.height}`}
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 全局主题 */}
            <div className="panel-section">
              <div className="section-header">
                <span>全局主题</span>
              </div>
              <div className="section-content">
                <div className="color-picker-row">
                  <label>主题色</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      value={theme?.themeColor || '#5AA7A0'}
                      onChange={(e) => handleThemeColorChange(e.target.value)}
                    />
                    <span className="color-value">{theme?.themeColor || '#5AA7A0'}</span>
                  </div>
                </div>
                <div className="color-picker-row">
                  <label>字体颜色</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      value={theme?.fontColor || '#333333'}
                      onChange={(e) => handleFontColorChange(e.target.value)}
                    />
                    <span className="color-value">{theme?.fontColor || '#333333'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 预置主题 */}
            <div className="panel-section">
              <div className="section-header">
                <span>预置主题</span>
              </div>
              <div className="section-content">
                <div className="preset-themes-grid">
                  {PRESET_THEMES.map((preset) => (
                    <button
                      key={preset.id}
                      className={`preset-theme-card ${theme?.themeColor === preset.theme.themeColor ? 'active' : ''}`}
                      onClick={() => handleApplyThemeToAll(preset.theme)}
                      title={preset.name}
                    >
                      <div
                        className="theme-preview"
                        style={{ backgroundColor: preset.theme.backgroundColor }}
                      >
                        <span
                          className="theme-text"
                          style={{ color: preset.theme.fontColor }}
                        >
                          Aa
                        </span>
                      </div>
                      <div className="theme-colors">
                        {preset.colors.slice(0, 5).map((color, i) => (
                          <div
                            key={i}
                            className="color-dot"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <span className="theme-name">{preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'transition' && (
          <>
            {/* 切换效果类型 */}
            <div className="panel-section">
              <div className="section-header">
                <span>切换效果</span>
              </div>
              <div className="section-content">
                <div className="transition-grid">
                  {TRANSITION_TYPES.map((t) => (
                    <button
                      key={t.type}
                      className={`transition-btn ${transitionType === t.type ? 'active' : ''}`}
                      onClick={() => handleTransitionChange(t.type)}
                      title={t.label}
                    >
                      <span className="material-icon">{t.icon}</span>
                      <span className="transition-label">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 切换方向 - 仅在部分效果下显示 */}
            {transitionType !== 'none' && transitionType !== 'fade' && transitionType !== 'zoom' && (
              <div className="panel-section">
                <div className="section-header">
                  <span>方向</span>
                </div>
                <div className="section-content">
                  <div className="direction-grid">
                    {TRANSITION_DIRECTIONS.map((d) => (
                      <button
                        key={d.direction}
                        className={`direction-btn ${transitionDirection === d.direction ? 'active' : ''}`}
                        onClick={() => handleTransitionChange(transitionType, d.direction)}
                        title={d.label}
                      >
                        <span className="material-icon">{d.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 切换时长 */}
            {transitionType !== 'none' && (
              <div className="panel-section">
                <div className="section-header">
                  <span>时长</span>
                </div>
                <div className="section-content">
                  <div className="duration-selector">
                    {DURATION_PRESETS.map((d) => (
                      <button
                        key={d.value}
                        className={`duration-btn ${transitionDuration === d.value ? 'active' : ''}`}
                        onClick={() => handleTransitionChange(transitionType, undefined, d.value)}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <div className="duration-display">
                    <span>{transitionDuration}ms</span>
                  </div>
                </div>
              </div>
            )}

            {/* 应用到全部 */}
            <div className="panel-section">
              <div className="section-content">
                <button
                  className="apply-all-btn"
                  onClick={handleApplyTransitionToAll}
                >
                  <span className="material-icon">done_all</span>
                  应用到全部幻灯片
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
