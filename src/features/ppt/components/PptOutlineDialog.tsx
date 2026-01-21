// PPT 大纲对话框组件

import { useState, useCallback, useEffect } from 'react';
import { safeInvoke } from '../../../utils/tauri';
import { useChatStore } from '../../studio/stores/chatStore';
import { useSourcesStore } from '../../studio/stores/sourcesStore';
import { usePptStore } from '../stores/pptStore';
import { generatePptOutline, getLayoutLabel } from '../services/outlineService';
import { PptOutline, SlideOutline } from '../../../types';
import './PptOutlineDialog.css';

interface PptOutlineDialogProps {
  isOpen: boolean;
  projectId: string;
  onClose: () => void;
  onCreated: (pptId: string) => void;
}

type DialogStep = 'config' | 'generating' | 'preview' | 'creating';

export function PptOutlineDialog({
  isOpen,
  projectId,
  onClose,
  onCreated,
}: PptOutlineDialogProps) {
  const { selectedIds, sources } = useSourcesStore();
  const { aiConfig, loadAiConfig } = useChatStore();
  const { createPpt } = usePptStore();

  const [step, setStep] = useState<DialogStep>('config');
  const [outline, setOutline] = useState<PptOutline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [style, setStyle] = useState('');

  // 对话框打开时加载 AI 配置
  useEffect(() => {
    if (isOpen) {
      loadAiConfig();
    }
  }, [isOpen, loadAiConfig]);

  // 重置对话框状态
  const resetDialog = useCallback(() => {
    setStep('config');
    setOutline(null);
    setError(null);
    setStyle('');
  }, []);

  // 关闭对话框
  const handleClose = useCallback(() => {
    resetDialog();
    onClose();
  }, [onClose, resetDialog]);

  // 获取选中来源的内容
  const getSelectedSourcesContent = useCallback(async (): Promise<string> => {
    if (selectedIds.size === 0) return '';

    const contents = await Promise.all(
      [...selectedIds].map(async (id) => {
        try {
          const source = sources.find((s) => s.id === id);
          if (!source) return '';
          const content = await safeInvoke<string>('source_get_content', { id });
          return `【${source.name}】\n${content}`;
        } catch {
          return '';
        }
      })
    );
    return contents.filter(Boolean).join('\n\n---\n\n');
  }, [selectedIds, sources]);

  // 生成大纲
  const handleGenerateOutline = useCallback(async () => {
    // 检查 AI 配置
    if (aiConfig.provider === 'claude' && !aiConfig.apiKey) {
      setError('请先配置 Claude API Key（点击右上角设置）');
      return;
    }
    if (aiConfig.provider === 'ollama' && !aiConfig.model) {
      setError('请先配置 Ollama 模型（点击右上角设置）');
      return;
    }

    if (selectedIds.size === 0) {
      setError('请先选择来源资料');
      return;
    }

    setStep('generating');
    setError(null);

    try {
      const content = await getSelectedSourcesContent();
      if (!content) {
        setError('无法读取来源内容');
        setStep('config');
        return;
      }

      const generatedOutline = await generatePptOutline(
        aiConfig,
        content,
        { style: style || undefined }
      );

      setOutline(generatedOutline);
      setStep('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成大纲失败');
      setStep('config');
    }
  }, [aiConfig, selectedIds, getSelectedSourcesContent, style]);

  // 创建 PPT
  const handleCreatePpt = useCallback(async () => {
    if (!outline) return;

    setStep('creating');
    setError(null);

    try {
      const presentation = await createPpt(projectId, outline.title, outline);
      handleClose();
      onCreated(presentation.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建 PPT 失败');
      setStep('preview');
    }
  }, [outline, projectId, createPpt, handleClose, onCreated]);

  // 编辑幻灯片大纲
  const handleEditSlide = useCallback((index: number, field: keyof SlideOutline, value: string | string[]) => {
    if (!outline) return;

    const newSlides = [...outline.slides];
    newSlides[index] = { ...newSlides[index], [field]: value };
    setOutline({ ...outline, slides: newSlides });
  }, [outline]);

  // 删除幻灯片
  const handleDeleteSlide = useCallback((index: number) => {
    if (!outline) return;

    const newSlides = outline.slides.filter((_, i) => i !== index);
    setOutline({ ...outline, slides: newSlides });
  }, [outline]);

  // 添加幻灯片
  const handleAddSlide = useCallback(() => {
    if (!outline) return;

    const newSlide: SlideOutline = {
      title: '新幻灯片',
      layout: 'content',
      points: ['要点 1', '要点 2', '要点 3'],
    };
    setOutline({ ...outline, slides: [...outline.slides, newSlide] });
  }, [outline]);

  if (!isOpen) return null;

  return (
    <div className="ppt-dialog-overlay" onClick={handleClose}>
      <div className="ppt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ppt-dialog-header">
          <h2>
            <span className="material-icon">slideshow</span>
            生成 PPT
          </h2>
          <button className="close-btn" onClick={handleClose}>
            <span className="material-icon">close</span>
          </button>
        </div>

        <div className="ppt-dialog-content">
          {/* 错误提示 */}
          {error && (
            <div className="ppt-dialog-error">
              <span className="material-icon">error</span>
              <span>{error}</span>
              <button onClick={() => setError(null)}>
                <span className="material-icon">close</span>
              </button>
            </div>
          )}

          {/* 步骤 1: 配置 */}
          {step === 'config' && (
            <div className="ppt-config-step">
              <div className="source-info">
                <span className="material-icon">info</span>
                <span>已选择 {selectedIds.size} 个来源</span>
              </div>

              <div className="config-field">
                <label>风格要求（可选）</label>
                <input
                  type="text"
                  placeholder="例如：简洁商务风、科技感、学术风格..."
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
              </div>

              <button
                className="generate-btn"
                onClick={handleGenerateOutline}
                disabled={selectedIds.size === 0}
              >
                <span className="material-icon">auto_awesome</span>
                AI 生成大纲
              </button>
            </div>
          )}

          {/* 步骤 2: 生成中 */}
          {step === 'generating' && (
            <div className="ppt-generating-step">
              <div className="generating-spinner">
                <span className="material-icon rotating">sync</span>
              </div>
              <p>AI 正在分析内容并生成大纲...</p>
              <p className="generating-hint">这可能需要 10-30 秒</p>
            </div>
          )}

          {/* 步骤 3: 预览和编辑大纲 */}
          {step === 'preview' && outline && (
            <div className="ppt-preview-step">
              <div className="outline-header">
                <input
                  type="text"
                  className="outline-title-input"
                  value={outline.title}
                  onChange={(e) => setOutline({ ...outline, title: e.target.value })}
                  placeholder="PPT 标题"
                />
                {outline.subtitle && (
                  <input
                    type="text"
                    className="outline-subtitle-input"
                    value={outline.subtitle}
                    onChange={(e) => setOutline({ ...outline, subtitle: e.target.value })}
                    placeholder="副标题"
                  />
                )}
              </div>

              <div className="slides-list">
                <div className="slides-header">
                  <span>幻灯片大纲 ({outline.slides.length} 张)</span>
                  <button className="add-slide-btn" onClick={handleAddSlide}>
                    <span className="material-icon">add</span>
                    添加幻灯片
                  </button>
                </div>

                {outline.slides.map((slide, index) => (
                  <div key={index} className="slide-outline-item">
                    <div className="slide-header">
                      <span className="slide-number">{index + 1}</span>
                      <span className="slide-layout">{getLayoutLabel(slide.layout)}</span>
                      <button
                        className="delete-slide-btn"
                        onClick={() => handleDeleteSlide(index)}
                        title="删除幻灯片"
                      >
                        <span className="material-icon">delete</span>
                      </button>
                    </div>

                    <input
                      type="text"
                      className="slide-title-input"
                      value={slide.title}
                      onChange={(e) => handleEditSlide(index, 'title', e.target.value)}
                      placeholder="幻灯片标题"
                    />

                    <div className="slide-points">
                      {slide.points.map((point, pointIndex) => (
                        <div key={pointIndex} className="point-item">
                          <span className="point-bullet">•</span>
                          <input
                            type="text"
                            value={point}
                            onChange={(e) => {
                              const newPoints = [...slide.points];
                              newPoints[pointIndex] = e.target.value;
                              handleEditSlide(index, 'points', newPoints);
                            }}
                          />
                          <button
                            className="remove-point-btn"
                            onClick={() => {
                              const newPoints = slide.points.filter((_, i) => i !== pointIndex);
                              handleEditSlide(index, 'points', newPoints);
                            }}
                          >
                            <span className="material-icon">close</span>
                          </button>
                        </div>
                      ))}
                      <button
                        className="add-point-btn"
                        onClick={() => {
                          const newPoints = [...slide.points, '新要点'];
                          handleEditSlide(index, 'points', newPoints);
                        }}
                      >
                        <span className="material-icon">add</span>
                        添加要点
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 步骤 4: 创建中 */}
          {step === 'creating' && (
            <div className="ppt-creating-step">
              <div className="generating-spinner">
                <span className="material-icon rotating">sync</span>
              </div>
              <p>正在创建 PPT...</p>
            </div>
          )}
        </div>

        <div className="ppt-dialog-footer">
          <button className="cancel-btn" onClick={handleClose}>
            取消
          </button>

          {step === 'preview' && (
            <>
              <button className="regenerate-btn" onClick={() => setStep('config')}>
                <span className="material-icon">refresh</span>
                重新生成
              </button>
              <button className="create-btn" onClick={handleCreatePpt}>
                <span className="material-icon">check</span>
                确认创建
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
