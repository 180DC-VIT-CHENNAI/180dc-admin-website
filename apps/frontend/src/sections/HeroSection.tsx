import { useEffect, lazy, Suspense } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ErrorBoundary from "../components/ErrorBoundary";

const ColorBends = lazy(() => import("../components/ColorBends"));

gsap.registerPlugin(ScrollTrigger);

interface Props {
  onWorkWithUs: () => void;
}

export default function HeroSection({ onWorkWithUs }: Props) {
  useEffect(() => {
    const ctx = gsap.context(() => {
      const heroTl = gsap.timeline();
      heroTl
        .fromTo(
          ".hero-eyebrow",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.6, ease: "power3.out", delay: 0.3 }
        )
        .fromTo(
          ".hero-content h1",
          { y: 40, opacity: 0 },
          { y: 0, opacity: 1, duration: 1, ease: "power3.out" },
          "-=0.3"
        )
        .fromTo(
          ".hero-subtitle",
          { y: 30, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
          "-=0.6"
        )
        .fromTo(
          ".cta-buttons",
          { y: 20, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.7, ease: "power3.out" },
          "-=0.5"
        )
        .fromTo(
          ".hero-image-wrapper",
          { x: 40, opacity: 0, scale: 0.98 },
          { x: 0, opacity: 1, scale: 1, duration: 1.2, ease: "power3.out" },
          "-=0.8"
        );

      // Subtle parallax on the hero image
      gsap.to(".hero-image", {
        y: -40,
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
        <ErrorBoundary>
          <Suspense fallback={null}>
            <ColorBends
              colors={["#ffffff", "#f4f9e8", "#ffffff", "#e8f5d0"]}
              speed={0.1}
              warpStrength={0.8}
              intensity={0.5}
              opacity={0.3}
              iterations={2}
            />
          </Suspense>
        </ErrorBoundary>
      </div>

      <div className="container hero-split">
        <div className="hero-content">
          <span className="eyebrow hero-eyebrow">Social Impact Consulting</span>
          <h1>
            Transforming
            <br />
            non-profits.
            <br />
            Empowering
            <br />
            students.
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
        </div>

        <div className="hero-image-wrapper">
          <div className="hero-image-backdrop" />
          <img
            src="/images/VIT-chennai.png"
            alt="VIT Chennai Campus"
            className="hero-image"
            loading="eager"
            fetchPriority="high"
          />
        </div>
      </div>
    </header>
  );
}
