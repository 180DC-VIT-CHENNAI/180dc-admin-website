import { lazy, Suspense } from "react";

const Globe = lazy(() => import("../components/Globe"));

export default function GlobalNetworkSection() {
  return (
    <section id="global-network" className="global-network-section">
      <div className="container" style={{ textAlign: "center" }}>
        <div className="section-header reveal" style={{ margin: "0 auto 3rem", textAlign: "center" }}>
          <span className="eyebrow">Our Reach</span>
          <h2 className="section-heading" style={{ margin: 0 }}>
            Our Global Network
          </h2>
          <p style={{ maxWidth: "600px", margin: "0 auto", fontSize: "1.125rem", color: "var(--text-secondary)" }}>
            180 Degrees Consulting spans the globe. Here is where the VIT Chennai
            branch anchors our impact in India.
          </p>
        </div>
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
                <p style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                  Loading globe...
                </p>
              </div>
            }
          >
            <Globe />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
