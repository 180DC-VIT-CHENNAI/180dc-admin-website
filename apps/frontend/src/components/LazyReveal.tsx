import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  style?: CSSProperties;
  sectionId?: string;
}

export default function LazyReveal({
  children,
  fallback = null,
  rootMargin = "400px",
  style,
  sectionId,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    if (!sectionId) return;
    const handler = (e: Event) => {
      const target = (e as CustomEvent).detail;
      if (target === `#${sectionId}`) {
        setVisible(true);
      }
    };
    window.addEventListener("force-mount-section", handler);
    return () => window.removeEventListener("force-mount-section", handler);
  }, [sectionId]);

  return (
    <div ref={ref} style={style}>
      {visible ? children : fallback}
    </div>
  );
}