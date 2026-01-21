// 右键菜单组件

import { useEffect, useRef, useCallback } from 'react';
import './ContextMenu.css';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}

interface ContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  onSelect: (itemId: string) => void;
}

export function ContextMenu({ open, x, y, items, onClose, onSelect }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  console.log('[ContextMenu] render:', { open, x, y, itemsCount: items.length });

  // 调整位置确保菜单在视口内
  const adjustPosition = useCallback(() => {
    if (!menuRef.current || !open) return { x, y };

    const menu = menuRef.current;
    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = x;
    let adjustedY = y;

    // 右边界检查
    if (x + rect.width > viewportWidth - 8) {
      adjustedX = viewportWidth - rect.width - 8;
    }

    // 下边界检查
    if (y + rect.height > viewportHeight - 8) {
      adjustedY = viewportHeight - rect.height - 8;
    }

    return { x: adjustedX, y: adjustedY };
  }, [x, y, open]);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // 延迟添加事件监听，避免触发菜单的点击立即关闭
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  const handleItemClick = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled || item.divider) return;
      onSelect(item.id);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!open) return null;

  const position = adjustPosition();

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      role="menu"
    >
      {items.map((item, index) =>
        item.divider ? (
          <div key={`divider-${index}`} className="context-menu-divider" />
        ) : (
          <button
            key={item.id}
            className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            role="menuitem"
          >
            {item.icon && <span className="material-icon">{item.icon}</span>}
            <span className="menu-label">{item.label}</span>
          </button>
        )
      )}
    </div>
  );
}
