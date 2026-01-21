// 示例插件：字数统计
// 演示插件系统的基本用法

import type { PluginManifest, PluginInstance, PluginContext, Disposable } from '../types';

/**
 * 插件清单
 */
export const wordCountManifest: PluginManifest = {
  id: 'builtin.word-count',
  name: '字数统计',
  version: '1.0.0',
  description: '显示当前文档的字数统计信息',
  author: 'DeskLab',
  main: 'index.ts',
  extensionPoints: ['command', 'toolbar'],
  permissions: [],
};

/**
 * 插件实例
 */
export const wordCountPlugin: PluginInstance = {
  activate(context: PluginContext): void {
    const disposables: Disposable[] = [];

    // 注册命令
    disposables.push(
      context.registerCommand({
        id: 'showWordCount',
        title: '显示字数统计',
        description: '显示当前文档的字数、字符数等统计信息',
        keybinding: 'Ctrl+Shift+W',
        handler: () => {
          // 获取当前选中文本或全文
          const selection = window.getSelection();
          const text = selection?.toString() || '';

          if (!text) {
            context.showNotification('请先选择一些文本', 'info');
            return;
          }

          const stats = calculateStats(text);
          context.showNotification(
            `字数: ${stats.words} | 字符: ${stats.characters} | 行数: ${stats.lines}`,
            'info'
          );
        },
      })
    );

    // 注册工具栏按钮
    disposables.push(
      context.registerToolbarItem({
        id: 'wordCount',
        title: '字数统计',
        icon: 'analytics',
        tooltip: '显示字数统计 (Ctrl+Shift+W)',
        location: 'editor',
        onClick: () => {
          const text = getEditorText();
          if (!text) {
            context.showNotification('当前没有可统计的内容', 'info');
            return;
          }

          const stats = calculateStats(text);
          context.showNotification(
            `字数: ${stats.words} | 字符: ${stats.characters} | 行数: ${stats.lines}`,
            'success'
          );
        },
      })
    );

    // 保存 disposables 以便停用时清理
    (this as unknown as { _disposables: Disposable[] })._disposables = disposables;

    console.log('[WordCountPlugin] 插件已激活');
  },

  deactivate(): void {
    const disposables = (this as unknown as { _disposables?: Disposable[] })._disposables;
    if (disposables) {
      disposables.forEach((d) => d.dispose());
    }
    console.log('[WordCountPlugin] 插件已停用');
  },
};

/**
 * 计算文本统计信息
 */
function calculateStats(text: string): {
  words: number;
  characters: number;
  charactersNoSpace: number;
  lines: number;
} {
  // 字符数
  const characters = text.length;

  // 无空格字符数
  const charactersNoSpace = text.replace(/\s/g, '').length;

  // 行数
  const lines = text.split(/\r\n|\r|\n/).length;

  // 词数（支持中英文混合）
  // 英文按空格分词，中文按字符计数
  const englishWords = text.match(/[a-zA-Z]+/g)?.length || 0;
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)?.length || 0;
  const words = englishWords + chineseChars;

  return {
    words,
    characters,
    charactersNoSpace,
    lines,
  };
}

/**
 * 获取编辑器文本（简化实现）
 */
function getEditorText(): string {
  // 尝试从编辑器获取文本
  const editorContent = document.querySelector('.editor-content .ProseMirror');
  if (editorContent) {
    return editorContent.textContent || '';
  }

  // 尝试获取选中文本
  const selection = window.getSelection();
  if (selection && selection.toString()) {
    return selection.toString();
  }

  return '';
}
