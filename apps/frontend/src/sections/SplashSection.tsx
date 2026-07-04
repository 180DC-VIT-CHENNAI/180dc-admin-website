import { useRef, lazy, Suspense } from "react";
import VariableProximity from "../components/VariableProximity";
import { ScribbleUnderline } from "../components/DoodleSVG";

const MagicRings = lazy(() => import("../components/MagicRings"));

export default function SplashSection() {
  const splashRef = useRef<HTMLDivElement>(null);

  return (
    <section className="splash-landing">
      <div className="splash-bg" ref={splashRef}>
        <Suspense fallback={<div className="splash-bg-placeholder" />}>
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
        </Suspense>
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
  );
}