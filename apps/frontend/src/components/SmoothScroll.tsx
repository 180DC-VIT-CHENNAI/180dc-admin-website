import { useEffect, useRef, useCallback } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { LenisProvider } from '../context/LenisContext';

gsap.registerPlugin(ScrollTrigger);

interface SmoothScrollProps {
  children: React.ReactNode;
}

export default function SmoothScroll({ children }: SmoothScrollProps) {
  const lenisRef = useRef<Lenis | null>(null);

  const scrollTo = useCallback(
    (target: string | number | Element, opts?: { offset?: number }) => {
      const lenis = lenisRef.current;
      if (!lenis) return;
      if (typeof target === "string" && target.startsWith("#")) {
        const el = document.querySelector(target);
        if (el) lenis.scrollTo(el, { offset: opts?.offset ?? 0 });
      } else if (typeof target === "number") {
        lenis.scrollTo(target, { offset: opts?.offset ?? 0 });
      } else if (target instanceof Element) {
        lenis.scrollTo(target, { offset: opts?.offset ?? 0 });
      }
    },
    []
  );

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;

    lenis.on('scroll', ScrollTrigger.update);

    const ticker = (time: number) => {
      lenis.raf(time * 1000);
    };

    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(ticker);
    };
  }, []);

  return <LenisProvider value={scrollTo}>{children}</LenisProvider>;
}
