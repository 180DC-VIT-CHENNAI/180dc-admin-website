import { useEffect, useRef, useState } from "react";
import type { ReactNode, CSSProperties } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  rootMargin?: string;
  style?: CSSProperties;
}

export default function LazyReveal({
  children,
  fallback = null,
  rootMargin = "400px",
  style,
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

  return (
    <div ref={ref} style={style}>
      {visible ? children : fallback}
    </div>
  );
}