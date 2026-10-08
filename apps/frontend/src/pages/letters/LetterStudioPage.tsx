import { useState, useEffect, useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { apiUrl } from "../../lib/api";
import { useTheme } from "../../context/ThemeContext";
import {
  buildPagesHTML,
  collectLetterData,
  POSITION_OPTIONS,
  TEAM_OPTIONS,
  DOC_TYPES,
  REG_PATTERN,
} from "./letterhead";
import type { LetterData } from "./letterhead";
import { LETTERHEAD_CSS } from "./letterheadStyles";

type View = "login" | "otp" | "studio";

interface StudioMember {
  id: string;
  name: string;
  email: string;
  role_name: string;
  power_level: number;
  department_id: string | null;
  department_name: string | null;
}

const LOG_KEY = "180dc_letters_log_v1";

interface LogEntry {
  generatedAt: string;
  docnum: string;
  type: string;
  name: string;
  reg: string;
  team: string;
  position: string;
  letterDate: string;
}

function loadLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLog(arr: LogEntry[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(arr));
  } catch { /* ignore */ }
}

export default function LetterStudioPage() {
  const { isDark, toggle: toggleTheme } = useTheme();

  // ---- Auth state ----
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [sessionEmail, setSessionEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // ---- Studio state ----
  const [form, setForm] = useState<Record<string, string>>({});
  const [mouLogoData, setMouLogoData] = useState("");
  const [announcementFileName, setAnnouncementFileName] = useState("");
  const [pagesHtml, setPagesHtml] = useState("");
  const [previewZoom, setPreviewZoom] = useState(1);
  const [busy, setBusy] = useState<"" | "pdf" | "send">("");
  const [logCount, setLogCount] = useState(0);
  const [recentLetters, setRecentLetters] = useState<LogEntry[]>([]);

  // Recipient picker state
  const [members, setMembers] = useState<StudioMember[]>([]);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [pendingKey, setPendingKey] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedRecipient, setSelectedRecipient] = useState("");

  const liveRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const authHeaders: Record<string, string> = sessionToken
    ? { Authorization: `Bearer ${sessionToken}` }
    : {};

  // ---- Session restore ----
  useEffect(() => {
    const saved = localStorage.getItem("ls_session");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSessionToken(parsed.token);
        setSessionEmail(parsed.email);
        setView("studio");
      } catch {
        localStorage.removeItem("ls_session");
      }
    }
    setLogCount(loadLog().length);
  }, []);

  // ---- Load member directory once the letter session is available ----
  useEffect(() => {
    if (!sessionToken) return;
    fetch(apiUrl("/api/letter-studio/members"), { headers: authHeaders })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMembers(d.data || []);
      })
      .catch(() => { /* ignore */ });
  }, [sessionToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback(
    (id: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [id]: e.target.value }));
    },
    [],
  );

  // ---- Defaults on first studio mount ----
  useEffect(() => {
    if (view === "studio" && Object.keys(form).length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm({
        "f-type": "appointment",
        "f-date": today,
        "f-name": "",
        "f-reg": "",
        "f-position": "Junior Consultant",
        "f-position-from": "Junior Consultant",
        "f-position-to": "Consultant",
        "f-team": "Business Strategy",
        "f-team-from": "Business Strategy",
        "f-team-to": "Technical",
        "f-ffcs": "FFCS",
        "f-performance": "Satisfactory",
        "f-announcement-sender-position": "Chairperson",
        "f-announcement-tone": "neutral",
        "f-announcement-kind": "general",
        "f-announcement-event-mode": "In-person",
        "f-report-department": "Business Strategy",
        "f-satisfaction": "Neutral",
        "f-relieving-rating": "Good",
        "f-sc-type": "Incident",
        "f-ldi-department": "Business Strategy",
        "f-ldi-category": "New Initiative",
        "f-ldi-priority": "Medium",
        "f-ldi-decision": "Review and Discuss",
      });
    }
  }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const type = form["f-type"] || "appointment";

  const vis = useMemo(() => {
    return {
      memberDetails: !["announcement", "department-report", "ldi"].includes(type),
      departmentReport: type === "department-report",
      ldi: type === "ldi",
      announcement: type === "announcement",
      announcementEvent: type === "announcement" && (form["f-announcement-kind"] || "general") === "event",
      positionSingle: !["promotion", "transfer"].includes(type),
      positionPromo: type === "promotion",
      teamTransfer: type === "transfer",
      teamSingle: type !== "transfer",
      terminationReason: type === "termination",
      resignation: type === "resignation",
      showcause: type === "showcause",
      service: type === "service",
      relieving: type === "relieving",
      recognition: type === "recognition",
      mou: type === "mou",
      performance: ["promotion", "termination"].includes(type),
    };
  }, [type, form]);

  // ---- Preview render ----
  const currentData = useMemo<LetterData>(() => collectLetterData(form, mouLogoData, announcementFileName), [form, mouLogoData, announcementFileName]);

  function fitPages(stack: HTMLDivElement | null) {
    if (!stack) return;
    if (["ldi", "department-report", "mou"].includes(type)) return;
    stack.querySelectorAll<HTMLElement>(".page").forEach((page) => {
      const content = page.querySelector<HTMLElement>(".pagecontent");
      if (!content) return;
      content.style.transform = "none";
      content.style.width = "100%";
      const available = Math.max(0, page.clientHeight - 2);
      const needed = content.scrollHeight;
      if (needed > available) {
        const scale = Math.max(0.92, available / needed);
        content.style.transformOrigin = "top left";
        content.style.transform = `scale(${scale})`;
        content.style.width = `${100 / scale}%`;
      }
    });
  }

  useLayoutEffect(() => {
    const html = buildPagesHTML(currentData);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPagesHtml(html);
  }, [currentData]);

  useLayoutEffect(() => {
    if (!pagesHtml) return;
    requestAnimationFrame(() => {
      fitPages(liveRef.current);
      fitPages(printRef.current);
    });
  }, [pagesHtml]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- File inputs ----
  const handleMouLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setMouLogoData("");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file for the other party logo.");
      e.target.value = "";
      setMouLogoData("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setMouLogoData(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const handleAnnouncementFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setAnnouncementFileName("");
      return;
    }
    setAnnouncementFileName(file.name);
  };

  // ---- OTP flow ----
  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(apiUrl("/api/letter-studio/otp/send"), {
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
    setSuccess("");
    try {
      const res = await fetch(apiUrl("/api/letter-studio/otp/verify"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otp }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionToken(data.token);
        setSessionEmail(data.email);
        localStorage.setItem("ls_session", JSON.stringify({ token: data.token, email: data.email }));
        setView("studio");
        setOtp("");
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
      await fetch(apiUrl("/api/letter-studio/logout"), {
        method: "POST",
        headers: authHeaders,
      });
    } catch { /* ignore */ }
    localStorage.removeItem("ls_session");
    setSessionToken("");
    setSessionEmail("");
    setView("login");
    setEmail("");
    setOtp("");
  };

  // ---- Validation ----
  function validate(): boolean {
    if (type === "announcement") {
      if (!(form["f-announcement-sender"] || "").trim() || !(form["f-announcement-message"] || "").trim()) {
        alert("Please complete the announcement sender and message fields.");
        return false;
      }
      if (vis.announcementEvent && (!(form["f-announcement-event-date"] || "").trim() || !(form["f-announcement-event-time"] || "").trim() || !(form["f-announcement-event-venue"] || "").trim())) {
        alert("Please complete the event date, time, and venue.");
        return false;
      }
      return true;
    }
    if (type === "ldi") {
      const required = ["f-ldi-submitter", "f-ldi-title", "f-ldi-summary", "f-ldi-problem", "f-ldi-outcome"];
      const missing = required.find((id) => !(form[id] || "").trim());
      if (missing) {
        alert("Please complete the LDI submitter, title, overview, problem / opportunity, and expected outcome fields.");
        return false;
      }
      return true;
    }
    if (type === "department-report") {
      if (!(form["f-report-director"] || "").trim()) {
        alert("Please enter the department director name.");
        return false;
      }
      return true;
    }
    if (!(form["f-name"] || "").trim()) {
      alert("Enter the member name.");
      return false;
    }
    if (type !== "appointment") {
      const reg = (form["f-reg"] || "").trim().toUpperCase();
      if (!REG_PATTERN.test(reg)) {
        alert("Registration number format must be 2 digits + B/M + 2 letters + 4 digits, with the 4-digit block starting 1-9. Example: 25BCE1234.");
        return false;
      }
    }
    if (type === "showcause" && !(form["f-sc-incident"] || "").trim()) {
      alert("Please enter the incident / absence details.");
      return false;
    }
    if (type === "service" && (!(form["f-service-projects"] || "").trim() || !(form["f-service-positions"] || "").trim() || !(form["f-service-outcome"] || "").trim())) {
      alert("Please complete the service certificate details.");
      return false;
    }
    if (type === "mou") {
      const required = ["f-mou-party", "f-mou-purpose", "f-mou-scope", "f-mou-resp-ours", "f-mou-resp-other", "f-mou-docs", "f-mou-term", "f-mou-confidentiality", "f-mou-termination"];
      if (required.some((id) => !(form[id] || "").trim())) {
        alert("For an MOU, complete the party, purpose, scope, responsibilities, documents/deliverables, term, confidentiality, and termination fields.");
        return false;
      }
    }
    if (type === "recognition" && (!(form["f-rec-task"] || "").trim() || !(form["f-rec-outcome"] || "").trim())) {
      alert("Please complete the recognition details.");
      return false;
    }
    if (type === "termination" && !(form["f-reason"] || "").trim()) {
      alert("Enter a reason for termination.");
      return false;
    }
    if (type === "resignation" && !(form["f-resignation-reason"] || "").trim()) {
      alert("Enter a reason for leaving.");
      return false;
    }
    if (type === "transfer" && (form["f-team-from"] || "") === (form["f-team-to"] || "")) {
      alert("Choose a different destination department.");
      return false;
    }
    return true;
  }

  function logLetter(d: LetterData) {
    const arr = loadLog();
    arr.unshift({
      generatedAt: new Date().toISOString(),
      docnum: d.docnum,
      type: d.type,
      name: d.name,
      reg: d.reg,
      team: d.team,
      position: d.position,
      letterDate: d.dateStr,
    });
    saveLog(arr.slice(0, 50));
    setLogCount(arr.length);
    setRecentLetters(arr.slice(0, 8));
  }

  // ---- PDF generation ----
  async function generatePdfBlob(): Promise<Blob> {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
    const stack = liveRef.current;
    if (!stack) throw new Error("Preview not ready");
    const prevTransform = stack.style.transform;
    stack.style.transform = "none";
    try {
      const pages = Array.from(stack.querySelectorAll<HTMLElement>(":scope > .page"));
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          logging: false,
        });
        const img = canvas.toDataURL("image/jpeg", 0.95);
        if (i > 0) pdf.addPage();
        pdf.addImage(img, "JPEG", 0, 0, 210, 297);
      }
      return pdf.output("blob");
    } finally {
      stack.style.transform = prevTransform;
    }
  }

  // ---- Upload generated PDF to R2 ----
  async function uploadPdf(blob: Blob): Promise<string> {
    const fd = new FormData();
    fd.append("file", blob, `${currentData.docnum}.pdf`);
    fd.append("docnum", currentData.docnum);
    const upRes = await fetch(apiUrl("/api/letter-studio/upload"), {
      method: "POST",
      headers: authHeaders,
      body: fd,
    });
    const upData = await upRes.json();
    if (!upData.success) throw new Error(upData.error || "Upload failed");
    return upData.key;
  }

  // Generate (and optionally download) the PDF, then open the recipient picker
  async function prepareLetterAndOpenModal(download: boolean) {
    if (!validate()) return;
    setBusy(download ? "pdf" : "send");
    setError("");
    setSuccess("");
    try {
      const blob = await generatePdfBlob();
      if (download) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${currentData.docnum}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      const key = await uploadPdf(blob);
      logLetter(currentData);
      setPendingKey(key);
      setSelectedRecipient("");
      setDeptFilter(currentData.team || "");
      setMemberSearch("");
      setSendModalOpen(true);
    } catch (err) {
      setError("PDF generation failed: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setBusy("");
  }

  const handleDownloadPdf = () => prepareLetterAndOpenModal(true);

  const handleSendEmail = () => prepareLetterAndOpenModal(false);

  const handleSendFromModal = async () => {
    const to = (selectedRecipient || "").trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      setError("Select a member or enter a valid recipient email.");
      return;
    }
    setBusy("send");
    setError("");
    try {
      let key = pendingKey;
      if (!key) {
        const blob = await generatePdfBlob();
        key = await uploadPdf(blob);
        setPendingKey(key);
        logLetter(currentData);
      }
      const sendRes = await fetch(apiUrl("/api/letter-studio/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          fileKey: key,
          recipientEmail: to,
          docType: currentData.type,
          name: currentData.name,
          position: currentData.position,
          team: currentData.team,
          docnum: currentData.docnum,
          dateStr: currentData.dateStr,
        }),
      });
      const sendData = await sendRes.json();
      if (sendData.success) {
        setSendModalOpen(false);
        setSuccess(`Letter sent to ${to}! A standard ${DOC_TYPES.find((t) => t.value === currentData.type)?.label.toLowerCase() || "letter"} mail with the PDF attached was delivered.`);
        setSelectedRecipient("");
      } else {
        setError(sendData.error || "Failed to send email");
      }
    } catch (err) {
      setError("Failed to send: " + (err instanceof Error ? err.message : "Unknown error"));
    }
    setBusy("");
  };

  const handlePrint = () => {
    if (!validate()) return;
    logLetter(currentData);
    window.print();
  };

  const handleReset = () => {
    setForm({});
    setMouLogoData("");
    setAnnouncementFileName("");
    setSelectedRecipient("");
    setSendModalOpen(false);
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
        <StudioTopBar isDark={isDark} toggleTheme={toggleTheme} />

        <div style={{ maxWidth: 420, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <img src="/images/official-logo.png" alt="180 Degrees Consulting" style={{ width: 56, height: 56, objectFit: "contain", margin: "0 auto 0.875rem", display: "block" }} />
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>180DC Letter Studio</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 15, marginTop: 8 }}>Create official letters, certificates, MOUs and reports on the official letterhead.</p>
          </div>

          <div style={{ background: cardBg, padding: "2rem", borderRadius: 24, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-lg)" }}>
            {error && <p style={{ color: "var(--status-error)", fontSize: 13, margin: "0 0 12px", textAlign: "center" }}>{error}</p>}
            {success && <p style={{ color: "var(--status-success)", fontSize: 13, margin: "0 0 12px", textAlign: "center" }}>{success}</p>}

            <input
              type="email"
              placeholder="Authorized email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
              style={{ width: "100%", padding: "0.875rem 1rem", borderRadius: 12, border: "1px solid var(--border-light)", background: "var(--bg-primary)", color: "var(--text-primary)", fontSize: 15, marginBottom: 12, boxSizing: "border-box" }}
            />
            <button
              onClick={handleSendOtp}
              disabled={loading || !email.trim()}
              style={{ ...btnBase, width: "100%", padding: "0.875rem", background: loading || !email.trim() ? "var(--text-tertiary)" : "var(--accent)", color: "#fff" }}
            >
              {loading ? "Sending..." : "Send OTP"}
            </button>
          </div>

          <p style={{ textAlign: "center", marginTop: "2rem", color: "var(--text-tertiary)", fontSize: 13 }}>
            Only emails authorized from the Members Portal can log in.
          </p>
        </div>
      </div>
    );
  }

  // ── OTP View ──
  if (view === "otp") {
    return (
      <div style={{ background: "var(--bg-primary)", minHeight: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
        <StudioTopBar isDark={isDark} toggleTheme={toggleTheme} />

        <div style={{ maxWidth: 420, width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
            <img src="/images/official-logo.png" alt="180 Degrees Consulting" style={{ width: 56, height: 56, objectFit: "contain", margin: "0 auto 0.875rem", display: "block" }} />
            <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Enter OTP</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: 15, marginTop: 8 }}>Sent to {email}</p>
          </div>

          <div style={{ background: cardBg, padding: "2rem", borderRadius: 24, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-lg)" }}>
            {error && <p style={{ color: "var(--status-error)", fontSize: 13, margin: "0 0 12px", textAlign: "center" }}>{error}</p>}

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
              onClick={() => { setView("login"); setOtp(""); setError(""); setSuccess(""); }}
              style={{ ...btnBase, width: "100%", padding: "0.75rem", background: "transparent", color: "var(--text-secondary)", marginTop: 8 }}
            >
              Back to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Studio View ──
  return (
    <div style={{ background: "var(--bg-primary)", minHeight: "100vh", width: "100%" }}>
      <StudioTopBar isDark={isDark} toggleTheme={toggleTheme} sessionEmail={sessionEmail} onLogout={handleLogout} />

      <style dangerouslySetInnerHTML={{ __html: LETTERHEAD_CSS }} />
      <style>{`
        html,body{background:var(--bg-primary)!important;background-image:none!important;font-family:var(--font-sans, -apple-system, "Segoe UI", Helvetica, Arial, sans-serif)!important}
        .studio-appbar{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 20px;border-radius:16px;background:var(--bg-card);color:var(--text-primary);box-shadow:var(--shadow-md);border:1px solid var(--border-light)}
        .studio-appbar-title{display:flex;align-items:center;gap:12px;min-width:0}
        .studio-appbar-title .material-symbols-outlined{font-size:26px;color:var(--accent)}
        .studio-appbar-title strong{display:block;font-size:15px;line-height:1.2}
        .studio-appbar-title span{display:block;margin-top:2px;font-size:11px;color:var(--text-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .studio-appbar-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .studio-appbar-actions button .material-symbols-outlined{font-size:15px}
        .studio-recipient-bar{display:flex;align-items:center;gap:12px;margin:14px 0 0;padding:12px 16px;border:1px solid var(--border-light);border-radius:14px;background:var(--bg-card);box-shadow:var(--shadow-sm)}
        .studio-recipient-bar .material-symbols-outlined{color:var(--accent);font-size:20px}
        .studio-recipient-bar .bar-strong{font-size:13.5px;font-weight:700;color:var(--text-primary)}
        .studio-recipient-bar .bar-sub{font-size:12px;color:var(--text-tertiary)}
        .studio-recipient-bar button{flex:0 0 auto;padding:8px 16px;font-size:12.5px;font-weight:700;border-radius:10px;border:none;background:var(--accent);color:#fff;cursor:pointer}
        .studio-recipient-bar button:hover{opacity:.9}
        .ldi-wrap-section{display:grid;gap:4px}
        .ldi-wrap-section .ldi-section{border:1px solid var(--border-light);border-radius:12px;padding:14px 16px;margin:14px 0 0;background:var(--bg-card)}
        .ldi-wrap-section label{display:block;font-size:12px;color:var(--text-secondary);margin:12px 0 4px}
        .ldi-wrap-section input,.ldi-wrap-section select,.ldi-wrap-section textarea{width:100%;padding:8px 10px;font-size:14px;border:1px solid var(--border-light);border-radius:6px;background:var(--bg-primary);color:var(--text-primary)}
        .ls-panel-theme .panel{background:var(--bg-card);border-color:var(--border-light);box-shadow:var(--shadow-md)}
        .ls-panel-theme .panel h2{color:var(--text-primary)}
        .ls-panel-theme label{color:var(--text-secondary)}
        .ls-panel-theme input,.ls-panel-theme select,.ls-panel-theme textarea{border-color:var(--border-light);background:var(--bg-primary);color:var(--text-primary)}
        .ls-panel-theme .preview-toolbar{background:var(--bg-card);border-color:var(--border-light);color:var(--text-primary)}
        .ls-panel-theme .preview-title{color:var(--text-primary)}
        .ls-panel-theme .preview-meta{color:var(--text-tertiary)}
        .ls-panel-theme .pageHolder{background:transparent;padding:0}
        .ls-panel-theme .logcount{color:var(--text-tertiary)}
        .ls-panel-theme .section-note{border-left-color:var(--accent);background:rgba(141,198,63,.08);color:var(--text-secondary)}
        .ls-panel-theme .status-pill{background:rgba(141,198,63,.12);color:var(--accent)}
        .ls-panel-theme .eyebrow{color:var(--text-tertiary)}
        @media (max-width:860px){.studio-appbar{flex-direction:column;align-items:stretch}.studio-appbar-actions{justify-content:flex-end}}
        @media print{body{background:#fff!important;background-image:none!important}.studio-appbar,.studio-recipient-bar,.preview-toolbar{display:none!important}}
      `}</style>

      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "76px 16px 48px" }}>
        {success && (
          <div style={{ background: cardBg, padding: "1rem 1.25rem", borderRadius: 12, border: "1px solid var(--border-light)", marginBottom: 16, borderLeft: "4px solid var(--status-success)" }}>
            <p style={{ margin: 0, color: "var(--status-success)", fontSize: 14 }}>{success}</p>
          </div>
        )}
        {error && (
          <div style={{ background: cardBg, padding: "1rem 1.25rem", borderRadius: 12, border: "1px solid var(--border-light)", marginBottom: 16, borderLeft: "4px solid var(--status-error)" }}>
            <p style={{ margin: 0, color: "var(--status-error)", fontSize: 14 }}>{error}</p>
          </div>
        )}

        <div className="studio-appbar">
          <div className="studio-appbar-title">
            <span className="material-symbols-outlined">description</span>
            <div>
              <strong>180DC VITC Letterhead</strong>
              <span>Official letter generator · {currentData.docnum}</span>
            </div>
          </div>
          <div className="studio-appbar-actions">
            <button onClick={handleReset} style={{ ...btnBase, padding: "7px 14px", fontSize: 12, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>refresh</span> Reset
            </button>
            <button onClick={handlePrint} style={{ ...btnBase, padding: "7px 14px", fontSize: 12, background: "transparent", color: "var(--text-secondary)", border: "1px solid var(--border-light)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>print</span> Print
            </button>
            <button onClick={handleDownloadPdf} disabled={busy === "pdf"} style={{ ...btnBase, padding: "8px 16px", fontSize: 12.5, background: "var(--accent)", color: "#fff", fontWeight: 800, opacity: busy === "pdf" ? 0.6 : 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>download</span> {busy === "pdf" ? "Generating PDF..." : "Download PDF"}
            </button>
            <button onClick={handleSendEmail} disabled={busy === "send"} style={{ ...btnBase, padding: "8px 16px", fontSize: 12.5, background: "var(--accent)", color: "#fff", fontWeight: 800, opacity: busy === "send" ? 0.6 : 1 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>send</span> {busy === "send" ? "Preparing..." : "Send Email"}
            </button>
          </div>
        </div>

        <div className="studio-recipient-bar">
          <span className="material-symbols-outlined">alternate_email</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bar-strong">{selectedRecipient ? `Recipient: ${selectedRecipient}` : "Pick the recipient when you send"}</div>
            <div className="bar-sub">
              After generating the letter, choose the member from the {members.length > 0 ? `${members.length}-member` : "member"} directory — search, filter by department{currentData.team ? ` (pre-filtered to ${currentData.team})` : ""}, and send.
            </div>
          </div>
          <button onClick={() => { setSendModalOpen(true); setSelectedRecipient(""); setDeptFilter(currentData.team || ""); setMemberSearch(""); }} disabled={busy === "send"}>
            <span className="material-symbols-outlined" style={{ fontSize: 15 }}>person_search</span> Choose Recipient
          </button>
        </div>

        <div className="wrap ls-panel-theme" style={{ paddingTop: 18 }}>
          <div className="panel">
            <div className="studio-kicker">
              <span className="eyebrow">Document builder</span>
              <span className="status-pill"><span className="status-dot" style={{ background: "var(--primary-green)" }}></span>{DOC_TYPES.find((t) => t.value === type)?.label || "Document"}</span>
            </div>
            <h2>Letter details</h2>

            <label htmlFor="f-type">Document type</label>
            <select id="f-type" value={type} onChange={set("f-type")}>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>

            <label htmlFor="f-date">Date</label>
            <input type="date" id="f-date" value={form["f-date"] || ""} onChange={set("f-date")} />

            {vis.announcement && (
              <>
                <div className="section-note">Announcement mode keeps the letter focused. Choose a tone; event details appear only for event announcements.</div>
                <label htmlFor="f-announcement-sender">Sender</label>
                <input type="text" id="f-announcement-sender" placeholder="Sender name" value={form["f-announcement-sender"] || ""} onChange={set("f-announcement-sender")} />
                <label htmlFor="f-announcement-sender-position">Sender position</label>
                <select id="f-announcement-sender-position" value={form["f-announcement-sender-position"] || "Chairperson"} onChange={set("f-announcement-sender-position")}>
                  {["Chairperson", "Vice Chairperson", "Gen Sec", "Co Sec", "Faculty Coordinator", "Advisory", "Director", "Board Member", "Lead", "Senior Consultant", "Consultant", "Junior Consultant"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <label htmlFor="f-announcement-tone">Tone</label>
                <select id="f-announcement-tone" value={form["f-announcement-tone"] || "neutral"} onChange={set("f-announcement-tone")}>
                  <option value="sad">Sad</option>
                  <option value="neutral">Neutral</option>
                  <option value="happy">Happy</option>
                </select>
                <label htmlFor="f-announcement-kind">Announcement type</label>
                <select id="f-announcement-kind" value={form["f-announcement-kind"] || "general"} onChange={set("f-announcement-kind")}>
                  <option value="general">General Announcement</option>
                  <option value="event">Event Announcement</option>
                </select>
                <label htmlFor="f-announcement-message">Message</label>
                <textarea id="f-announcement-message" rows={6} placeholder="Write the announcement message" value={form["f-announcement-message"] || ""} onChange={set("f-announcement-message")} />
                <label htmlFor="f-announcement-file">File / Attachment (optional)</label>
                <input type="file" id="f-announcement-file" onChange={handleAnnouncementFile} />
                <div className="logcount">{announcementFileName || "No file selected."}</div>
                {vis.announcementEvent && (
                  <>
                    <label htmlFor="f-announcement-event-date">Event date</label>
                    <input type="date" id="f-announcement-event-date" value={form["f-announcement-event-date"] || ""} onChange={set("f-announcement-event-date")} />
                    <label htmlFor="f-announcement-event-time">Event time</label>
                    <input type="time" id="f-announcement-event-time" value={form["f-announcement-event-time"] || ""} onChange={set("f-announcement-event-time")} />
                    <label htmlFor="f-announcement-event-venue">Venue</label>
                    <input type="text" id="f-announcement-event-venue" placeholder="Venue / meeting room / platform" value={form["f-announcement-event-venue"] || ""} onChange={set("f-announcement-event-venue")} />
                    <label htmlFor="f-announcement-event-mode">Mode</label>
                    <select id="f-announcement-event-mode" value={form["f-announcement-event-mode"] || "In-person"} onChange={set("f-announcement-event-mode")}>
                      <option>In-person</option>
                      <option>Online</option>
                      <option>Hybrid</option>
                    </select>
                    <label htmlFor="f-announcement-event-action">RSVP / Action (optional)</label>
                    <input type="text" id="f-announcement-event-action" placeholder="e.g. Register by 10 October / Bring your ID card" value={form["f-announcement-event-action"] || ""} onChange={set("f-announcement-event-action")} />
                    <label htmlFor="f-announcement-event-notes">Additional event notes (optional)</label>
                    <textarea id="f-announcement-event-notes" rows={2} placeholder="Dress code, contact person, link, or other useful details" value={form["f-announcement-event-notes"] || ""} onChange={set("f-announcement-event-notes")} />
                  </>
                )}
              </>
            )}

            {vis.departmentReport && (
              <>
                <div className="section-note">Department reports can span multiple A4 pages. For bullet-point sections, enter one point per line.</div>
                <label htmlFor="f-report-time">Time</label>
                <input type="time" id="f-report-time" value={form["f-report-time"] || ""} onChange={set("f-report-time")} />
                <label htmlFor="f-report-director">Director Name</label>
                <input type="text" id="f-report-director" placeholder="Name of the department director" value={form["f-report-director"] || ""} onChange={set("f-report-director")} />
                <label htmlFor="f-report-department">Department Name</label>
                <select id="f-report-department" value={form["f-report-department"] || "Business Strategy"} onChange={set("f-report-department")}>
                  {TEAM_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                </select>
                <ReportTextarea id="f-report-overview" label="Overview" placeholder="Summarise the current state of the department. Enter one point per line." form={form} set={set} />
                <ReportTextarea id="f-report-tasks" label="Tasks at Hand" placeholder="What tasks are currently at hand? One point per line." form={form} set={set} />
                <ReportTextarea id="f-report-updates" label="Update on Tasks" placeholder="What progress or updates have been made? One point per line." form={form} set={set} />
                <ReportTextarea id="f-report-hold" label="What is on hold, if anything, and why?" placeholder="List items on hold and the reason for each. One point per line." form={form} set={set} rows={3} />
                <ReportTextarea id="f-report-struggles" label="Struggles" placeholder="What challenges or blockers is the department facing? One point per line." form={form} set={set} rows={3} />
                <ReportTextarea id="f-report-strengths" label="Strengths" placeholder="What is the department doing well? One point per line." form={form} set={set} rows={3} />
                <ReportTextarea id="f-report-other" label="Other Things to Mention" placeholder="Anything else the director wants recorded. One point per line." form={form} set={set} rows={3} />
                <ReportTextarea id="f-report-vision" label="Vision" placeholder="What is the department's direction or vision? One point per line." form={form} set={set} rows={3} />
                <ReportTextarea id="f-report-responsibility" label="Responsibility" placeholder="What are the department's key responsibilities? One point per line." form={form} set={set} rows={3} />
                <label htmlFor="f-report-strength">Department Strength</label>
                <input type="number" id="f-report-strength" min={0} placeholder="Number of people in the department" value={form["f-report-strength"] || ""} onChange={set("f-report-strength")} />
                <label htmlFor="f-report-subteams">Subteams and Members (optional)</label>
                <div className="logcount">Use one line per person: <strong>Subteam | Name | Active</strong> or <strong>Subteam | Name | Inactive</strong>.</div>
                <textarea id="f-report-subteams" rows={5} placeholder={"Strategy | Aditi | Active\nResearch | Rahul | Inactive"} value={form["f-report-subteams"] || ""} onChange={set("f-report-subteams")} />
                <label htmlFor="f-report-senior">Senior Consultants</label>
                <div className="logcount">Use one line per person: <strong>Name | Activity Level</strong>. Example: Rahul | High</div>
                <textarea id="f-report-senior" rows={4} placeholder={"Name | High\nName | Medium\nName | Low"} value={form["f-report-senior"] || ""} onChange={set("f-report-senior")} />
                {(form["f-report-department"] || "") === "Technical" && (
                  <>
                    <div className="section-note">Technical department: optionally record the senior consultant leading each track. They appear in the report as a "Technical Track Senior Consultants" table.</div>
                    <label htmlFor="f-report-tech-aiml">Senior Consultant — AI/ML</label>
                    <input type="text" id="f-report-tech-aiml" placeholder="Name of the AI/ML track senior consultant" value={form["f-report-tech-aiml"] || ""} onChange={set("f-report-tech-aiml")} />
                    <label htmlFor="f-report-tech-product">Senior Consultant — Product</label>
                    <input type="text" id="f-report-tech-product" placeholder="Name of the Product track senior consultant" value={form["f-report-tech-product"] || ""} onChange={set("f-report-tech-product")} />
                    <label htmlFor="f-report-tech-devops">Senior Consultant — DevOps</label>
                    <input type="text" id="f-report-tech-devops" placeholder="Name of the DevOps track senior consultant" value={form["f-report-tech-devops"] || ""} onChange={set("f-report-tech-devops")} />
                  </>
                )}
                <label htmlFor="f-report-promising">Promising People in the Department</label>
                <textarea id="f-report-promising" rows={4} placeholder="Enter one name per line." value={form["f-report-promising"] || ""} onChange={set("f-report-promising")} />
              </>
            )}

            {vis.memberDetails && (
              <>
                <label htmlFor="f-name">Name</label>
                <input type="text" id="f-name" placeholder="Full name" value={form["f-name"] || ""} onChange={set("f-name")} />

                {type !== "appointment" && (
                  <>
                    <label htmlFor="f-reg">Registration number</label>
                    <input
                      type="text"
                      id="f-reg"
                      placeholder="e.g. 25BCE1234"
                      maxLength={9}
                      value={form["f-reg"] || ""}
                      onChange={(e) => set("f-reg")({ ...e, target: { ...e.target, value: e.target.value.toUpperCase().replace(/\s+/g, "").slice(0, 9) } })}
                      style={form["f-reg"] && !REG_PATTERN.test((form["f-reg"] || "").toUpperCase()) ? { borderColor: "var(--status-error)" } : undefined}
                    />
                    {form["f-reg"] && !REG_PATTERN.test((form["f-reg"] || "").toUpperCase()) && (
                      <div className="err" style={{ display: "block", color: "var(--status-error)" }}>
                        Use 2 digits + B/M + 2 letters + 4 digits; the 4-digit block cannot start with 0. Example: 25BCE1234.
                      </div>
                    )}
                  </>
                )}

                {vis.positionSingle && (
                  <>
                    <label htmlFor="f-position">Position</label>
                    <select id="f-position" value={form["f-position"] || "Junior Consultant"} onChange={set("f-position")}>
                      {["Junior Consultant", "Consultant", "Senior Consultant", "Lead", "Director", "Board Member"].map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </>
                )}

                {vis.positionPromo && (
                  <>
                    <label htmlFor="f-position-from">Position From</label>
                    <select id="f-position-from" value={form["f-position-from"] || "Junior Consultant"} onChange={set("f-position-from")}>
                      {POSITION_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <label htmlFor="f-position-to">Position To</label>
                    <select id="f-position-to" value={form["f-position-to"] || "Consultant"} onChange={set("f-position-to")}>
                      {POSITION_OPTIONS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </>
                )}

                {vis.teamTransfer && (
                  <>
                    <label htmlFor="f-team-from">Department From</label>
                    <select id="f-team-from" value={form["f-team-from"] || "Business Strategy"} onChange={set("f-team-from")}>
                      {TEAM_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    <label htmlFor="f-team-to">Department To</label>
                    <select id="f-team-to" value={form["f-team-to"] || "Technical"} onChange={set("f-team-to")}>
                      {TEAM_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </>
                )}

                {vis.terminationReason && (
                  <>
                    <label htmlFor="f-reason">Reason for termination</label>
                    <input type="text" id="f-reason" placeholder="Enter a brief reason" value={form["f-reason"] || ""} onChange={set("f-reason")} />
                  </>
                )}

                {vis.resignation && (
                  <>
                    <label htmlFor="f-resignation-reason">Reason for leaving</label>
                    <textarea id="f-resignation-reason" rows={2} placeholder="Enter the reason for leaving" value={form["f-resignation-reason"] || ""} onChange={set("f-resignation-reason")} />
                    <label htmlFor="f-satisfaction">Work satisfaction</label>
                    <select id="f-satisfaction" value={form["f-satisfaction"] || "Neutral"} onChange={set("f-satisfaction")}>
                      {["Very Dissatisfied", "Dissatisfied", "Neutral", "Satisfied", "Very Satisfied"].map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <label htmlFor="f-successor">Recommendation for successor (if any)</label>
                    <textarea id="f-successor" rows={2} placeholder="Enter a name or recommendation, or leave blank if not applicable" value={form["f-successor"] || ""} onChange={set("f-successor")} />
                    <label htmlFor="f-resignation-feedback">Additional remarks (optional)</label>
                    <textarea id="f-resignation-feedback" rows={2} placeholder="Any additional feedback or remarks" value={form["f-resignation-feedback"] || ""} onChange={set("f-resignation-feedback")} />
                  </>
                )}

                {vis.showcause && (
                  <>
                    <label htmlFor="f-sc-type">Issue type</label>
                    <select id="f-sc-type" value={form["f-sc-type"] || "Incident"} onChange={set("f-sc-type")}>
                      <option>Incident</option>
                      <option>Absence</option>
                    </select>
                    <label htmlFor="f-sc-incident">Incident / absence details</label>
                    <textarea id="f-sc-incident" rows={2} placeholder="Describe the incident or absence" value={form["f-sc-incident"] || ""} onChange={set("f-sc-incident")} />
                    <label htmlFor="f-sc-date">Incident date</label>
                    <input type="date" id="f-sc-date" value={form["f-sc-date"] || ""} onChange={set("f-sc-date")} />
                    <label htmlFor="f-sc-time">Incident time</label>
                    <input type="time" id="f-sc-time" value={form["f-sc-time"] || ""} onChange={set("f-sc-time")} />
                    <label htmlFor="f-sc-remark">Remarks</label>
                    <textarea id="f-sc-remark" rows={2} placeholder="Enter relevant remarks" value={form["f-sc-remark"] || ""} onChange={set("f-sc-remark")} />
                  </>
                )}

                {vis.service && (
                  <>
                    <label htmlFor="f-service-projects">Worked on</label>
                    <input type="text" id="f-service-projects" placeholder="e.g. 5 projects" value={form["f-service-projects"] || ""} onChange={set("f-service-projects")} />
                    <label htmlFor="f-service-positions">Position(s)</label>
                    <input type="text" id="f-service-positions" placeholder="e.g. Consultant, Project Lead" value={form["f-service-positions"] || ""} onChange={set("f-service-positions")} />
                    <label htmlFor="f-service-outcome">Outcome</label>
                    <textarea id="f-service-outcome" rows={2} placeholder="Summarise the outcomes" value={form["f-service-outcome"] || ""} onChange={set("f-service-outcome")} />
                  </>
                )}

                {vis.relieving && (
                  <>
                    <label htmlFor="f-relieving-rating">Work assessment</label>
                    <select id="f-relieving-rating" value={form["f-relieving-rating"] || "Good"} onChange={set("f-relieving-rating")}>
                      {["Neutral", "Satisfactory", "Good", "Very Good", "Excellent"].map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <label htmlFor="f-relieving-comment">Comment</label>
                    <textarea id="f-relieving-comment" rows={2} placeholder="Comment on the member's work" value={form["f-relieving-comment"] || ""} onChange={set("f-relieving-comment")} />
                  </>
                )}

                {vis.recognition && (
                  <>
                    <label htmlFor="f-rec-task">Task / contribution</label>
                    <textarea id="f-rec-task" rows={2} placeholder="Describe the task or contribution" value={form["f-rec-task"] || ""} onChange={set("f-rec-task")} />
                    <label htmlFor="f-rec-outcome">Outcome</label>
                    <textarea id="f-rec-outcome" rows={2} placeholder="Describe the outcome" value={form["f-rec-outcome"] || ""} onChange={set("f-rec-outcome")} />
                  </>
                )}

                {vis.mou && (
                  <>
                    <label htmlFor="f-mou-party">Other Party / Organisation Name</label>
                    <input type="text" id="f-mou-party" placeholder="Full legal / organisation name" value={form["f-mou-party"] || ""} onChange={set("f-mou-party")} />
                    <label htmlFor="f-mou-address">Other Party Address</label>
                    <textarea id="f-mou-address" rows={2} placeholder="Address of the other party" value={form["f-mou-address"] || ""} onChange={set("f-mou-address")} />
                    <label htmlFor="f-mou-purpose">Purpose</label>
                    <textarea id="f-mou-purpose" rows={2} placeholder="Purpose of the MOU" value={form["f-mou-purpose"] || ""} onChange={set("f-mou-purpose")} />
                    <label htmlFor="f-mou-scope">Scope of Collaboration</label>
                    <textarea id="f-mou-scope" rows={3} placeholder="Scope, activities and areas of collaboration" value={form["f-mou-scope"] || ""} onChange={set("f-mou-scope")} />
                    <label htmlFor="f-mou-resp-ours">Responsibilities of 180 Degrees Consulting</label>
                    <textarea id="f-mou-resp-ours" rows={3} placeholder="Responsibilities of our organisation" value={form["f-mou-resp-ours"] || ""} onChange={set("f-mou-resp-ours")} />
                    <label htmlFor="f-mou-resp-other">Responsibilities of Other Party</label>
                    <textarea id="f-mou-resp-other" rows={3} placeholder="Responsibilities of the other party" value={form["f-mou-resp-other"] || ""} onChange={set("f-mou-resp-other")} />
                    <label htmlFor="f-mou-docs">Documents / Deliverables</label>
                    <textarea id="f-mou-docs" rows={3} placeholder="Documents, deliverables, reports or other agreed outputs" value={form["f-mou-docs"] || ""} onChange={set("f-mou-docs")} />
                    <label htmlFor="f-mou-term">Term</label>
                    <input type="text" id="f-mou-term" placeholder="e.g. 12 months from the Effective Date" value={form["f-mou-term"] || ""} onChange={set("f-mou-term")} />
                    <label htmlFor="f-mou-confidentiality">Confidentiality</label>
                    <textarea id="f-mou-confidentiality" rows={2} placeholder="Confidentiality terms" value={form["f-mou-confidentiality"] || ""} onChange={set("f-mou-confidentiality")} />
                    <label htmlFor="f-mou-termination">Termination</label>
                    <textarea id="f-mou-termination" rows={2} placeholder="Termination / notice terms" value={form["f-mou-termination"] || ""} onChange={set("f-mou-termination")} />
                    <label htmlFor="f-mou-sign-ours">180 Degrees Consulting Signatory</label>
                    <input type="text" id="f-mou-sign-ours" placeholder="Name and designation" value={form["f-mou-sign-ours"] || ""} onChange={set("f-mou-sign-ours")} />
                    <label htmlFor="f-mou-sign-other">Other Party Signatory</label>
                    <input type="text" id="f-mou-sign-other" placeholder="Name and designation" value={form["f-mou-sign-other"] || ""} onChange={set("f-mou-sign-other")} />
                    <label htmlFor="f-mou-logo">Other Party Logo (optional)</label>
                    <input type="file" id="f-mou-logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleMouLogo} />
                    <div className="logcount">For the MOU, the uploaded logo appears opposite the 180DC logo and is proportionally compressed to the same height.</div>
                  </>
                )}

                {vis.teamSingle && (
                  <>
                    <label htmlFor="f-team">Department</label>
                    <select id="f-team" value={form["f-team"] || "Business Strategy"} onChange={set("f-team")}>
                      {TEAM_OPTIONS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    {(form["f-team"] || "") === "Technical" && (
                      <>
                        <label htmlFor="f-tech-track">Technical Track</label>
                        <select id="f-tech-track" value={form["f-tech-track"] || "General"} onChange={set("f-tech-track")}>
                          {["General", "AI/ML", "Product", "DevOps"].map((t) => <option key={t}>{t}</option>)}
                        </select>
                        <div className="logcount">Marks the appointee's technical track (AI/ML, Product or DevOps) on the letter.</div>
                      </>
                    )}
                  </>
                )}

                <label htmlFor="f-ffcs">FFCS status</label>
                <select id="f-ffcs" value={form["f-ffcs"] || "FFCS"} onChange={set("f-ffcs")}>
                  <option>FFCS</option>
                  <option>Non-FFCS</option>
                </select>
              </>
            )}

            {vis.performance && (
              <>
                <label htmlFor="f-performance">Performance</label>
                <select id="f-performance" value={form["f-performance"] || "Satisfactory"} onChange={set("f-performance")}>
                  {["Underwhelming", "Not Satisfactory", "Satisfactory", "Overwhelming", "Excellent", "Outstanding"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </>
            )}

            {vis.ldi && (
              <div className="ldi-wrap-section">
                <div className="section-note">LDI stands for Leadership Decision / Initiative. Use this form before submitting a major idea, proposal, process change, project, or resource request. For multi-point answers, enter one point per line.</div>
                <LdiSection title="Basic Information">
                  <LdiField id="f-ldi-submitter" label="Submitted By" placeholder="Name of person proposing the idea" form={form} set={set} />
                  <LdiField id="f-ldi-position" label="Position / Role" placeholder="Role of proposer" form={form} set={set} />
                  <LdiSelect id="f-ldi-department" label="Department" options={TEAM_OPTIONS} form={form} set={set} />
                  <LdiSelect id="f-ldi-category" label="Idea Category" options={["New Initiative", "Process Improvement", "Event / Programme", "Technology / Automation", "People / Culture", "Finance / Cost Saving", "Partnership / External", "Other"]} form={form} set={set} />
                  <LdiField id="f-ldi-date" label="Submission Date" type="date" form={form} set={set} />
                  <LdiSelect id="f-ldi-priority" label="Priority" options={["Low", "Medium", "High", "Critical"]} form={form} set={set} />
                </LdiSection>
                <LdiSection title="Idea Overview">
                  <LdiField id="f-ldi-title" label="Idea Title" placeholder="Give the idea a clear, decision-ready title" form={form} set={set} />
                  <LdiArea id="f-ldi-summary" label="Idea Overview" placeholder="What exactly are you proposing?" form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-problem" label="Problem / Opportunity" placeholder="What problem exists, or what opportunity are we trying to capture? Include evidence where possible." form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-why" label="Why This, Why Now?" placeholder="Why should this be considered now? What happens if we do nothing?" form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-how" label="How Will It Work?" placeholder="Describe the proposed mechanism, process, workflow, or implementation. One point per line where useful." form={form} set={set} rows={5} />
                </LdiSection>
                <LdiSection title="Expected Value and Impact">
                  <LdiArea id="f-ldi-expect" label="What to Expect" placeholder="What should stakeholders expect if this is approved and executed?" form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-outcome" label="Expected Outcome" placeholder="What concrete outcome should result?" form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-beneficiaries" label="Who Benefits?" placeholder="Members, departments, clients, partners, or other stakeholders." form={form} set={set} rows={3} />
                  <LdiArea id="f-ldi-impact" label="Expected Impact" placeholder="Describe measurable and non-measurable impact: revenue, cost, quality, speed, reach, learning, morale, risk reduction, etc." form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-metrics" label="Success Metrics / KPIs" placeholder="How will we know this worked? Include targets where possible." form={form} set={set} rows={4} />
                </LdiSection>
                <LdiSection title="Cost, Resources and Allocation">
                  <LdiArea id="f-ldi-cost" label="Estimated Cost" placeholder="Give a rough estimate, assumptions, one-time cost, recurring cost, and what drives the estimate." form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-resources" label="Resources Needed" placeholder="People, money, tools, software, venues, approvals, data, equipment, external support, etc." form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-allocation" label="Resource Allocation" placeholder="Who will spend time on what? Mention department, role, estimated effort, and ownership." form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-dependencies" label="Dependencies" placeholder="What must be available or approved before this can move forward?" form={form} set={set} rows={4} />
                </LdiSection>
                <LdiSection title="Guesstimates and Assumptions">
                  <LdiArea id="f-ldi-guesstimate" label="Guesstimate / Back-of-the-Envelope Calculation" placeholder="State assumptions, inputs, simple calculations, ranges, and the resulting estimate. Example: 4 people x 3 hours/week x 6 weeks = 72 person-hours." form={form} set={set} rows={6} />
                  <LdiArea id="f-ldi-assumptions" label="Key Assumptions" placeholder="What are we assuming to be true? One assumption per line." form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-evidence" label="Evidence / Data" placeholder="What data, observations, feedback, benchmarks, or prior experience supports the proposal?" form={form} set={set} rows={4} />
                </LdiSection>
                <LdiSection title="Execution Plan">
                  <LdiArea id="f-ldi-timeline" label="Timeline" placeholder="Give expected start, major milestones, pilot period, rollout, and completion date. One milestone per line." form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-milestones" label="Milestones and Owners" placeholder="Use one line per milestone: Milestone | Owner | Target Date" form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-pilot" label="Pilot / Experiment Plan" placeholder="If applicable, how will we test this safely before full rollout?" form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-rollout" label="Rollout Plan" placeholder="How does this move from approved idea to actual implementation?" form={form} set={set} rows={4} />
                </LdiSection>
                <LdiSection title="Risks, Trade-offs and Alternatives">
                  <LdiArea id="f-ldi-risks" label="Risks" placeholder="What could go wrong? Include likelihood, impact, and mitigation where possible." form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-tradeoffs" label="Trade-offs" placeholder="What are we giving up, delaying, or making harder by doing this?" form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-alternatives" label="Alternatives Considered" placeholder="What other approaches were considered, including doing nothing?" form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-scope" label="Scope and Non-Scope" placeholder="Clearly state what this proposal covers and what it does not cover." form={form} set={set} rows={4} />
                </LdiSection>
                <LdiSection title="People, Ownership and Governance">
                  <LdiField id="f-ldi-owner" label="Proposed Owner" placeholder="Person accountable for delivery" form={form} set={set} />
                  <LdiArea id="f-ldi-stakeholders" label="Stakeholders" placeholder="Who needs to be consulted, informed, involved, or approving? One person/team per line." form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-supporters" label="People Backing the Idea" placeholder="One person per line: Name | Role / Department | Why they support the idea" form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-opponents" label="People Opposing the Idea" placeholder="One person per line: Name | Role / Department | Why they oppose or have concerns" form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-approvals" label="Approvals Needed" placeholder="List approvals or decisions required before execution." form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-communication" label="Communication Plan" placeholder="Who should hear what, when, and through which channel?" form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-maintenance" label="Post-Launch Ownership / Maintenance" placeholder="Who maintains, reviews, funds, or improves the idea after launch?" form={form} set={set} rows={4} />
                </LdiSection>
                <LdiSection title="Decision and Review">
                  <LdiSelect id="f-ldi-decision" label="Decision Requested" options={["Review and Discuss", "Approve for Pilot", "Approve for Full Execution", "Approve with Conditions", "Defer", "Reject"]} form={form} set={set} />
                  <LdiArea id="f-ldi-review" label="Review / Approval Notes" placeholder="Decision-maker comments, conditions, questions, or follow-up actions." form={form} set={set} rows={5} />
                  <LdiArea id="f-ldi-next" label="Next Steps" placeholder="What happens immediately after the decision? One action per line." form={form} set={set} rows={4} />
                  <LdiArea id="f-ldi-final" label="Final Recommendation / Closing Note" placeholder="Summarise why this idea should or should not proceed, based on the information above." form={form} set={set} rows={4} />
                </LdiSection>
              </div>
            )}

            <div className="logbox">
              <div className="logcount"><span>{logCount}</span> letter(s) recorded in this browser</div>
              {recentLetters.length > 0 && (
                <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                  {recentLetters.map((l, i) => (
                    <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", padding: "6px 8px", border: "1px solid var(--border-light)", borderRadius: 8, background: "var(--surface-container-low, rgba(0,0,0,0.02))" }}>
                      <strong style={{ color: "var(--text-primary)" }}>{l.docnum}</strong> · {l.type} · {l.name || "—"} · {l.letterDate?.slice(0, 10)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="preview-shell">
            <div className="preview-toolbar">
              <div>
                <div className="preview-title">Live preview</div>
                <div className="preview-meta">A4 · {Math.round(previewZoom * 100)}%</div>
              </div>
              <div className="preview-actions">
                <button onClick={() => setPreviewZoom((z) => Math.max(0.75, z - 0.05))}>−</button>
                <output>{Math.round(previewZoom * 100)}%</output>
                <button onClick={() => setPreviewZoom((z) => Math.min(1.15, z + 0.05))}>+</button>
                <button onClick={() => setPreviewZoom(1)}>Reset</button>
              </div>
            </div>
            <div className="pageHolder">
              <div className="pageStack" style={{ transform: `scale(${previewZoom})`, transformOrigin: "top center" }} ref={liveRef} dangerouslySetInnerHTML={{ __html: pagesHtml }} />
            </div>
          </div>
        </div>
      </div>

      <div id="printArea" style={{ display: "none" }}>
        <div className="pageStack" id="printPage" ref={printRef} dangerouslySetInnerHTML={{ __html: pagesHtml }} />
      </div>

      {/* Recipient picker modal */}
      {sendModalOpen && <SendRecipientModal
        members={members}
        deptFilter={deptFilter}
        setDeptFilter={setDeptFilter}
        search={memberSearch}
        setSearch={setMemberSearch}
        selected={selectedRecipient}
        setSelected={setSelectedRecipient}
        letterDept={currentData.team}
        docnum={currentData.docnum}
        busy={busy === "send"}
        onSend={handleSendFromModal}
        onClose={() => setSendModalOpen(false)}
      />}
    </div>
  );
}

function StudioTopBar({ isDark, toggleTheme, sessionEmail, onLogout }: { isDark: boolean; toggleTheme: () => void; sessionEmail?: string; onLogout?: () => void }) {
  return (
    <>
      <div style={{ position: "absolute", top: 24, left: 24, display: "flex", gap: 10 }}>
        <a href="https://180dcvitc.org" style={{ padding: "10px 16px", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "var(--shadow-sm)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>home</span>
          Home
        </a>
        <a href="/members" style={{ padding: "10px 16px", border: "1px solid var(--border-light)", background: "var(--bg-card)", color: "var(--text-primary)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "var(--shadow-sm)", textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>dashboard</span>
          Members
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

function ReportTextarea({ id, label, placeholder, form, set, rows = 4 }: { id: string; label: string; placeholder: string; form: Record<string, string>; set: (id: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void; rows?: number }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={rows} placeholder={placeholder} value={form[id] || ""} onChange={set(id)} />
    </>
  );
}

function LdiSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="ldi-section" style={{ border: "1px solid var(--border-light)", borderRadius: 12, padding: "14px 16px", margin: "14px 0 0", background: "var(--bg-card)" }}>
      <h3 className="ldi-section-title" style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{title}</h3>
      {children}
    </div>
  );
}

function LdiField({ id, label, placeholder, form, set, type = "text" }: { id: string; label: string; placeholder?: string; form: Record<string, string>; set: (id: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void; type?: string }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input type={type} id={id} placeholder={placeholder} value={form[id] || ""} onChange={set(id)} />
    </>
  );
}

function LdiSelect({ id, label, options, form, set }: { id: string; label: string; options: string[]; form: Record<string, string>; set: (id: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={form[id] || options[0]} onChange={set(id)}>
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </>
  );
}

function LdiArea({ id, label, placeholder, form, set, rows = 4 }: { id: string; label: string; placeholder: string; form: Record<string, string>; set: (id: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void; rows?: number }) {
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} rows={rows} placeholder={placeholder} value={form[id] || ""} onChange={set(id)} />
    </>
  );
}

function SendRecipientModal({
  members, deptFilter, setDeptFilter, search, setSearch, selected, setSelected,
  letterDept, docnum, busy, onSend, onClose,
}: {
  members: StudioMember[];
  deptFilter: string;
  setDeptFilter: (v: string) => void;
  search: string;
  setSearch: (v: string) => void;
  selected: string;
  setSelected: (v: string) => void;
  letterDept: string;
  docnum: string;
  busy: boolean;
  onSend: () => void;
  onClose: () => void;
}) {
  const deptOptions = [...new Set(members.map((m) => m.department_name).filter((d): d is string => !!d))].sort();
  const q = search.toLowerCase();
  const filtered = members.filter(
    (m) =>
      (!deptFilter || m.department_name === deptFilter) &&
      (!q ||
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.role_name.toLowerCase().includes(q)),
  );

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}>
      <div style={{ position: "relative", maxWidth: 660, width: "100%", maxHeight: "88vh", display: "flex", flexDirection: "column", background: "var(--bg-card)", borderRadius: 20, border: "1px solid var(--border-light)", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "1.25rem 1.5rem", borderBottom: "1px solid var(--border-light)" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "var(--text-primary)" }}>Send the letter</h3>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-tertiary)" }}>
              {docnum} · the official letter is saved as a PDF and will be attached
            </p>
          </div>
          <button onClick={onClose} style={{ padding: 8, borderRadius: 10, border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", display: "flex" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        <div style={{ padding: "1rem 1.5rem", display: "grid", gap: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 2, minWidth: 220 }}>
              <span className="material-symbols-outlined" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 18, color: "var(--text-tertiary)" }}>search</span>
              <input
                className="input"
                placeholder="Search members by name, role or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: "2.4rem", background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-light)", borderRadius: 10, paddingTop: "0.65rem", paddingBottom: "0.65rem", fontSize: 13.5 }}
              />
            </div>
            <select
              className="input"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              style={{ flex: 1, minWidth: 170, background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "0.65rem 0.75rem", fontSize: 13.5 }}
            >
              <option value="">All Departments</option>
              {deptOptions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          {letterDept && deptFilter === letterDept && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-tertiary)" }}>
              Pre-filtered to <strong style={{ color: "var(--text-secondary)" }}>{letterDept}</strong> (the department on the letter). Change the filter to send to someone else.
            </p>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 1.5rem 0.75rem", minHeight: 180 }}>
          {members.length === 0 ? (
            <p style={{ margin: 0, padding: "2rem 0", textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>Member directory is loading...</p>
          ) : filtered.length === 0 ? (
            <p style={{ margin: 0, padding: "2rem 0", textAlign: "center", fontSize: 13, color: "var(--text-tertiary)" }}>No members match this filter.</p>
          ) : (
            <div style={{ display: "grid", gap: 6 }}>
              {filtered.map((m) => {
                const active = selected === m.email;
                return (
                  <button
                    key={m.email}
                    onClick={() => setSelected(active ? "" : m.email)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
                      padding: "10px 12px", borderRadius: 12, cursor: "pointer", fontSize: 13.5,
                      border: active ? "1.5px solid var(--accent)" : "1px solid var(--border-light)",
                      background: active ? "rgba(141,198,63,0.08)" : "var(--bg-primary)",
                      color: "var(--text-primary)", transition: "all 0.15s",
                    }}
                  >
                    <span
                      style={{
                        width: 34, height: 34, flex: "0 0 34px", borderRadius: "50%", display: "grid", placeItems: "center",
                        fontSize: 13, fontWeight: 800, color: active ? "#fff" : "var(--text-secondary)",
                        background: active ? "var(--accent)" : "var(--surface)",
                      }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: "block", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                      <span style={{ display: "block", fontSize: 12, color: "var(--text-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {m.role_name}{m.department_name ? ` · ${m.department_name}` : ""}
                      </span>
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190 }}>{m.email}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 18, color: active ? "var(--accent)" : "var(--text-tertiary)" }}>
                      {active ? "check_circle" : "radio_button_unchecked"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ padding: "1rem 1.5rem 1.25rem", borderTop: "1px solid var(--border-light)", display: "grid", gap: 10 }}>
          <label style={{ fontSize: 12, color: "var(--text-secondary)", margin: 0 }}>
            Not in the list? Enter any email manually
          </label>
          <input
            type="email"
            placeholder="manual@example.com"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{ background: "var(--bg-primary)", color: "var(--text-primary)", border: "1px solid var(--border-light)", borderRadius: 10, padding: "0.65rem 0.85rem", fontSize: 13.5 }}
          />
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid var(--border-light)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button
              onClick={onSend}
              disabled={busy}
              style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: busy ? "var(--text-tertiary)" : "var(--accent)", color: "#fff", fontSize: 13, fontWeight: 800, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>send</span>
              {busy ? "Sending..." : "Send Letter"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}