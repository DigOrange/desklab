import { useEffect, useMemo, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { safeInvoke } from '../../../utils/tauri';
import type { Source, SourceType } from '../../../types';
import { formatFileSize, sourceTypeLabels } from '../../../types';
import './SourcePreview.css';

interface SourcePreviewProps {
  source: Source | null;
}

const TEXT_PREVIEW_TYPES: SourceType[] = ['docx', 'markdown'];
const TEXT_PREVIEW_LIMIT = 4000;
const PDF_THUMBNAIL_LIMIT = 4;

export function SourcePreview({ source }: SourcePreviewProps) {
  const [textPreview, setTextPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState<number | null>(null);

  const metaText = useMemo(() => {
    if (!source) return '';
    const base = `${sourceTypeLabels[source.type]} · ${formatFileSize(source.size)}`;
    if (source.type === 'pdf' && pdfPageCount) {
      return `${base} · ${pdfPageCount} 页`;
    }
    return base;
  }, [source, pdfPageCount]);

  useEffect(() => {
    if (!source) {
      setTextPreview('');
      setError(null);
      setLoading(false);
      setPdfPageCount(null);
      return;
    }

    if (!TEXT_PREVIEW_TYPES.includes(source.type) && source.type !== 'pdf') {
      setTextPreview('');
      setError(null);
      setLoading(false);
      setPdfPageCount(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    safeInvoke<string>('source_get_content', { id: source.id })
      .then((content) => {
        if (!active) return;
        const trimmed = content.trim();
        if (source.type === 'pdf') {
          const pages = trimmed.split(/\f+/).map((page) => page.trim()).filter(Boolean);
          const count = pages.length > 0 ? pages.length : trimmed ? 1 : 0;
          setPdfPageCount(count);
          setTextPreview('');
          return;
        }
        setPdfPageCount(null);
        setTextPreview(trimmed.slice(0, TEXT_PREVIEW_LIMIT));
      })
      .catch((e) => {
        if (!active) return;
        setError(String(e));
        setPdfPageCount(null);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [source?.id, source?.type]);

  if (!source) {
    return (
      <div className="source-preview empty">
        <span className="material-icon">visibility</span>
        <p>选择来源查看预览</p>
      </div>
    );
  }

  const fileUrl = convertFileSrc(source.path);
  const pageCount = pdfPageCount ?? 0;
  const visibleThumbnails = Math.max(1, Math.min(pageCount || 1, PDF_THUMBNAIL_LIMIT));
  const extraPages = pageCount > PDF_THUMBNAIL_LIMIT ? pageCount - PDF_THUMBNAIL_LIMIT : 0;

  return (
    <div className="source-preview">
      <div className="source-preview-header">
        <div className="source-preview-title" title={source.name}>
          {source.name}
        </div>
        <span className="source-preview-meta">{metaText}</span>
      </div>

      <div className="source-preview-body">
        {source.type === 'image' && (
          <img className="source-preview-image" src={fileUrl} alt={source.name} />
        )}

        {source.type === 'pdf' && (
          <div className="source-preview-pdf-wrapper">
            <iframe
              className="source-preview-pdf"
              src={fileUrl}
              title={source.name}
            />
            <div className="pdf-thumbnails">
              {Array.from({ length: visibleThumbnails }).map((_, index) => (
                <div key={index} className="pdf-thumb">
                  <div className="pdf-thumb-page">
                    <div className="line title"></div>
                    <div className="line"></div>
                    <div className="line medium"></div>
                    <div className="line"></div>
                    <div className="line short"></div>
                  </div>
                  <span className="pdf-thumb-label">第 {index + 1} 页</span>
                </div>
              ))}
              {extraPages > 0 && (
                <div className="pdf-thumb more">+{extraPages}</div>
              )}
            </div>
          </div>
        )}

        {TEXT_PREVIEW_TYPES.includes(source.type) && (
          <div className="source-preview-text-wrapper">
            {loading && (
              <div className="source-preview-status">
                <span className="material-icon rotating">sync</span>
                <span>加载预览...</span>
              </div>
            )}
            {!loading && error && (
              <div className="source-preview-status error">
                <span className="material-icon">error_outline</span>
                <span>预览失败</span>
              </div>
            )}
            {!loading && !error && (
              <pre className="source-preview-text">
                {textPreview || '暂无可预览的内容'}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
