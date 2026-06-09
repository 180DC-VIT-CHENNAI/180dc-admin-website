/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import MembersLogin from "./MembersLogin";
import DepartmentPanel from "./DepartmentPanel";
import RecruitmentsPanel from "./RecruitmentsPanel";
import ProfileSection from "./ProfileSection";
import ChatSection from "./ChatSection";
import ClubFilesPanel from "./ClubFilesPanel";
import MembersSection from "./MembersSection";
import AdminDataLoader from "./AdminDataLoader";
import ClubMeetsSection from "./ClubMeetsSection";
import DepartmentMeetsSection from "./DepartmentMeetsSection";
import InterDeptMeetsSection from "./InterDeptMeetsSection";
import ProjectsSection from "./ProjectsSection";
import InstructionsSection from "./InstructionsSection";
import RecruitmentSettingsSection from "./RecruitmentSettingsSection";
import ConsultingRequestsSection from "./ConsultingRequestsSection";
import SendMailSection from "./SendMailSection";
import RoomSettingsPanel from "./RoomSettingsPanel";
import TransfersSection from "./TransfersSection";
import FullPageLoader from "./FullPageLoader";
import { apiUrl } from "../../lib/api";
import { useTheme } from "../../context/ThemeContext";
import { DEPT_NAMES } from "./constants";
import "./MembersLayout.css";

const EX_TITLES = [
  "x-president",
  "x-vice_president",
  "x-technical_director",
  "x-marketing_director",
  "x-secretary",
  "x-lead",
  "x-lead_rnd",
  "x-lead_marketing",
  "x-lead_social",
  "x-lead_finance",
  "x-lead_events",
  "x-lead_cps",
  "x-lead_hr",
];

export default function MembersLayout() {
  const { isDark, toggle: toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() => sessionStorage.getItem("authToken"));
  const [email, setEmail] = useState<string | null>(sessionStorage.getItem("authEmail"));
  const [powerLevel, setPowerLevel] = useState<number>(() => {
    const stored = sessionStorage.getItem("authPowerLevel");
    return stored ? parseInt(stored, 10) : 0;
  });
  const [departmentId, setDepartmentId] = useState<string | null>(sessionStorage.getItem("authDepartmentId"));
  const [roleId, setRoleId] = useState<string | null>(sessionStorage.getItem("authRoleId"));
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    const stored = localStorage.getItem("membersSidebarCollapsed");
    return stored === "true";
  });
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
  const [boardSecondaryRoleId, setBoardSecondaryRoleId] = useState("");
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
  const [dangerNewSecondaryRoleId, setDangerNewSecondaryRoleId] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [transferFromUserId, setTransferFromUserId] = useState("");
  const [transferToUserId, setTransferToUserId] = useState("");
  const [transferRoleId, setTransferRoleId] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  // Advisory member creation state
  const [advisoryEmail, setAdvisoryEmail] = useState("");
  const [advisoryName, setAdvisoryName] = useState("");
  const [advisoryExTitle, setAdvisoryExTitle] = useState("");
  const [advisoryMemberDeptId, setAdvisoryMemberDeptId] = useState("");
  const [advisoryBusy, setAdvisoryBusy] = useState(false);
  const [advisoryRecentToken, setAdvisoryRecentToken] = useState<string | null>(null);

  // Danger Zone advisory change state
  const [dangerAdvUserId, setDangerAdvUserId] = useState("");
  const [dangerAdvExTitle, setDangerAdvExTitle] = useState("");
  const [dangerAdvDeptId, setDangerAdvDeptId] = useState("");
  const [dangerAdvBusy, setDangerAdvBusy] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["General", "Chats", "Departments", "Management", "Admin"]));
  const [roomSettings, setRoomSettings] = useState<Record<string, boolean>>({});

  function toggleSection(label: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  useEffect(() => {
    if (!authToken) return;
    fetch(apiUrl("/api/chat/rooms"), { headers: { Authorization: `Bearer ${authToken}` } })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          const map: Record<string, boolean> = {};
          (d.data || []).forEach((r: any) => { map[r.room] = !!r.enabled; });
          setRoomSettings(map);
        }
      })
      .catch((err) => console.error("Failed to fetch room settings:", err));
  }, [authToken]);

  const maskToken = (token: string) =>
    token.length <= 8 ? `${token.slice(0, 3)}…` : `${token.slice(0, 6)}…${token.slice(-4)}`;

  const handleLogin = (
    token: string,
    userEmail: string,
    serverPowerLevel?: number,
    serverDepartmentId?: string,
    serverRoleId?: string,
  ) => {
    sessionStorage.setItem("authToken", token);
    sessionStorage.setItem("authEmail", userEmail);
    sessionStorage.setItem("authPowerLevel", String(serverPowerLevel ?? 10));
    if (serverDepartmentId) sessionStorage.setItem("authDepartmentId", serverDepartmentId);
    if (serverRoleId) sessionStorage.setItem("authRoleId", serverRoleId);
    setAuthToken(token);
    setEmail(userEmail);
    setPowerLevel(serverPowerLevel ?? 10);
    if (serverDepartmentId) setDepartmentId(serverDepartmentId);
    if (serverRoleId) setRoleId(serverRoleId);
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
          if (data.user?.departmentId) setDepartmentId(data.user.departmentId);
          if (data.user?.powerLevel != null) {
            setPowerLevel(data.user.powerLevel);
            sessionStorage.setItem("authPowerLevel", String(data.user.powerLevel));
          }
          if (data.user?.roleId) {
            setRoleId(data.user.roleId);
            sessionStorage.setItem("authRoleId", data.user.roleId);
          }
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
  type NavSection = { label: string; items: NavItem[] };

  const roleDeptAccess: Record<string, string[]> = {
    marketing_director: ["marketing", "social_media"],
  };
  const multiDeptRoles = roleDeptAccess[roleId || ""];
  const allowedDeptIds = multiDeptRoles || (hasDepartment && powerLevel >= 50 ? [departmentId!] : []);

  const navSections: NavSection[] = [];

  if (roleId === "advisory") {
    navSections.push({
      label: "",
      items: [
        { id: "dashboard", label: "Dashboard", minPower: 0 },
        { id: "profile", label: "Profile", minPower: 0 },
        { id: "chat", label: "Advisory Chat", minPower: 30 },
      ],
    });
  } else {
    // General
    navSections.push({
      label: "General",
      items: [
        { id: "dashboard", label: "Dashboard", minPower: 0 },
        { id: "members", label: "Members", minPower: 10 },
        { id: "profile", label: "Profile", minPower: 0 },
        { id: "club-files", label: "Club Files", minPower: 10 },
      ],
    });

    // Chats
    const chatItems: NavItem[] = [
      { id: "chat_general", label: "General Chat", minPower: 10 },
      { id: "chat_advisory", label: "Advisory Chat", minPower: 50 },
      { id: "chat_board", label: "Board Chat", minPower: 100 },
    ];
    // Department chats — any member with a department sees their department's chat
    if (powerLevel >= 100) {
      departments.forEach((d: any) => {
        chatItems.push({ id: `chat_dept_${d.id}`, label: `${d.name} Chat`, minPower: 10 });
      });
    } else {
      const chatDeptIds = multiDeptRoles || (hasDepartment ? [departmentId!] : []);
      departments
        .filter((d: any) => chatDeptIds.includes(d.id))
        .forEach((d: any) => {
          chatItems.push({ id: `chat_dept_${d.id}`, label: `${d.name} Chat`, minPower: 10 });
        });
    }
    navSections.push({
      label: "Chats",
      items: chatItems.filter(item => {
        const room = item.id === "chat_general" ? "general"
          : item.id === "chat_advisory" ? "advisory"
          : item.id === "chat_board" ? "board"
          : item.id.startsWith("chat_dept_") ? "dept-" + item.id.slice(10)
          : "";
        return roomSettings[room] !== false;
      }),
    });

    // Departments (management panels)
    const deptItems: NavItem[] = [];
    if (powerLevel >= 100) {
      departments.forEach((d: any) => {
        deptItems.push({ id: `dept-${d.id}`, label: d.name, minPower: 0, deptId: d.id });
      });
    } else if (allowedDeptIds.length > 0) {
      departments
        .filter((d: any) => allowedDeptIds.includes(d.id))
        .forEach((d: any) => {
          deptItems.push({ id: `dept-${d.id}`, label: d.name, minPower: 0, deptId: d.id });
        });
    }
    if (deptItems.length > 0) {
      navSections.push({ label: "Departments", items: deptItems });
    }

    // Management
    const managementItems: NavItem[] = [
      { id: "meets", label: "Meets", minPower: 0 },
      { id: "projects", label: "Projects", minPower: 0 },
      { id: "instructions", label: "Instructions", minPower: 0 },
      { id: "recruitments", label: "Recruitments", minPower: 50 },
      { id: "transfers", label: "Transfers", minPower: 0 },
      { id: "announcements", label: "Announcements", minPower: 0 },
    ];
    // Room Settings for power >= 50
    if (powerLevel >= 50) {
      managementItems.push({ id: "room_settings", label: "Room Settings", minPower: 50 });
    }
    navSections.push({ label: "Management", items: managementItems });

    // Admin
    navSections.push({
      label: "Admin",
      items: [
        { id: "consulting", label: "Consulting", minPower: 100 },
        { id: "sendmail", label: "Send Mail", minPower: 100 },
        { id: "admin", label: "Admin Console", minPower: 100 },
      ],
    });
  }

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
      <div className={`members-sidebar ${sidebarOpen ? "open" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}>
        {sidebarCollapsed && (
          <button className="desktop-sidebar-toggle" onClick={() => {
            const next = !sidebarCollapsed;
            setSidebarCollapsed(next);
            localStorage.setItem("membersSidebarCollapsed", String(next));
          }} title="Expand sidebar"
            style={{ position: "absolute", top: "0.75rem", left: "50%", transform: "translateX(-50%)", zIndex: 11 }}>
            ☰
          </button>
        )}
        <div className="sidebar-header" style={{ display: sidebarCollapsed ? "none" : "block" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h2>180DC Portal</h2>
            <button className="desktop-sidebar-toggle" onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              localStorage.setItem("membersSidebarCollapsed", String(next));
            }} title="Collapse sidebar">
              ✕
            </button>
          </div>
          <div className="user-email">{email}</div>
          <div className="power-badge">&#9679; Power {powerLevel}</div>
        </div>
        <nav style={{ flex: 1, minHeight: 0, padding: "0.5rem 0", display: "flex", flexDirection: "column", gap: 1, overflowY: "auto" }}>
          {navSections.map((section) => {
            const visible = section.items.filter((n) => powerLevel >= n.minPower);
            if (visible.length === 0) return null;
            const isActive = (item: any) => item.deptId ? (activePanel === "department" && activeDeptId === item.deptId) : activePanel === item.id;
            return (
              <div key={section.label}>
                {section.label && !sidebarCollapsed && (
                  <div className="nav-section-label" onClick={() => toggleSection(section.label)}>
                    <span style={{ fontSize: 9, width: 12 }}>{expandedSections.has(section.label) ? "▼" : "▶"}</span>
                    {section.label}
                  </div>
                )}
                {!section.label || (!sidebarCollapsed && expandedSections.has(section.label)) || sidebarCollapsed ? visible.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.deptId) { setActiveDeptId(item.deptId); setActivePanel("department"); }
                      else setActivePanel(item.id);
                    }}
                    className={`nav-item${isActive(item) ? " active" : ""}${sidebarCollapsed ? " collapsed" : ""}`}
                    title={sidebarCollapsed ? item.label : undefined}
                  >
                    {sidebarCollapsed ? item.label.slice(0, 3) : item.label}
                  </button>
                )) : null}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer" style={{ display: sidebarCollapsed ? "none" : "flex" }}>
          <button onClick={toggleTheme} title={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            {isDark ? "☀" : "☾"} {isDark ? "Light" : "Dark"}
          </button>
          <button onClick={() => { sessionStorage.clear(); setAuthToken(null); }}>
            Logout
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className={`members-main ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <button className="mobile-sidebar-toggle" onClick={() => setSidebarOpen((o) => !o)}>{sidebarOpen ? "✕" : "☰"}</button>
        {activePanel === "dashboard" && (
          <>
            <h2 style={{ marginTop: 0 }}>Dashboard</h2>
              <div className="members-grid">
              <div className="dashboard-card">
                <h3>Personal Profile</h3>
                <p>{email}</p>
                {hasDepartment && (
                  <p style={{ color: "var(--primary-green)", fontWeight: 600, fontSize: 13, marginTop: 6 }}>{deptName} Department</p>
                )}
              </div>

              {powerLevel >= 50 && (
                <div className="dashboard-card">
                  <h3>Access Hub</h3>
                  <p>Visit all department websites from one place.</p>
                  <button className="btn" style={{ marginTop: 12 }} onClick={() => window.open("/departments", "_blank")}>
                    Open Access Hub
                  </button>
                </div>
              )}

              {hasDepartment && powerLevel >= 50 && (
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>{deptName} Department</h3>
                  <p>Manage meets, documents, instructions, and projects.</p>
                  <button className="btn" style={{ marginTop: 12 }} onClick={() => setActivePanel("department")}>
                    Open Department Panel
                  </button>
                </div>
              )}

              {announcements.length > 0 && (
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Recent Announcements</h3>
                  <div style={{ display: "grid", gap: 10, marginTop: 4 }}>
                    {announcements.slice(0, 3).map((a: any) => (
                      <div key={a.id} style={{
                        padding: "12px 14px", borderRadius: 10, border: "1px solid var(--border-light)",
                        background: "var(--bg-secondary)",
                      }}>
                        <strong style={{ fontSize: 14 }}>{a.title}</strong>
                        <div style={{ fontSize: 13, marginTop: 4, whiteSpace: "pre-wrap", color: "var(--text-secondary)", lineHeight: 1.5 }}>{a.content}</div>
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

        {activePanel === "members" && (
          <MembersSection authToken={authToken!} powerLevel={powerLevel} />
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

        {activePanel === "club-files" && (
          <ClubFilesPanel authToken={authToken!} />
        )}

        {activePanel.startsWith("chat") && (() => {
          let room: string;
          if (activePanel === "chat") room = "advisory";
          else if (activePanel.startsWith("chat_dept_")) room = "dept-" + activePanel.slice(10);
          else room = activePanel.replace("chat_", "");

          let roomName: string;
          if (room === "advisory") roomName = "Advisory Chat Room";
          else if (room === "general") roomName = "General Chat";
          else if (room === "board") roomName = "Board Chat Room";
          else if (room.startsWith("dept-")) {
            const deptId = room.slice(5);
            roomName = `${DEPT_NAMES[deptId] || departments.find((d: any) => d.id === deptId)?.name || deptId} Department Chat`;
          } else roomName = room;

          return <ChatSection authToken={authToken!} room={room} roomName={roomName} />;
        })()}

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

        {activePanel === "consulting" && powerLevel >= 100 && (
          <ConsultingRequestsSection authToken={authToken!} />
        )}

        {activePanel === "sendmail" && powerLevel >= 100 && (
          <SendMailSection authToken={authToken!} />
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

        {activePanel === "room_settings" && (
          <RoomSettingsPanel authToken={authToken!} powerLevel={powerLevel} departmentId={departmentId} roleId={roleId} departments={departments} />
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
                      <button className="btn outline" style={{ padding: "0.3rem 0.8rem", fontSize: 13, color: item.revoked_at ? "var(--text-secondary)" : "#e74c3c", borderColor: item.revoked_at ? "var(--border-light)" : "#e74c3c" }} onClick={async () => {
                        if (!confirm("Delete this token permanently?")) return;
                        const res = await fetch(apiUrl(`/api/admin-tokens/${item.email}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                        const data = await res.json();
                        if (data.success) setAdminTokens((prev) => prev.filter((t) => t.email !== item.email));
                      }}>{item.revoked_at ? "Remove" : "Delete"}</button>
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
                    <option value="technical_director">technical_director</option>
                    <option value="marketing_director">marketing_director</option>
                    <option value="secretary">secretary</option>
                    <option value="lead">Technical Lead</option>
                    <option value="lead_rnd">R&D Lead</option>
                    <option value="lead_marketing">Marketing Lead</option>
                    <option value="lead_social">Social Media Lead</option>
                    <option value="lead_finance">Finance Lead</option>
                    <option value="lead_events">Events Lead</option>
                    <option value="lead_cps">Client Partner Sponsor Lead</option>
                    <option value="lead_hr">HR Lead</option>
                  </select>
                  <select className="input" value={boardDepartmentId} onChange={(e) => setBoardDepartmentId(e.target.value)}>
                    <option value="">No department</option>
                    {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  <select className="input" value={boardSecondaryRoleId} onChange={(e) => setBoardSecondaryRoleId(e.target.value)} style={{ gridColumn: "1 / -1" }}>
                    <option value="">No secondary role</option>
                    {allRoles.filter((r: any) => r.id !== boardRoleId).map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                  <button className="btn" disabled={boardBusy} onClick={async () => {
                    if (!authToken || !boardEmail.trim()) { alert("Enter an email first"); return; }
                    setBoardBusy(true);
                    try {
                      const res = await fetch(apiUrl("/api/board-users"), {
                        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                        body: JSON.stringify({ email: boardEmail.trim(), name: boardName.trim(), roleId: boardRoleId, departmentId: boardDepartmentId || null, secondaryRoleId: boardSecondaryRoleId || null }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setAdminTokens((prev) => [data, ...prev]);
                        setBoardEmail(""); setBoardName(""); setBoardRoleId("president"); setBoardDepartmentId(""); setBoardSecondaryRoleId("");
                        setRecentToken(data.token); setShowRecentToken(false);
                        alert(`Board user created successfully.`);
                      } else alert(data.error);
                    } finally { setBoardBusy(false); }
                  }}>{boardBusy ? "Creating..." : "Create Board User"}</button>
                </div>
              </div>

              {/* ADVISORY BOARD MEMBER */}
              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Create Advisory Board Member</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  Create an advisory board member with an optional ex-title and optional active club member role.
                </p>
                <div className="admin-grid-4" style={{ marginTop: 16 }}>
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
                  <button className="btn" disabled={advisoryBusy} onClick={async () => {
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
                  <div className="floating-note" style={{ marginTop: 16, display: "inline-flex", gap: 10, alignItems: "center" }}>
                    <span>Token: {advisoryRecentToken.slice(0, 6)}...{advisoryRecentToken.slice(-4)}</span>
                    <button className="btn outline" style={{ padding: "0.45rem 0.9rem", boxShadow: "none" }} onClick={async () => {
                      await navigator.clipboard.writeText(advisoryRecentToken);
                      alert("Token copied");
                    }}>Copy</button>
                  </div>
                )}
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
                <div className="admin-grid-3" style={{ marginTop: 16 }}>
                  <div className="card-doodle" style={{ padding: 14, border: "1px solid var(--border-light)" }}>
                    <h4 style={{ margin: 0, fontSize: 15 }}>Change Role</h4>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <select className="input" value={dangerUserId} onChange={(e) => setDangerUserId(e.target.value)}>
                        <option value="">Select user</option>
                        {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email}) - {u.role_name}</option>)}
                      </select>
                      <select className="input" value={dangerNewRoleId} onChange={(e) => setDangerNewRoleId(e.target.value)}>
                        <option value="">Select new role</option>
                        {allRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <select className="input" value={dangerNewDeptId} onChange={(e) => setDangerNewDeptId(e.target.value)}>
                        <option value="">No department</option>
                        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                      <select className="input" value={dangerNewSecondaryRoleId} onChange={(e) => setDangerNewSecondaryRoleId(e.target.value)}>
                        <option value="">No secondary role</option>
                        {allRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      <button className="btn" style={{ background: "#e74c3c" }} disabled={dangerBusy} onClick={async () => {
                        if (!dangerUserId || !dangerNewRoleId) { alert("Select user and role"); return; }
                        setDangerBusy(true);
                        try {
                          const res = await fetch(apiUrl(`/api/members/${dangerUserId}/role`), {
                            method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                            body: JSON.stringify({ newRoleId: dangerNewRoleId, departmentId: dangerNewDeptId || null, secondaryRoleId: dangerNewSecondaryRoleId || null }),
                          });
                          const data = await res.json();
                          if (data.success) { alert("Role updated. Email sent."); setDangerUserId(""); setDangerNewRoleId(""); setDangerNewDeptId(""); setDangerNewSecondaryRoleId(""); }
                          else alert(data.error);
                        } finally { setDangerBusy(false); }
                      }}>{dangerBusy ? "Updating..." : "Update Role"}</button>
                      {dangerBusy && <FullPageLoader message="Updating role and sending email..." />}
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
                  <div className="card-doodle" style={{ padding: 14, border: "1px solid var(--border-light)" }}>
                    <h4 style={{ margin: 0, fontSize: 15 }}>Board Advisory Change</h4>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                      Move a user to advisory board with an ex-title and optional club member department.
                    </p>
                    <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                      <select className="input" value={dangerAdvUserId} onChange={(e) => {
                        setDangerAdvUserId(e.target.value);
                        const u = allUsers.find((x: any) => x.id === e.target.value);
                        setDangerAdvExTitle(u?.ex_title || "");
                        setDangerAdvDeptId(u?.secondary_role_id === "member" ? u.department_id || "" : "");
                      }}>
                        <option value="">Select user</option>
                        {allUsers.filter((u: any) => u.role_id !== "advisory").map((u: any) => (
                          <option key={u.id} value={u.id}>{u.name} ({u.email}) - {u.role_name}</option>
                        ))}
                      </select>
                      <select className="input" value={dangerAdvExTitle} onChange={(e) => setDangerAdvExTitle(e.target.value)}>
                        <option value="">No ex-title</option>
                        {EX_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select className="input" value={dangerAdvDeptId} onChange={(e) => setDangerAdvDeptId(e.target.value)}>
                        <option value="">Not a club member (advisory only)</option>
                        {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name} (as member)</option>)}
                      </select>
                      <button className="btn" style={{ background: "#e74c3c" }} disabled={dangerAdvBusy} onClick={async () => {
                        if (!dangerAdvUserId) { alert("Select a user"); return; }
                        if (!confirm("Move this user to advisory board?")) return;
                        setDangerAdvBusy(true);
                        try {
                          const res = await fetch(apiUrl(`/api/members/${dangerAdvUserId}/role`), {
                            method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                            body: JSON.stringify({
                              newRoleId: "advisory",
                              departmentId: dangerAdvDeptId || null,
                              secondaryRoleId: dangerAdvDeptId ? "member" : null,
                              exTitle: dangerAdvExTitle || null,
                            }),
                          });
                          const data = await res.json();
                          if (data.success) {
                            alert("User moved to advisory board. Email sent.");
                            setDangerAdvUserId(""); setDangerAdvExTitle(""); setDangerAdvDeptId("");
                          } else alert(data.error);
                        } finally { setDangerAdvBusy(false); }
                      }}>{dangerAdvBusy ? "Updating..." : "Move to Advisory"}</button>
                      {dangerAdvBusy && <FullPageLoader message="Updating role and sending email..." />}
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
