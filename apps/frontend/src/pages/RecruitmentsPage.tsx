import { useState, useEffect } from 'react';
import PillNav from '../components/PillNav';
import { apiUrl } from '../lib/api';
import './RecruitmentsPage.css';

const navItems = [
  { label: "Home", href: "/" },
  { label: "Recruitments", href: "/recruitments" },
];

const domains = [
  "Technical",
  "Research & Development",
  "Marketing",
  "Social Media",
  "Finance",
  "Events and Initiatives",
  "Client Partner Sponsor",
  "Human Resources",
];

const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

type PageState = "landing" | "register" | "login" | "form" | "dashboard";

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "Pending Review", color: "#f39c12", icon: "⏳" },
  shortlisted: { label: "Shortlisted", color: "#28a745", icon: "✅" },
  selected: { label: "Selected", color: "#007bff", icon: "🏆" },
  rejected: { label: "Not Selected", color: "#6c757d", icon: "📋" },
};

const RecruitmentsPage = () => {
  const [pageState, setPageState] = useState<PageState>("landing");
  const [applicant, setApplicant] = useState<{ id: string; email: string; name: string } | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [application, setApplication] = useState<any>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [openDomains, setOpenDomains] = useState<string[]>([]);

  useEffect(() => {
    fetch(apiUrl("/api/recruitment/open-domains"))
      .then(r => r.json())
      .then(data => { if (data.success) setOpenDomains(data.data || []); })
      .catch(() => {});
  }, []);

  const isRecruitmentOpen = openDomains.length > 0;

  // Register form
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regBusy, setRegBusy] = useState(false);
  const [regError, setRegError] = useState("");

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Application form
  const [appName, setAppName] = useState("");
  const [appEmail, setAppEmail] = useState("");
  const [appYear, setAppYear] = useState("");
  const [appCourse, setAppCourse] = useState("");
  const [appPrimaryDomain, setAppPrimaryDomain] = useState("");
  const [appSecondaryDomain, setAppSecondaryDomain] = useState("");
  const [appWhyJoin, setAppWhyJoin] = useState("");
  const [appWhyDomain, setAppWhyDomain] = useState("");
  const [appPriorExperience, setAppPriorExperience] = useState("");
  const [appPortfolioLink, setAppPortfolioLink] = useState("");
  const [appBusy, setAppBusy] = useState(false);
  const [appError, setAppError] = useState("");

  async function fetchApplication(token: string) {
    setDashboardLoading(true);
    try {
      const res = await fetch(apiUrl("/api/recruitment/my-application"), {
        headers: { "X-Session-Token": token },
      });
      const data = await res.json();
      if (data.success && data.application) {
        setApplication(data.application);
        return true;
      }
      return false;
    } catch { return false; }
    finally { setDashboardLoading(false); }
  }

  // Check if applicant already has an application
  useEffect(() => {
    if (applicant && sessionToken) {
      setAppName(applicant.name);
      setAppEmail(applicant.email);
      fetchApplication(sessionToken).then(hasApp => {
        setPageState(hasApp ? "dashboard" : "form");
      });
    }
  }, [applicant, sessionToken]);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError("");
    if (!regName.trim() || !regEmail.trim() || !regPassword.trim()) {
      setRegError("All fields are required"); return;
    }
    if (regPassword.length < 8) {
      setRegError("Password must be at least 8 characters"); return;
    }
    setRegBusy(true);
    try {
      const res = await fetch(apiUrl("/api/recruitment/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName.trim(), email: regEmail.trim(), password: regPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setRegName(""); setRegEmail(""); setRegPassword("");
        setPageState("login");
      } else {
        setRegError(data.error || "Registration failed");
      }
    } catch { setRegError("Network error"); }
    finally { setRegBusy(false); }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError("All fields are required"); return;
    }
    setLoginBusy(true);
    try {
      const res = await fetch(apiUrl("/api/recruitment/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim(), password: loginPassword }),
      });
      const data = await res.json();
      if (data.success) {
        setApplicant(data.applicant);
        setSessionToken(data.token);
        setLoginEmail(""); setLoginPassword("");
      } else {
        setLoginError(data.error || "Login failed");
      }
    } catch { setLoginError("Network error"); }
    finally { setLoginBusy(false); }
  }

  function handleLogout() {
    setApplicant(null);
    setSessionToken(null);
    setApplication(null);
    setPageState("landing");
  }

  async function handleSubmitApplication(e: React.FormEvent) {
    e.preventDefault();
    setAppError("");
    if (!appName.trim() || !appEmail.trim() || !appYear || !appCourse.trim() || !appPrimaryDomain || !appWhyJoin.trim() || !appWhyDomain.trim()) {
      setAppError("Please fill in all required fields"); return;
    }
    if (openDomains.length > 0 && !openDomains.includes(appPrimaryDomain)) {
      setAppError("Selected domain is not currently accepting applications"); return;
    }
    setAppBusy(true);
    try {
      const res = await fetch(apiUrl("/api/recruitment/applications"), {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken! },
        body: JSON.stringify({
          name: appName.trim(),
          email: appEmail.trim(),
          year: appYear,
          course: appCourse.trim(),
          primaryDomain: appPrimaryDomain,
          secondaryDomain: appSecondaryDomain || null,
          whyJoin: appWhyJoin.trim(),
          whyDomain: appWhyDomain.trim(),
          priorExperience: appPriorExperience.trim() || null,
          portfolioLink: appPortfolioLink.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchApplication(sessionToken!);
        setPageState("dashboard");
      } else {
        setAppError(data.error || "Submission failed");
      }
    } catch { setAppError("Network error"); }
    finally { setAppBusy(false); }
  }

  return (
    <div className="recruitments-page">
      <PillNav items={navItems} activeHref="/recruitments" logo="/images/official-logo.png" />

      <section className="recruitments-hero">
        <div className={`recruitments-badge ${isRecruitmentOpen ? "" : "closed"}`}>
          {isRecruitmentOpen ? "Open for Applications" : "Applications Closed"}
        </div>
        <h1>Join <span>180DC VIT Chennai</span></h1>
        <p>
          Become part of the world's largest student-led consultancy.
          Help social enterprises create meaningful impact while building
          skills that last a lifetime.
        </p>
      </section>

      {!isRecruitmentOpen && pageState === "landing" && (
        <div className="recruitments-content">
          <div className="recruitments-cta" style={{ border: "none", boxShadow: "none" }}>
            <h3>Applications are currently closed</h3>
            <p>We're not accepting applications right now. Check back later for recruitment updates.</p>
          </div>
        </div>
      )}

      {isRecruitmentOpen && pageState === "landing" && (
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
                why you want to join 180DC. This is your first chance to make an impression.
              </p>
              <div className="step-details">
                <h4>You'll need to provide:</h4>
                <ul>
                  <li>Full Name</li>
                  <li>Email Address</li>
                  <li>Year of Study</li>
                  <li>Course / Branch</li>
                  <li>Why 180DC?</li>
                  <li>Preferred &amp; Secondary Domain</li>
                  <li>Why you chose that domain</li>
                  <li>Prior experience</li>
                  <li>GitHub/Portfolio Link (tech/R&D)</li>
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
                The second round of the recruitment process will be announced shortly.
              </p>
              <div className="step-status">Coming soon</div>
            </div>
          </div>
        </div>

        <div className="recruitments-cta">
          <h3>Ready to Apply?</h3>
          <p>Create an account or log in to submit your application.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn-white" onClick={() => setPageState("register")}>
              Create Account &rarr;
            </button>
            <button className="btn-white outline" onClick={() => setPageState("login")}>
              Already have an account? Log in
            </button>
          </div>
        </div>
      </div>
      )}

      {isRecruitmentOpen && pageState === "register" && (
      <div className="recruitments-content">
        <div className="application-form-section">
          <div className="form-header">
            <h2>Create Your Account</h2>
            <p>Register to apply for recruitment</p>
          </div>
          <form className="application-form" onSubmit={handleRegister}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="regName">Full Name</label>
                <input id="regName" type="text" placeholder="Enter your full name" value={regName} onChange={e => setRegName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="regEmail">Email Address</label>
                <input id="regEmail" type="email" placeholder="Enter your email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
              </div>
            </div>
            <div className="form-group form-group-full">
              <label htmlFor="regPassword">Password</label>
              <input id="regPassword" type="password" placeholder="Create a password (min 8 chars, uppercase, lowercase, digit)" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
            </div>
            {regError && <p style={{ color: "#e74c3c", fontSize: 14 }}>{regError}</p>}
            <div className="form-actions">
              <button type="button" className="btn outline" onClick={() => setPageState("landing")}>Back</button>
              <button type="submit" className="btn" disabled={regBusy}>{regBusy ? "Creating..." : "Create Account"}</button>
            </div>
            <p style={{ textAlign: "center", marginTop: 12, fontSize: 14 }}>
              Already have an account?{" "}
              <button type="button" className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13 }} onClick={() => setPageState("login")}>Log in</button>
            </p>
          </form>
        </div>
      </div>
      )}

      {pageState === "login" && (
      <div className="recruitments-content">
        <div className="application-form-section">
          <div className="form-header">
            <h2>Log In</h2>
            <p>Sign in to your recruitment account</p>
          </div>
          <form className="application-form" onSubmit={handleLogin}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="loginEmail">Email Address</label>
                <input id="loginEmail" type="email" placeholder="Enter your email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="loginPassword">Password</label>
                <input id="loginPassword" type="password" placeholder="Enter your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
              </div>
            </div>
            {loginError && <p style={{ color: "#e74c3c", fontSize: 14 }}>{loginError}</p>}
            <div className="form-actions">
              <button type="button" className="btn outline" onClick={() => setPageState("landing")}>Back</button>
              <button type="submit" className="btn" disabled={loginBusy}>{loginBusy ? "Logging in..." : "Log In"}</button>
            </div>
            <p style={{ textAlign: "center", marginTop: 12, fontSize: 14 }}>
              Don't have an account?{" "}
              {isRecruitmentOpen ? (
                <button type="button" className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13 }} onClick={() => setPageState("register")}>Create one</button>
              ) : (
                <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Registration is currently closed</span>
              )}
            </p>
          </form>
        </div>
      </div>
      )}

      {isRecruitmentOpen && pageState === "form" && applicant && (
      <div className="recruitments-content">
        <div className="application-form-section">
          <div className="form-header">
            <h2>Round 1 — Application Form</h2>
            <p>Welcome, {applicant.name}! Fill in your details below.</p>
          </div>
          <form className="application-form" onSubmit={handleSubmitApplication}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="appName">Full Name</label>
                <input id="appName" type="text" value={appName} onChange={e => setAppName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="appEmail">Email Address</label>
                <input id="appEmail" type="email" value={appEmail} onChange={e => setAppEmail(e.target.value)} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="appYear">Year of Study</label>
                <select id="appYear" value={appYear} onChange={e => setAppYear(e.target.value)} required defaultValue="">
                  <option value="" disabled>Select your year</option>
                  {years.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="appCourse">Course / Branch</label>
                <input id="appCourse" type="text" placeholder="e.g. CSE, ECE, Mech..." value={appCourse} onChange={e => setAppCourse(e.target.value)} required />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="appPrimaryDomain">Preferred Domain</label>
                <select id="appPrimaryDomain" value={appPrimaryDomain} onChange={e => setAppPrimaryDomain(e.target.value)} required defaultValue="">
                  <option value="" disabled>Select a domain</option>
                  {openDomains.length > 0 ? (
                    openDomains.map(d => <option key={d} value={d}>{d}</option>)
                  ) : (
                    domains.map(d => <option key={d} value={d}>{d}</option>)
                  )}
                </select>
                {openDomains.length === 0 && (
                  <p style={{ color: "#e74c3c", fontSize: 12, marginTop: 4 }}>No domains are currently accepting applications. Check back later.</p>
                )}
              </div>
              <div className="form-group">
                <label htmlFor="appSecondaryDomain">Secondary Domain</label>
                <select id="appSecondaryDomain" value={appSecondaryDomain} onChange={e => setAppSecondaryDomain(e.target.value)} defaultValue="">
                  <option value="">None</option>
                  {openDomains.length > 0 ? (
                    openDomains.map(d => <option key={d} value={d}>{d}</option>)
                  ) : (
                    domains.map(d => <option key={d} value={d}>{d}</option>)
                  )}
                </select>
              </div>
            </div>

            <div className="form-group form-group-full">
              <label htmlFor="appWhyDomain">Why did you choose {appPrimaryDomain || "your preferred domain"}?</label>
              <textarea id="appWhyDomain" rows={3} placeholder="Tell us what draws you to this domain..." value={appWhyDomain} onChange={e => setAppWhyDomain(e.target.value)} required />
            </div>

            <div className="form-group form-group-full">
              <label htmlFor="appPriorExperience">Any prior experience in this field?</label>
              <textarea id="appPriorExperience" rows={3} placeholder="Projects, internships, courses, or relevant experience..." value={appPriorExperience} onChange={e => setAppPriorExperience(e.target.value)} />
            </div>

            <div className="form-group form-group-full">
              <label htmlFor="appPortfolioLink">GitHub / Portfolio Link (required for Technical & R&D)</label>
              <input id="appPortfolioLink" type="url" placeholder="https://github.com/your-username" value={appPortfolioLink} onChange={e => setAppPortfolioLink(e.target.value)} />
            </div>

            <div className="form-group form-group-full">
              <label htmlFor="appWhyJoin">Why do you want to join 180DC?</label>
              <textarea id="appWhyJoin" rows={4} placeholder="Tell us about yourself and why you'd be a great fit..." value={appWhyJoin} onChange={e => setAppWhyJoin(e.target.value)} required />
            </div>

            {appError && <p style={{ color: "#e74c3c", fontSize: 14 }}>{appError}</p>}

            <div className="form-actions">
              <button type="button" className="btn outline" onClick={() => { setApplicant(null); setPageState("landing"); }}>Cancel</button>
              <button type="submit" className="btn" disabled={appBusy}>{appBusy ? "Submitting..." : "Submit Application"}</button>
            </div>
          </form>
        </div>
      </div>
      )}

      {pageState === "dashboard" && applicant && (
      <div className="recruitments-content">
        <ApplicantDashboard
          applicant={applicant}
          application={application}
          loading={dashboardLoading}
          onLogout={handleLogout}
        />
      </div>
      )}
    </div>
  );
};

function ApplicantDashboard({
  applicant,
  application,
  loading,
  onLogout,
}: {
  applicant: { id: string; email: string; name: string };
  application: any;
  loading: boolean;
  onLogout: () => void;
}) {
  const status = application?.status || "pending";
  const info = STATUS_INFO[status] || STATUS_INFO.pending;
  const isAdvanced = status === "shortlisted" || status === "selected";
  const isRejected = status === "rejected";

  return (
    <div className="application-form-section">
      <div className="form-header">
        <h2>My Application</h2>
        <p>Welcome back, {applicant.name}!</p>
      </div>

      {loading ? (
        <p style={{ color: "var(--text-secondary)", textAlign: "center", padding: "2rem 0" }}>Loading your application...</p>
      ) : !application ? (
        <div className="recruitments-cta" style={{ marginTop: 0 }}>
          <p>You haven't submitted an application yet.</p>
          <button className="btn-white" onClick={() => window.location.reload()}>
            Apply Now
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Status Banner */}
          <div className="card-doodle" style={{
            padding: "1.5rem", textAlign: "center",
            border: `2px solid ${info.color}`,
          }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>{info.icon}</div>
            <h3 style={{ margin: 0, color: info.color }}>{info.label}</h3>
            {status === "pending" && (
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 8 }}>
                Your application has been received. Results for Round 1 will be announced soon.
                Check back here for updates.
              </p>
            )}
            {isAdvanced && (
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 8 }}>
                Congratulations! You've advanced to Round 2. See details below.
              </p>
            )}
            {isRejected && (
              <p style={{ color: "var(--text-secondary)", fontSize: 14, marginTop: 8 }}>
                Thank you for your interest in joining 180DC VIT Chennai.
                Unfortunately, you were not selected to proceed to the next round.
              </p>
            )}
          </div>

          {/* Round 1 - Application Summary */}
          <div className="card-doodle" style={{ padding: "1.25rem" }}>
            <h3 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>📋</span> Round 1 — Application
            </h3>
            <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
              <div><strong>Name:</strong> {application.name}</div>
              <div><strong>Email:</strong> {application.email}</div>
              <div><strong>Year:</strong> {application.year}</div>
              <div><strong>Course:</strong> {application.course}</div>
              <div><strong>Primary Domain:</strong> {application.primary_domain}</div>
              {application.secondary_domain && <div><strong>Secondary Domain:</strong> {application.secondary_domain}</div>}
            </div>
          </div>

          {/* Round 2 */}
          <div className="card-doodle" style={{
            padding: "1.25rem",
            opacity: isAdvanced ? 1 : 0.6,
          }}>
            <h3 style={{ margin: "0 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>🎯</span> Round 2
              {!isAdvanced && <span className="floating-note" style={{ fontSize: 11, padding: "0.15rem 0.5rem", transform: "none", marginLeft: 8 }}>Locked</span>}
            </h3>
            {isAdvanced ? (
              <div>
                <p style={{ color: "var(--primary-green)", fontWeight: 600 }}>You have advanced to Round 2!</p>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  Round 2 details are being finalized and will be shared here soon.
                  Keep an eye on this page for instructions, schedules, and materials.
                </p>
                <div style={{ marginTop: 12, padding: "1rem", background: "var(--bg-secondary)", borderRadius: 8, fontSize: 14 }}>
                  <strong>What to expect:</strong>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 20, color: "var(--text-secondary)", fontSize: 13 }}>
                    <li>Detailed instructions for the next round</li>
                    <li>Schedule and deadlines</li>
                    <li>Any preparation materials or resources</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  {isRejected
                    ? "Round 2 is only open to candidates who advance past Round 1."
                    : "Round 2 details will be revealed once Round 1 results are announced."
                  }
                </p>
                <div className="step-status" style={{ marginTop: 8 }}>
                  {isRejected ? "Not eligible" : "Coming soon"}
                </div>
              </div>
            )}
          </div>

          {/* Logout */}
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button className="btn outline" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecruitmentsPage;
