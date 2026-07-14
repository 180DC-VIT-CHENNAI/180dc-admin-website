import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import PillNav from "../components/PillNav";
import { apiUrl } from "../lib/api";
import { sanitizeHtml } from "../lib/sanitize";
import "./BlogView.css";

function rewriteContentUrls(html: string): string {
  const base = apiUrl("");
  return html.replace(/(src|href)\s*=\s*"(\/api\/)/g, '$1="' + base + '$2');
}

const navItems = [
  { label: "Home", href: "/" },
  { label: "Post a Blog", href: "/post-blog" },
];

export default function BlogView() {
  const { slug } = useParams<{ slug: string }>();
  const [blog, setBlog] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!slug) { setError("No blog slug provided"); setLoading(false); return; }
    async function load() {
      try {
        const res = await fetch(apiUrl(`/api/blogs/${encodeURIComponent(slug!)}`));
        const d = await res.json();
        if (d.success) setBlog(d.data);
        else setError(d.error || "Blog not found");
      } catch {
        setError("Failed to load blog post");
      }
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading) {
    return (
      <div className="blog-view-page">
        <PillNav items={navItems} activeHref="" logo="/images/official-logo.png" />
        <div className="blog-view-loading">Loading blog post...</div>
      </div>
    );
  }

  if (error || !blog) {
    return (
      <div className="blog-view-page">
        <PillNav items={navItems} activeHref="" logo="/images/official-logo.png" />
        <div className="blog-view-error">
          <h2>Blog Not Found</h2>
          <p>{error || "The blog post you're looking for doesn't exist or hasn't been published yet."}</p>
          <Link to="/" className="btn" style={{ marginTop: 16, display: "inline-block" }}>Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="blog-view-page">
      <PillNav items={navItems} activeHref="" logo="/images/official-logo.png" />
      <div className="blog-view-hero">
        <h1>{blog.title}</h1>
        <div className="blog-view-meta">
          By {blog.author_name}{blog.author_association ? ` (${blog.author_association})` : ""} &middot; {new Date(blog.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
        </div>
      </div>
      <div className="blog-view-content">
        {blog.image_url && (
          <div style={{ marginBottom: 24, borderRadius: 16, overflow: "hidden", border: "3px solid var(--text-primary)" }}>
            <img src={apiUrl(blog.image_url)} alt={blog.title} style={{ width: "100%", maxHeight: 400, objectFit: "cover", display: "block" }} />
          </div>
        )}
        <div className="blog-view-body" dangerouslySetInnerHTML={{ __html: rewriteContentUrls(sanitizeHtml(blog.content)) }} />
        <div style={{ textAlign: "center", marginTop: 40 }}>
          <Link to="/" className="btn outline">Back to Home</Link>
        </div>
      </div>
    </div>
  );
}
