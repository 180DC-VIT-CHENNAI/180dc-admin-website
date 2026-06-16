import { useState, useEffect } from "react";
import { apiUrl } from "../../lib/api";

export default function BlogSection({ authToken, powerLevel }: { authToken: string; powerLevel: number }) {
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

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
          {blogs.map(blog => (
            <div key={blog.id} className="card-doodle" style={{
              padding: 16,
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
              opacity: blog.status === "rejected" ? 0.55 : 1,
            }}>
              {blog.image_url && (
                <img src={blog.image_url} alt="" style={{
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
                  <div style={{ fontSize: 12, color: "#28a745", fontWeight: 600 }}>Published &middot; Visible on homepage</div>
                )}
                {blog.status === "rejected" && (
                  <div style={{ fontSize: 12, color: "#dc3545", fontWeight: 600 }}>Rejected</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
