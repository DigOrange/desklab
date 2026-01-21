import './DropZone.css';

interface DropZoneProps {
  active: boolean;
}

export function DropZone({ active }: DropZoneProps) {
  if (!active) return null;

  return (
    <div className="dropzone-overlay">
      <div className="dropzone-card">
        <span className="material-icon">upload_file</span>
        <div className="dropzone-text">
          <p className="dropzone-title">拖拽文件到此处导入</p>
          <p className="dropzone-subtitle">支持 PDF / Word / 图片 / Markdown</p>
        </div>
      </div>
    </div>
  );
}
