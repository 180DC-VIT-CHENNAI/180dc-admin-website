import { useEffect, lazy, Suspense } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  ScribbleArrow,
  ScribbleCircle,
  ScribbleStar,
} from "../components/DoodleSVG";

const ColorBends = lazy(() => import("../components/ColorBends"));

gsap.registerPlugin(ScrollTrigger);

interface Props {
  onWorkWithUs: () => void;
}

export default function HeroSection({ onWorkWithUs }: Props) {
  useEffect(() => {
    // gsap.context() scopes all tweens so cleanup (ctx.revert) kills only these
    const ctx = gsap.context(() => {
      const heroTl = gsap.timeline();
      heroTl
        .fromTo(
          ".hero-content h1",
          { y: 60, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.2, ease: "power3.out", delay: 0.2 }
        )
        .fromTo(
          ".hero-subtitle",
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out" },
          "-=0.8"
        )
        .fromTo(
          ".cta-buttons",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
          "-=0.6"
        )
        .fromTo(
          ".hero-image-wrapper",
          { x: 60, opacity: 0 },
          { x: 0, opacity: 1, duration: 1.2, ease: "power3.out" },
          "-=1"
        );

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
    });

    return () => ctx.revert();
  }, []);

  return (
    <header id="hero" className="hero">
      <div className="hero-bg-overlay">
        <Suspense fallback={null}>
          <ColorBends
            colors={["#ffffff", "#8dc63f", "#ffffff", "#a8d96a"]}
            speed={0.15}
            warpStrength={1.2}
            intensity={0.8}
            opacity={0.4}
            iterations={2}
          />
        </Suspense>
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
            <button className="btn outline" onClick={onWorkWithUs}>
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
  );
}