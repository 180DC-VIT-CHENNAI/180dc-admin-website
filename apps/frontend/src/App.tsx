import { useEffect, useRef, useState } from "react";
import "./index.css";
import Globe from "./components/Globe";
import MagicRings from "./components/MagicRings";
import VariableProximity from "./components/VariableProximity";
import SmoothScroll from "./components/SmoothScroll";
import PillNav from "./components/PillNav";
import ColorBends from "./components/ColorBends";
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
      { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", delay: 0.2 }
    );
    heroTl.fromTo(
      ".hero-subtitle",
      { y: 40, opacity: 0 },
      { y: 0, opacity: 1, duration: 1, ease: "power3.out" },
      "-=0.8"
    );
    heroTl.fromTo(
      ".cta-buttons",
      { y: 30, opacity: 0 },
      { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
      "-=0.6"
    );
    heroTl.fromTo(
      ".hero-image-wrapper",
      { x: 60, opacity: 0 },
      { x: 0, opacity: 1, duration: 1.2, ease: "power3.out" },
      "-=1"
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
        }
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
        }
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
        }
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
        }
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
        }
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

  const caseStudies = [
    {
      tag: "Strategy",
      title: "EdTech Startup Growth",
      desc: "Developed a comprehensive Go-To-Market strategy and user acquisition model for a rising EdTech platform serving 50K+ students.",
    },
    {
      tag: "Operations",
      title: "NGO Operational Overhaul",
      desc: "Streamlined logistics and supply chain inefficiencies for a local food distribution non-profit, reducing costs by 30%.",
    },
    {
      tag: "Marketing",
      title: "Social Media Campaign",
      desc: "Designed a viral social media campaign for a mental health awareness organization, reaching 2M+ impressions.",
    },
    {
      tag: "Finance",
      title: "Fundraising Strategy",
      desc: "Created a diversified fundraising strategy for an educational NGO, increasing donations by 45% in 6 months.",
    },
    {
      tag: "Impact",
      title: "Rural Education Program",
      desc: "Developed a scalable rural education program model for an NGO, impacting 10,000+ students across 50 villages.",
    },
    {
      tag: "Technology",
      title: "Digital Transformation",
      desc: "Led digital transformation for a legacy non-profit, modernizing their tech stack and improving efficiency by 60%.",
    },
  ];

  const teamMembers = [
    { initials: "JD", name: "John Doe", role: "President" },
    { initials: "JS", name: "Jane Smith", role: "Director of External Relations" },
    { initials: "AT", name: "Alex Turner", role: "Director of Internal Relations" },
    { initials: "EC", name: "Emily Chen", role: "Director of L&D" },
    { initials: "MR", name: "Michael Ross", role: "VP of Projects" },
    { initials: "SL", name: "Sarah Lee", role: "Head of Marketing" },
  ];

  const blogPosts = [
    {
      date: "Jan 15, 2026",
      title: "The Future of Social Impact",
      desc: "How Gen-Z consultants are changing the non-profit landscape with innovative strategies and digital-first approaches.",
    },
    {
      date: "Jan 10, 2026",
      title: "Strategy Frameworks 101",
      desc: "A deep dive into MECE and creating effective structures for problem-solving in consulting engagements.",
    },
    {
      date: "Jan 5, 2026",
      title: "Building Sustainable NGOs",
      desc: "Key insights from our 20+ projects on what makes non-profits thrive in the long term.",
    },
    {
      date: "Dec 28, 2025",
      title: "Student Leadership Guide",
      desc: "How to lead high-performing student teams and deliver real impact for social organizations.",
    },
  ];

  const partners = [
    "Partner Org 1",
    "Partner Org 2",
    "Partner Org 3",
    "Partner Org 4",
    "Partner Org 5",
    "Partner Org 6",
    "Partner Org 7",
    "Partner Org 8",
  ];

  return (
    <SmoothScroll>
      <GrainOverlay />
      <PillNav
        items={navItems}
        activeHref={activeNav}
        logo="/images/180DC.png"
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
              style={{ width: 30, color: "#8dc63f", position: "absolute", top: "-15px", left: "20px" }}
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
              <a href="#contact" className="btn outline">
                Work With Us
              </a>
            </div>
            <ScribbleArrow
              style={{ width: 100, color: "#8dc63f", marginTop: "2rem", transform: "rotate(15deg)" }}
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
              style={{ width: 60, color: "#8dc63f", position: "absolute", bottom: "-20px", right: "-20px", zIndex: 2 }}
            />
          </div>
        </div>
      </header>

      {/* Global Network Section */}
      <section id="global-network" className="global-network-section">
        <div className="container" style={{ textAlign: "center" }}>
          <span className="section-label">Our Reach</span>
          <h2 className="reveal" style={{ fontFamily: "'Caveat', cursive", fontSize: "3rem" }}>
            Our Global Network
          </h2>
          <p
            className="reveal reveal-delay-1"
            style={{ maxWidth: "600px", margin: "0 auto 3rem auto", fontFamily: "'Patrick Hand', cursive", fontSize: "1.2rem" }}
          >
            180 Degrees Consulting spans the globe. Here is where the VIT
            Chennai branch anchors our impact in India.
          </p>
          <div className="reveal reveal-delay-2">
            <Globe />
          </div>
          <ScribbleSquiggle
            style={{ width: 150, color: "#8dc63f", margin: "3rem auto 0", display: "block" }}
          />
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="about-section">
        <div className="container">
          <div className="about-card reveal">
            <ScribbleStar
              style={{ width: 30, color: "#8dc63f", position: "absolute", top: "-15px", right: "30px" }}
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

      {/* Case Studies Section */}
      <section id="case-studies" className="cases-section">
        <div className="container">
          <span className="section-label">02 — Case Studies</span>
          <h2 className="reveal" style={{ fontFamily: "'Caveat', cursive", fontSize: "3rem", marginBottom: "3rem" }}>
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
                  style={{ width: 30, color: "#8dc63f", position: "absolute", top: "-15px", left: "20px" }}
                />
                <span className="case-tag">{cs.tag}</span>
                <h3>{cs.title}</h3>
                <p>{cs.desc}</p>
                {expandedCard === i && (
                  <div className="card-expanded" style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "2px dashed var(--text-black)" }}>
                    <p style={{ fontSize: "0.9rem", color: "var(--text-gray)" }}>
                      <strong>Impact:</strong> Delivered measurable results within 3 months. Client retention increased by 40%.
                    </p>
                    <p style={{ fontSize: "0.9rem", color: "var(--text-gray)" }}>
                      <strong>Team:</strong> 5 consultants, 2 project managers
                    </p>
                  </div>
                )}
                <span className="read-more">
                  {expandedCard === i ? "Show less \u2191" : "Click to expand \u2192"}
                </span>
              </div>
            ))}
          </div>
          <ScribbleSquiggle
            style={{ width: 150, color: "#8dc63f", margin: "3rem auto 0", display: "block" }}
          />
        </div>
      </section>

      {/* Leadership Section */}
      <section id="leadership" className="leadership-section">
        <div className="container">
          <span className="section-label">03 — Leadership</span>
          <h2
            className="reveal text-center"
            style={{ fontFamily: "'Caveat', cursive", fontSize: "3rem", marginBottom: "3rem", textAlign: "center" }}
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
            style={{ width: 150, color: "#8dc63f", margin: "3rem auto 0", display: "block" }}
          />
        </div>
      </section>

      {/* Blog Section */}
      <section id="blog" className="blog-section">
        <div className="container">
          <div className="section-header reveal">
            <div>
              <span className="section-label">04 — Blog</span>
              <h2 style={{ fontFamily: "'Caveat', cursive", fontSize: "3rem", margin: 0 }}>
                Consulting Insights
              </h2>
              <p style={{ fontFamily: "'Patrick Hand', cursive", fontSize: "1.2rem", margin: 0 }}>
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
                <p>{post.desc}</p>
                <a href="#" className="read-more-btn">
                  Read Post
                </a>
              </div>
            ))}
          </div>
          <ScribbleSquiggle
            style={{ width: 150, color: "#8dc63f", margin: "3rem auto 0", display: "block" }}
          />
        </div>
      </section>

      {/* Partners Section */}
      <section id="partners" className="partners-section">
        <div className="container">
          <span className="section-label">05 — Partners</span>
          <h2
            className="reveal"
            style={{ fontFamily: "'Caveat', cursive", fontSize: "3rem", marginBottom: "2rem", textAlign: "center" }}
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
          <div className="footer-links">
            <h4>Quick Links</h4>
            <a href="#about">About</a>
            <a href="#case-studies">Case Studies</a>
            <a href="#blog">Blog</a>
            <a href="#partners">Partners</a>
          </div>
        </div>
        <div className="copyright text-center">
          <p>&copy; 2026 180dc vit chennai. All rights reserved.</p>
        </div>
      </footer>
    </SmoothScroll>
  );
}

export default App;
