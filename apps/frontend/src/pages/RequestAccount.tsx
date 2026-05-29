import { useState } from "react";
import { apiUrl } from "../lib/api";

export default function RequestAccount() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("submitting");
    try {
      const res = await fetch(apiUrl("/api/signup-requests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message }),
      });

      const text = await res.text();
      let data: any = {};
      try {
        data = text ? JSON.parse(text) : { success: res.ok };
      } catch (err) {
        // Server returned non-JSON; fall back to status code
        data = { success: res.ok, raw: text };
      }

      if (data.success) {
        setStatus("submitted");
        setName("");
        setEmail("");
        setMessage("");
      } else {
        setStatus("error: " + (data.error || JSON.stringify(data)));
      }
    } catch (e: any) {
      setStatus("error: " + e.message);
    }
  }

  return (
    <div className="container" style={{ padding: "3rem 0" }}>
      <div className="card-doodle" style={{ maxWidth: 760, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <div>
            <div className="section-label">Request Account</div>
            <h2 style={{ marginTop: 8 }}>Request a Member Account</h2>
            <p style={{ marginTop: 6 }}>
              Fill in this form and an admin will review your request.
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <img src="/images/180DC.png" alt="logo" style={{ width: 80 }} />
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
