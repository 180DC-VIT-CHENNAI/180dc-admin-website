/* eslint-disable @typescript-eslint/no-explicit-any */
import AdminDataLoader from "./AdminDataLoader";
import { apiUrl } from "../../lib/api";

const EX_TITLES = [
  "x-chairperson",
  "x-vice_chairperson",
  "x-secretary",
  "x-co_secretary",
  "x-technical_director",
  "x-finance_director",
  "x-crm_director",
  "x-operations_director",
  "x-business_strategy_director",
  "x-marketing_director",
];

const maskToken = (token: string) =>
  token.length <= 8 ? `${token.slice(0, 3)}…` : `${token.slice(0, 6)}…${token.slice(-4)}`;

interface AdminConsoleProps {
  authToken: string;
  // Data for AdminDataLoader
  setAllUsers: React.Dispatch<React.SetStateAction<any[]>>;
  setAllRoles: React.Dispatch<React.SetStateAction<any[]>>;
  // Read-only data arrays
  allUsers: any[];
  allRoles: any[];
  departments: any[];
  roleTransfers: any[];
  pendingRequests: any[];
  setPendingRequests: React.Dispatch<React.SetStateAction<any[]>>;
  adminTokens: any[];
  setAdminTokens: React.Dispatch<React.SetStateAction<any[]>>;
  // Token Registry form
  tokenEmail: string;
  setTokenEmail: React.Dispatch<React.SetStateAction<string>>;
  tokenName: string;
  setTokenName: React.Dispatch<React.SetStateAction<string>>;
  tokenRoleId: string;
  setTokenRoleId: React.Dispatch<React.SetStateAction<string>>;
  tokenBusy: boolean;
  setTokenBusy: React.Dispatch<React.SetStateAction<boolean>>;
  recentToken: string | null;
  setRecentToken: React.Dispatch<React.SetStateAction<string | null>>;
  showRecentToken: boolean;
  setShowRecentToken: React.Dispatch<React.SetStateAction<boolean>>;
  // Board Member form
  boardEmail: string;
  setBoardEmail: React.Dispatch<React.SetStateAction<string>>;
  boardName: string;
  setBoardName: React.Dispatch<React.SetStateAction<string>>;
  boardRoleId: string;
  setBoardRoleId: React.Dispatch<React.SetStateAction<string>>;
  boardDepartmentId: string;
  setBoardDepartmentId: React.Dispatch<React.SetStateAction<string>>;
  boardBusy: boolean;
  setBoardBusy: React.Dispatch<React.SetStateAction<boolean>>;
  // Advisory Member form
  advisoryEmail: string;
  setAdvisoryEmail: React.Dispatch<React.SetStateAction<string>>;
  advisoryName: string;
  setAdvisoryName: React.Dispatch<React.SetStateAction<string>>;
  advisoryExTitle: string;
  setAdvisoryExTitle: React.Dispatch<React.SetStateAction<string>>;
  advisoryMemberDeptId: string;
  setAdvisoryMemberDeptId: React.Dispatch<React.SetStateAction<string>>;
  advisoryBusy: boolean;
  setAdvisoryBusy: React.Dispatch<React.SetStateAction<boolean>>;
  advisoryRecentToken: string | null;
  setAdvisoryRecentToken: React.Dispatch<React.SetStateAction<string | null>>;
  // Member form
  memberEmail: string;
  setMemberEmail: React.Dispatch<React.SetStateAction<string>>;
  memberName: string;
  setMemberName: React.Dispatch<React.SetStateAction<string>>;
  memberDepartmentId: string;
  setMemberDepartmentId: React.Dispatch<React.SetStateAction<string>>;
  memberBusy: boolean;
  setMemberBusy: React.Dispatch<React.SetStateAction<boolean>>;
  // Role Transfer form
  transferFromUserId: string;
  setTransferFromUserId: React.Dispatch<React.SetStateAction<string>>;
  transferToUserId: string;
  setTransferToUserId: React.Dispatch<React.SetStateAction<string>>;
  transferRoleId: string;
  setTransferRoleId: React.Dispatch<React.SetStateAction<string>>;
  transferBusy: boolean;
  setTransferBusy: React.Dispatch<React.SetStateAction<boolean>>;
  // Danger Zone - Role/Department
  dangerUserId: string;
  setDangerUserId: React.Dispatch<React.SetStateAction<string>>;
  dangerNewRoleId: string;
  setDangerNewRoleId: React.Dispatch<React.SetStateAction<string>>;
  dangerNewDeptId: string;
  setDangerNewDeptId: React.Dispatch<React.SetStateAction<string>>;
  dangerBusy: boolean;
  setDangerBusy: React.Dispatch<React.SetStateAction<boolean>>;
  // Danger Zone - Move to Advisory
  dangerAdvUserId: string;
  setDangerAdvUserId: React.Dispatch<React.SetStateAction<string>>;
  dangerAdvExTitle: string;
  setDangerAdvExTitle: React.Dispatch<React.SetStateAction<string>>;
  dangerAdvBusy: boolean;
  setDangerAdvBusy: React.Dispatch<React.SetStateAction<boolean>>;
  // Danger Zone - Revoke Access
  deleteUserId: string;
  setDeleteUserId: React.Dispatch<React.SetStateAction<string>>;
  deleteBusy: boolean;
  setDeleteBusy: React.Dispatch<React.SetStateAction<boolean>>;
  // System Configuration
  maintenanceMode: { enabled: boolean; message: string } | null;
  setMaintenanceMode: React.Dispatch<React.SetStateAction<{ enabled: boolean; message: string } | null>>;
  stats: { membersCount: number; projectsCount: number; upcomingMeetsCount: number; announcementsCount: number; todayEmailCount: number };
}

export default function AdminConsole({
  authToken,
  setAllUsers,
  setAllRoles,
  allUsers,
  allRoles,
  departments,
  roleTransfers,
  pendingRequests,
  setPendingRequests,
  adminTokens,
  setAdminTokens,
  tokenEmail,
  setTokenEmail,
  tokenName,
  setTokenName,
  tokenRoleId,
  setTokenRoleId,
  tokenBusy,
  setTokenBusy,
  recentToken,
  setRecentToken,
  showRecentToken,
  setShowRecentToken,
  boardEmail,
  setBoardEmail,
  boardName,
  setBoardName,
  boardRoleId,
  setBoardRoleId,
  boardDepartmentId,
  setBoardDepartmentId,
  boardBusy,
  setBoardBusy,
  advisoryEmail,
  setAdvisoryEmail,
  advisoryName,
  setAdvisoryName,
  advisoryExTitle,
  setAdvisoryExTitle,
  advisoryMemberDeptId,
  setAdvisoryMemberDeptId,
  advisoryBusy,
  setAdvisoryBusy,
  advisoryRecentToken,
  setAdvisoryRecentToken,
  memberEmail,
  setMemberEmail,
  memberName,
  setMemberName,
  memberDepartmentId,
  setMemberDepartmentId,
  memberBusy,
  setMemberBusy,
  transferFromUserId,
  setTransferFromUserId,
  transferToUserId,
  setTransferToUserId,
  transferRoleId,
  setTransferRoleId,
  transferBusy,
  setTransferBusy,
  dangerUserId,
  setDangerUserId,
  dangerNewRoleId,
  setDangerNewRoleId,
  dangerNewDeptId,
  setDangerNewDeptId,
  dangerBusy,
  setDangerBusy,
  dangerAdvUserId,
  setDangerAdvUserId,
  dangerAdvExTitle,
  setDangerAdvExTitle,
  dangerAdvBusy,
  setDangerAdvBusy,
  deleteUserId,
  setDeleteUserId,
  deleteBusy,
  setDeleteBusy,
  maintenanceMode,
  setMaintenanceMode,
  stats,
}: AdminConsoleProps) {
  return (
    <>
      <AdminDataLoader authToken={authToken} setAllUsers={setAllUsers} setAllRoles={setAllRoles} />
      <div className="members-grid">
        {renderSystemConfig()}
        {renderTokenRegistry()}
        {renderCreateAccounts()}
        {renderSignupRequests()}
        {renderRoleTransfers()}
        {renderDangerZone()}
      </div>
    </>
  );

  function renderSystemConfig() {
    return (
      <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
        <div className="section-header">
           <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>settings_suggest</span>
           <h3>System Configuration</h3>
        </div>
        <div className="admin-grid-3">
          <div className="admin-sub-card">
             <div className="admin-sub-label">Role Power Levels</div>
             <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {allRoles.map(r => (
                  <div key={r.id} className="admin-role-row">
                     <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                     <span className="admin-power-badge">{r.power_level}</span>
                  </div>
                ))}
             </div>
          </div>
          <div className="admin-sub-card">
             <div className="admin-sub-label">Daily Email Quota</div>
             <div style={{ flex: 1 }}>
                <div className="admin-progress-bar">
                   <div className="admin-progress-fill" style={{ width: `${Math.min(stats.todayEmailCount, 100)}%`, background: stats.todayEmailCount > 90 ? "#ef4444" : "var(--primary-green)" }} />
                </div>
                <div className="admin-progress-text">{stats.todayEmailCount} / 100 Sent Today</div>
             </div>
          </div>
          <div className="admin-sub-card">
             <div className="admin-sub-label">Maintenance Mode</div>
             <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                   <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      {maintenanceMode?.enabled ? "Active — members blocked" : "Disabled"}
                   </span>
                   <span style={{
                     width: 10, height: 10, borderRadius: "50%",
                     background: maintenanceMode?.enabled ? "#ef4444" : "var(--primary-green)",
                     display: "inline-block",
                   }} />
                </div>
                <button
                  className="btn outline"
                  style={{ padding: "6px 12px", fontSize: 12 }}
                  onClick={async () => {
                    const enable = !maintenanceMode?.enabled;
                    const msg = enable ? (prompt("Maintenance message (optional):") || "").trim() : "";
                    const res = await fetch(apiUrl("/api/admin/maintenance"), {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                      body: JSON.stringify({ enabled: enable, message: msg || undefined }),
                    });
                    const data = await res.json();
                    if (data.success) {
                      setMaintenanceMode({ enabled: data.enabled, message: data.message });
                    } else {
                      alert(data.error || "Failed to toggle maintenance mode");
                    }
                  }}
                >
                  {maintenanceMode?.enabled ? "Disable" : "Enable"}
                </button>
             </div>
          </div>
        </div>
      </div>
    );
  }

  function renderTokenRegistry() {
    return (
      <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
        <div className="section-header">
          <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>key</span>
          <h3>Admin Token Registry</h3>
        </div>
        <p className="card-subtext">
          Generate tokens for members, leads, or board accounts.
        </p>
        <div className="admin-grid-4" style={{ marginTop: 16 }}>
          <input className="input" placeholder="Email" value={tokenEmail} onChange={(e) => setTokenEmail(e.target.value)} />
          <input className="input" placeholder="Name" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
          <select className="input" value={tokenRoleId} onChange={(e) => setTokenRoleId(e.target.value)}>
            <option value="member">member</option>
            <option value="secretary">secretary</option>
            <option value="co_secretary">co_secretary</option>
            <option value="vice_chairperson">vice_chairperson</option>
            <option value="chairperson">chairperson</option>
          </select>
          <button className="btn" disabled={tokenBusy} onClick={async () => {
            if (!authToken || !tokenEmail.trim()) { alert("Enter an email first"); return; }
            setTokenBusy(true);
            try {
              const res = await fetch(apiUrl("/api/admin-tokens"), {
                method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ email: tokenEmail.trim(), name: tokenName.trim(), roleId: tokenRoleId }),
              });
              const data = await res.json();
              if (data.success) {
                setAdminTokens((prev) => [data, ...prev]);
                setTokenEmail(""); setTokenName(""); setTokenRoleId("member");
                setRecentToken(data.token); setShowRecentToken(false);
              } else alert(data.error);
            } finally { setTokenBusy(false); }
          }}>{tokenBusy ? "Creating..." : "Create Token"}</button>
        </div>

        {recentToken && (
            <div className="admin-recent-token">
              <span>Latest token: {showRecentToken ? recentToken : maskToken(recentToken)}</span>
              <button className="btn outline" style={{ padding: "6px 12px" }} onClick={async () => { await navigator.clipboard.writeText(recentToken); alert("Token copied"); }}>Copy</button>
              <button className="btn outline" style={{ padding: "6px 12px" }} onClick={() => setShowRecentToken((v) => !v)}>{showRecentToken ? "Hide" : "Reveal"}</button>
            </div>
          )}

          <div className="admin-token-list">
            {adminTokens.length === 0 && <p className="empty-text">No tokens created yet.</p>}
            {adminTokens.map((item) => (
              <div key={item.token} className="admin-token-row">
                <div className="admin-token-info">
                  <strong>{item.name || item.email}</strong>
                  <div className="admin-token-meta">{item.email} · {item.role_id}</div>
                  <div className="admin-token-preview">{item.tokenPreview || item.token}</div>
                </div>
                <button className="header-action-btn admin-delete-btn" onClick={async () => {
                  if (!confirm("Delete this token permanently?")) return;
                  const res = await fetch(apiUrl(`/api/admin-tokens/${item.email}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                  const data = await res.json();
                  if (data.success) setAdminTokens((prev) => prev.filter((t) => t.email !== item.email));
                }}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))}
          </div>
        </div>
    );
  }

  function renderCreateAccounts() {
    return (
      <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
        <div className="section-header">
          <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>person_add</span>
          <h3>Create Accounts</h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
          <div>
            <h4 className="admin-form-section-title">Board / Director Member</h4>
            <div className="admin-grid-4" style={{ marginTop: 12 }}>
              <input className="input" placeholder="Email" value={boardEmail} onChange={(e) => setBoardEmail(e.target.value)} />
              <input className="input" placeholder="Name" value={boardName} onChange={(e) => setBoardName(e.target.value)} />
              <select className="input" value={boardRoleId} onChange={(e) => setBoardRoleId(e.target.value)}>
                <option value="chairperson">Chairperson</option>
                <option value="vice_chairperson">Vice Chairperson</option>
                <option value="secretary">Secretary</option>
                <option value="co_secretary">Co-Secretary</option>
                <option value="technical_director">Technical Director</option>
                <option value="finance_director">Finance Director</option>
                <option value="crm_director">Client Relationship Director</option>
                <option value="operations_director">Operations Director</option>
                <option value="business_strategy_director">Business Strategy Director</option>
                <option value="marketing_director">Marketing Director</option>
              </select>
              <select className="input" value={boardDepartmentId} onChange={(e) => setBoardDepartmentId(e.target.value)}>
                <option value="">No department</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="btn" disabled={boardBusy} style={{ gridColumn: "1 / -1" }} onClick={async () => {
                if (!authToken || !boardEmail.trim()) { alert("Enter an email first"); return; }
                setBoardBusy(true);
                try {
                  const res = await fetch(apiUrl("/api/board-users"), {
                    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ email: boardEmail.trim(), name: boardName.trim(), roleId: boardRoleId, departmentId: boardDepartmentId || null }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setAdminTokens((prev) => [data, ...prev]);
                    setBoardEmail(""); setBoardName(""); setBoardRoleId("chairperson"); setBoardDepartmentId("");
                    setRecentToken(data.token); setShowRecentToken(false);
                    alert(`Board user created successfully.`);
                  } else alert(data.error);
                } finally { setBoardBusy(false); }
              }}>{boardBusy ? "Creating..." : "Create Board User"}</button>
            </div>
          </div>

          <div className="admin-form-divider" />

          <div>
            <h4 className="admin-form-section-title">Advisory Board Member</h4>
            <div className="admin-grid-4" style={{ marginTop: 12 }}>
              <input className="input" placeholder="Email" value={advisoryEmail} onChange={(e) => setAdvisoryEmail(e.target.value)} />
              <input className="input" placeholder="Name" value={advisoryName} onChange={(e) => setAdvisoryName(e.target.value)} />
              <select className="input" value={advisoryExTitle} onChange={(e) => setAdvisoryExTitle(e.target.value)}>
                <option value="">No ex-title</option>
                {EX_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select className="input" value={advisoryMemberDeptId} onChange={(e) => setAdvisoryMemberDeptId(e.target.value)}>
                <option value="">Not a club member</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name} (as member)</option>)}
              </select>
              <button className="btn" disabled={advisoryBusy} style={{ gridColumn: "1 / -1" }} onClick={async () => {
                if (!authToken || !advisoryEmail.trim()) { alert("Enter an email first"); return; }
                setAdvisoryBusy(true);
                try {
                  const res = await fetch(apiUrl("/api/advisory-members"), {
                    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({
                      email: advisoryEmail.trim(),
                      name: advisoryName.trim(),
                      exTitle: advisoryExTitle || null,
                      memberDeptId: advisoryMemberDeptId || null,
                    }),
                  });
                  const data = await res.json();
                  if (data.success) {
                    setAdminTokens((prev) => [data, ...prev]);
                    setAdvisoryEmail(""); setAdvisoryName(""); setAdvisoryExTitle(""); setAdvisoryMemberDeptId("");
                    setAdvisoryRecentToken(data.token);
                    alert(`Advisory member created successfully.`);
                  } else alert(data.error);
                } finally { setAdvisoryBusy(false); }
              }}>{advisoryBusy ? "Creating..." : "Create Advisory Member"}</button>
            </div>
            {advisoryRecentToken && (
              <div className="admin-recent-token" style={{ marginTop: 12 }}>
                <span>Advisory token: {maskToken(advisoryRecentToken)}</span>
                <button className="btn outline" style={{ padding: "6px 12px" }} onClick={async () => { await navigator.clipboard.writeText(advisoryRecentToken); alert("Token copied"); }}>Copy</button>
              </div>
            )}
          </div>

          <div className="admin-form-divider" />

          <div>
            <h4 className="admin-form-section-title">Member</h4>
            <div className="admin-grid-4" style={{ marginTop: 12 }}>
              <input className="input" placeholder="Email" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
              <input className="input" placeholder="Name" value={memberName} onChange={(e) => setMemberName(e.target.value)} />
              <select className="input" value={memberDepartmentId} onChange={(e) => setMemberDepartmentId(e.target.value)}>
                <option value="">No department</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="btn" disabled={memberBusy} onClick={async () => {
                if (!authToken || !memberEmail.trim()) { alert("Enter an email first"); return; }
                setMemberBusy(true);
                try {
                  const res = await fetch(apiUrl("/api/members"), {
                    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ email: memberEmail.trim(), name: memberName.trim() || memberEmail.trim().split("@")[0], departmentId: memberDepartmentId || null }),
                  });
                  const data = await res.json();
                  if (data.success) { setMemberEmail(""); setMemberName(""); setMemberDepartmentId(""); setRecentToken(data.token); setShowRecentToken(false); alert("Member created successfully."); }
                  else alert(data.error);
                } finally { setMemberBusy(false); }
              }}>{memberBusy ? "Creating..." : "Create Member"}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSignupRequests() {
    return (
      <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
        <div className="section-header">
           <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>person_check</span>
           <h3>Pending Signup Requests</h3>
        </div>
        {pendingRequests.length === 0 ? <p className="empty-text">No pending requests.</p> : (
          <div style={{ display: "grid", gap: 10 }}>
            {pendingRequests.map((r) => (
              <div key={r.id} className="admin-pending-row">
                <div>
                  <strong>{r.name}</strong>
                  <div className="admin-token-meta">{r.email}</div>
                  {r.department_id && (
                    <div className="admin-dept-badge">
                      {departments.find((d: any) => d.id === r.department_id)?.name || r.department_id}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn" style={{ padding: "6px 12px" }} onClick={async () => {
                    const res = await fetch(apiUrl(`/api/signup-requests/${r.id}/approve`), {
                      method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                    });
                    const data = await res.json();
                    if (data.success && data.token) alert(`User approved!`);
                    setPendingRequests(pendingRequests.filter((p) => p.id !== r.id));
                  }}>Approve</button>
                  <button className="btn outline reject-btn" onClick={async () => {
                    await fetch(apiUrl(`/api/signup-requests/${r.id}/reject`), {
                      method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                    });
                    setPendingRequests(pendingRequests.filter((p) => p.id !== r.id));
                  }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderRoleTransfers() {
    return (
      <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
        <div className="section-header">
           <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>swap_horiz</span>
           <h3>Initiate Role Transfer</h3>
        </div>
        <p className="card-subtext">
          Initiate a formal role transfer between members. Requires approval from the recipient.
        </p>
        <div className="admin-grid-4">
          <select className="input" value={transferFromUserId} onChange={(e) => setTransferFromUserId(e.target.value)}>
            <option value="">Transfer from...</option>
            {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role_name})</option>)}
          </select>
          <select className="input" value={transferToUserId} onChange={(e) => setTransferToUserId(e.target.value)}>
            <option value="">Transfer to...</option>
            {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className="input" value={transferRoleId} onChange={(e) => setTransferRoleId(e.target.value)}>
            <option value="">Select target role...</option>
            {allRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <button className="btn" disabled={transferBusy} onClick={async () => {
            if (!transferFromUserId || !transferToUserId || !transferRoleId) return alert("All fields required");
            setTransferBusy(true);
            try {
              const res = await fetch(apiUrl("/api/role-transfers"), {
                method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ fromUserId: transferFromUserId, toUserId: transferToUserId, roleId: transferRoleId }),
              });
              const data = await res.json();
              if (data.success) { alert("Transfer request initiated."); setTransferFromUserId(""); setTransferToUserId(""); setTransferRoleId(""); }
              else alert(data.error);
            } finally { setTransferBusy(false); }
          }}>Initiate</button>
        </div>

        {roleTransfers.length > 0 && (
          <div className="admin-transfer-section">
             <div className="admin-sub-label">Pending Transfers</div>
             {roleTransfers.map((rt: any) => (
               <div key={rt.id} className="admin-transfer-row">
                  <div className="admin-transfer-users">
                     <span>{rt.from_name}</span>
                     <span className="material-symbols-outlined" style={{ fontSize: 16, color: "var(--text-tertiary)" }}>arrow_forward</span>
                     <span>{rt.to_name}</span>
                     <span className="admin-transfer-role">Role: {rt.role_name}</span>
                  </div>
                  <span className="admin-status-pending">PENDING</span>
               </div>
             ))}
          </div>
        )}
      </div>
    );
  }

  function renderDangerZone() {
    return (
      <div className="dashboard-card" style={{ gridColumn: "1 / -1", borderColor: "#ef4444" }}>
        <div className="section-header">
           <span className="material-symbols-outlined" style={{ color: "#ef4444" }}>warning</span>
           <h3 style={{ color: "#ef4444" }}>Danger Zone</h3>
        </div>
        <div className="admin-grid-2">
          <div className="admin-sub-card">
            <h4 className="admin-form-section-title" style={{ marginBottom: 12 }}>Change Role / Department</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <select className="input" value={dangerUserId} onChange={(e) => setDangerUserId(e.target.value)}>
                <option value="">Select member...</option>
                {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
              <select className="input" value={dangerNewRoleId} onChange={(e) => setDangerNewRoleId(e.target.value)}>
                <option value="">New role...</option>
                {allRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <select className="input" value={dangerNewDeptId} onChange={(e) => setDangerNewDeptId(e.target.value)}>
                <option value="">Assign Department...</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <button className="btn danger-btn" disabled={dangerBusy} onClick={async () => {
                if (!dangerUserId || !dangerNewRoleId) return;
                setDangerBusy(true);
                try {
                  const res = await fetch(apiUrl(`/api/members/${dangerUserId}/role`), {
                    method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                    body: JSON.stringify({ newRoleId: dangerNewRoleId, departmentId: dangerNewDeptId || null }),
                  });
                  const data = await res.json();
                  if (data.success) { alert("Access updated."); setDangerUserId(""); setDangerNewRoleId(""); setDangerNewDeptId(""); }
                  else alert(data.error);
                } finally { setDangerBusy(false); }
              }}>Apply Changes</button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div className="admin-sub-card">
              <h4 className="admin-form-section-title" style={{ marginBottom: 12 }}>Move to Advisory Board</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <select className="input" value={dangerAdvUserId} onChange={(e) => setDangerAdvUserId(e.target.value)}>
                  <option value="">Select member...</option>
                  {allUsers.filter(u => u.role_id !== 'advisory').map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <select className="input" value={dangerAdvExTitle} onChange={(e) => setDangerAdvExTitle(e.target.value)}>
                  <option value="">Select Ex-Title...</option>
                  {EX_TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button className="btn outline danger-outline-btn" disabled={dangerAdvBusy} onClick={async () => {
                  if (!dangerAdvUserId || !dangerAdvExTitle) return alert("Select member and title");
                  if (!confirm("Move this member to Advisory Board?")) return;
                  setDangerAdvBusy(true);
                  try {
                    const res = await fetch(apiUrl(`/api/members/${dangerAdvUserId}/role`), {
                      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                      body: JSON.stringify({ newRoleId: "advisory", exTitle: dangerAdvExTitle }),
                    });
                    const data = await res.json();
                    if (data.success) { alert("Moved to Advisory Board."); setDangerAdvUserId(""); setDangerAdvExTitle(""); }
                    else alert(data.error);
                  } finally { setDangerAdvBusy(false); }
                }}>Move to Advisory</button>
              </div>
            </div>

            <div className="admin-sub-card">
              <h4 className="admin-form-section-title" style={{ marginBottom: 12 }}>Revoke Access</h4>
              <div style={{ display: "flex", gap: 10 }}>
                <select className="input" value={deleteUserId} onChange={(e) => setDeleteUserId(e.target.value)}>
                  <option value="">Select member...</option>
                  {allUsers.filter((u: any) => u.power_level < 100).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <button className="btn danger-btn" disabled={deleteBusy} onClick={async () => {
                  if (!deleteUserId || !confirm("Delete user account permanently?")) return;
                  setDeleteBusy(true);
                  try {
                    const res = await fetch(apiUrl(`/api/members/${deleteUserId}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                    const data = await res.json();
                    if (data.success) { alert("Account deleted."); setDeleteUserId(""); }
                    else alert(data.error);
                  } finally { setDeleteBusy(false); }
                }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
