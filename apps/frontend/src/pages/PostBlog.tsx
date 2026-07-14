import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import { 
  Type, User, Briefcase, AlignLeft, Image as ImageIcon,
  Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Quote, Link as LinkIcon, Type as TextIcon, CheckCircle
} from "lucide-react";
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

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -20, transition: { duration: 0.3 } }
};


export default function PostBlog() {
  const navigate = useNavigate();
  const editorRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
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
  const [contentLen, setContentLen] = useState(0);
  const [isEditorFocused, setIsEditorFocused] = useState(false);

  // 3D Tilt Effect
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-100, 100], [2, -2]);
  const rotateY = useTransform(x, [-100, 100], [-2, 2]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current || isEditorFocused) return;
    const rect = cardRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set(event.clientX - centerX);
    y.set(event.clientY - centerY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const updateContentLen = useCallback(() => {
    setContentLen(editorRef.current?.textContent?.length || 0);
  }, []);

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
    updateContentLen();
  }, [updateContentLen]);

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
    updateContentLen();
  }, [updateContentLen]);

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

  const isOverLimit = contentLen > 100000;
  const isReadyToSubmit = title.trim().length >= 3 && contentLen >= 10 && !isOverLimit;

  // Calculate progress bar color
  const progressRatio = Math.min(contentLen / 100000, 1);
  const progressColor = progressRatio > 0.9 ? "#ef4444" : progressRatio > 0.7 ? "#f59e0b" : "var(--primary-dark-green)";

  return (
    <div className={`post-blog-page ${isEditorFocused ? 'focus-mode-active' : ''}`}>
      <div className="dynamic-bg">
        <motion.div 
          className="bg-shape shape-1"
          animate={{ y: [0, -50, 0], x: [0, 30, 0], rotate: [0, 10, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />
        <motion.div 
          className="bg-shape shape-2"
          animate={{ y: [0, 40, 0], x: [0, -40, 0], rotate: [0, -15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
        />
      </div>

      <div className="content-layer">
        <PillNav items={navItems} activeHref="" logo="/images/official-logo.png" />
        
        <AnimatePresence mode="wait">
          {submitted ? (
            <motion.div key="submitted" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <div className="post-blog-hero">
                <h1>Blog <span>Submitted</span></h1>
                <p>Your post is pending review by the admin team.</p>
              </div>
              <div className="post-blog-form">
                <div className="post-blog-card success-message">
                  <CheckCircle size={64} className="success-icon" />
                  <h2>Thank You!</h2>
                  <p>Your blog post has been submitted for review. Once approved by a President or VP, it will appear on the homepage.</p>
                  <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 32 }}>
                    <button className="btn" onClick={() => navigate("/")}>Back to Home</button>
                    <button className="btn outline" onClick={() => { setSubmitted(false); setTitle(""); setExcerpt(""); setAuthorName(""); setAuthorAssociation(""); setImageUrl(""); setContentLen(0); if (editorRef.current) editorRef.current.innerHTML = ""; }}>Write Another</button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="form" variants={pageVariants} initial="initial" animate="animate" exit="exit">
              <div className="post-blog-hero">
                <motion.h1 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
                  Write a <span>Blog Post</span>
                </motion.h1>
                <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
                  Share your consulting insights with the 180DC community.
                </motion.p>
              </div>
              
              <div className="post-blog-form-container">
                <motion.div 
                  ref={cardRef}
                  className="post-blog-card interactive-card" 
                  variants={pageVariants}
                  initial="initial" animate="animate"
                  style={{ rotateX: isEditorFocused ? 0 : rotateX, rotateY: isEditorFocused ? 0 : rotateY }}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <div className="post-blog-field">
                    <label>Title *</label>
                    <div className="input-with-icon">
                      <Type size={18} />
                      <input
                        type="text"
                        placeholder="Enter a compelling title..."
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        maxLength={200}
                        autoFocus
                      />
                    </div>
                    <div className="slug-hint">Slug: {title ? title.toLowerCase().replace(/[^\w\s-]/g, "").replace(/[\s_]+/g, "-").slice(0, 100) || "post" : "post"}</div>
                  </div>

                  <div className="form-row">
                    <div className="post-blog-field">
                      <label>Written By</label>
                      <div className="input-with-icon">
                        <User size={18} />
                        <input
                          type="text"
                          placeholder="Your name (leave blank for Anonymous)"
                          value={authorName}
                          onChange={e => setAuthorName(e.target.value)}
                          maxLength={100}
                        />
                      </div>
                    </div>

                    <div className="post-blog-field">
                      <label>Association</label>
                      <div className="input-with-icon">
                        <Briefcase size={18} />
                        <input
                          type="text"
                          placeholder="e.g. 180DC Member, VIT Chennai"
                          value={authorAssociation}
                          onChange={e => setAuthorAssociation(e.target.value)}
                          maxLength={100}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="post-blog-field">
                    <label>Excerpt / Summary</label>
                    <div className="input-with-icon textarea-icon">
                      <AlignLeft size={18} style={{ marginTop: 14 }} />
                      <textarea
                        placeholder="A short summary of your blog post (optional, max 300 chars)"
                        value={excerpt}
                        onChange={e => setExcerpt(e.target.value)}
                        maxLength={300}
                      />
                    </div>
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
                          <ImageIcon size={18} />
                          {imageUploading ? (
                            <>
                              <span className="upload-spinner" />
                              Uploading...
                            </>
                          ) : (
                            "Choose Cover Image"
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

                  <div className="post-blog-field focus-editor-wrapper">
                    <label>Content *</label>
                    <div className={`editor-container ${isEditorFocused ? 'focused' : ''}`}>
                      <div className="editor-toolbar">
                        <button onClick={() => exec("bold")} title="Bold"><Bold size={16} /></button>
                        <button onClick={() => exec("italic")} title="Italic"><Italic size={16} /></button>
                        <button onClick={() => exec("underline")} title="Underline"><Underline size={16} /></button>
                        <div className="toolbar-divider" />
                        <button onClick={() => exec("formatBlock", "<h2>")} title="Heading 2"><Heading2 size={16} /></button>
                        <button onClick={() => exec("formatBlock", "<h3>")} title="Heading 3"><Heading3 size={16} /></button>
                        <button onClick={() => exec("formatBlock", "<p>")} title="Paragraph"><TextIcon size={16} /></button>
                        <div className="toolbar-divider" />
                        <button onClick={() => exec("insertUnorderedList")} title="Bullet List"><List size={16} /></button>
                        <button onClick={() => exec("insertOrderedList")} title="Numbered List"><ListOrdered size={16} /></button>
                        <div className="toolbar-divider" />
                        <button onClick={() => exec("formatBlock", "<blockquote>")} title="Quote"><Quote size={16} /></button>
                        <button onClick={() => {
                          const url = prompt("Enter link URL:");
                          if (url) exec("createLink", url);
                        }} title="Link"><LinkIcon size={16} /></button>
                      </div>
                      <div
                        ref={editorRef}
                        className="editor-content"
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Start writing your blog post here..."
                        style={{ fontFamily: "'Nunito', sans-serif" }}
                        onFocus={() => setIsEditorFocused(true)}
                        onBlur={() => setIsEditorFocused(false)}
                        onSelect={() => {
                          const sel = window.getSelection();
                          if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
                            savedRangeRef.current = sel.getRangeAt(0).cloneRange();
                          }
                        }}
                        onKeyUp={() => {
                          updateContentLen();
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
                          updateContentLen();
                        }}
                      />
                    </div>
                    
                    <div className="char-count-wrapper">
                      <div className="char-progress-bar">
                        <motion.div 
                          className="char-progress-fill" 
                          animate={{ width: `${progressRatio * 100}%`, backgroundColor: progressColor }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                      <div className={`char-count ${isOverLimit ? "over" : ""}`}>
                        {contentLen.toLocaleString()} / 100,000 chars
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }} 
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div className="error-banner">
                          {error}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="form-actions">
                    <button className="btn outline" onClick={() => navigate("/")}>Cancel</button>
                    <button className={`btn submit-btn ${isReadyToSubmit ? 'pulsing' : ''}`} onClick={handleSubmit} disabled={submitting || isOverLimit}>
                      {submitting ? "Submitting..." : "Submit for Review"}
                    </button>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
