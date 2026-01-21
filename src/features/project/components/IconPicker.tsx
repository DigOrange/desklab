import { useState } from 'react';
import { ProjectIcon } from '../../../types';
import { ICON_CATEGORIES, ICON_COLORS } from '../../../data/icons';
import './IconPicker.css';

interface IconPickerProps {
  value: ProjectIcon;
  onChange: (icon: ProjectIcon) => void;
}

export function IconPicker({ value, onChange }: IconPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleSelectEmoji = (icon: { id: string; name: string; emoji: string }) => {
    onChange({
      ...value,
      id: icon.id,
      name: icon.name,
      emoji: icon.emoji,
    });
  };

  const handleSelectColor = (color: string) => {
    onChange({
      ...value,
      color,
    });
  };

  return (
    <div className="icon-picker">
      <button
        type="button"
        className="icon-preview"
        style={{ background: value.color }}
        onClick={() => setShowPicker(!showPicker)}
      >
        {value.emoji}
      </button>

      {showPicker && (
        <div className="icon-picker-dropdown">
          <div className="picker-section">
            <div className="picker-label">选择颜色</div>
            <div className="color-grid">
              {ICON_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`color-item ${value.color === color ? 'active' : ''}`}
                  style={{ background: color }}
                  onClick={() => handleSelectColor(color)}
                />
              ))}
            </div>
          </div>

          {ICON_CATEGORIES.map((category) => (
            <div key={category.name} className="picker-section">
              <div className="picker-label">{category.name}</div>
              <div className="emoji-grid">
                {category.icons.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    className={`emoji-item ${value.id === icon.id ? 'active' : ''}`}
                    onClick={() => handleSelectEmoji(icon)}
                    title={icon.name}
                  >
                    {icon.emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
