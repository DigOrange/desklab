// Markdown 转换工具

import { marked } from 'marked';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

// 配置 marked 启用 GFM（包括表格）
marked.use({
  gfm: true,
  breaks: true,
});

// HTML -> Markdown
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// 添加 GFM 支持（表格、删除线、任务列表）
turndownService.use(gfm);

// 自定义任务列表规则（覆盖 gfm 默认行为以保持兼容）
turndownService.addRule('taskListItems', {
  filter: (node) => {
    return (
      node.nodeName === 'INPUT' &&
      node.getAttribute('type') === 'checkbox'
    );
  },
  replacement: (_content, node) => {
    const isChecked = (node as HTMLInputElement).checked;
    return isChecked ? '[x] ' : '[ ] ';
  },
});

export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}

// Markdown -> HTML
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown) as string;
}
