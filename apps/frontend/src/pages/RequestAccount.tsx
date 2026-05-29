import { useState, useEffect } from "react";
import { apiUrl } from "../lib/api";

export default function RequestAccount() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [departments, setDepartments] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch(apiUrl("/api/departments"))
      .then((r) => r.json())
      .then((data) => { if (data.success) setDepartments(data.data || []); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
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
        setStatus("submitted");
        setName("");
        setEmail("");
        setMessage("");
        setDepartmentId("");
      } else {
        setStatus("error: " + (data.error || JSON.stringify(data)));
      }
    } catch (e) {
      setStatus("error: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <div className="container" style={{ padding: "3rem 0" }}>
      <div className="card-doodle" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div className="request-account-header">
          <div>
            <div className="section-label">Request Account</div>
            <h2 style={{ marginTop: 8 }}>Request a Member Account</h2>
            <p style={{ marginTop: 6 }}>
              Fill in this form and an admin will review your request.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <img src="/images/180DC.png" alt="logo" className="request-logo" />
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <input
            className="input"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ border: "2px solid var(--border-light)" }}
          />
          <input
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ border: "2px solid var(--border-light)" }}
          />
          <select
            className="input"
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            required
            style={{ border: "2px solid var(--border-light)" }}
          >
            <option value="">Select a department (required)</option>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {departments.map((d: any) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <textarea
            className="input"
            placeholder="Message (optional)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            style={{ minHeight: 120 }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="btn" type="submit">
              Send Request
            </button>
            {status && (
              <div style={{ color: "var(--text-secondary)" }}>
                Status: {status}
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
