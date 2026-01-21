// 使用 Mermaid 渲染编辑器中的代码块
// 在编辑器加载后自动检测并渲染 mermaid 代码块

import { useEffect, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import mermaid from 'mermaid';

// 初始化 mermaid 配置
let mermaidInitialized = false;
function initMermaid() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: 'default',
    securityLevel: 'loose',
    mindmap: {
      useMaxWidth: true,
      padding: 10,
    },
  });
  mermaidInitialized = true;
}

export function useMermaidRenderer(editor: Editor | null) {
  const renderMermaidBlocks = useCallback(async () => {
    if (!editor) return;

    initMermaid();

    // 查找所有 mermaid 代码块
    const editorElement = editor.view.dom;
    const codeBlocks = editorElement.querySelectorAll('pre[data-language="mermaid"], pre code.language-mermaid');

    for (let i = 0; i < codeBlocks.length; i++) {
      const block = codeBlocks[i];
      const pre = block.tagName === 'PRE' ? block : block.closest('pre');
      if (!pre) continue;

      // 检查是否已经渲染过
      if (pre.getAttribute('data-mermaid-rendered') === 'true') continue;

      const code = pre.textContent || '';
      if (!code.trim()) continue;

      try {
        // 验证并渲染
        await mermaid.parse(code);
        const uniqueId = `mermaid-${Date.now()}-${i}`;
        const { svg } = await mermaid.render(uniqueId, code);

        // 创建渲染容器
        const container = document.createElement('div');
        container.className = 'mermaid-rendered';
        container.innerHTML = svg;

        // 创建展开/折叠源码的按钮
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'mermaid-toggle-btn';
        toggleBtn.textContent = '查看源码';
        toggleBtn.onclick = () => {
          const codeEl = container.querySelector('.mermaid-source');
          if (codeEl) {
            codeEl.classList.toggle('hidden');
            toggleBtn.textContent = codeEl.classList.contains('hidden') ? '查看源码' : '隐藏源码';
          }
        };

        // 源码显示区
        const sourceDiv = document.createElement('div');
        sourceDiv.className = 'mermaid-source hidden';
        sourceDiv.innerHTML = `<pre><code>${escapeHtml(code)}</code></pre>`;

        container.appendChild(toggleBtn);
        container.appendChild(sourceDiv);

        // 替换原始代码块
        pre.parentNode?.insertBefore(container, pre);
        (pre as HTMLElement).style.display = 'none';
        pre.setAttribute('data-mermaid-rendered', 'true');
      } catch (e) {
        console.error('Mermaid render error:', e);
        // 显示错误提示
        pre.classList.add('mermaid-error');
      }
    }
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    // 初始渲染
    const timer = setTimeout(renderMermaidBlocks, 100);

    // 监听编辑器更新
    const handleUpdate = () => {
      setTimeout(renderMermaidBlocks, 100);
    };

    editor.on('update', handleUpdate);

    return () => {
      clearTimeout(timer);
      editor.off('update', handleUpdate);
    };
  }, [editor, renderMermaidBlocks]);

  return { renderMermaidBlocks };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
