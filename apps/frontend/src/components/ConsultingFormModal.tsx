import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "../lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function ConsultingFormModal({ isOpen, onClose }: Props) {
  const formRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!formRef.current) return;
    const get = (name: string) => (formRef.current!.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${name}"]`)?.value || "").trim();
    const name = get("name");
    const email = get("email");
    const phone = get("phone");
    const organization = get("organization");
    const roleInOrg = get("roleInOrg");
    const requirement = get("requirement");
    setError("");
    if (!name || !email || !phone || !organization || !requirement) {
      setError("Please fill in all required fields.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/consulting-request"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, phone, organization,
          roleInOrg: roleInOrg || null, requirement,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        if (formRef.current) {
          formRef.current.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea").forEach(el => el.value = "");
        }
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
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        padding: 20,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={formRef}
        className="card-doodle"
        style={{
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "2rem",
          cursor: "default",
          borderRadius: "var(--radius-2xl)",
          boxShadow: "var(--shadow-prominent)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontFamily: "var(--font-sans)", fontSize: "1.5rem", fontWeight: 300, letterSpacing: "-0.02em" }}>
            Free Consulting Request
          </h2>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "var(--text-tertiary)",
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              transition: "all 200ms ease-out",
            }}
          >
            ✕
          </button>
        </div>

        {success ? (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <h3 style={{ fontFamily: "var(--font-sans)", fontSize: "1.25rem", fontWeight: 400, margin: "0 0 8px" }}>
              Request Submitted
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
            <input className="input" name="name" placeholder="Your Name *" defaultValue="" />
            <input className="input" name="email" placeholder="Email Address *" type="email" defaultValue="" />
            <input className="input" name="phone" placeholder="Phone Number *" type="tel" defaultValue="" />
            <input className="input" name="organization" placeholder="Organization *" defaultValue="" />
            <input className="input" name="roleInOrg" placeholder="Role in Organization (optional)" defaultValue="" />
            <textarea className="input" name="requirement" placeholder="Your Requirement *" rows={4} style={{ resize: "vertical" }} defaultValue="" />

            {error && (
              <div style={{ color: "var(--status-error)", fontSize: 13, fontWeight: 500 }}>{error}</div>
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
