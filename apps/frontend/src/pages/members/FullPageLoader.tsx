import { useEffect } from "react";
import { createPortal } from "react-dom";

export default function FullPageLoader({ message }: { message: string }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
      <div className="card-doodle" style={{ padding: 24, textAlign: "center", transition: "none", transform: "none" }}>
        <p style={{ fontSize: 16, fontWeight: 700, margin: "0 0 8px" }}>{message}</p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0 }}>Please wait, this may take a moment.</p>
      </div>
    </div>,
    document.body,
  );
}
