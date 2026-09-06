interface Props {
  completedProjects: any[];
}

export default function CompletedProjectsSection({ completedProjects }: Props) {
  if (completedProjects.length === 0) return null;

  return (
    <section className="projects-section">
      <div className="container">
        <div className="section-header reveal">
          <span className="eyebrow">Our Work</span>
          <h2 className="section-heading" style={{ margin: 0 }}>
            Completed Projects
          </h2>
          <p style={{ fontSize: "1.125rem", color: "var(--text-secondary)", margin: 0 }}>
            Projects delivered by our consulting teams
          </p>
        </div>
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
                    fontSize: "0.8125rem",
                    color: "var(--accent-primary)",
                    marginBottom: "8px",
                    fontWeight: 500,
                  }}
                >
                  {p.company_org}
                </div>
              )}
              {p.description && (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                  {p.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
