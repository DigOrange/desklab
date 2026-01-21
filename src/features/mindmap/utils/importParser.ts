// 思维导图导入解析工具
// 支持 JSON 和 Markdown 大纲格式导入

import type { MindMapData, MindMapNode } from '../../../types';

/**
 * 解析 JSON 格式的思维导图数据
 */
export function parseJsonImport(content: string): MindMapData | null {
  try {
    const data = JSON.parse(content);

    // 支持两种 JSON 格式：
    // 1. 完整格式：{ root: {...}, theme: {...}, layout: '...' }
    // 2. 简单格式：{ data: {...}, children: [...] }（仅节点树）

    if (data.root && typeof data.root === 'object') {
      // 完整格式
      return {
        root: normalizeNode(data.root),
        theme: data.theme,
        layout: data.layout,
      };
    } else if (data.data && typeof data.data === 'object') {
      // 简单格式（仅节点树）
      return {
        root: normalizeNode(data),
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * 规范化节点数据，确保必要字段存在
 */
function normalizeNode(node: unknown): MindMapNode {
  const n = node as Record<string, unknown>;
  const data = (n.data as Record<string, unknown>) || {};
  const children = Array.isArray(n.children) ? n.children : [];

  return {
    data: {
      text: String(data.text || '未命名'),
      expand: data.expand !== false,
      ...data,
    },
    children: children.map(normalizeNode),
  };
}

/**
 * 解析 Markdown 大纲格式
 * 支持的格式：
 * - 使用缩进（空格或 Tab）表示层级
 * - 每行为一个节点
 * - 支持以 - * + 等列表标记开头
 */
export function parseMarkdownOutline(content: string): MindMapData | null {
  const lines = content.split('\n').filter(line => line.trim().length > 0);

  if (lines.length === 0) {
    return null;
  }

  // 解析每行的缩进级别和文本
  const parsedLines = lines.map(line => {
    // 计算缩进（空格数或 Tab 数）
    const match = line.match(/^(\s*)/);
    const indent = match ? match[1].length : 0;

    // 移除列表标记并获取文本
    let text = line.trim();
    text = text.replace(/^[-*+]\s+/, ''); // 移除列表标记
    text = text.replace(/^\d+\.\s+/, ''); // 移除数字列表标记
    text = text.replace(/^#+\s+/, ''); // 移除 Markdown 标题标记

    return { indent, text };
  });

  // 构建节点树
  const root: MindMapNode = {
    data: {
      text: parsedLines[0].text,
      expand: true,
    },
    children: [],
  };

  if (parsedLines.length === 1) {
    return { root };
  }

  // 找出最小缩进单位
  const indents = parsedLines.slice(1).map(l => l.indent).filter(i => i > 0);
  const minIndent = indents.length > 0 ? Math.min(...indents) : 2;

  // 构建树结构
  const stack: { node: MindMapNode; level: number }[] = [{ node: root, level: -1 }];

  for (let i = 1; i < parsedLines.length; i++) {
    const { indent, text } = parsedLines[i];
    const level = Math.floor(indent / minIndent);

    const newNode: MindMapNode = {
      data: {
        text,
        expand: true,
      },
      children: [],
    };

    // 找到正确的父节点
    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1].node;
    if (!parent.children) {
      parent.children = [];
    }
    parent.children.push(newNode);

    stack.push({ node: newNode, level });
  }

  return { root };
}

/**
 * 根据文件扩展名自动选择解析器
 */
export function parseImportFile(content: string, filename: string): MindMapData | null {
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'json') {
    return parseJsonImport(content);
  } else if (ext === 'md' || ext === 'markdown' || ext === 'txt') {
    return parseMarkdownOutline(content);
  }

  // 尝试 JSON 解析，失败则尝试 Markdown
  const jsonResult = parseJsonImport(content);
  if (jsonResult) {
    return jsonResult;
  }

  return parseMarkdownOutline(content);
}
