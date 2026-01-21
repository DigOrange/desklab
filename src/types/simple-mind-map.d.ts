// simple-mind-map 类型声明

declare module 'simple-mind-map' {
  interface MindMapOptions {
    el: HTMLElement;
    data?: Record<string, unknown>;
    viewData?: Record<string, unknown>;
    readonly?: boolean;
    layout?: string;
    fishboneDeg?: number;
    theme?: string;
    themeConfig?: Record<string, unknown>;
    [key: string]: unknown;
  }

  interface View {
    enlarge(): void;
    narrow(): void;
    fit(): void;
  }

  interface Renderer {
    setRootNodeCenter(): void;
  }

  interface MiniMapInstance {
    init(container: HTMLElement, options: { width: number; height: number }): void;
  }

  export default class MindMap {
    constructor(options: MindMapOptions);
    view: View;
    renderer: Renderer;
    miniMap: MiniMapInstance;

    static usePlugin(plugin: unknown): void;

    on(event: string, callback: (...args: unknown[]) => void): void;
    off(event: string, callback?: (...args: unknown[]) => void): void;
    emit(event: string, ...args: unknown[]): void;

    getData(withConfig?: boolean): Record<string, unknown>;
    setData(data: Record<string, unknown>): void;
    updateData(data: Record<string, unknown>): void;

    getTheme(): string;
    setTheme(theme: string, notRender?: boolean): void;

    getLayout(): string;
    setLayout(layout: string, notRender?: boolean): void;

    export(type: string, isDownload?: boolean, fileName?: string): Promise<string | null>;

    render(callback?: () => void, source?: string): void;
    reRender(callback?: () => void, source?: string): void;

    destroy(): void;
  }
}

declare module 'simple-mind-map/src/plugins/Drag.js' {
  const Drag: unknown;
  export default Drag;
}

declare module 'simple-mind-map/src/plugins/Select.js' {
  const Select: unknown;
  export default Select;
}

declare module 'simple-mind-map/src/plugins/Export.js' {
  const Export: unknown;
  export default Export;
}

declare module 'simple-mind-map/src/plugins/KeyboardNavigation.js' {
  const KeyboardNavigation: unknown;
  export default KeyboardNavigation;
}

declare module 'simple-mind-map/src/plugins/RichText.js' {
  const RichText: unknown;
  export default RichText;
}

declare module 'simple-mind-map/src/plugins/MiniMap.js' {
  const MiniMap: unknown;
  export default MiniMap;
}
