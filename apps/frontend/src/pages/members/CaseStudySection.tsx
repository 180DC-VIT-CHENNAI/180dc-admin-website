import { useState, useEffect, useCallback } from "react";
import { apiUrl } from "../../lib/api";

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function CaseStudySection({ authToken, powerLevel }: { authToken: string; powerLevel: number }) {
  const [caseStudies, setCaseStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [tag, setTag] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");

  const [extractedContent, setExtractedContent] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [sourceFileUrl, setSourceFileUrl] = useState("");
  const [sourceFileKey, setSourceFileKey] = useState("");
  const [sourceFileName, setSourceFileName] = useState("");
  const [dragOver, setDragOver] = useState(false);

  async function load() {
    try {
      const res = await fetch(apiUrl("/api/case-studies"), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await res.json();
      if (d.success) setCaseStudies(d.data || []);
    } catch {} finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [authToken]);

  const handleDocumentUpload = useCallback(async (file: File) => {
    setExtracting(true);
    setError("");
    setExtractedContent("");
    setSourceFileName(file.name);
    try {
      let html = "";
      let suggestedTitle = "";
      let suggestedDescription = "";

      if (file.type === "application/pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        const pdfjsVersion = pdfjsLib.version;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useWorkerFetch: true, useSystemFonts: true }).promise;

        if (pdf.numPages > 0) {
          const meta = await pdf.getMetadata().catch(() => null);
          const info = meta?.info as Record<string, string> | undefined;
          if (info?.Title && info.Title.trim()) suggestedTitle = info.Title.trim();
        }

        const textParts: string[] = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items.map((item: any) => item.str).join(" ");
          textParts.push(pageText);
        }
        const text = textParts.join("\n\n");
        const paragraphs = text.split(/\n{2,}/).filter((p: string) => p.trim().length > 0);
        html = paragraphs
          .map((p: string) => {
            const trimmed = p.trim();
            const lines = trimmed.split("\n");
            if (lines.length === 1) return `<p>${escapeHtml(lines[0].trim())}</p>`;
            return lines.map((l: string) => `<p>${escapeHtml(l.trim())}</p>`).join("\n");
          })
          .join("\n");

        if (!suggestedTitle && paragraphs.length > 0) {
          const firstLine = paragraphs[0].split("\n")[0].trim();
          if (firstLine.length >= 3 && firstLine.length <= 200) suggestedTitle = firstLine;
        }
        if (paragraphs.length > 1) {
          const desc = paragraphs[1].replace(/\n/g, " ").trim();
          suggestedDescription = desc.length > 500 ? desc.slice(0, 497) + "..." : desc;
        }
      } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
        const mammoth = await import("mammoth");
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        html = result.value;

        const tempDiv = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        const firstSentence = tempDiv.split(/[.!?]\s/)[0];
        if (firstSentence && firstSentence.length >= 3 && firstSentence.length <= 200) {
          suggestedTitle = firstSentence.trim();
        }
        const rest = tempDiv.slice(suggestedTitle.length).trim();
        if (rest) suggestedDescription = rest.length > 500 ? rest.slice(0, 497) + "..." : rest;
      } else {
        setError("Unsupported file type. Please upload a PDF or DOCX file.");
        setExtracting(false);
        return;
      }

      const textOnly = html.replace(/<[^>]*>/g, "").trim();
      if (textOnly.length < 10) {
        setError("Document appears empty or contains less than 10 visible characters.");
        setExtracting(false);
        return;
      }

      setExtractedContent(html);
      if (suggestedTitle && !title) setTitle(suggestedTitle);
      if (suggestedDescription && !description) setDescription(suggestedDescription);

      const srcFd = new FormData();
      srcFd.append("file", file);
      const srcRes = await fetch(apiUrl("/api/case-studies/upload-source"), {
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
      console.error("Document parsing error:", err);
      setError("Failed to parse document: " + (err?.message || "Unknown error"));
    }
    setExtracting(false);
  }, [authToken, title, description]);

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

  const handleSubmit = async () => {
    const textOnly = extractedContent.replace(/<[^>]*>/g, "").trim();
    if (!textOnly || textOnly.length < 10) { setError("Upload a document with at least 10 visible characters"); return; }

    setSubmitting(true);
    setError("");
    try {
      const url = editingId ? apiUrl(`/api/case-studies/${editingId}`) : apiUrl("/api/case-studies");
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          tag: tag.trim() || undefined,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          content: extractedContent,
          sourceFileUrl: sourceFileUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditingId(null);
        setMode("list");
        load();
      } else {
        setError(data.error || "Failed to save case study");
      }
    } catch {
      setError("Network error. Try again.");
    }
    setSubmitting(false);
  };

  const startEdit = useCallback((cs: any) => {
    setEditingId(cs.id);
    setTag(cs.tag === "Uncategorized" ? "" : (cs.tag || ""));
    setTitle(cs.title === "Untitled" ? "" : (cs.title || ""));
    setDescription(cs.description || "");
    setExtractedContent(cs.content || "");
    setSourceFileUrl(cs.source_file_url || "");
    setSourceFileKey("");
    setSourceFileName(cs.source_file_url ? "Source document" : "");
    setError("");
    setMode("create");
  }, []);

  const cancelForm = useCallback(() => {
    setEditingId(null);
    setTag("");
    setTitle("");
    setDescription("");
    setExtractedContent("");
    setSourceFileUrl("");
    setSourceFileKey("");
    setSourceFileName("");
    setError("");
    setMode("list");
  }, []);

  async function handleDelete(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(apiUrl(`/api/case-studies/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await res.json();
      if (d.success) {
        setCaseStudies(prev => prev.filter(c => c.id !== id));
        if (editingId === id) cancelForm();
      }
      else { alert(d.error || "Failed to delete"); }
    } catch { alert("Network error"); }
    setProcessing(null);
  }

  const canDelete = powerLevel >= 50;
  const canEdit = powerLevel >= 10;

  if (mode === "create") {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>{editingId ? "Edit Case Study" : "Create Case Study"}</h2>
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
              {editingId ? "Update your case study." : "Upload a PDF or DOCX to create a case study."}
            </p>
          </div>
          <button className="btn outline" style={{ padding: "6px 16px", fontSize: 12 }} onClick={cancelForm}>
            Back to List
          </button>
        </div>

        <div className="card-doodle" style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
              Document <span style={{ color: "#dc3545" }}>*</span>
            </label>
            {!extractedContent && !extracting && (
              <div
                className={`doc-upload-zone ${dragOver ? "drag-over" : ""}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  padding: "32px 20px",
                  border: "2px dashed var(--border-light)",
                  borderRadius: 10,
                  textAlign: "center",
                  cursor: "pointer",
                  background: dragOver ? "var(--bg-secondary, #f5f5f5)" : "transparent",
                  transition: "background 0.2s",
                }}
              >
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 8px", opacity: 0.35 }}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                  <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 600 }}>Drop a PDF or DOCX file here</p>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "var(--text-secondary)" }}>or click to browse</p>
                <label style={{ display: "inline-block", padding: "8px 20px", background: "var(--accent-primary)", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  Choose File
                  <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileInput} style={{ display: "none" }} />
                </label>
                <p style={{ margin: "12px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>PDF, DOCX (max 20 MB)</p>
              </div>
            )}
            {extracting && (
              <div style={{ padding: "32px 20px", border: "2px solid var(--border-light)", borderRadius: 10, textAlign: "center" }}>
                <div className="spinner" style={{ width: 24, height: 24, border: "3px solid var(--border-light)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)" }}>Extracting content...</p>
              </div>
            )}
            {extractedContent && !extracting && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {sourceFileName && `${sourceFileName} `}
                    {extractedContent.replace(/<[^>]*>/g, "").length.toLocaleString()} characters
                  </span>
                  <div style={{ display: "flex", gap: 6 }}>
                    <label style={{ padding: "4px 10px", fontSize: 11, background: "var(--accent-primary)", color: "#fff", borderRadius: 4, cursor: "pointer" }}>
                      Replace
                      <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFileInput} style={{ display: "none" }} />
                    </label>
                    <button
                      type="button"
                      style={{ padding: "4px 10px", fontSize: 11, background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                      onClick={handleRemoveDocument}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div
                  className="doc-preview"
                  style={{
                    maxHeight: 300,
                    overflowY: "auto",
                    padding: 16,
                    border: "2px solid var(--border-light)",
                    borderRadius: 10,
                    fontSize: 14,
                    lineHeight: 1.7,
                    fontFamily: "var(--font-sans)",
                    background: "var(--bg-primary, #fff)",
                  }}
                  dangerouslySetInnerHTML={{ __html: extractedContent }}
                />
              </div>
            )}
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Title</label>
            <input
              type="text"
              placeholder="Auto-filled from document, or enter manually"
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14 }}
              maxLength={200}
            />
          </div>

          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Tag</label>
              <input
                type="text"
                placeholder="e.g. Strategy, Operations"
                value={tag}
                onChange={e => setTag(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14 }}
                maxLength={50}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Summary</label>
              <input
                type="text"
                placeholder="Short summary (optional)"
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14 }}
                maxLength={500}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: "#fef2f2", border: "2px solid #ef4444", borderRadius: 10, marginBottom: 16, color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn outline" onClick={cancelForm}>Cancel</button>
            <button className="btn" onClick={handleSubmit} disabled={submitting || !extractedContent}>
              {submitting ? "Saving..." : editingId ? "Update Case Study" : "Publish Case Study"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Case Studies</h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
            Manage and create case studies (published immediately).
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn outline" style={{ padding: "6px 16px", fontSize: 12 }} onClick={load} disabled={loading}>
            {loading ? "Loading..." : "Refresh"}
          </button>
          <button className="btn" style={{ padding: "6px 16px", fontSize: 12 }} onClick={() => setMode("create")}>
            + New Case Study
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>Loading case studies...</div>
      ) : caseStudies.length === 0 ? (
        <div className="card-doodle" style={{ padding: 32, textAlign: "center" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto 12px", opacity: 0.25 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No case studies yet. Upload a document to create your first one.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {caseStudies.map((cs) => (
            <div key={cs.id} className="card-doodle" style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "var(--accent-primary)", color: "#fff" }}>{cs.tag}</span>
                  <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{cs.title}</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                  By {cs.author_name || "Anonymous"} &middot; {new Date(cs.created_at).toLocaleDateString()}
                </div>
                {cs.description && <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{cs.description}</p>}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {canEdit && (
                    <button
                      style={{ padding: "3px 10px", fontSize: 11, background: "var(--accent-primary)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                      onClick={() => startEdit(cs)}
                    >
                      Edit
                    </button>
                  )}
                  {canDelete && (
                    <button
                      style={{ padding: "3px 10px", fontSize: 11, background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                      onClick={() => { if (confirm('Delete this case study permanently?')) handleDelete(cs.id); }}
                      disabled={processing === cs.id}
                    >
                      {processing === cs.id ? "..." : "Delete"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
