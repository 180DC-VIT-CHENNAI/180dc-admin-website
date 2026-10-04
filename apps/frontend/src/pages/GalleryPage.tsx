import { useCallback, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import GalleryViewer from "../components/gallery/GalleryViewer";
import { CATEGORIES } from "../data/galleryData";
import type { GalleryCategory } from "../data/galleryData";
import {
  GALLERY_EVENTS,
  arrangeForBento,
  getBentoSpans,
} from "../data/galleryEvents";
import "./GalleryBento.css";

export default function GalleryPage() {
  const [year, setYear] = useState<GalleryCategory>(CATEGORIES[0]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const events = useMemo(
    () => arrangeForBento(GALLERY_EVENTS.filter((e) => e.year === year)),
    [year],
  );
  const spans = useMemo(() => getBentoSpans(events.length), [events.length]);

  const photoCounts = useMemo(() => {
    const counts = new Map<GalleryCategory, number>();
    for (const e of GALLERY_EVENTS) {
      counts.set(e.year, (counts.get(e.year) ?? 0) + e.items.length);
    }
    return counts;
  }, []);

  const activeEvent = useMemo(
    () => GALLERY_EVENTS.find((e) => e.key === activeKey) ?? null,
    [activeKey],
  );
  const closeViewer = useCallback(() => setActiveKey(null), []);

  return (
    <div className="bento-page">
      {/* Light SVG backdrop decoration, sits behind all content */}
      <svg
        className="bento-deco"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <g className="bento-deco-lines" fill="none" strokeLinecap="round">
          <circle cx="1260" cy="130" r="90" strokeOpacity="0.2" />
          <circle cx="1260" cy="130" r="160" strokeOpacity="0.14" />
          <circle cx="1260" cy="130" r="240" strokeOpacity="0.09" />
          <circle cx="1260" cy="130" r="330" strokeOpacity="0.05" />
          <circle cx="140" cy="780" r="110" strokeOpacity="0.18" />
          <circle cx="140" cy="780" r="190" strokeOpacity="0.12" />
          <circle cx="140" cy="780" r="280" strokeOpacity="0.07" />
          <circle cx="140" cy="780" r="380" strokeOpacity="0.04" />
          <path
            d="M -20 260 C 140 210 220 350 380 300 S 560 190 700 240"
            strokeOpacity="0.2"
            strokeWidth="1.5"
          />
          <path
            d="M 1460 680 C 1300 740 1220 600 1060 650 S 880 760 740 710"
            strokeOpacity="0.2"
            strokeWidth="1.5"
          />
          <path
            d="M 420 -20 C 460 60 400 120 450 200"
            strokeOpacity="0.14"
            strokeWidth="1.2"
          />
          <path
            d="M 1000 920 C 960 840 1020 780 970 700"
            strokeOpacity="0.14"
            strokeWidth="1.2"
          />
        </g>
        <g className="bento-deco-dots">
          <circle cx="380" cy="300" r="3.5" />
          <circle cx="700" cy="240" r="3" />
          <circle cx="1060" cy="650" r="3.5" />
          <circle cx="740" cy="710" r="3" />
          <circle cx="450" cy="200" r="2.5" />
          <circle cx="970" cy="700" r="2.5" />
          <circle cx="880" cy="70" r="2" />
          <circle cx="560" cy="840" r="2" />
        </g>
      </svg>

      <Link to="/" className="bento-back" aria-label="Back to home page">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        <span>Back to Home</span>
      </Link>

      <header className="bento-header">
        <p className="bento-eyebrow">
          <span>
            180DC <strong>VIT Chennai</strong> <i>/</i> Gallery
          </span>
        </p>
        <h1 className="bento-title">
          The people behind the <em>impact</em>
        </h1>
        <p className="bento-sub">
          Moments from our journey — teams, events, projects, and a community
          driven by purpose.
        </p>

        <div className="bento-pills" role="tablist" aria-label="Gallery years">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={year === cat}
              className={`bento-pill${year === cat ? " is-active" : ""}`}
              onClick={() => setYear(cat)}
            >
              {cat}
              <span className="bento-pill-count">{photoCounts.get(cat) ?? 0}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="bento-main" aria-label="Event galleries">
        {events.length === 0 ? (
          <p className="bento-empty">No photos here yet.</p>
        ) : (
          <div key={year} className="bento-grid">
            {events.map((ev, i) => {
              const span = spans[i];
              const count = ev.items.length;
              return (
                <button
                  key={ev.key}
                  type="button"
                  className="bento-tile"
                  style={
                    { "--c": span.c, "--r": span.r, "--i": i } as CSSProperties
                  }
                  onClick={() => setActiveKey(ev.key)}
                  aria-label={`${ev.title}, ${count} ${count === 1 ? "photo" : "photos"}. Open gallery`}
                >
                  <img
                    className="bento-img"
                    src={ev.items[0].image}
                    alt=""
                    loading={i < 4 ? "eager" : "lazy"}
                    decoding="async"
                  />
                  <span className="bento-shade" aria-hidden="true" />
                  <span className="bento-label">
                    <span className="bento-bar" aria-hidden="true" />
                    <span className="bento-text">
                      <span className="bento-name">{ev.title}</span>
                      <span className="bento-meta">
                        {count} {count === 1 ? "photo" : "photos"}
                      </span>
                    </span>
                  </span>
                  <span className="bento-go" aria-hidden="true">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </main>

      {activeEvent && (
        <GalleryViewer
          key={activeEvent.key}
          event={activeEvent}
          onClose={closeViewer}
        />
      )}
    </div>
  );
}