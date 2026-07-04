import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScribbleStar, ScribbleSquiggle } from "../components/DoodleSVG";
import { apiUrl } from "../lib/api";
import { sanitizeHtml } from "../lib/sanitize";

gsap.registerPlugin(ScrollTrigger);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props {
  caseStudies: any[];
}

export default function CaseStudiesSection({ caseStudies }: Props) {
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Don't try to animate before data arrives
    if (caseStudies.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".cases-grid").forEach((grid) => {
        const cards = grid.querySelectorAll(".case-card");
        gsap.fromTo(
          cards,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.15,
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
  // Re-run only when length flips from 0 → N, not on every keystroke
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseStudies.length]);

  return (
    <section id="case-studies" className="cases-section" ref={sectionRef}>
      <div className="container">
        <span className="section-label">02 — Case Studies</span>
        <h2
          className="reveal section-heading"
          style={{ marginBottom: "3rem" }}
        >
          Latest Case Studies
        </h2>
        <div
          className="cases-grid"
          style={
            caseStudies.length > 4
              ? { maxHeight: 520, overflowY: "auto", paddingRight: 8 }
              : undefined
          }
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {caseStudies.map((cs: any, i: number) => (
            <div
              key={i}
              className={`case-card card-doodle ${expandedCard === i ? "expanded" : ""}`}
              onClick={() => setExpandedCard(expandedCard === i ? null : i)}
              style={{ cursor: "pointer" }}
            >
              <ScribbleStar
                style={{
                  width: 30,
                  color: "#8dc63f",
                  position: "absolute",
                  top: "-15px",
                  left: "20px",
                }}
              />
              <span className="case-tag">{cs.tag}</span>
              <h3>{cs.title}</h3>
              <p>{cs.description}</p>
              {cs.image_url && (
                <img
                  src={apiUrl(cs.image_url)}
                  alt=""
                  loading="lazy"
                  style={{
                    width: "100%",
                    maxHeight: 160,
                    objectFit: "cover",
                    borderRadius: 8,
                    marginBottom: 8,
                  }}
                />
              )}
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text-secondary)",
                  marginBottom: 4,
                }}
              >
                By {cs.author_name || "Anonymous"}
              </div>
              {expandedCard === i && cs.content && (
                <div
                  className="card-expanded"
                  style={{
                    marginTop: "1rem",
                    paddingTop: "1rem",
                    borderTop: "2px dashed var(--text-black)",
                  }}
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(cs.content) }}
                />
              )}
              <span className="read-more">
                {expandedCard === i ? "Show less \u2191" : "Click to expand \u2192"}
              </span>
            </div>
          ))}
        </div>
        <ScribbleSquiggle
          style={{
            width: 150,
            color: "#8dc63f",
            margin: "3rem auto 0",
            display: "block",
          }}
        />
      </div>
    </section>
  );
}