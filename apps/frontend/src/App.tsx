import { useEffect, useRef, useState, useCallback } from "react";
import "./index.css";
import Globe from "./components/Globe";
import MagicRings from "./components/MagicRings";
import VariableProximity from "./components/VariableProximity";
import SmoothScroll from "./components/SmoothScroll";
import PillNav from "./components/PillNav";
import ColorBends from "./components/ColorBends";
import ConsultingBoy from "./components/ConsultingBoy";
import ConsultingFormModal from "./components/ConsultingFormModal";
import { apiUrl } from "./lib/api";
import {
  ScribbleArrow,
  ScribbleCircle,
  ScribbleUnderline,
  ScribbleStar,
  ScribbleSquiggle,
  GrainOverlay,
} from "./components/DoodleSVG";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function App() {
  const splashRef = useRef<HTMLDivElement>(null);
  const [activeNav, setActiveNav] = useState("#");
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [showConsultingForm, setShowConsultingForm] = useState(false);
  const openConsultingForm = useCallback(() => setShowConsultingForm(true), []);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [caseStudies, setCaseStudies] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [teamMembers, setTeamMembers] = useState<any[]>([
    { name: "John Doe", role: "President", initials: "JD" },
    { name: "John Doe", role: "Vice President", initials: "JD" },
    { name: "John Doe", role: "Head of Operations", initials: "JD" },
    { name: "John Doe", role: "Head of Marketing", initials: "JD" },
    { name: "John Doe", role: "Head of Finance", initials: "JD" },
    { name: "John Doe", role: "Head of Research", initials: "JD" },
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [blogPosts, setBlogPosts] = useState<any[]>([]);
  const [partners, setPartners] = useState<string[]>(
    Array.from({ length: 20 }, (_, i) => `Partner ${i + 1}`),
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [completedProjects, setCompletedProjects] = useState<any[]>([]);

  useEffect(() => {
    async function loadContent() {
      try {
        const [csRes, tmRes, bpRes, pRes] = await Promise.all([
          fetch(apiUrl("/api/content/case-studies")).then((r) => r.json()),
          fetch(apiUrl("/api/content/team-members")).then((r) => r.json()),
          fetch(apiUrl("/api/content/blog-posts")).then((r) => r.json()),
          fetch(apiUrl("/api/content/partners")).then((r) => r.json()),
        ]);
        if (csRes.success) setCaseStudies(csRes.data);
        if (tmRes.success) setTeamMembers(tmRes.data);
        if (bpRes.success) setBlogPosts(bpRes.data);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (pRes.success) setPartners(pRes.data.map((p: any) => p.name));
        const completedRes = await fetch(
          apiUrl("/api/projects/completed"),
        ).then((r) => r.json());
        if (completedRes.success) setCompletedProjects(completedRes.data);
      } catch (e) {
        console.error("Failed to load content", e);
      }
    }
    loadContent();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const sections = [
        "about",
        "case-studies",
        "leadership",
        "blog",
        "partners",
      ];
      let current = "#";
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const rect = element.getBoundingClientRect();
          if (rect.top <= 100) {
            current = `#${section}`;
          }
        }
      }
      setActiveNav(current);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const heroTl = gsap.timeline();
    heroTl.fromTo(
      ".hero-content h1",
      { y: 60, opacity: 0 },
      { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", delay: 0.2 },
    );
    heroTl.fromTo(
      ".hero-subtitle",
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: "power3.out" },
      "-=0.8",
    );
    heroTl.fromTo(
      ".cta-buttons",
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
      "-=0.6",
    );
    heroTl.fromTo(
      ".hero-image-wrapper",
      { x: 60, opacity: 0 },
      { x: 0, opacity: 1, duration: 1.2, ease: "power3.out" },
      "-=1",
    );

    gsap.utils.toArray<HTMLElement>(".reveal").forEach((el) => {
      gsap.fromTo(
        el,
        { y: 50, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: el,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        },
      );
    });

    gsap.to(".hero-image", {
      y: -60,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });

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
        },
      );
    });

    gsap.utils.toArray<HTMLElement>(".team-grid").forEach((grid) => {
      const cards = grid.querySelectorAll(".team-card");
      gsap.fromTo(
        cards,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.8,
          stagger: 0.1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: grid,
            start: "top 80%",
            toggleActions: "play none none none",
          },
        },
      );
    });

    gsap.utils.toArray<HTMLElement>(".blog-grid").forEach((grid) => {
      const cards = grid.querySelectorAll(".blog-card");
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
        },
      );
    });

    gsap.utils.toArray<HTMLElement>(".stat-item").forEach((stat) => {
      gsap.fromTo(
        stat,
        { scale: 0.8, opacity: 0 },
        {
          scale: 1,
          opacity: 1,
          duration: 0.8,
          ease: "back.out(1.7)",
          scrollTrigger: {
            trigger: stat,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        },
      );
    });

    const cards = document.querySelectorAll(".card-doodle");
    cards.forEach((card) => {
      card.addEventListener("mouseenter", () => {
        gsap.to(card, {
          scale: 1.02,
          duration: 0.3,
          ease: "power2.out",
        });
      });
      card.addEventListener("mouseleave", () => {
        gsap.to(card, {
          scale: 1,
          duration: 0.3,
          ease: "power2.out",
        });
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  const navItems = [
    { label: "Home", href: "#" },
    { label: "About", href: "#about" },
    { label: "Case Studies", href: "#case-studies" },
    { label: "Leadership", href: "#leadership" },
    { label: "Blog", href: "#blog" },
    { label: "Partners", href: "#partners" },
    { label: "Recruitments", href: "/recruitments" },
  ];

  return (
    <SmoothScroll>
      <GrainOverlay />
      <PillNav
        items={navItems}
        activeHref={activeNav}
        logo="/images/official-logo.jpg"
      />

      {/* Splash Landing Page */}
      <section className="splash-landing">
        <div className="splash-bg" ref={splashRef}>
          <MagicRings
            color="#8dc63f"
            colorTwo="#a8d96a"
            ringCount={10}
            speed={0.8}
            attenuation={8}
            lineThickness={4}
            baseRadius={0.25}
            radiusStep={0.15}
            scaleRate={0.12}
            opacity={1}
            blur={0}
            noiseAmount={0.05}
            rotation={0}
            ringGap={1.4}
            fadeIn={0.7}
            fadeOut={0.5}
            followMouse={true}
            mouseInfluence={0.3}
            hoverScale={1.3}
            parallax={0.08}
            clickBurst={true}
          />
        </div>
        <div className="splash-content splash-white">
          <div className="splash-logo-white" />
          <div className="splash-title-wrapper">
            <VariableProximity
              label="180 Degrees Consulting"
              className="splash-title-variable"
              containerRef={splashRef}
              fromFontVariationSettings="'wght' 400, 'opsz' 9"
              toFontVariationSettings="'wght' 1000, 'opsz' 40"
              radius={120}
              falloff="linear"
            />
            <br />
            <VariableProximity
              label="VIT Chennai"
              className="splash-subtitle-variable"
              containerRef={splashRef}
              fromFontVariationSettings="'wght' 300, 'opsz' 9"
              toFontVariationSettings="'wght' 900, 'opsz' 40"
              radius={100}
              falloff="linear"
            />
          </div>
          <p className="splash-tagline">
            "Empowering organizations to reach their full potential and maximize
            their social impact."
          </p>
          <ScribbleUnderline
            style={{ width: 200, color: "#8dc63f", margin: "1rem auto" }}
          />
        </div>
        <div className="scroll-indicator">
          <div className="scroll-mouse">
            <div className="scroll-wheel" />
          </div>
          <span className="scroll-text">Scroll to explore</span>
        </div>
      </section>

      {/* Hero Section */}
      <header id="hero" className="hero">
        <div className="hero-bg-overlay">
          <ColorBends
            colors={["#ffffff", "#8dc63f", "#ffffff", "#a8d96a"]}
            speed={0.15}
            warpStrength={1.2}
            intensity={0.8}
            opacity={0.4}
            iterations={2}
          />
        </div>
        <div className="container hero-split">
          <div className="hero-content">
            <ScribbleStar
              style={{
                width: 30,
                color: "#8dc63f",
                position: "absolute",
                top: "-15px",
                left: "20px",
              }}
            />
            <h1>
              Transforming
              <br />
              Non-Profits.
              <br />
              Empowering
              <br />
              Students.
            </h1>
            <p className="hero-subtitle">
              180 Degrees Consulting VIT Chennai is part of the world's largest
              university-based consultancy. We connect students with social
              enterprises to achieve meaningful impact.
            </p>
            <div className="cta-buttons">
              <a href="#about" className="btn">
                Who We Are
              </a>
              <button className="btn outline" onClick={openConsultingForm}>
                Work With Us
              </button>
            </div>
            <ScribbleArrow
              style={{
                width: 100,
                color: "#8dc63f",
                marginTop: "2rem",
                transform: "rotate(15deg)",
              }}
            />
          </div>
          <div className="hero-image-wrapper">
            <div className="hero-image-backdrop" />
            <img
              src="/images/VIT-chennai.png"
              alt="VIT Chennai Campus"
              className="hero-image"
            />
            <ScribbleCircle
              style={{
                width: 60,
                color: "#8dc63f",
                position: "absolute",
                bottom: "-20px",
                right: "-20px",
                zIndex: 2,
              }}
            />
          </div>
        </div>
      </header>

      {/* Global Network Section */}
      <section id="global-network" className="global-network-section">
        <div className="container" style={{ textAlign: "center" }}>
          <span className="section-label">Our Reach</span>
          <h2 className="reveal section-heading">Our Global Network</h2>
          <p
            className="reveal reveal-delay-1"
            style={{
              maxWidth: "600px",
              margin: "0 auto 3rem auto",
              fontFamily: "'Patrick Hand', cursive",
              fontSize: "1.2rem",
            }}
          >
            180 Degrees Consulting spans the globe. Here is where the VIT
            Chennai branch anchors our impact in India.
          </p>
          <div className="reveal reveal-delay-2">
            <Globe />
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

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="container">
          <div className="about-card reveal">
            <ScribbleStar
              style={{
                width: 30,
                color: "#8dc63f",
                position: "absolute",
                top: "-15px",
                right: "30px",
              }}
            />
            <span className="section-label">01 — About</span>
            <h2>About Our Branch</h2>
            <p>
              Founded at VIT Chennai, our branch consists of high-achieving,
              creative students driven to affect real change. We provide
              socially conscious organizations with very high quality and free
              consulting services.
            </p>
            <div className="stats-grid">
              <div className="stat-item">
                <h3>50+</h3>
                <p>Consultants</p>
              </div>
              <div className="stat-item">
                <h3>20+</h3>
                <p>Projects Completed</p>
              </div>
              <div className="stat-item">
                <h3>100%</h3>
                <p>Client Satisfaction</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Completed Projects Section */}
      {completedProjects.length > 0 && (
        <section className="projects-section">
          <div className="container">
            <span className="section-label">Our Work</span>
            <h2
              className="reveal section-heading"
              style={{ marginBottom: "0.5rem" }}
            >
              Completed Projects
            </h2>
            <p
              style={{
                fontFamily: "'Patrick Hand', cursive",
                fontSize: "1.2rem",
                textAlign: "center",
                marginBottom: "3rem",
                color: "var(--text-secondary)",
              }}
            >
              Projects delivered by our consulting teams
            </p>
            <div
              className="projects-grid"
              style={
                completedProjects.length > 4
                  ? { maxHeight: 520, overflowY: "auto", paddingRight: 8 }
                  : undefined
              }
            >
              {completedProjects.map((p: any) => (
                <div key={p.id} className="card-doodle project-card">
                  <h3 style={{ marginTop: 0 }}>{p.name}</h3>
                  {p.company_org && (
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--primary-green)",
                        marginBottom: 8,
                      }}
                    >
                      {p.company_org}
                    </div>
                  )}
                  {p.description && (
                    <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                      {p.description}
                    </p>
                  )}
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
      )}

      {/* Case Studies Section */}
      <section id="case-studies" className="cases-section">
        <div className="container">
          <span className="section-label">02 — Case Studies</span>
          <h2
            className="reveal section-heading"
            style={{ marginBottom: "3rem" }}
          >
            Latest Case Studies
          </h2>
          <div className="cases-grid">
            {caseStudies.map((cs, i) => (
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
                {expandedCard === i && (
                  <div
                    className="card-expanded"
                    style={{
                      marginTop: "1rem",
                      paddingTop: "1rem",
                      borderTop: "2px dashed var(--text-black)",
                    }}
                  >
                    <p
                      style={{ fontSize: "0.9rem", color: "var(--text-gray)" }}
                    >
                      <strong>Impact:</strong> Delivered measurable results
                      within 3 months. Client retention increased by 40%.
                    </p>
                    <p
                      style={{ fontSize: "0.9rem", color: "var(--text-gray)" }}
                    >
                      <strong>Team:</strong> 5 consultants, 2 project managers
                    </p>
                  </div>
                )}
                <span className="read-more">
                  {expandedCard === i
                    ? "Show less \u2191"
                    : "Click to expand \u2192"}
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

      {/* Leadership Section */}
      <section id="leadership" className="leadership-section">
        <div className="container">
          <span className="section-label">03 — Leadership</span>
          <h2
            className="reveal text-center section-heading"
            style={{ marginBottom: "3rem", textAlign: "center" }}
          >
            Leadership Team
          </h2>
          <div className="team-grid">
            {teamMembers.map((member, i) => (
              <div key={i} className="team-card card-doodle">
                <div className="team-image-placeholder">{member.initials}</div>
                <h4>{member.name}</h4>
                <p>{member.role}</p>
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

      {/* Blog Section */}
      <section id="blog" className="blog-section">
        <div className="container">
          <div className="section-header reveal">
            <div>
              <span className="section-label">04 — Blog</span>
              <h2 className="section-heading" style={{ margin: 0 }}>
                Consulting Insights
              </h2>
              <p
                style={{
                  fontFamily: "'Patrick Hand', cursive",
                  fontSize: "1.2rem",
                  margin: 0,
                }}
              >
                Insights from our consultants and network.
              </p>
            </div>
            <a href="#post-a-blog" className="btn outline post-blog-btn">
              Post a Blog
            </a>
          </div>
          <div className="blog-grid">
            {blogPosts.map((post, i) => (
              <div key={i} className="blog-card card-doodle">
                <span className="blog-date">{post.date}</span>
                <h3>{post.title}</h3>
                <p>{post.description}</p>
                <a href="#" className="read-more-btn">
                  Read Post
                </a>
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

      {/* Partners Section */}
      <section id="partners" className="partners-section">
        <div className="container">
          <span className="section-label">05 — Partners</span>
          <h2
            className="reveal section-heading"
            style={{ marginBottom: "2rem", textAlign: "center" }}
          >
            Our Partners
          </h2>
          <div className="card-doodle reveal" style={{ padding: "2rem" }}>
            <div className="marquee">
              <div className="marquee-content">
                {partners.map((partner, i) => (
                  <span key={i}>{partner}</span>
                ))}
                {partners.map((partner, i) => (
                  <span key={`dup-${i}`}>{partner}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer">
        <div className="container footer-content">
          <div className="footer-info">
            <h3>180DC VIT Chennai</h3>
            <p>Vellore Institute of Technology, Chennai Campus</p>
            <a href="mailto:vit.chennai@180dc.org" className="footer-link">
              vit.chennai@180dc.org
            </a>
            
            <div className="social-links">

              <h4>Connect With Us</h4>
              <ul>
                <li>
                  <a
                    href="https://www.linkedin.com/company/180-degrees-consulting-vit-chennai/posts/?feedView=all"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-btn"
                  >
                    LinkedIn
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.instagram.com/180dc.vitc/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-btn"
                  >
                    Instagram
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="footer-about">
  <h4>About 180DC</h4>
  <p>180 Degrees Consulting is the world's largest consultancy for non-profits and social enterprises, with 190+ branches across universities worldwide. Our VIT Chennai branch connects talented students with organizations that need strategic support to maximize their impact.</p>
</div>
          <div className="footer-links">
            <h4>Quick Links</h4>
            <a href="#about">About</a>
            <a href="#case-studies">Case Studies</a>
            <a href="#blog">Blog</a>
            <a href="#partners">Partners</a>
          </div>
        </div>
        <div className="copyright text-center">
          <p>&copy; 2026 180DC VIT Chennai. All rights reserved.</p>
        </div>
      </footer>

      <ConsultingBoy onRequestConsulting={openConsultingForm} />
      <ConsultingFormModal
        isOpen={showConsultingForm}
        onClose={() => setShowConsultingForm(false)}
      />
    </SmoothScroll>
  );
}

export default App;
