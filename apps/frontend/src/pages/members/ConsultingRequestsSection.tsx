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

  useEffect(() => { load(); }, []);

  function openAcceptModal(req: any) {
    setRejectModal(null);
    setAcceptModal(req);
    setSending(false);
    setTimeout(() => {
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

  if (loading) return <p>Loading consulting requests...</p>;

  const pending = requests.filter((r: any) => r.status === "pending");
  const accepted = requests.filter((r: any) => r.status === "accepted");
  const rejected = requests.filter((r: any) => r.status === "rejected");

  return (
    <>
      <h2 style={{ marginTop: 0 }}>Consulting Requests</h2>
      <div className="members-grid">

        {requests.length === 0 && (
          <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
            <p style={{ color: "var(--text-secondary)" }}>No consulting requests yet.</p>
          </div>
        )}

        {pending.length > 0 && (
          <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
            <h3>Pending Requests ({pending.length})</h3>
            <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
              {pending.map((req: any) => (
                <div key={req.id} className="card-doodle" style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ fontSize: 16 }}>{req.name}</strong>
                      <div style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>{req.email} · {req.phone}</div>
                      <div style={{ fontSize: 13, color: "var(--primary-green)", marginTop: 2 }}>{req.organization}{req.role_in_org ? ` — ${req.role_in_org}` : ""}</div>
                      <div style={{ marginTop: 8, padding: "0.6rem 0.8rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                        {req.requirement}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 6 }}>
                        Submitted: {new Date(req.created_at).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                      <button className="btn" style={{ padding: "0.4rem 1rem", fontSize: 13 }}
                        onClick={() => openAcceptModal(req)}>
                        Accept
                      </button>
                      <button className="btn outline" style={{ padding: "0.4rem 1rem", fontSize: 13 }}
                        onClick={() => openRejectModal(req)}>
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {accepted.length > 0 && (
          <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
            <h3>Accepted ({accepted.length})</h3>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {accepted.map((req: any) => (
                <div key={req.id} style={{ padding: "0.6rem 0.8rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{req.name}</strong>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>{req.organization}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, fontWeight: 600, background: "var(--primary-green)", color: "#fff" }}>
                      Accepted
                    </span>
                    <button className="btn outline" style={{ padding: "2px 8px", fontSize: 11, color: "#e74c3c", borderColor: "#e74c3c" }} onClick={async () => {
                      if (!confirm("Delete this accepted request?")) return;
                      try {
                        const res = await fetch(apiUrl(`/api/consulting-requests/${req.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                        const d = await res.json();
                        if (d.success) load();
                        else alert(d.error);
                      } catch { alert("Failed to delete"); }
                    }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {rejected.length > 0 && (
          <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
            <h3>Rejected ({rejected.length})</h3>
            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
              {rejected.map((req: any) => (
                <div key={req.id} style={{ padding: "0.6rem 0.8rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong style={{ fontSize: 14 }}>{req.name}</strong>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 8 }}>{req.organization}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, fontWeight: 600, background: "#e74c3c", color: "#fff" }}>
                      Rejected
                    </span>
                    <button className="btn outline" style={{ padding: "2px 8px", fontSize: 11, color: "#e74c3c", borderColor: "#e74c3c" }} onClick={async () => {
                      if (!confirm("Delete this rejected request?")) return;
                      try {
                        const res = await fetch(apiUrl(`/api/consulting-requests/${req.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                        const d = await res.json();
                        if (d.success) load();
                        else alert(d.error);
                      } catch { alert("Failed to delete"); }
                    }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {acceptModal && (
        <EmailModal
          item={acceptModal}
          title="Accept Request"
          onClose={() => setAcceptModal(null)}
          onSend={handleAccept}
          modalRef={emailModalRef}
          sending={sending}
        />
      )}

      {rejectModal && (
        <EmailModal
          item={rejectModal}
          title="Reject Request"
          onClose={() => setRejectModal(null)}
          onSend={handleReject}
          modalRef={emailModalRef}
          sending={sending}
        />
      )}
    </>
  );
}
