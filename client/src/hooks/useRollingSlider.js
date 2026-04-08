import { useState, useEffect } from 'react';

/**
 * 무한 루프 롤링 슬라이더 훅
 * @param {Array} items - 원본 아이템 배열
 * @param {number} perSlide - 한 슬라이드에 표시할 개수
 * @param {number} interval - 슬라이드 전환 간격 (ms)
 * @returns {{ slides, displaySlides, current, transition }}
 */
export function useRollingSlider(items, perSlide, interval) {
  const [current, setCurrent] = useState(0);
  const [transition, setTransition] = useState(true);

  // 아이템을 슬라이드 단위로 그룹핑
  const slides = [];
  for (let i = 0; i < items.length; i += perSlide) {
    slides.push(items.slice(i, i + perSlide));
  }

  // 무한 루프용 복제 슬라이드
  const displaySlides = slides.length > 1
    ? [...slides, slides[0]]
    : slides;

  // 자동 전환
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent(prev => prev + 1);
    }, interval);
    return () => clearInterval(timer);
  }, [slides.length, interval]);

  // 복제 마지막 도달 시 트랜지션 없이 리셋
  useEffect(() => {
    if (slides.length <= 1) return;
    if (current === slides.length) {
      const timer = setTimeout(() => {
        setTransition(false);
        setCurrent(0);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setTransition(true);
          });
        });
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [current, slides.length]);

  return { slides, displaySlides, current, transition };
}
