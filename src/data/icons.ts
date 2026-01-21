import { ProjectIcon } from '../types';

// 图标分类
export const ICON_CATEGORIES = [
  {
    name: '通用',
    icons: [
      { id: 'doc', name: '文档', emoji: '📄' },
      { id: 'folder', name: '文件夹', emoji: '📁' },
      { id: 'book', name: '书籍', emoji: '📚' },
      { id: 'note', name: '笔记', emoji: '📝' },
      { id: 'star', name: '星星', emoji: '⭐' },
    ],
  },
  {
    name: '研究',
    icons: [
      { id: 'bulb', name: '灯泡', emoji: '💡' },
      { id: 'search', name: '放大镜', emoji: '🔍' },
      { id: 'lab', name: '实验', emoji: '🧪' },
      { id: 'chart', name: '图表', emoji: '📊' },
      { id: 'brain', name: '脑图', emoji: '🧠' },
    ],
  },
  {
    name: '开发',
    icons: [
      { id: 'code', name: '代码', emoji: '💻' },
      { id: 'terminal', name: '终端', emoji: '⌨️' },
      { id: 'bug', name: 'Bug', emoji: '🐛' },
      { id: 'rocket', name: '火箭', emoji: '🚀' },
      { id: 'gear', name: '齿轮', emoji: '⚙️' },
    ],
  },
  {
    name: '创意',
    icons: [
      { id: 'brush', name: '画笔', emoji: '🖌️' },
      { id: 'palette', name: '调色板', emoji: '🎨' },
      { id: 'camera', name: '相机', emoji: '📷' },
      { id: 'music', name: '音乐', emoji: '🎵' },
      { id: 'video', name: '视频', emoji: '🎬' },
    ],
  },
  {
    name: '工作',
    icons: [
      { id: 'calendar', name: '日历', emoji: '📅' },
      { id: 'task', name: '任务', emoji: '✅' },
      { id: 'mail', name: '邮件', emoji: '📧' },
      { id: 'team', name: '团队', emoji: '👥' },
      { id: 'target', name: '目标', emoji: '🎯' },
    ],
  },
];

// 图标颜色
export const ICON_COLORS = [
  '#5aa7a0', // 青色
  '#d8a25a', // 橙色
  '#7d9ad6', // 蓝色
  '#d56a6a', // 红色
  '#9b7ed6', // 紫色
  '#6ab86a', // 绿色
  '#d67db8', // 粉色
  '#8a8a8a', // 灰色
];

// 默认图标
export const DEFAULT_ICON: ProjectIcon = {
  id: 'doc',
  name: '文档',
  emoji: '📄',
  color: '#5aa7a0',
};

// 获取所有图标列表
export function getAllIcons() {
  return ICON_CATEGORIES.flatMap(cat => cat.icons);
}
