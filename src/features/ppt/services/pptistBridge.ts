// PPTist iframe 通信桥接服务
// 用于与嵌入的 PPTist 编辑器进行 postMessage 通信

import { PptData } from '../../../types';

// 消息类型定义
interface BridgeMessage {
  type: string;
  payload?: unknown;
  requestId?: string;
}

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * PPTist iframe 通信桥接
 * 通过 postMessage 与 PPTist 编辑器通信
 */
export class PptistBridge {
  private iframe: HTMLIFrameElement;
  private pendingRequests: Map<string, PendingRequest>;
  private onChangeCallback?: (data: PptData) => void;
  private onReadyCallback?: () => void;
  private messageHandler: (event: MessageEvent) => void;
  private readonly REQUEST_TIMEOUT = 30000; // 30 秒超时

  constructor(iframe: HTMLIFrameElement) {
    this.iframe = iframe;
    this.pendingRequests = new Map();
    this.messageHandler = this.handleMessage.bind(this);

    window.addEventListener('message', this.messageHandler);
  }

  /**
   * 处理来自 PPTist 的消息
   */
  private handleMessage(event: MessageEvent): void {
    // 验证消息来源
    if (event.source !== this.iframe.contentWindow) {
      return;
    }

    const message = event.data as BridgeMessage;
    if (!message || typeof message.type !== 'string') {
      return;
    }

    const { type, requestId, payload } = message;

    // 处理带请求 ID 的响应
    if (requestId && this.pendingRequests.has(requestId)) {
      const request = this.pendingRequests.get(requestId)!;
      clearTimeout(request.timeout);
      this.pendingRequests.delete(requestId);
      request.resolve(payload);
      return;
    }

    // 处理事件通知
    switch (type) {
      case 'PPT_READY':
        this.onReadyCallback?.();
        break;
      case 'PPT_CHANGED':
        if (this.onChangeCallback) {
          this.getData().then(this.onChangeCallback).catch(console.error);
        }
        break;
      case 'PPT_ERROR':
        console.error('PPTist error:', payload);
        break;
    }
  }

  /**
   * 发送消息到 PPTist
   */
  private sendMessage<T = unknown>(type: string, payload?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID();

      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`请求超时: ${type}`));
        }
      }, this.REQUEST_TIMEOUT);

      this.pendingRequests.set(requestId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      this.iframe.contentWindow?.postMessage(
        { type, payload, requestId },
        '*'
      );
    });
  }

  /**
   * 发送不需要响应的消息
   */
  private postMessage(type: string, payload?: unknown): void {
    this.iframe.contentWindow?.postMessage({ type, payload }, '*');
  }

  /**
   * 加载 PPT 数据到编辑器
   */
  load(data: PptData): void {
    this.postMessage('LOAD_PPT', data);
  }

  /**
   * 获取当前 PPT 数据
   */
  async getData(): Promise<PptData> {
    return this.sendMessage<PptData>('GET_DATA');
  }

  /**
   * 导出为 PPTX 格式
   */
  async exportPptx(): Promise<Blob> {
    const result = await this.sendMessage<ArrayBuffer>('EXPORT_PPT', { format: 'pptx' });
    return new Blob([result], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }

  /**
   * 导出为 PDF 格式
   */
  async exportPdf(): Promise<Blob> {
    const result = await this.sendMessage<ArrayBuffer>('EXPORT_PPT', { format: 'pdf' });
    return new Blob([result], { type: 'application/pdf' });
  }

  /**
   * 导出为图片
   */
  async exportImages(): Promise<Blob[]> {
    return this.sendMessage<Blob[]>('EXPORT_PPT', { format: 'images' });
  }

  /**
   * 设置主题
   */
  setTheme(theme: { themeColor: string; fontColor: string; backgroundColor: string }): void {
    this.postMessage('SET_THEME', theme);
  }

  /**
   * 进入演示模式
   */
  startPresentation(slideIndex?: number): void {
    this.postMessage('START_PRESENTATION', { slideIndex: slideIndex ?? 0 });
  }

  /**
   * 退出演示模式
   */
  exitPresentation(): void {
    this.postMessage('EXIT_PRESENTATION');
  }

  /**
   * 撤销
   */
  undo(): void {
    this.postMessage('UNDO');
  }

  /**
   * 重做
   */
  redo(): void {
    this.postMessage('REDO');
  }

  /**
   * 监听编辑器准备就绪
   */
  onReady(callback: () => void): void {
    this.onReadyCallback = callback;
  }

  /**
   * 监听数据变化
   */
  onChanged(callback: (data: PptData) => void): void {
    this.onChangeCallback = callback;
  }

  /**
   * 销毁桥接，清理资源
   */
  destroy(): void {
    window.removeEventListener('message', this.messageHandler);

    // 清理所有待处理的请求
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout);
      request.reject(new Error('Bridge destroyed'));
    }
    this.pendingRequests.clear();

    this.onChangeCallback = undefined;
    this.onReadyCallback = undefined;
  }
}
