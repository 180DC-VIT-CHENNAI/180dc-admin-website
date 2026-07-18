import { ScribbleSquiggle } from "../components/DoodleSVG";
import { PARTNERS } from "../data/partners";

export default function PartnersSection() {
  return (
    <section id="partners" className="partners-section">
      <div className="container">
        <span className="section-label">05 — Partners</span>
        <h2
          className="reveal section-heading"
          style={{ marginBottom: "2rem", textAlign: "center" }}
        >
          Our Clients
        </h2>
        <div className="partners-logo-grid reveal">
          {PARTNERS.map((partner) => (
            <div key={partner.slug} className="partner-logo-card">
              <img src={partner.logo} alt={partner.name} loading="lazy" />
              <span className="partner-name-tooltip">{partner.name}</span>
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
