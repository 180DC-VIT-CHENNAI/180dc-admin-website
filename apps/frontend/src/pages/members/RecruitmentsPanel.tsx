import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

interface Props {
  authToken: string;
  powerLevel?: number;
}

const ALL_DOMAINS = ["Technical", "Research & Development", "Marketing", "Social Media", "Finance", "Events and Initiatives", "Client Partner Sponsor", "Business Strategy", "Human Resources"];

const RecruitmentsPanel = ({ authToken, powerLevel = 0 }: Props) => {
  const [applications, setApplications] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [selectedApp, setSelectedApp] = useState<any>(null);
  const [evalData, setEvalData] = useState<Record<string, string>>({});
  const [evalComments, setEvalComments] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("");
  const [domainFilter, setDomainFilter] = useState("");
  const [loading, setLoading] = useState(true);

  // Criteria management
  const [newCriterionName, setNewCriterionName] = useState("");
  const [newCriterionMax, setNewCriterionMax] = useState("10");
  const [criteriaBusy, setCriteriaBusy] = useState(false);

  // Bulk shortlist
  const [bulkCount, setBulkCount] = useState("10");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Domain settings
  const [domainSettings, setDomainSettings] = useState<any[]>([]);
  const [settingsBusy, setSettingsBusy] = useState(false);

  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };
  const isBoard = powerLevel >= 100;

  async function loadApplications() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (domainFilter) params.set("domain", domainFilter);
      const res = await fetch(apiUrl(`/api/recruitment/admin/applications?${params.toString()}`), { headers: { Authorization: `Bearer ${authToken}` } });
      const data = await res.json();
      if (data.success) setApplications(data.data || []);
    } finally { setLoading(false); }
  }

  async function loadCriteria() {
    const res = await fetch(apiUrl("/api/recruitment/admin/evaluation-criteria?roundId=round1"), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setCriteria(data.data || []);
  }

  async function loadDomainSettings() {
    const res = await fetch(apiUrl("/api/recruitment/admin/settings"), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setDomainSettings(data.data || []);
  }

  useEffect(() => { loadApplications(); }, [statusFilter, domainFilter]);
  useEffect(() => { loadCriteria(); }, []);
  useEffect(() => { if (isBoard) loadDomainSettings(); }, [isBoard]);

  async function openApplication(app: any) {
    const res = await fetch(apiUrl(`/api/recruitment/admin/applications/${app.id}`), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) {
      setSelectedApp(data);
      const evals: Record<string, string> = {};
      const comments: Record<string, string> = {};
      if (data.evaluations) {
        for (const e of data.evaluations) {
          evals[e.criterion_id] = String(e.score);
          comments[e.criterion_id] = e.comment || "";
        }
      }
      setEvalData(evals);
      setEvalComments(comments);
    }
  }

  async function saveEvaluation(criterionId: string) {
    const score = parseFloat(evalData[criterionId]);
    if (isNaN(score)) return alert("Enter a valid score");
    const criterion = criteria.find(c => c.id === criterionId);
    if (criterion && score > criterion.max_score) {
      return alert(`Max score is ${criterion.max_score}`);
    }
    const res = await fetch(apiUrl("/api/recruitment/admin/evaluations"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        applicationId: selectedApp!.application.id,
        criterionId,
        score,
        comment: evalComments[criterionId] || null,
      }),
    });
    const data = await res.json();
    if (data.success) {
      openApplication(selectedApp!.application);
    } else {
      alert(data.error);
    }
  }

  async function updateStatus(appId: string, status: string) {
    const res = await fetch(apiUrl(`/api/recruitment/admin/applications/${appId}/status`), {
      method: "PUT",
      headers,
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (data.success) {
      loadApplications();
      if (selectedApp?.application?.id === appId) setSelectedApp(null);
    } else alert(data.error);
  }

  async function addCriterion() {
    if (!newCriterionName.trim() || !newCriterionMax) return;
    setCriteriaBusy(true);
    try {
      const res = await fetch(apiUrl("/api/recruitment/admin/evaluation-criteria"), {
        method: "POST",
        headers,
        body: JSON.stringify({ roundId: "round1", name: newCriterionName.trim(), maxScore: parseFloat(newCriterionMax) }),
      });
      const data = await res.json();
      if (data.success) {
        setNewCriterionName(""); setNewCriterionMax("10");
        loadCriteria();
      } else alert(data.error);
    } finally { setCriteriaBusy(false); }
  }

  async function bulkShortlist() {
    if (!confirm(`Shortlist top ${bulkCount} applicants by score?`)) return;
    setBulkBusy(true);
    try {
      const res = await fetch(apiUrl("/api/recruitment/admin/bulk-shortlist"), {
        method: "POST",
        headers,
        body: JSON.stringify({ roundId: "round1", count: parseInt(bulkCount) }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadApplications();
      } else alert(data.error);
    } finally { setBulkBusy(false); }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'shortlisted': return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' };
      case 'rejected': return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' };
      case 'selected': return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' };
      default: return { bg: 'var(--surface-container-high)', text: 'var(--text-secondary)' };
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      <div className="members-grid">
        {/* Domain Settings (President/VP only) */}
        {isBoard && (
          <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
               <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>toggle_on</span>
               <h3 style={{ margin: 0 }}>Open Domains</h3>
            </div>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, marginBottom: "1.5rem" }}>
              Toggle which domains are open for applications. Only domains marked as open will appear on the public application form.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
              {domainSettings.map((ds: any) => (
                <button
                  key={ds.domain_name}
                  onClick={async () => {
                    const newSettings = domainSettings.map(d => d.domain_name === ds.domain_name ? { ...d, is_open: d.is_open ? 0 : 1 } : d);
                    setDomainSettings(newSettings);
                    const openDomains = newSettings.filter((d: any) => d.is_open).map((d: any) => d.domain_name);
                    setSettingsBusy(true);
                    try {
                      await fetch(apiUrl("/api/recruitment/admin/settings"), {
                        method: "PUT", headers,
                        body: JSON.stringify({ openDomains }),
                      });
                    } finally { setSettingsBusy(false); }
                  }}
                  disabled={settingsBusy}
                  className={`btn ${ds.is_open ? "" : "outline"}`}
                  style={{
                    padding: "8px 16px", fontSize: 13, gap: 8,
                    background: ds.is_open ? "var(--primary-green)" : "transparent",
                    color: ds.is_open ? "#fff" : "var(--text-secondary)",
                    borderColor: ds.is_open ? "transparent" : "var(--outline-variant)"
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{ds.is_open ? "check_circle" : "circle"}</span>
                  {ds.domain_name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button className="btn outline" style={{ fontSize: 13 }} disabled={settingsBusy} onClick={async () => {
                const allOpen = domainSettings.map((d: any) => ({ ...d, is_open: 1 }));
                setDomainSettings(allOpen);
                setSettingsBusy(true);
                try { await fetch(apiUrl("/api/recruitment/admin/settings"), { method: "PUT", headers, body: JSON.stringify({ openDomains: ALL_DOMAINS }) }); } finally { setSettingsBusy(false); }
              }}>Select All</button>
              <button className="btn outline" style={{ fontSize: 13 }} disabled={settingsBusy} onClick={async () => {
                const allClosed = domainSettings.map((d: any) => ({ ...d, is_open: 0 }));
                setDomainSettings(allClosed);
                setSettingsBusy(true);
                try { await fetch(apiUrl("/api/recruitment/admin/settings"), { method: "PUT", headers, body: JSON.stringify({ openDomains: [] }) }); } finally { setSettingsBusy(false); }
              }}>Deselect All</button>
            </div>
          </div>
        )}

        {/* Evaluation Criteria */}
        <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
             <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>checklist</span>
             <h3 style={{ margin: 0 }}>Evaluation Criteria</h3>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.5rem" }}>
            {criteria.map(c => (
              <div key={c.id} style={{ 
                padding: "8px 16px", borderRadius: 12, background: "var(--surface)", 
                border: "1px solid var(--border-light)", fontSize: 13, display: "flex", alignItems: "center", gap: 8
              }}>
                <span style={{ fontWeight: 700 }}>{c.name}</span>
                <span style={{ color: "var(--text-tertiary)" }}>•</span>
                <span style={{ color: "var(--primary-green)", fontWeight: 800 }}>Max {c.max_score}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", background: "var(--surface-container-low)", padding: "1rem", borderRadius: 16 }}>
            <input className="input" style={{ flex: 2, minWidth: 200 }} placeholder="Criterion name (e.g. Communication)" value={newCriterionName} onChange={e => setNewCriterionName(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 100 }} type="number" placeholder="Max score" value={newCriterionMax} onChange={e => setNewCriterionMax(e.target.value)} />
            <button className="btn" style={{ gap: 8 }} disabled={criteriaBusy} onClick={addCriterion}>
              <span className="material-symbols-outlined">add</span>
              Add Criterion
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ gridColumn: "1 / -1", display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
             <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-tertiary)" }}>STATUS</label>
             <select className="input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Applications</option>
                <option value="pending">Pending</option>
                <option value="shortlisted">Shortlisted</option>
                <option value="selected">Selected</option>
                <option value="rejected">Rejected</option>
             </select>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
             <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-tertiary)" }}>DOMAIN</label>
             <select className="input" value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
                <option value="">All Domains</option>
                {ALL_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
             </select>
          </div>
          <div className="dashboard-card" style={{ padding: "0.5rem 1rem", flex: 2, minWidth: 300, display: "flex", alignItems: "center", gap: 12 }}>
             <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>auto_awesome</span>
             <span style={{ fontSize: 13, fontWeight: 600 }}>Auto-shortlist top</span>
             <input className="input" style={{ width: 60, padding: "4px 8px" }} type="number" value={bulkCount} onChange={e => setBulkCount(e.target.value)} />
             <span style={{ fontSize: 13, fontWeight: 600 }}>by score</span>
             <button className="btn outline" style={{ marginLeft: "auto", fontSize: 12, padding: "6px 12px" }} disabled={bulkBusy} onClick={bulkShortlist}>Run Process</button>
          </div>
        </div>

        {/* Applications table */}
        <div className="dashboard-card" style={{ gridColumn: "1 / -1", padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
             <h3 style={{ margin: 0, fontSize: "1rem" }}>Applicants ({applications.length})</h3>
             <button className="header-action-btn" onClick={loadApplications}><span className="material-symbols-outlined">refresh</span></button>
          </div>
          
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", background: "var(--surface)", borderBottom: "1px solid var(--border-light)" }}>
                  <th style={{ padding: "12px 1.5rem", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Candidate</th>
                  <th style={{ padding: "12px 1rem", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Year/Course</th>
                  <th style={{ padding: "12px 1rem", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Domain Choices</th>
                  <th style={{ padding: "12px 1rem", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "12px 1.5rem", width: 150 }}></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ padding: "4rem", textAlign: "center", color: "var(--text-tertiary)" }}>Loading applicants...</td></tr>
                ) : applications.length === 0 ? (
                  <tr><td colSpan={5} style={{ padding: "4rem", textAlign: "center", color: "var(--text-tertiary)" }}>No applications found.</td></tr>
                ) : applications.map(app => {
                  const sColor = getStatusColor(app.status);
                  return (
                    <tr key={app.id} style={{ borderBottom: "1px solid var(--border-light)", transition: "background 0.2s" }}>
                      <td style={{ padding: "1rem 1.5rem" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{app.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{app.email}</div>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ fontSize: 13 }}>Year {app.year}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{app.course}</div>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                           <span style={{ fontSize: 12, fontWeight: 600 }}>1. {app.primary_domain}</span>
                           {app.secondary_domain && <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>2. {app.secondary_domain}</span>}
                        </div>
                      </td>
                      <td style={{ padding: "1rem" }}>
                        <span style={{ 
                          fontSize: 10, fontWeight: 800, textTransform: "uppercase", padding: "4px 10px", borderRadius: 20,
                          background: sColor.bg, color: sColor.text, border: `1px solid ${sColor.text}33`
                        }}>{app.status}</span>
                      </td>
                      <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                           <button className="btn outline" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => openApplication(app)}>Review</button>
                           <select className="input" style={{ width: "auto", padding: "4px 8px", fontSize: 11 }} defaultValue="" onChange={e => { if (e.target.value) updateStatus(app.id, e.target.value); }}>
                             <option value="" disabled>Action</option>
                             <option value="shortlisted">Shortlist</option>
                             <option value="selected">Select</option>
                             <option value="rejected">Reject</option>
                             <option value="pending">Reset</option>
                           </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Evaluation Modal */}
      {selectedApp && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div onClick={() => setSelectedApp(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", maxWidth: 800, width: "100%", maxHeight: "90vh", overflow: "hidden", background: "var(--bg-card)", borderRadius: 24, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-lg)", display: "flex", flexDirection: "column" }}>
             <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                   <h3 style={{ margin: 0, fontWeight: 800 }}>{selectedApp.application.name}</h3>
                   <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Reviewing round 1 application</div>
                </div>
                <button onClick={() => setSelectedApp(null)} className="header-action-btn"><span className="material-symbols-outlined">close</span></button>
             </div>
             
             <div style={{ flex: 1, overflowY: "auto", padding: "1.5rem" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", marginBottom: "2rem" }}>
                   <div className="dashboard-card" style={{ padding: "1rem" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 8 }}>PRIMARY DOMAIN</div>
                      <div style={{ fontWeight: 600 }}>{selectedApp.application.primary_domain}</div>
                   </div>
                   <div className="dashboard-card" style={{ padding: "1rem" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 8 }}>SECONDARY DOMAIN</div>
                      <div style={{ fontWeight: 600 }}>{selectedApp.application.secondary_domain || "None"}</div>
                   </div>
                   <div className="dashboard-card" style={{ padding: "1rem" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", marginBottom: 8 }}>CONTACT</div>
                      <div style={{ fontSize: 13 }}>{selectedApp.application.email}</div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>{selectedApp.application.whatsapp_number}</div>
                   </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                   <section>
                      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Why join 180DC?</h4>
                      <div style={{ padding: "1rem", background: "var(--surface)", borderRadius: 12, fontSize: 14, lineHeight: 1.6 }}>{selectedApp.application.why_join}</div>
                   </section>
                   <section>
                      <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Why this domain?</h4>
                      <div style={{ padding: "1rem", background: "var(--surface)", borderRadius: 12, fontSize: 14, lineHeight: 1.6 }}>{selectedApp.application.why_domain}</div>
                   </section>
                   {selectedApp.application.prior_experience && (
                     <section>
                        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Prior Experience</h4>
                        <div style={{ padding: "1rem", background: "var(--surface)", borderRadius: 12, fontSize: 14, lineHeight: 1.6 }}>{selectedApp.application.prior_experience}</div>
                     </section>
                   )}
                    {selectedApp.application.portfolio_link && (() => {
                      const url = selectedApp.application.portfolio_link;
                      const isValid = typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"));
                      return (
                        <section>
                           <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Portfolio / External Links</h4>
                           {isValid ? (
                             <a href={url} target="_blank" rel="noreferrer" className="btn outline" style={{ gap: 8 }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                                View Portfolio
                             </a>
                           ) : (
                             <span className="btn outline" style={{ gap: 8, opacity: 0.5, cursor: "default", pointerEvents: "none" }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>open_in_new</span>
                                View Portfolio
                             </span>
                           )}
                        </section>
                      );
                    })()}
                </div>

                <div style={{ marginTop: "3rem", borderTop: "1px solid var(--border-light)", paddingTop: "2rem" }}>
                   <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.5rem" }}>
                      <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>grade</span>
                      <h3 style={{ margin: 0 }}>Evaluation Scoring</h3>
                   </div>
                   
                   <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      {criteria.map((c: any) => (
                        <div key={c.id} className="dashboard-card" style={{ padding: "1.25rem", background: "var(--surface-container-low)" }}>
                           <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                              <div>
                                 <div style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</div>
                                 <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>Max Score: {c.max_score}</div>
                              </div>
                              <input 
                                className="input" 
                                type="number" 
                                style={{ width: 80, textAlign: "center", fontSize: "1.1rem", fontWeight: 700 }} 
                                placeholder="0"
                                value={evalData[c.id] ?? ""}
                                onChange={e => setEvalData(prev => ({ ...prev, [c.id]: e.target.value }))}
                              />
                           </div>
                           <textarea 
                             className="input" 
                             placeholder="Internal notes/comments for this criterion..." 
                             rows={2} 
                             style={{ resize: "none", fontSize: 13 }}
                             value={evalComments[c.id] ?? ""}
                             onChange={e => setEvalComments(prev => ({ ...prev, [c.id]: e.target.value }))}
                           />
                           <button className="btn" style={{ marginTop: 12, fontSize: 12, padding: "6px 16px" }} onClick={() => saveEvaluation(c.id)}>Save Criterion</button>
                        </div>
                      ))}
                   </div>
                </div>
             </div>

             <div style={{ padding: "1.25rem 1.5rem", borderTop: "1px solid var(--border-light)", background: "var(--bg-card)", display: "flex", gap: 12 }}>
                <button className="btn" style={{ background: "#10b981" }} onClick={() => updateStatus(selectedApp.application.id, "shortlisted")}>Shortlist Candidate</button>
                <button className="btn outline" style={{ borderColor: "#ef4444", color: "#ef4444" }} onClick={() => updateStatus(selectedApp.application.id, "rejected")}>Reject</button>
                <button className="btn outline" style={{ marginLeft: "auto" }} onClick={() => setSelectedApp(null)}>Cancel</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruitmentsPanel;
