import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

interface Props {
  authToken: string;
  powerLevel?: number;
}

const ALL_DOMAINS = ["Technical", "Research & Development", "Marketing", "Social Media", "Finance", "Events and Initiatives", "Client Partner Sponsor", "Human Resources"];

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

  return (
    <div>
      <header style={{ borderBottom: "1px solid var(--border-light)", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
        <h2 style={{ margin: 0 }}>Recruitments</h2>
        <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
          Manage applications, evaluate candidates, and shortlist
        </p>
      </header>

      <div className="members-grid">
        {/* Domain Settings (President/VP only) */}
        {isBoard && (
          <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
            <h3>Recruitment Settings</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
              Toggle which domains are open for applications. Only domains marked as open will appear on the application form.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
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
                  className="btn"
                  style={{
                    padding: "0.4rem 1rem", fontSize: 13,
                    background: ds.is_open ? "var(--primary-green)" : "var(--bg-secondary)",
                    color: ds.is_open ? "#fff" : "var(--text-secondary)",
                    border: ds.is_open ? "none" : "1px solid var(--border-light)",
                  }}
                >
                  {ds.is_open ? "✓ " : "✕ "}{ds.domain_name}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn outline" style={{ fontSize: 13, padding: "0.4rem 1rem" }} disabled={settingsBusy} onClick={async () => {
                const allOpen = domainSettings.map((d: any) => ({ ...d, is_open: 1 }));
                setDomainSettings(allOpen);
                setSettingsBusy(true);
                try {
                  await fetch(apiUrl("/api/recruitment/admin/settings"), {
                    method: "PUT", headers,
                    body: JSON.stringify({ openDomains: ALL_DOMAINS }),
                  });
                } finally { setSettingsBusy(false); }
              }}>Select All</button>
              <button className="btn outline" style={{ fontSize: 13, padding: "0.4rem 1rem" }} disabled={settingsBusy} onClick={async () => {
                const allClosed = domainSettings.map((d: any) => ({ ...d, is_open: 0 }));
                setDomainSettings(allClosed);
                setSettingsBusy(true);
                try {
                  await fetch(apiUrl("/api/recruitment/admin/settings"), {
                    method: "PUT", headers,
                    body: JSON.stringify({ openDomains: [] }),
                  });
                } finally { setSettingsBusy(false); }
              }}>Deselect All</button>
            </div>
          </div>
        )}

        {/* Evaluation Criteria */}
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Evaluation Criteria</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Define the criteria for evaluating round 1 applications.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {criteria.map(c => (
              <span key={c.id} className="floating-note" style={{ fontSize: 13, padding: "0.3rem 0.8rem", transform: "none" }}>
                {c.name} (max {c.max_score})
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 150 }} placeholder="Criterion name (e.g. Communication)" value={newCriterionName} onChange={e => setNewCriterionName(e.target.value)} />
            <input className="input" style={{ width: 100 }} type="number" placeholder="Max score" value={newCriterionMax} onChange={e => setNewCriterionMax(e.target.value)} />
            <button className="btn" style={{ padding: "0.5rem 1rem" }} disabled={criteriaBusy} onClick={addCriterion}>{criteriaBusy ? "Adding..." : "Add Criterion"}</button>
          </div>
        </div>

        {/* Filters */}
        <div className="card-doodle" style={{ gridColumn: "1 / -1", padding: "1rem 1.5rem", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <strong style={{ fontSize: 14 }}>Filters:</strong>
          <select className="input" style={{ width: "auto", minWidth: 140 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="shortlisted">Shortlisted</option>
            <option value="selected">Selected</option>
            <option value="rejected">Rejected</option>
          </select>
          <select className="input" style={{ width: "auto", minWidth: 140 }} value={domainFilter} onChange={e => setDomainFilter(e.target.value)}>
            <option value="">All Domains</option>
            {ALL_DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 13 }}>Auto-shortlist top</span>
            <input className="input" style={{ width: 60 }} type="number" value={bulkCount} onChange={e => setBulkCount(e.target.value)} />
            <button className="btn outline" style={{ padding: "0.4rem 0.8rem", fontSize: 13 }} disabled={bulkBusy} onClick={bulkShortlist}>
              {bulkBusy ? "..." : "Shortlist"}
            </button>
          </div>
        </div>

        {/* Applications table */}
        <div className="card-doodle" style={{ gridColumn: "1 / -1", overflowX: "auto" }}>
          <h3>Applications ({applications.length})</h3>
          {loading ? <p style={{ color: "var(--text-secondary)" }}>Loading...</p> : applications.length === 0 ? (
            <p style={{ color: "var(--text-secondary)" }}>No applications match the filters.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--border-light)", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Name</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Email</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Year</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Domain (P/S)</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Status</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {applications.map(app => (
                  <tr key={app.id} style={{ borderBottom: "1px solid var(--border-light)", verticalAlign: "top" }}>
                    <td style={{ padding: "0.5rem 0.75rem", fontWeight: 600 }}>{app.name}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "var(--text-secondary)" }}>{app.email}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>{app.year}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <div>{app.primary_domain}</div>
                      {app.secondary_domain && <div style={{ fontSize: 11, color: "var(--text-light)" }}>+ {app.secondary_domain}</div>}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <span className={`floating-note`} style={{
                        fontSize: 11, padding: "0.15rem 0.5rem", transform: "none",
                        background: app.status === "shortlisted" ? "#d4edda" : app.status === "rejected" ? "#f8d7da" : app.status === "selected" ? "#cce5ff" : "#fff",
                      }}>
                        {app.status}
                      </span>
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <div style={{ display: "flex", gap: 4, flexDirection: "column" }}>
                        <button className="btn outline" style={{ padding: "0.2rem 0.6rem", fontSize: 11 }} onClick={() => openApplication(app)}>Evaluate</button>
                        <select className="input" style={{ padding: "0.2rem 0.4rem", fontSize: 11, width: "auto" }} defaultValue="" onChange={e => { if (e.target.value) updateStatus(app.id, e.target.value); }}>
                          <option value="" disabled>Set status</option>
                          <option value="shortlisted">Shortlist</option>
                          <option value="selected">Select</option>
                          <option value="rejected">Reject</option>
                          <option value="pending">Reset to Pending</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Evaluation Modal */}
      {selectedApp && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
          display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem",
        }} onClick={() => setSelectedApp(null)}>
          <div className="card-doodle" style={{
            maxWidth: 700, width: "100%", maxHeight: "90vh", overflowY: "auto",
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0 }}>{selectedApp.application.name}</h3>
                <p style={{ margin: "0.25rem 0 0", color: "var(--text-secondary)", fontSize: 14 }}>
                  {selectedApp.application.email} · {selectedApp.application.year} · {selectedApp.application.course}
                </p>
              </div>
              <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13 }} onClick={() => setSelectedApp(null)}>Close</button>
            </div>

            <div style={{ display: "grid", gap: 8, marginBottom: 16, fontSize: 14 }}>
              <div><strong>Primary Domain:</strong> {selectedApp.application.primary_domain}</div>
              {selectedApp.application.secondary_domain && <div><strong>Secondary Domain:</strong> {selectedApp.application.secondary_domain}</div>}
              <div><strong>Why join 180DC:</strong> {selectedApp.application.why_join}</div>
              <div><strong>Why this domain:</strong> {selectedApp.application.why_domain}</div>
              {selectedApp.application.prior_experience && <div><strong>Prior Experience:</strong> {selectedApp.application.prior_experience}</div>}
              {selectedApp.application.portfolio_link && <div><strong>Portfolio:</strong> <a href={selectedApp.application.portfolio_link} target="_blank">{selectedApp.application.portfolio_link}</a></div>}
              <div><strong>Current Status:</strong> {selectedApp.application.status}</div>
            </div>

            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 16 }}>
              <h4 style={{ margin: "0 0 12px" }}>Evaluation Scores</h4>
              {selectedApp.criteria.length === 0 ? (
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>No criteria defined yet. Add criteria above.</p>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {selectedApp.criteria.map((c: any) => (
                    <div key={c.id} className="card-doodle" style={{ padding: "0.8rem 1rem", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ flex: 1, minWidth: 120 }}>
                        <strong style={{ fontSize: 13 }}>{c.name}</strong>
                        <span style={{ fontSize: 11, color: "var(--text-light)", marginLeft: 4 }}>max {c.max_score}</span>
                      </div>
                      <input
                        className="input"
                        style={{ width: 80, padding: "0.4rem 0.6rem", fontSize: 13 }}
                        type="number"
                        step="0.5"
                        min="0"
                        max={c.max_score}
                        placeholder="Score"
                        value={evalData[c.id] ?? ""}
                        onChange={e => setEvalData(prev => ({ ...prev, [c.id]: e.target.value }))}
                      />
                      <input
                        className="input"
                        style={{ flex: 1, minWidth: 120, padding: "0.4rem 0.6rem", fontSize: 13 }}
                        placeholder="Comment (optional)"
                        value={evalComments[c.id] ?? ""}
                        onChange={e => setEvalComments(prev => ({ ...prev, [c.id]: e.target.value }))}
                      />
                      <button className="btn" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={() => saveEvaluation(c.id)}>Save</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 16, marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="btn" style={{ padding: "0.4rem 1rem", fontSize: 13, background: "#28a745" }} onClick={() => updateStatus(selectedApp.application.id, "shortlisted")}>Shortlist</button>
              <button className="btn" style={{ padding: "0.4rem 1rem", fontSize: 13, background: "#007bff" }} onClick={() => updateStatus(selectedApp.application.id, "selected")}>Select</button>
              <button className="btn outline" style={{ padding: "0.4rem 1rem", fontSize: 13, borderColor: "#e74c3c", color: "#e74c3c" }} onClick={() => updateStatus(selectedApp.application.id, "rejected")}>Reject</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RecruitmentsPanel;
