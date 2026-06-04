import { useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "../lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConsultingFormModal({ isOpen, onClose }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [roleInOrg, setRoleInOrg] = useState("");
  const [requirement, setRequirement] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");
    if (!name.trim() || !email.trim() || !phone.trim() || !organization.trim() || !requirement.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/consulting-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          organization: organization.trim(),
          roleInOrg: roleInOrg.trim() || null,
          requirement: requirement.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setName("");
        setEmail("");
        setPhone("");
        setOrganization("");
        setRoleInOrg("");
        setRequirement("");
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.4)",
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="card-doodle"
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "2rem",
          cursor: "default",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: "'Caveat', cursive", fontSize: 28 }}>
            Free Consulting Request
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: 24,
              cursor: "pointer",
              color: "var(--text-secondary)",
              padding: "0 4px",
            }}
          >
            ✕
          </button>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
            <h3 style={{ fontFamily: "'Caveat', cursive", fontSize: 24, margin: "0 0 8px" }}>
              Request Submitted!
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Thank you! Our team will review your request and get back to you shortly.
            </p>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => { setSuccess(false); onClose(); }}>
              Close
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            <input
              className="input"
              placeholder="Your Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="input"
              placeholder="Email Address *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input"
              placeholder="Phone Number *"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <input
              className="input"
              placeholder="Organization *"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
            />
            <input
              className="input"
              placeholder="Role in Organization (optional)"
              value={roleInOrg}
              onChange={(e) => setRoleInOrg(e.target.value)}
            />
            <textarea
              className="input"
              placeholder="Your Requirement *"
              rows={4}
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              style={{ resize: "vertical" }}
            />

            {error && (
              <div style={{ color: "#e74c3c", fontSize: 13, fontWeight: 600 }}>{error}</div>
            )}

            <button className="btn" disabled={busy} onClick={handleSubmit}>
              {busy ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
