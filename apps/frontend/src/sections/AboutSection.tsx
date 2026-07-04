import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScribbleStar } from "../components/DoodleSVG";

gsap.registerPlugin(ScrollTrigger);

export default function AboutSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // Scoped to this section so cleanup only kills these triggers
    const ctx = gsap.context(() => {
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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="about" className="about-section" ref={sectionRef}>
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