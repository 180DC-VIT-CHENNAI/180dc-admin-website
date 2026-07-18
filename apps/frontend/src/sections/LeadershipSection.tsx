import { lazy, Suspense } from "react";

const OrgChart = lazy(() => import("../components/orgchart/OrgChart"));

export default function LeadershipSection() {
  return (
    <section id="leadership" className="leadership-section">
      <div className="container">
        <div className="section-header reveal" style={{ textAlign: "center", margin: "0 auto 3rem" }}>
          <span className="eyebrow">03 — Leadership</span>
          <h2 className="section-heading" style={{ margin: 0 }}>
            Leadership Team
          </h2>
        </div>
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
              <p style={{ color: "var(--text-tertiary)", fontSize: "0.875rem" }}>
                Loading leadership chart...
              </p>
            </div>
          }
        >
          <OrgChart />
        </Suspense>
      </div>
    </section>
  );
}
