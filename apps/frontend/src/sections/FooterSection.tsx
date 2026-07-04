export default function FooterSection() {
    return (
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
            <p>
              180 Degrees Consulting is the world's largest consultancy for
              non-profits and social enterprises, with 190+ branches across
              universities worldwide. Our VIT Chennai branch connects talented
              students with organizations that need strategic support to maximize
              their impact.
            </p>
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
    );
  }