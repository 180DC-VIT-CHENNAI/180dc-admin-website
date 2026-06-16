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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "0.5rem", background: "var(--surface-container-low)", padding: "4px", borderRadius: "12px", border: "1px solid var(--border-light)" }}>
          {TABS.map((t) => (
            <button 
              key={t} 
              className={`btn ${tab === t ? "" : "outline"}`}
              style={{ border: "none", background: tab === t ? "var(--bg-card)" : "transparent", color: tab === t ? "var(--primary-green)" : "var(--text-secondary)", boxShadow: tab === t ? "var(--shadow-sm)" : "none", padding: "8px 16px" }}
              onClick={() => { setTab(t); setEventFilter(""); setProjectFilter(""); }}
            >
              {t}
            </button>
          ))}
        </div>
        
        <button onClick={() => { resetUploadForm(); setShowUpload(true); }} className="btn" style={{ gap: 8 }}>
          <span className="material-symbols-outlined">upload</span>
          Upload File
        </button>
      </div>

      <div className="dashboard-card" style={{ padding: "1.5rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ position: "relative", flex: 2, minWidth: 260 }}>
             <span className="material-symbols-outlined" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 20, color: "var(--text-tertiary)" }}>search</span>
             <input className="input" style={{ paddingLeft: "2.5rem" }} placeholder="Search file name, description, uploader..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          
          {tab === "Events" && eventsList.length > 0 && (
            <select className="input" style={{ flex: 1, minWidth: 160 }} value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="">All Events</option>
              {eventsList.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
          
          {tab === "Projects" && projectsList.length > 0 && (
            <select className="input" style={{ flex: 1, minWidth: 160 }} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
              <option value="">All Projects</option>
              {projectsList.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: "4rem" }}>
             <div className="avatar-circle" style={{ margin: "0 auto 1rem", animation: "pulse 2s infinite" }}>
               <span className="material-symbols-outlined">sync</span>
             </div>
             <p style={{ color: "var(--text-secondary)" }}>Fetching documents...</p>
          </div>
        ) : files.length === 0 ? (
          <div style={{ textAlign: "center", padding: "4rem", border: "1px dashed var(--outline-variant)", borderRadius: 16 }}>
             <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--text-tertiary)", marginBottom: "1rem" }}>cloud_off</span>
             <p style={{ color: "var(--text-secondary)", margin: 0 }}>No documents found in this category.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto", margin: "0 -1.5rem" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border-light)", background: "var(--surface)" }}>
                  <th style={{ padding: "12px 1.5rem", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Name</th>
                  <th style={{ padding: "12px 1rem", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Category</th>
                  <th style={{ padding: "12px 1rem", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Uploader</th>
                  <th style={{ padding: "12px 1rem", fontSize: 11, fontWeight: 700, color: "var(--text-tertiary)", textTransform: "uppercase" }}>Date</th>
                  <th style={{ padding: "12px 1.5rem", width: 100 }}></th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id} style={{ borderBottom: "1px solid var(--border-light)", transition: "background 0.2s" }}>
                    <td style={{ padding: "1rem 1.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: "var(--surface-container)", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                           <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>
                        </div>
                        <div style={{ minWidth: 0 }}>
                           <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.file_name}</div>
                           <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{file.description || "No description provided"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "1rem" }}>
                       <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "var(--surface-container-high)", color: "var(--text-secondary)", textTransform: "capitalize" }}>
                         {tab === "General" ? file.meeting_title || "General" : tab === "Projects" ? file.project_name : file.event_name}
                       </span>
                    </td>
                    <td style={{ padding: "1rem" }}>
                       <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div className="avatar-circle" style={{ width: 24, height: 24, fontSize: 10 }}>{file.uploaded_by_name?.[0] || "?"}</div>
                          <span style={{ fontSize: 13, color: "var(--text-primary)" }}>{file.uploaded_by_name}</span>
                       </div>
                    </td>
                    <td style={{ padding: "1rem" }}>
                       <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{formatDate(file.created_at)}</div>
                    </td>
                    <td style={{ padding: "1rem 1.5rem", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button onClick={() => handleDownload(file)} className="header-action-btn" title="Download">
                          <span className="material-symbols-outlined">download</span>
                        </button>
                        <button onClick={() => handleDelete(file.id)} className="header-action-btn" style={{ color: "#ef4444" }} title="Delete">
                          <span className="material-symbols-outlined">delete</span>
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

      {showUpload && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
          <div onClick={() => setShowUpload(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", maxWidth: 500, width: "100%", background: "var(--bg-card)", borderRadius: 24, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
             <div style={{ padding: "1.5rem", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontWeight: 800 }}>Upload to {tab}</h3>
                <button onClick={() => setShowUpload(false)} className="header-action-btn"><span className="material-symbols-outlined">close</span></button>
             </div>
             
             <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                <div style={{ position: "relative", padding: "2rem", border: "2px dashed var(--outline-variant)", borderRadius: 16, textAlign: "center", background: "var(--surface-container-low)" }}>
                   <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--primary-green)", marginBottom: "1rem" }}>cloud_upload</span>
                   <div style={{ fontSize: 14, fontWeight: 600 }}>{uploadFile ? uploadFile.name : "Select a file to upload"}</div>
                   <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} style={{ opacity: 0, position: "absolute", inset: 0, cursor: "pointer" }} />
                </div>

                {tab === "Events" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Event Name</label>
                      <input className="input" placeholder="e.g. Hult Prize" value={uploadEventName} onChange={(e) => setUploadEventName(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Event For</label>
                      <input className="input" placeholder="e.g. Budget" value={uploadEventFor} onChange={(e) => setUploadEventFor(e.target.value)} />
                    </div>
                  </div>
                )}

                {tab === "Projects" && (
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Project Name</label>
                    <input className="input" placeholder="Enter project name" value={uploadProjectName} onChange={(e) => setUploadProjectName(e.target.value)} />
                  </div>
                )}

                {tab === "General" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Document Class</label>
                      <input className="input" placeholder="e.g. Meeting Minutes" value={uploadMeetingTitle} onChange={(e) => setUploadMeetingTitle(e.target.value)} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Date</label>
                      <input className="input" type="date" value={uploadMeetingDate} onChange={(e) => setUploadMeetingDate(e.target.value)} />
                    </div>
                  </div>
                )}

                <div>
                   <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Description</label>
                   <textarea className="input" placeholder="What is this file for?" rows={3} value={uploadDescription} onChange={(e) => setUploadDescription(e.target.value)} style={{ resize: "none" }} />
                </div>

                <button onClick={handleUpload} disabled={!uploadFile || uploading} className="btn" style={{ width: "100%", padding: "12px" }}>
                  {uploading ? "Uploading..." : "Upload Document"}
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
