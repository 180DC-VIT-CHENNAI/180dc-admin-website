import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiUrl } from "../lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// fallow-ignore-next-line complexity
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
            <h3 style={{ fontFamily: "'Caveat', cursive", fontSize: 24, margin: "0 0 8px" }}>
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
            <input
              className="input"
              name="name"
              placeholder="Your Name *"
              defaultValue=""
            />
            <input
              className="input"
              name="email"
              placeholder="Email Address *"
              type="email"
              defaultValue=""
            />
            <input
              className="input"
              name="phone"
              placeholder="Phone Number *"
              type="tel"
              defaultValue=""
            />
            <input
              className="input"
              name="organization"
              placeholder="Organization *"
              defaultValue=""
            />
            <input
              className="input"
              name="roleInOrg"
              placeholder="Role in Organization (optional)"
              defaultValue=""
            />
            <textarea
              className="input"
              name="requirement"
              placeholder="Your Requirement *"
              rows={4}
              style={{ resize: "vertical" }}
              defaultValue=""
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
