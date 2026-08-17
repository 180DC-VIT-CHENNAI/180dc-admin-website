import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../../lib/api";

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

interface Subscriber {
  id: string;
  email: string;
  active: number;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

interface Props {
  authToken: string;
}

export default function AdminNewsletterSection({ authToken }: Props) {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [tab, setTab] = useState<"newsletters" | "subscribers">("newsletters");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [extractedContent, setExtractedContent] = useState("");
  const [sourceFileUrl, setSourceFileUrl] = useState("");
  const [sourceFileKey, setSourceFileKey] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [suggestedTitle, setSuggestedTitle] = useState("");
  const [suggestedDescription, setSuggestedDescription] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");

  const load = useCallback(async () => {
    try {
      const [nlRes, subRes] = await Promise.all([
        fetch(apiUrl("/api/newsletter/admin"), { headers: { Authorization: `Bearer ${authToken}` } }),
        fetch(apiUrl("/api/newsletter/admin/subscribers"), { headers: { Authorization: `Bearer ${authToken}` } }),
      ]);
      const nlData = await nlRes.json();
      const subData = await subRes.json();
      if (nlData.success) setNewsletters(nlData.data || []);
      if (subData.success) setSubscribers(subData.data || []);
    } catch {}
  }, [authToken]);

  useEffect(() => { load(); }, [load]);

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
      const srcRes = await fetch(apiUrl("/api/newsletter/upload-source"), {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
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
  }, [authToken]);

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

  const handleRemoveDocument = useCallback(async () => {
    if (sourceFileKey) {
      try {
        await fetch(apiUrl("/api/case-studies/delete-image"), {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
          body: JSON.stringify({ key: sourceFileKey }),
        });
      } catch {}
    }
    setExtractedContent("");
    setSourceFileUrl("");
    setSourceFileKey("");
    setSourceFileName("");
  }, [sourceFileKey, authToken]);

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
      const url = editingId ? apiUrl(`/api/newsletter`) : apiUrl("/api/newsletter");
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
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
        load();
      } else {
        setError(data.error || "Failed to save newsletter");
      }
    } catch (err: any) {
      setError("Network error: " + (err?.message || "Unknown"));
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this newsletter?")) return;
    try {
      await fetch(apiUrl(`/api/newsletter/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      setNewsletters(newsletters.filter((n) => n.id !== id));
    } catch {}
  };

  const handleSend = async (id: string) => {
    if (!confirm("Send this newsletter to all active subscribers?")) return;
    try {
      const res = await fetch(apiUrl("/api/newsletter/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ newsletterId: id }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Newsletter sent to ${data.sentCount} of ${data.total} subscribers!`);
        load();
      } else {
        setError(data.error || "Failed to send");
      }
    } catch (err: any) {
      setError("Network error: " + (err?.message || "Unknown"));
    }
  };

  return (
    <div className="members-grid">
      <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h3 style={{ margin: 0 }}>Newsletter</h3>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn"
              style={{ padding: "6px 14px", fontSize: 13, background: tab === "newsletters" ? "var(--accent-primary)" : "transparent", color: tab === "newsletters" ? "#fff" : "var(--text-secondary)" }}
              onClick={() => setTab("newsletters")}
            >
              Newsletters
            </button>
            <button
              className="btn"
              style={{ padding: "6px 14px", fontSize: 13, background: tab === "subscribers" ? "var(--accent-primary)" : "transparent", color: tab === "subscribers" ? "#fff" : "var(--text-secondary)" }}
              onClick={() => setTab("subscribers")}
            >
              Subscribers ({subscribers.filter((s) => s.active).length})
            </button>
          </div>
        </div>
      </div>

      {success && (
        <div className="dashboard-card" style={{ gridColumn: "1 / -1", borderLeft: "4px solid #22c55e" }}>
          <p style={{ margin: 0, color: "#22c55e", fontSize: 14 }}>{success}</p>
        </div>
      )}
      {error && (
        <div className="dashboard-card" style={{ gridColumn: "1 / -1", borderLeft: "4px solid #ef4444" }}>
          <p style={{ margin: 0, color: "#ef4444", fontSize: 14 }}>{error}</p>
        </div>
      )}

      {/* ── Newsletters tab ── */}
      {tab === "newsletters" && (
        <>
          {/* Create / edit form */}
          {mode === "create" && (
            <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0 }}>{editingId ? "Edit Newsletter" : "Create Newsletter"}</h3>
                <button className="btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => { resetForm(); setMode("list"); }}>Cancel</button>
              </div>

              <div style={{ display: "grid", gap: 12 }}>
                <input
                  className="input"
                  placeholder="Newsletter title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
                <textarea
                  className="input"
                  placeholder="Short description (optional)"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                {/* File upload */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  style={{
                    border: `2px dashed ${dragOver ? "var(--accent-primary)" : "var(--border-default)"}`,
                    borderRadius: 8,
                    padding: "24px 16px",
                    textAlign: "center",
                    background: dragOver ? "var(--accent-bg, rgba(0,0,0,0.03))" : "transparent",
                    cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onClick={() => document.getElementById("newsletter-file-input")?.click()}
                >
                  <input
                    id="newsletter-file-input"
                    type="file"
                    accept=".pdf,.docx"
                    style={{ display: "none" }}
                    onChange={handleFileInput}
                  />
                  {extracting ? (
                    <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Extracting text...</p>
                  ) : sourceFileName ? (
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600 }}>{sourceFileName}</p>
                      <button
                        className="btn"
                        style={{ padding: "4px 12px", fontSize: 12, color: "#ef4444" }}
                        onClick={(e) => { e.stopPropagation(); handleRemoveDocument(); }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px", opacity: 0.4 }}>
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                        <polyline points="14 2 14 8 20 8"/>
                      </svg>
                      <p style={{ margin: "0 0 4px", fontSize: 14 }}>Drop a PDF or DOCX here, or click to browse</p>
                      <p style={{ margin: 0, fontSize: 12, color: "var(--text-tertiary)" }}>Max 20 MB</p>
                    </div>
                  )}
                </div>

                {/* PDF preview */}
                {extractedContent && sourceFileUrl && (
                  <div style={{ marginTop: 4 }}>
                    <p style={{ margin: "0 0 8px", fontSize: 13, color: "var(--text-secondary)" }}>Preview:</p>
                    <iframe
                      src={apiUrl(sourceFileUrl)}
                      title="Preview"
                      style={{ width: "100%", height: 400, border: "none", borderRadius: 8, background: "#f5f5f5" }}
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="btn" style={{ padding: "8px 20px" }} onClick={() => { resetForm(); setMode("list"); }}>Cancel</button>
                  <button
                    className="btn"
                    style={{ padding: "8px 20px" }}
                    disabled={submitting || (!extractedContent && !sourceFileUrl)}
                    onClick={handleSubmit}
                  >
                    {submitting ? "Saving..." : editingId ? "Update" : "Create"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {mode === "list" && (
            <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{newsletters.length} newsletter(s)</p>
                <button className="btn" style={{ padding: "6px 14px", fontSize: 13 }} onClick={() => { resetForm(); setMode("create"); }}>
                  + New Newsletter
                </button>
              </div>
              {newsletters.length === 0 ? (
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-tertiary)", textAlign: "center", padding: 24 }}>No newsletters yet. Click "New Newsletter" to create one.</p>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {newsletters.map((nl) => (
                    <div
                      key={nl.id}
                      style={{
                        padding: 16,
                        borderRadius: 8,
                        border: "1px solid var(--border-default)",
                        background: "var(--bg-secondary, rgba(0,0,0,0.02))",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: "0 0 4px", fontSize: 15 }}>{nl.title}</h4>
                          {nl.description && <p style={{ margin: "0 0 4px", fontSize: 13, color: "var(--text-secondary)" }}>{nl.description.slice(0, 150)}{nl.description.length > 150 ? "..." : ""}</p>}
                          <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                            {nl.created_at?.slice(0, 10)}
                            {nl.sent_at && <span> — Sent to {nl.recipient_count} subscribers on {nl.sent_at.slice(0, 10)}</span>}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                          {!nl.sent_at && (
                            <button
                              className="btn"
                              style={{ padding: "4px 12px", fontSize: 12, background: "#22c55e", color: "#fff" }}
                              onClick={() => handleSend(nl.id)}
                            >
                              Send
                            </button>
                          )}
                          <button
                            className="btn"
                            style={{ padding: "4px 12px", fontSize: 12 }}
                            onClick={() => {
                              setEditingId(nl.id);
                              setTitle(nl.title);
                              setDescription(nl.description);
                              setExtractedContent(nl.content);
                              setSourceFileUrl(nl.source_file_url || "");
                              setMode("create");
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="btn"
                            style={{ padding: "4px 12px", fontSize: 12, color: "#ef4444" }}
                            onClick={() => handleDelete(nl.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Subscribers tab ── */}
      {tab === "subscribers" && (
        <div className="dashboard-card" style={{ gridColumn: "1 / -1" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-secondary)" }}>
            {subscribers.filter((s) => s.active).length} active subscriber(s)
          </p>
          {subscribers.length === 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: "var(--text-tertiary)", textAlign: "center", padding: 24 }}>No subscribers yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {subscribers.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-default)",
                    background: sub.active ? "var(--bg-secondary, rgba(0,0,0,0.02))" : "transparent",
                    opacity: sub.active ? 1 : 0.5,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{sub.email}</span>
                    <span style={{ fontSize: 12, color: "var(--text-tertiary)", marginLeft: 8 }}>
                      {sub.active ? "Active" : "Unsubscribed"} — {sub.subscribed_at?.slice(0, 10)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
