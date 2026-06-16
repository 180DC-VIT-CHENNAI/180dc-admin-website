import { useState, useEffect, useRef, useCallback } from "react";
import { apiUrl } from "../../lib/api";

// fallow-ignore-next-line complexity
export default function CaseStudySection({ authToken, powerLevel }: { authToken: string; powerLevel: number }) {
  const [caseStudies, setCaseStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);

  // Create form
  const [tag, setTag] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"list" | "create">("list");

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

  const insertAtCursor = useCallback((html: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    const sel = window.getSelection();
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
    }
    document.execCommand("insertHTML", false, html);
    savedRangeRef.current = null;
  }, []);

  // fallow-ignore-next-line complexity
  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(apiUrl("/api/blogs/upload-image"), {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (data.success) {
        setImageUrl(data.url);
        insertAtCursor(`<p><br></p><img src="${data.url}" alt="case study image" style="max-width:100%;border-radius:8px;" /><p><br></p>`);
      } else {
        setError(data.error || "Upload failed");
      }
    } catch {
      setError("Upload failed. Try again.");
    }
    setImageUploading(false);
  }, [insertAtCursor]);

  const exec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const content = editorRef.current?.innerHTML || "";
    const textContent = editorRef.current?.textContent || "";
    if (!tag.trim()) { setError("Tag is required"); return; }
    if (!title.trim() || title.trim().length < 3) { setError("Title must be at least 3 characters"); return; }
    if (!textContent.trim() || textContent.trim().length < 10) { setError("Content must be at least 10 characters"); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/case-studies"), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          tag: tag.trim(),
          title: title.trim(),
          description: description.trim() || textContent.trim().slice(0, 200),
          content,
          imageUrl: imageUrl || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMode("list");
        load();
      } else {
        setError(data.error || "Failed to create case study");
      }
    } catch {
      setError("Network error. Try again.");
    }
    setSubmitting(false);
  };

  async function handleDelete(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(apiUrl(`/api/case-studies/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await res.json();
      if (d.success) { setCaseStudies(prev => prev.filter(c => c.id !== id)); }
      else { alert(d.error || "Failed to delete"); }
    } catch { alert("Network error"); }
    setProcessing(null);
  }

  const canDelete = powerLevel >= 50;

  if (mode === "create") {
    const contentLen = editorRef.current?.textContent?.length || 0;
    const isOverLimit = contentLen > 100000;

    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Create Case Study</h2>
            <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
              Publish a new case study (visible immediately).
            </p>
          </div>
          <button className="btn outline" style={{ padding: "6px 16px", fontSize: 12 }} onClick={() => setMode("list")}>
            Back to List
          </button>
        </div>

        <div className="card-doodle" style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Tag *</label>
            <input
              type="text"
              placeholder="e.g. Strategy, Operations, Marketing"
              value={tag}
              onChange={e => setTag(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14 }}
              maxLength={50}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Title *</label>
            <input
              type="text"
              placeholder="Enter a compelling title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14 }}
              maxLength={200}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Summary / Description</label>
            <textarea
              placeholder="A short summary (optional, max 500 chars)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14, minHeight: 60, resize: "vertical" }}
              maxLength={500}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Featured Image</label>
            <div>
              {imageUrl ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img src={apiUrl(imageUrl)} alt="preview" style={{ maxHeight: 120, borderRadius: 8, border: "2px solid var(--border-light)" }} />
                  <button
                    type="button"
                    style={{ position: "absolute", top: -8, right: -8, width: 24, height: 24, borderRadius: "50%", border: "2px solid #dc3545", background: "#fff", color: "#dc3545", cursor: "pointer", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={() => setImageUrl("")}
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <label style={{ display: "inline-block", padding: "8px 16px", border: "2px dashed var(--border-light)", borderRadius: 8, cursor: "pointer", fontSize: 13 }}>
                  {imageUploading ? "Uploading..." : "Choose Image"}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} disabled={imageUploading} style={{ display: "none" }} />
                </label>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Content *</label>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4, padding: "6px", border: "2px solid var(--border-light)", borderRadius: "8px 8px 0 0", borderBottom: "none" }}>
              <button onClick={() => exec("bold")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}><b>B</b></button>
              <button onClick={() => exec("italic")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}><i>I</i></button>
              <button onClick={() => exec("underline")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}><u>U</u></button>
              <button onClick={() => exec("formatBlock", "<h2>")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>H2</button>
              <button onClick={() => exec("formatBlock", "<h3>")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>H3</button>
              <button onClick={() => exec("insertUnorderedList")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>&#x2022; List</button>
              <button onClick={() => exec("insertOrderedList")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>1. List</button>
              <button onClick={() => exec("formatBlock", "<blockquote>")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>&ldquo; Quote</button>
              <button onClick={() => { const url = prompt("Enter link URL:"); if (url) exec("createLink", url); }} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>&#x1F517;</button>
              <button onClick={() => exec("formatBlock", "<p>")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>&#xb6;</button>
            </div>
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Write your case study content here..."
              style={{ minHeight: 250, padding: 12, border: "2px solid var(--border-light)", borderRadius: "0 0 8px 8px", fontSize: 14, lineHeight: 1.6, fontFamily: "'Nunito', sans-serif" }}
              onSelect={() => {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
                  savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                }
              }}
              onKeyUp={() => {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
                  savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                }
              }}
              onMouseUp={() => {
                const sel = window.getSelection();
                if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
                  savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                }
              }}
              onPaste={(e) => {
                e.preventDefault();
                const html = e.clipboardData.getData("text/html");
                if (html) {
                  document.execCommand("insertHTML", false, html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]*on\w+\s*=[^>]*>/gi, ""));
                } else {
                  const text = e.clipboardData.getData("text/plain");
                  document.execCommand("insertText", false, text);
                }
              }}
            />
            <div style={{ fontSize: 11, color: isOverLimit ? "#dc3545" : "var(--text-secondary)", textAlign: "right", marginTop: 4 }}>
              {contentLen.toLocaleString()} / 100,000 characters
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: "#fef2f2", border: "2px solid #ef4444", borderRadius: 10, marginBottom: 16, color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="btn outline" onClick={() => setMode("list")}>Cancel</button>
            <button className="btn" onClick={handleSubmit} disabled={submitting || isOverLimit}>
              {submitting ? "Publishing..." : "Publish Case Study"}
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
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No case studies yet. Create your first one!</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          // fallow-ignore-next-line complexity
          {caseStudies.map((cs) => (
            <div key={cs.id} className="card-doodle" style={{ padding: 16, display: "flex", gap: 14, alignItems: "flex-start" }}>
              {cs.image_url && (
                <img src={apiUrl(cs.image_url)} alt="" style={{ width: 80, height: 60, borderRadius: 8, objectFit: "cover", border: "2px solid var(--border-light)", flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 700, background: "#8dc63f", color: "#fff" }}>{cs.tag}</span>
                  <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{cs.title}</strong>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
                  By {cs.author_name || "Anonymous"} &middot; {new Date(cs.created_at).toLocaleDateString()}
                </div>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>{cs.description}</p>
                {canDelete && (
                  <button
                    style={{ marginTop: 8, padding: "3px 10px", fontSize: 11, background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                    onClick={() => { if (confirm('Delete this case study permanently?')) handleDelete(cs.id); }}
                    disabled={processing === cs.id}
                  >
                    {processing === cs.id ? "..." : "Delete"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
