// 主题切换按钮组件
// 支持浅色/深色主题切换

import { useThemeStore } from '../../stores/themeStore';
import './ThemeToggle.css';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export function ThemeToggle({ className = '', showLabel = false }: ThemeToggleProps) {
  const { theme, toggleTheme } = useThemeStore();
  const isDark = theme === 'dark';

  return (
    <button
      className={`theme-toggle ${className}`}
      onClick={toggleTheme}
      title={isDark ? '切换到浅色模式' : '切换到深色模式'}
    >
      <span className="material-icon">
        {isDark ? 'light_mode' : 'dark_mode'}
      </span>
      {showLabel && (
        <span className="theme-toggle-label">
          {isDark ? '浅色' : '深色'}
        </span>
      )}
    </button>
  );
}
