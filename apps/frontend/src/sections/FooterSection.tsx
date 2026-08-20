import { useEffect, useState } from "react";
import { apiUrl } from "../lib/api";

export default function FooterSection() {
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/newsletter/subscribers/count"))
      .then((r) => r.json())
      .then((d) => {
        if (d.count != null) setSubscriberCount(d.count);
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="site-footer">
      <div className="container">
        {/* ── Newsletter band ── */}
        <div className="footer-newsletter" id="newsletter">
          <span className="eyebrow">Newsletter</span>
          <h2 className="footer-newsletter-title">The 180DC Newsletter</h2>
          <p className="footer-newsletter-desc">
            Case studies, social impact stories, event updates and
            opportunities from 180 Degrees Consulting VIT Chennai — delivered
            straight to your inbox.
          </p>
          <a
            href="/subscriber"
            className="btn"
            style={{ padding: "12px 32px", fontSize: "0.9375rem" }}
          >
            Subscribe to Newsletter
          </a>
          <p className="footer-newsletter-note">
            {subscriberCount !== null && subscriberCount > 0 && (
              <>Join {subscriberCount.toLocaleString()} subscribers. </>
            )}
            Verified via Google sign-in — no spam, unsubscribe anytime.
          </p>
        </div>

        {/* ── Footer columns ── */}
        <div className="footer-content">
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
            <a href="#partners">Partners</a>
            <a href="/recruitments">Recruitments</a>
          </div>
        </div>
      </div>
      <div className="copyright text-center">
        <p>&copy; 2026 180DC VIT Chennai. All rights reserved.</p>
      </div>
    </footer>
  );
}
