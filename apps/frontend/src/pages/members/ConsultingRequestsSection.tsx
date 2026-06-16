import { useState, useEffect, useRef } from "react";
import { apiUrl } from "../../lib/api";
import EmailModal from "./EmailModal";

export default function ConsultingRequestsSection({ authToken }: { authToken: string }) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptModal, setAcceptModal] = useState<any>(null);
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [sending, setSending] = useState(false);
  const emailModalRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch(apiUrl("/api/consulting-requests"), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await res.json();
      if (d.success) setRequests(d.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [authToken]);

  function openAcceptModal(req: any) {
    setRejectModal(null);
    setAcceptModal(req);
    setSending(false);
    setTimeout(// fallow-ignore-next-line complexity
    () => {
      if (!emailModalRef.current) return;
      const sub = emailModalRef.current.querySelector<HTMLInputElement>("input[name='emailSubject']");
      const body = emailModalRef.current.querySelector<HTMLTextAreaElement>("textarea[name='emailBody']");
      if (sub) sub.value = `Response to your Consulting Request - 180DC VIT Chennai`;
      if (body) body.value =
        `Hi ${req.name},\n\nThank you for reaching out to 180 Degrees Consulting VIT Chennai!\n\nWe have reviewed your consulting request regarding "${req.requirement.slice(0, 100)}${req.requirement.length > 100 ? "..." : ""}" and we would be happy to assist you.\n\nOur team will be in touch with you shortly to discuss the next steps.\n\nBest regards,\n180 Degrees Consulting\nVIT Chennai`;
    }, 0);
  }

  function openRejectModal(req: any) {
    setAcceptModal(null);
    setRejectModal(req);
    setSending(false);
    setTimeout(() => {
      if (!emailModalRef.current) return;
      const sub = emailModalRef.current.querySelector<HTMLInputElement>("input[name='emailSubject']");
      const body = emailModalRef.current.querySelector<HTMLTextAreaElement>("textarea[name='emailBody']");
      if (sub) sub.value = `Update on your Consulting Request - 180DC VIT Chennai`;
      if (body) body.value =
        `Hi ${req.name},\n\nThank you for reaching out to 180 Degrees Consulting VIT Chennai.\n\nAfter careful review, we regret to inform you that we are unable to take on your consulting request at this time.\n\nWe appreciate your interest and wish you the best.\n\nBest regards,\n180 Degrees Consulting\nVIT Chennai`;
    }, 0);
  }

  async function handleAccept() {
    if (!emailModalRef.current) return;
    const sub = emailModalRef.current.querySelector<HTMLInputElement>("input[name='emailSubject']");
    const bodyEl = emailModalRef.current.querySelector<HTMLTextAreaElement>("textarea[name='emailBody']");
    const emailSubject = (sub?.value || "").trim();
    const emailBody = (bodyEl?.value || "").trim();
    if (!emailSubject || !emailBody) return alert("Subject and body are required");
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/consulting-requests/${acceptModal.id}/accept`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ emailSubject, emailBody }),
      });
      const d = await res.json();
      if (d.success) {
        alert("Request accepted and email sent.");
        setAcceptModal(null);
        load();
      } else alert(d.error);
    } catch { alert("Failed to send. Please try again."); } finally { setSending(false); }
  }

  async function handleReject() {
    if (!emailModalRef.current) return;
    const sub = emailModalRef.current.querySelector<HTMLInputElement>("input[name='emailSubject']");
    const bodyEl = emailModalRef.current.querySelector<HTMLTextAreaElement>("textarea[name='emailBody']");
    const emailSubject = (sub?.value || "").trim();
    const emailBody = (bodyEl?.value || "").trim();
    if (!emailSubject || !emailBody) return alert("Subject and body are required");
    setSending(true);
    try {
      const res = await fetch(apiUrl(`/api/consulting-requests/${rejectModal.id}/reject`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ emailSubject, emailBody }),
      });
      const d = await res.json();
      if (d.success) {
        alert("Request rejected and email sent.");
        setRejectModal(null);
        load();
      } else alert(d.error);
    } catch { alert("Failed to send. Please try again."); } finally { setSending(false); }
  }

  if (loading) return <div style={{ textAlign: "center", padding: "4rem", color: "var(--text-tertiary)" }}>Loading requests...</div>;

  const pending = requests.filter((r: any) => r.status === "pending");
  const accepted = requests.filter((r: any) => r.status === "accepted");
  const rejected = requests.filter((r: any) => r.status === "rejected");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {requests.length === 0 && (
        <div className="dashboard-card" style={{ textAlign: "center", padding: "4rem" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--text-tertiary)", marginBottom: "1rem" }}>business_center</span>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>No consulting requests received yet.</p>
        </div>
      )}

      {pending.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
             <h3 style={{ margin: 0, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#f59e0b", fontWeight: 800 }}>Pending Review ({pending.length})</h3>
             <div style={{ flex: 1, height: 1, background: "rgba(245, 158, 11, 0.2)" }} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {// fallow-ignore-next-line complexity
            pending.map((req: any) => (
              <div key={req.id} className="dashboard-card" style={{ padding: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 260 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                       <div className="avatar-circle" style={{ width: 40, height: 40, background: "var(--surface-container-high)", color: "var(--text-primary)" }}>{req.name[0]}</div>
                       <div>
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{req.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{req.email} • {req.phone}</div>
                       </div>
                    </div>
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--primary-green)" }}>
                       <span className="material-symbols-outlined" style={{ fontSize: 18 }}>business</span>
                       {req.organization} {req.role_in_org && `(${req.role_in_org})`}
                    </div>
                    <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-light)", fontSize: 14, lineHeight: 1.6, color: "var(--text-secondary)" }}>
                      {req.requirement}
                    </div>
                    <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-tertiary)", display: "flex", alignItems: "center", gap: 4 }}>
                       <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                       Submitted on {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => openAcceptModal(req)}>Accept</button>
                    <button className="btn outline" style={{ padding: "8px 16px", fontSize: 13, borderColor: "#ef4444", color: "#ef4444" }} onClick={() => openRejectModal(req)}>Reject</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(accepted.length > 0 || rejected.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "2rem" }}>
          {accepted.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
               <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "#10b981", fontWeight: 800 }}>Accepted ({accepted.length})</h3>
                  <div style={{ flex: 1, height: 1, background: "rgba(16, 185, 129, 0.2)" }} />
               </div>
               <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {accepted.map((req: any) => (
                    <div key={req.id} style={{ padding: "12px 16px", borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                       <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{req.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{req.organization}</div>
                       </div>
                       <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={async () => {
                         if (!confirm("Delete record?")) return;
                         await fetch(apiUrl(`/api/consulting-requests/${req.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                         load();
                       }}><span className="material-symbols-outlined">delete</span></button>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {rejected.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
               <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <h3 style={{ margin: 0, fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-tertiary)", fontWeight: 800 }}>Archived ({rejected.length})</h3>
                  <div style={{ flex: 1, height: 1, background: "var(--border-light)" }} />
               </div>
               <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {rejected.map((req: any) => (
                    <div key={req.id} style={{ padding: "12px 16px", borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: 0.7 }}>
                       <div>
                          <div style={{ fontSize: 14, fontWeight: 700 }}>{req.name}</div>
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{req.organization}</div>
                       </div>
                       <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={async () => {
                         if (!confirm("Delete record?")) return;
                         await fetch(apiUrl(`/api/consulting-requests/${req.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                         load();
                       }}><span className="material-symbols-outlined">delete</span></button>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      )}

      {acceptModal && (
        <EmailModal item={acceptModal} title="Accept Consulting Request" onClose={() => setAcceptModal(null)} onSend={handleAccept} modalRef={emailModalRef} sending={sending} />
      )}

      {rejectModal && (
        <EmailModal item={rejectModal} title="Decline Consulting Request" onClose={() => setRejectModal(null)} onSend={handleReject} modalRef={emailModalRef} sending={sending} />
      )}
    </div>
  );
}
