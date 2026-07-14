import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import PillNav from "../components/PillNav";
import { apiUrl } from "../lib/api";
import "./PostBlog.css";

function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(parseInt(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function sanitizePaste(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*on\w+\s*=[^>]*>/gi, "")
    .replace(/(href|src|action)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, (m) => {
      const val = decodeEntities(m.replace(/^(href|src|action)\s*=\s*/, "").replace(/^["']|["']$/g, "").toLowerCase());
      if (val.startsWith("javascript:") || val.startsWith("data:") || val.startsWith("vbscript:")) return "";
      return m;
    });
}

const navItems = [
  { label: "Home", href: "/" },
  { label: "Recruitments", href: "/recruitments" },
];

export default function PostBlog() {
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorAssociation, setAuthorAssociation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

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
        insertAtCursor(`<p><br></p><img src="${data.url}" alt="blog image" style="max-width:100%;border-radius:8px;" /><p><br></p>`);
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

  const getContent = useCallback(() => {
    return editorRef.current?.innerHTML || "";
  }, []);

  const handleSubmit = useCallback(async () => {
    const content = getContent();
    const textContent = editorRef.current?.textContent || "";
    if (!title.trim()) { setError("Title is required"); return; }
    if (title.trim().length < 3) { setError("Title must be at least 3 characters"); return; }
    if (!textContent.trim() || textContent.trim().length < 10) { setError("Content must be at least 10 characters"); return; }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/blogs"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          content,
          excerpt: excerpt.trim() || textContent.trim().slice(0, 200),
          imageUrl: imageUrl || undefined,
          authorName: authorName.trim() || undefined,
          authorAssociation: authorAssociation.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
      } else {
        setError(data.error || "Failed to submit blog");
      }
    } catch {
      setError("Network error. Try again.");
    }
    setSubmitting(false);
  }, [title, excerpt, imageUrl, authorName, authorAssociation, getContent]);

  if (submitted) {
    return (
      <div className="post-blog-page">
        <PillNav items={navItems} activeHref="" logo="/images/official-logo.png" />
        <div className="post-blog-hero">
          <h1>Blog <span>Submitted</span></h1>
          <p>Your post is pending review by the admin team.</p>
        </div>
        <div className="post-blog-form">
          <div className="post-blog-card success-message">
            <h2>Thank You!</h2>
            <p>Your blog post has been submitted for review. Once approved by a President or VP, it will appear on the homepage.</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button className="btn" onClick={() => navigate("/")}>Back to Home</button>
              <button className="btn outline" onClick={() => { setSubmitted(false); setTitle(""); setExcerpt(""); setAuthorName(""); setAuthorAssociation(""); setImageUrl(""); if (editorRef.current) editorRef.current.innerHTML = ""; }}>Write Another</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const contentLen = editorRef.current?.textContent?.length || 0;
  const isOverLimit = contentLen > 100000;

  return (
    <div className="post-blog-page">
      <PillNav items={navItems} activeHref="" logo="/images/official-logo.png" />
      <div className="post-blog-hero">
        <h1>Write a <span>Blog Post</span></h1>
        <p>Share your consulting insights with the 180DC community.</p>
      </div>
      <div className="post-blog-form">
        <div className="post-blog-card">
          <div className="post-blog-field">
            <label>Title *</label>
            <input
              type="text"
              placeholder="Enter a compelling title..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={200}
              autoFocus
            />
            <div className="slug-hint">Slug: {title ? title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").slice(0, 100) || "post" : "post"}</div>
          </div>

          <div className="post-blog-field">
            <label>Written By</label>
            <input
              type="text"
              placeholder="Your name (leave blank for Anonymous)"
              value={authorName}
              onChange={e => setAuthorName(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="post-blog-field">
            <label>Association</label>
            <input
              type="text"
              placeholder="e.g. 180DC Member, VIT Chennai (optional)"
              value={authorAssociation}
              onChange={e => setAuthorAssociation(e.target.value)}
              maxLength={100}
            />
          </div>

          <div className="post-blog-field">
            <label>Excerpt / Summary</label>
            <textarea
              placeholder="A short summary of your blog post (optional, max 300 chars)"
              value={excerpt}
              onChange={e => setExcerpt(e.target.value)}
              maxLength={300}
            />
          </div>

          <div className="post-blog-field">
            <label>Featured Image</label>
            <div className="image-upload-area">
              {imageUrl ? (
                <div className="image-preview-container">
                  <img src={apiUrl(imageUrl)} alt="preview" className="image-preview" />
                  <button
                    type="button"
                    className="image-remove-btn"
                    onClick={() => setImageUrl("")}
                    title="Remove image"
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <label className="image-upload-btn">
                  {imageUploading ? (
                    <>
                      <span className="upload-spinner" />
                      Uploading...
                    </>
                  ) : (
                    "Choose Image"
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    disabled={imageUploading}
                  />
                </label>
              )}
            </div>
          </div>

          <div className="post-blog-field">
            <label>Content *</label>
            <div className="editor-toolbar">
              <button onClick={() => exec("bold")} title="Bold"><b>B</b></button>
              <button onClick={() => exec("italic")} title="Italic"><i>I</i></button>
              <button onClick={() => exec("underline")} title="Underline"><u>U</u></button>
              <button onClick={() => exec("formatBlock", "<h2>")} title="Heading">H2</button>
              <button onClick={() => exec("formatBlock", "<h3>")} title="Subheading">H3</button>
              <button onClick={() => exec("insertUnorderedList")} title="Bullet List">&#x2022; List</button>
              <button onClick={() => exec("insertOrderedList")} title="Numbered List">1. List</button>
              <button onClick={() => exec("formatBlock", "<blockquote>")} title="Quote">&ldquo; Quote</button>
              <button onClick={() => {
                const url = prompt("Enter link URL:");
                if (url) exec("createLink", url);
              }} title="Link">&#x1F517;</button>
              <button onClick={() => exec("formatBlock", "<p>")} title="Paragraph">&#xb6;</button>
            </div>
            <div
              ref={editorRef}
              className="editor-content"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Start writing your blog post here..."
              style={{ fontFamily: "'Nunito', sans-serif" }}
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
                  document.execCommand("insertHTML", false, sanitizePaste(html));
                } else {
                  const text = e.clipboardData.getData("text/plain");
                  document.execCommand("insertText", false, text);
                }
              }}
            />
            <div className={`char-count ${isOverLimit ? "over" : ""}`}>
              {contentLen.toLocaleString()} / 100,000 characters
            </div>
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: "#fef2f2", border: "2px solid #ef4444", borderRadius: 10, marginBottom: 16, color: "#dc2626", fontSize: 14, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <div className="form-actions">
            <button className="btn outline" onClick={() => navigate("/")}>Cancel</button>
            <button className="btn" onClick={handleSubmit} disabled={submitting || isOverLimit}>
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
