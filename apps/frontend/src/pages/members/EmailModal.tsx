import { createPortal } from "react-dom";

export default function EmailModal({ item, onClose, onSend, title, modalRef, sending }:
  { item: any; onClose: () => void; onSend: () => void; title: string; modalRef: { current: HTMLDivElement | null }; sending: boolean }) {
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000, display: "flex",
      alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", padding: "1.5rem",
      backdropFilter: "blur(4px)"
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dashboard-card" ref={modalRef} style={{
        width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto",
        padding: "2rem", cursor: "default", borderRadius: 24, boxShadow: "var(--shadow-lg)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0, fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} className="header-action-btn">
             <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div style={{ marginBottom: "1.5rem", padding: "1.25rem", background: "var(--surface-container-low)", borderRadius: 16, border: "1px solid var(--border-light)", fontSize: 13, color: "var(--text-secondary)" }}>
          <strong style={{ display: "block", color: "var(--text-primary)", marginBottom: 8, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>Review Details</strong>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
             <div><span style={{ fontWeight: 600 }}>Candidate:</span> {item.name} ({item.email})</div>
             <div><span style={{ fontWeight: 600 }}>Organization:</span> {item.organization}</div>
             <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--bg-card)", borderRadius: 8, border: "1px solid var(--border-light)", fontStyle: "italic" }}>
               "{item.requirement?.slice(0, 200)}{item.requirement?.length > 200 ? "..." : ""}"
             </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "var(--text-tertiary)" }}>EMAIL SUBJECT</label>
            <input className="input" name="emailSubject" placeholder="Enter email subject" />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, display: "block", color: "var(--text-tertiary)" }}>MESSAGE BODY</label>
            <textarea className="input" name="emailBody" rows={8} placeholder="Write your response here..."
              style={{ resize: "none", lineHeight: 1.6 }} />
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: "0.5rem" }}>
            <button className="btn" disabled={sending} onClick={onSend} style={{ flex: 1, padding: "12px", gap: 10 }}>
              <span className="material-symbols-outlined">{sending ? "sync" : "send"}</span>
              {sending ? "Sending..." : "Send Response"}
            </button>
            <button className="btn outline" onClick={onClose} style={{ padding: "0 1.5rem" }}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
