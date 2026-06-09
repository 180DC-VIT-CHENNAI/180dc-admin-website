import { createPortal } from "react-dom";

export default function EmailModal({ item, onClose, onSend, title, modalRef, sending }:
  { item: any; onClose: () => void; onSend: () => void; title: string; modalRef: { current: HTMLDivElement | null }; sending: boolean }) {
  return createPortal(
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000, display: "flex",
      alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 20,
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="card-doodle" ref={modalRef} style={{
        width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto",
        padding: "2rem", cursor: "default",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontFamily: "'Caveat', cursive", fontSize: 24 }}>
            {title} — {item.name}
          </h3>
          <button onClick={onClose}
            style={{ border: "none", background: "none", fontSize: 24, cursor: "pointer", color: "var(--text-secondary)", padding: "0 4px" }}>
            ✕
          </button>
        </div>

        <div style={{ marginBottom: 16, padding: "0.8rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, color: "var(--text-secondary)" }}>
          <strong>Original Request:</strong>
          <div style={{ marginTop: 4 }}>From: {item.name} ({item.email})</div>
          <div>Organization: {item.organization}</div>
          <div style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{item.requirement}</div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Email Subject</label>
            <input className="input" name="emailSubject" defaultValue="" />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, display: "block" }}>Email Body</label>
            <textarea className="input" name="emailBody" rows={10} defaultValue=""
              style={{ resize: "vertical", fontFamily: "monospace", fontSize: 13 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" disabled={sending} onClick={onSend}>
              {sending ? "Sending..." : "Send Email"}
            </button>
            <button className="btn outline" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
