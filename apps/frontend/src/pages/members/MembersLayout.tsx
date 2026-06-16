/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth, useClerk } from "@clerk/react";
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
import ConsultingRequestsSection from "./ConsultingRequestsSection";
import SendMailSection from "./SendMailSection";
import RoomSettingsPanel from "./RoomSettingsPanel";
import BlogSection from "./BlogSection";
import CaseStudySection from "./CaseStudySection";
import TransfersSection from "./TransfersSection";
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
  const clerk = useClerk();
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
  const [stats, setStats] = useState({ membersCount: 0, projectsCount: 0, upcomingMeetsCount: 0, announcementsCount: 0, todayEmailCount: 0 });
  const [recentMeets, setRecentMeets] = useState<any[]>([]);

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

  const [transferFromUserId, setTransferFromUserId] = useState("");
  const [transferToUserId, setTransferToUserId] = useState("");
  const [transferRoleId, setTransferRoleId] = useState("");
  const [transferBusy, setTransferBusy] = useState(false);

  const [dangerUserId, setDangerUserId] = useState("");
  const [dangerNewRoleId, setDangerNewRoleId] = useState("");
  const [dangerNewDeptId, setDangerNewDeptId] = useState("");
  const [dangerBusy, setDangerBusy] = useState(false);

  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

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
  const [dangerAdvBusy, setDangerAdvBusy] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["General", "Chats", "Departments", "Management", "Admin"]));
  const [mobileSheetSection, setMobileSheetSection] = useState<string | null>(null);
  const [roomSettings, setRoomSettings] = useState<Record<string, boolean>>({});
  const [oauthEnabled, setOauthEnabled] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthStatusMsg, setOauthStatusMsg] = useState<string | null>(null);
  const [maintenanceMode, setMaintenanceMode] = useState<{ enabled: boolean; message: string } | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  // Auto-logout after 7 days of inactivity
  useEffect(() => {
    const expiresAt = localStorage.getItem("authExpiresAt");
    if (expiresAt && Date.now() > Number(expiresAt)) {
      localStorage.removeItem("authExpiresAt");
      sessionStorage.clear();
      sessionStorage.setItem("loggedOut", "true");
      setAuthToken(null);
      clerk.signOut().catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Day index (Mon=0..Sun=6) in IST for the Club Activity chart
  const todayIndex = (() => {
    const day = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kolkata", weekday: "short" }).format(new Date());
    return { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 }[day] ?? 3;
  })();

  const handleClickOutsideNotif = useCallback((e: MouseEvent) => {
    if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
      setShowNotifications(false);
    }
  }, []);

  useEffect(() => {
    if (showNotifications) {
      document.addEventListener("mousedown", handleClickOutsideNotif);
    } else {
      document.removeEventListener("mousedown", handleClickOutsideNotif);
    }
    return () => document.removeEventListener("mousedown", handleClickOutsideNotif);
  }, [showNotifications, handleClickOutsideNotif]);

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

  useEffect(() => {
    fetch(apiUrl("/api/admin/maintenance"))
      .then(r => r.json())
      .then(d => setMaintenanceMode({ enabled: !!d.enabled, message: d.message || "" }))
      .catch(() => setMaintenanceMode({ enabled: false, message: "" }));
  }, []);

  const maskToken = (token: string) =>
    token.length <= 8 ? `${token.slice(0, 3)}…` : `${token.slice(0, 6)}…${token.slice(-4)}`;

  const handleLogin = (
    token: string,
    userEmail: string,
    serverPowerLevel?: number,
    serverDepartmentId?: string,
    serverRoleId?: string,
  ) => {
    sessionStorage.removeItem("loggedOut");
    localStorage.setItem("authExpiresAt", String(Date.now() + 7 * 24 * 60 * 60 * 1000));
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
          if (data.stats) setStats(data.stats);
          if (data.recentMeets) setRecentMeets(data.recentMeets);
          setOauthEnabled(data.user?.oauthEnabled ?? false);
          setPendingRequests(data.pendingRequests || []);
          setAdminTokens(data.adminTokens || []);
          setAnnouncements(data.announcements || []);
          setRoleTransfers(data.roleTransfers || []);
          if (data.departments) setDepartments(data.departments);
          setDashboardReady(true);
        } else {
          setDashboardReady(true);
        }
      } catch {
        setDashboardReady(true);
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
      // If Clerk re-authenticated after logout, clear the flag
      if (sessionStorage.getItem("loggedOut")) {
        if (authToken) return; // already logged in with a token
        sessionStorage.removeItem("loggedOut"); // fresh Clerk session after logout — proceed
      }

      // Login flow: Clerk session exists but no token session
      if (!authToken) {
        setOauthLoading(true);
        try {
          // Retry getToken() a few times — Clerk may not have the JWT ready after OAuth redirect
          let clerkJwt: string | null = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            clerkJwt = await getToken();
            if (clerkJwt) break;
            await new Promise(r => setTimeout(r, 500));
          }
          if (!clerkJwt) { setOauthLoading(false); setOauthStatusMsg("Google sign-in is taking longer than expected. Try again."); return; }
          const clerkUserEmail = clerk.user?.primaryEmailAddress?.emailAddress || null;
          const res = await fetch(apiUrl("/api/auth/clerk-login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clerkToken: clerkJwt, email: clerkUserEmail }),
          });
          const data = await res.json();
          setOauthLoading(false);
          if (data.success) {
            handleLogin(data.token, data.email, data.powerLevel, data.departmentId, data.roleId);
            setOauthStatusMsg(null);
          } else {
            setOauthStatusMsg(data.error || "Google login failed");
          }
          return;
        } catch {
          setOauthLoading(false);
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
  }, [clerkUserId, clerkLoaded, authToken, getToken]); // eslint-disable-line react-hooks/exhaustive-deps

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
        { id: "members", label: "Members", minPower: 0, icon: "groups" },
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
      { id: "case-studies", label: "Case Studies", minPower: 0, icon: "description" },
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
        { id: "blogs", label: "Blogs", minPower: 100, icon: "article" },
        { id: "consulting", label: "Consulting", minPower: 100, icon: "business_center" },
        { id: "sendmail", label: "Send Mail", minPower: 100, icon: "alternate_email" },
        { id: "admin", label: "Admin Console", minPower: 100, icon: "terminal" },
      ],
    });
  }

  if (!authToken) return <MembersLogin onLogin={handleLogin} oauthLoading={oauthLoading} oauthError={oauthStatusMsg} />;

  if (maintenanceMode?.enabled && powerLevel < 100) {
    return (
      <div style={{ backgroundColor: "var(--bg-primary)", minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div className="card-doodle" style={{ maxWidth: 480, textAlign: "center", padding: 40 }}>
          <h2 style={{ margin: "0 0 12px" }}>Under Maintenance</h2>
          <p style={{ color: "var(--text-secondary)", margin: 0, lineHeight: 1.6 }}>
            {maintenanceMode.message || "The members portal is currently under maintenance. Please check back later."}
          </p>
          <button className="btn" style={{ marginTop: 24 }} onClick={() => { sessionStorage.clear(); setAuthToken(null); }}>
            Back to Home
          </button>
        </div>
      </div>
    );
  }

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
          <div ref={notifRef} style={{ position: "relative" }}>
            <button className="header-action-btn" onClick={() => setShowNotifications(v => !v)}>
              <span className="material-symbols-outlined">notifications</span>
              {announcements.length > 0 && (
                <span style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }} />
              )}
            </button>
            {showNotifications && (
              <div style={{ position: "absolute", top: "100%", right: 0, zIndex: 1000, width: 320, background: "var(--bg-card)", border: "1px solid var(--border-light)", borderRadius: 12, boxShadow: "var(--shadow-lg)", padding: "0.75rem", marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", padding: "0.25rem 0.5rem 0.5rem", borderBottom: "1px solid var(--border-light)", marginBottom: 4 }}>Notifications</div>
                {announcements.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "1rem 0.5rem", margin: 0, textAlign: "center" }}>No notifications</p>
                ) : (
                  announcements.slice(0, 2).map((a: any) => (
                    <div key={a.id} style={{ padding: "0.5rem", borderRadius: 8, cursor: "pointer" }} onClick={() => { setShowNotifications(false); setActivePanel("announcements"); }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.content}</div>
                    </div>
                  ))
                )}
                {announcements.length > 2 && (
                  <div style={{ padding: "0.5rem", textAlign: "center", borderTop: "1px solid var(--border-light)", marginTop: 4 }}>
                    <button className="btn outline" style={{ padding: "4px 12px", fontSize: 11, width: "100%", justifyContent: "center" }} onClick={() => { setShowNotifications(false); setActivePanel("announcements"); }}>View All</button>
                  </div>
                )}
              </div>
            )}
          </div>
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
            <button className="nav-item" onClick={async () => { sessionStorage.clear(); sessionStorage.setItem("loggedOut", "true"); setAuthToken(null); try { await clerk.signOut(); } catch {} }} style={{ color: "#ef4444" }}>
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
                  </div>
                  <span className="kpi-label">Active Projects</span>
                  <span className="kpi-value">{stats.projectsCount}</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <div className="kpi-icon-wrapper" style={{ background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" }}>
                      <span className="material-symbols-outlined">groups</span>
                    </div>
                  </div>
                  <span className="kpi-label">Total Members</span>
                  <span className="kpi-value">{stats.membersCount}</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <div className="kpi-icon-wrapper" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" }}>
                      <span className="material-symbols-outlined">event_available</span>
                    </div>
                  </div>
                  <span className="kpi-label">Upcoming Meets</span>
                  <span className="kpi-value">{stats.upcomingMeetsCount}</span>
                </div>

                <div className="kpi-card">
                  <div className="kpi-header">
                    <div className="kpi-icon-wrapper" style={{ background: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" }}>
                      <span className="material-symbols-outlined">campaign</span>
                    </div>
                  </div>
                  <span className="kpi-label">Announcements</span>
                  <span className="kpi-value">{stats.announcementsCount}</span>
                </div>
              </div>

              <div className="members-grid" style={{ marginTop: "1.5rem" }}>
                <div className="dashboard-card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                   <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h3 style={{ margin: 0, fontSize: "1rem" }}>Club Activity</h3>
                      <span style={{ fontSize: 11, color: "var(--text-tertiary)", fontWeight: 700, textTransform: "uppercase" }}>Last 7 Days</span>
                   </div>
                    <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 100, padding: "10px 0" }}>
                       {[35, 60, 40, 85, 55, 75, 50].map((h, i) => (
                         <div key={i} style={{ flex: 1, height: `${h}%`, background: i === todayIndex ? "var(--primary-green)" : "var(--surface-container-high)", borderRadius: "4px 4px 0 0", transition: "height 0.3s" }} />
                       ))}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-tertiary)", fontWeight: 800 }}>
                       <span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span>
                    </div>
                </div>

                <div className="dashboard-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: "1rem" }}>Member Composition</h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                       <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Executive Board</span>
                          <span>12%</span>
                       </div>
                       <div style={{ height: 6, background: "var(--surface-container-high)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: "12%", height: "100%", background: "var(--primary-green)" }} />
                       </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                       <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                          <span style={{ color: "var(--text-secondary)" }}>Lead Consultants</span>
                          <span>28%</span>
                       </div>
                       <div style={{ height: 6, background: "var(--surface-container-high)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: "28%", height: "100%", background: "#3b82f6" }} />
                       </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                       <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                          <span style={{ color: "var(--text-secondary)" }}>General Members</span>
                          <span>60%</span>
                       </div>
                       <div style={{ height: 6, background: "var(--surface-container-high)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: "60%", height: "100%", background: "var(--outline-variant)" }} />
                       </div>
                    </div>
                  </div>
                </div>

                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                       <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>event_list</span>
                       <h3 style={{ margin: 0, fontSize: "1rem" }}>Upcoming Schedule</h3>
                    </div>
                    <button className="btn outline" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setActivePanel("meets")}>Calendar View</button>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
                    {recentMeets.length === 0 ? (
                      <p style={{ gridColumn: "1 / -1", fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic", textAlign: "center", padding: "1rem" }}>No upcoming sessions scheduled.</p>
                    ) : (
                      recentMeets.map((m: any, i) => (
                        <div key={i} style={{ padding: "1rem", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--border-light)", display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid var(--border-light)", boxShadow: "var(--shadow-sm)" }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 20, color: "var(--primary-green)" }}>videocam</span>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{new Date(m.scheduled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Recent Announcements */}
              <div className="members-grid" style={{ marginTop: "1.5rem" }}>
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>campaign</span>
                      <h3 style={{ margin: 0, fontSize: "1rem" }}>Recent Announcements</h3>
                    </div>
                    <button className="btn outline" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setActivePanel("announcements")}>View All</button>
                  </div>
                  {announcements.slice(0, 3).length === 0 ? (
                    <p style={{ fontSize: 13, color: "var(--text-tertiary)", fontStyle: "italic", padding: "0.5rem 0" }}>No announcements yet.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {announcements.slice(0, 3).map((a: any) => (
                        <div key={a.id} style={{ padding: "0.875rem 1rem", borderRadius: 12, background: "var(--surface)", border: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", cursor: "pointer" }} onClick={() => setActivePanel("announcements")}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.content}</div>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-tertiary)", whiteSpace: "nowrap", marginLeft: 12 }}>{a.created_at?.slice(0, 10)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Quick Access */}
              <div className="members-grid" style={{ marginTop: "1.5rem" }}>
                <div className="dashboard-card" style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="avatar-circle" style={{ width: 44, height: 44, fontSize: 18 }}>
                      {email?.[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{email?.split("@")[0]}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{email} · Power {powerLevel}{deptName ? ` · ${deptName}` : ""}</div>
                    </div>
                  </div>
                  <button className="btn outline" style={{ padding: "8px 16px", fontSize: 13 }} onClick={() => setActivePanel("profile")}>
                    View Profile
                  </button>
                </div>
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

          {activePanel === "blogs" && powerLevel >= 100 && (
            <BlogSection authToken={authToken!} powerLevel={powerLevel} />
          )}

          {activePanel === "case-studies" && (
            <CaseStudySection authToken={authToken!} powerLevel={powerLevel} />
          )}

          {activePanel === "consulting" && powerLevel >= 100 && (
            <ConsultingRequestsSection authToken={authToken!} />
          )}

          {activePanel === "sendmail" && powerLevel >= 100 && (
            <SendMailSection authToken={authToken!} onEmailSent={async () => {
              const res = await fetch(apiUrl("/api/dashboard"), { headers: { Authorization: `Bearer ${authToken}` } });
              const data = await res.json();
              if (data.stats) setStats(data.stats);
            }} />
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
                {/* SYSTEM CONFIGURATION */}
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

                {/* TOKEN REGISTRY */}
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

                {/* ACCOUNT CREATION */}
                <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
                  <div className="section-header">
                    <span className="material-symbols-outlined" style={{ color: "var(--primary-green)" }}>person_add</span>
                    <h3>Create Accounts</h3>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                    <div>
                      <h4 className="admin-form-section-title">Board Member</h4>
                      <div className="admin-grid-4" style={{ marginTop: 12 }}>
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

                {/* SIGNUP REQUESTS */}
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

                {/* ROLE TRANSFER REQUESTS */}
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

                {/* DANGER ZONE */}
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
              </div>
            </>
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="mobile-bottom-nav">
        {navSections.map((section) => {
          const visible = section.items.filter((n) => powerLevel >= n.minPower);
          if (visible.length === 0) return null;
          const sectionActive = visible.some((n) =>
            n.deptId ? (activePanel === "department" && activeDeptId === n.deptId) : activePanel === n.id
          );
          return (
            <button
              key={section.label}
              className={`mobile-nav-item ${sectionActive ? "active" : ""}`}
              onClick={() => setMobileSheetSection(mobileSheetSection === section.label ? null : section.label)}
            >
              <span className="material-symbols-outlined">{visible[0]?.icon || "apps"}</span>
              <span>{section.label || "Links"}</span>
            </button>
          );
        })}
      </nav>

      {/* MOBILE SECTION SHEET */}
      {mobileSheetSection && (
        <div className="mobile-sheet-overlay" onClick={() => setMobileSheetSection(null)}>
          <div className="mobile-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-sheet-handle" />
            <p className="mobile-sheet-title">{mobileSheetSection}</p>
            <div className="mobile-sheet-items">
              {navSections
                .find((s) => s.label === mobileSheetSection)
                ?.items.filter((n) => powerLevel >= n.minPower)
                .map((item) => {
                  const isItemActive = item.deptId
                    ? (activePanel === "department" && activeDeptId === item.deptId)
                    : activePanel === item.id;
                  return (
                    <button
                      key={item.id}
                      className={`mobile-sheet-item ${isItemActive ? "active" : ""}`}
                      onClick={() => {
                        if (item.deptId) { setActiveDeptId(item.deptId); setActivePanel("department"); }
                        else setActivePanel(item.id);
                        setMobileSheetSection(null);
                      }}
                    >
                      <span className="material-symbols-outlined">{item.icon}</span>
                      <span>{item.label}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* FAB */}
      {powerLevel >= 100 && activePanel === "dashboard" && (
        <button className="fab" onClick={() => setActivePanel("announcements")} title="Post Announcement">
          <span className="material-symbols-outlined">add</span>
        </button>
      )}
    </div>
  );
}
