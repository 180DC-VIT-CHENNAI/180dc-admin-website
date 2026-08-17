import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { apiUrl } from "../lib/api";

gsap.registerPlugin(ScrollTrigger);

interface Newsletter {
  id: string;
  title: string;
  description: string;
  source_file_url: string | null;
  created_at: string;
}

export default function NewsletterSection() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [subscribing, setSubscribing] = useState(false);
  const [subMsg, setSubMsg] = useState("");
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(apiUrl("/api/newsletter"));
        const data = await res.json();
        if (data.success) setNewsletters(data.data || []);
      } catch {}
    }
    load();
  }, []);

  useEffect(() => {
    if (newsletters.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".newsletter-grid").forEach((grid) => {
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
  }, [newsletters.length]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    setSubscribing(true);
    setSubMsg("");
    try {
      const res = await fetch(apiUrl("/api/newsletter/subscribe"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      setSubMsg(data.message || (data.success ? "Subscribed!" : "Something went wrong"));
      if (data.success) setEmail("");
    } catch {
      setSubMsg("Network error. Please try again.");
    }
    setSubscribing(false);
  };

  return (
    <section id="newsletter" className="cases-section" ref={sectionRef}>
      <div className="container">
        <div className="section-header reveal">
          <span className="eyebrow">05 — Newsletter</span>
          <h2 className="section-heading" style={{ margin: 0 }}>
            Newsletter
          </h2>
        </div>

        {/* Subscribe form */}
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto 2rem",
            padding: "1.5rem",
            borderRadius: 12,
            border: "2px solid var(--border-default)",
            background: "var(--bg-secondary, rgba(0,0,0,0.02))",
          }}
        >
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "var(--text-secondary)", textAlign: "center" }}>
            Stay updated — get our latest newsletters delivered to your inbox.
          </p>
          <form onSubmit={handleSubscribe} style={{ display: "flex", gap: 8 }}>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                flex: 1,
                padding: "10px 14px",
                borderRadius: 8,
                border: "2px solid var(--border-default)",
                background: "var(--bg-primary)",
                color: "var(--text-primary)",
                fontSize: 14,
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={subscribing}
              className="btn"
              style={{ whiteSpace: "nowrap", padding: "10px 20px" }}
            >
              {subscribing ? "..." : "Subscribe"}
            </button>
          </form>
          {subMsg && (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
              {subMsg}
            </p>
          )}
        </div>

        {/* Newsletter cards */}
        <div className="newsletter-grid" style={newsletters.length > 4 ? { maxHeight: 520, overflowY: "auto", paddingRight: 8 } : undefined}>
          {newsletters.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "48px 20px", color: "var(--text-secondary)", fontSize: "0.9375rem" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", opacity: 0.25 }}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
              <p style={{ margin: 0 }}>No newsletters published yet. Check back soon.</p>
            </div>
          )}
          {newsletters.map((nl) => (
            <div
              key={nl.id}
              className={`case-card card-doodle ${expandedCard === nl.id ? "expanded" : ""}`}
              onClick={() => setExpandedCard(expandedCard === nl.id ? null : nl.id)}
              style={{ cursor: "pointer" }}
            >
              <span className="case-tag">Newsletter</span>
              <h3>{nl.title}</h3>
              {nl.description && <p>{nl.description}</p>}
              <div style={{ fontSize: "0.8125rem", color: "var(--text-tertiary)", marginBottom: "4px" }}>
                {nl.created_at?.slice(0, 10)}
              </div>
              {expandedCard === nl.id && nl.source_file_url && (
                <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid var(--border-default)" }}>
                  <iframe
                    src={apiUrl(nl.source_file_url)}
                    title={nl.title}
                    style={{ width: "100%", height: "70vh", minHeight: 500, border: "none", borderRadius: 8, background: "#f5f5f5" }}
                  />
                  <a
                    href={apiUrl(nl.source_file_url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "var(--accent-primary)", background: "var(--accent-bg, rgba(0,0,0,0.04))", borderRadius: 6, textDecoration: "none" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Download PDF
                  </a>
                </div>
              )}
              <span className="read-more">
                {expandedCard === nl.id ? "Show less" : "Click to expand"}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
