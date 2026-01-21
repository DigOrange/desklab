// 元素层级管理 Hook
// 处理 PPT 元素的层级调整（置顶、置底、上移、下移）

import { useCallback } from 'react';
import { PptistSlide } from '../../../types';

interface UseElementLayerOptions {
  slide: PptistSlide;
  onUpdateSlide: (updatedSlide: PptistSlide) => void;
}

export function useElementLayer({ slide, onUpdateSlide }: UseElementLayerOptions) {
  // 置于顶层
  const bringToFront = useCallback(
    (elementId: string) => {
      const elements = [...slide.elements];
      const index = elements.findIndex((el) => el.id === elementId);
      if (index === -1 || index === elements.length - 1) return;

      const [element] = elements.splice(index, 1);
      elements.push(element);

      onUpdateSlide({ ...slide, elements });
    },
    [slide, onUpdateSlide]
  );

  // 置于底层
  const sendToBack = useCallback(
    (elementId: string) => {
      const elements = [...slide.elements];
      const index = elements.findIndex((el) => el.id === elementId);
      if (index === -1 || index === 0) return;

      const [element] = elements.splice(index, 1);
      elements.unshift(element);

      onUpdateSlide({ ...slide, elements });
    },
    [slide, onUpdateSlide]
  );

  // 上移一层
  const bringForward = useCallback(
    (elementId: string) => {
      const elements = [...slide.elements];
      const index = elements.findIndex((el) => el.id === elementId);
      if (index === -1 || index === elements.length - 1) return;

      // 交换位置
      [elements[index], elements[index + 1]] = [
        elements[index + 1],
        elements[index],
      ];

      onUpdateSlide({ ...slide, elements });
    },
    [slide, onUpdateSlide]
  );

  // 下移一层
  const sendBackward = useCallback(
    (elementId: string) => {
      const elements = [...slide.elements];
      const index = elements.findIndex((el) => el.id === elementId);
      if (index === -1 || index === 0) return;

      // 交换位置
      [elements[index], elements[index - 1]] = [
        elements[index - 1],
        elements[index],
      ];

      onUpdateSlide({ ...slide, elements });
    },
    [slide, onUpdateSlide]
  );

  // 获取元素的当前层级信息
  const getLayerInfo = useCallback(
    (elementId: string) => {
      const index = slide.elements.findIndex((el) => el.id === elementId);
      if (index === -1) return null;

      return {
        index,
        total: slide.elements.length,
        isTop: index === slide.elements.length - 1,
        isBottom: index === 0,
      };
    },
    [slide.elements]
  );

  return {
    bringToFront,
    sendToBack,
    bringForward,
    sendBackward,
    getLayerInfo,
  };
}
