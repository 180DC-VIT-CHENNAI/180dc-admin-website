import { useCallback, useEffect, useRef, useState } from 'react';
import type { GalleryEvent } from '../../data/galleryEvents';
import './GalleryViewer.css';

interface GalleryViewerProps {
  event: GalleryEvent;
  onClose: () => void;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function GalleryViewer({ event, onClose }: GalleryViewerProps) {
  const { items } = event;
  const n = items.length;
  const [idx, setIdx] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);

  // Centre a slide in the track (manual scrollTo so the page behind never jumps).
  const goTo = useCallback((i: number) => {
    const track = trackRef.current;
    const slide = track?.children[i] as HTMLElement | undefined;
    if (!track || !slide) return;
    track.scrollTo({
      left: slide.offsetLeft - (track.clientWidth - slide.clientWidth) / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, []);

  // The slide closest to the centre is the active one (also works for swipes).
  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const centre = track.scrollLeft + track.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    Array.from(track.children).forEach((el, i) => {
      const s = el as HTMLElement;
      const d = Math.abs(s.offsetLeft + s.clientWidth / 2 - centre);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    });
    setIdx(best);
  };

  // Lock page scroll while open, and give focus back to the tile on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    backRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  // Keep the active thumbnail centred in the strip.
  useEffect(() => {
    const strip = stripRef.current;
    const thumb = strip?.children[idx] as HTMLElement | undefined;
    if (!strip || !thumb) return;
    strip.scrollTo({
      left: thumb.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });
  }, [idx]);

  // Keyboard: arrows move, Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (n > 1 && e.key === 'ArrowRight') goTo((idx + 1) % n);
      else if (n > 1 && e.key === 'ArrowLeft') goTo((idx - 1 + n) % n);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, n, goTo, onClose]);

  return (
    <div className="gv-root" role="dialog" aria-modal="true" aria-label={event.title}>
      {/* Light SVG backdrop decoration, sits behind everything */}
      <svg
        className="gv-deco"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g fill="none" stroke="#8dc63f" strokeLinecap="round">
          <circle cx="1240" cy="140" r="90" strokeOpacity="0.18" />
          <circle cx="1240" cy="140" r="150" strokeOpacity="0.12" />
          <circle cx="1240" cy="140" r="220" strokeOpacity="0.07" />
          <circle cx="160" cy="760" r="110" strokeOpacity="0.16" />
          <circle cx="160" cy="760" r="180" strokeOpacity="0.1" />
          <circle cx="160" cy="760" r="260" strokeOpacity="0.06" />
          <path d="M -20 300 C 120 260 200 380 340 330" strokeOpacity="0.22" strokeWidth="1.5" />
          <path d="M 1460 640 C 1320 700 1240 580 1100 640" strokeOpacity="0.22" strokeWidth="1.5" />
        </g>
        <g fill="#8dc63f" fillOpacity="0.25">
          <circle cx="340" cy="330" r="3" />
          <circle cx="1100" cy="640" r="3" />
          <circle cx="720" cy="60" r="2" />
          <circle cx="980" cy="860" r="2" />
        </g>
      </svg>

      <div className="gv-top">
        <button ref={backRef} type="button" className="gv-back" onClick={onClose}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to gallery
        </button>
      </div>

      <div className="gv-stage">
        {n > 1 && (
          <>
            <button type="button" className="gv-arrow gv-arrow-l" aria-label="Previous photo" onClick={() => goTo((idx - 1 + n) % n)}>
              {'\u2039'}
            </button>
            <button type="button" className="gv-arrow gv-arrow-r" aria-label="Next photo" onClick={() => goTo((idx + 1) % n)}>
              {'\u203A'}
            </button>
          </>
        )}
        <div className="gv-track" ref={trackRef} onScroll={handleScroll}>
          {items.map((item, i) => (
            <figure
              key={item.id}
              className={`gv-slide${i === idx ? ' is-active' : ''}`}
              onClick={() => i !== idx && goTo(i)}
            >
              <div className="gv-frame">
                <img className="gv-blur" src={item.image} alt="" aria-hidden="true" loading="lazy" />
                <img
                  className="gv-img"
                  src={item.image}
                  alt={`${event.title}, photo ${i + 1} of ${n}`}
                  loading={i < 3 ? 'eager' : 'lazy'}
                  decoding="async"
                />
              </div>
            </figure>
          ))}
        </div>
      </div>

      <section className="gv-info">
        <div className="gv-info-head">
          <span className="gv-overline">{event.year}</span>
          <span className="gv-count" aria-live="polite">
            {idx + 1} / {n}
          </span>
        </div>
        <h2 className="gv-title">{event.title}</h2>
        {event.description ? <p className="gv-desc">{event.description}</p> : null}
      </section>

      {n > 1 && (
        <div className="gv-strip" ref={stripRef}>
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              className={`gv-thumb${i === idx ? ' is-active' : ''}`}
              aria-label={`Go to photo ${i + 1}`}
              onClick={() => goTo(i)}
            >
              <img src={item.image} alt="" loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}