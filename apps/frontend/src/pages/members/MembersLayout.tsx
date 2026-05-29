import { useState, useEffect } from "react";
import MembersLogin from "./MembersLogin";
import DepartmentPanel from "./DepartmentPanel";
import { apiUrl } from "../../lib/api";

const DEPT_NAMES: Record<string, string> = {
  tech: "Technology",
  rnd: "Research & Development",
};

export default function MembersLayout() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [powerLevel, setPowerLevel] = useState<number>(0);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"members" | "department">("members");
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [adminTokens, setAdminTokens] = useState<any[]>([]);
  const [dashboardReady, setDashboardReady] = useState(false);
  const [tokenEmail, setTokenEmail] = useState("");
  const [tokenName, setTokenName] = useState("");
  const [tokenRoleId, setTokenRoleId] = useState("member");
  const [tokenBusy, setTokenBusy] = useState(false);
  const [boardEmail, setBoardEmail] = useState("");
  const [boardName, setBoardName] = useState("");
  const [boardRoleId, setBoardRoleId] = useState("president");
  const [boardBusy, setBoardBusy] = useState(false);
  const [recentToken, setRecentToken] = useState<string | null>(null);
  const [showRecentToken, setShowRecentToken] = useState(false);
  const [memberEmail, setMemberEmail] = useState("");
  const [memberName, setMemberName] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);

  const maskToken = (token: string) =>
    token.length <= 12 ? token : `${token.slice(0, 6)}…${token.slice(-4)}`;

  const handleLogin = (
    token: string,
    userEmail: string,
    serverPowerLevel?: number,
    serverDepartmentId?: string,
  ) => {
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
          setDashboardReady(true);
        } else {
          console.error(data.error || "Failed to load dashboard");
        }
      } catch (e) {
        console.error("Failed to load dashboard", e);
      }
    }
    loadDashboard();
  }, [authToken]);

  const hasDepartment = departmentId && DEPT_NAMES[departmentId];
  const deptName = hasDepartment ? DEPT_NAMES[departmentId!] : "";

  if (!authToken) return <MembersLogin onLogin={handleLogin} />;

  if (!dashboardReady) {
    return (
      <div
        style={{
          backgroundColor: "var(--bg-primary)",
          minHeight: "100vh",
          width: "100%",
        }}
      >
        <div className="container" style={{ padding: "4rem 0" }}>
          <div className="card-doodle">Loading dashboard...</div>
        </div>
      </div>
    );
  }
  return (
    <div
      style={{
        backgroundColor: "var(--bg-primary)",
        minHeight: "100vh",
        width: "100%",
      }}
    >
      <div className="container" style={{ padding: "3rem 0" }}>
        <header
          style={{
            borderBottom: "1px solid var(--border-light)",
            paddingBottom: "1rem",
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Portal Dashboard</h1>
            <p style={{ margin: 0, color: "var(--text-secondary)" }}>
              Logged in as: {email}
            </p>
          </div>

          <div style={{ textAlign: "right" }}>
            <span className="floating-note">Power Level: {powerLevel}</span>
            <br />
            <br />
            <button
              onClick={() => setAuthToken(null)}
              className="btn"
              style={{ background: "var(--primary-green)" }}
            >
              Logout
            </button>
          </div>
        </header>

        {hasDepartment && (
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: "2rem",
              borderBottom: "1px solid var(--border-light)",
              paddingBottom: "0.75rem",
            }}
          >
            <button
              className={activeTab === "members" ? "btn" : "btn outline"}
              onClick={() => setActiveTab("members")}
              style={{ padding: "0.5rem 1.5rem" }}
            >
              Members Panel
            </button>
            <button
              className={activeTab === "department" ? "btn" : "btn outline"}
              onClick={() => setActiveTab("department")}
              style={{ padding: "0.5rem 1.5rem" }}
            >
              {deptName} Department
            </button>
          </div>
        )}

        {activeTab === "department" && hasDepartment ? (
          <DepartmentPanel
            authToken={authToken!}
            departmentId={departmentId!}
            departmentName={deptName}
          />
        ) : (
        <div className="members-grid">
          <div className="card-doodle">
            <h3>Personal Profile</h3>
            <p style={{ color: "var(--text-secondary)" }}>
              View your upcoming tasks and edit your details.
            </p>
            <button className="btn outline">Go to Profile</button>
          </div>

          {powerLevel >= 50 && (
            <div className="card-doodle">
              <h3>Access Hub</h3>
              <p style={{ color: "var(--text-secondary)" }}>
                Open the Access Hub to visit all department websites from one
                place.
              </p>
              <button
                className="btn"
                onClick={() => window.open("/departments", "_blank")}
                title="Open Access Hub"
              >
                Open Access Hub
              </button>
            </div>
          )}

          {powerLevel >= 100 && (
            <>
              <div className="card-doodle">
                <h3>Global Meets</h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Schedule meetings across all departments.
                </p>
                <button className="btn">Schedule Meet</button>
              </div>

              <div
                className="card-doodle"
                style={{ border: "3px solid var(--accent)" }}
              >
                <h3 style={{ color: "var(--accent)" }}>Admin Settings</h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Create roles, transfer ownership, manage members.
                </p>
                <button className="btn" style={{ background: "var(--accent)" }}>
                  Admin Console
                </button>
              </div>

              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Admin Token Registry</h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Generate tokens for members, leads, or board accounts. The
                  token is what the user types in the login screen.
                </p>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    marginTop: 16,
                  }}
                >
                  <input
                    className="input"
                    placeholder="Email"
                    value={tokenEmail}
                    onChange={(e) => setTokenEmail(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Name"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                  />
                  <select
                    className="input"
                    value={tokenRoleId}
                    onChange={(e) => setTokenRoleId(e.target.value)}
                  >
                    <option value="member">member</option>
                    <option value="lead">lead</option>
                    <option value="secretary">secretary</option>
                    <option value="vice_president">vice_president</option>
                    <option value="president">president</option>
                  </select>
                  <button
                    className="btn"
                    disabled={tokenBusy}
                    onClick={async () => {
                      if (!authToken) return;
                      if (!tokenEmail.trim()) {
                        alert("Enter an email first");
                        return;
                      }
                      setTokenBusy(true);
                      try {
                        const res = await fetch(apiUrl("/api/admin-tokens"), {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authToken}`,
                          },
                          body: JSON.stringify({
                            email: tokenEmail.trim(),
                            name: tokenName.trim(),
                            roleId: tokenRoleId,
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setAdminTokens((prev) => [data, ...prev]);
                          setTokenEmail("");
                          setTokenName("");
                          setTokenRoleId("member");
                          setRecentToken(data.token);
                          setShowRecentToken(false);
                        } else {
                          alert(data.error || "Failed to create token");
                        }
                      } catch (err: any) {
                        alert(err.message);
                      } finally {
                        setTokenBusy(false);
                      }
                    }}
                  >
                    {tokenBusy ? "Creating..." : "Create Token"}
                  </button>
                </div>

                <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
                  {adminTokens.length === 0 && <p>No tokens created yet.</p>}
                  {adminTokens.map((item) => (
                    <div
                      key={item.token}
                      className="card-doodle"
                      style={{
                        padding: 16,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong>{item.name || item.email}</strong>
                        <div
                          style={{
                            color: "var(--text-secondary)",
                            fontSize: 14,
                          }}
                        >
                          {item.email} · {item.role_id}
                        </div>
                        <div
                          style={{
                            marginTop: 8,
                            fontFamily: "monospace",
                            fontSize: 13,
                            wordBreak: "break-all",
                          }}
                        >
                          {item.token}
                        </div>
                      </div>
                      {!item.revoked_at ? (
                        <button
                          className="btn outline"
                          onClick={async () => {
                            if (!authToken) return;
                            const res = await fetch(
                              apiUrl(`/api/admin-tokens/${item.token}`),
                              {
                                method: "DELETE",
                                headers: {
                                  Authorization: `Bearer ${authToken}`,
                                },
                              },
                            );
                            const data = await res.json();
                            if (data.success) {
                              setAdminTokens((prev) =>
                                prev.map((t) =>
                                  t.token === item.token
                                    ? {
                                        ...t,
                                        revoked_at: new Date().toISOString(),
                                      }
                                    : t,
                                ),
                              );
                            } else {
                              alert(data.error || "Failed to revoke token");
                            }
                          }}
                        >
                          Revoke
                        </button>
                      ) : (
                        <span style={{ color: "var(--text-secondary)" }}>
                          Revoked
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Create Board User</h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Create or update a board account, assign its role, and issue a
                  fresh login token in one step.
                </p>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                    marginTop: 16,
                  }}
                >
                  <input
                    className="input"
                    placeholder="Email"
                    value={boardEmail}
                    onChange={(e) => setBoardEmail(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Name"
                    value={boardName}
                    onChange={(e) => setBoardName(e.target.value)}
                  />
                  <select
                    className="input"
                    value={boardRoleId}
                    onChange={(e) => setBoardRoleId(e.target.value)}
                  >
                    <option value="president">president</option>
                    <option value="vice_president">vice_president</option>
                    <option value="secretary">secretary</option>
                    <option value="lead">lead</option>
                  </select>
                  <button
                    className="btn"
                    disabled={boardBusy}
                    onClick={async () => {
                      if (!authToken) return;
                      if (!boardEmail.trim()) {
                        alert("Enter an email first");
                        return;
                      }
                      setBoardBusy(true);
                      try {
                        const res = await fetch(apiUrl("/api/board-users"), {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authToken}`,
                          },
                          body: JSON.stringify({
                            email: boardEmail.trim(),
                            name: boardName.trim(),
                            roleId: boardRoleId,
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setAdminTokens((prev) => [data, ...prev]);
                          setBoardEmail("");
                          setBoardName("");
                          setBoardRoleId("president");
                          setRecentToken(data.token);
                          setShowRecentToken(false);
                          alert(`Board user created. Token: ${data.token}`);
                        } else {
                          alert(data.error || "Failed to create board user");
                        }
                      } catch (err: any) {
                        alert(err.message);
                      } finally {
                        setBoardBusy(false);
                      }
                    }}
                  >
                    {boardBusy ? "Creating..." : "Create Board User"}
                  </button>
                </div>

                {recentToken && (
                  <div
                    className="floating-note"
                    style={{
                      marginTop: 16,
                      display: "inline-flex",
                      gap: 10,
                      alignItems: "center",
                    }}
                  >
                    <span>
                      Latest token:{" "}
                      {showRecentToken ? recentToken : maskToken(recentToken)}
                    </span>
                    <button
                      className="btn outline"
                      style={{ padding: "0.45rem 0.9rem", boxShadow: "none" }}
                      onClick={async () => {
                        await navigator.clipboard.writeText(recentToken);
                        alert("Token copied");
                      }}
                    >
                      Copy
                    </button>
                    <button
                      className="btn outline"
                      style={{ padding: "0.45rem 0.9rem", boxShadow: "none" }}
                      onClick={() => setShowRecentToken((v) => !v)}
                    >
                      {showRecentToken ? "Hide" : "Reveal"}
                    </button>
                  </div>
                )}
              </div>

              <div className="card-doodle" style={{ gridColumn: "1 / -1" }}>
                <h3>Create Member</h3>
                <p style={{ color: "var(--text-secondary)" }}>
                  Create a regular member directly. This is for non-board
                  accounts and uses the `member` role.
                </p>

                <div
                  style={{
                    display: "grid",
                    gap: 12,
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    marginTop: 16,
                  }}
                >
                  <input
                    className="input"
                    placeholder="Email"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                  />
                  <input
                    className="input"
                    placeholder="Name"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                  />
                  <button
                    className="btn"
                    disabled={memberBusy}
                    onClick={async () => {
                      if (!authToken) return;
                      if (!memberEmail.trim()) {
                        alert("Enter an email first");
                        return;
                      }
                      setMemberBusy(true);
                      try {
                        const res = await fetch(apiUrl("/api/members"), {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${authToken}`,
                          },
                          body: JSON.stringify({
                            email: memberEmail.trim(),
                            name:
                              memberName.trim() ||
                              memberEmail.trim().split("@")[0],
                          }),
                        });
                        const data = await res.json();
                        if (data.success) {
                          setMemberEmail("");
                          setMemberName("");
                          alert(data.message || "Member created");
                        } else {
                          alert(data.error || "Failed to create member");
                        }
                      } catch (err: any) {
                        alert(err.message);
                      } finally {
                        setMemberBusy(false);
                      }
                    }}
                  >
                    {memberBusy ? "Creating..." : "Create Member"}
                  </button>
                </div>
              </div>
            </>
          )}

          {powerLevel >= 100 && (
            <div style={{ gridColumn: "1 / -1", marginTop: "1rem" }}>
              <h3>Pending Signup Requests</h3>
              {pendingRequests.length === 0 && <p>No pending requests.</p>}
              <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
                {pendingRequests.map((r) => (
                  <div
                    key={r.id}
                    className="card-doodle"
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "1.1rem" }}>{r.name}</strong>
                      <div
                        style={{ color: "var(--text-secondary)", marginTop: 6 }}
                      >
                        {r.email}
                      </div>
                      <p
                        style={{ marginTop: 8, color: "var(--text-secondary)" }}
                      >
                        {r.message}
                      </p>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      <button
                        onClick={async () => {
                          await fetch(
                            apiUrl(`/api/signup-requests/${r.id}/approve`),
                            {
                              method: "POST",
                              headers: { Authorization: `Bearer ${authToken}` },
                            },
                          );
                          setPendingRequests(
                            pendingRequests.filter((p) => p.id !== r.id),
                          );
                        }}
                        className="btn"
                      >
                        Approve
                      </button>
                      <button
                        onClick={async () => {
                          await fetch(
                            apiUrl(`/api/signup-requests/${r.id}/reject`),
                            {
                              method: "POST",
                              headers: { Authorization: `Bearer ${authToken}` },
                            },
                          );
                          setPendingRequests(
                            pendingRequests.filter((p) => p.id !== r.id),
                          );
                        }}
                        className="btn outline"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
