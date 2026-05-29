import { useState } from 'react';
import PillNav from '../components/PillNav';
import './RecruitmentsPage.css';

const navItems = [
  { label: "Home", href: "/" },
  { label: "Recruitments", href: "/recruitments" },
];

const domains = [
  "Technical",
  "R&D",
  "Operations",
  "PR & Outreach",
  "Design & Creative",
  "Content & Editorial",
  "HR & Logistics",
  "Finance",
];

const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const RecruitmentsPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [preferredDomain, setPreferredDomain] = useState("");

  return (
    <div className="recruitments-page">
      <PillNav
        items={navItems}
        activeHref="/recruitments"
        logo="/images/180DC.png"
      />

      <section className="recruitments-hero">
        <div className="recruitments-badge">Open for Applications</div>
        <h1>
          Join <span>180DC VIT Chennai</span>
        </h1>
        <p>
          Become part of the world's largest student-led consultancy.
          Help social enterprises create meaningful impact while building
          skills that last a lifetime.
        </p>
      </section>

      <div className="recruitments-content">
        <div className="roadmap-header">
          <h2>Application Roadmap</h2>
          <p>Here's how the recruitment process works</p>
        </div>

        <div className="roadmap-timeline">
          <div className="roadmap-step">
            <div className="roadmap-step-dot" />
            <div className="roadmap-step-number">Round 1</div>
            <div className="roadmap-step-card">
              <h3>Application Form</h3>
              <div className="step-subtitle">Fill in your details</div>
              <p className="step-desc">
                Submit your basic information, academic background, and tell us
                why you want to join 180DC. This is your first chance to make
                an impression.
              </p>
              <div className="step-details">
                <h4>You'll need to provide:</h4>
                <ul>
                  <li>Full Name</li>
                  <li>Email Address</li>
                  <li>Phone Number</li>
                  <li>Registration Number</li>
                  <li>Year of Study</li>
                  <li>Department / Branch</li>
                  <li>Why 180DC?</li>
                  <li>Preferred &amp; Secondary Domain</li>
                  <li>Why you chose that domain</li>
                  <li>Prior experience in the field</li>
                  <li>GitHub Profile Link</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="roadmap-step upcoming">
            <div className="roadmap-step-dot" />
            <div className="roadmap-step-number">Round 2</div>
            <div className="roadmap-step-card">
              <h3>To Be Announced</h3>
              <div className="step-subtitle">Round details coming soon</div>
              <p className="step-desc">
                The second round of the recruitment process will be announced
                shortly. Stay tuned for updates.
              </p>
              <div className="step-status">Coming soon</div>
            </div>
          </div>
        </div>

        {!showForm ? (
          <div className="recruitments-cta">
            <h3>Ready to Apply?</h3>
            <p>Submit your application and take the first step toward joining 180DC.</p>
            <button className="btn-white" onClick={() => setShowForm(true)}>
              Apply Now &rarr;
            </button>
          </div>
        ) : (
          <div className="application-form-section">
            <div className="form-header">
              <h2>Round 1 — Application Form</h2>
              <p>Fill in all the required fields below</p>
            </div>
            <form className="application-form" onSubmit={(e) => e.preventDefault()}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="fullName">Full Name</label>
                  <input id="fullName" type="text" placeholder="Enter your full name" required />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Email Address</label>
                  <input id="email" type="email" placeholder="Enter your email" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="phone">Phone Number</label>
                  <input id="phone" type="tel" placeholder="Enter your phone number" required />
                </div>
                <div className="form-group">
                  <label htmlFor="regNo">Registration Number</label>
                  <input id="regNo" type="text" placeholder="e.g. 23BCYXXXX" required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="year">Year of Study</label>
                  <select id="year" required defaultValue="">
                    <option value="" disabled>Select your year</option>
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="department">Department / Branch</label>
                  <input id="department" type="text" placeholder="e.g. CSE, ECE, Mech..." required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="preferredDomain">Preferred Domain</label>
                  <select
                    id="preferredDomain"
                    required
                    defaultValue=""
                    onChange={(e) => setPreferredDomain(e.target.value)}
                  >
                    <option value="" disabled>Select a domain</option>
                    {domains.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label htmlFor="secondaryDomain">Secondary Domain</label>
                  <select id="secondaryDomain" required defaultValue="">
                    <option value="" disabled>Select a domain</option>
                    {domains.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group form-group-full">
                <label htmlFor="github">GitHub Profile Link</label>
                <input id="github" type="url" placeholder="https://github.com/your-username" />
              </div>

              {preferredDomain && (
                <>
                  <div className="form-group form-group-full">
                    <label htmlFor="whyDomain">Why did you choose {preferredDomain}?</label>
                    <textarea
                      id="whyDomain"
                      rows={3}
                      placeholder="Tell us what draws you to this domain..."
                    />
                  </div>
                  <div className="form-group form-group-full">
                    <label htmlFor="priorExperience">Do you have any prior experience in this field?</label>
                    <textarea
                      id="priorExperience"
                      rows={3}
                      placeholder="Any projects, internships, courses, or relevant experience..."
                    />
                  </div>
                </>
              )}

              <div className="form-group form-group-full">
                <label htmlFor="why180dc">Why do you want to join 180DC?</label>
                <textarea
                  id="why180dc"
                  rows={4}
                  placeholder="Tell us about yourself, your interests, and why you'd be a great fit..."
                  required
                />
              </div>

              <div className="form-actions">
                <button type="button" className="btn outline" onClick={() => setShowForm(false)}>
                  Back
                </button>
                <button type="submit" className="btn">
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecruitmentsPage;
