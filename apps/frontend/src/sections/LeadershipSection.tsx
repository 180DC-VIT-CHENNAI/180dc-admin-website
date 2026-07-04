import { lazy, Suspense } from "react";
import { ScribbleSquiggle } from "../components/DoodleSVG";

// OrgChart is now properly lazy-loaded — this was the bug you mentioned
const OrgChart = lazy(() => import("../components/orgchart/OrgChart"));

export default function LeadershipSection() {
  return (
    <section id="leadership" className="leadership-section">
      <div className="container">
        <span className="section-label">03 — Leadership</span>
        <h2
          className="reveal text-center section-heading"
          style={{ marginBottom: "3rem", textAlign: "center" }}
        >
          Leadership Team
        </h2>
        <Suspense
          fallback={
            <div
              style={{
                minHeight: 400,
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
                Loading leadership chart...
              </p>
            </div>
          }
        >
          <OrgChart />
        </Suspense>
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