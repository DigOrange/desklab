// Tiptap 画布块扩展
// 支持在笔记中内嵌 Excalidraw 画布

import { Node, mergeAttributes } from '@tiptap/core';
import type { CommandProps } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { CanvasBlockView } from '../components/CanvasBlockView';

export interface CanvasBlockOptions {
  HTMLAttributes: Record<string, unknown>;
}

export const CanvasBlock = Node.create<CanvasBlockOptions>({
  name: 'canvasBlock',

  group: 'block',

  atom: true,

  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      canvasId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-canvas-id'),
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.canvasId) {
            return {};
          }
          return {
            'data-canvas-id': attributes.canvasId,
          };
        },
      },
      // 内联数据，用于存储小型画布
      inlineData: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const data = element.getAttribute('data-inline');
          return data ? JSON.parse(data) : null;
        },
        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.inlineData) {
            return {};
          }
          return {
            'data-inline': JSON.stringify(attributes.inlineData),
          };
        },
      },
      // 画布高度
      height: {
        default: 400,
        parseHTML: (element: HTMLElement) => parseInt(element.getAttribute('data-height') || '400'),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-height': attributes.height,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="canvas-block"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'canvas-block' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CanvasBlockView, {
      // 防止不必要的重新渲染
      stopEvent: () => false,
    });
  },

  addCommands() {
    return {
      insertCanvasBlock:
        (canvasId?: string) =>
        ({ commands }: CommandProps) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              canvasId: canvasId || null,
              inlineData: canvasId ? null : {
                elements: [],
                appState: { viewBackgroundColor: '#ffffff' },
                files: {},
              },
              height: 400,
            },
          });
        },
    };
  },
});

// 扩展 Tiptap 命令类型
declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    canvasBlock: {
      insertCanvasBlock: (canvasId?: string) => ReturnType;
    };
  }
}
