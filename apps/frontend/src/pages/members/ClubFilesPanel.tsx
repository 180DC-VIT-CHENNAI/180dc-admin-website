import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../../lib/api";

interface ClubFile {
  id: string;
  category: string;
  file_name: string;
  file_type: string;
  file_size: number;
  event_name: string | null;
  event_for: string | null;
  project_name: string | null;
  meeting_title: string | null;
  meeting_date: string | null;
  description: string | null;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

const TABS = ["General", "Projects", "Events"] as const;
type Tab = (typeof TABS)[number];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const CATEGORY_MAP: Record<Tab, string> = { General: "general", Projects: "projects", Events: "events" };

const cellStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 13, lineHeight: 1.5 };
const headerCellStyle: React.CSSProperties = { ...cellStyle, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.04em", fontSize: 11, borderBottom: "2px solid var(--border-light)", background: "var(--bg-secondary)" };

export default function ClubFilesPanel({ authToken }: { authToken: string }) {
  const [tab, setTab] = useState<Tab>("General");
  const [files, setFiles] = useState<ClubFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [eventsList, setEventsList] = useState<string[]>([]);
  const [projectsList, setProjectsList] = useState<string[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadEventName, setUploadEventName] = useState("");
  const [uploadEventFor, setUploadEventFor] = useState("");
  const [uploadProjectName, setUploadProjectName] = useState("");
  const [uploadMeetingTitle, setUploadMeetingTitle] = useState("");
  const [uploadMeetingDate, setUploadMeetingDate] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");

  const category = CATEGORY_MAP[tab];

  const fetchFiles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ category });
      if (eventFilter) params.set("eventName", eventFilter);
      if (projectFilter) params.set("projectName", projectFilter);
      if (search) params.set("search", search);
      const res = await fetch(apiUrl(`/api/club-files?${params}`), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [authToken, category, eventFilter, projectFilter, search]);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/club-files/events"), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setEventsList(data.events || []);
    } catch { /* ignore */ }
  }, [authToken]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/club-files/projects"), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      setProjectsList(data.projects || []);
    } catch { /* ignore */ }
  }, [authToken]);

  useEffect(() => { fetchFiles(); fetchEvents(); fetchProjects(); }, [fetchFiles, fetchEvents, fetchProjects]);

  function resetUploadForm() {
    setUploadFile(null);
    setUploadEventName("");
    setUploadEventFor("");
    setUploadProjectName("");
    setUploadMeetingTitle("");
    setUploadMeetingDate("");
    setUploadDescription("");
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("category", category);
      if (uploadEventName) formData.append("eventName", uploadEventName);
      if (uploadEventFor) formData.append("eventFor", uploadEventFor);
      if (uploadProjectName) formData.append("projectName", uploadProjectName);
      if (uploadMeetingTitle) formData.append("meetingTitle", uploadMeetingTitle);
      if (uploadMeetingDate) formData.append("meetingDate", uploadMeetingDate);
      if (uploadDescription) formData.append("description", uploadDescription);

      const res = await fetch(apiUrl("/api/club-files/upload"), {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setShowUpload(false);
        resetUploadForm();
        fetchFiles();
        fetchEvents();
        fetchProjects();
      }
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(file: ClubFile) {
    try {
      const res = await fetch(apiUrl(`/api/club-files/${file.id}/download`), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  async function handleDelete(fileId: string) {
    if (!confirm("Delete this file permanently?")) return;
    try {
      await fetch(apiUrl(`/api/club-files/${fileId}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      fetchFiles();
    } catch {
      // ignore
    }
  }

  const btnBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 12px", borderRadius: 6,
    fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid transparent",
    transition: "all 0.15s", lineHeight: 1.4,
  };

  const tabHeaders: Record<Tab, string[]> = {
    General: ["#", "Document", "Type", "Class", "Meeting Date", "Uploaded At", "Uploaded By", "Description", ""],
    Projects: ["#", "Document", "Type", "Project", "Uploaded At", "Uploaded By", "Description", ""],
    Events: ["#", "Document", "Type", "Event", "For", "Uploaded At", "Uploaded By", "Description", ""],
  };

  return (
    <div style={{ fontFamily: "'Inter', 'Segoe UI', sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Club Files</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-secondary)" }}>
            {category === "general" ? "Meeting minutes, MOVs, and general documents" :
             category === "projects" ? "Project-related files and resources" :
             "Event documents, proposals, and reports"}
          </p>
        </div>
        <button onClick={() => { resetUploadForm(); setShowUpload(true); }}
          style={{ ...btnBase, background: "var(--primary-green)", color: "#fff", padding: "8px 20px", fontSize: 13, fontWeight: 700, borderRadius: 8, border: "none", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = "0.9"}
          onMouseLeave={(e) => e.currentTarget.style.opacity = "1"}
        >
          + Upload File
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border-light)", marginBottom: 20 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => { setTab(t); setEventFilter(""); setProjectFilter(""); }}
            style={{
              padding: "12px 24px", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600,
              background: "transparent",
              color: tab === t ? "var(--primary-green)" : "var(--text-secondary)",
              borderBottom: tab === t ? "2px solid var(--primary-green)" : "2px solid transparent",
              marginBottom: -2, transition: "color 0.15s, border-color 0.15s",
              opacity: tab === t ? 1 : 0.7,
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {tab === "Events" && eventsList.length > 0 && (
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--bg-primary)", color: "var(--text-primary)", minWidth: 160, outline: "none" }}>
            <option value="">All Events</option>
            {eventsList.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
        {tab === "Projects" && projectsList.length > 0 && (
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}
            style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--bg-primary)", color: "var(--text-primary)", minWidth: 160, outline: "none" }}>
            <option value="">All Projects</option>
            {projectsList.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        )}
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <input placeholder="Search files..." value={search} onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)", fontSize: 13, background: "var(--bg-primary)", color: "var(--text-primary)", outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, border: "1px solid var(--border-light)", overflow: "hidden", background: "var(--bg-primary)" }}>
        {loading ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
            Loading files...
          </div>
        ) : files.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
            No files found in this category.
            <div style={{ marginTop: 12 }}>
              <button onClick={() => { resetUploadForm(); setShowUpload(true); }}
                style={{ ...btnBase, background: "var(--primary-green)", color: "#fff", padding: "6px 16px", border: "none", cursor: "pointer", borderRadius: 6, fontWeight: 600, fontSize: 13 }}>
                Upload your first file
              </button>
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {tabHeaders[tab].map((col, i) => (
                    <th key={i} style={headerCellStyle}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((file, idx) => (
                  <tr key={file.id} style={{ borderBottom: "1px solid var(--border-light)", transition: "background 0.1s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                    <td style={{ ...cellStyle, color: "var(--text-light)", width: 36, textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ ...cellStyle, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <a href="#" onClick={(e) => { e.preventDefault(); handleDownload(file); }}
                        style={{ color: "var(--primary-green)", textDecoration: "none", fontWeight: 600, fontSize: 13 }}
                        title={file.file_name}>
                        {file.file_name}
                      </a>
                    </td>
                    <td style={{ ...cellStyle, color: "var(--text-secondary)" }}>
                      <span style={{ background: "var(--bg-secondary)", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                        {file.file_type?.split("/")[1]?.toUpperCase() || file.file_type?.split("/")[0]?.toUpperCase() || "FILE"}
                      </span>
                    </td>
                    {tab === "Events" && (
                      <>
                        <td style={{ ...cellStyle, fontWeight: 500 }}>{file.event_name || <span style={{ color: "var(--text-light)" }}>—</span>}</td>
                        <td style={{ ...cellStyle, color: "var(--text-secondary)" }}>{file.event_for || <span style={{ color: "var(--text-light)" }}>—</span>}</td>
                      </>
                    )}
                    {tab === "Projects" && (
                      <td style={{ ...cellStyle, fontWeight: 500 }}>{file.project_name || <span style={{ color: "var(--text-light)" }}>—</span>}</td>
                    )}
                    {tab === "General" && (
                      <>
                        <td style={{ ...cellStyle, fontWeight: 500 }}>{file.meeting_title || <span style={{ color: "var(--text-light)" }}>—</span>}</td>
                        <td style={{ ...cellStyle, color: "var(--text-secondary)" }}>{file.meeting_date || <span style={{ color: "var(--text-light)" }}>—</span>}</td>
                      </>
                    )}
                    <td style={{ ...cellStyle, color: "var(--text-light)", whiteSpace: "nowrap", fontSize: 12 }}>{formatDate(file.created_at)}</td>
                    <td style={{ ...cellStyle, fontSize: 12 }}>{file.uploaded_by_name || <span style={{ color: "var(--text-light)" }}>—</span>}</td>
                    <td style={{ ...cellStyle, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-secondary)" }}>
                      {file.description || <span style={{ color: "var(--text-light)" }}>—</span>}
                    </td>
                    <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => handleDownload(file)} title="Download"
                          style={{ ...btnBase, border: "1px solid var(--border-light)", background: "var(--bg-primary)", color: "var(--text-primary)" }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-secondary)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "var(--bg-primary)"}>
                          &#x2193; Download
                        </button>
                        <button onClick={() => handleDelete(file.id)} title="Delete"
                          style={{ ...btnBase, border: "1px solid transparent", background: "transparent", color: "#e74c3c", opacity: 0.6 }}
                          onMouseEnter={(e) => e.currentTarget.style.opacity = "1"}
                          onMouseLeave={(e) => e.currentTarget.style.opacity = "0.6"}>
                          &#x2715;
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, backdropFilter: "blur(4px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowUpload(false); }}>
          <div style={{ width: "92%", maxWidth: 540, background: "var(--bg-primary)", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,0.2)", overflow: "hidden" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Upload to {tab}</h3>
              <button onClick={() => setShowUpload(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--text-light)", padding: 0, lineHeight: 1 }}>
                &times;
              </button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>File *</label>
                <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  style={{ width: "100%", fontSize: 13, padding: "6px 0" }} />
              </div>
              {tab === "Events" && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Event Name</label>
                    <input className="input" placeholder="e.g. Hult Prize, Excel 2025" value={uploadEventName} onChange={(e) => setUploadEventName(e.target.value)}
                      style={{ width: "100%", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>For</label>
                    <input className="input" placeholder="e.g. Proposal, Report, Budget" value={uploadEventFor} onChange={(e) => setUploadEventFor(e.target.value)}
                      style={{ width: "100%", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </>
              )}
              {tab === "Projects" && (
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Project Name</label>
                  <input className="input" placeholder="Project name" value={uploadProjectName} onChange={(e) => setUploadProjectName(e.target.value)}
                    style={{ width: "100%", fontSize: 13, boxSizing: "border-box" }} />
                </div>
              )}
              {tab === "General" && (
                <>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Class</label>
                    <input className="input" placeholder="e.g. Board Meeting, Team Sync, Workshop" value={uploadMeetingTitle} onChange={(e) => setUploadMeetingTitle(e.target.value)}
                      style={{ width: "100%", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Meeting Date</label>
                    <input className="input" type="date" value={uploadMeetingDate} onChange={(e) => setUploadMeetingDate(e.target.value)}
                      style={{ width: "100%", fontSize: 13, boxSizing: "border-box" }} />
                  </div>
                </>
              )}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>Description <span style={{ fontWeight: 400, color: "var(--text-light)" }}>(optional)</span></label>
                <textarea className="input" placeholder="Brief description of the document" value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)}
                  rows={3} style={{ width: "100%", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid var(--border-light)", display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowUpload(false)}
                style={{ ...btnBase, border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-primary)", padding: "8px 20px" }}>
                Cancel
              </button>
              <button onClick={handleUpload} disabled={!uploadFile || uploading}
                style={{ ...btnBase, background: !uploadFile || uploading ? "var(--border-light)" : "var(--primary-green)", color: !uploadFile || uploading ? "var(--text-light)" : "#fff", padding: "8px 24px", border: "none", cursor: !uploadFile || uploading ? "not-allowed" : "pointer", fontWeight: 700 }}>
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
