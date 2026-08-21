import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Department = any;

export default function RequestAccount() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/departments"))
      .then((r) => r.json())
      .then((data) => { if (data.success) setDepartments(data.data || []); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/signup-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, departmentId }),
      });

      const text = await res.text();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : { success: res.ok };
      } catch {
        data = { success: res.ok, raw: text };
      }

      if (data.success) {
        setSubmittedEmail(email);
        setName("");
        setEmail("");
        setMessage("");
        setDepartmentId("");
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="request-account-page">
      {/* Atmosphere — concentric rings echoing the portal's brand panel */}
      <span className="request-account-ring request-account-ring--one" aria-hidden="true" />
      <span className="request-account-ring request-account-ring--two" aria-hidden="true" />

      <button
        onClick={toggleTheme}
        className="request-account-theme-toggle"
        title="Toggle Theme"
        aria-label="Toggle Theme"
      >
        <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
      </button>

      <div className="request-account-inner">
        <section className="request-account-card">
          <header className="request-account-header">
            <img
              src="/images/official-logo.png"
              alt="180 Degrees Consulting"
              className="request-account-logo"
            />
            <p className="request-account-kicker">180 Degrees Consulting &middot; VIT Chennai</p>
            <h1 className="request-account-title">
              Request a <em>Member</em> Account
            </h1>
            <p className="request-account-subtitle">
              Tell us a little about yourself and an admin will review your request.
            </p>
          </header>

          {submittedEmail !== null ? (
            <div className="request-account-success" role="status">
              <span className="request-account-success-icon" aria-hidden="true">
                <span className="material-symbols-outlined">check</span>
              </span>
              <h2 className="request-account-success-title">Request received</h2>
              <p className="request-account-success-copy">
                Thank you — an admin will review your request and reach out at{" "}
                <strong>{submittedEmail}</strong> once it&rsquo;s approved.
              </p>
              <div className="request-account-success-actions">
                <Link to="/members" className="btn outline">
                  Back to portal sign in
                </Link>
                <button
                  type="button"
                  className="request-account-link-btn"
                  onClick={() => setSubmittedEmail(null)}
                >
                  Submit another request
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="request-account-form">
              <div className="request-account-field">
                <label htmlFor="ra-name" className="request-account-label">Full name</label>
                <input
                  id="ra-name"
                  className="input request-account-input"
                  placeholder="Your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="request-account-field">
                <label htmlFor="ra-email" className="request-account-label">Email address</label>
                <input
                  id="ra-email"
                  type="email"
                  className="input request-account-input"
                  placeholder="you@vitstudent.ac.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="request-account-field">
                <label htmlFor="ra-department" className="request-account-label">Department</label>
                <select
                  id="ra-department"
                  className="input request-account-input request-account-select"
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    Select a department
                  </option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="request-account-field">
                <label htmlFor="ra-message" className="request-account-label">
                  Message <span className="request-account-optional">(optional)</span>
                </label>
                <textarea
                  id="ra-message"
                  className="input request-account-input request-account-textarea"
                  placeholder="Why do you want to join 180DC?"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              {error && (
                <div className="request-account-alert request-account-alert--error" role="alert">
                  <span className="material-symbols-outlined" aria-hidden="true">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                className="btn request-account-submit"
                disabled={submitting}
                aria-busy={submitting}
              >
                <span>{submitting ? "Sending your request" : "Send request"}</span>
                {submitting ? (
                  <span className="material-symbols-outlined request-account-spinner" aria-hidden="true">
                    progress_activity
                  </span>
                ) : (
                  <span className="btn-icon-trail" aria-hidden="true">
                    <span className="icon-circle">
                      <span className="material-symbols-outlined request-account-btn-icon">arrow_forward</span>
                    </span>
                  </span>
                )}
              </button>
            </form>
          )}
        </section>

        {submittedEmail === null && (
          <p className="request-account-back">
            <Link to="/members">&larr; Back to portal sign in</Link>
          </p>
        )}

        <p className="request-account-foot">
          &copy; 2026 180 Degrees Consulting &middot; VIT Chennai
        </p>
      </div>
    </div>
  );
}
