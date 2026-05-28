import { useEffect } from "react";
import './index.css';
import Globe from './components/Globe';
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function App() {
  useEffect(() => {
    // Smooth scrolling for navigation links
    const anchors = document.querySelectorAll('a[href^="#"]');
    const handleClick = function (this: HTMLAnchorElement, e: Event) {
      e.preventDefault();
      const targetId = this.getAttribute("href");
      if (targetId && targetId !== "#") {
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: "smooth",
          });
        }
      }
    };

    anchors.forEach((anchor) => {
      anchor.addEventListener("click", handleClick as EventListener);
    });

    return () => {
      anchors.forEach((anchor) => {
        anchor.removeEventListener("click", handleClick as EventListener);
      });
    };
  }, []);

  return (
    <>
      {/* Navbar */}
      <nav className="navbar bg-white">
        <a href="#" className="logo-link" aria-label="180DC VIT Chennai">
          <div className="navbar-logo-bg"></div>
          <span className="logo-text">VIT Chennai</span>
        </a>
        <ul className="nav-links">
          <li>
            <a href="#about">About</a>
          </li>
          <li>
            <a href="#case-studies">Case Studies</a>
          </li>
          <li>
            <a href="#leadership">Leadership</a>
          </li>
          <li>
            <a href="#blog">Blog</a>
          </li>
          <li>
            <a href="#partners">Partners</a>
          </li>
        </ul>
      </nav>

      {/* Hero Section */}
      <header className="hero bg-white animated-bg">
        <div className="container hero-split">
          <div className="hero-content">
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
          <div className="hero-image-wrapper">
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
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <h2>Our Global Network</h2>
          <p style={{ maxWidth: '600px', margin: '0 auto 3rem auto' }}>
            180 Degrees Consulting spans the globe. Here is where the VIT Chennai branch anchors our impact in India.
          </p>
          <Globe />
        </div>
      </section>


      {/* About Section */}
      <section id="about" className="bg-green">
        <div className="container">
          <div className="card card-white">
            <h2>About Our Branch</h2>
            <p>
              Founded at VIT Chennai, our branch consists of high-achieving,
              creative students driven to affect real change. We provide
              socially conscious organizations with very high quality and free
              consulting services.
            </p>
          </div>
        </div>
      </section>

      {/* Case Studies Section */}
      <section id="case-studies" className="bg-white">
        <div className="container">
          <h2>Latest Case Studies</h2>
          <div className="grid">
            <div className="card card-outline-green hover-lift">
              <h3>EdTech Startup Growth</h3>
              <p>
                Developed a comprehensive Go-To-Market strategy and user
                acquisition model for a rising EdTech platform.
              </p>
              <a href="#" className="read-more">
                Find out more &gt;
              </a>
            </div>
            <div className="card card-outline-green hover-lift">
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
          <h2 className="card card-white title-card">Leadership Team</h2>
          <div className="grid cols-4">
            <div className="card card-white team-card">
              <h4>John Doe</h4>
              <p>President</p>
            </div>
            <div className="card card-white team-card">
              <h4>Jane Smith</h4>
              <p>Director of External Relations</p>
            </div>
            <div className="card card-white team-card">
              <h4>Alex Turner</h4>
              <p>Director of Internal Relations</p>
            </div>
            <div className="card card-white team-card">
              <h4>Emily Chen</h4>
              <p>Director of L&D</p>
            </div>
          </div>
        </div>
      </section>

      {/* Blog Section */}
      <section id="blog" className="bg-white">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Consulting Insights & Blogs</h2>
              <p>Insights from our consultants and network.</p>
            </div>
            <a href="#post-a-blog" className="btn outline post-blog-btn">
              Post a Blog
            </a>
          </div>
          <div className="grid">
            <div className="card bg-green inner-card-wrapper">
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
            <div className="card bg-green inner-card-wrapper">
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
          <div className="card card-white">
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


