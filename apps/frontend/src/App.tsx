import { useEffect, useRef, useState } from "react";
import "./index.css";
import Globe from "./components/Globe";
import MagicRings from "./components/MagicRings";
import VariableProximity from "./components/VariableProximity";
import PillNav from "./components/PillNav";
import ColorBends from "./components/ColorBends";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function App() {
  const splashRef = useRef<HTMLDivElement>(null);
  const [activeNav, setActiveNav] = useState("#");

  useEffect(() => {
    // Reveal animations on scroll
    const reveals = document.querySelectorAll(".reveal");
    reveals.forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
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

    // Parallax effect for hero images
    gsap.to(".hero-image", {
      y: -50,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });

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

  const navItems = [
    { label: "Home", href: "#" },
    { label: "About", href: "#about" },
    { label: "Case Studies", href: "#case-studies" },
    { label: "Leadership", href: "#leadership" },
    { label: "Blog", href: "#blog" },
    { label: "Partners", href: "#partners" },
  ];

  return (
    <>
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
          <div className="splash-logo-white"></div>
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
        </div>
        <div className="scroll-indicator">
          <div className="scroll-mouse">
            <div className="scroll-wheel"></div>
          </div>
          <span className="scroll-text">Scroll to explore</span>
        </div>
      </section>

      {/* Hero Section */}
      <header id="hero" className="hero bg-white">
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
          <div className="hero-content reveal">
            <h1>
              Transforming Non-Profits.
              <br />
              Empowering Students.
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
          </div>
          <div className="hero-image-wrapper reveal reveal-delay-2">
            <div className="hero-image-backdrop"></div>
            <img
              src="/images/VIT-chennai.png"
              alt="VIT Chennai Campus"
              className="hero-image"
            />
          </div>
        </div>
      </header>

      {/* Global Network Section */}
      <section id="global-network" className="bg-white">
        <div
          className="container"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <h2 className="reveal">Our Global Network</h2>
          <p
            className="reveal reveal-delay-1"
            style={{ maxWidth: "600px", margin: "0 auto 3rem auto" }}
          >
            180 Degrees Consulting spans the globe. Here is where the VIT
            Chennai branch anchors our impact in India.
          </p>
          <div className="reveal reveal-delay-2">
            <Globe />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="bg-green">
        <div className="container">
          <div className="card card-white reveal">
            <h2>About Our Branch</h2>
            <p>
              Founded at VIT Chennai, our branch consists of high-achieving,
              creative students driven to affect real change. We provide
              socially conscious organizations with very high quality and free
              consulting services.
            </p>
            <div className="grid cols-3" style={{ marginTop: "3rem" }}>
              <div className="about-stat">
                <h3>50+</h3>
                <p>Consultants</p>
              </div>
              <div className="about-stat">
                <h3>20+</h3>
                <p>Projects Completed</p>
              </div>
              <div className="about-stat">
                <h3>100%</h3>
                <p>Client Satisfaction</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies Section */}
      <section id="case-studies" className="bg-white">
        <div className="container">
          <h2 className="reveal">Latest Case Studies</h2>
          <div className="grid">
            <div className="card card-outline-green hover-lift reveal reveal-delay-1">
              <h3>EdTech Startup Growth</h3>
              <p>
                Developed a comprehensive Go-To-Market strategy and user
                acquisition model for a rising EdTech platform.
              </p>
              <a href="#" className="read-more">
                Find out more &gt;
              </a>
            </div>
            <div className="card card-outline-green hover-lift reveal reveal-delay-2">
              <h3>NGO Operational Overhaul</h3>
              <p>
                Streamlined logistics and supply chain inefficiencies for a
                local food distribution non-profit.
              </p>
              <a href="#" className="read-more">
                Find out more &gt;
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership Section */}
      <section id="leadership" className="bg-green">
        <div className="container">
          <div className="reveal text-center">
            <h2 className="card card-white title-card">Leadership Team</h2>
          </div>
          <div className="grid cols-4" style={{ marginTop: "2rem" }}>
            <div className="card card-white team-card reveal reveal-delay-1">
              <div className="team-image-placeholder">JD</div>
              <h4>John Doe</h4>
              <p>President</p>
            </div>
            <div className="card card-white team-card reveal reveal-delay-2">
              <div className="team-image-placeholder">JS</div>
              <h4>Jane Smith</h4>
              <p>Director of External Relations</p>
            </div>
            <div className="card card-white team-card reveal reveal-delay-3">
              <div className="team-image-placeholder">AT</div>
              <h4>Alex Turner</h4>
              <p>Director of Internal Relations</p>
            </div>
            <div className="card card-white team-card reveal">
              <div className="team-image-placeholder">EC</div>
              <h4>Emily Chen</h4>
              <p>Director of L&D</p>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section id="blog" className="bg-white">
        <div className="container">
          <div className="section-header reveal">
            <div>
              <h2>Consulting Insights & Blogs</h2>
              <p>Insights from our consultants and network.</p>
            </div>
            <a href="#post-a-blog" className="btn outline post-blog-btn">
              Post a Blog
            </a>
          </div>
          <div className="grid">
            <div className="card bg-green inner-card-wrapper reveal reveal-delay-1">
              <div className="card-white inner-card">
                <h3>The Future of Social Impact</h3>
                <p>
                  How Gen-Z consultants are changing the non-profit landscape...
                </p>
                <a href="#" className="read-more-btn">
                  Read Post
                </a>
              </div>
            </div>
            <div className="card bg-green inner-card-wrapper reveal reveal-delay-2">
              <div className="card-white inner-card">
                <h3>Strategy Frameworks 101</h3>
                <p>
                  A deep dive into MECE and creating effective structures for
                  problem-solving.
                </p>
                <a href="#" className="read-more-btn">
                  Read Post
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section id="partners" className="bg-green">
        <div className="container container-partners">
          <div className="card card-white reveal">
            <h2>Our Partners</h2>
            <div className="marquee">
              <div className="marquee-content">
                <span>Partner Org 1</span>
                <span>Partner Org 2</span>
                <span>Partner Org 3</span>
                <span>Partner Org 4</span>
                <span>Partner Org 1</span>
                <span>Partner Org 2</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="site-footer bg-white">
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
    </>
  );
}

export default App;
