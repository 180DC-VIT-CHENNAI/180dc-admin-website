/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import MembersLogin from "./MembersLogin";
import DepartmentPanel from "./DepartmentPanel";
import RecruitmentsPanel from "./RecruitmentsPanel";
import ProfileSection from "./ProfileSection";
import { apiUrl } from "../../lib/api";
import "./MembersLayout.css";

const DEPT_NAMES: Record<string, string> = {
  tech: "Technical",
  rnd: "Research & Development",
  marketing: "Marketing",
  social_media: "Social Media",
  finance: "Finance",
  legal: "Legal",
  hr: "Human Resources",
};

export default function MembersLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() => sessionStorage.getItem("authToken"));
  const [email, setEmail] = useState<string | null>(sessionStorage.getItem("authEmail"));
  const [powerLevel, setPowerLevel] = useState<number>(() => {
    const stored = sessionStorage.getItem("authPowerLevel");
    return stored ? parseInt(stored, 10) : 0;
  });
  const [departmentId, setDepartmentId] = useState<string | null>(sessionStorage.getItem("authDepartmentId"));
  const [activePanel, setActivePanel] = useState("dashboard");
  const [activeDeptId, setActiveDeptId] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [adminTokens, setAdminTokens] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [tokenEmail, setTokenEmail] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenRoleId, setTokenRoleId] = useState("member");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [boardEmail, setBoardEmail] = useState("");
  const [boardName, setBoardName] = useState("");
  const [boardRoleId, setBoardRoleId] = useState("president");
  const [boardDepartmentId, setBoardDepartmentId] = useState("");
  const [boardBusy, setBoardBusy] = useState(false);
  const [recentToken, setRecentToken] = useState<string | null>(null);
  const [showRecentToken, setShowRecentToken] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberDepartmentId, setMemberDepartmentId] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [departments, setDepartments] = useState<any[]>([]);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const [annBusy, setAnnBusy] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [roleTransfers, setRoleTransfers] = useState<any[]>([]);
  const [dangerUserId, setDangerUserId] = useState("");
  const [dangerNewRoleId, setDangerNewRoleId] = useState("");
  const [dangerNewDeptId, setDangerNewDeptId] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [transferFromUserId, setTransferFromUserId] = useState("");
  const [transferToUserId, setTransferToUserId] = useState("");
  const [transferRoleId, setTransferRoleId] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  const maskToken = (token: string) =>
    token.length <= 12 ? token : `${token.slice(0, 6)}…${token.slice(-4)}`;

  const handleLogin = (
    token: string,
    userEmail: string,
    serverPowerLevel?: number,
    serverDepartmentId?: string,
  ) => {
    sessionStorage.setItem("authToken", token);
    sessionStorage.setItem("authEmail", userEmail);
    sessionStorage.setItem("authPowerLevel", String(serverPowerLevel ?? 10));
    if (serverDepartmentId) sessionStorage.setItem("authDepartmentId", serverDepartmentId);
    setAuthToken(token);
    setEmail(userEmail);
    setPowerLevel(serverPowerLevel ?? 10);
    if (serverDepartmentId) setDepartmentId(serverDepartmentId);
  };

  useEffect(() => {
    async function loadDashboard() {
      if (!authToken) return;
      try {
        const res = await fetch(apiUrl("/api/dashboard"), {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        const data = await res.json();
        if (data.success) {
          setEmail(data.user?.email || email);
          setPowerLevel(data.user?.powerLevel ?? powerLevel);
          if (data.user?.departmentId) setDepartmentId(data.user.departmentId);
          setPendingRequests(data.pendingRequests || []);
          setAdminTokens(data.adminTokens || []);
          setAnnouncements(data.announcements || []);
          setRoleTransfers(data.roleTransfers || []);
          if (data.departments) setDepartments(data.departments);
          setDashboardReady(true);
        } else {
          sessionStorage.clear();
          setAuthToken(null);
        }
      } catch {
        sessionStorage.clear();
        setAuthToken(null);
      }
    }
    loadDashboard();
  }, [authToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasDepartment = departmentId && DEPT_NAMES[departmentId];
  const deptName = hasDepartment ? DEPT_NAMES[departmentId!] : "";

  type NavItem = { id: string; label: string; minPower: number; deptId?: string };
  const baseNav: NavItem[] = [
    { id: "dashboard", label: "Dashboard", minPower: 0 },
    { id: "profile", label: "Profile", minPower: 0 },
    { id: "meets", label: "Meets", minPower: 0 },
    { id: "projects", label: "Projects", minPower: 0 },
    { id: "instructions", label: "Instructions", minPower: 0 },
    { id: "recruitments", label: "Recruitments", minPower: 50 },
    { id: "transfers", label: "Transfers", minPower: 0 },
    { id: "announcements", label: "Announcements", minPower: 0 },
    { id: "admin", label: "Admin Console", minPower: 100 },
  ];
  if (powerLevel >= 100) {
    const deptLinks = departments.map((d: any) => ({
      id: `dept-${d.id}`, label: `${d.name} Dept`, minPower: 0, deptId: d.id,
    }));
    baseNav.splice(1, 0, ...deptLinks);
  } else if (hasDepartment && powerLevel >= 50) {
    baseNav.splice(1, 0, { id: "department", label: deptName, minPower: 0 });
  }
  const visibleNav = baseNav.filter((n) => powerLevel >= n.minPower);

  if (!authToken) return <MembersLogin onLogin={handleLogin} />;
  if (!dashboardReady) {
    return (
      <div style={{ backgroundColor: "var(--bg-primary)", minHeight: "100vh", width: "100%" }}>
        <div className="container" style={{ padding: "4rem 0" }}>
          <div className="card-doodle">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="members-layout">
      {/* SIDEBAR OVERLAY */}
      {sidebarOpen && <div className="members-sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* SIDEBAR */}
      <div className={`members-sidebar ${sidebarOpen ? "open" : ""}`}>
        <button className="mobile-sidebar-close" onClick={() => setSidebarOpen(false)}>✕</button>
        <div style={{ padding: "1.5rem 1rem", borderBottom: "1px solid var(--border-light)" }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>180DC Portal</h2>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{email}</div>
          <div style={{ fontSize: 12, color: "var(--primary-green)", marginTop: 2 }}>Power: {powerLevel}</div>
        </div>
        <nav style={{ flex: 1, minHeight: 0, padding: "0.75rem 0", display: "flex", flexDirection: "column", gap: 2, overflowY: "auto" }}>
          {visibleNav.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.deptId) { setActiveDeptId(item.deptId); setActivePanel("department"); }
                else setActivePanel(item.id);
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "0.7rem 1.2rem", border: "none",
                background: (item.deptId ? (activePanel === "department" && activeDeptId === item.deptId) : activePanel === item.id)
                  ? "var(--primary-green)" : "transparent",
                color: (item.deptId ? (activePanel === "department" && activeDeptId === item.deptId) : activePanel === item.id)
                  ? "#fff" : "var(--text-primary)", cursor: "pointer",
                fontSize: 14, fontWeight: (item.deptId ? (activePanel === "department" && activeDeptId === item.deptId) : activePanel === item.id) ? 600 : 400, textAlign: "left", width: "100%",
                borderRadius: 0, transition: "background 0.15s",
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding: "1rem", borderTop: "1px solid var(--border-light)" }}>
          <button
            onClick={() => { sessionStorage.clear(); setAuthToken(null); }}
            style={{
              display: "flex", alignItems: "center", gap: 8, padding: "0.5rem 1rem", border: "1px solid var(--border-light)",
              background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, width: "100%",
              borderRadius: 6,
            }}
          >
            Logout
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="members-main">
        <button className="mobile-sidebar-toggle" onClick={() => setSidebarOpen(true)}>☰</button>
        {activePanel === "dashboard" && (
          <>
            <h2 style={{ marginTop: 0 }}>Dashboard</h2>
            <div className="members-grid">
              <div className="card-doodle">
                <h3>Personal Profile</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>{email}</p>
                {hasDepartment && (
                  <p style={{ color: "var(--primary-green)", fontSize: 14 }}>{deptName} Department</p>
                )}
              </div>

              {powerLevel >= 50 && (
                <div className="card-doodle">
                  <h3>Access Hub</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                    Visit all department websites from one place.
                  </p>
                  <button className="btn" onClick={() => window.open("/departments", "_blank")}>
                    Open Access Hub
                  </button>
                </div>
              )}

              {hasDepartment && powerLevel >= 50 && (
                <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                  <h3>{deptName} Department</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                    Manage meets, documents, instructions, and projects.
                  </p>
                  <button className="btn" onClick={() => setActivePanel("department")}>
                    Open Department Panel
                  </button>
                </div>
              )}

              {announcements.length > 0 && (
                <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                  <h3>Recent Announcements</h3>
                  <div style={{ display: "grid", gap: 8 }}>
                    {announcements.slice(0, 3).map((a: any) => (
                      <div key={a.id} className="card-doodle" style={{ padding: 12 }}>
                        <strong>{a.title}</strong>
                        <div style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap" }}>{a.content}</div>
                        <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 6 }}>
                          {a.created_at?.slice(0, 10)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {activePanel === "profile" && (
          <ProfileSection
            authToken={authToken!}
            email={email || ""}
            powerLevel={powerLevel}
            departmentId={departmentId}
            deptName={deptName}
          />
        )}

        {activePanel === "department" && (() => {
          const deptId = activeDeptId || departmentId;
          const deptName = deptId ? (DEPT_NAMES[deptId] || departments.find((d: any) => d.id === deptId)?.name || deptId) : "";
          if (!deptId) return null;
          return <DepartmentPanel authToken={authToken!} departmentId={deptId} departmentName={deptName} />;
        })()}

        {activePanel === "meets" && (
          <>
            <h2 style={{ marginTop: 0 }}>Meets</h2>
            <div className="members-grid">
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Club-Wide Meets</h3>
                <ClubMeetsSection authToken={authToken!} powerLevel={powerLevel} />
              </div>
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Inter-Department Meets</h3>
                <InterDeptMeetsSection authToken={authToken!} departments={departments} powerLevel={powerLevel} />
              </div>
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Department Meets</h3>
                <DepartmentMeetsSection
                  authToken={authToken!}
                  departments={departments}
                  powerLevel={powerLevel}
                  departmentId={departmentId}
                />
              </div>
            </div>
          </>
        )}

        {activePanel === "projects" && (
          <>
            <h2 style={{ marginTop: 0 }}>Projects</h2>
            <ProjectsSection
              authToken={authToken!}
              departments={departments}
              allUsers={allUsers}
              powerLevel={powerLevel}
              departmentId={departmentId}
            />
          </>
        )}

        {activePanel === "instructions" && (
          <>
            <h2 style={{ marginTop: 0 }}>Instructions</h2>
            <div className="members-grid">
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                {!departmentId ? (
                  <p style={{ color: "var(--text-secondary)" }}>You are not assigned to any department.</p>
                ) : (
                  <InstructionsSection authToken={authToken!} departmentId={departmentId!} />
                )}
              </div>
            </div>
          </>
        )}

        {activePanel === "transfers" && (
          <>
            <h2 style={{ marginTop: 0 }}>Role Transfer Requests</h2>
            <div className="members-grid">
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <TransfersSection authToken={authToken!} />
              </div>
            </div>
          </>
        )}

        {activePanel === "recruitments" && (
          <RecruitmentsPanel authToken={authToken!} powerLevel={powerLevel} />
        )}

        {activePanel === "announcements" && (
          <>
            <h2 style={{ marginTop: 0 }}>Announcements</h2>
            <div className="members-grid">
              {powerLevel >= 100 && (
                <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                  <h3>Post Announcement</h3>
                  <div style={{ display: "grid", gap: 10 }}>
                    <input className="input" placeholder="Title" value={annTitle} onChange={(e) => setAnnTitle(e.target.value)} />
                    <textarea className="input" placeholder="Content" rows={4} value={annContent} onChange={(e) => setAnnContent(e.target.value)} />
                    <button className="btn" disabled={annBusy} onClick={async () => {
                      if (!annTitle.trim() || !annContent.trim()) return alert("Title and content required");
                      setAnnBusy(true);
                      try {
                        const res = await fetch(apiUrl("/api/announcements"), {
                          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                          body: JSON.stringify({ title: annTitle.trim(), content: annContent.trim() }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setAnnTitle(""); setAnnContent("");
                          const r2 = await fetch(apiUrl("/api/announcements"), { headers: { Authorization: `Bearer ${authToken}` } });
                          const d2 = await r2.json();
                          if (d2.success) setAnnouncements(d2.data || []);
                        } else alert(data.error);
                      } finally { setAnnBusy(false); }
                    }}>{annBusy ? "Posting..." : "Post Announcement"}</button>
                  </div>
                </div>
              )}

              {announcements.length === 0 && (
                <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                  <p style={{ color: "var(--text-secondary)" }}>No announcements yet.</p>
                </div>
              )}

              {announcements.map((a: any) => (
                <div key={a.id} className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0 }}>{a.title}</h3>
                      <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 4 }}>{a.created_at?.slice(0, 10)}</div>
                      <div style={{ marginTop: 10, whiteSpace: "pre-wrap", color: "var(--text-secondary)" }}>{a.content}</div>
                    </div>
                    {powerLevel >= 100 && (
                      <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13, marginLeft: 12 }} onClick={async () => {
                        await fetch(apiUrl(`/api/announcements/${a.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                        setAnnouncements(announcements.filter((x: any) => x.id !== a.id));
                      }}>Delete</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activePanel === "admin" && powerLevel >= 100 && (
          <>
            <h2 style={{ marginTop: 0 }}>Admin Console</h2>
            <AdminDataLoader authToken={authToken!} setAllUsers={setAllUsers} setAllRoles={setAllRoles} />
            <div className="members-grid">
              {/* TOKEN REGISTRY */}
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Admin Token Registry</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  Generate tokens for members, leads, or board accounts. The token is what the user types in the login screen.
                </p>
                <div className="admin-grid-4" style={{ marginTop: 16 }}>
                  <input className="input" placeholder="Email" value={tokenEmail} onChange={(e) => setTokenEmail(e.target.value)} />
                  <input className="input" placeholder="Name" value={tokenName} onChange={(e) => setTokenName(e.target.value)} />
                  <select className="input" value={tokenRoleId} onChange={(e) => setTokenRoleId(e.target.value)}>
                    <option value="member">member</option>
                    <option value="lead">lead</option>
                    <option value="secretary">secretary</option>
                    <option value="vice_president">vice_president</option>
                    <option value="president">president</option>
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
                  <div className="floating-note" style={{ marginTop: 16, display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <span>Latest token: {showRecentToken ? recentToken : maskToken(recentToken)}</span>
                    <button className="btn outline" style={{ padding: "0.45rem 0.9rem", boxShadow: "none" }} onClick={async () => { await navigator.clipboard.writeText(recentToken); alert("Token copied"); }}>Copy</button>
                    <button className="btn outline" style={{ padding: "0.45rem 0.9rem", boxShadow: "none" }} onClick={() => setShowRecentToken((v) => !v)}>{showRecentToken ? "Hide" : "Reveal"}</button>
                  </div>
                )}

                <div style={{ display: "grid", gap: 8, marginTop: 16, maxHeight: 400, overflowY: "auto" }}>
                  {adminTokens.length === 0 && <p>No tokens created yet.</p>}
                  {adminTokens.map((item) => (
                    <div key={item.token} className="card-doodle" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <strong>{item.name || item.email}</strong>
                        <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{item.email} · {item.role_id}</div>
                        <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{item.tokenPreview || item.token}</div>
                      </div>
                      {!item.revoked_at ? (
                        <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13 }} onClick={async () => {
                          const res = await fetch(apiUrl(`/api/admin-tokens/${item.email}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                          const data = await res.json();
                          if (data.success) setAdminTokens((prev) => prev.map((t) => t.email === item.email ? { ...t, revoked_at: new Date().toISOString() } : t));
                        }}>Revoke</button>
                      ) : <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>Revoked</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* BOARD USER */}
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Create Board Member</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  Create or update a board member account, assign their role, and issue a login token.
                </p>
                <div className="admin-grid-4" style={{ marginTop: 16 }}>
                  <input className="input" placeholder="Email" value={boardEmail} onChange={(e) => setBoardEmail(e.target.value)} />
                  <input className="input" placeholder="Name" value={boardName} onChange={(e) => setBoardName(e.target.value)} />
                  <select className="input" value={boardRoleId} onChange={(e) => setBoardRoleId(e.target.value)}>
                    <option value="president">president</option>
                    <option value="vice_president">vice_president</option>
                    <option value="secretary">secretary</option>
                    <option value="lead">lead</option>
                  </select>
                  <select className="input" value={boardDepartmentId} onChange={(e) => setBoardDepartmentId(e.target.value)}>
                    <option value="">No department</option>
                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <button className="btn" disabled={boardBusy} onClick={async () => {
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
                        setBoardEmail(""); setBoardName(""); setBoardRoleId("president"); setBoardDepartmentId("");
                        setRecentToken(data.token); setShowRecentToken(false);
                        alert(`Board user created successfully.`);
                      } else alert(data.error);
                    } finally { setBoardBusy(false); }
                  }}>{boardBusy ? "Creating..." : "Create Board User"}</button>
                </div>
              </div>

              {/* MEMBER */}
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Create Member</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  Create a regular member directly with the `member` role.
                </p>
                <div className="admin-grid-4" style={{ marginTop: 16 }}>
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

              {/* SIGNUP REQUESTS */}
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Pending Signup Requests</h3>
                {pendingRequests.length === 0 ? <p>No pending requests.</p> : (
                  <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                    {pendingRequests.map((r) => (
                      <div key={r.id} className="card-doodle" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: 14 }}>
                        <div>
                          <strong>{r.name}</strong>
                          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{r.email}</div>
                          {r.department_id && (
                            <div style={{ fontSize: 12, marginTop: 2, color: "var(--primary-green)" }}>
                              {departments.find((d: any) => d.id === r.department_id)?.name || r.department_id}
                            </div>
                          )}
                          {r.message && <p style={{ marginTop: 6, fontSize: 13, color: "var(--text-secondary)" }}>{r.message}</p>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <button className="btn" onClick={async () => {
                            const res = await fetch(apiUrl(`/api/signup-requests/${r.id}/approve`), {
                              method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                            });
                            const data = await res.json();
                            if (data.success && data.token) alert(`User approved!`);
                            setPendingRequests(pendingRequests.filter((p) => p.id !== r.id));
                          }}>Approve</button>
                          <button className="btn outline" onClick={async () => {
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

              {/* RECRUITMENT SETTINGS */}
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <RecruitmentSettingsSection authToken={authToken!} />
              </div>

              {/* DANGER ZONE */}
              <div className="card-doodle" style={{ gridColumn: "1 / -1", border: "2px solid #e74c3c" }}>
                <h3 style={{ color: "#e74c3c" }}>Danger Zone</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  Change user roles or remove users permanently. These actions cannot be undone.
                </p>
                <div className="admin-grid-2" style={{ marginTop: 16 }}>
                  <div className="card-doodle" style={{ padding: 14, border: "1px solid var(--border-light)" }}>
                    <h4 style={{ margin: 0, fontSize: 15 }}>Change Role</h4>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <select className="input" value={dangerUserId} onChange={(e) => setDangerUserId(e.target.value)}>
                        <option value="">Select user</option>
                        {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email}) - {u.role_name}</option>)}
                      </select>
                      <select className="input" value={dangerNewRoleId} onChange={(e) => setDangerNewRoleId(e.target.value)}>
                        <option value="">Select new role</option>
                        {allRoles.filter((r: any) => r.power_level < 100).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <select className="input" value={dangerNewDeptId} onChange={(e) => setDangerNewDeptId(e.target.value)}>
                        <option value="">No department</option>
                        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <button className="btn" style={{ background: "#e74c3c" }} disabled={dangerBusy} onClick={async () => {
                        if (!dangerUserId || !dangerNewRoleId) { alert("Select user and role"); return; }
                        setDangerBusy(true);
                        try {
                          const res = await fetch(apiUrl(`/api/members/${dangerUserId}/role`), {
                            method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                            body: JSON.stringify({ newRoleId: dangerNewRoleId, departmentId: dangerNewDeptId || null }),
                          });
                          const data = await res.json();
                          if (data.success) { alert("Role updated"); setDangerUserId(""); setDangerNewRoleId(""); setDangerNewDeptId(""); }
                          else alert(data.error);
                        } finally { setDangerBusy(false); }
                      }}>{dangerBusy ? "Updating..." : "Update Role"}</button>
                    </div>
                  </div>
                  <div className="card-doodle" style={{ padding: 14, border: "1px solid var(--border-light)" }}>
                    <h4 style={{ margin: 0, fontSize: 15 }}>Delete User</h4>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <select className="input" value={deleteUserId} onChange={(e) => setDeleteUserId(e.target.value)}>
                        <option value="">Select user</option>
                        {allUsers.filter((u: any) => u.power_level < 100).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                      </select>
                      <button className="btn" style={{ background: "#e74c3c" }} disabled={deleteBusy} onClick={async () => {
                        if (!deleteUserId) { alert("Select a user"); return; }
                        if (!confirm("Are you sure you want to permanently delete this user?")) return;
                        setDeleteBusy(true);
                        try {
                          const res = await fetch(apiUrl(`/api/members/${deleteUserId}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                          const data = await res.json();
                          if (data.success) { alert("User deleted"); setDeleteUserId(""); }
                          else alert(data.error);
                        } finally { setDeleteBusy(false); }
                      }}>{deleteBusy ? "Deleting..." : "Delete User"}</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ROLE TRANSFER REQUESTS */}
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Role Transfer Requests</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  Initiate a role transfer from one user to another. President/VP cannot be transferred.
                </p>
                <div className="admin-grid-4" style={{ marginTop: 16 }}>
                  <select className="input" value={transferFromUserId} onChange={(e) => setTransferFromUserId(e.target.value)}>
                    <option value="">From user</option>
                    {allUsers.filter((u: any) => u.power_level < 100).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role_name})</option>)}
                  </select>
                  <select className="input" value={transferToUserId} onChange={(e) => setTransferToUserId(e.target.value)}>
                    <option value="">To user</option>
                    {allUsers.filter((u: any) => u.power_level < 100).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role_name})</option>)}
                  </select>
                  <select className="input" value={transferRoleId} onChange={(e) => setTransferRoleId(e.target.value)}>
                    <option value="">Select role</option>
                    {allRoles.filter((r: any) => r.power_level < 100).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button className="btn" disabled={transferBusy} onClick={async () => {
                    if (!transferFromUserId || !transferToUserId || !transferRoleId) { alert("Fill all fields"); return; }
                    setTransferBusy(true);
                    try {
                      const res = await fetch(apiUrl("/api/role-transfers"), {
                        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                        body: JSON.stringify({ fromUserId: transferFromUserId, toUserId: transferToUserId, roleId: transferRoleId }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        alert("Transfer request created");
                        setTransferFromUserId(""); setTransferToUserId(""); setTransferRoleId("");
                        const r2 = await fetch(apiUrl("/api/role-transfers"), { headers: { Authorization: `Bearer ${authToken}` } });
                        const d2 = await r2.json();
                        if (d2.success) setRoleTransfers(d2.data || []);
                      } else alert(data.error);
                    } finally { setTransferBusy(false); }
                  }}>{transferBusy ? "Creating..." : "Create Transfer"}</button>
                </div>
                {roleTransfers.length > 0 && (
                  <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
                    <h4 style={{ margin: 0 }}>Pending Transfers</h4>
                    {roleTransfers.map((rt: any) => (
                      <div key={rt.id} className="card-doodle" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <strong>{rt.from_name || "Unknown"}</strong> → <strong>{rt.to_name || "Unknown"}</strong>
                          <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>Role: {rt.role_name || rt.role_id}</div>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn" onClick={async () => {
                            const res = await fetch(apiUrl(`/api/role-transfers/${rt.id}/approve`), {
                              method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                            });
                            const data = await res.json();
                            if (data.success) alert("Transfer approved and executed");
                            setRoleTransfers(roleTransfers.filter((x: any) => x.id !== rt.id));
                          }}>Approve</button>
                          <button className="btn outline" onClick={async () => {
                            await fetch(apiUrl(`/api/role-transfers/${rt.id}/reject`), {
                              method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                            });
                            setRoleTransfers(roleTransfers.filter((x: any) => x.id !== rt.id));
                          }}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdminDataLoader({ authToken, setAllUsers, setAllRoles }: { authToken: string; setAllUsers: any; setAllRoles: any }) {
  useEffect(() => {
    async function load() {
      const [uRes, rRes] = await Promise.all([
        fetch(apiUrl("/api/users"), { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(apiUrl("/api/roles"), { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      const uData = await uRes.json();
      const rData = await rRes.json();
      if (uData.success) setAllUsers(uData.data || []);
      if (rData.success) setAllRoles(rData.data || []);
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClubMeetsSection({ authToken, powerLevel }: { authToken: string; powerLevel: number }) {
  const [meets, setMeets] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [when, setWhen] = useState("");
  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };
  const canManage = powerLevel >= 100;

  async function load() {
    const res = await fetch(apiUrl("/api/club-meets"), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setMeets(data.data || []);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  return (
    <div>
      {meets.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No club-wide meets scheduled.</p>}
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {meets.map((m) => (
          <div key={m.id} className="card-doodle" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{m.title}</strong>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{m.scheduled_at?.slice(0, 16).replace("T", " ")}</div>
              {m.meet_link && <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={() => window.open(m.meet_link, "_blank")}>Open Link</button>}
            </div>
            {canManage && (
              <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                await fetch(apiUrl(`/api/club-meets/${m.id}`), { method: "DELETE", headers });
                setMeets(meets.filter((x) => x.id !== m.id));
              }}>Delete</button>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Meet link" value={link} onChange={(e) => setLink(e.target.value)} />
          <input className="input" style={{ flex: 1, minWidth: 140 }} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <button className="btn" onClick={async () => {
            if (!title || !when) return alert("Title and date required");
            const res = await fetch(apiUrl("/api/club-meets"), {
              method: "POST", headers, body: JSON.stringify({ title, meetLink: link, scheduledAt: when }),
            });
            const data = await res.json();
            if (data.success) { setTitle(""); setLink(""); setWhen(""); load(); }
            else alert(data.error);
          }}>Schedule</button>
        </div>
      )}
    </div>
  );
}

function DepartmentMeetsSection({ authToken, departments, powerLevel, departmentId }: { authToken: string; departments: any[]; powerLevel: number; departmentId: string | null }) {
  const [meets, setMeets] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [when, setWhen] = useState("");
  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };

  async function load() {
    const res = await fetch(apiUrl("/api/department-meets"), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setMeets(data.data || []);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const isLead = powerLevel >= 50 && departmentId;
  const userDeptName = departmentId ? departments.find((d: any) => d.id === departmentId)?.name : null;

  return (
    <div>
      {meets.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No department meets scheduled.</p>}
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {meets.map((m) => (
          <div key={m.id} className="card-doodle" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{m.title}</strong>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{m.scheduled_at?.slice(0, 16).replace("T", " ")}</div>
              <div style={{ fontSize: 12, color: "var(--primary-green)" }}>{m.department_name}</div>
              {m.meet_link && <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={() => window.open(m.meet_link, "_blank")}>Open Link</button>}
            </div>
            {isLead && m.department_id === departmentId && (
              <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                await fetch(apiUrl(`/api/departments/${departmentId}/meets/${m.id}`), { method: "DELETE", headers });
                setMeets(meets.filter((x) => x.id !== m.id));
              }}>Delete</button>
            )}
          </div>
        ))}
      </div>
      {isLead && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 8, borderTop: "1px solid var(--border-light)" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", width: "100%", marginBottom: 4 }}>
            Schedule a meet for <strong>{userDeptName}</strong>:
          </div>
          <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Meet link" value={link} onChange={(e) => setLink(e.target.value)} />
          <input className="input" style={{ flex: 1, minWidth: 140 }} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <button className="btn" onClick={async () => {
            if (!title || !when) return alert("Title and date required");
            const res = await fetch(apiUrl(`/api/departments/${departmentId}/meets`), {
              method: "POST", headers, body: JSON.stringify({ title, meetLink: link, scheduledAt: when }),
            });
            const data = await res.json();
            if (data.success) { setTitle(""); setLink(""); setWhen(""); load(); }
            else alert(data.error);
          }}>Schedule</button>
        </div>
      )}
    </div>
  );
}

function InterDeptMeetsSection({ authToken, departments, powerLevel }: { authToken: string; departments: any[]; powerLevel: number }) {
  const [meets, setMeets] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [when, setWhen] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const headers = { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" };
  const canManage = powerLevel >= 50;

  async function load() {
    const res = await fetch(apiUrl("/api/inter-dept-meets"), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setMeets(data.data || []);
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  function toggleDept(id: string) {
    setSelectedDepts((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  }

  return (
    <div>
      {meets.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No inter-department meets scheduled.</p>}
      <div style={{ display: "grid", gap: 8, marginBottom: 12 }}>
        {meets.map((m) => (
          <div key={m.id} className="card-doodle" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{m.title}</strong>
              <div style={{ color: "var(--text-secondary)", fontSize: 13 }}>{m.scheduled_at?.slice(0, 16).replace("T", " ")}</div>
              <div style={{ fontSize: 12, color: "var(--text-light)" }}>Depts: {(m.departments || "").split(",").join(", ")}</div>
              {m.meet_link && <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={() => window.open(m.meet_link, "_blank")}>Open Link</button>}
            </div>
            {canManage && (
              <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                await fetch(apiUrl(`/api/inter-dept-meets/${m.id}`), { method: "DELETE", headers });
                setMeets(meets.filter((x) => x.id !== m.id));
              }}>Delete</button>
            )}
          </div>
        ))}
      </div>
      {canManage && (
        <div style={{ display: "flex", gap: 8, flexDirection: "column" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Meet link" value={link} onChange={(e) => setLink(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 140 }} type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {departments.map((d: any) => (
              <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={selectedDepts.includes(d.id)} onChange={() => toggleDept(d.id)} />
                {d.name}
              </label>
            ))}
          </div>
          <button className="btn" onClick={async () => {
            if (!title || !when) return alert("Title and date required");
            if (selectedDepts.length === 0) return alert("Select at least one department");
            const res = await fetch(apiUrl("/api/inter-dept-meets"), {
              method: "POST", headers, body: JSON.stringify({ title, meetLink: link, scheduledAt: when, departments: selectedDepts }),
            });
            const data = await res.json();
            if (data.success) { setTitle(""); setLink(""); setWhen(""); setSelectedDepts([]); load(); }
            else alert(data.error);
          }}>Schedule Inter-Department Meet</button>
        </div>
      )}
    </div>
  );
}

function ProjectsSection({ authToken, departments, allUsers, powerLevel, departmentId }: { authToken: string; departments: any[]; allUsers: any[]; powerLevel: number; departmentId: string | null }) {
  const [projects, setProjects] = useState<any[]>([]);
  const [deptMembers, setDeptMembers] = useState<any[]>([]);
  const [assignProjectId, setAssignProjectId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleName, setAssignRoleName] = useState("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [yearFilter, setYearFilter] = useState("");

  const canManage = powerLevel >= 50 && departmentId;
  const isBoard = powerLevel >= 100;

  async function load() {
    const [projRes, membersRes] = await Promise.all([
      fetch(apiUrl("/api/projects"), { headers: { Authorization: `Bearer ${authToken}` } }),
      isBoard
        ? fetch(apiUrl("/api/users"), { headers: { Authorization: `Bearer ${authToken}` } })
        : departmentId
          ? fetch(apiUrl(`/api/departments/${departmentId}/members`), { headers: { Authorization: `Bearer ${authToken}` } })
          : Promise.resolve(null),
    ]);
    const projData = await projRes.json();
    if (projData.success) setProjects(projData.data || []);
    if (membersRes) {
      const membersData = await membersRes.json();
      setDeptMembers(membersData.success ? (membersData.data || []) : []);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const availableMembers = isBoard ? allUsers : deptMembers;

  const statusFiltered = showCompleted
    ? projects.filter((p: any) => p.status === "completed")
    : projects.filter((p: any) => p.status !== "completed");

  const query = searchQuery.toLowerCase();
  const searched = query
    ? statusFiltered.filter((p: any) =>
        (p.name || "").toLowerCase().includes(query) ||
        (p.description || "").toLowerCase().includes(query) ||
        (p.company_org || "").toLowerCase().includes(query)
      )
    : statusFiltered;

  const yearFiltered = yearFilter
    ? searched.filter((p: any) => (p.year || "Unspecified") === yearFilter)
    : searched;

  const sorted = [...yearFiltered].sort((a: any, b: any) => {
    const da = new Date(a.created_at).getTime();
    const db = new Date(b.created_at).getTime();
    return sortOrder === "newest" ? db - da : da - db;
  });

  const yearSet = new Set<string>();
  statusFiltered.forEach((p: any) => yearSet.add(p.year || "Unspecified"));
  const availableYears = Array.from(yearSet).sort((a, b) => {
    if (a === "Unspecified") return 1;
    if (b === "Unspecified") return -1;
    return b.localeCompare(a);
  });

  const grouped: Record<string, any[]> = {};
  for (const p of sorted) {
    const key = p.year || "Unspecified";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(p);
  }
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "Unspecified") return 1;
    if (b === "Unspecified") return -1;
    return b.localeCompare(a);
  });

  return (
    <div className="members-grid">
      {isBoard && (
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <h3>Create Project</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Create a new project for a company/org and assign which departments can access it.
          </p>
          <CreateProjectSection authToken={authToken} departments={departments} onCreated={load} />
        </div>
      )}

      <div className="card-doodle" style={{ gridColumn: "1 / -1", padding: "0.6rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {showCompleted ? "Completed Projects" : "Active Projects"}
        </span>
        <button className={`btn ${showCompleted ? "" : "outline"}`} style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={() => setShowCompleted((v) => !v)}>
          {showCompleted ? "Show Active" : "Completed Projects"}
        </button>
      </div>

      <div className="card-doodle" style={{ gridColumn: "1 / -1", padding: "0.6rem 1rem", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" style={{ flex: 2, minWidth: 160 }} placeholder="Search projects..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        <select className="input" style={{ width: "auto", minWidth: 100 }} value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
        </select>
        <select className="input" style={{ width: "auto", minWidth: 100 }} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="">All Years</option>
          {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {sorted.length === 0 && (
        <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
          <p style={{ color: "var(--text-secondary)" }}>No {showCompleted ? "completed" : "active"} projects match your filters.</p>
        </div>
      )}

      {groupKeys.map((yearKey) => (
        <div key={yearKey} style={{ gridColumn: "1 / -1" }}>
          {yearKey !== "Unspecified" && (
            <h3 style={{ margin: "0 0 8px", color: "var(--text-secondary)", fontSize: 16 }}>
              {yearKey}
            </h3>
          )}
          <div className="members-grid" style={{ gap: 12 }}>
            {grouped[yearKey].map((p: any) => {
              const userDeptAssigned = departmentId && p.departments?.some((d: any) => d.id === departmentId);
              const canAssign = (isBoard || (canManage && userDeptAssigned));
              const canManageTasks = isBoard || (canManage && userDeptAssigned);
              return (
                <div key={p.id} className="card-doodle" style={{ gridColumn: "1 / -1", padding: "1rem 1.25rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h3 style={{ margin: 0, fontSize: 18 }}>{p.name}</h3>
                        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, background: p.status === "completed" ? "var(--primary-green)" : "var(--accent)", color: "#fff", fontWeight: 600 }}>{p.status}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-light)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        {p.company_org && <span>{p.company_org}</span>}
                        {p.year && <span>{p.year}</span>}
                        {p.deadline && <span>Deadline: {p.deadline.slice(0, 10)}</span>}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                        {p.departments?.map((d: any) => (
                          <span key={d.id} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-light)", color: "var(--text-secondary)" }}>
                            {d.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
                      {showCompleted && powerLevel >= 100 && (
                        <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                          const res = await fetch(apiUrl(`/api/projects/${p.id}/reopen`), {
                            method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                          });
                          const data = await res.json();
                          if (data.success) {
                            setProjects(projects.filter((x: any) => x.id !== p.id));
                            alert("Project reopened");
                          } else alert(data.error);
                        }}>Reopen</button>
                      )}
                      {isBoard && (
                        <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} onClick={async () => {
                          if (!confirm(`Delete project "${p.name}"?`)) return;
                          const res = await fetch(apiUrl(`/api/projects/${p.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                          const data = await res.json();
                          if (data.success) setProjects(projects.filter((x: any) => x.id !== p.id));
                          else alert("Delete failed: " + (data.error || "unknown"));
                        }}>Delete</button>
                      )}
                    </div>
                  </div>

                  {p.description && (
                    <div style={{ marginTop: 10, padding: "0.6rem 0.8rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.5 }}>{p.description}</div>
                  )}

                  {p.roles?.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <strong style={{ fontSize: 13, color: "var(--text-secondary)" }}>Team Roles</strong>
                      <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                        {p.roles.map((r: any) => (
                          <div key={r.id} style={{ padding: "0.3rem 0.8rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 6 }}>
                            <strong style={{ fontSize: 13 }}>{r.user_name}</strong>
                            <span style={{ fontSize: 12, color: "var(--primary-green)" }}>({r.role_name})</span>
                            {canAssign && (
                              <button style={{ border: "none", background: "none", color: "var(--text-light)", cursor: "pointer", fontSize: 14, padding: "0 2px" }} onClick={async () => {
                                await fetch(apiUrl(`/api/projects/${p.id}/roles/${r.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                                load();
                              }}>×</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {canAssign && (
                    <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
                      <select className="input" style={{ flex: 1, minWidth: 140 }} value={assignProjectId === p.id ? assignUserId : ""} onChange={(e) => { setAssignProjectId(p.id); setAssignUserId(e.target.value); }}>
                        <option value="">Select member</option>
                        {availableMembers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                      </select>
                      <input className="input" style={{ flex: 1, minWidth: 120 }} placeholder="Role name" value={assignProjectId === p.id ? assignRoleName : ""} onChange={(e) => { setAssignProjectId(p.id); setAssignRoleName(e.target.value); }} />
                      <button className="btn" disabled={assignBusy} onClick={async () => {
                        if (!assignUserId || !assignRoleName) return alert("Select member and enter role name");
                        setAssignBusy(true);
                        try {
                          const res = await fetch(apiUrl(`/api/projects/${p.id}/roles`), {
                            method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                            body: JSON.stringify({ userId: assignUserId, roleName: assignRoleName }),
                          });
                          const data = await res.json();
                          if (data.success) { setAssignUserId(""); setAssignRoleName(""); setAssignProjectId(""); load(); }
                          else alert(data.error);
                        } finally { setAssignBusy(false); }
                      }}>{assignBusy ? "Assigning..." : "Assign Role"}</button>
                    </div>
                  )}

                  <ProjectTasksSection
                    authToken={authToken}
                    projectId={p.id}
                    projectStatus={p.status}
                    canManageTasks={canManageTasks}
                    isBoard={isBoard}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateProjectSection({ authToken, departments, onCreated }: { authToken: string; departments: any[]; onCreated?: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [companyOrg, setCompanyOrg] = useState("");
  const [projectYear, setProjectYear] = useState("");
  const [deadline, setDeadline] = useState("");
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  function toggleDept(id: string) {
    setSelectedDepts((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  }

  return (
    <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
      <div className="admin-grid-3">
        <input className="input" placeholder="Project name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input" placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input className="input" placeholder="Company / Org" value={companyOrg} onChange={(e) => setCompanyOrg(e.target.value)} />
      </div>
      <div className="admin-grid-2">
        <input className="input" placeholder="Year (e.g. 2025, 2026, 2027)" value={projectYear} onChange={(e) => setProjectYear(e.target.value)} />
        <input className="input" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: -8 }}>
        Fill either year OR date. If both are provided, the date takes precedence.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {departments.map((d: any) => (
          <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" checked={selectedDepts.includes(d.id)} onChange={() => toggleDept(d.id)} />
            {d.name}
          </label>
        ))}
      </div>
      <div>
        <button className="btn" disabled={busy} onClick={async () => {
          if (!name.trim()) return alert("Project name required");
          if (selectedDepts.length === 0) return alert("Select at least one department");
          if (!projectYear.trim() && !deadline) return alert("Provide either a year or a deadline date");
          if (projectYear.trim() && !/^\d{4}$/.test(projectYear.trim())) return alert("Year must be a 4-digit year (e.g. 2025, 2026, 2027)");
          setBusy(true);
          try {
            const res = await fetch(apiUrl("/api/projects"), {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
              body: JSON.stringify({ name: name.trim(), description: description.trim() || null, companyOrg: companyOrg.trim() || null, year: projectYear.trim() || null, deadline: deadline || null, departmentIds: selectedDepts }),
            });
            const data = await res.json();
            if (data.success) { setName(""); setDescription(""); setCompanyOrg(""); setProjectYear(""); setDeadline(""); setSelectedDepts([]); if (onCreated) onCreated(); alert("Project created"); }
            else alert(data.error);
          } finally { setBusy(false); }
        }}>{busy ? "Creating..." : "Create Project"}</button>
      </div>
    </div>
  );
}

function ProjectTasksSection({ authToken, projectId, projectStatus, canManageTasks, isBoard }: { authToken: string; projectId: string; projectStatus: string; canManageTasks: boolean; isBoard: boolean }) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [completeAllBusy, setCompleteAllBusy] = useState(false);
  const [completeProjBusy, setCompleteProjBusy] = useState(false);

  async function loadTasks() {
    const res = await fetch(apiUrl(`/api/projects/${projectId}/tasks`), { headers: { Authorization: `Bearer ${authToken}` } });
    const data = await res.json();
    if (data.success) setTasks(data.data || []);
  }

  useEffect(() => { loadTasks(); }, []);

  const allDone = tasks.length > 0 && tasks.every((t: any) => t.status === "completed");

  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--border-light)", paddingTop: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Tasks ({tasks.filter((t: any) => t.status === "completed").length}/{tasks.length})</strong>
        {projectStatus !== "completed" && (
          <div style={{ display: "flex", gap: 6 }}>
            {canManageTasks && tasks.length > 0 && !allDone && (
              <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} disabled={completeAllBusy} onClick={async () => {
                setCompleteAllBusy(true);
                try {
                  const res = await fetch(apiUrl(`/api/projects/${projectId}/tasks/complete-all`), {
                    method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const data = await res.json();
                  if (data.success) loadTasks();
                  else alert(data.error);
                } finally { setCompleteAllBusy(false); }
              }}>{completeAllBusy ? "Completing..." : "Complete All"}</button>
            )}
            {isBoard && projectStatus !== "completed" && (allDone || tasks.length === 0) && (
              <button className="btn" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} disabled={completeProjBusy} onClick={async () => {
                setCompleteProjBusy(true);
                try {
                  const res = await fetch(apiUrl(`/api/projects/${projectId}/complete`), {
                    method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const data = await res.json();
                  if (data.success) { alert("Project marked as complete"); loadTasks(); window.location.reload(); }
                  else alert(data.error);
                } finally { setCompleteProjBusy(false); }
              }}>{completeProjBusy ? "Completing..." : "Mark Project Complete"}</button>
            )}
          </div>
        )}
      </div>

      {tasks.length === 0 && <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "4px 0" }}>No tasks yet.</p>}

      <div style={{ display: "grid", gap: 4 }}>
        {tasks.map((t: any) => (
          <div key={t.id} style={{ padding: "0.4rem 0.7rem", background: "var(--bg-secondary)", borderRadius: 8, border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 14, color: t.status === "completed" ? "var(--primary-green)" : "var(--text-light)" }}>
                  {t.status === "completed" ? "✓" : "○"}
                </span>
                <strong style={{ fontSize: 13 }}>{t.title}</strong>
              </div>
              {t.description && <p style={{ margin: "2px 0 0 20px", fontSize: 12, color: "var(--text-secondary)" }}>{t.description}</p>}
            </div>
            {canManageTasks && t.status !== "completed" && (
              <button className="btn outline" style={{ padding: "0.2rem 0.5rem", fontSize: 11 }} onClick={async () => {
                const res = await fetch(apiUrl(`/api/projects/${projectId}/tasks/${t.id}`), {
                  method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                  body: JSON.stringify({ status: "completed" }),
                });
                const data = await res.json();
                if (data.success) loadTasks();
              }}>Complete</button>
            )}
          </div>
        ))}
      </div>

      {canManageTasks && projectStatus !== "completed" && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="input" style={{ flex: 2, minWidth: 150 }} placeholder="Task title" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          <input className="input" style={{ flex: 3, minWidth: 200 }} placeholder="Description (optional)" value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} />
          <button className="btn" style={{ padding: "0.3rem 0.8rem", fontSize: 12 }} disabled={taskBusy} onClick={async () => {
            if (!taskTitle.trim()) return alert("Task title required");
            setTaskBusy(true);
            try {
              const res = await fetch(apiUrl(`/api/projects/${projectId}/tasks`), {
                method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                body: JSON.stringify({ title: taskTitle.trim(), description: taskDesc.trim() || null }),
              });
              const data = await res.json();
              if (data.success) { setTaskTitle(""); setTaskDesc(""); loadTasks(); }
              else alert(data.error);
            } finally { setTaskBusy(false); }
          }}>{taskBusy ? "Adding..." : "Add Task"}</button>
        </div>
      )}
    </div>
  );
}

function InstructionsSection({ authToken, departmentId }: { authToken: string; departmentId: string }) {
  const [instructions, setInstructions] = useState<any[]>([]);

  useEffect(() => {
    fetch(apiUrl(`/api/departments/${departmentId}/instructions`), { headers: { Authorization: `Bearer ${authToken}` } })
      .then((r) => r.json())
      .then((d) => { if (d.success) setInstructions(d.data || []); })
      .catch(() => { /* ignore */ });
  }, [departmentId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      {instructions.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No instructions for your department.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {instructions.map((inst) => (
          <div key={inst.id} className="card-doodle" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <strong style={{ fontSize: 15 }}>{inst.title}</strong>
              <span className="floating-note" style={{ fontSize: 11, padding: "0.15rem 0.5rem", transform: "none" }}>
                {inst.priority}
              </span>
            </div>
            <div style={{ color: "var(--text-secondary)", whiteSpace: "pre-wrap", fontSize: 14 }}>{inst.content}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const RECRUITMENT_DOMAINS = ["Technical", "R&D", "Operations", "PR & Outreach", "Design & Creative", "Content & Editorial", "HR & Logistics", "Finance"];

function RecruitmentSettingsSection({ authToken }: { authToken: string }) {
  const [settings, setSettings] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch(apiUrl("/api/recruitment/admin/settings"), { headers: { Authorization: `Bearer ${authToken}` } });
    const d = await res.json();
    if (d.success) setSettings(d.data || []);
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleDomain(domainName: string) {
    const newSettings = settings.map(s => s.domain_name === domainName ? { ...s, is_open: s.is_open ? 0 : 1 } : s);
    setSettings(newSettings);
    const openDomains = newSettings.filter((s: any) => s.is_open).map((s: any) => s.domain_name);
    setBusy(true);
    try {
      await fetch(apiUrl("/api/recruitment/admin/settings"), {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ openDomains }),
      });
    } finally { setBusy(false); }
  }

  async function selectAll() {
    setSettings(RECRUITMENT_DOMAINS.map(d => ({ domain_name: d, is_open: 1 })));
    setBusy(true);
    try {
      await fetch(apiUrl("/api/recruitment/admin/settings"), {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ openDomains: RECRUITMENT_DOMAINS }),
      });
    } finally { setBusy(false); }
  }

  async function deselectAll() {
    setSettings(RECRUITMENT_DOMAINS.map(d => ({ domain_name: d, is_open: 0 })));
    setBusy(true);
    try {
      await fetch(apiUrl("/api/recruitment/admin/settings"), {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ openDomains: [] }),
      });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <h3>Recruitment Domain Settings</h3>
      <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
        Open or close recruitment for each domain. Closed domains won't appear on the application form.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {(settings.length > 0 ? settings : RECRUITMENT_DOMAINS.map(d => ({ domain_name: d, is_open: 1 }))).map((ds: any) => (
          <button
            key={ds.domain_name}
            onClick={() => toggleDomain(ds.domain_name)}
            disabled={busy}
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
        <button className="btn outline" style={{ fontSize: 13, padding: "0.4rem 1rem" }} disabled={busy} onClick={selectAll}>Select All</button>
        <button className="btn outline" style={{ fontSize: 13, padding: "0.4rem 1rem" }} disabled={busy} onClick={deselectAll}>Deselect All</button>
      </div>
    </div>
  );
}

function TransfersSection({ authToken }: { authToken: string }) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch(apiUrl("/api/my-role-transfers"), { headers: { Authorization: `Bearer ${authToken}` } });
      const d = await res.json();
      if (d.success) setTransfers(d.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      {transfers.length === 0 && <p style={{ color: "var(--text-secondary)" }}>No pending role transfers involving you.</p>}
      <div style={{ display: "grid", gap: 8 }}>
        {transfers.map((t: any) => (
          <div key={t.id} className="card-doodle" style={{ padding: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong>{t.from_name}</strong> <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>→</span> <strong>{t.to_name}</strong>
                <div style={{ color: "var(--primary-green)", fontSize: 13 }}>Role: {t.role_name}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" style={{ padding: "0.4rem 1rem" }} onClick={async () => {
                  const res = await fetch(apiUrl(`/api/my-role-transfers/${t.id}/accept`), {
                    method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const d = await res.json();
                  if (d.success) { load(); alert(d.message); }
                  else alert(d.error);
                }}>Accept</button>
                <button className="btn outline" style={{ padding: "0.4rem 1rem" }} onClick={async () => {
                  const res = await fetch(apiUrl(`/api/my-role-transfers/${t.id}/decline`), {
                    method: "POST", headers: { Authorization: `Bearer ${authToken}` },
                  });
                  const d = await res.json();
                  if (d.success) { load(); alert(d.message); }
                  else alert(d.error);
                }}>Decline</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
