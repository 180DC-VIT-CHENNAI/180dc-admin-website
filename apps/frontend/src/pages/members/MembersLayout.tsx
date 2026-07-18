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
import AdminConsole from "./AdminConsole";
import { apiUrl } from "../../lib/api";
import { useTheme } from "../../context/ThemeContext";
import { stripHtmlTags } from "../../lib/sanitize";
import { DEPT_NAMES } from "./constants";
import "./MembersLayout.css";

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
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
    console.log("[clerk-cb] effect fired", { clerkLoaded, clerkUserId: clerkUserId ?? null, authToken: authToken ? "yes" : "no" });
    if (!clerkLoaded) { console.log("[clerk-cb] clerk not loaded yet, waiting…"); return; }
    if (!clerkUserId) { console.log("[clerk-cb] no clerkUserId — Clerk session absent"); return; }

    const pending = sessionStorage.getItem("clnk");

    async function handleClerkCallback() {
      console.log("[clerk-cb] handleClerkCallback start", { loggedOut: sessionStorage.getItem("loggedOut"), authToken: authToken ? "yes" : "no", pending });

      if (sessionStorage.getItem("loggedOut") && !authToken) {
        sessionStorage.removeItem("loggedOut");
      }

      // Login flow: Clerk session exists but no token session
      if (!authToken) {
        setOauthLoading(true);
        console.log("[clerk-cb] login flow — no authToken, fetching Clerk JWT");
        try {
          // Retry getToken() a few times — Clerk may not have the JWT ready after OAuth redirect
          let clerkJwt: string | null = null;
          for (let attempt = 0; attempt < 5; attempt++) {
            clerkJwt = await getToken();
            console.log("[clerk-cb] getToken attempt", attempt + 1, "→", clerkJwt ? "got JWT (" + clerkJwt.length + " chars)" : "null");
            if (clerkJwt) break;
            await new Promise(r => setTimeout(r, 500));
          }
          if (!clerkJwt) {
            console.log("[clerk-cb] getToken returned null after 5 attempts");
            setOauthLoading(false);
            setOauthStatusMsg("Google sign-in is taking longer than expected. Try again.");
            return;
          }
          // clerk.user may not be loaded immediately after OAuth redirect — retry
          let clerkUserEmail: string | null = null;
          for (let i = 0; i < 5; i++) {
            clerkUserEmail = clerk.user?.primaryEmailAddress?.emailAddress || null;
            console.log("[clerk-cb] clerk.user email attempt", i + 1, "→", clerkUserEmail);
            if (clerkUserEmail) break;
            await new Promise(r => setTimeout(r, 500));
          }
          console.log("[clerk-cb] calling /api/auth/clerk-login", { email: clerkUserEmail, clerkUserId });
          const res = await fetch(apiUrl("/api/auth/clerk-login"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clerkToken: clerkJwt, email: clerkUserEmail }),
          });
          console.log("[clerk-cb] clerk-login response status:", res.status);
          const data = await res.json();
          console.log("[clerk-cb] clerk-login response:", JSON.stringify(data));
          setOauthLoading(false);
          if (data.success) {
            console.log("[clerk-cb] login success — calling handleLogin", { token: data.token?.slice(0, 8) + "…", email: data.email, power: data.powerLevel });
            handleLogin(data.token, data.email, data.powerLevel, data.departmentId, data.roleId);
            setOauthStatusMsg(null);
          } else {
            console.log("[clerk-cb] login failed:", data.error);
            setOauthStatusMsg(data.error || "Google login failed");
          }
          return;
        } catch (err) {
          console.error("[clerk-cb] login flow exception:", err);
          setOauthLoading(false);
          setOauthStatusMsg("Google login failed. Try again.");
          return;
        }
      }

      // Linking flow: Clerk session + existing token + linking flag
      if (authToken && pending === "link" && !linkingFlag.current) {
        linkingFlag.current = true;
        sessionStorage.removeItem("clnk");
        console.log("[clerk-cb] linking flow — calling /api/auth/link-clerk");
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
          console.log("[clerk-cb] link-clerk response:", JSON.stringify(data));
          if (data.success) {
            setOauthEnabled(true);
            setOauthStatusMsg("Google login enabled! You can now sign in with Google.");
            setTimeout(() => setOauthStatusMsg(null), 5000);
          } else {
            setOauthStatusMsg(data.error || "Failed to link Google account");
          }
        } catch (err) {
          console.error("[clerk-cb] link-clerk exception:", err);
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
    business_strategy_director: ["business_strategy", "client-partner-sponsor"],
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
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{stripHtmlTags(a.title)}</div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripHtmlTags(a.content)}</div>
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
          <button className="header-action-btn" onClick={() => setShowLogoutConfirm(true)} title="Logout" style={{ color: "#ef4444" }}>
            <span className="material-symbols-outlined">logout</span>
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
            <button className="nav-item" onClick={() => setShowLogoutConfirm(true)} style={{ color: "#ef4444" }}>
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
                {[
                  { icon: "account_tree", label: "Active Projects", value: stats.projectsCount, bg: "rgba(141, 198, 63, 0.15)", color: "var(--primary-green)" },
                  { icon: "groups", label: "Total Members", value: stats.membersCount, bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" },
                  { icon: "event_available", label: "Upcoming Meets", value: stats.upcomingMeetsCount, bg: "rgba(245, 158, 11, 0.15)", color: "#f59e0b" },
                  { icon: "campaign", label: "Announcements", value: stats.announcementsCount, bg: "rgba(139, 92, 246, 0.15)", color: "#8b5cf6" },
                ].map((kpi) => (
                  <div key={kpi.label} className="kpi-card">
                    <div className="kpi-header">
                      <div className="kpi-icon-wrapper" style={{ background: kpi.bg, color: kpi.color }}>
                        <span className="material-symbols-outlined">{kpi.icon}</span>
                      </div>
                    </div>
                    <span className="kpi-label">{kpi.label}</span>
                    <span className="kpi-value">{kpi.value}</span>
                  </div>
                ))}
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
                    {[
                      { label: "Executive Board", pct: 12, color: "var(--primary-green)" },
                      { label: "Lead Consultants", pct: 28, color: "#3b82f6" },
                      { label: "General Members", pct: 60, color: "#f59e0b" },
                    ].map((bar) => (
                      <div key={bar.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700 }}>
                          <span style={{ color: "var(--text-secondary)" }}>{bar.label}</span>
                          <span>{bar.pct}%</span>
                        </div>
                        <div style={{ height: 6, background: "var(--surface-container-high)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ width: `${bar.pct}%`, height: "100%", background: bar.color }} />
                        </div>
                      </div>
                    ))}
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
                            <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripHtmlTags(a.title)}</div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{stripHtmlTags(a.content)}</div>
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
            <ClubFilesPanel authToken={authToken!} powerLevel={powerLevel} />
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
                      <h3 style={{ margin: 0 }}>{stripHtmlTags(a.title)}</h3>
                      <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>{a.created_at?.slice(0, 10)}</div>
                      <div style={{ marginTop: 12, whiteSpace: "pre-wrap", color: "var(--text-secondary)", fontSize: 14 }}>{stripHtmlTags(a.content)}</div>
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
            <AdminConsole
              authToken={authToken!}
              setAllUsers={setAllUsers}
              setAllRoles={setAllRoles}
              allUsers={allUsers}
              allRoles={allRoles}
              departments={departments}
              roleTransfers={roleTransfers}
              pendingRequests={pendingRequests}
              setPendingRequests={setPendingRequests}
              adminTokens={adminTokens}
              setAdminTokens={setAdminTokens}
              tokenEmail={tokenEmail}
              setTokenEmail={setTokenEmail}
              tokenName={tokenName}
              setTokenName={setTokenName}
              tokenRoleId={tokenRoleId}
              setTokenRoleId={setTokenRoleId}
              tokenBusy={tokenBusy}
              setTokenBusy={setTokenBusy}
              recentToken={recentToken}
              setRecentToken={setRecentToken}
              showRecentToken={showRecentToken}
              setShowRecentToken={setShowRecentToken}
              boardEmail={boardEmail}
              setBoardEmail={setBoardEmail}
              boardName={boardName}
              setBoardName={setBoardName}
              boardRoleId={boardRoleId}
              setBoardRoleId={setBoardRoleId}
              boardDepartmentId={boardDepartmentId}
              setBoardDepartmentId={setBoardDepartmentId}
              boardSecondaryRoleId={boardSecondaryRoleId}
              setBoardSecondaryRoleId={setBoardSecondaryRoleId}
              boardBusy={boardBusy}
              setBoardBusy={setBoardBusy}
              advisoryEmail={advisoryEmail}
              setAdvisoryEmail={setAdvisoryEmail}
              advisoryName={advisoryName}
              setAdvisoryName={setAdvisoryName}
              advisoryExTitle={advisoryExTitle}
              setAdvisoryExTitle={setAdvisoryExTitle}
              advisoryMemberDeptId={advisoryMemberDeptId}
              setAdvisoryMemberDeptId={setAdvisoryMemberDeptId}
              advisoryBusy={advisoryBusy}
              setAdvisoryBusy={setAdvisoryBusy}
              advisoryRecentToken={advisoryRecentToken}
              setAdvisoryRecentToken={setAdvisoryRecentToken}
              memberEmail={memberEmail}
              setMemberEmail={setMemberEmail}
              memberName={memberName}
              setMemberName={setMemberName}
              memberDepartmentId={memberDepartmentId}
              setMemberDepartmentId={setMemberDepartmentId}
              memberBusy={memberBusy}
              setMemberBusy={setMemberBusy}
              transferFromUserId={transferFromUserId}
              setTransferFromUserId={setTransferFromUserId}
              transferToUserId={transferToUserId}
              setTransferToUserId={setTransferToUserId}
              transferRoleId={transferRoleId}
              setTransferRoleId={setTransferRoleId}
              transferBusy={transferBusy}
              setTransferBusy={setTransferBusy}
              dangerUserId={dangerUserId}
              setDangerUserId={setDangerUserId}
              dangerNewRoleId={dangerNewRoleId}
              setDangerNewRoleId={setDangerNewRoleId}
              dangerNewDeptId={dangerNewDeptId}
              setDangerNewDeptId={setDangerNewDeptId}
              dangerBusy={dangerBusy}
              setDangerBusy={setDangerBusy}
              dangerAdvUserId={dangerAdvUserId}
              setDangerAdvUserId={setDangerAdvUserId}
              dangerAdvExTitle={dangerAdvExTitle}
              setDangerAdvExTitle={setDangerAdvExTitle}
              dangerAdvBusy={dangerAdvBusy}
              setDangerAdvBusy={setDangerAdvBusy}
              deleteUserId={deleteUserId}
              setDeleteUserId={setDeleteUserId}
              deleteBusy={deleteBusy}
              setDeleteBusy={setDeleteBusy}
              maintenanceMode={maintenanceMode}
              setMaintenanceMode={setMaintenanceMode}
              stats={stats}
            />
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

      {/* LOGOUT CONFIRMATION */}
      {showLogoutConfirm && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div onClick={() => setShowLogoutConfirm(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", maxWidth: 400, width: "100%", background: "var(--bg-card)", borderRadius: 24, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-lg)", padding: "2rem", textAlign: "center" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(239,68,68,0.12)", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 28 }}>logout</span>
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: "1.15rem", fontWeight: 800 }}>Sign out?</h3>
            <p style={{ fontSize: 14, color: "var(--text-secondary)", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
              You'll be signed out of the portal. You can sign back in anytime.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn outline" style={{ flex: 1, justifyContent: "center", padding: "0.75rem" }} onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="btn" style={{ flex: 1, justifyContent: "center", padding: "0.75rem", background: "#ef4444", border: "2px solid #1a1a1a", boxShadow: "3px 3px 0 #1a1a1a" }} onClick={async () => {
                setShowLogoutConfirm(false);
                sessionStorage.clear();
                sessionStorage.setItem("loggedOut", "true");
                setAuthToken(null);
                try { await clerk.signOut(); } catch {}
              }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
