import { PARTNERS } from "../data/partners";

export default function PartnersSection() {
  return (
    <section id="partners" className="partners-section">
      <div className="container">
        {/* UPDATED: Added Flexbox centering layout styles below */}
        <div
          className="section-header reveal"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            margin: "0 auto 2rem",
            maxWidth: "none",
          }}
        >
          <span className="eyebrow">05 — Partners</span>
          <h2 className="section-heading" style={{ margin: 0 }}>
            Our Clients
          </h2>
        </div>
        <div className="partners-logo-grid reveal">
          {PARTNERS.map((partner) => (
            <div key={partner.slug} className="partner-logo-card">
              <img src={partner.logo} alt={partner.name} loading="lazy" />
              <span className="partner-name-tooltip">{partner.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
