import { lazy, Suspense } from "react";
import { ScribbleSquiggle } from "../components/DoodleSVG";

// Globe is the heaviest component on the page (WebGL).
// It only gets imported + initialised when this section mounts via LazyReveal.
const Globe = lazy(() => import("../components/Globe"));

export default function GlobalNetworkSection() {
  return (
    <section id="global-network" className="global-network-section">
      <div className="container" style={{ textAlign: "center" }}>
        <span className="section-label">Our Reach</span>
        <h2 className="reveal section-heading">Our Global Network</h2>
        <p
          className="reveal reveal-delay-1"
          style={{
            maxWidth: "600px",
            margin: "0 auto 3rem auto",
            fontFamily: "'Patrick Hand', cursive",
            fontSize: "1.2rem",
          }}
        >
          180 Degrees Consulting spans the globe. Here is where the VIT Chennai
          branch anchors our impact in India.
        </p>
        <div className="reveal reveal-delay-2">
          <Suspense
            fallback={
              <div
                style={{
                  width: "100%",
                  height: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Patrick Hand', cursive",
                    color: "var(--text-secondary)",
                  }}
                >
                  Loading globe...
                </p>
              </div>
            }
          >
            <Globe />
          </Suspense>
        </div>
        <ScribbleSquiggle
          style={{
            width: 150,
            color: "#8dc63f",
            margin: "3rem auto 0",
            display: "block",
          }}
        />
      </div>
    </section>
  );
}