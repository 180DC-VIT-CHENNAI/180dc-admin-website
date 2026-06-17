import { useState, useEffect } from "react";
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, color: "#28a745", fontWeight: 600 }}>Published &middot; Visible on homepage</span>
                    {canManage && (
                      <button
                        style={{
                          padding: "3px 10px",
                          fontSize: 11,
                          background: "#dc3545",
                          color: "#fff",
                          border: "none",
                          borderRadius: 4,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          if (confirm('Delete this blog permanently? This cannot be undone.')) {
                            handleDelete(blog.id);
                          }
                        }}
                        disabled={processing === blog.id}
                      >
                        {processing === blog.id ? "..." : "Delete"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
