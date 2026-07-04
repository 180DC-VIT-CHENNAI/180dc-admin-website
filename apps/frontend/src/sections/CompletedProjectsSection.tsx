import { ScribbleSquiggle } from "../components/DoodleSVG";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props {
  completedProjects: any[];
}

// Card hover and .reveal animations are handled globally by the
// MutationObserver in App.tsx — no local GSAP needed here.
export default function CompletedProjectsSection({ completedProjects }: Props) {
  if (completedProjects.length === 0) return null;

  return (
    <section className="projects-section">
      <div className="container">
        <span className="section-label">Our Work</span>
        <h2
          className="reveal section-heading"
          style={{ marginBottom: "0.5rem" }}
        >
          Completed Projects
        </h2>
        <p
          style={{
            fontFamily: "'Patrick Hand', cursive",
            fontSize: "1.2rem",
            textAlign: "center",
            marginBottom: "3rem",
            color: "var(--text-secondary)",
          }}
        >
          Projects delivered by our consulting teams
        </p>
        <div
          className="projects-grid"
          style={
            completedProjects.length > 4
              ? { maxHeight: 520, overflowY: "auto", paddingRight: 8 }
              : undefined
          }
        >
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {completedProjects.map((p: any) => (
            <div key={p.id} className="card-doodle project-card">
              <h3 style={{ marginTop: 0 }}>{p.name}</h3>
              {p.company_org && (
                <div
                  style={{
                    fontSize: 13,
                    color: "var(--primary-green)",
                    marginBottom: 8,
                  }}
                >
                  {p.company_org}
                </div>
              )}
              {p.description && (
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  {p.description}
                </p>
              )}
            </div>
          ))}
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