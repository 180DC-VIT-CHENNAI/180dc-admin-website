import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../lib/api";
import { useTheme } from "../context/ThemeContext";

interface Newsletter {
  id: string;
  title: string;
  description: string;
  content: string;
  source_file_url: string | null;
  image_url: string | null;
  sent_at: string | null;
  recipient_count: number;
  created_by: string;
  created_at: string;
}

type View = "login" | "otp" | "editor";

export default function NewsletterEditorPage() {
  const { isDark, toggle: toggleTheme } = useTheme();

  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [mode, setMode] = useState<"list" | "create">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [extractedContent, setExtractedContent] = useState("");
  const [sourceFileUrl, setSourceFileUrl] = useState("");
  const [sourceFileKey, setSourceFileKey] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [suggestedDescription, setSuggestedDescription] = useState("");

  const authHeaders = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};

  const loadDrafts = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/newsletter-editor/drafts"), { headers: authHeaders });
      const data = await res.json();
      if (data.success) setNewsletters(data.data || []);
    } catch {}
  }, [sessionToken]);

  useEffect(() => {
    const saved = localStorage.getItem("nl_editor_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setSessionToken(parsed.token);
        setSessionEmail(parsed.email);
        setView("editor");
      } catch { localStorage.removeItem("nl_editor_session"); }
    }
  }, []);

  useEffect(() => {
    if (view === "editor" && sessionToken) loadDrafts();
  }, [view, sessionToken, loadDrafts]);

  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/newsletter-editor/otp/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setView("otp");
        setSuccess("OTP sent! Check your inbox.");
      } else {
        setError(data.error || "Failed to send OTP");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/newsletter-editor/otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionToken(data.token);
        setSessionEmail(data.email);
        localStorage.setItem("nl_editor_session", JSON.stringify({ token: data.token, email: data.email }));
        setView("editor");
        setOtp("");
        setSuccess("");
      } else {
        setError(data.error || "Invalid OTP");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      await fetch(apiUrl("/api/newsletter-editor/logout"), {
        method: "POST",
        headers: authHeaders,
      });
    } catch {}
    localStorage.removeItem("nl_editor_session");
    setSessionToken("");
    setSessionEmail("");
    setView("login");
    setEmail("");
    setOtp("");
    setNewsletters([]);
    setMode("list");
  };

  const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const handleDocumentUpload = useCallback(async (file: File) => {
    setExtracting(true);
    setError("");
    setExtractedContent("");
    setSourceFileName(file.name);
    try {
      let html = "";
      let sTitle = "";
      let sDesc = "";

      if (file.type === "application/pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        const pdfjsVersion = pdfjsLib.version;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: true, useSystemFonts: true }).promise;

        if (pdf.numPages > 0) {
          const meta = await pdf.getMetadata().catch(() => null);
          const info = meta?.info as Record<string, string> | undefined;
          if (info?.Title && info.Title.trim()) sTitle = info.Title.trim();
        }

        const textParts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          textParts.push(content.items.map((item: any) => item.str).join(" "));
        }
        const text = textParts.join("\n\n");
        const paragraphs = text.split(/\n{2,}/).filter((p: string) => p.trim().length > 0);
        html = paragraphs.map((p: string) => {
          const lines = p.trim().split("\n");
          if (lines.length === 1) return `<p>${escapeHtml(lines[0].trim())}</p>`;
          return lines.map((l: string) => `<p>${escapeHtml(l.trim())}</p>`).join("\n");
        }).join("\n");

        if (!sTitle && paragraphs.length > 0) {
          const firstLine = paragraphs[0].split("\n")[0].trim();
          if (firstLine.length >= 3 && firstLine.length <= 200) sTitle = firstLine;
        }
        if (paragraphs.length > 1) {
          const desc = paragraphs[1].replace(/\n/g, " ").trim();
          sDesc = desc.length > 500 ? desc.slice(0, 497) + "..." : desc;
        }
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        html = result.value;
        const tempDiv = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const firstSentence = tempDiv.split(/[.!?]\s/)[0];
        if (firstSentence && firstSentence.length >= 3 && firstSentence.length <= 200) sTitle = firstSentence.trim();
        const rest = tempDiv.slice(sTitle.length).trim();
        if (rest) sDesc = rest.length > 500 ? rest.slice(0, 497) + "..." : rest;
      } else {
        setError("Unsupported file type. Upload a PDF or DOCX.");
        setExtracting(false);
        return;
      }

      const textOnly = html.replace(/<[^>]*>/g, "").trim();
      if (textOnly.length < 10) {
        setError("Document appears empty.");
        setExtracting(false);
        return;
      }

      setExtractedContent(html);
      setSuggestedTitle(sTitle);
      setSuggestedDescription(sDesc);

      const srcFd = new FormData();
      srcFd.append("file", file);
      const srcRes = await fetch(apiUrl("/api/newsletter-editor/upload-source"), {
        method: "POST",
        headers: authHeaders,
        body: srcFd,
      });
      const srcData = await srcRes.json();
      if (srcData.success) {
        setSourceFileUrl(srcData.url);
        setSourceFileKey(srcData.key);
      }
    } catch (err: any) {
      setError("Failed to parse document: " + (err?.message || "Unknown error"));
    }
    setExtracting(false);
  }, [authHeaders]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleDocumentUpload(file);
  }, [handleDocumentUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleDocumentUpload(file);
  }, [handleDocumentUpload]);

  const handleRemoveDocument = useCallback(() => {
    setExtractedContent("");
    setSourceFileUrl("");
    setSourceFileKey("");
    setSourceFileName("");
    setSuggestedTitle("");
    setSuggestedDescription("");
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setExtractedContent("");
    setSourceFileUrl("");
    setSourceFileKey("");
    setSourceFileName("");
    setSuggestedTitle("");
    setSuggestedDescription("");
    setError("");
    setSuccess("");
  }, []);

  const handleSubmit = async () => {
    if (!extractedContent && !sourceFileUrl) { setError("Upload a document first"); return; }
    const finalTitle = title.trim() || suggestedTitle;
    const finalDescription = description.trim() || suggestedDescription;
    if (!finalTitle) { setError("Title is required"); return; }

    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(apiUrl("/api/newsletter-editor/drafts"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          id: editingId || undefined,
          title: finalTitle,
          description: finalDescription,
          content: extractedContent,
          sourceFileUrl: sourceFileUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(editingId ? "Newsletter updated!" : "Newsletter created!");
        resetForm();
        setMode("list");
        loadDrafts();
      } else {
        setError(data.error || "Failed to save");
      }
    } catch (err: any) {
      setError("Network error: " + (err?.message || "Unknown"));
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this newsletter?")) return;
    try {
      await fetch(apiUrl(`/api/newsletter-editor/drafts/${id}`), {
        method: "DELETE",
        headers: authHeaders,
      });
      setNewsletters(newsletters.filter((n) => n.id !== id));
    } catch {}
  };

  const handleSend = async (id: string) => {
    if (!confirm("Send this newsletter to all active subscribers?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/newsletter-editor/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({ newsletterId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Sent to ${data.sentCount} of ${data.total} subscribers!`);
        loadDrafts();
      } else {
        setError(data.error || "Failed to send");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  const cardBg = "var(--bg-card)";
  const btnBase: React.CSSProperties = {
    padding: "8px 20px", borderRadius: 12, border: "none", cursor: "pointer",
    fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    transition: "all 0.15s",
  };

  // ── Login View ──
  if (view === "login") {
    return (
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <TopBar isDark={isDark} toggleTheme={toggleTheme} />

        <div style={{ maxWidth: 420, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, margin: "0 auto 1rem", boxShadow: "0 4px 12px rgba(141, 198, 63, 0.3)" }}>180</div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Newsletter Editor</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 15, marginTop: 8 }}>Sign in with an authorized email to manage newsletters.</p>
          </div>

          <div style={{ background: cardBg, padding: "2rem", borderRadius: 24, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-lg)" }}>
            {error && <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 12px", textAlign: "center" }}>{error}</p>}
            {success && <p style={{ color: "#22c55e", fontSize: 13, margin: "0 0 12px", textAlign: "center" }}>{success}</p>}

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              style={{ width: "100%", padding: "0.875rem 1rem", borderRadius: 12, border: "1px solid var(--border-light)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 15, marginBottom: 12, boxSizing: "border-box" }}
            />
            <button
              onClick={handleSendOtp}
              disabled={loading || !email.trim()}
              style={{ ...btnBase, width: "100%", padding: "0.875rem", background: loading ? "var(--text-tertiary)" : "var(--accent)", color: "#fff" }}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </div>

          <p style={{ textAlign: "center", marginTop: "2rem", color: "var(--text-tertiary)", fontSize: 13 }}>&copy; 2026 180 Degrees Consulting. All rights reserved.</p>
        </div>
      </div>
    );
  }

  // ── OTP View ──
  if (view === "otp") {
    return (
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <TopBar isDark={isDark} toggleTheme={toggleTheme} />

        <div style={{ maxWidth: 420, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "var(--accent)", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 800, margin: "0 auto 1rem", boxShadow: "0 4px 12px rgba(141, 198, 63, 0.3)" }}>180</div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, color: "var(--text-primary)" }}>Enter OTP</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 15, marginTop: 8 }}>Sent to {email}</p>
          </div>

          <div style={{ background: cardBg, padding: "2rem", borderRadius: 24, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-lg)" }}>
            {error && <p style={{ color: "#ef4444", fontSize: 13, margin: "0 0 12px", textAlign: "center" }}>{error}</p>}

            <input
              type="text"
              placeholder="6-digit OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
              maxLength={6}
              style={{ width: "100%", padding: "0.875rem 1rem", borderRadius: 12, border: "1px solid var(--border-light)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 20, textAlign: "center", letterSpacing: 8, marginBottom: 12, boxSizing: "border-box", fontWeight: 700 }}
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading || otp.length !== 6}
              style={{ ...btnBase, width: "100%", padding: "0.875rem", background: loading || otp.length !== 6 ? "var(--text-tertiary)" : "var(--accent)", color: "#fff" }}
            >
              {loading ? "Verifying..." : "Verify OTP"}
            </button>
            <button
              onClick={() => { setView("login"); setOtp(""); setError(""); }}
              style={{ ...btnBase, width: "100%", padding: "0.75rem", background: "transparent", color: "var(--text-secondary)", marginTop: 8 }}
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Editor View ──
  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", width: "100%", padding: "1.5rem" }}>
      <TopBar isDark={isDark} toggleTheme={toggleTheme} sessionEmail={sessionEmail} onLogout={handleLogout} />

      <div style={{ maxWidth: 800, margin: "0 auto", paddingTop: 60 }}>
        {success && (
          <div style={{ background: cardBg, padding: "1rem 1.25rem", borderRadius: 12, border: "1px solid var(--border-light)", marginBottom: 16, borderLeft: "4px solid #22c55e" }}>
            <p style={{ margin: 0, color: "#22c55e", fontSize: 14 }}>{success}</p>
          </div>
        )}
        {error && (
          <div style={{ background: cardBg, padding: "1rem 1.25rem", borderRadius: 12, border: "1px solid var(--border-light)", marginBottom: 16, borderLeft: "4px solid #ef4444" }}>
            <p style={{ margin: 0, color: "#ef4444", fontSize: 14 }}>{error}</p>
          </div>
        )}

        {mode === "create" ? (
          <div style={{ background: cardBg, padding: "1.5rem", borderRadius: 20, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>{editingId ? "Edit Newsletter" : "New Newsletter"}</h2>
              <button onClick={() => { resetForm(); setMode("list"); }} style={{ ...btnBase, padding: "6px 14px", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>Cancel</button>
            </div>

            <input
              placeholder="Newsletter title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border-light)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, marginBottom: 12, boxSizing: "border-box" }}
            />
            <textarea
              placeholder="Short description (optional)"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", padding: "0.75rem 1rem", borderRadius: 12, border: "1px solid var(--border-light)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 14, marginBottom: 12, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
            />

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("nl-editor-file-input")?.click()}
              style={{
                border: `2px dashed ${dragOver ? "var(--accent)" : "var(--border-light)"}`,
                borderRadius: 12, padding: "24px 16px", textAlign: "center", cursor: "pointer",
                background: dragOver ? "rgba(141,198,63,0.05)" : "transparent", transition: "all 0.2s", marginBottom: 12,
              }}
            >
              <input id="nl-editor-file-input" type="file" accept=".pdf,.docx" style={{ display: "none" }} onChange={handleFileInput} />
              {extracting ? (
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Extracting text...</p>
              ) : sourceFileName ? (
                <div>
                  <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{sourceFileName}</p>
                  <button onClick={(e) => { e.stopPropagation(); handleRemoveDocument(); }} style={{ ...btnBase, padding: "4px 12px", fontSize: 12, color: "#ef4444", background: "transparent" }}>Remove</button>
                </div>
              ) : (
                <div>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px", opacity: 0.4, color: "var(--text-secondary)" }}>
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><polyline points="14 2 14 8 20 8" />
                  </svg>
                  <p style={{ margin: "0 0 4px", fontSize: 14, color: "var(--text-secondary)" }}>Drop a PDF or DOCX here, or click to browse</p>
                  <p style={{ margin: 0, fontSize: 12, color: "var(--text-tertiary)" }}>Max 20 MB</p>
                </div>
              )}
            </div>

            {extractedContent && sourceFileUrl && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-secondary)" }}>Preview:</p>
                <iframe src={apiUrl(sourceFileUrl)} title="Preview" style={{ width: "100%", height: 400, border: "none", borderRadius: 8, background: "#f5f5f5" }} />
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => { resetForm(); setMode("list"); }} style={{ ...btnBase, padding: "8px 20px", background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>Cancel</button>
              <button
                onClick={handleSubmit}
                disabled={submitting || (!extractedContent && !sourceFileUrl)}
                style={{ ...btnBase, padding: "8px 20px", background: submitting ? "var(--text-tertiary)" : "var(--accent)", color: "#fff" }}
              >
                {submitting ? "Saving..." : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: cardBg, padding: "1.5rem", borderRadius: 20, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-md)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>Newsletters</h2>
              <button onClick={() => { resetForm(); setMode("create"); }} style={{ ...btnBase, padding: "6px 14px", background: "var(--accent)", color: "#fff" }}>+ New</button>
            </div>

            {newsletters.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-tertiary)", textAlign: "center", padding: 24 }}>No newsletters yet. Click "+ New" to create one.</p>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {newsletters.map((nl) => (
                  <div key={nl.id} style={{ padding: 16, borderRadius: 12, border: "1px solid var(--border-light)", background: "var(--bg-primary)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: "0 0 4px", fontSize: 15, color: "var(--text-primary)" }}>{nl.title}</h4>
                        {nl.description && <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-secondary)" }}>{nl.description.slice(0, 150)}{nl.description.length > 150 ? "..." : ""}</p>}
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                          {nl.created_at?.slice(0, 10)}
                          {nl.sent_at && <span> — Sent to {nl.recipient_count} subscribers</span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {!nl.sent_at && (
                          <button onClick={() => handleSend(nl.id)} style={{ ...btnBase, padding: "4px 12px", fontSize: 12, background: "#22c55e", color: "#fff" }}>Send</button>
                        )}
                        <button
                          onClick={() => {
                            setEditingId(nl.id);
                            setTitle(nl.title);
                            setDescription(nl.description);
                            setExtractedContent(nl.content);
                            setSourceFileUrl(nl.source_file_url || "");
                            setMode("create");
                          }}
                          style={{ ...btnBase, padding: "4px 12px", fontSize: 12, background: "var(--border-light)", color: "var(--text-primary)" }}
                        >Edit</button>
                        <button onClick={() => handleDelete(nl.id)} style={{ ...btnBase, padding: "4px 12px", fontSize: 12, background: "transparent", color: "#ef4444" }}>Delete</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TopBar({ isDark, toggleTheme, sessionEmail, onLogout }: { isDark: boolean; toggleTheme: () => void; sessionEmail?: string; onLogout?: () => void }) {
  return (
    <>
      <div style={{ position: "absolute", top: 24, left: 24, display: "flex", gap: 10 }}>
        <a href="https://180dcvitc.org" style={{ padding: "10px 16px", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "var(--shadow-sm)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>home</span>
          Home
        </a>
      </div>
      <div style={{ position: "absolute", top: 24, right: 24, display: "flex", gap: 10, alignItems: "center" }}>
        {sessionEmail && (
          <span style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sessionEmail}</span>
        )}
        {sessionEmail && onLogout && (
          <button onClick={onLogout} style={{ padding: "6px 12px", fontSize: 12, fontWeight: 600, background: "transparent", border: "1px solid var(--border-light)", color: "var(--text-secondary)", borderRadius: 8, cursor: "pointer" }}>Logout</button>
        )}
        <button onClick={toggleTheme} style={{ padding: 10, border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow-sm)" }} title="Toggle Theme">
          <span className="material-symbols-outlined">{isDark ? "light_mode" : "dark_mode"}</span>
        </button>
      </div>
    </>
  );
}
