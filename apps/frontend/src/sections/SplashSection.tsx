import { useRef, lazy, Suspense } from "react";
import { TOKENS } from "../lib/tokens";
import VariableProximity from "../components/VariableProximity";

const MagicRings = lazy(() => import("../components/MagicRings"));

export default function SplashSection() {
  const splashRef = useRef<HTMLDivElement>(null);

  return (
    <section className="splash-landing">
      <div className="splash-bg" ref={splashRef}>
        <Suspense fallback={<div className="splash-bg-placeholder" />}>
          <MagicRings
            color={TOKENS.accentPrimary}
            colorTwo={TOKENS.green300}
            ringCount={8}
            speed={0.5}
            attenuation={10}
            lineThickness={2}
            baseRadius={0.2}
            radiusStep={0.12}
            scaleRate={0.08}
            opacity={0.6}
            blur={0}
            noiseAmount={0.03}
            rotation={0}
            ringGap={1.6}
            fadeIn={0.8}
            fadeOut={0.6}
            followMouse={true}
            mouseInfluence={0.2}
            hoverScale={1.2}
            parallax={0.05}
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
            fromFontVariationSettings="'wght' 200"
            toFontVariationSettings="'wght' 800"
            radius={120}
            falloff="linear"
          />
          <br />
          <VariableProximity
            label="VIT Chennai"
            className="splash-subtitle-variable"
            containerRef={splashRef}
            fromFontVariationSettings="'wght' 200"
            toFontVariationSettings="'wght' 700"
            radius={100}
            falloff="linear"
          />
        </div>
        <p className="splash-tagline">
          Empowering organizations to reach their full potential and maximize
          their social impact.
        </p>
      </div>

      <div className="scroll-indicator">
        <div className="scroll-mouse">
          <div className="scroll-wheel" />
        </div>
        <span className="scroll-text">SCROLL TO EXPLORE</span>
      </div>
    </section>
  );
}
