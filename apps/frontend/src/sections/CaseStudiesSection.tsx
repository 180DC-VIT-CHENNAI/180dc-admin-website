import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { apiUrl } from "../lib/api";
import { sanitizeHtml } from "../lib/sanitize";

gsap.registerPlugin(ScrollTrigger);

interface Props {
  caseStudies: any[];
}

export default function CaseStudiesSection({ caseStudies }: Props) {
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (caseStudies.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".cases-grid").forEach((grid) => {
        const cards = grid.querySelectorAll(".case-card");
        gsap.fromTo(
          cards,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: {
              trigger: grid,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, [caseStudies.length]);

  return (
    <section id="case-studies" className="cases-section" ref={sectionRef}>
      <div className="container">
        <div className="section-header reveal">
          <span className="eyebrow">02 — Case Studies</span>
          <h2 className="section-heading" style={{ margin: 0 }}>
            Latest Case Studies
          </h2>
        </div>
        <div
          className="cases-grid"
          style={
            caseStudies.length > 4
              ? { maxHeight: 520, overflowY: "auto", paddingRight: 8 }
              : undefined
          }
        >
          {caseStudies.length === 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "48px 20px",
                color: "var(--text-secondary)",
                fontSize: "0.9375rem",
              }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", opacity: 0.25 }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <p style={{ margin: 0 }}>No case studies published yet. Check back soon.</p>
            </div>
          )}
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {caseStudies.map((cs: any, i: number) => (
            <div
              key={i}
              className={`case-card card-doodle ${expandedCard === i ? "expanded" : ""}`}
              onClick={() => setExpandedCard(expandedCard === i ? null : i)}
              style={{ cursor: "pointer" }}
            >
              <span className="case-tag">{cs.tag}</span>
              <h3>{cs.title}</h3>
              {cs.description && <p>{cs.description}</p>}
              <div
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--text-tertiary)",
                  marginBottom: "4px",
                }}
              >
                By {cs.author_name || "Anonymous"}
              </div>
              {expandedCard === i && cs.source_file_url && (
                <div
                  style={{
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--border-default)",
                  }}
                >
                  <iframe
                    src={apiUrl(cs.source_file_url)}
                    title={cs.title || "Case Study PDF"}
                    style={{
                      width: "100%",
                      height: "70vh",
                      minHeight: 500,
                      border: "none",
                      borderRadius: 8,
                      background: "#f5f5f5",
                    }}
                  />
                  <a
                    href={apiUrl(cs.source_file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 8,
                      padding: "6px 12px",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--accent-primary)",
                      background: "var(--accent-bg, rgba(0,0,0,0.04))",
                      borderRadius: 6,
                      textDecoration: "none",
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download Source Document
                  </a>
                </div>
              )}
              {expandedCard === i && !cs.source_file_url && cs.content && (
                <div
                  className="card-expanded"
                  style={{
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid var(--border-default)",
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(cs.content) }}
                />
              )}
              <span className="read-more">
                {expandedCard === i ? "Show less" : "Click to expand"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
