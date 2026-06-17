import { useState, useEffect, useRef, useCallback } from "react";
import { apiUrl } from "../../lib/api";
import { sanitizeHtml } from "../../lib/sanitize";

function rewriteContentUrls(html: string): string {
  const base = apiUrl("");
  return html.replace(/(src|href)\s*=\s*"(\/api\/)/g, '$1="' + base + '$2');
}

export default function BlogSection({ authToken, powerLevel }: { authToken: string; powerLevel: number }) {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [previewBlog, setPreviewBlog] = useState<any>(null);
  const [editBlog, setEditBlog] = useState<any>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editAssociation, setEditAssociation] = useState("");
  const [editExcerpt, setEditExcerpt] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const blogEditorRef = useRef<HTMLDivElement>(null);
  const blogSavedRangeRef = useRef<Range | null>(null);

  const blogExec = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    blogEditorRef.current?.focus();
  }, []);

  async function load() {
    try {
      const res = await fetch(apiUrl("/api/blogs/admin"), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await res.json();
      if (d.success) setBlogs(d.data || []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [authToken]);

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(apiUrl(`/api/blogs/${id}/approve`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await res.json();
      if (d.success) { setBlogs(prev => prev.map(b => b.id === id ? { ...b, status: "approved", is_published: 1 } : b)); }
      else { alert(d.error || "Failed to approve"); }
    } catch { alert("Network error"); }
    setProcessing(null);
  }

  async function handleReject(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(apiUrl(`/api/blogs/${id}/reject`), {
        method: "PUT",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await res.json();
      if (d.success) { setBlogs(prev => prev.map(b => b.id === id ? { ...b, status: "rejected", is_published: 0 } : b)); }
      else { alert(d.error || "Failed to reject"); }
    } catch { alert("Network error"); }
    setProcessing(null);
  }

  async function handleDelete(id: string) {
    setProcessing(id);
    try {
      const res = await fetch(apiUrl(`/api/blogs/${id}`), {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await res.json();
      if (d.success) { setBlogs(prev => prev.filter(b => b.id !== id)); }
      else { alert(d.error || "Failed to delete"); }
    } catch { alert("Network error"); }
    setProcessing(null);
  }

  function openEdit(blog: any) {
    setEditBlog(blog);
    setEditTitle(blog.title || "");
    setEditSlug(blog.slug || "");
    setEditAuthor(blog.author_name || "");
    setEditAssociation(blog.author_association || "");
    setEditExcerpt(blog.excerpt || "");
    setEditImageUrl(blog.image_url || "");
    setEditContent(blog.content || "");
    setEditError("");
    setEditSaving(false);
    setTimeout(() => {
      if (blogEditorRef.current) {
        blogEditorRef.current.innerHTML = blog.content || "";
      }
    }, 0);
  }

  async function handleEditSave() {
    const content = blogEditorRef.current?.innerHTML || editContent;
    if (!editTitle.trim() || editTitle.trim().length < 3) { setEditError("Title must be at least 3 characters"); return; }
    if (!content.trim() || content.trim().length < 10) { setEditError("Content must be at least 10 characters"); return; }
    if (content.length > 100000) { setEditError("Content too long (max 100,000 chars)"); return; }
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch(apiUrl(`/api/blogs/${editBlog.id}/edit`), {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          title: editTitle.trim(),
          content,
          excerpt: editExcerpt.trim() || null,
          imageUrl: editImageUrl.trim() || null,
          authorName: editAuthor.trim() || "Anonymous",
          authorAssociation: editAssociation.trim() || "",
          slug: editSlug.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setEditBlog(null);
        load();
      } else {
        setEditError(d.error || "Failed to update blog");
      }
    } catch {
      setEditError("Network error. Try again.");
    }
    setEditSaving(false);
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: "#f39c12",
      approved: "#28a745",
      rejected: "#dc3545",
    };
    return (
      <span style={{
        display: "inline-block",
        padding: "2px 10px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        color: "#fff",
        background: colors[status] || "#6c757d",
      }}>
        {status}
      </span>
    );
  };

  const canManage = powerLevel >= 100;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Blog Management</h2>
          <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: 13 }}>
            Review and manage blog posts submitted by members.
          </p>
        </div>
        <button className="btn outline" style={{ padding: "6px 16px", fontSize: 12 }} onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "var(--text-secondary)" }}>Loading blogs...</div>
      ) : blogs.length === 0 ? (
        <div className="card-doodle" style={{ padding: 32, textAlign: "center" }}>
          <p style={{ margin: 0, color: "var(--text-secondary)" }}>No blog posts yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {blogs.filter(blog => blog.status !== "rejected").map(blog => (
            <div key={blog.id} className="card-doodle" style={{
              padding: 16,
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}>
              {blog.image_url && (
                <img src={apiUrl(blog.image_url)} alt="" style={{
                  width: 80,
                  height: 60,
                  borderRadius: 8,
                  objectFit: "cover",
                  border: "2px solid var(--border-light)",
                  flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{blog.title}</strong>
                  {statusBadge(blog.status)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                  By {blog.author_name} &middot; {new Date(blog.created_at).toLocaleDateString()}
                  {blog.slug && <span style={{ marginLeft: 8, fontFamily: "monospace", fontSize: 11, opacity: 0.6 }}>/blog/{blog.slug}</span>}
                </div>
                {blog.excerpt && (
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {blog.excerpt}
                  </div>
                )}
                {canManage && blog.status === "pending" && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button
                      className="btn outline"
                      style={{ padding: "5px 14px", fontSize: 12 }}
                      onClick={() => setPreviewBlog(blog)}
                    >
                      Preview
                    </button>
                    <button
                      className="btn"
                      style={{ padding: "5px 14px", fontSize: 12 }}
                      onClick={() => handleApprove(blog.id)}
                      disabled={processing === blog.id}
                    >
                      {processing === blog.id ? "..." : "Approve"}
                    </button>
                    <button
                      className="btn outline"
                      style={{ padding: "5px 14px", fontSize: 12, borderColor: "#dc3545", color: "#dc3545" }}
                      onClick={() => handleReject(blog.id)}
                      disabled={processing === blog.id}
                    >
                      {processing === blog.id ? "..." : "Reject"}
                    </button>
                  </div>
                )}
                {blog.status === "approved" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 12, color: "#28a745", fontWeight: 600 }}>Published</span>
                    {canManage && (
                      <>
                        <button
                          style={{ padding: "3px 10px", fontSize: 11, background: "var(--accent, #8dc63f)", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                          onClick={() => openEdit(blog)}
                        >
                          Edit
                        </button>
                        <button
                          style={{ padding: "3px 10px", fontSize: 11, background: "#dc3545", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
                          onClick={() => {
                            if (confirm('Delete this blog permanently? This cannot be undone.')) {
                              handleDelete(blog.id);
                            }
                          }}
                          disabled={processing === blog.id}
                        >
                          {processing === blog.id ? "..." : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editBlog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            padding: 24,
          }}
          onClick={() => setEditBlog(null)}
        >
          <div
            style={{
              background: "var(--surface, #fff)",
              border: "3px solid var(--text-primary, #111)",
              borderRadius: 16,
              boxShadow: "6px 6px 0 var(--text-primary, #111)",
              maxWidth: 800,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 32,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Edit Blog</h2>
              <button onClick={() => setEditBlog(null)} style={{ background: "none", border: "none", fontSize: 24, cursor: "pointer", color: "var(--text-secondary, #666)", lineHeight: 1, padding: "0 4px" }}>&times;</button>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Title *</label>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14 }} maxLength={200} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Slug</label>
              <input value={editSlug} onChange={e => setEditSlug(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14, fontFamily: "monospace" }} placeholder="url-friendly-slug" />
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Author Name</label>
                <input value={editAuthor} onChange={e => setEditAuthor(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14 }} maxLength={100} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Author Association</label>
                <input value={editAssociation} onChange={e => setEditAssociation(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14 }} maxLength={100} />
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Featured Image URL</label>
              <input value={editImageUrl} onChange={e => setEditImageUrl(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14, fontFamily: "monospace" }} placeholder="/api/blogs/images/blogs/uuid.jpg" />
              {editImageUrl && <img src={apiUrl(editImageUrl)} alt="" style={{ maxHeight: 80, borderRadius: 8, marginTop: 8, border: "2px solid var(--border-light)" }} />}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Excerpt</label>
              <textarea value={editExcerpt} onChange={e => setEditExcerpt(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "2px solid var(--border-light)", borderRadius: 8, fontSize: 14, minHeight: 60, resize: "vertical" }} maxLength={500} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Content *</label>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 4, padding: "6px", border: "2px solid var(--border-light)", borderRadius: "8px 8px 0 0", borderBottom: "none" }}>
                <button onClick={() => blogExec("bold")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}><b>B</b></button>
                <button onClick={() => blogExec("italic")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}><i>I</i></button>
                <button onClick={() => blogExec("underline")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}><u>U</u></button>
                <button onClick={() => blogExec("formatBlock", "<h2>")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>H2</button>
                <button onClick={() => blogExec("formatBlock", "<h3>")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>H3</button>
                <button onClick={() => blogExec("insertUnorderedList")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>&#x2022; List</button>
                <button onClick={() => blogExec("insertOrderedList")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>1. List</button>
                <button onClick={() => blogExec("formatBlock", "<blockquote>")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>&ldquo; Quote</button>
                <button onClick={() => { const url = prompt("Enter link URL:"); if (url) blogExec("createLink", url); }} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>&#x1F517;</button>
                <button onClick={() => blogExec("formatBlock", "<p>")} style={{ padding: "4px 8px", border: "1px solid #ddd", borderRadius: 4, background: "#f5f5f5", cursor: "pointer", fontSize: 13 }}>&#xb6;</button>
              </div>
              <div
                ref={blogEditorRef}
                contentEditable
                suppressContentEditableWarning
                data-placeholder="Write your blog content here..."
                style={{ minHeight: 300, padding: 12, border: "2px solid var(--border-light)", borderRadius: "0 0 8px 8px", fontSize: 14, lineHeight: 1.6, fontFamily: "'Nunito', sans-serif" }}
                onInput={() => {
                  const html = blogEditorRef.current?.innerHTML || "";
                  setEditContent(html);
                }}
                onKeyUp={() => {
                  const html = blogEditorRef.current?.innerHTML || "";
                  setEditContent(html);
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0 && blogEditorRef.current?.contains(sel.anchorNode)) {
                    blogSavedRangeRef.current = sel.getRangeAt(0).cloneRange();
                  }
                }}
                onMouseUp={() => {
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0 && blogEditorRef.current?.contains(sel.anchorNode)) {
                    blogSavedRangeRef.current = sel.getRangeAt(0).cloneRange();
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
              <div style={{ fontSize: 11, color: editContent.length > 100000 ? "#dc3545" : "var(--text-secondary)", textAlign: "right", marginTop: 4 }}>
                {editContent.length.toLocaleString()} / 100,000 characters
              </div>
            </div>

            {editError && (
              <div style={{ padding: "12px 16px", background: "#fef2f2", border: "2px solid #ef4444", borderRadius: 10, marginBottom: 16, color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
                {editError}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn outline" onClick={() => setEditBlog(null)}>Cancel</button>
              <button className="btn" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewBlog && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.5)",
            padding: 24,
          }}
          onClick={() => setPreviewBlog(null)}
        >
          <div
            style={{
              background: "var(--surface, #fff)",
              border: "3px solid var(--text-primary, #111)",
              borderRadius: 16,
              boxShadow: "6px 6px 0 var(--text-primary, #111)",
              maxWidth: 720,
              width: "100%",
              maxHeight: "85vh",
              overflowY: "auto",
              padding: 32,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: "1.3rem", color: "var(--text-primary, #111)" }}>{previewBlog.title}</h2>
                <div style={{ fontSize: 12, color: "var(--text-secondary, #666)", marginTop: 4 }}>
                  By {previewBlog.author_name}
                  {previewBlog.author_association && <span> &middot; {previewBlog.author_association}</span>}
                  <span> &middot; {new Date(previewBlog.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => setPreviewBlog(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 24,
                  cursor: "pointer",
                  color: "var(--text-secondary, #666)",
                  lineHeight: 1,
                  padding: "0 4px",
                }}
              >
                &times;
              </button>
            </div>

            {previewBlog.image_url && (
              <img
                src={apiUrl(previewBlog.image_url)}
                alt=""
                style={{
                  width: "100%",
                  maxHeight: 300,
                  objectFit: "cover",
                  borderRadius: 10,
                  border: "2px solid var(--border-light, #ddd)",
                  marginBottom: 16,
                }}
              />
            )}

            {previewBlog.excerpt && (
              <p style={{ fontSize: 14, color: "var(--text-secondary, #666)", fontStyle: "italic", marginBottom: 16 }}>
                {previewBlog.excerpt}
              </p>
            )}

            <div
              style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-primary, #111)" }}
              dangerouslySetInnerHTML={{ __html: rewriteContentUrls(sanitizeHtml(previewBlog.content)) }}
            />

            {canManage && previewBlog.status === "pending" && (
              <div style={{ display: "flex", gap: 8, marginTop: 24, borderTop: "2px solid var(--border-light, #ddd)", paddingTop: 16 }}>
                <button
                  className="btn"
                  style={{ padding: "6px 18px", fontSize: 13 }}
                  onClick={() => { handleApprove(previewBlog.id); setPreviewBlog(null); }}
                  disabled={processing === previewBlog.id}
                >
                  {processing === previewBlog.id ? "..." : "Approve"}
                </button>
                <button
                  className="btn outline"
                  style={{ padding: "6px 18px", fontSize: 13, borderColor: "#dc3545", color: "#dc3545" }}
                  onClick={() => { handleReject(previewBlog.id); setPreviewBlog(null); }}
                  disabled={processing === previewBlog.id}
                >
                  {processing === previewBlog.id ? "..." : "Reject"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
