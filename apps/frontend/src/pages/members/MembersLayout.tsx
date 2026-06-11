/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
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
  const { userId: clerkUserId, getToken, isLoaded: clerkLoaded } = useAuth();
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
  const [oauthEnabled, setOauthEnabled] = useState(false);
  const [oauthStatusMsg, setOauthStatusMsg] = useState<string | null>(null);

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
          setOauthEnabled(data.user?.oauthEnabled ?? false);
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

  // Clerk callback handler — runs after OAuth redirect
  const linkingFlag = useRef(false);
  useEffect(() => {
    if (!clerkLoaded) return;
    if (!clerkUserId) return;

    const pending = sessionStorage.getItem("clnk");

    async function handleClerkCallback() {
      // Login flow: Clerk session exists but no token session
      if (!authToken) {
        try {
          const clerkJwt = await getToken();
          if (!clerkJwt) return;
          const res = await fetch(apiUrl("/api/auth/clerk-login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clerkToken: clerkJwt }),
          });
          const data = await res.json();
          if (data.success) {
            handleLogin(data.token, data.email, data.powerLevel, data.departmentId, data.roleId);
            setOauthStatusMsg("Logged in with Google");
            setTimeout(() => setOauthStatusMsg(null), 4000);
          } else {
            setOauthStatusMsg(data.error || "Google login failed");
          }
          return;
        } catch {
          setOauthStatusMsg("Google login failed. Try again.");
          return;
        }
      }

      // Linking flow: Clerk session + existing token + linking flag
      if (authToken && pending === "link" && !linkingFlag.current) {
        linkingFlag.current = true;
        sessionStorage.removeItem("clnk");
        try {
          const res = await fetch(apiUrl("/api/auth/link-clerk"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify({ clerkUserId }),
          });
          const data = await res.json();
          if (data.success) {
            setOauthEnabled(true);
            setOauthStatusMsg("Google login enabled! You can now sign in with Google.");
            setTimeout(() => setOauthStatusMsg(null), 5000);
          } else {
            setOauthStatusMsg(data.error || "Failed to link Google account");
          }
        } catch {
          setOauthStatusMsg("Failed to link Google account. Try again.");
        }
      }
    }

    handleClerkCallback();
  }, [clerkUserId, clerkLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasDepartment = departmentId && DEPT_NAMES[departmentId];
  const deptName = hasDepartment ? DEPT_NAMES[departmentId!] : "";

  type NavItem = { id: string; label: string; minPower: number; deptId?: string; icon: string };
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
        { id: "dashboard", label: "Dashboard", minPower: 0, icon: "dashboard" },
        { id: "profile", label: "Profile", minPower: 0, icon: "person" },
        { id: "chat", label: "Advisory Chat", minPower: 30, icon: "chat" },
      ],
    });
  } else {
    // General
    navSections.push({
      label: "General",
      items: [
        { id: "dashboard", label: "Dashboard", minPower: 0, icon: "dashboard" },
        { id: "members", label: "Members", minPower: 10, icon: "groups" },
        { id: "profile", label: "Profile", minPower: 0, icon: "person" },
        { id: "club-files", label: "Club Files", minPower: 10, icon: "folder_open" },
      ],
    });

    // Chats
    const chatItems: NavItem[] = [
      { id: "chat_general", label: "General Chat", minPower: 10, icon: "forum" },
      { id: "chat_advisory", label: "Advisory Chat", minPower: 50, icon: "admin_panel_settings" },
      { id: "chat_board", label: "Board Chat", minPower: 100, icon: "shield_person" },
    ];
    // Department chats — any member with a department sees their department's chat
    if (powerLevel >= 100) {
      departments.forEach((d: any) => {
        chatItems.push({ id: `chat_dept_${d.id}`, label: `${d.name} Chat`, minPower: 10, icon: "chat_bubble" });
      });
    } else {
      const chatDeptIds = multiDeptRoles || (hasDepartment ? [departmentId!] : []);
      departments
        .filter((d: any) => chatDeptIds.includes(d.id))
        .forEach((d: any) => {
          chatItems.push({ id: `chat_dept_${d.id}`, label: `${d.name} Chat`, minPower: 10, icon: "chat_bubble" });
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
        deptItems.push({ id: `dept-${d.id}`, label: d.name, minPower: 0, deptId: d.id, icon: "domain" });
      });
    } else if (allowedDeptIds.length > 0) {
      departments
        .filter((d: any) => allowedDeptIds.includes(d.id))
        .forEach((d: any) => {
          deptItems.push({ id: `dept-${d.id}`, label: d.name, minPower: 0, deptId: d.id, icon: "domain" });
        });
    }
    if (deptItems.length > 0) {
      navSections.push({ label: "Departments", items: deptItems });
    }

    // Management
    const managementItems: NavItem[] = [
      { id: "meets", label: "Meets", minPower: 0, icon: "event" },
      { id: "projects", label: "Projects", minPower: 0, icon: "account_tree" },
      { id: "instructions", label: "Instructions", minPower: 0, icon: "menu_book" },
      { id: "recruitments", label: "Recruitments", minPower: 50, icon: "person_add" },
      { id: "transfers", label: "Transfers", minPower: 0, icon: "swap_horiz" },
      { id: "announcements", label: "Announcements", minPower: 0, icon: "campaign" },
    ];
    // Room Settings for power >= 50
    if (powerLevel >= 50) {
      managementItems.push({ id: "room_settings", label: "Room Settings", minPower: 50, icon: "settings" });
    }
    navSections.push({ label: "Management", items: managementItems });

    // Admin
    navSections.push({
      label: "Admin",
      items: [
        { id: "consulting", label: "Consulting", minPower: 100, icon: "business_center" },
        { id: "sendmail", label: "Send Mail", minPower: 100, icon: "alternate_email" },
        { id: "admin", label: "Admin Console", minPower: 100, icon: "terminal" },
      ],
    });
  }

  if (!authToken) return <MembersLogin onLogin={handleLogin} />;
  if (!dashboardReady) {
    return (
      <div style={{ backgroundColor: "var(--bg-primary)", minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="card-doodle">Loading dashboard...</div>
      </div>
    );
  }

  const activeLabel = (() => {
    for (const section of navSections) {
      const item = section.items.find(i => i.id === activePanel || (i.deptId && activePanel === "department" && activeDeptId === i.deptId));
      if (item) return item.label;
    }
    return activePanel.charAt(0).toUpperCase() + activePanel.slice(1);
  })();

  return (
    <div className="members-layout">
      {/* HEADER */}
      <header className="members-header">
        <div className="header-left">
          <a href="#" className="header-logo" onClick={(e) => { e.preventDefault(); setActivePanel("dashboard"); }}>180DC Portal</a>
          <div className="search-container">
            <span className="material-symbols-outlined search-icon">search</span>
            <input type="text" className="search-input" placeholder="Search..." />
          </div>
        </div>
        <div className="header-right">
          <button className="header-action-btn">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <button className="header-action-btn" onClick={toggleTheme}>
            <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
          </button>
          <div className="user-profile-trigger" onClick={() => setActivePanel("profile")}>
            <div className="avatar-circle">
              {email?.[0].toUpperCase()}
            </div>
            <div className="user-info-brief">
              <span className="user-name">{email?.split("@")[0]}</span>
              <span className="user-power">Power {powerLevel}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="layout-wrapper">
        {/* SIDEBAR */}
        <aside className={`members-sidebar ${sidebarCollapsed ? "collapsed" : ""}`}>
          <nav className="sidebar-nav">
            {navSections.map((section) => {
              const visible = section.items.filter((n) => powerLevel >= n.minPower);
              if (visible.length === 0) return null;
              const isActive = (item: any) => item.deptId ? (activePanel === "department" && activeDeptId === item.deptId) : activePanel === item.id;
              return (
                <div key={section.label}>
                  {section.label && !sidebarCollapsed && (
                    <div className="nav-section-label" onClick={() => toggleSection(section.label)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                        {expandedSections.has(section.label) ? "keyboard_arrow_down" : "keyboard_arrow_right"}
                      </span>
                      {section.label}
                    </div>
                  )}
                  {(!section.label || (!sidebarCollapsed && expandedSections.has(section.label)) || sidebarCollapsed) ? visible.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.deptId) { setActiveDeptId(item.deptId); setActivePanel("department"); }
                        else setActivePanel(item.id);
                      }}
                      className={`nav-item ${isActive(item) ? "active" : ""} ${sidebarCollapsed ? "collapsed" : ""}`}
                      title={sidebarCollapsed ? item.label : undefined}
                    >
                      <span className="material-symbols-outlined">{item.icon}</span>
                      {!sidebarCollapsed && <span>{item.label}</span>}
                    </button>
                  )) : null}
                </div>
              );
            })}
          </nav>
          <div className="sidebar-footer">
            <button className="nav-item" onClick={() => {
              const next = !sidebarCollapsed;
              setSidebarCollapsed(next);
              localStorage.setItem("membersSidebarCollapsed", String(next));
            }}>
              <span className="material-symbols-outlined">{sidebarCollapsed ? "side_navigation" : "menu_open"}</span>
              {!sidebarCollapsed && <span>{sidebarCollapsed ? "Expand" : "Collapse"} Sidebar</span>}
            </button>
            <button className="nav-item" onClick={() => { sessionStorage.clear(); setAuthToken(null); }} style={{ color: "#ef4444" }}>
              <span className="material-symbols-outlined">logout</span>
              {!sidebarCollapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main className={`members-main ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
          <div style={{ marginBottom: "1.5rem" }}>
             <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>{activeLabel}</h1>
             {activePanel === "dashboard" && <p style={{ color: "var(--text-secondary)", margin: "4px 0 0", fontSize: "14px" }}>Welcome back, here's what's happening.</p>}
          </div>

          {activePanel === "dashboard" && (
            <>
              <div className="dashboard-grid">
                <div className="kpi-card">
                  <div className="kpi-header">
                    <div className="kpi-icon-wrapper" style={{ background: "rgba(141, 198, 63, 0.15)", color: "var(--primary-green)" }}>
                      <span className="material-symbols-outlined">account_tree</span>
                    </div>
                    <span className="kpi-trend trend-up">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>trending_up</span>
                      +12%
                    </span>
                  </div>
                  <span className="kpi-label">Active Projects</span>
                  <span className="kpi-value">42</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <div className="kpi-icon-wrapper" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                      <span className="material-symbols-outlined">groups</span>
                    </div>
                  </div>
                  <span className="kpi-label">Total Members</span>
                  <span className="kpi-value">248</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <div className="kpi-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                      <span className="material-symbols-outlined">event_available</span>
                    </div>
                    <span className="kpi-trend trend-down">
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>trending_down</span>
                      -5%
                    </span>
                  </div>
                  <span className="kpi-label">Upcoming Meets</span>
                  <span className="kpi-value">8</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <div className="kpi-icon-wrapper" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}>
                      <span className="material-symbols-outlined">campaign</span>
                    </div>
                  </div>
                  <span className="kpi-label">Announcements</span>
                  <span className="kpi-value">{announcements.length}</span>
                </div>
              </div>

              <div className="members-grid" style={{ marginTop: "1.5rem" }}>
                <div className="dashboard-card">
                  <h3>Personal Profile</h3>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px" }}>
                    <div className="avatar-circle" style={{ width: 48, height: 48, fontSize: 18 }}>{email?.[0].toUpperCase()}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{email}</div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{hasDepartment ? `${deptName} Department` : "No Department"}</div>
                    </div>
                  </div>
                  <button className="btn outline" style={{ marginTop: 16, width: "100%" }} onClick={() => setActivePanel("profile")}>View Profile</button>
                </div>

                {powerLevel >= 50 && (
                  <div className="dashboard-card">
                    <h3>Access Hub</h3>
                    <p>Visit all department websites and manage cross-department resources from one central place.</p>
                    <button className="btn" style={{ marginTop: 16, width: "100%" }} onClick={() => window.open("/departments", "_blank")}>
                      Open Access Hub
                    </button>
                  </div>
                )}

                {hasDepartment && powerLevel >= 50 && (
                  <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                       <h3>{deptName} Department Panel</h3>
                       <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>domain</span>
                    </div>
                    <p>Quick access to your department's meets, documents, instructions, and active projects.</p>
                    <button className="btn" style={{ marginTop: 16 }} onClick={() => setActivePanel("department")}>
                      Open Department Panel
                    </button>
                  </div>
                )}

                {announcements.length > 0 && (
                  <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3>Recent Announcements</h3>
                      <button className="btn outline" style={{ padding: "4px 12px", fontSize: 12 }} onClick={() => setActivePanel("announcements")}>View All</button>
                    </div>
                    <div style={{ display: "grid", gap: 12 }}>
                      {announcements.slice(0, 3).map((a: any) => (
                        <div key={a.id} style={{
                          padding: "16px", borderRadius: 12, border: "1px solid var(--border-light)",
                          background: "var(--surface)",
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                            <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{a.title}</strong>
                            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{a.created_at?.slice(0, 10)}</span>
                          </div>
                          <div style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap", color: "var(--text-secondary)", lineHeight: 1.5 }}>{a.content}</div>
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
              oauthEnabled={oauthEnabled}
              statusMsg={oauthStatusMsg}
              onOAuthStatusChange={setOauthStatusMsg}
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
              <div className="members-grid">
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Club-Wide Meets</h3>
                  <ClubMeetsSection authToken={authToken!} powerLevel={powerLevel} />
                </div>
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Inter-Department Meets</h3>
                  <InterDeptMeetsSection authToken={authToken!} departments={departments} powerLevel={powerLevel} />
                </div>
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
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
            <ProjectsSection
              authToken={authToken!}
              departments={departments}
              allUsers={allUsers}
              powerLevel={powerLevel}
              departmentId={departmentId}
            />
          )}

          {activePanel === "instructions" && (
            <div className="members-grid">
              <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                {!departmentId ? (
                  <p style={{ color: "var(--text-secondary)" }}>You are not assigned to any department.</p>
                ) : (
                  <InstructionsSection authToken={authToken!} departmentId={departmentId!} />
                )}
              </div>
            </div>
          )}

          {activePanel === "transfers" && (
            <div className="members-grid">
              <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                <TransfersSection authToken={authToken!} />
              </div>
            </div>
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
            <div className="members-grid">
              {powerLevel >= 100 && (
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Post Announcement</h3>
                  <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
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
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <p style={{ color: "var(--text-secondary)" }}>No announcements yet.</p>
                </div>
              )}

              {announcements.map((a: any) => (
                <div key={a.id} className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0 }}>{a.title}</h3>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>{a.created_at?.slice(0, 10)}</div>
                      <div style={{ marginTop: 12, whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontSize: 14 }}>{a.content}</div>
                    </div>
                    {powerLevel >= 100 && (
                      <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={async () => {
                        if (!confirm("Delete this announcement?")) return;
                        await fetch(apiUrl(`/api/announcements/${a.id}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                        setAnnouncements(announcements.filter((x: any) => x.id !== a.id));
                      }}>
                        <span className="material-symbols-outlined">delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activePanel === "room_settings" && (
            <RoomSettingsPanel authToken={authToken!} powerLevel={powerLevel} departmentId={departmentId} roleId={roleId} departments={departments} />
          )}

          {activePanel === "admin" && powerLevel >= 100 && (
            <>
              <AdminDataLoader authToken={authToken!} setAllUsers={setAllUsers} setAllRoles={setAllRoles} />
              <div className="members-grid">
                {/* TOKEN REGISTRY */}
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Admin Token Registry</h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
                    Generate tokens for members, leads, or board accounts.
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
                    <div className="dashboard-card" style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center", padding: "12px", background: "var(--surface)" }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Latest token: {showRecentToken ? recentToken : maskToken(recentToken)}</span>
                      <button className="btn outline" style={{ padding: "6px 12px" }} onClick={async () => { await navigator.clipboard.writeText(recentToken); alert("Token copied"); }}>Copy</button>
                      <button className="btn outline" style={{ padding: "6px 12px" }} onClick={() => setShowRecentToken((v) => !v)}>{showRecentToken ? "Hide" : "Reveal"}</button>
                    </div>
                  )}

                  <div style={{ display: "grid", gap: 10, marginTop: 16, maxHeight: 400, overflowY: "auto", paddingRight: 4 }}>
                    {adminTokens.length === 0 && <p style={{ fontSize: 13, color: "var(--text-tertiary)" }}>No tokens created yet.</p>}
                    {adminTokens.map((item) => (
                      <div key={item.token} style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--surface)", borderRadius: 10, border: "1px solid var(--border-light)" }}>
                        <div>
                          <strong style={{ fontSize: 14 }}>{item.name || item.email}</strong>
                          <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{item.email} · {item.role_id}</div>
                          <div style={{ marginTop: 4, fontFamily: "monospace", fontSize: 11, color: "var(--text-tertiary)" }}>{item.tokenPreview || item.token}</div>
                        </div>
                        <button className="header-action-btn" style={{ color: "#ef4444" }} onClick={async () => {
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

                {/* BOARD USER */}
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Create Board Member</h3>
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
                    <button className="btn" disabled={boardBusy} style={{ gridColumn: "1 / -1" }} onClick={async () => {
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
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Create Advisory Board Member</h3>
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
                </div>

                {/* MEMBER */}
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Create Member</h3>
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
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <h3>Pending Signup Requests</h3>
                  {pendingRequests.length === 0 ? <p style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 8 }}>No pending requests.</p> : (
                    <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
                      {pendingRequests.map((r) => (
                        <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, background: "var(--surface)", borderRadius: 12, border: "1px solid var(--border-light)" }}>
                          <div>
                            <strong style={{ fontSize: 14 }}>{r.name}</strong>
                            <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>{r.email}</div>
                            {r.department_id && (
                              <div style={{ fontSize: 11, marginTop: 2, color: "var(--primary-green)", fontWeight: 600 }}>
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
                            <button className="btn outline" style={{ padding: "6px 12px" }} onClick={async () => {
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

                {/* DANGER ZONE */}
                <div className="dashboard-card" style={{ gridColumn: "1 / -1", borderColor: "#ef4444" }}>
                  <h3 style={{ color: "#ef4444" }}>Danger Zone</h3>
                  <div className="admin-grid-2" style={{ marginTop: 16 }}>
                    <div style={{ background: "var(--surface)", padding: 16, borderRadius: 12, border: "1px solid var(--border-light)" }}>
                      <h4 style={{ margin: 0, fontSize: 14 }}>Change Role</h4>
                      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                        <select className="input" style={{ padding: "0.75rem" }} value={dangerUserId} onChange={(e) => setDangerUserId(e.target.value)}>
                          <option value="">Select user</option>
                          {allUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                        </select>
                        <select className="input" style={{ padding: "0.75rem" }} value={dangerNewRoleId} onChange={(e) => setDangerNewRoleId(e.target.value)}>
                          <option value="">Select new role</option>
                          {allRoles.map((r: any) => <option key={r.id} value={r.id}>{r.name}</option>)}
                        </select>
                        <button className="btn" style={{ background: "#ef4444" }} disabled={dangerBusy} onClick={async () => {
                          if (!dangerUserId || !dangerNewRoleId) return;
                          setDangerBusy(true);
                          try {
                            const res = await fetch(apiUrl(`/api/members/${dangerUserId}/role`), {
                              method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
                              body: JSON.stringify({ newRoleId: dangerNewRoleId, departmentId: dangerNewDeptId || null }),
                            });
                            const data = await res.json();
                            if (data.success) { alert("Role updated"); setDangerUserId(""); setDangerNewRoleId(""); }
                            else alert(data.error);
                          } finally { setDangerBusy(false); }
                        }}>Update Role</button>
                      </div>
                    </div>

                    <div style={{ background: "var(--surface)", padding: 16, borderRadius: 12, border: "1px solid var(--border-light)" }}>
                      <h4 style={{ margin: 0, fontSize: 14 }}>Delete User</h4>
                      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                        <select className="input" style={{ padding: "0.75rem" }} value={deleteUserId} onChange={(e) => setDeleteUserId(e.target.value)}>
                          <option value="">Select user</option>
                          {allUsers.filter((u: any) => u.power_level < 100).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <button className="btn" style={{ background: "#ef4444" }} disabled={deleteBusy} onClick={async () => {
                          if (!deleteUserId || !confirm("Delete user?")) return;
                          setDeleteBusy(true);
                          try {
                            const res = await fetch(apiUrl(`/api/members/${deleteUserId}`), { method: "DELETE", headers: { Authorization: `Bearer ${authToken}` } });
                            const data = await res.json();
                            if (data.success) { alert("User deleted"); setDeleteUserId(""); }
                            else alert(data.error);
                          } finally { setDeleteBusy(false); }
                        }}>Delete User</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-bottom-nav">
        <button className={`mobile-nav-item ${activePanel === "dashboard" ? "active" : ""}`} onClick={() => setActivePanel("dashboard")}>
          <span className="material-symbols-outlined">dashboard</span>
          <span>Home</span>
        </button>
        <button className={`mobile-nav-item ${activePanel === "projects" ? "active" : ""}`} onClick={() => setActivePanel("projects")}>
          <span className="material-symbols-outlined">account_tree</span>
          <span>Projects</span>
        </button>
        <button className={`mobile-nav-item ${activePanel.startsWith("chat") ? "active" : ""}`} onClick={() => setActivePanel("chat_general")}>
          <span className="material-symbols-outlined">forum</span>
          <span>Chats</span>
        </button>
        <button className={`mobile-nav-item ${activePanel === "profile" ? "active" : ""}`} onClick={() => setActivePanel("profile")}>
          <span className="material-symbols-outlined">person</span>
          <span>Profile</span>
        </button>
      </nav>

      {/* FAB */}
      {powerLevel >= 100 && activePanel === "dashboard" && (
        <button className="fab" onClick={() => setActivePanel("announcements")} title="Post Announcement">
          <span className="material-symbols-outlined">add</span>
        </button>
      )}
    </div>
  );
}
