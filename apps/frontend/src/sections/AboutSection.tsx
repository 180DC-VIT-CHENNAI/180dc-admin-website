import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(".stat-item").forEach((stat) => {
        gsap.fromTo(
          stat,
          { y: 30, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: stat,
              start: "top 85%",
              toggleActions: "play none none none",
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="about" className="about-section" ref={sectionRef}>
      <div className="container">
        <div className="about-card reveal">
          <span className="eyebrow">01 — About</span>
          <h2>About Our Branch</h2>
          <p>
            Founded at VIT Chennai, our branch consists of high-achieving,
            creative students driven to affect real change. We provide socially
            conscious organizations with very high quality and free consulting
            services.
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
  );
}
