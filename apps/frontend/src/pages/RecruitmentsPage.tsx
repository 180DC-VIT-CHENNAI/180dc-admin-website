import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Lock, BookOpen, Link as LinkIcon, Briefcase, GraduationCap, Target } from 'lucide-react';
import PillNav from '../components/PillNav';
import { apiUrl } from '../lib/api';
import './RecruitmentsPage.css';

const navItems = [
  { label: "Home", href: "/" },
  { label: "Recruitments", href: "/recruitments" },
];

const domains = [
  "Technical",
  "Finance",
  "Client Relationship Management",
  "Operations",
  "Business Strategy",
  "Marketing",
];

const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

type PageState = "landing" | "register" | "login" | "form" | "dashboard";

const STATUS_INFO: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "Pending Review", color: "#f39c12", icon: "⏳" },
  shortlisted: { label: "Shortlisted", color: "#28a745", icon: "✅" },
  selected: { label: "Selected", color: "#007bff", icon: "🏆" },
  rejected: { label: "Not Selected", color: "#6c757d", icon: "📋" },
};

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.1 } }
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

      <motion.section 
        className="recruitments-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <motion.div 
          className={`recruitments-badge ${isRecruitmentOpen ? "" : "closed"}`}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          {isRecruitmentOpen ? "Open for Applications" : "Applications Closed"}
        </motion.div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          Join <span>180DC VIT Chennai</span>
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          Become part of the world's largest student-led consultancy.
          Help social enterprises create meaningful impact while building
          skills that last a lifetime.
        </motion.p>
      </motion.section>

      <AnimatePresence mode="wait">
        {!isRecruitmentOpen && pageState === "landing" && (
          <motion.div key="closed" className="recruitments-content" variants={pageVariants} initial="initial" animate="animate" exit="exit">
            <div className="recruitments-cta" style={{ border: "none", boxShadow: "none" }}>
              <h3>Applications are currently closed</h3>
              <p>We're not accepting applications right now. Check back later for recruitment updates.</p>
            </div>
          </motion.div>
        )}

        {isRecruitmentOpen && pageState === "landing" && (
        <motion.div key="landing" className="recruitments-content" variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <div className="roadmap-header">
            <h2>Application Roadmap</h2>
            <p>Here's how the recruitment process works</p>
          </div>

          <motion.div className="roadmap-timeline" variants={staggerContainer} initial="initial" whileInView="animate" viewport={{ once: true }}>
            <motion.div className="roadmap-step" variants={pageVariants}>
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
            </motion.div>

            <motion.div className="roadmap-step upcoming" variants={pageVariants}>
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
            </motion.div>
          </motion.div>

          <motion.div className="recruitments-cta" variants={pageVariants} initial="initial" whileInView="animate" viewport={{ once: true }}>
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
          </motion.div>
        </motion.div>
        )}

        {isRecruitmentOpen && pageState === "register" && (
        <motion.div key="register" className="recruitments-content" variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <div className="application-form-section">
            <div className="form-header">
              <h2>Create Your Account</h2>
              <p>Register to apply for recruitment</p>
            </div>
            <form className="application-form" onSubmit={handleRegister}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="regName">Full Name</label>
                  <div className="input-with-icon">
                    <User size={18} />
                    <input id="regName" type="text" placeholder="Enter your full name" value={regName} onChange={e => setRegName(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="regEmail">Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} />
                    <input id="regEmail" type="email" placeholder="Enter your email" value={regEmail} onChange={e => setRegEmail(e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="form-group form-group-full">
                <label htmlFor="regPassword">Password</label>
                <div className="input-with-icon">
                  <Lock size={18} />
                  <input id="regPassword" type="password" placeholder="Create a password (min 8 chars)" value={regPassword} onChange={e => setRegPassword(e.target.value)} required />
                </div>
              </div>
              {regError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: "#e74c3c", fontSize: 14 }}>{regError}</motion.p>}
              <div className="form-actions">
                <button type="button" className="btn outline" onClick={() => setPageState("landing")}>Back</button>
                <button type="submit" className="btn" disabled={regBusy}>{regBusy ? "Creating..." : "Create Account"}</button>
              </div>
              <p style={{ textAlign: "center", marginTop: 12, fontSize: 14 }}>
                Already have an account?{" "}
                <button type="button" className="btn-text" onClick={() => setPageState("login")}>Log in</button>
              </p>
            </form>
          </div>
        </motion.div>
        )}

        {pageState === "login" && (
        <motion.div key="login" className="recruitments-content" variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <div className="application-form-section">
            <div className="form-header">
              <h2>Log In</h2>
              <p>Sign in to your recruitment account</p>
            </div>
            <form className="application-form" onSubmit={handleLogin}>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="loginEmail">Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} />
                    <input id="loginEmail" type="email" placeholder="Enter your email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="loginPassword">Password</label>
                  <div className="input-with-icon">
                    <Lock size={18} />
                    <input id="loginPassword" type="password" placeholder="Enter your password" value={loginPassword} onChange={e => setLoginPassword(e.target.value)} required />
                  </div>
                </div>
              </div>
              {loginError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: "#e74c3c", fontSize: 14 }}>{loginError}</motion.p>}
              <div className="form-actions">
                <button type="button" className="btn outline" onClick={() => setPageState("landing")}>Back</button>
                <button type="submit" className="btn" disabled={loginBusy}>{loginBusy ? "Logging in..." : "Log In"}</button>
              </div>
              <p style={{ textAlign: "center", marginTop: 12, fontSize: 14 }}>
                Don't have an account?{" "}
                {isRecruitmentOpen ? (
                  <button type="button" className="btn-text" onClick={() => setPageState("register")}>Create one</button>
                ) : (
                  <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Registration is currently closed</span>
                )}
              </p>
            </form>
          </div>
        </motion.div>
        )}

        {isRecruitmentOpen && pageState === "form" && applicant && (
        <motion.div key="form" className="recruitments-content" variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <div className="application-form-section">
            <div className="form-header">
              <h2>Round 1 — Application Form</h2>
              <p>Welcome, {applicant.name}! Fill in your details below.</p>
            </div>
            <form className="application-form" onSubmit={handleSubmitApplication}>
              
              <div className="form-section-title">Personal Details</div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="appName">Full Name</label>
                  <div className="input-with-icon">
                    <User size={18} />
                    <input id="appName" type="text" value={appName} onChange={e => setAppName(e.target.value)} required />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="appEmail">Email Address</label>
                  <div className="input-with-icon">
                    <Mail size={18} />
                    <input id="appEmail" type="email" value={appEmail} onChange={e => setAppEmail(e.target.value)} required />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="appYear">Year of Study</label>
                  <div className="input-with-icon">
                    <GraduationCap size={18} />
                    <select id="appYear" value={appYear} onChange={e => setAppYear(e.target.value)} required>
                      <option value="" disabled>Select your year</option>
                      {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="appCourse">Course / Branch</label>
                  <div className="input-with-icon">
                    <BookOpen size={18} />
                    <input id="appCourse" type="text" placeholder="e.g. CSE, ECE, Mech..." value={appCourse} onChange={e => setAppCourse(e.target.value)} required />
                  </div>
                </div>
              </div>

              <div className="form-section-title">Domain Preferences</div>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="appPrimaryDomain">Preferred Domain</label>
                  <div className="input-with-icon">
                    <Target size={18} />
                    <select id="appPrimaryDomain" value={appPrimaryDomain} onChange={e => setAppPrimaryDomain(e.target.value)} required>
                      <option value="" disabled>Select a domain</option>
                      {openDomains.length > 0 ? (
                        openDomains.map(d => <option key={d} value={d}>{d}</option>)
                      ) : (
                        domains.map(d => <option key={d} value={d}>{d}</option>)
                      )}
                    </select>
                  </div>
                  {openDomains.length === 0 && (
                    <p style={{ color: "#e74c3c", fontSize: 12, marginTop: 4 }}>No domains are currently accepting applications. Check back later.</p>
                  )}
                </div>
                <div className="form-group">
                  <label htmlFor="appSecondaryDomain">Secondary Domain</label>
                  <div className="input-with-icon">
                    <Target size={18} />
                    <select id="appSecondaryDomain" value={appSecondaryDomain} onChange={e => setAppSecondaryDomain(e.target.value)}>
                      <option value="">None</option>
                      {openDomains.length > 0 ? (
                        openDomains.map(d => <option key={d} value={d}>{d}</option>)
                      ) : (
                        domains.map(d => <option key={d} value={d}>{d}</option>)
                      )}
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-group form-group-full">
                <label htmlFor="appWhyDomain">Why did you choose {appPrimaryDomain || "your preferred domain"}?</label>
                <textarea id="appWhyDomain" rows={3} placeholder="Tell us what draws you to this domain..." value={appWhyDomain} onChange={e => setAppWhyDomain(e.target.value)} required />
              </div>

              <div className="form-section-title">Experience & Motivation</div>
              <div className="form-group form-group-full">
                <label htmlFor="appPriorExperience">Any prior experience in this field?</label>
                <div className="input-with-icon textarea-icon">
                  <Briefcase size={18} style={{ marginTop: 14 }} />
                  <textarea id="appPriorExperience" rows={3} placeholder="Projects, internships, courses, or relevant experience..." value={appPriorExperience} onChange={e => setAppPriorExperience(e.target.value)} />
                </div>
              </div>

              <div className="form-group form-group-full">
                <label htmlFor="appPortfolioLink">GitHub / Portfolio Link (required for Technical & R&D)</label>
                <div className="input-with-icon">
                  <LinkIcon size={18} />
                  <input id="appPortfolioLink" type="url" placeholder="https://github.com/your-username" value={appPortfolioLink} onChange={e => setAppPortfolioLink(e.target.value)} />
                </div>
              </div>

              <div className="form-group form-group-full">
                <label htmlFor="appWhyJoin">Why do you want to join 180DC?</label>
                <textarea id="appWhyJoin" rows={4} placeholder="Tell us about yourself and why you'd be a great fit..." value={appWhyJoin} onChange={e => setAppWhyJoin(e.target.value)} required />
              </div>

              {appError && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ color: "#e74c3c", fontSize: 14 }}>{appError}</motion.p>}

              <div className="form-actions">
                <button type="button" className="btn outline" onClick={() => { setApplicant(null); setPageState("landing"); }}>Cancel</button>
                <button type="submit" className="btn" disabled={appBusy}>{appBusy ? "Submitting..." : "Submit Application"}</button>
              </div>
            </form>
          </div>
        </motion.div>
        )}

        {pageState === "dashboard" && applicant && (
        <motion.div key="dashboard" className="recruitments-content" variants={pageVariants} initial="initial" animate="animate" exit="exit">
          <ApplicantDashboard
            applicant={applicant}
            application={application}
            loading={dashboardLoading}
            onLogout={handleLogout}
          />
        </motion.div>
        )}
      </AnimatePresence>
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
        <motion.div variants={staggerContainer} initial="initial" animate="animate" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Status Banner */}
          <motion.div variants={pageVariants} className="status-banner" style={{
            '--status-color': info.color,
          } as React.CSSProperties}>
            <div className="status-icon-glow">{info.icon}</div>
            <h3>{info.label}</h3>
            {status === "pending" && (
              <p>Your application has been received. Results for Round 1 will be announced soon. Check back here for updates.</p>
            )}
            {isAdvanced && (
              <p>Congratulations! You've advanced to Round 2. See details below.</p>
            )}
            {isRejected && (
              <p>Thank you for your interest in joining 180DC VIT Chennai. Unfortunately, you were not selected to proceed to the next round.</p>
            )}
          </motion.div>

          {/* Round 1 - Application Summary */}
          <motion.div variants={pageVariants} className="dashboard-card">
            <h3><span style={{ fontSize: 20 }}>📋</span> Round 1 — Application</h3>
            <div className="dashboard-grid">
              <div><span>Name:</span> {application.name}</div>
              <div><span>Email:</span> {application.email}</div>
              <div><span>Year:</span> {application.year}</div>
              <div><span>Course:</span> {application.course}</div>
              <div><span>Primary Domain:</span> {application.primary_domain}</div>
              {application.secondary_domain && <div><span>Secondary Domain:</span> {application.secondary_domain}</div>}
            </div>
          </motion.div>

          {/* Round 2 */}
          <motion.div variants={pageVariants} className={`dashboard-card ${!isAdvanced ? 'locked' : ''}`}>
            <h3>
              <span style={{ fontSize: 20 }}>🎯</span> Round 2
              {!isAdvanced && <span className="badge-locked">Locked</span>}
            </h3>
            {isAdvanced ? (
              <div className="round-details">
                <p className="success-text">You have advanced to Round 2!</p>
                <p className="desc-text">Round 2 details are being finalized and will be shared here soon. Keep an eye on this page for instructions, schedules, and materials.</p>
                <div className="info-box">
                  <strong>What to expect:</strong>
                  <ul>
                    <li>Detailed instructions for the next round</li>
                    <li>Schedule and deadlines</li>
                    <li>Any preparation materials or resources</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div>
                <p className="desc-text">
                  {isRejected
                    ? "Round 2 is only open to candidates who advance past Round 1."
                    : "Round 2 details will be revealed once Round 1 results are announced."
                  }
                </p>
                <div className="step-status">
                  {isRejected ? "Not eligible" : "Coming soon"}
                </div>
              </div>
            )}
          </motion.div>

          {/* Logout */}
          <motion.div variants={pageVariants} style={{ textAlign: "center", marginTop: 12 }}>
            <button className="btn outline" onClick={onLogout}>
              Log Out
            </button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

export default RecruitmentsPage;
