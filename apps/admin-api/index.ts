import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { verifyToken } from "@clerk/backend";

type Bindings = {
  DB: any;
  CLUB_FILES: R2Bucket;
  BLOG_IMAGES: R2Bucket;
  CASE_STUDIES: R2Bucket;
  AUTH_SESSIONS: any;
  ENVIRONMENT?: string;
  RESEND_API_KEY?: string;
  CLERK_SECRET_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
};

type Variables = {
  user: any;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_STR_LEN = 255;
const MAX_CLERK_TOKEN_LEN = 8192;
const MAX_MSG_LEN = 2000;
const MAX_PROJECT_DESC_LEN = 5000;

function isPublicRoute(pathname: string, method: string): boolean {
  const LOGIN_ROUTES = ["/api/dev-login", "/api/auth/clerk-login"];
  if (LOGIN_ROUTES.includes(pathname)) return true;

  const PUBLIC_ROUTES: [string, string?, string?][] = [
    ["/api/signup-requests", "POST"],
    ["/api/consulting-request"],
    ["/api/auth/forgot-token"],
    ["/api/departments"],
    ["/api/projects/completed"],
    ["/api/newsletter/subscribe", "POST"],
    ["/api/newsletter/unsubscribe", "GET"],
    ["/api/newsletter/subscribers/count", "GET"],
    ["/api/newsletter-editor/otp/send", "POST"],
    ["/api/newsletter-editor/otp/verify", "POST"],
  ];
  for (const [route, requiredMethod] of PUBLIC_ROUTES) {
    if (pathname === route && (!requiredMethod || method === requiredMethod)) return true;
  }

  if (pathname.startsWith("/api/content") && method === "GET") return true;
  if (pathname.startsWith("/api/case-studies/images/") && method === "GET") return true;
  if (pathname === "/api/admin/maintenance" && method === "GET") return true;
  if (pathname === "/api/newsletter" && method === "GET") return true;

  return false;
}

function sanitizeStr(val: unknown, maxLen = MAX_STR_LEN): string | null {
  if (typeof val !== "string") return null;
  const trimmed = val.trim();
  if (trimmed.length === 0 || trimmed.length > maxLen) return null;
  return trimmed;
}

function validateEmail(val: unknown): string | null {
  const s = sanitizeStr(val);
  if (!s || !EMAIL_RE.test(s)) return null;
  return s;
}

function isProduction(c: any): boolean {
  return c.env.ENVIRONMENT === "production";
}

function logError(context: string, err: any, c?: any) {
  if (c && isProduction(c)) {
    console.error(`[${context}] ${err.message}`);
  } else {
    console.error(`${context}:`, err);
  }
}

function errorResponse(c: any, message: string, status: number) {
  return c.json({ error: message }, status);
}

const URL_RE = /^https?:\/\/.+/;

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const SAFE_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "strong", "b", "em", "i", "u", "br", "div", "span", "a", "img", "hr", "sub", "sup", "table", "thead", "tbody", "tr", "th", "td", "caption", "col", "colgroup"]);
const SAFE_ATTRS = new Set(["href", "src", "alt", "title", "class", "target", "rel", "width", "height"]);

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

function sanitizeBlogHtml(input: string): string {
  let s = input
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]*on\w+\s*=[^>]*>/gi, (m) => m.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, ""));

  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (match, slash, tagName, attrs) => {
    const lower = tagName.toLowerCase();
    if (!SAFE_TAGS.has(lower)) return escapeHtml(match);

    const safe = attrs.replace(/([a-zA-Z:-]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/g, (attr) => {
      const an = attr.match(/^([a-zA-Z:-]+)/i)?.[1]?.toLowerCase();
      if (!an || !SAFE_ATTRS.has(an)) return "";
      if (an === "href" || an === "src") {
        const v = decodeEntities(attr.replace(/^[^=]*=\s*/, "").replace(/^["']|["']$/g, "").toLowerCase());
        if (/^(javascript|data|vbscript):/.test(v)) return "";
      }
      return attr;
    });

    const selfClose = /\/$/.test(attrs.trim()) ? " /" : "";
    return "<" + slash + lower + (safe ? " " + safe.trim() : "") + selfClose + ">";
  });

  s = s.replace(/<[^>]*>/g, (match) => {
    const inner = match.slice(1, -1).trim();
    if (!inner) return "";
    const isClose = inner.startsWith("/");
    const name = (isClose ? inner.slice(1) : inner.split(/\s+/)[0]).toLowerCase();
    if (!SAFE_TAGS.has(name)) return "";
    return match;
  });

  return s;
}

function isValidUrl(val: unknown): boolean {
  if (typeof val !== "string") return false;
  if (!URL_RE.test(val)) return false;
  try { new URL(val); return true; } catch { return false; }
}

function getClientIp(c: any): string {
  return c.req.header("CF-Connecting-IP") || "unknown";
}

async function checkRateLimit(c: any, endpoint: string, maxRequests: number, windowSeconds = 60): Promise<{ allowed: boolean; retryAfter: number }> {
  const ip = getClientIp(c);
  try {
    const row: any = await c.env.DB.prepare(
      "SELECT count, window_start FROM rate_limits WHERE ip = ? AND endpoint = ?",
    ).bind(ip, endpoint).first();
    const now = new Date();
    if (!row) {
      await c.env.DB.prepare("INSERT INTO rate_limits (ip, endpoint, count, window_start) VALUES (?, ?, 1, ?)").bind(ip, endpoint, now.toISOString()).run();
      return { allowed: true, retryAfter: 0 };
    }
    const elapsed = (now.getTime() - new Date(row.window_start).getTime()) / 1000;
    if (elapsed > windowSeconds) {
      await c.env.DB.prepare("UPDATE rate_limits SET count = 1, window_start = ? WHERE ip = ? AND endpoint = ?").bind(now.toISOString(), ip, endpoint).run();
      return { allowed: true, retryAfter: 0 };
    }
    if (row.count >= maxRequests) {
      return { allowed: false, retryAfter: Math.ceil(windowSeconds - elapsed) };
    }
    await c.env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE ip = ? AND endpoint = ?").bind(ip, endpoint).run();
    return { allowed: true, retryAfter: 0 };
  } catch {
    console.error("checkRateLimit failed for endpoint: " + endpoint);
    return { allowed: false, retryAfter: 60 };
  }
}

async function checkLoginRateLimit(c: any, endpoint: string, maxRequests: number, windowSeconds = 60): Promise<{ allowed: boolean; retryAfter: number }> {
  const ip = getClientIp(c);
  try {
    const row: any = await c.env.DB.prepare(
      "SELECT count, window_start FROM rate_limits WHERE ip = ? AND endpoint = ?",
    ).bind(ip, endpoint).first();
    const now = new Date();
    if (!row) return { allowed: true, retryAfter: 0 };
    const elapsed = (now.getTime() - new Date(row.window_start).getTime()) / 1000;
    if (elapsed > windowSeconds) {
      await c.env.DB.prepare("DELETE FROM rate_limits WHERE ip = ? AND endpoint = ?").bind(ip, endpoint).run();
      return { allowed: true, retryAfter: 0 };
    }
    if (row.count >= maxRequests) {
      return { allowed: false, retryAfter: Math.ceil(windowSeconds - elapsed) };
    }
    return { allowed: true, retryAfter: 0 };
  } catch {
    console.error("checkLoginRateLimit failed for endpoint: " + endpoint);
    return { allowed: false, retryAfter: 60 };
  }
}

async function incrementLoginRateLimit(c: any, endpoint: string) {
  const ip = getClientIp(c);
  const now = new Date();
  try {
    const row: any = await c.env.DB.prepare(
      "SELECT count FROM rate_limits WHERE ip = ? AND endpoint = ?",
    ).bind(ip, endpoint).first();
    if (!row) {
      await c.env.DB.prepare("INSERT INTO rate_limits (ip, endpoint, count, window_start) VALUES (?, ?, 1, ?)").bind(ip, endpoint, now.toISOString()).run();
    } else {
      await c.env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE ip = ? AND endpoint = ?").bind(ip, endpoint).run();
    }
  } catch { console.error("incrementLoginRateLimit failed"); }
}

async function resetLoginRateLimit(c: any, endpoint: string) {
  const ip = getClientIp(c);
  try {
    await c.env.DB.prepare("DELETE FROM rate_limits WHERE ip = ? AND endpoint = ?").bind(ip, endpoint).run();
  } catch { /* ignore cleanup errors */ }
}

async function addAuditLog(c: any, action: string, targetType: string | null, targetId: string | null, details: string | null) {
  try {
    const actorEmail = (c.get("user") as any)?.email || "system";
    await c.env.DB.prepare(
      "INSERT INTO audit_log (id, action, actor_email, target_type, target_id, details) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)",
    ).bind(action, actorEmail, targetType, targetId, details).run();
  } catch (e) { console.error("audit_log_write_failed:", e); }
}

function maskToken(token: string): string {
  if (token.length <= 8) return token;
  return token.substring(0, 8) + "...";
}

function tokenEmailHtml(token: string, name: string): string {
  const safeName = escapeHtml(name);
  const safeToken = escapeHtml(token);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:28px 24px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="56" style="margin-bottom:8px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:28px;margin:0;font-weight:600;text-shadow:2px 2px 0 rgba(0,0,0,0.15)">180 Degrees Consulting</h1>
<p style="color:#1a1a1a;font-size:13px;margin:4px 0 0;font-weight:700;text-transform:uppercase;letter-spacing:2px">VIT Chennai</p>
</td></tr>
<tr><td style="padding:28px 28px 20px">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;font-weight:600">Hey ${safeName}!</p>
<p style="font-size:14px;color:#555555;margin:0 0 20px;line-height:1.6">Your admin access token for the 180DC Admin Portal is here. Pop it in the login screen to get started.</p>
<div style="background:#f5f3ee;border:3px solid #1a1a1a;border-radius:12px;padding:16px 20px;margin:0 0 20px;text-align:center">
<p style="font-size:11px;color:#777777;margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">Your Access Token</p>
<code style="font-size:16px;font-weight:800;color:#1a1a1a;letter-spacing:2px;word-break:break-all;font-family:monospace">${safeToken}</code>
</div>
<table cellpadding="0" cellspacing="0" style="background:#8dc63f;border-radius:50px;border:3px solid #1a1a1a;box-shadow:3px 3px 0 #1a1a1a;margin:0 auto 20px">
<tr><td style="padding:10px 28px;text-align:center">
<a href="https://180dcvitc.org" style="color:#1a1a1a;text-decoration:none;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Open Admin Portal</a>
</td></tr>
</table>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">This is the only time this token will be shown in full. Keep it safe and don't share it with anyone.</p>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:16px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting Ã¢â‚¬â€ VIT Chennai<br><span style="color:#777777;font-weight:400">Didn't request this? Contact your club admin immediately.</span></p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

async function sendTokenEmail(c: any, email: string, token: string, name: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured Ã¢â‚¬â€ skipping email to " + email);
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const from = "180DC Admin <team@180dcvitc.org>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        subject: "Your 180DC Admin Access Token",
        html: tokenEmailHtml(token, name),
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error(`[email] Resend FAILED (${res.status}) to=${email}: ${body}`);
      return { ok: false, status: res.status, error: body };
    }
    console.log(`[email] Resend OK (${res.status}) to=${email}: ${body}`);
    return { ok: true, status: res.status };
  } catch (e: any) {
    console.error("[email] Resend error to=" + email + ": " + e.message);
    return { ok: false, error: e.message };
  }
}

function meetEmailHtml(title: string, description: string | null, meetLink: string | null, scheduledAt: string, meetType: string): string {
  const dateStr = scheduledAt.slice(0, 16).replace("T", " ");
  const safeTitle = escapeHtml(title);
  const safeDescription = description ? escapeHtml(description) : null;
  const safeMeetLink = meetLink ? escapeHtml(meetLink) : null;
  const safeMeetType = escapeHtml(meetType);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:24px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">New Meet Scheduled</h1>
<p style="color:#1a1a1a;font-size:12px;margin:4px 0 0;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">${safeMeetType.replace(/_/g, " ").toUpperCase()}</p>
</td></tr>
<tr><td style="padding:28px">
<p style="font-size:16px;color:#1a1a1a;margin:0 0 16px;font-weight:700">${safeTitle}</p>
${safeDescription ? `<p style="font-size:14px;color:#555555;margin:0 0 16px;line-height:1.6">${safeDescription}</p>` : ""}
<div style="background:#f5f3ee;border:3px solid #1a1a1a;border-radius:12px;padding:14px 18px;margin:0 0 16px">
<p style="font-size:12px;color:#777777;margin:0 0 4px;font-weight:700;text-transform:uppercase;letter-spacing:1px">Scheduled</p>
<p style="font-size:15px;color:#1a1a1a;margin:0;font-weight:600">${dateStr}</p>
</div>
${safeMeetLink ? `<table cellpadding="0" cellspacing="0" style="background:#8dc63f;border-radius:50px;border:3px solid #1a1a1a;box-shadow:3px 3px 0 #1a1a1a;margin:0 auto 16px"><tr><td style="padding:10px 24px;text-align:center"><a href="${safeMeetLink}" style="color:#1a1a1a;text-decoration:none;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Join Meet</a></td></tr></table>` : `<p style="font-size:13px;color:#777777;margin:0 0 16px;text-align:center;font-style:italic">Venue to be announced</p>`}
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting Ã¢â‚¬â€ VIT Chennai</p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

const DEV_ADMIN_EMAIL = "admin@vitstudent.ac.in";

async function getTodayEmailCount(db: any): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const row: any = await db.prepare("SELECT count FROM daily_email_count WHERE date = ?").bind(today).first();
  return row ? row.count : 0;
}

async function incrementEmailCount(db: any) {
  const today = new Date().toISOString().slice(0, 10);
  await db.prepare("INSERT INTO daily_email_count (date, count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1").bind(today).run();
}

async function sendMeetEmail(c: any, to: string, name: string, title: string, description: string | null, meetLink: string | null, scheduledAt: string, meetType: string): Promise<boolean> {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("[email] RESEND_API_KEY not configured Ã¢â‚¬â€ skipping meet email to " + to); return false; }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "180DC Admin <team@180dcvitc.org>",
        to,
        subject: "New Meet: " + title,
        html: meetEmailHtml(title, description, meetLink, scheduledAt, meetType),
      }),
    });
    const body = await res.text();
    if (!res.ok) {
      console.error("[email] Meet email FAILED (" + res.status + ") to=" + to + ": " + body);
      return false;
    }
    console.log("[email] Meet email OK (" + res.status + ") to=" + to);
    return true;
  } catch (e: any) {
    console.error("[email] Meet email error to=" + to + ": " + e.message);
    return false;
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function queueOrSendMeetEmails(c: any, recipients: { email: string; name: string }[], meetId: string, meetType: string, title: string, description: string | null, meetLink: string | null, scheduledAt: string) {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("[email] RESEND_API_KEY not configured Ã¢â‚¬â€ skipping meet emails"); return { sent: 0, queued: 0 }; }

  let count = await getTodayEmailCount(c.env.DB);
  const MAX_DAILY = 100;
  let sent = 0;
  let queued = 0;
  let failed = 0;

  for (const r of recipients) {
    if (count < MAX_DAILY) {
      const ok = await sendMeetEmail(c, r.email, r.name, title, description, meetLink, scheduledAt, meetType);
      if (ok) { await incrementEmailCount(c.env.DB); count++; sent++; }
      else { failed++; }
      await sleep(550);
    } else {
      await c.env.DB.prepare(
        "INSERT INTO pending_emails (id, meet_id, meet_type, recipient_email, recipient_name, meet_title, meet_description, meet_link, scheduled_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(meetId, meetType, r.email, r.name, title, description, meetLink, scheduledAt).run();
      queued++;
    }
  }
  console.log(`[email] Meet emails: sent=${sent}, queued=${queued}, failed=${failed}, total_recipients=${recipients.length}`);
  return { sent, queued, failed };
}

async function getMeetRecipients(db: any, meetType: string, departmentId?: string, departments?: string[]): Promise<{ email: string; name: string }[]> {
  const advisoryFilter = " AND NOT (role_id = 'advisory' AND department_id IS NULL)";
  if (meetType === "department_meet" && departmentId) {
    const rows: any = await db.prepare("SELECT email, name FROM users WHERE department_id = ?" + advisoryFilter).bind(departmentId).all();
    return rows.results || [];
  }
  if (meetType === "club_meet") {
    const rows: any = await db.prepare("SELECT email, name FROM users WHERE 1=1" + advisoryFilter).all();
    return rows.results || [];
  }
  if (meetType === "inter_dept_meet" && departments && departments.length > 0) {
    const placeholders = departments.map(() => "?").join(",");
    const rows: any = await db.prepare(`SELECT email, name FROM users WHERE department_id IN (${placeholders})` + advisoryFilter).bind(...departments).all();
    return rows.results || [];
  }
  return [];
}

async function sendProjectAssignmentEmail(c: any, projectName: string, departmentIds: string[]) {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) return;
  const safeProjectName = escapeHtml(projectName);
  const rows: any = await c.env.DB.prepare(
    `SELECT u.email, u.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.department_id IN (${departmentIds.map(() => "?").join(",")}) AND r.power_level >= 50 AND NOT (u.role_id = 'advisory' AND u.department_id IS NULL)`
  ).bind(...departmentIds).all();
  const leads = rows.results || [];
  let count = await getTodayEmailCount(c.env.DB);
  const MAX_DAILY = 100;
  for (const lead of leads) {
    if (count >= MAX_DAILY) break;
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "180DC Admin <team@180dcvitc.org>",
          to: lead.email,
          subject: "New Project Assigned: " + projectName,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:24px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">New Project Assigned</h1>
</td></tr>
<tr><td style="padding:28px">
<p style="font-size:16px;color:#1a1a1a;margin:0 0 16px;font-weight:700">${safeProjectName}</p>
<p style="font-size:14px;color:#555555;margin:0 0 16px;line-height:1.6">A new project has been assigned to your department. Please review the details and begin planning your team's approach.</p>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">Check the 180DC Admin Portal for more information.</p>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting Ã¢â‚¬â€ VIT Chennai</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
        }),
      });
      if (!res.ok) { const body = await res.text(); console.error("Project email failed (" + res.status + "): " + body); }
    } catch (e: any) { console.error("Project email error: " + e.message); }
    await incrementEmailCount(c.env.DB);
    count++;
  }
}

async function sendRoleAssignmentEmail(c: any, email: string, name: string, roleName: string, projectName: string) {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) return;
  const count = await getTodayEmailCount(c.env.DB);
  if (count >= 100) return;
  const safeName = escapeHtml(name);
  const safeRoleName = escapeHtml(roleName);
  const safeProjectName = escapeHtml(projectName);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "180DC Admin <team@180dcvitc.org>",
        to: email,
        subject: "Role Assigned: " + roleName + " for " + projectName,
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:24px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">New Role Assigned</h1>
</td></tr>
<tr><td style="padding:28px">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;font-weight:600">Hey ${safeName}!</p>
<p style="font-size:14px;color:#555555;margin:0 0 16px;line-height:1.6">You have been assigned the role of <strong>${safeRoleName}</strong> for the project <strong>${safeProjectName}</strong>.</p>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">Log in to the 180DC Admin Portal to view your project dashboard and tasks.</p>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting Ã¢â‚¬â€ VIT Chennai</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
      }),
    });
    if (!res.ok) { const body = await res.text(); console.error("Role email failed (" + res.status + "): " + body); }
  } catch (e: any) { console.error("Role email error: " + e.message); }
  await incrementEmailCount(c.env.DB);
}

async function sendRoleChangeEmail(c: any, email: string, name: string, roleName: string) {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) return;
  const count = await getTodayEmailCount(c.env.DB);
  if (count >= 100) return;
  const safeName = escapeHtml(name);
  const safeRoleName = escapeHtml(roleName);
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "180DC Admin <team@180dcvitc.org>",
        to: email,
        subject: "Your Role Has Been Updated",
        html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:24px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">Role Updated</h1>
</td></tr>
<tr><td style="padding:28px">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;font-weight:600">Hey ${safeName}!</p>
<p style="font-size:14px;color:#555555;margin:0 0 16px;line-height:1.6">Your role in 180 Degrees Consulting has been updated to <strong>${safeRoleName}</strong>.</p>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">Log in to the 180DC Admin Portal to view your updated access and responsibilities.</p>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting Ã¢â‚¬â€ VIT Chennai</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
      }),
    });
    if (!res.ok) { const body = await res.text(); console.error("Role change email failed (" + res.status + "): " + body); }
  } catch (e: any) { console.error("Role change email error: " + e.message); }
  await incrementEmailCount(c.env.DB);
}

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 600000, hash: "SHA-256" },
    keyMaterial, 256,
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return { hash, salt };
}

async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 600000, hash: "SHA-256" },
    keyMaterial, 256,
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  if (hash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < hash.length; i++) {
    result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return result === 0;
}

// One-time (per isolate) DB init — running ensureTables/seedData on every
// request cost 50-100+ D1 round trips per API call. Cached after first run;
// reset on failure so the next request retries.
let dbReadyPromise: Promise<void> | null = null;
function ensureDbReady(db: any, env?: any): Promise<void> {
  if (!dbReadyPromise) {
    dbReadyPromise = (async () => {
      await ensureTables(db);
      await seedData(db, env);
    })().catch((e: any) => {
      dbReadyPromise = null;
      throw e;
    });
  }
  return dbReadyPromise;
}

async function ensureTables(db: any) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT);
    CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, power_level INTEGER NOT NULL, created_by TEXT);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, role_id TEXT NOT NULL, department_id TEXT, secondary_role_id TEXT, ex_title TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (role_id) REFERENCES roles(id), FOREIGN KEY (department_id) REFERENCES departments(id));
    CREATE TABLE IF NOT EXISTS signup_requests (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT, department_id TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS admin_tokens (token TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, role_id TEXT NOT NULL DEFAULT 'member', created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, revoked_at DATETIME, FOREIGN KEY (role_id) REFERENCES roles(id));
    CREATE TABLE IF NOT EXISTS department_meets (id TEXT PRIMARY KEY, department_id TEXT NOT NULL, title TEXT NOT NULL, meet_link TEXT, description TEXT, scheduled_at DATETIME NOT NULL, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (department_id) REFERENCES departments(id));
    CREATE TABLE IF NOT EXISTS department_documents (id TEXT PRIMARY KEY, department_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, file_url TEXT, status TEXT DEFAULT 'pending', created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (department_id) REFERENCES departments(id));
    CREATE TABLE IF NOT EXISTS department_instructions (id TEXT PRIMARY KEY, department_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, priority TEXT DEFAULT 'medium', created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (department_id) REFERENCES departments(id));
    CREATE TABLE IF NOT EXISTS department_projects (id TEXT PRIMARY KEY, department_id TEXT NOT NULL, name TEXT NOT NULL, description TEXT, status TEXT DEFAULT 'upcoming', deadline DATETIME, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (department_id) REFERENCES departments(id));
    CREATE TABLE IF NOT EXISTS club_meets (id TEXT PRIMARY KEY, title TEXT NOT NULL, meet_link TEXT, description TEXT, scheduled_at DATETIME NOT NULL, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS inter_dept_meets (id TEXT PRIMARY KEY, title TEXT NOT NULL, meet_link TEXT, description TEXT, scheduled_at DATETIME NOT NULL, departments TEXT NOT NULL, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS case_studies (id TEXT PRIMARY KEY, tag TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS team_members (id TEXT PRIMARY KEY, initials TEXT NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS role_transfers (id TEXT PRIMARY KEY, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL, role_id TEXT NOT NULL, status TEXT DEFAULT 'pending', created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (from_user_id) REFERENCES users(id), FOREIGN KEY (to_user_id) REFERENCES users(id), FOREIGN KEY (role_id) REFERENCES roles(id));
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, company_org TEXT, status TEXT DEFAULT 'upcoming', deadline DATETIME, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS project_departments (project_id TEXT NOT NULL, department_id TEXT NOT NULL, PRIMARY KEY (project_id, department_id), FOREIGN KEY (project_id) REFERENCES projects(id), FOREIGN KEY (department_id) REFERENCES departments(id));
    CREATE TABLE IF NOT EXISTS project_roles (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL, role_name TEXT NOT NULL, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES projects(id), FOREIGN KEY (user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS project_tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, assigned_to TEXT, status TEXT DEFAULT 'pending', created_by TEXT, completed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES projects(id));
    CREATE TABLE IF NOT EXISTS team_instances (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, group_label TEXT DEFAULT 'Company', level_count INTEGER DEFAULT 1, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS instance_departments (instance_id TEXT NOT NULL, department_id TEXT NOT NULL, PRIMARY KEY (instance_id, department_id), FOREIGN KEY (instance_id) REFERENCES team_instances(id), FOREIGN KEY (department_id) REFERENCES departments(id));
    CREATE TABLE IF NOT EXISTS instance_teams (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, group_id TEXT, name TEXT NOT NULL, description TEXT, member_limit INTEGER, min_members INTEGER, sort_order INTEGER DEFAULT 0, current_level INTEGER DEFAULT 1, status TEXT DEFAULT 'active', created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (instance_id) REFERENCES team_instances(id));
    CREATE TABLE IF NOT EXISTS instance_team_members (team_id TEXT NOT NULL, user_id TEXT NOT NULL, added_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (team_id, user_id), FOREIGN KEY (team_id) REFERENCES instance_teams(id), FOREIGN KEY (user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS instance_groups (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, name TEXT NOT NULL, organization TEXT, description TEXT, sort_order INTEGER DEFAULT 0, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (instance_id) REFERENCES team_instances(id));
    CREATE TABLE IF NOT EXISTS instance_levels (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, FOREIGN KEY (instance_id) REFERENCES team_instances(id));
    CREATE TABLE IF NOT EXISTS instance_external_members (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, organization TEXT, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (instance_id) REFERENCES team_instances(id));
    CREATE TABLE IF NOT EXISTS instance_team_external_members (team_id TEXT NOT NULL, external_id TEXT NOT NULL, added_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (team_id, external_id), FOREIGN KEY (team_id) REFERENCES instance_teams(id), FOREIGN KEY (external_id) REFERENCES instance_external_members(id));
    CREATE TABLE IF NOT EXISTS rate_limits (ip TEXT NOT NULL, endpoint TEXT NOT NULL, count INTEGER DEFAULT 1, window_start DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (ip, endpoint));
    CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, action TEXT NOT NULL, actor_email TEXT, target_type TEXT, target_id TEXT, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS daily_email_count (date TEXT PRIMARY KEY, count INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS pending_emails (id TEXT PRIMARY KEY, meet_id TEXT NOT NULL, meet_type TEXT NOT NULL, recipient_email TEXT NOT NULL, recipient_name TEXT NOT NULL, meet_title TEXT NOT NULL, meet_description TEXT, meet_link TEXT, scheduled_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS consulting_requests (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, organization TEXT NOT NULL, role_in_org TEXT, requirement TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS consulting_responses (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, email_subject TEXT NOT NULL, email_body TEXT NOT NULL, sent_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (request_id) REFERENCES consulting_requests(id));
    CREATE TABLE IF NOT EXISTS maintenance_mode (id INTEGER PRIMARY KEY DEFAULT 1, enabled INTEGER DEFAULT 0, message TEXT DEFAULT 'Site is under maintenance. Please check back later.', updated_by TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS newsletter_subscribers (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, active INTEGER DEFAULT 1, subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP, unsubscribed_at DATETIME);
    CREATE TABLE IF NOT EXISTS newsletters (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', content TEXT DEFAULT '', source_file_url TEXT, image_url TEXT, sent_at DATETIME, recipient_count INTEGER DEFAULT 0, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS newsletter_authorized_emails (email TEXT PRIMARY KEY, added_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS newsletter_otp_codes (id TEXT PRIMARY KEY, email TEXT NOT NULL, code TEXT NOT NULL, expires_at DATETIME NOT NULL, used INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS newsletter_sessions (id TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);
  await runMigrations(db);
}

async function runMigrations(db: any) {
  try { await db.exec("ALTER TABLE role_transfers ADD COLUMN from_user_accepted INTEGER DEFAULT 0"); } catch { console.warn("Migration: from_user_accepted may already exist"); }
  try { await db.exec("ALTER TABLE role_transfers ADD COLUMN to_user_accepted INTEGER DEFAULT 0"); } catch { console.warn("Migration: to_user_accepted may already exist"); }
  try { await db.exec("ALTER TABLE signup_requests ADD COLUMN department_id TEXT"); } catch { console.warn("Migration: department_id may already exist"); }
  try { await db.exec("ALTER TABLE projects ADD COLUMN company_org TEXT"); } catch { console.warn("Migration: company_org may already exist"); }
  try { await db.exec("ALTER TABLE projects ADD COLUMN year TEXT"); } catch { console.warn("Migration: year may already exist"); }
  try { await db.exec("ALTER TABLE admin_tokens ADD COLUMN expires_at DATETIME"); } catch { console.warn("Migration: expires_at may already exist"); }
  try { await db.exec("ALTER TABLE case_studies ADD COLUMN content TEXT DEFAULT ''"); } catch { console.warn("Migration: case_studies.content may already exist"); }
  try { await db.exec("ALTER TABLE case_studies ADD COLUMN image_url TEXT"); } catch { console.warn("Migration: case_studies.image_url may already exist"); }
  try { await db.exec("ALTER TABLE case_studies ADD COLUMN author_name TEXT DEFAULT 'Anonymous'"); } catch { console.warn("Migration: case_studies.author_name may already exist"); }
  try { await db.exec("ALTER TABLE case_studies ADD COLUMN created_by TEXT"); } catch { console.warn("Migration: case_studies.created_by may already exist"); }
  try { await db.exec("DELETE FROM case_studies WHERE id LIKE 'cs%' AND content IS NULL"); } catch { console.warn("Migration: could not remove seed case studies"); }
  try { await db.exec("ALTER TABLE case_studies ADD COLUMN source_file_url TEXT"); } catch { console.warn("Migration: case_studies.source_file_url may already exist"); }
  try { await db.exec("DELETE FROM rate_limits WHERE endpoint IN ('dev_login', 'recruitment_login', 'recruitment_register')"); } catch (e: any) { console.warn("Migration: clear login rate limits"); }
  // Recruitment system removed — drop its tables if they still exist
  try {
    await db.exec(`
      DROP TABLE IF EXISTS recruitment_evaluations;
      DROP TABLE IF EXISTS recruitment_evaluation_criteria;
      DROP TABLE IF EXISTS recruitment_applications;
      DROP TABLE IF EXISTS recruitment_sessions;
      DROP TABLE IF EXISTS recruitment_applicants;
      DROP TABLE IF EXISTS recruitment_rounds;
      DROP TABLE IF EXISTS recruitment_domain_settings;
    `);
  } catch (e: any) { logError("Migration: drop recruitment tables", e); }
  try { await db.exec("ALTER TABLE users ADD COLUMN secondary_role_id TEXT"); } catch { console.warn("Migration: secondary_role_id may already exist"); }
  try { await db.exec("ALTER TABLE admin_tokens ADD COLUMN active_role_id TEXT"); } catch { console.warn("Migration: active_role_id may already exist"); }
  try { await db.exec("ALTER TABLE users ADD COLUMN ex_title TEXT"); } catch { console.warn("Migration: ex_title may already exist"); }
  try { await db.exec("ALTER TABLE users ADD COLUMN clerk_user_id TEXT"); } catch { console.warn("Migration: clerk_user_id may already exist"); }
  try { await db.exec("ALTER TABLE users ADD COLUMN oauth_enabled INTEGER DEFAULT 0"); } catch { console.warn("Migration: oauth_enabled may already exist"); }
  try { await db.exec("ALTER TABLE newsletters ADD COLUMN email_subject TEXT"); } catch { console.warn("Migration: newsletters.email_subject may already exist"); }
  try { await db.exec("ALTER TABLE instance_teams ADD COLUMN min_members INTEGER"); } catch { console.warn("Migration: instance_teams.min_members may already exist"); }

  // Team instances: group layer (Instance -> Group -> Team) + outside (non-registered) members
  try { await db.exec(`CREATE TABLE IF NOT EXISTS instance_groups (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, name TEXT NOT NULL, organization TEXT, description TEXT, sort_order INTEGER DEFAULT 0, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (instance_id) REFERENCES team_instances(id))`); } catch { console.warn("Migration: instance_groups table"); }
  try { await db.exec(`CREATE TABLE IF NOT EXISTS instance_external_members (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT, organization TEXT, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (instance_id) REFERENCES team_instances(id))`); } catch { console.warn("Migration: instance_external_members table"); }
  try { await db.exec(`CREATE TABLE IF NOT EXISTS instance_team_external_members (team_id TEXT NOT NULL, external_id TEXT NOT NULL, added_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (team_id, external_id), FOREIGN KEY (team_id) REFERENCES instance_teams(id), FOREIGN KEY (external_id) REFERENCES instance_external_members(id))`); } catch { console.warn("Migration: instance_team_external_members table"); }
  try { await db.exec("ALTER TABLE instance_teams ADD COLUMN group_id TEXT"); } catch { console.warn("Migration: instance_teams.group_id may already exist"); }
  try { await db.exec("ALTER TABLE instance_teams ADD COLUMN sort_order INTEGER DEFAULT 0"); } catch { console.warn("Migration: instance_teams.sort_order may already exist"); }
  try { await db.exec("ALTER TABLE team_instances ADD COLUMN group_label TEXT DEFAULT 'Company'"); } catch { console.warn("Migration: team_instances.group_label may already exist"); }
  try { await db.exec(`CREATE TABLE IF NOT EXISTS instance_levels (id TEXT PRIMARY KEY, instance_id TEXT NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL, FOREIGN KEY (instance_id) REFERENCES team_instances(id))`); } catch { console.warn("Migration: instance_levels table"); }
  try { await db.exec("ALTER TABLE team_instances ADD COLUMN level_count INTEGER DEFAULT 1"); } catch { console.warn("Migration: team_instances.level_count may already exist"); }
  try { await db.exec("ALTER TABLE instance_teams ADD COLUMN current_level INTEGER DEFAULT 1"); } catch { console.warn("Migration: instance_teams.current_level may already exist"); }
  try { await db.exec("ALTER TABLE instance_teams ADD COLUMN status TEXT DEFAULT 'active'"); } catch { console.warn("Migration: instance_teams.status may already exist"); }

  try { await db.exec("INSERT OR IGNORE INTO maintenance_mode (id, enabled, message) VALUES (1, 0, 'Site is under maintenance. Please check back later.')"); } catch { console.warn("Migration: maintenance_mode seed"); }
  try { await db.exec(`CREATE TABLE IF NOT EXISTS newsletter_subscribers (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, active INTEGER DEFAULT 1, subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP, unsubscribed_at DATETIME)`); } catch { console.warn("Migration: newsletter_subscribers table"); }
  try { await db.exec(`CREATE TABLE IF NOT EXISTS newsletters (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT DEFAULT '', content TEXT DEFAULT '', source_file_url TEXT, image_url TEXT, sent_at DATETIME, recipient_count INTEGER DEFAULT 0, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch { console.warn("Migration: newsletters table"); }
  try { await db.exec(`CREATE TABLE IF NOT EXISTS newsletter_authorized_emails (email TEXT PRIMARY KEY, added_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch { console.warn("Migration: newsletter_authorized_emails table"); }
  try { await db.exec(`CREATE TABLE IF NOT EXISTS newsletter_otp_codes (id TEXT PRIMARY KEY, email TEXT NOT NULL, code TEXT NOT NULL, expires_at DATETIME NOT NULL, used INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch { console.warn("Migration: newsletter_otp_codes table"); }
  try { await db.exec(`CREATE TABLE IF NOT EXISTS newsletter_sessions (id TEXT PRIMARY KEY, email TEXT NOT NULL, expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`); } catch { console.warn("Migration: newsletter_sessions table"); }
}

let currentEnv: any = null;

async function seedData(db: any, env?: any) {
  if (env) currentEnv = env;
  try {
    const roleSql = "INSERT OR IGNORE INTO roles (id, name, power_level, created_by) VALUES (?, ?, ?, ?)";
    // Board (power 100)
    await db.prepare(roleSql).bind("chairperson", "Chairperson", 100, "system").run();
    await db.prepare(roleSql).bind("vice_chairperson", "Vice Chairperson", 100, "system").run();
    await db.prepare(roleSql).bind("secretary", "Secretary", 100, "system").run();
    await db.prepare(roleSql).bind("co_secretary", "Co-Secretary", 100, "system").run();
    await db.prepare(roleSql).bind("technical_director", "Technical Director", 100, "system").run();
    // Department Directors (power 50 — manage their own department only)
    await db.prepare(roleSql).bind("finance_director", "Finance Director", 50, "system").run();
    await db.prepare(roleSql).bind("crm_director", "Client Relationship Director", 50, "system").run();
    await db.prepare(roleSql).bind("operations_director", "Operations Director", 50, "system").run();
    await db.prepare(roleSql).bind("business_strategy_director", "Business Strategy Director", 50, "system").run();
    await db.prepare(roleSql).bind("marketing_director", "Marketing Director", 50, "system").run();
    // Members
    await db.prepare(roleSql).bind("member", "General Member", 10, "system").run();
    await db.prepare(roleSql).bind("advisory", "Advisory Member", 30, "system").run();

    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("tech", "Technical", "Handles technical infrastructure, UI, and research & development").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("finance", "Finance", "Handles budgeting and financial planning").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("crm", "Client Relationship Management", "Manages client relationships, partnerships, and sponsorships").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("operations", "Operations", "Plans and executes events and club initiatives").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("business_strategy", "Business Strategy", "Handles business strategy and organizational planning").run();
    await db.prepare("INSERT OR REPLACE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("marketing", "Marketing", "Handles marketing, outreach, communications, and social media").run();

    // ── Org restructure migration (idempotent) ──
    // 1. Role id/name/power fixes for retained roles
    await db.prepare("UPDATE roles SET name = 'Advisory Member' WHERE id = 'advisory' AND name != 'Advisory Member'").run();
    await db.prepare("UPDATE roles SET name = 'General Member' WHERE id = 'member' AND name != 'General Member'").run();
    await db.prepare("UPDATE roles SET power_level = 100 WHERE id IN ('secretary', 'technical_director') AND power_level != 100").run();
    await db.prepare("UPDATE roles SET power_level = 50 WHERE id IN ('business_strategy_director', 'marketing_director') AND power_level != 50").run();

    // 2. Migrate user roles to the new structure
    await db.prepare("UPDATE users SET role_id = 'chairperson' WHERE role_id = 'president'").run();
    await db.prepare("UPDATE users SET role_id = 'vice_chairperson' WHERE role_id = 'vice_president'").run();
    await db.prepare("UPDATE users SET role_id = 'technical_director' WHERE role_id IN ('lead', 'lead_rnd')").run();
    await db.prepare("UPDATE users SET role_id = 'finance_director' WHERE role_id = 'lead_finance'").run();
    await db.prepare("UPDATE users SET role_id = 'operations_director' WHERE role_id = 'lead_events'").run();
    await db.prepare("UPDATE users SET role_id = 'crm_director' WHERE role_id = 'lead_cps'").run();
    await db.prepare("UPDATE users SET role_id = 'business_strategy_director' WHERE role_id = 'lead_business_strategy'").run();
    await db.prepare("UPDATE users SET role_id = 'member' WHERE role_id IN ('lead_marketing', 'lead_social', 'lead_hr')").run();

    // 3. Migrate department references (R&D → Technical, Social Media → Marketing,
    //     Events → Operations, CPS → CRM, HR → Operations) across all FK tables
    const deptRenames: Record<string, string> = {
      rnd: "tech",
      social_media: "marketing",
      "events-initiatives": "operations",
      "client-partner-sponsor": "crm",
      hr: "operations",
    };
    for (const [oldId, newId] of Object.entries(deptRenames)) {
      await db.prepare("UPDATE users SET department_id = ? WHERE department_id = ?").bind(newId, oldId).run();
      for (const t of ["department_meets", "department_documents", "department_instructions", "department_projects"]) {
        await db.prepare(`UPDATE ${t} SET department_id = ? WHERE department_id = ?`).bind(newId, oldId).run();
      }
      // Junction table has a composite PK — drop the old row if the new one already exists
      await db.prepare(
        "DELETE FROM project_departments WHERE department_id = ? AND EXISTS (SELECT 1 FROM project_departments pd2 WHERE pd2.project_id = project_departments.project_id AND pd2.department_id = ?)",
      ).bind(oldId, newId).run();
      await db.prepare("UPDATE project_departments SET department_id = ? WHERE department_id = ?").bind(newId, oldId).run();
    }

    // 4. Ensure every director is attached to their department
    const directorDepts: Record<string, string> = {
      technical_director: "tech",
      finance_director: "finance",
      crm_director: "crm",
      operations_director: "operations",
      business_strategy_director: "business_strategy",
      marketing_director: "marketing",
    };
    for (const [roleId, deptId] of Object.entries(directorDepts)) {
      await db.prepare(
        `UPDATE users SET department_id = ? WHERE role_id = ? AND (department_id IS NULL OR department_id NOT IN ('tech', 'finance', 'crm', 'operations', 'business_strategy', 'marketing'))`
      ).bind(deptId, roleId).run();
    }

    // 5. Migrate admin tokens to the new role ids
    await db.prepare("UPDATE admin_tokens SET role_id = 'chairperson' WHERE role_id = 'president'").run();
    await db.prepare("UPDATE admin_tokens SET role_id = 'vice_chairperson' WHERE role_id = 'vice_president'").run();
    await db.prepare("UPDATE admin_tokens SET role_id = 'technical_director' WHERE role_id IN ('lead', 'lead_rnd')").run();
    await db.prepare("UPDATE admin_tokens SET role_id = 'finance_director' WHERE role_id = 'lead_finance'").run();
    await db.prepare("UPDATE admin_tokens SET role_id = 'operations_director' WHERE role_id = 'lead_events'").run();
    await db.prepare("UPDATE admin_tokens SET role_id = 'crm_director' WHERE role_id = 'lead_cps'").run();
    await db.prepare("UPDATE admin_tokens SET role_id = 'business_strategy_director' WHERE role_id = 'lead_business_strategy'").run();
    await db.prepare("UPDATE admin_tokens SET role_id = 'member' WHERE role_id IN ('lead_marketing', 'lead_social', 'lead_hr')").run();

    // 6. Remove dual-role (secondary role) data
    await db.prepare("UPDATE users SET secondary_role_id = NULL WHERE secondary_role_id IS NOT NULL").run();
    await db.prepare("UPDATE admin_tokens SET active_role_id = NULL WHERE active_role_id IS NOT NULL").run();

    // 7. Delete legacy departments, roles, and titles
    await db.prepare("DELETE FROM departments WHERE id IN ('rnd', 'social_media', 'events-initiatives', 'client-partner-sponsor', 'hr', 'legal')").run();
    await db.prepare("DELETE FROM roles WHERE id IN ('president', 'vice_president', 'lead', 'lead_rnd', 'lead_marketing', 'lead_social', 'lead_finance', 'lead_events', 'lead_cps', 'lead_business_strategy', 'lead_hr', 'lead_legal')").run();
    await db.prepare("UPDATE team_members SET role = 'Chairperson' WHERE role = 'President'").run();

    if (!currentEnv || (currentEnv.ENVIRONMENT || "").toLowerCase() !== "production") {
      const devToken = crypto.randomUUID().replace(/-/g, "");
      await db.prepare("INSERT OR REPLACE INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)").bind(devToken, "admin@vitstudent.ac.in", "Dev Admin", "chairperson", "system").run();
      console.info("Dev token generated (visible only in dev mode)");
    }

    const tmCount: any = await db.prepare("SELECT COUNT(*) as cnt FROM team_members").first();
    if (tmCount && tmCount.cnt === 0) {
      const tm = "INSERT OR IGNORE INTO team_members (id, initials, name, role) VALUES (?, ?, ?, ?)";
      await db.prepare(tm).bind("tm1", "JD", "John Doe", "Chairperson").run();
      await db.prepare(tm).bind("tm2", "JS", "Jane Smith", "Director of External Relations").run();
      await db.prepare(tm).bind("tm3", "AT", "Alex Turner", "Director of Internal Relations").run();
      await db.prepare(tm).bind("tm4", "EC", "Emily Chen", "Director of L&D").run();
      await db.prepare(tm).bind("tm5", "MR", "Michael Ross", "VP of Projects").run();
      await db.prepare(tm).bind("tm6", "SL", "Sarah Lee", "Head of Marketing").run();
    }

    const pCount: any = await db.prepare("SELECT COUNT(*) as cnt FROM partners").first();
    if (pCount && pCount.cnt === 0) {
      const pi = "INSERT OR IGNORE INTO partners (id, name) VALUES (?, ?)";
      await db.prepare(pi).bind("p1", "Partner Org 1").run();
      await db.prepare(pi).bind("p2", "Partner Org 2").run();
      await db.prepare(pi).bind("p3", "Partner Org 3").run();
      await db.prepare(pi).bind("p4", "Partner Org 4").run();
      await db.prepare(pi).bind("p5", "Partner Org 5").run();
      await db.prepare(pi).bind("p6", "Partner Org 6").run();
      await db.prepare(pi).bind("p7", "Partner Org 7").run();
      await db.prepare(pi).bind("p8", "Partner Org 8").run();
    }
  } catch (e: any) {
    logError("Seed failed", e);
  }
}

/**
 * Middleware: Verify Authentication & Inject User Context
 * (In production, this decodes the Google/Clerk JWT token mapped to the VIT email)
 */
// CORS Ã¢â‚¬â€ runs first, handles preflight OPTIONS automatically
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  const path = new URL(c.req.url).pathname;
  if (path.startsWith("/api/case-studies/images/")) {
    c.res.headers.set("X-Frame-Options", "SAMEORIGIN");
  } else {
    c.res.headers.set("X-Frame-Options", "DENY");
  }
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
});

const ALLOWED_ORIGINS = [
  "https://180dcvitc.org",
  "https://180dc-admin.pages.dev",
  "https://admin.180dc.org",
  "https://180dc-admin-frontend.pages.dev",
];

const isDevOrigin = (o: string) => {
  try {
    const u = new URL(o);
    return ["localhost", "127.0.0.1"].includes(u.hostname);
  } catch { return false; }
};

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin || isDevOrigin(origin) || ALLOWED_ORIGINS.includes(origin)) return origin;
      return null;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use("*", csrf({
  origin: (origin) => {
    if (!origin) return false;
    if (isDevOrigin(origin) || ALLOWED_ORIGINS.includes(origin)) return true;
    return false;
  },
}));

// Auth middleware
app.use("*", async (c, next) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
  } catch (e: any) {
    logError("DB init failed", e, c);
    return c.json({ error: "Database initialization failed" }, 500);
  }

  // Allow unauthenticated routes
  const url = new URL(c.req.url);
  if (isPublicRoute(url.pathname, c.req.method)) {
    await next();
    return;
  }

  // Newsletter editor OTP routes use their own auth (not admin tokens)
  if (url.pathname.startsWith("/api/newsletter-editor/") && !url.pathname.startsWith("/api/newsletter-editor/admin/")) {
    await next();
    return;
  }

  // Validate Bearer token against admin_tokens registry.
  let email = undefined as undefined | string;
  let tokenRow: any = null;
  try {
    const authHeader = c.req.header("Authorization") || "";
    if (authHeader.trim().toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      tokenRow = await c.env.DB.prepare(
        "SELECT token, email, name, role_id, revoked_at, expires_at FROM admin_tokens WHERE token = ?",
      )
        .bind(token)
        .first();

      if (tokenRow && !tokenRow.revoked_at && (!tokenRow.expires_at || new Date(tokenRow.expires_at + "Z") > new Date())) {
        email = tokenRow.email;

        const existing: any = await c.env.DB.prepare(
          "SELECT id FROM users WHERE email = ?",
        )
          .bind(email)
          .first();

        if (!existing) {
          await c.env.DB.prepare(
            "INSERT INTO users (id, name, email, role_id) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
          )
            .bind(
              tokenRow.name || tokenRow.email.split("@")[0],
              email,
              tokenRow.role_id || "member",
            )
            .run();
        }
      }
    }
  } catch (e) {
    logError("admin_tokens lookup failed", e, c);
  }

  if (!email) {
    return c.json({ error: "Unauthorized: missing or invalid token" }, 401);
  }

  const query =
    "SELECT u.*, r.power_level, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?";
  let user: any = await c.env.DB.prepare(query).bind(email).first();

  if (!user) {
    return c.json(
      { error: "Unauthorized: Email not registered." },
      401,
    );
  }

  const mm: any = await c.env.DB.prepare("SELECT enabled, message FROM maintenance_mode WHERE id = 1").first();
  if (mm && mm.enabled === 1 && user.power_level < 100) {
    return c.json({ error: mm.message || "Site is under maintenance." }, 503);
  }

  c.set("user", user);
  await next();
});

/**
 * Helper to check if current user is Board (Power == 100:
 * Chairperson, Vice Chairperson, Secretary, Co-Secretary)
 */
const requireMember = (c: any) => {
  const user = c.get("user");
  if (user.power_level < 10) {
    throw new Error("Forbidden: Requires member privileges.");
  }
};

const requireBoard = (c: any) => {
  const user = c.get("user");
  if (user.power_level < 100) {
    throw new Error(
      "Forbidden: Requires Board privileges (Chairperson, Vice Chairperson, Secretary, or Co-Secretary).",
    );
  }
};

// ---------------------------------------------------------
// CONTENT ENDPOINTS (Public Ã¢â‚¬â€ landing page data)
// ---------------------------------------------------------
// CONTENT ENDPOINTS (Public Ã¢â‚¬â€ landing page data)
// ---------------------------------------------------------
app.get("/api/content/case-studies", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "content_case_studies", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const rows = await c.env.DB.prepare("SELECT * FROM case_studies ORDER BY created_at ASC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.get("/api/content/team-members", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "content_team_members", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const rows = await c.env.DB.prepare("SELECT * FROM team_members ORDER BY created_at ASC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.get("/api/content/partners", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "content_partners", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const rows = await c.env.DB.prepare("SELECT * FROM partners ORDER BY created_at ASC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// NEWSLETTER ENDPOINTS
// ---------------------------------------------------------

function newsletterEmailHtml(title: string, description: string, siteUrl: string, subscriberEmail?: string, hasPdf?: boolean): string {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const unsubUrl = subscriberEmail
    ? `https://180dcvitc.org/unsubscribe?email=${encodeURIComponent(subscriberEmail)}`
    : "https://180dcvitc.org/unsubscribe";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">

<!-- HEADER -->
<tr><td style="background:#8dc63f;padding:28px 24px 20px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="52" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:26px;margin:0;font-weight:600;text-shadow:2px 2px 0 rgba(0,0,0,0.12)">180 Degrees Consulting</h1>
<p style="color:#1a1a1a;font-size:12px;margin:4px 0 0;font-weight:700;text-transform:uppercase;letter-spacing:2px">VIT Chennai</p>
</td></tr>

<!-- GREETING -->
<tr><td style="padding:28px 32px 0">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 4px;font-weight:700">Hey there! &#x1F44B;</p>
<p style="font-size:13px;color:#777777;margin:0 0 20px;line-height:1.5">Happy to have you here. Here's what's new from 180DC.</p>
</td></tr>

<!-- NEWSLETTER LABEL -->
<tr><td style="padding:0 32px">
<table cellpadding="0" cellspacing="0" style="margin:0 0 6px">
<tr><td style="background:#8dc63f;border-radius:4px;padding:3px 10px">
<span style="font-size:10px;color:#ffffff;font-weight:800;text-transform:uppercase;letter-spacing:1.5px">Newsletter</span>
</td></tr>
</table>
</td></tr>

<!-- TITLE -->
<tr><td style="padding:0 32px">
<h2 style="font-size:22px;color:#1a1a1a;margin:0 0 14px;line-height:1.4;font-weight:800">${safeTitle}</h2>
</td></tr>

<!-- DESCRIPTION -->
${safeDesc ? `<tr><td style="padding:0 32px">
<p style="font-size:14px;color:#555555;margin:0 0 24px;line-height:1.7">${safeDesc}</p>
</td></tr>` : ""}

<!-- PDF ATTACHMENT NOTICE -->
${hasPdf ? `<tr><td style="padding:0 32px">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8f5;border:2px dashed #d0cec8;border-radius:12px;margin:0 0 24px">
<tr><td style="padding:16px 20px;text-align:center">
<p style="font-size:13px;color:#1a1a1a;margin:0 0 4px;font-weight:700">&#x1F4CE; PDF Attached</p>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">The full newsletter is attached as a PDF for your convenience. Download it for offline reading!</p>
</td></tr>
</table>
</td></tr>` : ""}

<!-- CTA BUTTON -->
<tr><td style="padding:0 32px 28px;text-align:center">
<table cellpadding="0" cellspacing="0" style="background:#8dc63f;border-radius:50px;border:3px solid #1a1a1a;box-shadow:3px 3px 0 #1a1a1a;margin:0 auto">
<tr><td style="padding:12px 32px;text-align:center">
<a href="${escapeHtml(siteUrl)}" style="color:#1a1a1a;text-decoration:none;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Read on Website</a>
</td></tr>
</table>
</td></tr>

<!-- DIVIDER -->
<tr><td style="padding:0 32px">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="border-bottom:2px solid #e8e6e1"></td>
</tr></table>
</td></tr>

<!-- SOCIAL LINKS -->
<tr><td style="padding:24px 32px 0;text-align:center">
<p style="font-size:11px;color:#777777;margin:0 0 12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">Follow Us</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr>
<td style="padding:0 8px">
<a href="https://www.instagram.com/180dc.vitc/" style="text-decoration:none;display:inline-block">
<table cellpadding="0" cellspacing="0"><tr>
<td style="background:#1a1a1a;border-radius:8px;padding:8px 14px;text-align:center">
<span style="font-size:11px;color:#ffffff;font-weight:700;text-decoration:none">Instagram</span>
</td></tr></table>
</a>
</td>
<td style="padding:0 8px">
<a href="https://www.linkedin.com/company/180-degrees-consulting-vit-chennai/" style="text-decoration:none;display:inline-block">
<table cellpadding="0" cellspacing="0"><tr>
<td style="background:#1a1a1a;border-radius:8px;padding:8px 14px;text-align:center">
<span style="font-size:11px;color:#ffffff;font-weight:700;text-decoration:none">LinkedIn</span>
</td></tr></table>
</a>
</td>
</tr>
</table>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#f9f8f5;border-top:3px solid #1a1a1a;border-radius:0 0 13px 13px;padding:20px 32px;text-align:center">
<p style="font-size:12px;color:#1a1a1a;margin:0 0 4px;font-weight:700">180 Degrees Consulting &#x2014; VIT Chennai</p>
<p style="font-size:11px;color:#777777;margin:0 0 12px;line-height:1.5">You received this because you subscribed to our newsletter.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr><td style="border:1.5px solid #d0cec8;border-radius:50px;padding:6px 16px">
<a href="${escapeHtml(unsubUrl)}" style="color:#888888;text-decoration:none;font-size:11px;font-weight:600">Unsubscribe</a>
</td></tr>
</table>
</td></tr>

</table></td></tr></table>
</body></html>`;
}


function eventMailEmailHtml(title: string, description: string, siteUrl: string, subscriberEmail?: string, hasPdf?: boolean, imageUrl?: string): string {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const unsubUrl = subscriberEmail
    ? `https://180dcvitc.org/unsubscribe?email=${encodeURIComponent(subscriberEmail)}`
    : "https://180dcvitc.org/unsubscribe";
  const fullImageUrl = imageUrl ? `https://180dcvitc.org${imageUrl}` : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">

<!-- HEADER -->
<tr><td style="background:#1a1a1a;padding:28px 24px 20px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="52" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#8dc63f;font-size:26px;margin:0;font-weight:600;text-shadow:2px 2px 0 rgba(0,0,0,0.15)">180 Degrees Consulting</h1>
<p style="color:#ffffff;font-size:12px;margin:4px 0 0;font-weight:700;text-transform:uppercase;letter-spacing:2px">VIT Chennai</p>
</td></tr>

<!-- GREETING -->
<tr><td style="padding:28px 32px 0">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 4px;font-weight:700">Hey there! &#x1F44B;</p>
<p style="font-size:13px;color:#777777;margin:0 0 20px;line-height:1.5">We've got an exciting event coming up. Here are the details!</p>
</td></tr>

<!-- EVENT LABEL -->
<tr><td style="padding:0 32px">
<table cellpadding="0" cellspacing="0" style="margin:0 0 6px">
<tr><td style="background:#e85d2c;border-radius:4px;padding:3px 10px">
<span style="font-size:10px;color:#ffffff;font-weight:800;text-transform:uppercase;letter-spacing:1.5px">Upcoming Event</span>
</td></tr>
</table>
</td></tr>

<!-- TITLE -->
<tr><td style="padding:0 32px">
<h2 style="font-size:22px;color:#1a1a1a;margin:0 0 14px;line-height:1.4;font-weight:800">${safeTitle}</h2>
</td></tr>

<!-- DESCRIPTION -->
${safeDesc ? `<tr><td style="padding:0 32px">
<p style="font-size:14px;color:#555555;margin:0 0 24px;line-height:1.7">${safeDesc}</p>
</td></tr>` : ""}

<!-- INLINE IMAGE POSTER -->
${fullImageUrl ? `<tr><td style="padding:0 32px">
<img src="${fullImageUrl}" alt="Event Poster" style="width:100%;border-radius:12px;border:2px solid #e8e6e1;margin:0 0 24px;display:block" />
</td></tr>` : ""}

<!-- PDF ATTACHMENT NOTICE -->
${hasPdf ? `<tr><td style="padding:0 32px">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f8f5;border:2px dashed #d0cec8;border-radius:12px;margin:0 0 24px">
<tr><td style="padding:16px 20px;text-align:center">
<p style="font-size:13px;color:#1a1a1a;margin:0 0 4px;font-weight:700">&#x1F4CE; PDF Attached</p>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">Event details are attached as a PDF. Download it for easy reference!</p>
</td></tr>
</table>
</td></tr>` : ""}

<!-- CTA BUTTON -->
<tr><td style="padding:0 32px 28px;text-align:center">
<table cellpadding="0" cellspacing="0" style="background:#e85d2c;border-radius:50px;border:3px solid #1a1a1a;box-shadow:3px 3px 0 #1a1a1a;margin:0 auto">
<tr><td style="padding:12px 32px;text-align:center">
<a href="${escapeHtml(siteUrl)}" style="color:#ffffff;text-decoration:none;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Learn More</a>
</td></tr>
</table>
</td></tr>

<!-- DIVIDER -->
<tr><td style="padding:0 32px">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="border-bottom:2px solid #e8e6e1"></td>
</tr></table>
</td></tr>

<!-- SOCIAL LINKS -->
<tr><td style="padding:24px 32px 0;text-align:center">
<p style="font-size:11px;color:#777777;margin:0 0 12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">Follow Us</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr>
<td style="padding:0 8px">
<a href="https://www.instagram.com/180dc.vitc/" style="text-decoration:none;display:inline-block">
<table cellpadding="0" cellspacing="0"><tr>
<td style="background:#1a1a1a;border-radius:8px;padding:8px 14px;text-align:center">
<span style="font-size:11px;color:#ffffff;font-weight:700;text-decoration:none">Instagram</span>
</td></tr></table>
</a>
</td>
<td style="padding:0 8px">
<a href="https://www.linkedin.com/company/180-degrees-consulting-vit-chennai/" style="text-decoration:none;display:inline-block">
<table cellpadding="0" cellspacing="0"><tr>
<td style="background:#1a1a1a;border-radius:8px;padding:8px 14px;text-align:center">
<span style="font-size:11px;color:#ffffff;font-weight:700;text-decoration:none">LinkedIn</span>
</td></tr></table>
</a>
</td>
</tr>
</table>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#f9f8f5;border-top:3px solid #1a1a1a;border-radius:0 0 13px 13px;padding:20px 32px;text-align:center">
<p style="font-size:12px;color:#1a1a1a;margin:0 0 4px;font-weight:700">180 Degrees Consulting &#x2014; VIT Chennai</p>
<p style="font-size:11px;color:#777777;margin:0 0 12px;line-height:1.5">You received this because you subscribed to 180DC updates.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr><td style="border:1.5px solid #d0cec8;border-radius:50px;padding:6px 16px">
<a href="${escapeHtml(unsubUrl)}" style="color:#888888;text-decoration:none;font-size:11px;font-weight:600">Unsubscribe</a>
</td></tr>
</table>
</td></tr>

</table></td></tr></table>
</body></html>`;
}
function sendWelcomeEmail(apiKey: string, email: string) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">

<!-- HEADER -->
<tr><td style="background:#8dc63f;padding:28px 24px 20px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="52" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:26px;margin:0;font-weight:600;text-shadow:2px 2px 0 rgba(0,0,0,0.12)">180 Degrees Consulting</h1>
<p style="color:#1a1a1a;font-size:12px;margin:4px 0 0;font-weight:700;text-transform:uppercase;letter-spacing:2px">VIT Chennai</p>
</td></tr>

<!-- CONTENT -->
<tr><td style="padding:28px 32px 0">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 4px;font-weight:700">Welcome aboard! &#x1F389;</p>
<p style="font-size:13px;color:#777777;margin:0 0 20px;line-height:1.5">You're now part of the 180DC family.</p>
</td></tr>

<tr><td style="padding:0 32px">
<p style="font-size:14px;color:#555555;margin:0 0 16px;line-height:1.7">Thank you for subscribing to the 180DC newsletter. You'll now receive our latest updates, insights, and event announcements directly in your inbox.</p>
<p style="font-size:14px;color:#555555;margin:0 0 24px;line-height:1.7">Stay tuned for our upcoming newsletters packed with case studies, industry insights, and opportunities to grow.</p>
</td></tr>

<!-- CTA BUTTON -->
<tr><td style="padding:0 32px 28px;text-align:center">
<table cellpadding="0" cellspacing="0" style="background:#8dc63f;border-radius:50px;border:3px solid #1a1a1a;box-shadow:3px 3px 0 #1a1a1a;margin:0 auto">
<tr><td style="padding:12px 32px;text-align:center">
<a href="https://180dcvitc.org" style="color:#1a1a1a;text-decoration:none;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Visit Our Website</a>
</td></tr>
</table>
</td></tr>

<!-- DIVIDER -->
<tr><td style="padding:0 32px">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="border-bottom:2px solid #e8e6e1"></td>
</tr></table>
</td></tr>

<!-- SOCIAL LINKS -->
<tr><td style="padding:24px 32px 0;text-align:center">
<p style="font-size:11px;color:#777777;margin:0 0 12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">Follow Us</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr>
<td style="padding:0 8px">
<a href="https://www.instagram.com/180dc.vitc/" style="text-decoration:none;display:inline-block">
<table cellpadding="0" cellspacing="0"><tr>
<td style="background:#1a1a1a;border-radius:8px;padding:8px 14px;text-align:center">
<span style="font-size:11px;color:#ffffff;font-weight:700;text-decoration:none">Instagram</span>
</td></tr></table>
</a>
</td>
<td style="padding:0 8px">
<a href="https://www.linkedin.com/company/180-degrees-consulting-vit-chennai/" style="text-decoration:none;display:inline-block">
<table cellpadding="0" cellspacing="0"><tr>
<td style="background:#1a1a1a;border-radius:8px;padding:8px 14px;text-align:center">
<span style="font-size:11px;color:#ffffff;font-weight:700;text-decoration:none">LinkedIn</span>
</td></tr></table>
</a>
</td>
</tr>
</table>
</td></tr>

<!-- FOOTER -->
<tr><td style="background:#f9f8f5;border-top:3px solid #1a1a1a;border-radius:0 0 13px 13px;padding:20px 32px;text-align:center">
<p style="font-size:12px;color:#1a1a1a;margin:0 0 4px;font-weight:700">180 Degrees Consulting &#x2014; VIT Chennai</p>
<p style="font-size:11px;color:#777777;margin:0 0 12px;line-height:1.5">You received this because you subscribed to our newsletter.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr><td style="border:1.5px solid #d0cec8;border-radius:50px;padding:6px 16px">
<a href="https://180dcvitc.org/unsubscribe?email=${encodeURIComponent(email)}" style="color:#888888;text-decoration:none;font-size:11px;font-weight:600">Unsubscribe</a>
</td></tr>
</table>
</td></tr>

</table></td></tr></table>
</body></html>`;
  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "180DC Newsletter <team@180dcvitc.org>", to: email, subject: "Welcome to the 180DC Newsletter!", html }),
  }).catch(() => {});
}

function sendWelcomeBackEmail(apiKey: string, email: string) {
  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:28px 24px 20px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="52" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:26px;margin:0;font-weight:600;text-shadow:2px 2px 0 rgba(0,0,0,0.12)">180 Degrees Consulting</h1>
<p style="color:#1a1a1a;font-size:12px;margin:4px 0 0;font-weight:700;text-transform:uppercase;letter-spacing:2px">VIT Chennai</p>
</td></tr>
<tr><td style="padding:28px 32px 0">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 4px;font-weight:700">Welcome back! &#x1F44B;</p>
<p style="font-size:13px;color:#777777;margin:0 0 20px;line-height:1.5">Good to have you again.</p>
</td></tr>
<tr><td style="padding:0 32px">
<p style="font-size:14px;color:#555555;margin:0 0 24px;line-height:1.7">You've been re-subscribed to the 180DC newsletter. You'll continue receiving our latest updates and insights in your inbox.</p>
</td></tr>
<tr><td style="padding:0 32px">
<table width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="border-bottom:2px solid #e8e6e1"></td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 32px 0;text-align:center">
<p style="font-size:11px;color:#777777;margin:0 0 12px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">Follow Us</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr>
<td style="padding:0 8px"><a href="https://www.instagram.com/180dc.vitc/" style="text-decoration:none"><table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;border-radius:8px;padding:8px 14px;text-align:center"><span style="font-size:11px;color:#ffffff;font-weight:700">Instagram</span></td></tr></table></a></td>
<td style="padding:0 8px"><a href="https://www.linkedin.com/company/180-degrees-consulting-vit-chennai/" style="text-decoration:none"><table cellpadding="0" cellspacing="0"><tr><td style="background:#1a1a1a;border-radius:8px;padding:8px 14px;text-align:center"><span style="font-size:11px;color:#ffffff;font-weight:700">LinkedIn</span></td></tr></table></a></td>
</tr>
</table>
</td></tr>
<tr><td style="background:#f9f8f5;border-top:3px solid #1a1a1a;border-radius:0 0 13px 13px;padding:20px 32px;text-align:center">
<p style="font-size:12px;color:#1a1a1a;margin:0 0 4px;font-weight:700">180 Degrees Consulting &#x2014; VIT Chennai</p>
<p style="font-size:11px;color:#777777;margin:0 0 12px;line-height:1.5">You received this because you subscribed to our newsletter.</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr><td style="border:1.5px solid #d0cec8;border-radius:50px;padding:6px 16px">
<a href="https://180dcvitc.org/unsubscribe?email=${encodeURIComponent(email)}" style="color:#888888;text-decoration:none;font-size:11px;font-weight:600">Unsubscribe</a>
</td></tr>
</table>
</td></tr>
</table></td></tr></table>
</body></html>`;
  fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "180DC Newsletter <team@180dcvitc.org>", to: email, subject: "Welcome back to the 180DC Newsletter!", html }),
  }).catch(() => {});
}

// Public: Subscribe to newsletter (called from /subscriber after the email is
// verified through Clerk Google sign-in, so the address is trusted)
app.post("/api/newsletter/subscribe", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "newsletter_subscribe", 5, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);
    const body = await c.req.json();
    const email = validateEmail(body?.email);
    if (!email) return c.json({ error: "Valid email address required" }, 400);

    const existing = await c.env.DB.prepare("SELECT id, active FROM newsletter_subscribers WHERE email = ?").bind(email).first();
    if (existing) {
      if (existing.active === 1) return c.json({ success: true, message: "You are already subscribed!" });
      await c.env.DB.prepare("UPDATE newsletter_subscribers SET active = 1, subscribed_at = CURRENT_TIMESTAMP, unsubscribed_at = NULL WHERE id = ?").bind(existing.id).run();
      const apiKey = c.env.RESEND_API_KEY;
      if (apiKey) sendWelcomeBackEmail(apiKey, email);
      return c.json({ success: true, message: "Welcome back! You have been re-subscribed." });
    }

    await c.env.DB.prepare("INSERT INTO newsletter_subscribers (id, email, active) VALUES (?, ?, 1)").bind(crypto.randomUUID(), email).run();

    const apiKey = c.env.RESEND_API_KEY;
    if (apiKey) sendWelcomeEmail(apiKey, email);

    return c.json({ success: true, message: "Successfully subscribed to the newsletter!" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Public: Unsubscribe
app.get("/api/newsletter/unsubscribe", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const email = c.req.query("email");
    if (!email || !validateEmail(email)) return c.json({ error: "Invalid email address." }, 400);

    const sub = await c.env.DB.prepare("SELECT id, active FROM newsletter_subscribers WHERE email = ?").bind(email).first();
    if (!sub) {
      return c.json({ success: true, status: "not_found", message: "This email is not subscribed to our newsletter." });
    }
    if (sub.active === 0) {
      return c.json({ success: true, status: "already", message: "You have already unsubscribed from the 180DC newsletter." });
    }

    await c.env.DB.prepare("UPDATE newsletter_subscribers SET active = 0, unsubscribed_at = CURRENT_TIMESTAMP WHERE id = ?").bind(sub.id).run();
    return c.json({ success: true, status: "unsubscribed", message: "You have been unsubscribed from the 180DC newsletter." });
  } catch (e: any) {
    return c.json({ error: "Something went wrong." }, 500);
  }
});

// Public: List published newsletters (landing page)
app.get("/api/newsletter", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "content_newsletter", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const rows = await c.env.DB.prepare("SELECT id, title, description, image_url, source_file_url, created_at FROM newsletters ORDER BY created_at DESC LIMIT 10").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Public: Get subscriber count
app.get("/api/newsletter/subscribers/count", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const row = await c.env.DB.prepare("SELECT COUNT(*) as count FROM newsletter_subscribers WHERE active = 1").first();
    return c.json({ success: true, count: row?.count || 0 });
  } catch (e: any) {
    return c.json({ count: 0 });
  }
});

// Admin: List all newsletters
app.get("/api/newsletter/admin", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rows = await c.env.DB.prepare("SELECT * FROM newsletters ORDER BY created_at DESC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Admin: List subscribers
app.get("/api/newsletter/admin/subscribers", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rows = await c.env.DB.prepare("SELECT id, email, active, subscribed_at, unsubscribed_at FROM newsletter_subscribers ORDER BY subscribed_at DESC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Admin: Upload newsletter source PDF/IMG
app.post("/api/newsletter/upload-source", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: Board only" }, 403);
    const rl = await checkRateLimit(c, "newsletter_upload", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);

    const fd = await c.req.formData();
    const file = fd.get("file");
    if (!file || typeof file === "string") return c.json({ error: "No file provided" }, 400);

    const typedFile = file as File;
    const ext = typedFile.name.split(".").pop()?.toLowerCase();
    const allowedExts = ["pdf", "docx", "jpg", "jpeg", "png", "webp", "gif"];
    if (!ext || !allowedExts.includes(ext)) {
      return c.json({ error: "Invalid file type. Allowed: pdf, docx, jpg, png, webp, gif" }, 400);
    }
    if (typedFile.size > MAX_DOC_SIZE) {
      return c.json({ error: "File too large. Max 20 MB" }, 400);
    }

    const key = `source/${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await typedFile.arrayBuffer();
    await c.env.CASE_STUDIES.put(key, arrayBuffer, {
      httpMetadata: { contentType: typedFile.type },
    });

    const url = `/api/case-studies/images/${key}`;
    return c.json({ success: true, url, key });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Admin: Create / update newsletter
app.post("/api/newsletter", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: Board only" }, 403);
    const body = await c.req.json();
    const title = sanitizeStr(body.title);
    if (!title) return c.json({ error: "Title is required" }, 400);

    const id = body.id || crypto.randomUUID();
    const description = sanitizeStr(body.description, 1000);
    const content = sanitizeStr(body.content, 50000);
    const sourceFileUrl = sanitizeStr(body.sourceFileUrl);
    const imageUrl = sanitizeStr(body.imageUrl);

    const existing = await c.env.DB.prepare("SELECT id FROM newsletters WHERE id = ?").bind(id).first();
    if (existing) {
      await c.env.DB.prepare("UPDATE newsletters SET title = ?, description = ?, content = ?, source_file_url = COALESCE(?, source_file_url), image_url = COALESCE(?, image_url) WHERE id = ?")
        .bind(title, description, content, sourceFileUrl || null, imageUrl || null, id).run();
    } else {
      await c.env.DB.prepare("INSERT INTO newsletters (id, title, description, content, source_file_url, image_url, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .bind(id, title, description, content, sourceFileUrl || null, imageUrl || null, user.email).run();
    }

    return c.json({ success: true, id });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Admin: Delete newsletter
app.delete("/api/newsletter/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: Board only" }, 403);
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM newsletters WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Admin: Send newsletter to all active subscribers
app.post("/api/newsletter/send", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: Board only" }, 403);
    const rl = await checkRateLimit(c, "newsletter_send", 5, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);

    const apiKey = c.env.RESEND_API_KEY;
    if (!apiKey) return c.json({ error: "Email not configured" }, 500);

    const body = await c.req.json();
    const newsletterId = body.newsletterId;
    if (!newsletterId) return c.json({ error: "newsletterId required" }, 400);

    const newsletter = await c.env.DB.prepare("SELECT * FROM newsletters WHERE id = ?").bind(newsletterId).first();
    if (!newsletter) return c.json({ error: "Newsletter not found" }, 404);

    const currentCount = await getTodayEmailCount(c.env.DB);
    if (currentCount >= 100) {
      return c.json({ error: "Daily email quota reached (100). Try again after 24 hours." }, 429);
    }

    const subscribers = await c.env.DB.prepare("SELECT email FROM newsletter_subscribers WHERE active = 1").all();
    const recipients = (subscribers.results || []).map((s: any) => s.email);
    if (recipients.length === 0) return c.json({ error: "No active subscribers" }, 400);

    let sentCount = 0;
    const siteUrl = "https://180dcvitc.org/#newsletter";

    let pdfAttachment: any = null;
    if (newsletter.source_file_url) {
      const r2Key = newsletter.source_file_url.replace(/^\/api\/case-studies\/images\//, "");
      const r2Obj = await c.env.CASE_STUDIES.get(r2Key);
      if (r2Obj) {
        const buf = await r2Obj.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        pdfAttachment = { filename: r2Key.split("/").pop() || "newsletter.pdf", content: b64 };
      }
    }

    const html = newsletterEmailHtml(newsletter.title, newsletter.description || "", siteUrl, undefined, !!pdfAttachment);

    for (const email of recipients) {
      if (currentCount + sentCount >= 100) break;
      try {
        const payload: any = {
          from: "180DC Newsletter <team@180dcvitc.org>",
          to: email,
          subject: newsletter.title,
          html,
        };
        if (pdfAttachment) payload.attachments = [pdfAttachment];
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) sentCount++;
        await new Promise((r) => setTimeout(r, 550));
      } catch (err: any) {
        console.error("[newsletter] Failed to send to " + email + ": " + err.message);
      }
    }

    for (let i = 0; i < sentCount; i++) await incrementEmailCount(c.env.DB);

    await c.env.DB.prepare("UPDATE newsletters SET sent_at = CURRENT_TIMESTAMP, recipient_count = ? WHERE id = ?")
      .bind(sentCount, newsletterId).run();

    return c.json({ success: true, sentCount, total: recipients.length });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// NEWSLETTER EDITOR (OTP-BASED, SEPARATE FROM MEMBERS)
// ---------------------------------------------------------

function otpEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:28px 24px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="56" style="margin-bottom:8px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:28px;margin:0;font-weight:600;text-shadow:2px 2px 0 rgba(0,0,0,0.15)">180 Degrees Consulting</h1>
<p style="color:#1a1a1a;font-size:13px;margin:4px 0 0;font-weight:700;text-transform:uppercase;letter-spacing:2px">VIT Chennai</p>
</td></tr>
<tr><td style="padding:28px 28px 20px">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;font-weight:600">Hey!</p>
<p style="font-size:14px;color:#555555;margin:0 0 20px;line-height:1.6">Your one-time password for the Newsletter Editor. It expires in 5 minutes.</p>
<div style="background:#f5f3ee;border:3px solid #1a1a1a;border-radius:12px;padding:16px 20px;margin:0 0 20px;text-align:center">
<p style="font-size:11px;color:#777777;margin:0 0 8px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px">Your OTP</p>
<code style="font-size:28px;font-weight:800;color:#1a1a1a;letter-spacing:6px;font-family:monospace">${escapeHtml(otp)}</code>
</div>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">Didn't request this? You can safely ignore this email.</p>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:16px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting Ã¢â‚¬â€ VIT Chennai</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function verifyNewsletterSession(c: any): Promise<string | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const row = await c.env.DB.prepare(
    "SELECT email, expires_at FROM newsletter_sessions WHERE id = ?"
  ).bind(token).first();
  if (!row) return null;
  if (new Date(row.expires_at as string) < new Date()) {
    await c.env.DB.prepare("DELETE FROM newsletter_sessions WHERE id = ?").bind(token).run();
    return null;
  }
  return row.email as string;
}

// OTP: Send code to authorized email
app.post("/api/newsletter-editor/otp/send", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const body = await c.req.json();
    const email = validateEmail(body.email);
    if (!email) return c.json({ error: "Valid email required" }, 400);

    const rl = await checkRateLimit(c, "newsletter_otp_send", 5, 300);
    if (!rl.allowed) return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);

    const authorized = await c.env.DB.prepare(
      "SELECT email FROM newsletter_authorized_emails WHERE email = ?"
    ).bind(email).first();
    if (!authorized) {
      const member = await c.env.DB.prepare(
        "SELECT email FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ? AND r.power_level != 30"
      ).bind(email).first();
      if (!member) return c.json({ error: "Email not authorized for newsletter editor" }, 403);
    }

    const code = generateOtp();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    await c.env.DB.prepare(
      "INSERT INTO newsletter_otp_codes (id, email, code, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(id, email, code, expiresAt).run();

    const apiKey = c.env.RESEND_API_KEY;
    if (apiKey) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "180DC Newsletter <team@180dcvitc.org>",
          to: email,
          subject: "Your Newsletter Editor OTP",
          html: otpEmailHtml(code),
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error("[newsletter-editor] OTP email failed:", res.status, errBody);
        return c.json({ error: "Failed to send OTP email" }, 500);
      }
    } else {
      console.warn("[newsletter-editor] RESEND_API_KEY not set, OTP:", code);
    }

    return c.json({ success: true, message: "OTP sent to " + email });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// OTP: Verify code and return session token
app.post("/api/newsletter-editor/otp/verify", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const body = await c.req.json();
    const email = validateEmail(body.email);
    const code = sanitizeStr(body.code, 10);
    if (!email || !code) return c.json({ error: "Email and code required" }, 400);

    const rl = await checkRateLimit(c, "newsletter_otp_verify", 10, 300);
    if (!rl.allowed) return c.json({ error: "Too many attempts. Try again later.", retryAfter: rl.retryAfter }, 429);

    const row = await c.env.DB.prepare(
      "SELECT id, code, expires_at, used FROM newsletter_otp_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(email).first();
    if (!row) return c.json({ error: "No OTP found. Request a new one." }, 400);
    if (row.used) return c.json({ error: "OTP already used. Request a new one." }, 400);
    if (new Date(row.expires_at as string) < new Date()) return c.json({ error: "OTP expired. Request a new one." }, 400);
    if (row.code !== code) return c.json({ error: "Invalid OTP" }, 400);

    await c.env.DB.prepare("UPDATE newsletter_otp_codes SET used = 1 WHERE id = ?").bind(row.id).run();

    const sessionId = crypto.randomUUID();
    const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      "INSERT INTO newsletter_sessions (id, email, expires_at) VALUES (?, ?, ?)"
    ).bind(sessionId, email, sessionExpires).run();

    return c.json({ success: true, token: sessionId, email });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Logout
app.post("/api/newsletter-editor/logout", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      await c.env.DB.prepare("DELETE FROM newsletter_sessions WHERE id = ?").bind(authHeader.slice(7)).run();
    }
    return c.json({ success: true });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Check session
app.get("/api/newsletter-editor/me", async (c) => {
  try {
    const email = await verifyNewsletterSession(c);
    if (!email) return c.json({ error: "Not authenticated" }, 401);
    return c.json({ success: true, email });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Draft: List
app.get("/api/newsletter-editor/drafts", async (c) => {
  try {
    const email = await verifyNewsletterSession(c);
    if (!email) return c.json({ error: "Not authenticated" }, 401);
    const rows = await c.env.DB.prepare(
      "SELECT * FROM newsletters WHERE created_by = ? ORDER BY created_at DESC"
    ).bind(email).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Draft: Create / Update
app.post("/api/newsletter-editor/drafts", async (c) => {
  try {
    const email = await verifyNewsletterSession(c);
    if (!email) return c.json({ error: "Not authenticated" }, 401);
    const body = await c.req.json();
    const title = sanitizeStr(body.title);
    if (!title) return c.json({ error: "Title is required" }, 400);

    const id = body.id || crypto.randomUUID();
    const description = sanitizeStr(body.description, 1000);
    const emailSubject = sanitizeStr(body.emailSubject, 200) || title;
    const sourceFileUrl = sanitizeStr(body.sourceFileUrl);

    const existing = await c.env.DB.prepare("SELECT id FROM newsletters WHERE id = ?").bind(id).first();
    if (existing) {
      await c.env.DB.prepare(
        "UPDATE newsletters SET title = ?, description = ?, email_subject = ?, source_file_url = COALESCE(?, source_file_url) WHERE id = ?"
      ).bind(title, description, emailSubject, sourceFileUrl || null, id).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO newsletters (id, title, description, email_subject, source_file_url, created_by) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(id, title, description, emailSubject, sourceFileUrl || null, email).run();
    }
    return c.json({ success: true, id });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Draft: Delete
app.delete("/api/newsletter-editor/drafts/:id", async (c) => {
  try {
    const email = await verifyNewsletterSession(c);
    if (!email) return c.json({ error: "Not authenticated" }, 401);
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM newsletters WHERE id = ? AND created_by = ?").bind(id, email).run();
    return c.json({ success: true });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Draft: Upload source file (PDF/DOCX/IMG) to R2
app.post("/api/newsletter-editor/upload-source", async (c) => {
  try {
    const email = await verifyNewsletterSession(c);
    if (!email) return c.json({ error: "Not authenticated" }, 401);
    const rl = await checkRateLimit(c, "newsletter_editor_upload", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);

    const fd = await c.req.formData();
    const file = fd.get("file");
    if (!file || typeof file === "string") return c.json({ error: "No file provided" }, 400);
    const typedFile = file as File;
    const ext = typedFile.name.split(".").pop()?.toLowerCase();
    const allowedExts = ["pdf", "docx", "jpg", "jpeg", "png", "webp", "gif"];
    if (!ext || !allowedExts.includes(ext)) return c.json({ error: "Invalid file type. Allowed: pdf, docx, jpg, png, webp, gif" }, 400);
    if (typedFile.size > MAX_DOC_SIZE) return c.json({ error: "File too large. Max 20 MB" }, 400);

    const key = `source/${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await typedFile.arrayBuffer();
    await c.env.CASE_STUDIES.put(key, arrayBuffer, {
      httpMetadata: { contentType: typedFile.type },
    });
    const url = `/api/case-studies/images/${key}`;
    return c.json({ success: true, url, key });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Draft: Send to all active subscribers
app.post("/api/newsletter-editor/send", async (c) => {
  try {
    const email = await verifyNewsletterSession(c);
    if (!email) return c.json({ error: "Not authenticated" }, 401);

    const rl = await checkRateLimit(c, "newsletter_editor_send", 3, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);

    const apiKey = c.env.RESEND_API_KEY;
    if (!apiKey) return c.json({ error: "Email not configured" }, 500);

    const body = await c.req.json();
    const newsletterId = body.newsletterId;
    if (!newsletterId) return c.json({ error: "newsletterId required" }, 400);

    const newsletter = await c.env.DB.prepare("SELECT * FROM newsletters WHERE id = ?").bind(newsletterId).first();
    if (!newsletter) return c.json({ error: "Newsletter not found" }, 404);

    const currentCount = await getTodayEmailCount(c.env.DB);
    if (currentCount >= 100) return c.json({ error: "Daily email quota reached (100)." }, 429);

    const subscribers = await c.env.DB.prepare("SELECT email FROM newsletter_subscribers WHERE active = 1").all();
    const recipients = (subscribers.results || []).map((s: any) => s.email);
    if (recipients.length === 0) return c.json({ error: "No active subscribers" }, 400);

    let sentCount = 0;
    const siteUrl = "https://180dcvitc.org/#newsletter";

    const subject = newsletter.email_subject || newsletter.title;

    let pdfAttachment: any = null;
    if (newsletter.source_file_url) {
      const r2Key = newsletter.source_file_url.replace(/^\/api\/case-studies\/images\//, "");
      const r2Obj = await c.env.CASE_STUDIES.get(r2Key);
      if (r2Obj) {
        const buf = await r2Obj.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        pdfAttachment = { filename: r2Key.split("/").pop() || "newsletter.pdf", content: b64 };
      }
    }

    for (const to of recipients) {
      if (currentCount + sentCount >= 100) break;
      try {
        const html = newsletterEmailHtml(newsletter.title, newsletter.description || "", siteUrl, to, !!pdfAttachment);
        const payload: any = {
          from: "180DC Newsletter <team@180dcvitc.org>",
          to,
          subject,
          html,
        };
        if (pdfAttachment) payload.attachments = [pdfAttachment];
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) sentCount++;
        await new Promise((r) => setTimeout(r, 550));
      } catch (err: any) {
        console.error("[newsletter-editor] Failed to send to " + to + ": " + err.message);
      }
    }

    for (let i = 0; i < sentCount; i++) await incrementEmailCount(c.env.DB);

    await c.env.DB.prepare(
      "UPDATE newsletters SET sent_at = CURRENT_TIMESTAMP, recipient_count = ? WHERE id = ?"
    ).bind(sentCount, newsletterId).run();

    return c.json({ success: true, sentCount, total: recipients.length });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// OTP Session: Send event mail to all active subscribers
app.post("/api/newsletter-editor/send-event", async (c) => {
  try {
    const email = await verifyNewsletterSession(c);
    if (!email) return c.json({ error: "Not authenticated" }, 401);

    const rl = await checkRateLimit(c, "newsletter_editor_send_event", 3, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);

    const apiKey = c.env.RESEND_API_KEY;
    if (!apiKey) return c.json({ error: "Email not configured" }, 500);

    const body = await c.req.json();
    const { subject, description } = body;
    const sourceFileUrl = sanitizeStr(body.sourceFileUrl);
    const imageUrl = sanitizeStr(body.imageUrl);
    if (!subject || !subject.trim()) return c.json({ error: "Subject is required" }, 400);

    const currentCount = await getTodayEmailCount(c.env.DB);
    if (currentCount >= 100) return c.json({ error: "Daily email quota reached (100)." }, 429);

    const subscribers = await c.env.DB.prepare("SELECT email FROM newsletter_subscribers WHERE active = 1").all();
    const recipients = (subscribers.results || []).map((s: any) => s.email);
    if (recipients.length === 0) return c.json({ error: "No active subscribers" }, 400);

    let sentCount = 0;
    const siteUrl = "https://180dcvitc.org/#newsletter";

    let pdfAttachment: any = null;
    if (sourceFileUrl) {
      const r2Key = sourceFileUrl.replace(/^\/api\/case-studies\/images\//, "");
      const r2Obj = await c.env.CASE_STUDIES.get(r2Key);
      if (r2Obj) {
        const buf = await r2Obj.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        pdfAttachment = { filename: r2Key.split("/").pop() || "event.pdf", content: b64 };
      }
    }

    for (const to of recipients) {
      if (currentCount + sentCount >= 100) break;
      try {
        const html = eventMailEmailHtml(subject, description || "", siteUrl, to, !!pdfAttachment, imageUrl || undefined);
        const payload: any = {
          from: "180DC Events <team@180dcvitc.org>",
          to,
          subject: subject,
          html,
        };
        if (pdfAttachment) payload.attachments = [pdfAttachment];
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) sentCount++;
        await new Promise((r) => setTimeout(r, 550));
      } catch (err: any) {
        console.error("[newsletter-editor] Failed to send event mail to " + to + ": " + err.message);
      }
    }

    for (let i = 0; i < sentCount; i++) await incrementEmailCount(c.env.DB);

    return c.json({ success: true, sentCount, total: recipients.length });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});
// Admin: Manage authorized emails for newsletter editor
app.get("/api/newsletter-editor/admin/authorized-emails", async (c) => {
  try {
    requireBoard(c);
    const rows = await c.env.DB.prepare("SELECT * FROM newsletter_authorized_emails ORDER BY created_at DESC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/newsletter-editor/admin/authorized-emails", async (c) => {
  try {
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: Board only" }, 403);
    const body = await c.req.json();
    const email = validateEmail(body.email);
    if (!email) return c.json({ error: "Valid email required" }, 400);

    const existing = await c.env.DB.prepare("SELECT email FROM newsletter_authorized_emails WHERE email = ?").bind(email).first();
    if (existing) return c.json({ error: "Email already authorized" }, 409);

    await c.env.DB.prepare(
      "INSERT INTO newsletter_authorized_emails (email, added_by) VALUES (?, ?)"
    ).bind(email, user.email).run();
    return c.json({ success: true });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.delete("/api/newsletter-editor/admin/authorized-emails/:email", async (c) => {
  try {
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: Board only" }, 403);
    const email = c.req.param("email");
    await c.env.DB.prepare("DELETE FROM newsletter_authorized_emails WHERE email = ?").bind(email).run();
    return c.json({ success: true });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// 1. ADD NEW MEMBER (Only Pres / VP)
// ---------------------------------------------------------
app.post("/api/members", async (c) => {
  try {
    requireBoard(c);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const email = validateEmail(body.email);
    const name = sanitizeStr(body.name);
    const departmentId = sanitizeStr(body.departmentId) || null;
    if (!email || !name) {
      return c.json({ error: "Invalid or missing email/name" }, 400);
    }

    const rl = await checkRateLimit(c, "create_member", 10, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many member creation requests.", retryAfter: rl.retryAfter }, 429);
    }

    const insert = await c.env.DB.prepare(
      "INSERT INTO users (id, name, email, role_id, department_id) VALUES (lower(hex(randomblob(16))), ?, ?, 'member', ?)",
    )
      .bind(name, email, departmentId)
      .run();

    const token = crypto.randomUUID().replace(/-/g, "");
    const user: any = c.get("user");
    await c.env.DB.prepare("DELETE FROM admin_tokens WHERE email = ?").bind(email).run();
    await c.env.DB.prepare(
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, 'member', ?)",
    ).bind(token, email, name, user.id).run();

    await addAuditLog(c, "member_added", "user", null, "Added " + email + " as member");

    await sendTokenEmail(c, email, token, name);

    return c.json({
      success: true,
      message: "Added " + email + " as a General Member.",
      token,
    }, 200, { "Cache-Control": "private, no-store" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// Developer token login (dev only) - maps token -> email via ADMIN_TOKENS
// ADMIN_TOKENS example: { "token123": { "email": "admin@vitstudent.ac.in", "roleId": "chairperson", "name": "Admin" } }
// This returns the mapped email so the frontend can use it as the dev identity.
app.post("/api/dev-login", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    if (c.env.ENVIRONMENT === "production") {
      return c.json({ error: "Not available in production" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }

    const rl = await checkLoginRateLimit(c, "dev_login", 10, 60);
    if (!rl.allowed) {
      return c.json({ error: "Too many login attempts. Try again later.", retryAfter: rl.retryAfter }, 429);
    }

    const token = body.token;
    if (!token) {
      await incrementLoginRateLimit(c, "dev_login");
      return c.json({ error: "Missing token" }, 400);
    }

    const entry: any = await c.env.DB.prepare(
      "SELECT token, email, name, role_id, revoked_at, expires_at FROM admin_tokens WHERE token = ?",
    )
      .bind(token)
      .first();

    if (!entry || entry.revoked_at || (entry.expires_at && new Date(entry.expires_at + "Z") <= new Date())) {
      await incrementLoginRateLimit(c, "dev_login");
      return c.json({ error: "Invalid token" }, 401);
    }

    const existing: any = await c.env.DB.prepare(
      "SELECT id FROM users WHERE email = ?",
    )
      .bind(entry.email)
      .first();
    if (!existing) {
      const roleId = entry.role_id || "member";
      await c.env.DB.prepare(
        "INSERT INTO users (id, name, email, role_id) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
      )
        .bind(entry.name || entry.email.split("@")[0], entry.email, roleId)
        .run();
    }

    const user: any = await c.env.DB.prepare(
      "SELECT u.email, u.name, u.role_id, u.department_id, r.power_level, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?",
    )
      .bind(entry.email)
      .first();

    // If user is null here, the role_id in admin_tokens doesn't match any row in roles.
    if (!user) {
      return c.json({ error: "User role misconfigured: role not found" }, 500);
    }

    await resetLoginRateLimit(c, "dev_login");

    return c.json({
      success: true,
      email: entry.email,
      name: user.name || entry.name,
      roleId: user.role_id || entry.role_id || "member",
      roleName: user.role_name || null,
      powerLevel: user.power_level ?? 10,
      departmentId: user.department_id || null,
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// FORGOT TOKEN (public Ã¢â‚¬â€ sends token to email if registered)
// ---------------------------------------------------------
app.post("/api/auth/forgot-token", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "forgot_token", 3, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const email = validateEmail(body.email);
    if (!email) {
      return c.json({ error: "Valid email is required" }, 400);
    }

    // Check quota before lookup to prevent email enumeration
    const count = await getTodayEmailCount(c.env.DB);
    if (count >= 100) {
      return c.json({ error: "Daily email quota reached. Please contact the administrator or try again after 24 hours." }, 429);
    }

    const row: any = await c.env.DB.prepare(
      "SELECT token, name, email, revoked_at, expires_at FROM admin_tokens WHERE email = ?",
    ).bind(email).first();

    if (row && !row.revoked_at && (!row.expires_at || new Date(row.expires_at + "Z") > new Date())) {
      const emailResult = await sendTokenEmail(c, email, row.token, row.name || email.split("@")[0]);
      console.log(`[forgot-token] Token found for ${email}, email sent: ${emailResult.ok}${emailResult.error ? `, error: ${emailResult.error}` : ""}`);
      await incrementEmailCount(c.env.DB);
    } else {
      console.warn(`[forgot-token] No active token found for ${email}${row ? " (token exists but revoked or expired)" : " (no token record)"}`);
    }

    return c.json({ success: true, message: "If the email is registered, your token has been sent." });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// CLERK LOGIN (public Ã¢â‚¬â€ verifies Clerk JWT, returns session)
// ---------------------------------------------------------
app.post("/api/auth/clerk-login", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkLoginRateLimit(c, "clerk_login", 20, 60);
    if (!rl.allowed) {
      return c.json({ error: "Too many login attempts. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const clerkToken = sanitizeStr(body.clerkToken, MAX_CLERK_TOKEN_LEN);
    if (!clerkToken) {
      return c.json({ error: "Missing clerkToken" }, 400);
    }

    const clerkSecret = c.env.CLERK_SECRET_KEY;
    if (!clerkSecret) {
      return c.json({ error: "Clerk not configured on server" }, 500);
    }

    const jwtPayload = await verifyToken(clerkToken, { secretKey: clerkSecret });
    const clerkUserId = jwtPayload.sub;
    if (!clerkUserId) {
      return c.json({ error: "Invalid Clerk token: missing user ID" }, 401);
    }

    // Try lookup by clerk_user_id first (already linked)
    let user: any = await c.env.DB.prepare(
      "SELECT u.*, r.power_level, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.clerk_user_id = ?",
    ).bind(clerkUserId).first();

    // If not found by clerk_user_id, try by email (auto-link)
    if (!user) {
      const email = sanitizeStr(body.email, 255);
      if (email) {
        user = await c.env.DB.prepare(
          "SELECT u.*, r.power_level, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?",
        ).bind(email).first();

        if (user) {
          await c.env.DB.prepare(
            "UPDATE users SET clerk_user_id = ?, oauth_enabled = 1 WHERE id = ?",
          ).bind(clerkUserId, user.id).run();
          user.oauth_enabled = 1;
        }
      }
    }

    if (!user) {
      return c.json({
        error: "Google login not linked to any 180DC member. Log in with a token first and enable Google login in your profile settings.",
      }, 403);
    }

    if (!user.oauth_enabled) {
      return c.json({
        error: "Google login is disabled for this account. Enable it in your profile settings.",
      }, 403);
    }

    // Create or reuse an admin token for this session
    const existingToken: any = await c.env.DB.prepare(
      "SELECT token FROM admin_tokens WHERE email = ? AND revoked_at IS NULL",
    ).bind(user.email).first();

    let sessionToken: string;
    if (existingToken) {
      sessionToken = existingToken.token;
    } else {
      sessionToken = crypto.randomUUID().replace(/-/g, "");
      await c.env.DB.prepare(
        "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)",
      ).bind(sessionToken, user.email, user.name, user.role_id, user.id).run();
    }

    return c.json({
      success: true,
      token: sessionToken,
      email: user.email,
      name: user.name,
      roleId: user.role_id || "member",
      roleName: user.role_name || null,
      powerLevel: user.power_level ?? 10,
      departmentId: user.department_id || null,
    });
  } catch (e: any) {
    if (e.message?.includes("JWT") || e.message?.includes("token")) {
      return c.json({ error: "Invalid or expired Clerk token" }, 401);
    }
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// LINK CLERK (authenticated Ã¢â‚¬â€ links Clerk user ID to member)
// ---------------------------------------------------------
app.post("/api/auth/link-clerk", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "link_clerk", 5, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const user: any = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const clerkUserId = sanitizeStr(body.clerkUserId);
    if (!clerkUserId) {
      return c.json({ error: "Missing clerkUserId" }, 400);
    }

    await c.env.DB.prepare(
      "UPDATE users SET clerk_user_id = ?, oauth_enabled = 1 WHERE id = ?",
    ).bind(clerkUserId, user.id).run();

    await addAuditLog(c, "clerk_linked", "user", user.id, "Clerk account linked for " + user.email);

    return c.json({ success: true, message: "Google login enabled successfully" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// UNLINK CLERK (authenticated Ã¢â‚¬â€ disconnects Google login)
// ---------------------------------------------------------
app.post("/api/auth/unlink-clerk", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "unlink_clerk", 5, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const user: any = c.get("user");
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await c.env.DB.prepare(
      "UPDATE users SET clerk_user_id = NULL, oauth_enabled = 0 WHERE id = ?",
    ).bind(user.id).run();

    await addAuditLog(c, "clerk_unlinked", "user", user.id, "Clerk account unlinked for " + user.email);

    return c.json({ success: true, message: "Google login disabled" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// TOKEN ROTATION (any authenticated user can rotate their own token)
// ---------------------------------------------------------
app.post("/api/auth/rotate-token", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const rl = await checkRateLimit(c, "rotate_token", 3, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many token rotations. You can only rotate 3 times per hour. Please try again later.", retryAfter: rl.retryAfter }, 429);
    }
    await c.env.DB.prepare("DELETE FROM admin_tokens WHERE email = ?").bind(user.email).run();
    const newToken = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)",
    ).bind(newToken, user.email, user.name, user.role_id, user.id).run();
    await addAuditLog(c, "token_rotated", "admin_token", user.email, "Token rotated for " + user.email);
    await sendTokenEmail(c, user.email, newToken, user.name);
    return c.json({ success: true, token: newToken }, 200, { "Cache-Control": "private, no-store" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// DASHBOARD BOOTSTRAP (single server payload for the members page)
// ---------------------------------------------------------
app.get("/api/dashboard", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "dashboard", 30, 60);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");

    const pendingRequests =
      user.power_level >= 100
        ? await c.env.DB.prepare(
            "SELECT * FROM signup_requests WHERE status = 'pending' ORDER BY created_at DESC",
          ).all()
        : { results: [] };

    const adminTokens =
      user.power_level >= 100
        ? await c.env.DB.prepare(
            "SELECT t.token, t.email, t.name, COALESCE(r.name, t.role_id) as role_id, t.created_by, t.created_at, t.revoked_at FROM admin_tokens t LEFT JOIN users u ON t.email = u.email LEFT JOIN roles r ON u.role_id = r.id ORDER BY t.created_at DESC",
          ).all()
        : { results: [] };

    const maskedTokens = (adminTokens.results || []).map((t: any) => ({
      tokenPreview: maskToken(t.token),
      email: t.email, name: t.name, role_id: t.role_id,
      created_by: t.created_by, created_at: t.created_at, revoked_at: t.revoked_at,
    }));

    // Dashboard stats
    const [{ count: membersCount }]: any = await c.env.DB.prepare("SELECT COUNT(*) as count FROM users").all().then((r: any) => r.results);
    const [{ count: projectsCount }]: any = await c.env.DB.prepare("SELECT COUNT(*) as count FROM projects WHERE status != 'completed'").all().then((r: any) => r.results);
    
    // Upcoming meets (total count)
    const [{ count: clubMeetsCount }]: any = await c.env.DB.prepare("SELECT COUNT(*) as count FROM club_meets WHERE scheduled_at > CURRENT_TIMESTAMP").all().then((r: any) => r.results);
    const [{ count: deptMeetsCount }]: any = await c.env.DB.prepare("SELECT COUNT(*) as count FROM department_meets WHERE scheduled_at > CURRENT_TIMESTAMP AND (department_id = ? OR ? >= 100)").bind(user.department_id || "", user.power_level).all().then((r: any) => r.results);
    const [{ count: interMeetsCount }]: any = await c.env.DB.prepare("SELECT COUNT(*) as count FROM inter_dept_meets WHERE scheduled_at > CURRENT_TIMESTAMP AND (',' || departments || ',' LIKE '%,' || ? || ',%' OR ? >= 100)").bind(user.department_id || "", user.power_level).all().then((r: any) => r.results);
    
    const totalUpcomingMeets = (clubMeetsCount || 0) + (deptMeetsCount || 0) + (interMeetsCount || 0);

    // Recent meets for preview
    const deptId = user.department_id || "";
    const clubMeetsRecent = await c.env.DB.prepare("SELECT 'club' as type, title, scheduled_at, meet_link FROM club_meets WHERE scheduled_at > CURRENT_TIMESTAMP").all().then((r: any) => r.results || []);
    const deptMeetsRecent = await c.env.DB.prepare("SELECT 'department' as type, title, scheduled_at, meet_link FROM department_meets WHERE scheduled_at > CURRENT_TIMESTAMP AND (department_id = ? OR ? >= 100)").bind(deptId, user.power_level).all().then((r: any) => r.results || []);
    const interMeetsRecent = await c.env.DB.prepare("SELECT 'inter-department' as type, title, scheduled_at, meet_link FROM inter_dept_meets WHERE scheduled_at > CURRENT_TIMESTAMP AND (',' || departments || ',' LIKE '%,' || ? || ',%' OR ? >= 100)").bind(deptId, user.power_level).all().then((r: any) => r.results || []);
    const recentMeets = [...clubMeetsRecent, ...deptMeetsRecent, ...interMeetsRecent]
      .sort((a: any, b: any) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
      .slice(0, 3);

    // Announcements
    const announcements = await c.env.DB.prepare("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 20").all();

    return c.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        roleId: user.role_id,
        roleName: user.role_name,
        powerLevel: user.power_level,
        departmentId: user.department_id || null,
        oauthEnabled: !!user.oauth_enabled,
        clerkUserId: user.clerk_user_id || null,
      },
      stats: {
        membersCount,
        projectsCount,
        upcomingMeetsCount: totalUpcomingMeets,
        announcementsCount: (announcements.results || []).length,
        todayEmailCount: await getTodayEmailCount(c.env.DB),
      },
      recentMeets,
      pendingRequests: pendingRequests.results || [],
      adminTokens: maskedTokens,
      roleTransfers: (await c.env.DB.prepare(
        "SELECT rt.*, fu.name as from_name, fu.email as from_email, tu.name as to_name, tu.email as to_email, r.name as role_name FROM role_transfers rt LEFT JOIN users fu ON rt.from_user_id = fu.id LEFT JOIN users tu ON rt.to_user_id = tu.id LEFT JOIN roles r ON rt.role_id = r.id WHERE rt.status = 'pending' ORDER BY rt.created_at DESC",
      ).all()).results || [],
      departments: (await c.env.DB.prepare("SELECT id, name, description FROM departments ORDER BY name ASC").all()).results || [],
      announcements: announcements.results || [],
      flags: {
        canAccessHub: user.power_level >= 50,
        canManageBoard: user.power_level >= 100,
      },
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// ADMIN TOKENS (Custom auth registry)
// ---------------------------------------------------------
app.post("/api/admin-tokens", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rl = await checkRateLimit(c, "send_email", 10, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const email = validateEmail(body.email);
    const roleId = sanitizeStr(body.roleId) || "member";
    const name = sanitizeStr(body.name) || email?.split?.("@")?.[0] || "member";

    if (!email) {
      return c.json({ error: "Missing email" }, 400);
    }

    // Delete any existing token for this email to avoid UNIQUE constraint conflict
    await c.env.DB.prepare("DELETE FROM admin_tokens WHERE email = ?")
      .bind(email)
      .run();

    const token = crypto.randomUUID().replace(/-/g, "");
    const user: any = c.get("user");

    await c.env.DB.prepare(
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(token, email, name, roleId, user.id)
      .run();

    await addAuditLog(c, "token_created", "admin_token", null, "Token created for " + email);

    await sendTokenEmail(c, email, token, name);

    return c.json({ success: true, token, email, roleId, name }, 200, { "Cache-Control": "private, no-store" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/admin-tokens/:email", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const email = c.req.param("email");
    const row: any = await c.env.DB.prepare("SELECT email FROM admin_tokens WHERE email = ?").bind(email).first();
    if (!row) return c.json({ error: "Token not found for this email" }, 404);
    await c.env.DB.prepare(
      "DELETE FROM admin_tokens WHERE email = ?",
    )
      .bind(email)
      .run();
    await addAuditLog(c, "token_deleted", "admin_token", email, "Token deleted for " + email);
    return c.json({ success: true, message: "Token deleted permanently." });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/admin-tokens/:email/revoke", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const email = c.req.param("email");
    if (!email || typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: "Invalid email" }, 400);
    }
    const row: any = await c.env.DB.prepare("SELECT email, revoked_at FROM admin_tokens WHERE email = ?").bind(email).first();
    if (!row) return c.json({ error: "Token not found for this email" }, 404);
    if (row.revoked_at) return c.json({ error: "Token already revoked" }, 409);
    await c.env.DB.prepare("UPDATE admin_tokens SET revoked_at = datetime('now') WHERE email = ?").bind(email).run();
    await addAuditLog(c, "token_revoked", "admin_token", email, "Token revoked for " + email);
    return c.json({ success: true, message: "Token revoked." });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// BOARD USERS (Create or update a board account + issue token)
// ---------------------------------------------------------
app.post("/api/board-users", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rl = await checkRateLimit(c, "create_board_user", 10, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many board user creation requests.", retryAfter: rl.retryAfter }, 429);
    }

    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const email = validateEmail(body.email);
    const name =
      sanitizeStr(body.name) || email?.split?.("@")?.[0] || "board-member";
    const roleId = sanitizeStr(body.roleId);
    const departmentId = sanitizeStr(body.departmentId) || null;

    if (!email || !roleId) {
      return c.json({ error: "Missing email or roleId" }, 400);
    }

    const roleRow: any = await c.env.DB.prepare(
      "SELECT id, name, power_level FROM roles WHERE id = ?",
    )
      .bind(roleId)
      .first();

    if (!roleRow) {
      return c.json({ error: "Role does not exist" }, 400);
    }

    if (roleRow.power_level < 50) {
      return c.json(
        { error: "Role must be director-level or above" },
        400,
      );
    }

    const userRow: any = await c.env.DB.prepare(
      "SELECT id FROM users WHERE email = ?",
    )
      .bind(email)
      .first();

    if (userRow) {
      await c.env.DB.prepare(
        "UPDATE users SET name = ?, role_id = ?, department_id = ?, secondary_role_id = NULL WHERE email = ?",
      )
        .bind(name, roleId, departmentId, email)
        .run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO users (id, name, email, role_id, department_id) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)",
      )
        .bind(name, email, roleId, departmentId)
        .run();
    }

    // Delete any prior tokens for the same email so the latest one is authoritative.
    await c.env.DB.prepare("DELETE FROM admin_tokens WHERE email = ?")
      .bind(email)
      .run();

    const token = crypto.randomUUID().replace(/-/g, "");
    const creator: any = c.get("user");

    await c.env.DB.prepare(
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(token, email, name, roleId, creator.id)
      .run();

    await addAuditLog(c, "board_user_created", "user", null, "Board user created: " + email + " as " + roleId);

    await sendTokenEmail(c, email, token, name);

    return c.json({
      success: true,
      email,
      name,
      roleId,
      token,
    }, 200, { "Cache-Control": "private, no-store" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// 2a. CREATE ADVISORY BOARD MEMBER
// ---------------------------------------------------------
app.post("/api/advisory-members", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rl = await checkRateLimit(c, "create_advisory_member", 10, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many advisory member creation requests.", retryAfter: rl.retryAfter }, 429);
    }

    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const email = validateEmail(body.email);
    const name = sanitizeStr(body.name) || email?.split?.("@")?.[0] || "advisory-member";
    const exTitle = sanitizeStr(body.exTitle) || null;
    const memberDeptId = sanitizeStr(body.memberDeptId) || null;

    if (!email) {
      return c.json({ error: "Missing email" }, 400);
    }

    const roleRow: any = await c.env.DB.prepare("SELECT id FROM roles WHERE id = 'advisory'").first();
    if (!roleRow) {
      return c.json({ error: "Advisory role does not exist" }, 500);
    }

    const userRow: any = await c.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();

    if (userRow) {
      await c.env.DB.prepare(
        "UPDATE users SET name = ?, role_id = 'advisory', ex_title = ?, department_id = ?, secondary_role_id = NULL WHERE email = ?",
      ).bind(name, exTitle, memberDeptId, email).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO users (id, name, email, role_id, department_id, ex_title) VALUES (lower(hex(randomblob(16))), ?, ?, 'advisory', ?, ?)",
      ).bind(name, email, memberDeptId, exTitle).run();
    }

    // Delete prior token
    await c.env.DB.prepare("DELETE FROM admin_tokens WHERE email = ?").bind(email).run();

    const token = crypto.randomUUID().replace(/-/g, "");
    const creator: any = c.get("user");

    await c.env.DB.prepare(
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, 'advisory', ?)",
    ).bind(token, email, name, creator.id).run();

    await addAuditLog(c, "advisory_member_created", "user", null, "Advisory member created: " + email + " exTitle=" + (exTitle || "none"));

    await sendTokenEmail(c, email, token, name);

    return c.json({
      success: true,
      email,
      name,
      exTitle,
      token,
    }, 200, { "Cache-Control": "private, no-store" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// 2. PROMOTE / CHANGE ROLE (Board only)
// ---------------------------------------------------------
app.put("/api/members/:id/role", async (c) => {
  try {
    requireBoard(c);
    const targetUserId = c.req.param("id");
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const newRoleId = sanitizeStr(body.newRoleId);
    const departmentId = sanitizeStr(body.departmentId);
    const exTitle = sanitizeStr(body.exTitle) || null;
    if (!newRoleId) {
      return c.json({ error: "Missing newRoleId" }, 400);
    }

    await c.env.DB.prepare(
      "UPDATE users SET role_id = ?, department_id = ?, secondary_role_id = NULL, ex_title = ? WHERE id = ?",
    )
      .bind(newRoleId, departmentId || null, exTitle, targetUserId)
      .run();

    // Send role change email
    const targetUser: any = await c.env.DB.prepare("SELECT u.email, u.name, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?").bind(targetUserId).first();
    if (targetUser) {
      await sendRoleChangeEmail(c, targetUser.email, targetUser.name, targetUser.role_name);
    }

    return c.json({ success: true, message: "Role updated successfully." });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// 3. CREATE CUSTOM ROLE (Only Pres / VP, Power strictly < 100)
// ---------------------------------------------------------
app.post("/api/roles", async (c) => {
  try {
    requireBoard(c);
    const rl = await checkRateLimit(c, "create_role", 10, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const roleId = sanitizeStr(body.roleId);
    const name = sanitizeStr(body.name);
    const powerLevel = body.powerLevel;
    if (!roleId || !name || typeof powerLevel !== "number") {
      return c.json(
        { error: "Missing or invalid roleId/name/powerLevel" },
        400,
      );
    }
    if (!Number.isInteger(powerLevel) || powerLevel < 1) {
      return c.json({ error: "powerLevel must be a positive integer" }, 400);
    }
    if (powerLevel >= 100) {
      return c.json(
        {
          error:
            "Cannot create roles equal or greater than Board level (100).",
        },
        400,
      );
    }

    const user: any = c.get("user");
    await c.env.DB.prepare(
      "INSERT INTO roles (id, name, power_level, created_by) VALUES (?, ?, ?, ?)",
    )
      .bind(roleId, name, powerLevel, user.id)
      .run();

    return c.json({
      success: true,
      message: "Custom role " + name + " created.",
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// 4. LIST USERS & ROLES (for Admin Console)
// ---------------------------------------------------------
app.get("/api/users", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 50) {
      return c.json({ error: "Forbidden: Board and directors only" }, 403);
    }
    // Directors (power 50) only see members of their own department
    const baseSql = "SELECT u.id, u.name, u.email, u.role_id, u.department_id, u.ex_title, u.created_at, r.name as role_name, r.power_level FROM users u JOIN roles r ON u.role_id = r.id";
    let rows: any;
    if (user.power_level >= 100) {
      rows = await c.env.DB.prepare(baseSql + " ORDER BY u.name ASC").all();
    } else {
      if (!user.department_id) return c.json({ success: true, data: [] });
      rows = await c.env.DB.prepare(
        baseSql + " WHERE u.department_id = ? OR r.power_level >= 100 ORDER BY u.name ASC",
      ).bind(user.department_id).all();
    }
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// Export all users as CSV for download
app.get("/api/members/export", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT u.name, u.email, r.name as role_name, d.name as department_name, u.ex_title, u.created_at FROM users u JOIN roles r ON u.role_id = r.id LEFT JOIN departments d ON u.department_id = d.id ORDER BY r.power_level DESC, u.name ASC"
    ).all();

    const esc = (v: any) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    let csv = "Name,Email,Role,Department,Ex.Title,Created At\r\n";
    for (const r of (rows.results || [])) {
      csv += `${esc(r.name)},${esc(r.email)},${esc(r.role_name)},${esc(r.department_name)},${esc(r.ex_title)},${esc(r.created_at)}\r\n`;
    }

    c.header("Content-Type", "text/csv; charset=utf-8");
    c.header("Content-Disposition", 'attachment; filename="members_export.csv"');
    return c.body(csv);
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.get("/api/members-directory", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireMember(c);
    const rows = await c.env.DB.prepare(
      "SELECT u.id, u.name, u.email, u.role_id, u.department_id, r.name as role_name, r.power_level FROM users u JOIN roles r ON u.role_id = r.id ORDER BY r.power_level DESC, u.name ASC",
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.get("/api/roles", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rows = await c.env.DB.prepare("SELECT id, name, power_level FROM roles ORDER BY power_level DESC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// 5. ROLE TRANSFERS
// ---------------------------------------------------------
app.get("/api/role-transfers", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT rt.*, fu.name as from_name, fu.email as from_email, tu.name as to_name, tu.email as to_email, r.name as role_name FROM role_transfers rt JOIN users fu ON rt.from_user_id = fu.id JOIN users tu ON rt.to_user_id = tu.id JOIN roles r ON rt.role_id = r.id WHERE rt.status = 'pending' ORDER BY rt.created_at DESC",
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/role-transfers", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const fromUserId = sanitizeStr(body.fromUserId);
    const toUserId = sanitizeStr(body.toUserId);
    const roleId = sanitizeStr(body.roleId);
    if (!fromUserId || !toUserId || !roleId) {
      return c.json({ error: "Missing fromUserId, toUserId, or roleId" }, 400);
    }
    const user: any = c.get("user");
    await c.env.DB.prepare(
      "INSERT INTO role_transfers (id, from_user_id, to_user_id, role_id, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)",
    ).bind(fromUserId, toUserId, roleId, user.id).run();
    return c.json({ success: true, message: "Role transfer request created" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/role-transfers/:id/approve", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const id = c.req.param("id");
    const row: any = await c.env.DB.prepare("SELECT * FROM role_transfers WHERE id = ?").bind(id).first();
    if (!row) return c.json({ error: "Request not found" }, 404);
    if (row.status !== "pending") return c.json({ error: "Request already processed" }, 400);

    const fromPower: any = await c.env.DB.prepare(
      "SELECT power_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?",
    ).bind(row.from_user_id).first();
    const toPower: any = await c.env.DB.prepare(
      "SELECT power_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?",
    ).bind(row.to_user_id).first();
    const targetRole: any = await c.env.DB.prepare("SELECT power_level FROM roles WHERE id = ?").bind(row.role_id).first();

    if (!fromPower || !toPower || !targetRole) return c.json({ error: "User or role not found" }, 400);
    if (fromPower.power_level >= 100 || toPower.power_level >= 100) {
      return c.json({ error: "Cannot transfer Board roles" }, 400);
    }

    await c.env.DB.prepare("UPDATE users SET role_id = ? WHERE id = ?").bind(row.role_id, row.to_user_id).run();
    await c.env.DB.prepare("UPDATE users SET role_id = 'member' WHERE id = ?").bind(row.from_user_id).run();

    await c.env.DB.prepare("UPDATE role_transfers SET status = 'approved' WHERE id = ?").bind(id).run();
    await addAuditLog(c, "role_transfer_approved", "role_transfer", id, "Role transfer approved");
    return c.json({ success: true, message: "Role transfer approved and executed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/role-transfers/:id/reject", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const id = c.req.param("id");
    await c.env.DB.prepare("UPDATE role_transfers SET status = 'rejected' WHERE id = ?").bind(id).run();
    return c.json({ success: true, message: "Role transfer rejected" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// My role transfers (for involved users to see and accept/decline)
app.get("/api/my-role-transfers", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const rows = await c.env.DB.prepare(
      `SELECT rt.*, fu.name as from_name, fu.email as from_email,
        tu.name as to_name, tu.email as to_email, r.name as role_name
       FROM role_transfers rt
       JOIN users fu ON rt.from_user_id = fu.id
       JOIN users tu ON rt.to_user_id = tu.id
       JOIN roles r ON rt.role_id = r.id
       WHERE (rt.from_user_id = ? OR rt.to_user_id = ?) AND rt.status = 'pending'
       ORDER BY rt.created_at DESC`,
    ).bind(user.id, user.id).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/my-role-transfers/:id/accept", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const id = c.req.param("id");
    const row: any = await c.env.DB.prepare("SELECT * FROM role_transfers WHERE id = ?").bind(id).first();
    if (!row) return c.json({ error: "Request not found" }, 404);
    if (row.status !== "pending") return c.json({ error: "Request already processed" }, 400);
    if (user.id !== row.from_user_id && user.id !== row.to_user_id) {
      return c.json({ error: "You are not involved in this transfer" }, 403);
    }

    if (user.id === row.from_user_id) {
      await c.env.DB.prepare("UPDATE role_transfers SET from_user_accepted = 1 WHERE id = ?").bind(id).run();
    } else {
      await c.env.DB.prepare("UPDATE role_transfers SET to_user_accepted = 1 WHERE id = ?").bind(id).run();
    }

    // Check if both accepted
    const updated: any = await c.env.DB.prepare(
      "SELECT * FROM role_transfers WHERE id = ?",
    ).bind(id).first();

    if (updated.from_user_accepted && updated.to_user_accepted) {
      // Both accepted Ã¢â‚¬â€ execute the swap
      const fromPower: any = await c.env.DB.prepare(
        "SELECT power_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?",
      ).bind(row.from_user_id).first();
      const toPower: any = await c.env.DB.prepare(
        "SELECT power_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?",
      ).bind(row.to_user_id).first();
      const targetRole: any = await c.env.DB.prepare(
        "SELECT power_level FROM roles WHERE id = ?",
      ).bind(row.role_id).first();
      if (!fromPower || !toPower || !targetRole) {
        return c.json({ error: "User or role not found" }, 400);
      }
      if (fromPower.power_level >= 100 || toPower.power_level >= 100) {
        return c.json({ error: "Cannot transfer Board roles" }, 400);
      }

      await c.env.DB.prepare("UPDATE users SET role_id = ? WHERE id = ?").bind(row.role_id, row.to_user_id).run();
      await c.env.DB.prepare("UPDATE users SET role_id = 'member' WHERE id = ?").bind(row.from_user_id).run();
      await c.env.DB.prepare("UPDATE role_transfers SET status = 'approved' WHERE id = ?").bind(id).run();
      return c.json({ success: true, message: "Both accepted Ã¢â‚¬â€ roles swapped" });
    }

    return c.json({ success: true, message: "You accepted Ã¢â‚¬â€ waiting for the other party" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/my-role-transfers/:id/decline", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const id = c.req.param("id");
    const row: any = await c.env.DB.prepare("SELECT * FROM role_transfers WHERE id = ?").bind(id).first();
    if (!row) return c.json({ error: "Request not found" }, 404);
    if (row.status !== "pending") return c.json({ error: "Request already processed" }, 400);
    if (user.id !== row.from_user_id && user.id !== row.to_user_id) {
      return c.json({ error: "You are not involved in this transfer" }, 403);
    }
    await c.env.DB.prepare("UPDATE role_transfers SET status = 'rejected' WHERE id = ?").bind(id).run();
    return c.json({ success: true, message: "Transfer declined" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// 5. REMOVE MEMBER
// ---------------------------------------------------------
app.delete("/api/members/:id", async (c) => {
  try {
    requireBoard(c);
    const targetId = c.req.param("id");

    // Prevent deleting other Board members
    const targetUser = await c.env.DB.prepare(
      "SELECT power_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?",
    )
      .bind(targetId)
      .first();
    const tUserOptions: any = targetUser;

    if (tUserOptions && tUserOptions.power_level === 100) {
      return c.json(
        { error: "Cannot remove another Board member." },
        400,
      );
    }

    // Clean up related records
    const deletedUser: any = await c.env.DB.prepare(
      "SELECT email FROM users WHERE id = ?",
    ).bind(targetId).first();

    await c.env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(targetId)
      .run();

    if (deletedUser?.email) {
      await c.env.DB.prepare("DELETE FROM admin_tokens WHERE email = ?")
        .bind(deletedUser.email)
        .run();
      await c.env.DB.prepare(
        "DELETE FROM role_transfers WHERE from_user_id = ? OR to_user_id = ?",
      ).bind(targetId, targetId).run();
    }
    await addAuditLog(c, "member_removed", "user", targetId, "Member removed");
    return c.json({ success: true, message: "Member removed permanently." });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// SIGNUP REQUESTS (Public create, Admin approves)
// ---------------------------------------------------------
// 6a. Create a signup request (public - no auth required)
app.post("/api/signup-requests", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "signup_request", 5, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many signup requests. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const name = sanitizeStr(body.name);
    const email = validateEmail(body.email);
    const message = sanitizeStr(body.message, MAX_MSG_LEN);
    const departmentId = sanitizeStr(body.departmentId);

    if (!email || !name) {
      return c.json({ error: "Missing or invalid name/email" }, 400);
    }
    if (!departmentId) {
      return c.json({ error: "Department is required" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO signup_requests (id, name, email, message, department_id, status) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 'pending')",
    )
      .bind(name, email, message, departmentId)
      .run();

    return c.json({ success: true, message: "Signup request submitted." });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 6b. List pending signup requests (Admin only)
app.get("/api/signup-requests", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT * FROM signup_requests WHERE status = 'pending' ORDER BY created_at DESC",
    ).all();
    return c.json({ success: true, requests: rows });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 6c. Approve a signup request (Admin only)
app.post("/api/signup-requests/:id/approve", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const id = c.req.param("id");

    const reqRow: any = await c.env.DB.prepare(
      "SELECT * FROM signup_requests WHERE id = ?",
    )
      .bind(id)
      .first();
    if (!reqRow) return c.json({ error: "Request not found" }, 404);

    const departmentId = sanitizeStr(reqRow.department_id) || sanitizeStr((await c.req.json().catch(() => ({}))).departmentId);

    if (!departmentId) {
      return c.json({ error: "Request has no department assigned" }, 400);
    }

    // create user as general member
    await c.env.DB.prepare(
      "INSERT INTO users (id, name, email, role_id, department_id) VALUES (lower(hex(randomblob(16))), ?, ?, 'member', ?)",
    )
      .bind(reqRow.name, reqRow.email, departmentId)
      .run();

    // generate a login token for the approved user
    await c.env.DB.prepare("DELETE FROM admin_tokens WHERE email = ?")
      .bind(reqRow.email)
      .run();
    const newToken = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, 'member', ?)",
    )
      .bind(newToken, reqRow.email, reqRow.name, c.get("user").id)
      .run();

    await c.env.DB.prepare("UPDATE signup_requests SET status = ? WHERE id = ?")
      .bind("approved", id)
      .run();

    await addAuditLog(c, "signup_approved", "signup_request", id, "Approved signup for " + reqRow.email);

    await sendTokenEmail(c, reqRow.email, newToken, reqRow.name);

    return c.json({
      success: true,
      message: "Signup request approved. Token created.",
      token: newToken,
    }, 200, { "Cache-Control": "private, no-store" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 6d. Reject a signup request (Admin only)
app.post("/api/signup-requests/:id/reject", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const id = c.req.param("id");
    await c.env.DB.prepare("UPDATE signup_requests SET status = ? WHERE id = ?")
      .bind("rejected", id)
      .run();
    return c.json({ success: true, message: "Signup request rejected." });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// DEPARTMENT PAGES (Meets, Documents, Instructions, Projects)
// ---------------------------------------------------------
async function canAccessDept(c: any, deptId: string) {
  const user: any = c.get("user");
  if (user.power_level >= 100) return true;
  // Directors (power 50) can access only their own department
  if (user.power_level >= 50 && user.department_id === deptId) return true;
  throw new Error("Forbidden: you do not have access to this department");
}

// GET /api/departments/:id/overview Ã¢â‚¬â€ all department data in one call
app.get("/api/departments/:id/overview", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);

    const meets = await c.env.DB.prepare(
      "SELECT * FROM department_meets WHERE department_id = ? ORDER BY scheduled_at ASC",
    ).bind(deptId).all();

    const documents = await c.env.DB.prepare(
      "SELECT * FROM department_documents WHERE department_id = ? ORDER BY created_at DESC",
    ).bind(deptId).all();

    const instructions = await c.env.DB.prepare(
      "SELECT * FROM department_instructions WHERE department_id = ? ORDER BY created_at DESC",
    ).bind(deptId).all();

    const projects = await c.env.DB.prepare(
      "SELECT * FROM department_projects WHERE department_id = ? ORDER BY created_at DESC",
    ).bind(deptId).all();

    return c.json({
      success: true,
      departmentId: deptId,
      meets: meets.results || [],
      documents: documents.results || [],
      instructions: instructions.results || [],
      projects: projects.results || [],
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// --- MEETS ---
app.post("/api/departments/:id/meets", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const title = sanitizeStr(body.title);
    const meetLink = sanitizeStr(body.meetLink);
    const description = sanitizeStr(body.description);
    const scheduledAt = body.scheduledAt;
    if (!title || !scheduledAt) return c.json({ error: "Missing title or scheduledAt" }, 400);
    if (meetLink && !isValidUrl(meetLink)) return c.json({ error: "Invalid meet link URL" }, 400);
    const user: any = c.get("user");
    const meetId = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO department_meets (id, department_id, title, meet_link, description, scheduled_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(meetId, deptId, title, meetLink || null, description || null, scheduledAt, user.id).run();

    const recipients = await getMeetRecipients(c.env.DB, "department_meet", deptId);
    const { sent, queued } = await queueOrSendMeetEmails(c, recipients, meetId, "department_meet", title, description, meetLink, scheduledAt);

    return c.json({ success: true, message: "Meet scheduled", meetId, emailsSent: sent, emailsQueued: queued });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/departments/:id/meets/:meetId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const meetId = c.req.param("meetId");
    await c.env.DB.prepare("DELETE FROM department_meets WHERE id = ? AND department_id = ?").bind(meetId, deptId).run();
    return c.json({ success: true, message: "Meet removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// --- DOCUMENTS ---
app.post("/api/departments/:id/documents", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const title = sanitizeStr(body.title);
    const description = sanitizeStr(body.description);
    const fileUrl = sanitizeStr(body.fileUrl);
    if (!title) return c.json({ error: "Missing title" }, 400);
    if (fileUrl && !isValidUrl(fileUrl)) return c.json({ error: "Invalid file URL" }, 400);
    const user: any = c.get("user");
    await c.env.DB.prepare(
      "INSERT INTO department_documents (id, department_id, title, description, file_url, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)",
    ).bind(deptId, title, description || null, fileUrl || null, user.id).run();
    return c.json({ success: true, message: "Document added" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/departments/:id/documents/:docId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const docId = c.req.param("docId");
    await c.env.DB.prepare("DELETE FROM department_documents WHERE id = ? AND department_id = ?").bind(docId, deptId).run();
    return c.json({ success: true, message: "Document removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// --- INSTRUCTIONS ---
app.post("/api/departments/:id/instructions", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const title = sanitizeStr(body.title);
    const content = sanitizeStr(body.content);
    const priority = sanitizeStr(body.priority) || "medium";
    if (!title || !content) return c.json({ error: "Missing title or content" }, 400);
    const user: any = c.get("user");
    await c.env.DB.prepare(
      "INSERT INTO department_instructions (id, department_id, title, content, priority, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)",
    ).bind(deptId, title, content, priority, user.id).run();
    return c.json({ success: true, message: "Instruction added" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/departments/:id/instructions/:instructionId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const instructionId = c.req.param("instructionId");
    await c.env.DB.prepare("DELETE FROM department_instructions WHERE id = ? AND department_id = ?").bind(instructionId, deptId).run();
    return c.json({ success: true, message: "Instruction removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// --- PROJECTS ---
app.post("/api/departments/:id/projects", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const name = sanitizeStr(body.name);
    const description = sanitizeStr(body.description);
    const deadline = body.deadline || null;
    if (!name) return c.json({ error: "Missing project name" }, 400);
    const user: any = c.get("user");
    await c.env.DB.prepare(
      "INSERT INTO department_projects (id, department_id, name, description, deadline, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)",
    ).bind(deptId, name, description || null, deadline, user.id).run();
    return c.json({ success: true, message: "Project added" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.put("/api/departments/:id/projects/:projectId/status", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const projectId = c.req.param("projectId");
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const status = sanitizeStr(body.status) || "upcoming";
    await c.env.DB.prepare("UPDATE department_projects SET status = ? WHERE id = ? AND department_id = ?").bind(status, projectId, deptId).run();
    return c.json({ success: true, message: "Project status updated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// DEPARTMENTS LIST (for dropdowns)
// ---------------------------------------------------------
app.get("/api/departments", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "public_departments", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const rows = await c.env.DB.prepare("SELECT id, name, description FROM departments ORDER BY name ASC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.get("/api/departments/:id/members", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const rows = await c.env.DB.prepare(
      "SELECT u.id, u.name, u.email, u.role_id, r.name as role_name, r.power_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.department_id = ? ORDER BY u.name ASC",
    ).bind(deptId).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.get("/api/departments/:id/instructions", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const deptId = c.req.param("id");
    canAccessDept(c, deptId);
    const rows = await c.env.DB.prepare(
      "SELECT * FROM department_instructions WHERE department_id = ? ORDER BY created_at DESC",
    ).bind(deptId).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// CLUB-WIDE MEETS
// ---------------------------------------------------------
app.get("/api/club-meets", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rows = await c.env.DB.prepare(
      "SELECT id, title, description, scheduled_at, created_by, created_at, CASE WHEN julianday(scheduled_at) >= julianday('now', '-1 day') THEN meet_link ELSE NULL END as meet_link FROM club_meets ORDER BY scheduled_at ASC",
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/club-meets", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 50) {
      return c.json({ error: "Forbidden: Lead or above only" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const title = sanitizeStr(body.title);
    const meetLink = sanitizeStr(body.meetLink);
    const description = sanitizeStr(body.description);
    const scheduledAt = body.scheduledAt;
    if (!title || !scheduledAt) return c.json({ error: "Missing title or scheduledAt" }, 400);
    if (meetLink && !isValidUrl(meetLink)) return c.json({ error: "Invalid meet link URL" }, 400);
    const meetId = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO club_meets (id, title, meet_link, description, scheduled_at, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(meetId, title, meetLink || null, description || null, scheduledAt, user.id).run();

    const recipients = await getMeetRecipients(c.env.DB, "club_meet");
    const { sent, queued } = await queueOrSendMeetEmails(c, recipients, meetId, "club_meet", title, description, meetLink, scheduledAt);

    return c.json({ success: true, message: "Club-wide meet scheduled", meetId, emailsSent: sent, emailsQueued: queued });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/club-meets/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 50) {
      return c.json({ error: "Forbidden: Lead or above only" }, 403);
    }
    const meetId = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM club_meets WHERE id = ?").bind(meetId).run();
    return c.json({ success: true, message: "Club-wide meet removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// INTER-DEPARTMENT MEETS
// ---------------------------------------------------------
app.get("/api/inter-dept-meets", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rows = await c.env.DB.prepare(
      "SELECT id, title, description, scheduled_at, departments, created_by, created_at, CASE WHEN julianday(scheduled_at) >= julianday('now', '-1 day') THEN meet_link ELSE NULL END as meet_link FROM inter_dept_meets ORDER BY scheduled_at ASC",
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/inter-dept-meets", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 50) {
      return c.json({ error: "Forbidden: Lead or above only" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const title = sanitizeStr(body.title);
    const meetLink = sanitizeStr(body.meetLink);
    const description = sanitizeStr(body.description);
    const scheduledAt = body.scheduledAt;
    const departments = body.departments;
    if (!title || !scheduledAt || !departments) {
      return c.json({ error: "Missing title, scheduledAt, or departments" }, 400);
    }
    if (meetLink && !isValidUrl(meetLink)) return c.json({ error: "Invalid meet link URL" }, 400);
    const rawDepts = Array.isArray(departments) ? departments : departments.split(",");
    const deptArray = rawDepts.map((d: string) => String(d).trim()).filter(Boolean);
    const deptsStr = deptArray.join(",");
    if (deptArray.length === 0) return c.json({ error: "At least one department is required" }, 400);
    const meetId = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO inter_dept_meets (id, title, meet_link, description, scheduled_at, departments, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(meetId, title, meetLink || null, description || null, scheduledAt, deptsStr, user.id).run();

    const recipients = await getMeetRecipients(c.env.DB, "inter_dept_meet", undefined, deptArray);
    const { sent, queued } = await queueOrSendMeetEmails(c, recipients, meetId, "inter_dept_meet", title, description, meetLink, scheduledAt);

    return c.json({ success: true, message: "Inter-department meet scheduled", meetId, emailsSent: sent, emailsQueued: queued });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/inter-dept-meets/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 50) {
      return c.json({ error: "Forbidden: Lead or above only" }, 403);
    }
    const meetId = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM inter_dept_meets WHERE id = ?").bind(meetId).run();
    return c.json({ success: true, message: "Inter-department meet removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// MEET NOTIFICATIONS (manual send + queue processing)
// ---------------------------------------------------------
app.post("/api/meets/:type/:id/send-notification", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "meet_notification", 10, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (user.power_level < 50) return c.json({ error: "Forbidden: Lead or above only" }, 403);
    const meetType = c.req.param("type");
    const meetId = c.req.param("id");

    let row: any;
    if (meetType === "club_meet") {
      row = await c.env.DB.prepare("SELECT * FROM club_meets WHERE id = ?").bind(meetId).first();
    } else if (meetType === "department_meet") {
      row = await c.env.DB.prepare("SELECT dm.*, d.name as department_name FROM department_meets dm JOIN departments d ON dm.department_id = d.id WHERE dm.id = ?").bind(meetId).first();
    } else if (meetType === "inter_dept_meet") {
      row = await c.env.DB.prepare("SELECT * FROM inter_dept_meets WHERE id = ?").bind(meetId).first();
    } else {
      return c.json({ error: "Invalid meet type" }, 400);
    }
    if (!row) return c.json({ error: "Meet not found" }, 404);

    // Department-scoped meets: verify user has access to the department
    if (meetType === "department_meet" && user.power_level < 100 && user.department_id !== row.department_id) {
      return c.json({ error: "Forbidden: you do not have access to this department's meets" }, 403);
    }

    let recipients: { email: string; name: string }[] = [];
    if (meetType === "department_meet") {
      recipients = await getMeetRecipients(c.env.DB, "department_meet", row.department_id);
    } else if (meetType === "club_meet") {
      recipients = await getMeetRecipients(c.env.DB, "club_meet");
    } else if (meetType === "inter_dept_meet") {
      const depts = (row.departments || "").split(",").filter(Boolean);
      recipients = await getMeetRecipients(c.env.DB, "inter_dept_meet", undefined, depts);
    }

    const { sent, queued } = await queueOrSendMeetEmails(c, recipients, meetId, meetType, row.title, row.description, row.meet_link, row.scheduled_at);
    return c.json({ success: true, emailsSent: sent, emailsQueued: queued });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/meets/process-queue", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 100) return c.json({ error: "Forbidden: Board only" }, 403);

    let count = await getTodayEmailCount(c.env.DB);
    const MAX_DAILY = 100;
    let sent = 0;

    const pending: any = await c.env.DB.prepare("SELECT * FROM pending_emails ORDER BY created_at ASC LIMIT ?").bind(MAX_DAILY - count).all();
    for (const p of (pending.results || [])) {
      if (count >= MAX_DAILY) break;
      await sendMeetEmail(c, p.recipient_email, p.recipient_name, p.meet_title, p.meet_description, p.meet_link, p.scheduled_at, p.meet_type);
      await incrementEmailCount(c.env.DB);
      await c.env.DB.prepare("DELETE FROM pending_emails WHERE id = ?").bind(p.id).run();
      count++;
      sent++;
    }

    return c.json({ success: true, emailsSent: sent });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// DEPARTMENT MEETS (read-only for all authenticated users)
// ---------------------------------------------------------
app.get("/api/department-meets", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    let rows: any;
    if (user.power_level >= 100) {
      rows = await c.env.DB.prepare(
        "SELECT dm.id, dm.department_id, dm.title, dm.description, dm.scheduled_at, dm.created_by, dm.created_at, CASE WHEN julianday(dm.scheduled_at) >= julianday('now', '-1 day') THEN dm.meet_link ELSE NULL END as meet_link, d.name as department_name FROM department_meets dm JOIN departments d ON dm.department_id = d.id ORDER BY dm.scheduled_at ASC",
      ).all();
    } else if (user.department_id) {
      rows = await c.env.DB.prepare(
        "SELECT dm.id, dm.department_id, dm.title, dm.description, dm.scheduled_at, dm.created_by, dm.created_at, CASE WHEN julianday(dm.scheduled_at) >= julianday('now', '-1 day') THEN dm.meet_link ELSE NULL END as meet_link, d.name as department_name FROM department_meets dm JOIN departments d ON dm.department_id = d.id WHERE dm.department_id = ? ORDER BY dm.scheduled_at ASC",
      ).bind(user.department_id).all();
    } else {
      rows = { results: [] };
    }
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// ANNOUNCEMENTS
// ---------------------------------------------------------
app.get("/api/announcements", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rows = await c.env.DB.prepare("SELECT * FROM announcements ORDER BY created_at DESC").all();
    const user: any = c.get("user");
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/announcements", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: Board only" }, 403);
    }
    const rl = await checkRateLimit(c, "create_announcement", 5, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many announcements. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const title = sanitizeStr(body.title)?.replace(/<[^>]*>/g, "");
    const content = sanitizeStr(body.content)?.replace(/<[^>]*>/g, "");
    if (!title || !content) return c.json({ error: "Missing title or content" }, 400);
    await c.env.DB.prepare(
      "INSERT INTO announcements (id, title, content, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
    ).bind(title, content, user.id).run();
    return c.json({ success: true, message: "Announcement posted" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/announcements/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: Board only" }, 403);
    }
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM announcements WHERE id = ?").bind(id).run();
    return c.json({ success: true, message: "Announcement removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// PROJECTS (board creates, all view, leads assign roles)
// ---------------------------------------------------------
function canManageProject(c: any) {
  const user: any = c.get("user");
  if (user.power_level >= 100) return true;
  if (user.power_level >= 50 && user.department_id) return true;
  throw new Error("Forbidden: cannot manage project roles");
}

app.get("/api/projects", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");

    let projects;
    if (user.power_level >= 100 || !user.department_id) {
      projects = await c.env.DB.prepare(
        "SELECT p.* FROM projects p ORDER BY p.created_at DESC",
      ).all();
    } else {
      projects = await c.env.DB.prepare(
        "SELECT p.* FROM projects p JOIN project_departments pd ON p.id = pd.project_id WHERE pd.department_id = ? ORDER BY p.created_at DESC",
      ).bind(user.department_id).all();
    }

    const results = [];
    for (const proj of (projects.results || [])) {
      const depts = await c.env.DB.prepare(
        "SELECT d.id, d.name FROM project_departments pd JOIN departments d ON pd.department_id = d.id WHERE pd.project_id = ?",
      ).bind(proj.id).all();

      const roles = await c.env.DB.prepare(
        "SELECT pr.id, pr.user_id, pr.role_name, u.name as user_name, u.email as user_email FROM project_roles pr JOIN users u ON pr.user_id = u.id WHERE pr.project_id = ? ORDER BY pr.created_at ASC",
      ).bind(proj.id).all();

      results.push({
        ...proj,
        departments: depts.results || [],
        roles: roles.results || [],
      });
    }
    return c.json({ success: true, data: results });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/projects", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: Board only" }, 403);
    }
    const rl = await checkRateLimit(c, "create_project", 10, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many projects. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const name = sanitizeStr(body.name);
    const description = sanitizeStr(body.description, MAX_PROJECT_DESC_LEN);
    const companyOrg = sanitizeStr(body.companyOrg);
    const yearInput = sanitizeStr(body.year) || null;
    const deadline = body.deadline || null;
    const departmentIds = body.departmentIds;
    if (!name) return c.json({ error: "Missing project name" }, 400);
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
      return c.json({ error: "Select at least one department" }, 400);
    }
    const sanitizedDeptIds = departmentIds.map((d: any) => String(d).trim()).filter(Boolean);
    if (sanitizedDeptIds.length === 0) return c.json({ error: "Invalid department selection" }, 400);
    if (!yearInput && !deadline) {
      return c.json({ error: "Provide either a year or a deadline date" }, 400);
    }

    // If deadline is provided, derive academic year from it (takes precedence over manual year)
    let year = yearInput;
    if (deadline) {
      const d = new Date(deadline);
      if (isNaN(d.getTime())) {
        return c.json({ error: "Invalid deadline date" }, 400);
      }
      const y = d.getFullYear();
      year = `${y}-${y + 1}`;
    }

    const projectId = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO projects (id, name, description, company_org, year, deadline, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(projectId, name, description || null, companyOrg || null, year, deadline, user.id).run();

    for (const deptId of sanitizedDeptIds) {
      await c.env.DB.prepare(
        "INSERT OR IGNORE INTO project_departments (project_id, department_id) VALUES (?, ?)",
      ).bind(projectId, deptId).run();
    }

    await sendProjectAssignmentEmail(c, name, sanitizedDeptIds);

    return c.json({ success: true, message: "Project created", projectId });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/projects/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: Board only" }, 403);
    }
    const id = c.req.param("id");
    const proj: any = await c.env.DB.prepare("SELECT status FROM projects WHERE id = ?").bind(id).first();
    await c.env.DB.prepare("DELETE FROM project_departments WHERE project_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM project_roles WHERE project_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM project_tasks WHERE project_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
    if (proj?.status === "completed") {
      try { await regenerateCompletedProjectsJson(c.env.DB, c.env.BLOG_IMAGES); } catch {}
    }
    return c.json({ success: true, message: "Project removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// Project role assignments
app.post("/api/projects/:id/roles", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const projectId = c.req.param("id");
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const userId = sanitizeStr(body.userId);
    const roleName = sanitizeStr(body.roleName);
    if (!userId || !roleName) return c.json({ error: "Missing userId or roleName" }, 400);

    // Check project exists and user has access
    const project: any = await c.env.DB.prepare("SELECT id FROM projects WHERE id = ?").bind(projectId).first();
    if (!project) return c.json({ error: "Project not found" }, 404);

    // Board can always assign; leads can only assign if their dept is on the project
    if (user.power_level < 100) {
      if (user.power_level < 50 || !user.department_id) {
        return c.json({ error: "Forbidden" }, 403);
      }
      const deptCheck: any = await c.env.DB.prepare(
        "SELECT 1 FROM project_departments WHERE project_id = ? AND department_id = ?",
      ).bind(projectId, user.department_id).first();
      if (!deptCheck) return c.json({ error: "Your department is not assigned to this project" }, 403);
    }

    await c.env.DB.prepare(
      "INSERT INTO project_roles (id, project_id, user_id, role_name, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)",
    ).bind(projectId, userId, roleName, user.id).run();

    // Send role assignment email
    const assignedUser: any = await c.env.DB.prepare("SELECT email, name FROM users WHERE id = ?").bind(userId).first();
    const proj: any = await c.env.DB.prepare("SELECT name FROM projects WHERE id = ?").bind(projectId).first();
    if (assignedUser && proj) {
      await sendRoleAssignmentEmail(c, assignedUser.email, assignedUser.name, roleName, proj.name);
    }

    return c.json({ success: true, message: "Role assigned" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/projects/:id/roles/:roleId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const projectId = c.req.param("id");
    const roleId = c.req.param("roleId");
    if (user.power_level < 100) {
      if (user.power_level < 50 || !user.department_id) {
        return c.json({ error: "Forbidden" }, 403);
      }
      const deptCheck: any = await c.env.DB.prepare(
        "SELECT 1 FROM project_departments WHERE project_id = ? AND department_id = ?",
      ).bind(projectId, user.department_id).first();
      if (!deptCheck) return c.json({ error: "Your department is not assigned to this project" }, 403);
    }
    await c.env.DB.prepare("DELETE FROM project_roles WHERE id = ? AND project_id = ?").bind(roleId, projectId).run();
    return c.json({ success: true, message: "Role removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// PROJECT TASKS
// ---------------------------------------------------------
async function canManageProjectTasks(c: any, projectId: string) {
  const user: any = c.get("user");
  if (user.power_level >= 100) return true;
  if (user.power_level >= 50 && user.department_id) {
    const deptCheck: any = await c.env.DB.prepare(
      "SELECT 1 FROM project_departments WHERE project_id = ? AND department_id = ?",
    ).bind(projectId, user.department_id).first();
    if (deptCheck) return true;
  }
  throw new Error("Forbidden: cannot manage tasks for this project");
}

app.get("/api/projects/:id/tasks", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const projectId = c.req.param("id");
    const rows = await c.env.DB.prepare(
      "SELECT pt.*, u.name as assigned_name FROM project_tasks pt LEFT JOIN users u ON pt.assigned_to = u.id WHERE pt.project_id = ? ORDER BY pt.created_at ASC",
    ).bind(projectId).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/projects/:id/tasks", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const projectId = c.req.param("id");
    const user: any = c.get("user");
    await canManageProjectTasks(c, projectId);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const title = sanitizeStr(body.title);
    const description = sanitizeStr(body.description);
    const assignedTo = sanitizeStr(body.assignedTo);
    if (!title) return c.json({ error: "Missing task title" }, 400);
    await c.env.DB.prepare(
      "INSERT INTO project_tasks (id, project_id, title, description, assigned_to, status, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, 'pending', ?)",
    ).bind(projectId, title, description || null, assignedTo || null, user.id).run();
    return c.json({ success: true, message: "Task created" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.put("/api/projects/:id/tasks/:taskId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const projectId = c.req.param("id");
    const taskId = c.req.param("taskId");
    const user: any = c.get("user");
    await canManageProjectTasks(c, projectId);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const status = sanitizeStr(body.status);
    if (!status || !["pending", "completed"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }
    if (status === "completed") {
      await c.env.DB.prepare("UPDATE project_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ? AND project_id = ?").bind(taskId, projectId).run();
    } else {
      await c.env.DB.prepare("UPDATE project_tasks SET status = 'pending', completed_at = NULL WHERE id = ? AND project_id = ?").bind(taskId, projectId).run();
    }
    return c.json({ success: true, message: "Task updated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/projects/:id/tasks/complete-all", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const projectId = c.req.param("id");
    const user: any = c.get("user");
    await canManageProjectTasks(c, projectId);
    await c.env.DB.prepare("UPDATE project_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE project_id = ? AND status = 'pending'").bind(projectId).run();
    return c.json({ success: true, message: "All tasks completed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬ Completed projects static JSON generation (XSS-safe) Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// When a project is completed or reopened, we regenerate a static JSON
// blob with all HTML-escaped text fields and write it to R2 so the
// frontend can load it without querying the database.

function escapeForJson(val: unknown): string {
  if (typeof val !== "string") return "";
  return val
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function regenerateCompletedProjectsJson(db: any, r2: R2Bucket): Promise<void> {
  const rows = await db.prepare(
    "SELECT id, name, description, company_org, deadline, created_at FROM projects WHERE status = 'completed' ORDER BY created_at DESC",
  ).all();
  const data = (rows.results || []).map((p: any) => ({
    id: p.id,
    name: escapeForJson(p.name),
    description: escapeForJson(p.description || ""),
    company_org: escapeForJson(p.company_org || ""),
    deadline: p.deadline || null,
    created_at: p.created_at,
  }));
  const json = JSON.stringify(data);
  await r2.put("static/completedProjects.json", json, {
    httpMetadata: { contentType: "application/json", cacheControl: "public, max-age=300" },
  });
}

app.post("/api/projects/:id/complete", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const projectId = c.req.param("id");
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: Board only" }, 403);
    }
    await c.env.DB.prepare("UPDATE projects SET status = 'completed' WHERE id = ?").bind(projectId).run();
    try { await regenerateCompletedProjectsJson(c.env.DB, c.env.BLOG_IMAGES); } catch {}
    return c.json({ success: true, message: "Project marked as complete" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/projects/:id/reopen", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const projectId = c.req.param("id");
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: Board only" }, 403);
    }
    await c.env.DB.prepare("UPDATE projects SET status = 'upcoming' WHERE id = ?").bind(projectId).run();
    try { await regenerateCompletedProjectsJson(c.env.DB, c.env.BLOG_IMAGES); } catch {}
    return c.json({ success: true, message: "Project reopened" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// Public endpoint Ã¢â‚¬â€ returns completed projects (no auth required)
// Reads from R2 static JSON for fast loading; falls back to DB if R2 misses.
app.get("/api/projects/completed", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "public_completed_projects", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);

    const obj = await c.env.BLOG_IMAGES.get("static/completedProjects.json");
    if (obj) {
      const text = await obj.text();
      c.header("Cache-Control", "public, max-age=300");
      return c.json({ success: true, data: JSON.parse(text) });
    }

    const projects = await c.env.DB.prepare(
      "SELECT id, name, description, company_org, deadline, created_at FROM projects WHERE status = 'completed' ORDER BY created_at DESC",
    ).all();
    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    return c.json({ success: true, data: projects.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Manual trigger — regenerate static JSON (board only)
app.post("/api/projects/regenerate-completed", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 100) return c.json({ error: "Forbidden" }, 403);
    await regenerateCompletedProjectsJson(c.env.DB, c.env.BLOG_IMAGES);
    return c.json({ success: true, message: "Completed projects JSON regenerated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// TEAM INSTANCES (events / case comps / applications split into teams)
// ---------------------------------------------------------

// Board can always manage; directors manage instances their department belongs to
async function canManageInstanceTeams(c: any, instanceId: string) {
  const user: any = c.get("user");
  if (user.power_level >= 100) return true;
  if (user.power_level >= 50 && user.department_id) {
    const check: any = await c.env.DB.prepare(
      "SELECT 1 FROM instance_departments WHERE instance_id = ? AND department_id = ?",
    ).bind(instanceId, user.department_id).first();
    if (check) return true;
  }
  return false;
}

// Audit details always embed the instance id so the per-instance activity feed
// can still find rows whose target (a team or group) has since been deleted.
function instanceDetail(instanceId: string, text: string | null) {
  return text ? `${text} in instance ${instanceId}` : `in instance ${instanceId}`;
}

// Replace an instance's level list. `names` may be shorter than `count`; the
// gaps fall back to "Level N" when read back out.
async function writeInstanceLevels(c: any, instanceId: string, count: number, names: string[]) {
  await c.env.DB.prepare("DELETE FROM instance_levels WHERE instance_id = ?").bind(instanceId).run();
  for (let i = 1; i <= count; i++) {
    const name = sanitizeStr(names[i - 1], 60) || `Level ${i}`;
    await c.env.DB.prepare(
      "INSERT INTO instance_levels (id, instance_id, position, name) VALUES (?, ?, ?, ?)",
    ).bind(crypto.randomUUID().replace(/-/g, ""), instanceId, i, name).run();
  }
}

// Parse a levelCount payload value. Returns null when absent, throws-ish via
// the `error` field when invalid.
function parseLevelCount(raw: any): { value?: number; error?: string } {
  if (raw === undefined || raw === null || raw === "") return {};
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 20) return { error: "levelCount must be a whole number between 1 and 20" };
  return { value: n };
}

// Bulk-load the full instance tree (instance -> group -> team -> members).
// Deliberately a fixed number of queries: the previous implementation issued one
// query per team on top of three per instance, which reached ~80 sequential D1
// round-trips for a modest number of instances.
async function loadInstanceTree(c: any, onlyInstanceId?: string) {
  const db = c.env.DB;

  const instanceRows = onlyInstanceId
    ? await db.prepare(
        "SELECT ti.*, u.name as created_by_name FROM team_instances ti LEFT JOIN users u ON ti.created_by = u.id WHERE ti.id = ?",
      ).bind(onlyInstanceId).all()
    : await db.prepare(
        "SELECT ti.*, u.name as created_by_name FROM team_instances ti LEFT JOIN users u ON ti.created_by = u.id ORDER BY ti.created_at DESC",
      ).all();

  const instances: any[] = instanceRows.results || [];
  if (instances.length === 0) return [];

  const instanceIds = instances.map((i: any) => i.id);
  const iph = instanceIds.map(() => "?").join(",");

  const [deptRows, groupRows, teamRows, externalRows, levelRows] = await Promise.all([
    db.prepare(
      `SELECT id2.instance_id, d.id, d.name FROM instance_departments id2 JOIN departments d ON id2.department_id = d.id WHERE id2.instance_id IN (${iph})`,
    ).bind(...instanceIds).all(),
    db.prepare(
      `SELECT * FROM instance_groups WHERE instance_id IN (${iph}) ORDER BY sort_order ASC, created_at ASC`,
    ).bind(...instanceIds).all(),
    db.prepare(
      `SELECT * FROM instance_teams WHERE instance_id IN (${iph}) ORDER BY sort_order ASC, created_at ASC`,
    ).bind(...instanceIds).all(),
    db.prepare(
      `SELECT * FROM instance_external_members WHERE instance_id IN (${iph}) ORDER BY name ASC`,
    ).bind(...instanceIds).all(),
    db.prepare(
      `SELECT * FROM instance_levels WHERE instance_id IN (${iph}) ORDER BY position ASC`,
    ).bind(...instanceIds).all(),
  ]);

  const teams: any[] = teamRows.results || [];
  const teamIds = teams.map((t: any) => t.id);

  let internalRows: any[] = [];
  let externalLinkRows: any[] = [];
  if (teamIds.length > 0) {
    const tph = teamIds.map(() => "?").join(",");
    const [im, el] = await Promise.all([
      db.prepare(
        `SELECT tm.team_id, tm.user_id, tm.added_by, u.name as user_name, u.email as user_email, u.department_id as user_department_id, r.name as user_role_name FROM instance_team_members tm JOIN users u ON tm.user_id = u.id LEFT JOIN roles r ON u.role_id = r.id WHERE tm.team_id IN (${tph}) ORDER BY tm.created_at ASC`,
      ).bind(...teamIds).all(),
      db.prepare(
        `SELECT te.team_id, te.external_id, te.added_by, em.name, em.email, em.organization FROM instance_team_external_members te JOIN instance_external_members em ON te.external_id = em.id WHERE te.team_id IN (${tph}) ORDER BY te.created_at ASC`,
      ).bind(...teamIds).all(),
    ]);
    internalRows = im.results || [];
    externalLinkRows = el.results || [];
  }

  const membersByTeam = new Map<string, any[]>();
  for (const t of teams) membersByTeam.set(t.id, []);
  for (const m of internalRows) {
    membersByTeam.get(m.team_id)?.push({
      kind: "internal",
      user_id: m.user_id,
      added_by: m.added_by,
      user_name: m.user_name,
      user_email: m.user_email,
      user_department_id: m.user_department_id,
      user_role_name: m.user_role_name,
    });
  }
  for (const m of externalLinkRows) {
    membersByTeam.get(m.team_id)?.push({
      kind: "external",
      external_id: m.external_id,
      added_by: m.added_by,
      name: m.name,
      email: m.email,
      organization: m.organization,
    });
  }

  function buildTeam(team: any) {
    const members = membersByTeam.get(team.id) || [];
    const memberCount = members.length;
    const min = team.min_members != null ? team.min_members : null;
    const max = team.member_limit != null ? team.member_limit : null;
    return {
      ...team,
      current_level: team.current_level && team.current_level > 0 ? team.current_level : 1,
      status: team.status || "active",
      members,
      member_count: memberCount,
      internal_count: members.filter((m: any) => m.kind === "internal").length,
      external_count: members.filter((m: any) => m.kind === "external").length,
      requirement_met: min == null ? true : memberCount >= min,
      is_full: max != null && memberCount >= max,
    };
  }

  const deptsByInstance = new Map<string, any[]>();
  for (const d of (deptRows.results || []) as any[]) {
    if (!deptsByInstance.has(d.instance_id)) deptsByInstance.set(d.instance_id, []);
    deptsByInstance.get(d.instance_id)!.push({ id: d.id, name: d.name });
  }
  const externalsByInstance = new Map<string, any[]>();
  for (const e of (externalRows.results || []) as any[]) {
    if (!externalsByInstance.has(e.instance_id)) externalsByInstance.set(e.instance_id, []);
    externalsByInstance.get(e.instance_id)!.push(e);
  }
  const levelsByInstance = new Map<string, any[]>();
  for (const l of (levelRows.results || []) as any[]) {
    if (!levelsByInstance.has(l.instance_id)) levelsByInstance.set(l.instance_id, []);
    levelsByInstance.get(l.instance_id)!.push(l);
  }
  const groupsByInstance = new Map<string, any[]>();
  for (const g of (groupRows.results || []) as any[]) {
    if (!groupsByInstance.has(g.instance_id)) groupsByInstance.set(g.instance_id, []);
    groupsByInstance.get(g.instance_id)!.push(g);
  }
  const teamsByInstance = new Map<string, any[]>();
  for (const t of teams) {
    if (!teamsByInstance.has(t.instance_id)) teamsByInstance.set(t.instance_id, []);
    teamsByInstance.get(t.instance_id)!.push(buildTeam(t));
  }

  return instances.map((inst: any) => {
    const instTeams = teamsByInstance.get(inst.id) || [];
    const byGroup = new Map<string, any[]>();
    const ungrouped: any[] = [];
    for (const t of instTeams) {
      if (t.group_id) {
        if (!byGroup.has(t.group_id)) byGroup.set(t.group_id, []);
        byGroup.get(t.group_id)!.push(t);
      } else {
        ungrouped.push(t);
      }
    }
    const groups = (groupsByInstance.get(inst.id) || []).map((g: any) => {
      const gTeams = byGroup.get(g.id) || [];
      return {
        ...g,
        teams: gTeams,
        stats: {
          team_count: gTeams.length,
          member_count: gTeams.reduce((n: number, t: any) => n + t.member_count, 0),
          understaffed_count: gTeams.filter((t: any) => !t.requirement_met).length,
        },
      };
    });
    // A team whose group_id points at a deleted group would otherwise vanish.
    const knownGroupIds = new Set(groups.map((g: any) => g.id));
    for (const t of instTeams) {
      if (t.group_id && !knownGroupIds.has(t.group_id)) ungrouped.push(t);
    }

    return {
      ...inst,
      group_label: inst.group_label || "Company",
      level_count: inst.level_count && inst.level_count > 0 ? inst.level_count : 1,
      // Named levels when they exist, otherwise synthesised "Level N" entries so
      // the UI always has something to render columns from.
      levels: (() => {
        const stored = levelsByInstance.get(inst.id) || [];
        const count = inst.level_count && inst.level_count > 0 ? inst.level_count : 1;
        const out = [];
        for (let i = 1; i <= count; i++) {
          const match = stored.find((l: any) => l.position === i);
          out.push({ position: i, name: match ? match.name : `Level ${i}` });
        }
        return out;
      })(),
      departments: deptsByInstance.get(inst.id) || [],
      externals: externalsByInstance.get(inst.id) || [],
      groups,
      ungrouped_teams: ungrouped,
      stats: {
        group_count: groups.length,
        team_count: instTeams.length,
        member_count: instTeams.reduce((n: number, t: any) => n + t.member_count, 0),
        internal_count: instTeams.reduce((n: number, t: any) => n + t.internal_count, 0),
        external_count: instTeams.reduce((n: number, t: any) => n + t.external_count, 0),
        understaffed_count: instTeams.filter((t: any) => !t.requirement_met).length,
        active_count: instTeams.filter((t: any) => (t.status || "active") === "active").length,
        eliminated_count: instTeams.filter((t: any) => t.status === "eliminated").length,
      },
    };
  });
}

// Combined internal + external headcount for a team.
async function teamMemberCount(c: any, teamId: string): Promise<number> {
  const internal: any = await c.env.DB.prepare("SELECT COUNT(*) as n FROM instance_team_members WHERE team_id = ?").bind(teamId).first();
  const external: any = await c.env.DB.prepare("SELECT COUNT(*) as n FROM instance_team_external_members WHERE team_id = ?").bind(teamId).first();
  return (internal?.n || 0) + (external?.n || 0);
}

app.get("/api/team-instances", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.role_id === "advisory") {
      return c.json({ error: "Advisory members do not have access to team instances" }, 403);
    }
    return c.json({ success: true, data: await loadInstanceTree(c) });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/team-instances", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.power_level < 50) {
      return c.json({ error: "Forbidden: Directors and board only" }, 403);
    }
    const rl = await checkRateLimit(c, "create_team_instance", 10, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many instances created. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);
    const name = sanitizeStr(body.name);
    const description = sanitizeStr(body.description, MAX_PROJECT_DESC_LEN);
    const groupLabel = sanitizeStr(body.groupLabel, 40) || "Company";
    if (!name) return c.json({ error: "Missing instance name" }, 400);

    let departmentIds: string[];
    if (user.power_level >= 100) {
      if (!Array.isArray(body.departmentIds) || body.departmentIds.length === 0) {
        return c.json({ error: "Select at least one department" }, 400);
      }
      departmentIds = [...new Set(((body.departmentIds as any[]).map((d: any) => String(d).trim()).filter(Boolean) as string[]))];
    } else {
      if (!user.department_id) {
        return c.json({ error: "You are not assigned to a department" }, 403);
      }
      departmentIds = [user.department_id];
    }

    const validDepts = await c.env.DB.prepare(
      `SELECT id FROM departments WHERE id IN (${departmentIds.map(() => "?").join(",")})`,
    ).bind(...departmentIds).all();
    if ((validDepts.results || []).length !== departmentIds.length) {
      return c.json({ error: "Invalid department selection" }, 400);
    }

    const lc = parseLevelCount(body.levelCount);
    if (lc.error) return c.json({ error: lc.error }, 400);
    const levelCount = lc.value ?? 1;
    const levelNames: string[] = Array.isArray(body.levelNames) ? body.levelNames.map((n: any) => String(n)) : [];

    const instanceId = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO team_instances (id, name, description, group_label, level_count, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(instanceId, name, description || null, groupLabel, levelCount, user.id).run();
    await writeInstanceLevels(c, instanceId, levelCount, levelNames);
    for (const deptId of departmentIds) {
      await c.env.DB.prepare(
        "INSERT OR IGNORE INTO instance_departments (instance_id, department_id) VALUES (?, ?)",
      ).bind(instanceId, deptId).run();
    }
    await addAuditLog(c, "team_instance_created", "team_instance", instanceId, instanceDetail(instanceId, name));
    return c.json({ success: true, message: "Instance created", instanceId });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.put("/api/team-instances/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT id FROM team_instances WHERE id = ?").bind(instanceId).first();
    if (!existing) return c.json({ error: "Instance not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);
    const name = body.name !== undefined ? sanitizeStr(body.name) : undefined;
    const description = body.description !== undefined ? sanitizeStr(body.description, MAX_PROJECT_DESC_LEN) : undefined;
    const groupLabel = body.groupLabel !== undefined ? sanitizeStr(body.groupLabel, 40) : undefined;
    if (name !== undefined && !name) return c.json({ error: "Instance name cannot be empty" }, 400);
    if (groupLabel !== undefined && !groupLabel) return c.json({ error: "Group label cannot be empty" }, 400);
    if (name !== undefined) {
      await c.env.DB.prepare("UPDATE team_instances SET name = ? WHERE id = ?").bind(name, instanceId).run();
    }
    if (description !== undefined) {
      await c.env.DB.prepare("UPDATE team_instances SET description = ? WHERE id = ?").bind(description || null, instanceId).run();
    }
    if (groupLabel !== undefined) {
      await c.env.DB.prepare("UPDATE team_instances SET group_label = ? WHERE id = ?").bind(groupLabel, instanceId).run();
    }
    if (body.levelCount !== undefined || body.levelNames !== undefined) {
      const lc = parseLevelCount(body.levelCount);
      if (lc.error) return c.json({ error: lc.error }, 400);
      const current: any = await c.env.DB.prepare("SELECT level_count FROM team_instances WHERE id = ?").bind(instanceId).first();
      const levelCount = lc.value ?? (current?.level_count && current.level_count > 0 ? current.level_count : 1);

      // Shrinking the ladder would strand teams above the new top level, so
      // pull them back down rather than leaving them unreachable.
      await c.env.DB.prepare("UPDATE instance_teams SET current_level = ? WHERE instance_id = ? AND current_level > ?")
        .bind(levelCount, instanceId, levelCount).run();

      const levelNames: string[] = Array.isArray(body.levelNames) ? body.levelNames.map((n: any) => String(n)) : [];
      await c.env.DB.prepare("UPDATE team_instances SET level_count = ? WHERE id = ?").bind(levelCount, instanceId).run();
      await writeInstanceLevels(c, instanceId, levelCount, levelNames);
    }
    await addAuditLog(c, "team_instance_updated", "team_instance", instanceId, instanceDetail(instanceId, name || null));
    return c.json({ success: true, message: "Instance updated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/team-instances/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT id FROM team_instances WHERE id = ?").bind(instanceId).first();
    if (!existing) return c.json({ error: "Instance not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const teams = await c.env.DB.prepare("SELECT id FROM instance_teams WHERE instance_id = ?").bind(instanceId).all();
    for (const team of (teams.results || []) as any[]) {
      await c.env.DB.prepare("DELETE FROM instance_team_members WHERE team_id = ?").bind(team.id).run();
      await c.env.DB.prepare("DELETE FROM instance_team_external_members WHERE team_id = ?").bind(team.id).run();
    }
    await c.env.DB.prepare("DELETE FROM instance_teams WHERE instance_id = ?").bind(instanceId).run();
    await c.env.DB.prepare("DELETE FROM instance_groups WHERE instance_id = ?").bind(instanceId).run();
    await c.env.DB.prepare("DELETE FROM instance_levels WHERE instance_id = ?").bind(instanceId).run();
    await c.env.DB.prepare("DELETE FROM instance_external_members WHERE instance_id = ?").bind(instanceId).run();
    await c.env.DB.prepare("DELETE FROM instance_departments WHERE instance_id = ?").bind(instanceId).run();
    await c.env.DB.prepare("DELETE FROM team_instances WHERE id = ?").bind(instanceId).run();
    await addAuditLog(c, "team_instance_deleted", "team_instance", instanceId, instanceDetail(instanceId, null));
    return c.json({ success: true, message: "Instance deleted" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// GROUPS — the classification layer between instance and team
// (a client company, a competition, or whatever `group_label` says)
// ---------------------------------------------------------

app.post("/api/team-instances/:id/groups", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const instanceId = c.req.param("id");
    const instance: any = await c.env.DB.prepare("SELECT id FROM team_instances WHERE id = ?").bind(instanceId).first();
    if (!instance) return c.json({ error: "Instance not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const rl = await checkRateLimit(c, "create_instance_group", 40, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many groups created. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);
    const name = sanitizeStr(body.name);
    if (!name) return c.json({ error: "Missing group name" }, 400);
    const organization = body.organization !== undefined ? sanitizeStr(body.organization, 200) : null;
    const description = body.description !== undefined ? sanitizeStr(body.description, MAX_PROJECT_DESC_LEN) : null;

    const maxOrder: any = await c.env.DB.prepare("SELECT MAX(sort_order) as m FROM instance_groups WHERE instance_id = ?").bind(instanceId).first();
    const groupId = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO instance_groups (id, instance_id, name, organization, description, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).bind(groupId, instanceId, name, organization, description, (maxOrder?.m ?? -1) + 1, user.id).run();
    await addAuditLog(c, "instance_group_created", "instance_group", groupId, instanceDetail(instanceId, name));
    return c.json({ success: true, message: "Group created", groupId });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.put("/api/team-instances/:id/groups/:groupId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const groupId = c.req.param("groupId");
    const group: any = await c.env.DB.prepare("SELECT * FROM instance_groups WHERE id = ? AND instance_id = ?").bind(groupId, instanceId).first();
    if (!group) return c.json({ error: "Group not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);

    const name = body.name !== undefined ? sanitizeStr(body.name) : undefined;
    if (name !== undefined && !name) return c.json({ error: "Group name cannot be empty" }, 400);
    if (name !== undefined) {
      await c.env.DB.prepare("UPDATE instance_groups SET name = ? WHERE id = ?").bind(name, groupId).run();
    }
    if (body.organization !== undefined) {
      await c.env.DB.prepare("UPDATE instance_groups SET organization = ? WHERE id = ?").bind(sanitizeStr(body.organization, 200), groupId).run();
    }
    if (body.description !== undefined) {
      await c.env.DB.prepare("UPDATE instance_groups SET description = ? WHERE id = ?").bind(sanitizeStr(body.description, MAX_PROJECT_DESC_LEN), groupId).run();
    }
    if (body.sortOrder !== undefined) {
      const parsed = Number(body.sortOrder);
      if (!Number.isInteger(parsed) || parsed < 0) return c.json({ error: "sortOrder must be a non-negative integer" }, 400);
      await c.env.DB.prepare("UPDATE instance_groups SET sort_order = ? WHERE id = ?").bind(parsed, groupId).run();
    }
    await addAuditLog(c, "instance_group_updated", "instance_group", groupId, instanceDetail(instanceId, name || group.name));
    return c.json({ success: true, message: "Group updated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// Deleting a group does NOT delete its teams — they fall back to "Ungrouped",
// so a mis-click can never destroy team rosters.
app.delete("/api/team-instances/:id/groups/:groupId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const groupId = c.req.param("groupId");
    const group: any = await c.env.DB.prepare("SELECT * FROM instance_groups WHERE id = ? AND instance_id = ?").bind(groupId, instanceId).first();
    if (!group) return c.json({ error: "Group not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    await c.env.DB.prepare("UPDATE instance_teams SET group_id = NULL WHERE group_id = ?").bind(groupId).run();
    await c.env.DB.prepare("DELETE FROM instance_groups WHERE id = ?").bind(groupId).run();
    await addAuditLog(c, "instance_group_deleted", "instance_group", groupId, instanceDetail(instanceId, group.name));
    return c.json({ success: true, message: "Group deleted; its teams are now ungrouped" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// OUTSIDE MEMBERS — people who are not registered website users
// (other-college participants, client contacts, alumni)
// ---------------------------------------------------------

app.post("/api/team-instances/:id/externals", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const instanceId = c.req.param("id");
    const instance: any = await c.env.DB.prepare("SELECT id FROM team_instances WHERE id = ?").bind(instanceId).first();
    if (!instance) return c.json({ error: "Instance not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const rl = await checkRateLimit(c, "create_instance_external", 100, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many outside members added. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);
    const name = sanitizeStr(body.name);
    if (!name) return c.json({ error: "Missing name" }, 400);
    const organization = body.organization !== undefined ? sanitizeStr(body.organization, 200) : null;

    let email: string | null = null;
    if (body.email !== undefined && body.email !== null && String(body.email).trim() !== "") {
      email = validateEmail(body.email);
      if (!email) return c.json({ error: "Invalid email address" }, 400);
      const dupe: any = await c.env.DB.prepare(
        "SELECT name FROM instance_external_members WHERE instance_id = ? AND lower(email) = lower(?)",
      ).bind(instanceId, email).first();
      if (dupe) return c.json({ error: `${dupe.name} is already added with that email` }, 400);
    }

    const externalId = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO instance_external_members (id, instance_id, name, email, organization, created_by) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(externalId, instanceId, name, email, organization, user.id).run();
    await addAuditLog(c, "outside_member_created", "instance_external", externalId, instanceDetail(instanceId, `${name}${organization ? ` (${organization})` : ""}`));
    return c.json({ success: true, message: "Outside member added", externalId });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.put("/api/team-instances/:id/externals/:externalId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const externalId = c.req.param("externalId");
    const ext: any = await c.env.DB.prepare("SELECT * FROM instance_external_members WHERE id = ? AND instance_id = ?").bind(externalId, instanceId).first();
    if (!ext) return c.json({ error: "Outside member not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);

    const name = body.name !== undefined ? sanitizeStr(body.name) : undefined;
    if (name !== undefined && !name) return c.json({ error: "Name cannot be empty" }, 400);
    if (name !== undefined) {
      await c.env.DB.prepare("UPDATE instance_external_members SET name = ? WHERE id = ?").bind(name, externalId).run();
    }
    if (body.organization !== undefined) {
      await c.env.DB.prepare("UPDATE instance_external_members SET organization = ? WHERE id = ?").bind(sanitizeStr(body.organization, 200), externalId).run();
    }
    if (body.email !== undefined) {
      let email: string | null = null;
      if (body.email !== null && String(body.email).trim() !== "") {
        email = validateEmail(body.email);
        if (!email) return c.json({ error: "Invalid email address" }, 400);
        const dupe: any = await c.env.DB.prepare(
          "SELECT name FROM instance_external_members WHERE instance_id = ? AND lower(email) = lower(?) AND id != ?",
        ).bind(instanceId, email, externalId).first();
        if (dupe) return c.json({ error: `${dupe.name} is already added with that email` }, 400);
      }
      await c.env.DB.prepare("UPDATE instance_external_members SET email = ? WHERE id = ?").bind(email, externalId).run();
    }
    await addAuditLog(c, "outside_member_updated", "instance_external", externalId, instanceDetail(instanceId, name || ext.name));
    return c.json({ success: true, message: "Outside member updated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/team-instances/:id/externals/:externalId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const externalId = c.req.param("externalId");
    const ext: any = await c.env.DB.prepare("SELECT * FROM instance_external_members WHERE id = ? AND instance_id = ?").bind(externalId, instanceId).first();
    if (!ext) return c.json({ error: "Outside member not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    await c.env.DB.prepare("DELETE FROM instance_team_external_members WHERE external_id = ?").bind(externalId).run();
    await c.env.DB.prepare("DELETE FROM instance_external_members WHERE id = ?").bind(externalId).run();
    await addAuditLog(c, "outside_member_deleted", "instance_external", externalId, instanceDetail(instanceId, ext.name));
    return c.json({ success: true, message: "Outside member removed from the instance" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// Validate a user can be added to a team: must be registered, non-advisory,
// and (for directors) belong to the acting director's department.
async function validateTeamMemberEligibility(c: any, user: any, userId: string) {
  const target: any = await c.env.DB.prepare(
    "SELECT u.id, u.name, u.email, u.department_id, u.role_id FROM users u WHERE u.id = ?",
  ).bind(userId).first();
  if (!target) return { error: `User ${userId} is not registered on the website` };
  if (target.role_id === "advisory") return { error: "Advisory members cannot be added to teams" };
  if (user.power_level < 100) {
    if (target.department_id !== user.department_id) {
      return { error: `Directors can only add members from their own department (${target.name} is not in your department)` };
    }
  }
  return { user: target };
}

app.post("/api/team-instances/:id/teams", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const instanceId = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT id FROM team_instances WHERE id = ?").bind(instanceId).first();
    if (!existing) return c.json({ error: "Instance not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const rl = await checkRateLimit(c, "create_team", 30, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many teams created. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);
    const name = sanitizeStr(body.name);
    const description = sanitizeStr(body.description, MAX_PROJECT_DESC_LEN);
    if (!name) return c.json({ error: "Missing team name" }, 400);

    let groupId: string | null = null;
    if (body.groupId !== undefined && body.groupId !== null && String(body.groupId).trim() !== "") {
      groupId = String(body.groupId).trim();
      const group: any = await c.env.DB.prepare("SELECT id FROM instance_groups WHERE id = ? AND instance_id = ?").bind(groupId, instanceId).first();
      if (!group) return c.json({ error: "Group does not belong to this instance" }, 400);
    }

    // Parse minMembers (min required) and maxMembers (cap). `memberLimit` is
    // accepted as a legacy alias for maxMembers. "Exactly N" is min = max = N.
    let minMembers: number | null = null;
    let maxMembers: number | null = null;
    for (const [raw, label] of [[body.minMembers, "minMembers"], [body.maxMembers ?? body.memberLimit, "maxMembers"]] as [any, string][]) {
      if (raw === undefined || raw === null || raw === "") continue;
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < 1) {
        return c.json({ error: `${label} must be a positive integer` }, 400);
      }
      if (label === "minMembers") minMembers = parsed; else maxMembers = parsed;
    }
    if (minMembers !== null && maxMembers !== null && minMembers > maxMembers) {
      return c.json({ error: `minMembers (${minMembers}) cannot be greater than maxMembers (${maxMembers})` }, 400);
    }

    const memberIds: string[] = Array.isArray(body.memberIds)
      ? ([...new Set(((body.memberIds as any[]).map((m: any) => String(m).trim()).filter(Boolean) as string[]))] as string[])
      : [];
    const externalIds: string[] = Array.isArray(body.externalIds)
      ? ([...new Set(((body.externalIds as any[]).map((m: any) => String(m).trim()).filter(Boolean) as string[]))] as string[])
      : [];
    if (maxMembers !== null && memberIds.length + externalIds.length > maxMembers) {
      return c.json({ error: `Member cap is ${maxMembers} but ${memberIds.length + externalIds.length} members were selected` }, 400);
    }
    for (const memberId of memberIds) {
      const check = await validateTeamMemberEligibility(c, user, memberId);
      if (check.error) return c.json({ error: check.error }, 400);
    }
    for (const externalId of externalIds) {
      const ext: any = await c.env.DB.prepare("SELECT id FROM instance_external_members WHERE id = ? AND instance_id = ?").bind(externalId, instanceId).first();
      if (!ext) return c.json({ error: "An outside member does not belong to this instance" }, 400);
    }

    const maxOrder: any = await c.env.DB.prepare(
      "SELECT MAX(sort_order) as m FROM instance_teams WHERE instance_id = ? AND (group_id IS ? OR group_id = ?)",
    ).bind(instanceId, groupId, groupId).first();
    const teamId = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO instance_teams (id, instance_id, group_id, name, description, member_limit, min_members, sort_order, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(teamId, instanceId, groupId, name, description || null, maxMembers, minMembers, (maxOrder?.m ?? -1) + 1, user.id).run();
    for (const memberId of memberIds) {
      await c.env.DB.prepare(
        "INSERT OR IGNORE INTO instance_team_members (team_id, user_id, added_by) VALUES (?, ?, ?)",
      ).bind(teamId, memberId, user.id).run();
    }
    for (const externalId of externalIds) {
      await c.env.DB.prepare(
        "INSERT OR IGNORE INTO instance_team_external_members (team_id, external_id, added_by) VALUES (?, ?, ?)",
      ).bind(teamId, externalId, user.id).run();
    }
    await addAuditLog(c, "team_created", "team", teamId, instanceDetail(instanceId, name));
    return c.json({ success: true, message: "Team created", teamId });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.put("/api/team-instances/:id/teams/:teamId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const teamId = c.req.param("teamId");
    const team: any = await c.env.DB.prepare("SELECT * FROM instance_teams WHERE id = ? AND instance_id = ?").bind(teamId, instanceId).first();
    if (!team) return c.json({ error: "Team not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);

    const name = body.name !== undefined ? sanitizeStr(body.name) : undefined;
    const description = body.description !== undefined ? sanitizeStr(body.description, MAX_PROJECT_DESC_LEN) : undefined;
    if (name !== undefined && !name) return c.json({ error: "Team name cannot be empty" }, 400);

    // groupId moves the team between groups (this backs the drag-and-drop);
    // null / "" moves it to Ungrouped.
    let groupId: string | null | undefined = undefined;
    if (body.groupId !== undefined) {
      if (body.groupId === null || String(body.groupId).trim() === "") {
        groupId = null;
      } else {
        groupId = String(body.groupId).trim();
        const group: any = await c.env.DB.prepare("SELECT id FROM instance_groups WHERE id = ? AND instance_id = ?").bind(groupId, instanceId).first();
        if (!group) return c.json({ error: "Group does not belong to this instance" }, 400);
      }
    }

    // minMembers / maxMembers (memberLimit = legacy alias for max). Either can
    // be nulled by sending null. min may exceed the current member count — the
    // team is then flagged incomplete (red) until more members are added.
    let minMembers: number | null | undefined = undefined;
    if (body.minMembers !== undefined) {
      if (body.minMembers === null || body.minMembers === "") {
        minMembers = null;
      } else {
        const parsed = Number(body.minMembers);
        if (!Number.isInteger(parsed) || parsed < 1) {
          return c.json({ error: "minMembers must be a positive integer" }, 400);
        }
        minMembers = parsed;
      }
    }
    let maxMembers: number | null | undefined = undefined;
    if (body.maxMembers !== undefined || body.memberLimit !== undefined) {
      const raw = body.maxMembers !== undefined ? body.maxMembers : body.memberLimit;
      if (raw === null || raw === "") {
        maxMembers = null;
      } else {
        const parsed = Number(raw);
        if (!Number.isInteger(parsed) || parsed < 1) {
          return c.json({ error: "maxMembers must be a positive integer" }, 400);
        }
        maxMembers = parsed;
      }
    }

    const effectiveMin = minMembers !== undefined ? minMembers : (team.min_members != null ? team.min_members : null);
    const effectiveMax = maxMembers !== undefined ? maxMembers : (team.member_limit != null ? team.member_limit : null);
    if (effectiveMin !== null && effectiveMax !== null && effectiveMin > effectiveMax) {
      return c.json({ error: `minMembers (${effectiveMin}) cannot be greater than maxMembers (${effectiveMax})` }, 400);
    }
    if (maxMembers !== undefined && maxMembers !== null) {
      const n = await teamMemberCount(c, teamId);
      if (n > maxMembers) {
        return c.json({ error: `Team already has ${n} members; cap cannot be lower than that` }, 400);
      }
    }

    if (name !== undefined) {
      await c.env.DB.prepare("UPDATE instance_teams SET name = ? WHERE id = ?").bind(name, teamId).run();
    }
    if (description !== undefined) {
      await c.env.DB.prepare("UPDATE instance_teams SET description = ? WHERE id = ?").bind(description || null, teamId).run();
    }
    if (groupId !== undefined) {
      await c.env.DB.prepare("UPDATE instance_teams SET group_id = ? WHERE id = ?").bind(groupId, teamId).run();
    }
    if (minMembers !== undefined) {
      await c.env.DB.prepare("UPDATE instance_teams SET min_members = ? WHERE id = ?").bind(minMembers, teamId).run();
    }
    if (maxMembers !== undefined) {
      await c.env.DB.prepare("UPDATE instance_teams SET member_limit = ? WHERE id = ?").bind(maxMembers, teamId).run();
    }
    if (body.sortOrder !== undefined) {
      const parsed = Number(body.sortOrder);
      if (!Number.isInteger(parsed) || parsed < 0) return c.json({ error: "sortOrder must be a non-negative integer" }, 400);
      await c.env.DB.prepare("UPDATE instance_teams SET sort_order = ? WHERE id = ?").bind(parsed, teamId).run();
    }

    // currentLevel drives the progress board — dragging a team to the next
    // level column advances it. Bounded by the instance's level_count.
    let levelMoved: number | null = null;
    if (body.currentLevel !== undefined) {
      const inst: any = await c.env.DB.prepare("SELECT level_count FROM team_instances WHERE id = ?").bind(instanceId).first();
      const maxLevel = inst?.level_count && inst.level_count > 0 ? inst.level_count : 1;
      const parsed = Number(body.currentLevel);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > maxLevel) {
        return c.json({ error: `currentLevel must be between 1 and ${maxLevel}` }, 400);
      }
      await c.env.DB.prepare("UPDATE instance_teams SET current_level = ? WHERE id = ?").bind(parsed, teamId).run();
      levelMoved = parsed;
    }
    if (body.status !== undefined) {
      const status = sanitizeStr(body.status, 20);
      if (!status || !["active", "eliminated", "winner"].includes(status)) {
        return c.json({ error: "status must be one of: active, eliminated, winner" }, 400);
      }
      await c.env.DB.prepare("UPDATE instance_teams SET status = ? WHERE id = ?").bind(status, teamId).run();
      await addAuditLog(c, "team_status_changed", "team", teamId, instanceDetail(instanceId, `${team.name} -> ${status}`));
    }
    if (levelMoved !== null) {
      await addAuditLog(c, "team_level_changed", "team", teamId, instanceDetail(instanceId, `${team.name} -> level ${levelMoved}`));
      return c.json({ success: true, message: "Team updated" });
    }
    await addAuditLog(c, "team_updated", "team", teamId, instanceDetail(instanceId, name || team.name));
    return c.json({ success: true, message: "Team updated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/team-instances/:id/teams/:teamId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const teamId = c.req.param("teamId");
    const team: any = await c.env.DB.prepare("SELECT * FROM instance_teams WHERE id = ? AND instance_id = ?").bind(teamId, instanceId).first();
    if (!team) return c.json({ error: "Team not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    await c.env.DB.prepare("DELETE FROM instance_team_members WHERE team_id = ?").bind(teamId).run();
    await c.env.DB.prepare("DELETE FROM instance_team_external_members WHERE team_id = ?").bind(teamId).run();
    await c.env.DB.prepare("DELETE FROM instance_teams WHERE id = ?").bind(teamId).run();
    await addAuditLog(c, "team_deleted", "team", teamId, instanceDetail(instanceId, team.name));
    return c.json({ success: true, message: "Team deleted" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/team-instances/:id/teams/:teamId/members", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const instanceId = c.req.param("id");
    const teamId = c.req.param("teamId");
    const team: any = await c.env.DB.prepare("SELECT * FROM instance_teams WHERE id = ? AND instance_id = ?").bind(teamId, instanceId).first();
    if (!team) return c.json({ error: "Team not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);
    const userId = sanitizeStr(body.userId);
    if (!userId) return c.json({ error: "Missing userId" }, 400);

    const eligibility = await validateTeamMemberEligibility(c, user, userId);
    if (eligibility.error) return c.json({ error: eligibility.error }, 400);

    const alreadyIn: any = await c.env.DB.prepare("SELECT 1 FROM instance_team_members WHERE team_id = ? AND user_id = ?").bind(teamId, userId).first();
    if (alreadyIn) return c.json({ error: `${eligibility.user.name} is already in this team` }, 400);

    if (team.member_limit !== null && team.member_limit !== undefined) {
      const n = await teamMemberCount(c, teamId);
      if (n >= team.member_limit) {
        return c.json({ error: `Team is full (limit ${team.member_limit})` }, 400);
      }
    }

    await c.env.DB.prepare(
      "INSERT INTO instance_team_members (team_id, user_id, added_by) VALUES (?, ?, ?)",
    ).bind(teamId, userId, user.id).run();
    await addAuditLog(c, "team_member_added", "team", teamId, instanceDetail(instanceId, `${eligibility.user.email} -> ${team.name}`));
    return c.json({ success: true, message: "Member added" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/team-instances/:id/teams/:teamId/members/:userId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const teamId = c.req.param("teamId");
    const userId = c.req.param("userId");
    const team: any = await c.env.DB.prepare("SELECT * FROM instance_teams WHERE id = ? AND instance_id = ?").bind(teamId, instanceId).first();
    if (!team) return c.json({ error: "Team not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    await c.env.DB.prepare("DELETE FROM instance_team_members WHERE team_id = ? AND user_id = ?").bind(teamId, userId).run();
    await addAuditLog(c, "team_member_removed", "team", teamId, instanceDetail(instanceId, `${userId} from ${team.name}`));
    return c.json({ success: true, message: "Member removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/team-instances/:id/teams/:teamId/external-members", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const instanceId = c.req.param("id");
    const teamId = c.req.param("teamId");
    const team: any = await c.env.DB.prepare("SELECT * FROM instance_teams WHERE id = ? AND instance_id = ?").bind(teamId, instanceId).first();
    if (!team) return c.json({ error: "Team not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);
    const externalId = sanitizeStr(body.externalId);
    if (!externalId) return c.json({ error: "Missing externalId" }, 400);

    const ext: any = await c.env.DB.prepare(
      "SELECT * FROM instance_external_members WHERE id = ? AND instance_id = ?",
    ).bind(externalId, instanceId).first();
    if (!ext) return c.json({ error: "That outside member does not belong to this instance" }, 400);

    const alreadyIn: any = await c.env.DB.prepare(
      "SELECT 1 FROM instance_team_external_members WHERE team_id = ? AND external_id = ?",
    ).bind(teamId, externalId).first();
    if (alreadyIn) return c.json({ error: `${ext.name} is already in this team` }, 400);

    if (team.member_limit !== null && team.member_limit !== undefined) {
      const n = await teamMemberCount(c, teamId);
      if (n >= team.member_limit) {
        return c.json({ error: `Team is full (limit ${team.member_limit})` }, 400);
      }
    }

    await c.env.DB.prepare(
      "INSERT INTO instance_team_external_members (team_id, external_id, added_by) VALUES (?, ?, ?)",
    ).bind(teamId, externalId, user.id).run();
    await addAuditLog(c, "team_outside_member_added", "team", teamId, instanceDetail(instanceId, `${ext.name} -> ${team.name}`));
    return c.json({ success: true, message: "Outside member added" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.delete("/api/team-instances/:id/teams/:teamId/external-members/:externalId", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const instanceId = c.req.param("id");
    const teamId = c.req.param("teamId");
    const externalId = c.req.param("externalId");
    const team: any = await c.env.DB.prepare("SELECT * FROM instance_teams WHERE id = ? AND instance_id = ?").bind(teamId, instanceId).first();
    if (!team) return c.json({ error: "Team not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    await c.env.DB.prepare("DELETE FROM instance_team_external_members WHERE team_id = ? AND external_id = ?").bind(teamId, externalId).run();
    await addAuditLog(c, "team_outside_member_removed", "team", teamId, instanceDetail(instanceId, `${externalId} from ${team.name}`));
    return c.json({ success: true, message: "Outside member removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// One endpoint behind every member drag-and-drop: moves an internal user or an
// outside member from one team to another within the same instance.
app.post("/api/team-instances/:id/move-member", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    const instanceId = c.req.param("id");
    const instance: any = await c.env.DB.prepare("SELECT id FROM team_instances WHERE id = ?").bind(instanceId).first();
    if (!instance) return c.json({ error: "Instance not found" }, 404);
    if (!(await canManageInstanceTeams(c, instanceId))) {
      return c.json({ error: "Forbidden: You can only manage your department's instances" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);

    const kind = sanitizeStr(body.kind);
    const memberId = sanitizeStr(body.memberId);
    const fromTeamId = sanitizeStr(body.fromTeamId);
    const toTeamId = sanitizeStr(body.toTeamId);
    if (kind !== "internal" && kind !== "external") return c.json({ error: "kind must be 'internal' or 'external'" }, 400);
    if (!memberId || !fromTeamId || !toTeamId) return c.json({ error: "Missing memberId, fromTeamId or toTeamId" }, 400);
    if (fromTeamId === toTeamId) return c.json({ success: true, message: "No change" });

    const fromTeam: any = await c.env.DB.prepare("SELECT * FROM instance_teams WHERE id = ? AND instance_id = ?").bind(fromTeamId, instanceId).first();
    const toTeam: any = await c.env.DB.prepare("SELECT * FROM instance_teams WHERE id = ? AND instance_id = ?").bind(toTeamId, instanceId).first();
    if (!fromTeam || !toTeam) return c.json({ error: "Both teams must belong to this instance" }, 400);

    if (toTeam.member_limit !== null && toTeam.member_limit !== undefined) {
      const n = await teamMemberCount(c, toTeamId);
      if (n >= toTeam.member_limit) {
        return c.json({ error: `${toTeam.name} is full (limit ${toTeam.member_limit})` }, 400);
      }
    }

    let label = memberId;
    if (kind === "internal") {
      const inSource: any = await c.env.DB.prepare("SELECT 1 FROM instance_team_members WHERE team_id = ? AND user_id = ?").bind(fromTeamId, memberId).first();
      if (!inSource) return c.json({ error: "That member is not in the source team" }, 400);
      const eligibility = await validateTeamMemberEligibility(c, user, memberId);
      if (eligibility.error) return c.json({ error: eligibility.error }, 400);
      const alreadyIn: any = await c.env.DB.prepare("SELECT 1 FROM instance_team_members WHERE team_id = ? AND user_id = ?").bind(toTeamId, memberId).first();
      if (alreadyIn) return c.json({ error: `${eligibility.user.name} is already in ${toTeam.name}` }, 400);
      await c.env.DB.prepare("DELETE FROM instance_team_members WHERE team_id = ? AND user_id = ?").bind(fromTeamId, memberId).run();
      await c.env.DB.prepare("INSERT INTO instance_team_members (team_id, user_id, added_by) VALUES (?, ?, ?)").bind(toTeamId, memberId, user.id).run();
      label = eligibility.user.name;
    } else {
      const ext: any = await c.env.DB.prepare("SELECT * FROM instance_external_members WHERE id = ? AND instance_id = ?").bind(memberId, instanceId).first();
      if (!ext) return c.json({ error: "That outside member does not belong to this instance" }, 400);
      const inSource: any = await c.env.DB.prepare("SELECT 1 FROM instance_team_external_members WHERE team_id = ? AND external_id = ?").bind(fromTeamId, memberId).first();
      if (!inSource) return c.json({ error: "That member is not in the source team" }, 400);
      const alreadyIn: any = await c.env.DB.prepare("SELECT 1 FROM instance_team_external_members WHERE team_id = ? AND external_id = ?").bind(toTeamId, memberId).first();
      if (alreadyIn) return c.json({ error: `${ext.name} is already in ${toTeam.name}` }, 400);
      await c.env.DB.prepare("DELETE FROM instance_team_external_members WHERE team_id = ? AND external_id = ?").bind(fromTeamId, memberId).run();
      await c.env.DB.prepare("INSERT INTO instance_team_external_members (team_id, external_id, added_by) VALUES (?, ?, ?)").bind(toTeamId, memberId, user.id).run();
      label = ext.name;
    }

    await addAuditLog(c, "team_member_moved", "team", toTeamId, instanceDetail(instanceId, `${label}: ${fromTeam.name} -> ${toTeam.name}`));
    return c.json({ success: true, message: "Member moved" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// "What happened" — recent changes for one instance.
app.get("/api/team-instances/:id/activity", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (user.role_id === "advisory") {
      return c.json({ error: "Advisory members do not have access to team instances" }, 403);
    }
    const instanceId = c.req.param("id");
    const instance: any = await c.env.DB.prepare("SELECT id FROM team_instances WHERE id = ?").bind(instanceId).first();
    if (!instance) return c.json({ error: "Instance not found" }, 404);

    const [teams, groups, externals] = await Promise.all([
      c.env.DB.prepare("SELECT id FROM instance_teams WHERE instance_id = ?").bind(instanceId).all(),
      c.env.DB.prepare("SELECT id FROM instance_groups WHERE instance_id = ?").bind(instanceId).all(),
      c.env.DB.prepare("SELECT id FROM instance_external_members WHERE instance_id = ?").bind(instanceId).all(),
    ]);
    const targetIds = [
      instanceId,
      ...((teams.results || []) as any[]).map((t: any) => t.id),
      ...((groups.results || []) as any[]).map((g: any) => g.id),
      ...((externals.results || []) as any[]).map((e: any) => e.id),
    ];
    const ph = targetIds.map(() => "?").join(",");
    // Rows are also matched on `details` so that changes to a since-deleted team
    // or group still show up — every audit call in this feature embeds the
    // instance id via instanceDetail(). Rows written before that convention
    // existed are only reachable by target_id.
    const rows = await c.env.DB.prepare(
      `SELECT action, actor_email, target_type, target_id, details, created_at FROM audit_log WHERE target_id IN (${ph}) OR details LIKE ? ORDER BY created_at DESC LIMIT 30`,
    ).bind(...targetIds, `%instance ${instanceId}%`).all();

    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});


const ALLOWED_IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMG_SIZE = 10 * 1024 * 1024; // 10 MB

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// CASE STUDY IMAGE UPLOAD & SERVE (uses same R2 bucket, separate folder)
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

app.post("/api/case-studies/upload-image", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden: Members only" }, 403);
    const rl = await checkRateLimit(c, "case_study_upload_image", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);

    const fd = await c.req.formData();
    const file = fd.get("image");
    if (!file || typeof file === "string") return c.json({ error: "No image file provided" }, 400);

    const typedFile = file as File;
    if (!ALLOWED_IMG_TYPES.includes(typedFile.type)) {
      return c.json({ error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" }, 400);
    }
    if (typedFile.size > MAX_IMG_SIZE) {
      return c.json({ error: "File too large. Max 10 MB" }, 400);
    }

    const ext = typedFile.name.split(".").pop() || "jpg";
    const key = `images/${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await typedFile.arrayBuffer();
    await c.env.CASE_STUDIES.put(key, arrayBuffer, {
      httpMetadata: { contentType: typedFile.type },
    });

    const url = `/api/case-studies/images/${key}`;

    return c.json({ success: true, url, key });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.get("/api/case-studies/images/*", async (c) => {
  try {
    const rl = await checkRateLimit(c, "case_study_image_serve", 200, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const url = new URL(c.req.url);
    const prefix = "/api/case-studies/images/";
    let key = decodeURIComponent(url.pathname);

    if (key.startsWith(prefix)) {
      key = key.slice(prefix.length);
    } else {
      key = key.replace(/^\/+/, "");
    }

    if (!key || key.includes("..")) return c.json({ error: "Invalid key" }, 400);

    const obj = await c.env.CASE_STUDIES.get(key);
    if (!obj) return c.json({ error: "Image not found" }, 404);

    const headers = new Headers();
    headers.set("Content-Type", obj.httpMetadata?.contentType || "image/jpeg");
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(obj.body, { headers });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Delete uploaded case study image from R2 (power >= 10)
app.delete("/api/case-studies/delete-image", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden: Members only" }, 403);

    const { key } = await c.req.json();
    if (!key || typeof key !== "string") return c.json({ error: "Image key is required" }, 400);
    if (!key.startsWith("images/") && !key.startsWith("source/")) return c.json({ error: "Invalid image key" }, 400);

    await c.env.CASE_STUDIES.delete(key);
    return c.json({ success: true, message: "Image deleted" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
// CASE STUDY DOCUMENT UPLOAD (PDF / DOCX Ã¢â€ â€™ HTML)
// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬

const ALLOWED_DOC_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_DOC_SIZE = 20 * 1024 * 1024; // 20 MB

app.post("/api/case-studies/upload-document", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden: Members only" }, 403);
    const rl = await checkRateLimit(c, "case_study_upload_doc", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);

    const fd = await c.req.formData();
    const file = fd.get("document");
    if (!file || typeof file === "string") return c.json({ error: "No document file provided" }, 400);

    const typedFile = file as File;
    if (!ALLOWED_DOC_TYPES.includes(typedFile.type)) {
      return c.json({ error: "Invalid file type. Allowed: PDF, DOCX" }, 400);
    }
    if (typedFile.size > MAX_DOC_SIZE) {
      return c.json({ error: "File too large. Max 20 MB" }, 400);
    }

    const arrayBuffer = await typedFile.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    let html = "";
    let suggestedTitle = "";
    let suggestedDescription = "";

    if (typedFile.type === "application/pdf") {
      const raw = new TextDecoder("latin1").decode(uint8);

      async function decompressStream(data: Uint8Array): Promise<string> {
        try {
          const ds = new DecompressionStream("deflate");
          const writer = ds.writable.getWriter();
          writer.write(data);
          writer.close();
          const reader = ds.readable.getReader();
          const chunks: Uint8Array[] = [];
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          const totalLen = chunks.reduce((s, c) => s + c.length, 0);
          const merged = new Uint8Array(totalLen);
          let offset = 0;
          for (const c of chunks) { merged.set(c, offset); offset += c.length; }
          return new TextDecoder("utf-8").decode(merged);
        } catch {
          return "";
        }
      }

      const textChunks: string[] = [];
      const objRegex = /(\d+)\s+\d+\s+obj[\s\S]*?(?:\/Filter\s*(?:\[?\s*)?(?:\/FlateDecode|\/LZWDecode)\s*\]?)?[\s\S]*?stream\r?\n([\s\S]*?)\r?\nendstream/g;
      let objMatch;
      while ((objMatch = objRegex.exec(raw)) !== null) {
        const streamBytes = new TextEncoder().encode(objMatch[2]);
        const decompressed = await decompressStream(streamBytes);
        if (decompressed) {
          const tjRe = /\(([^)]*)\)\s*Tj/g;
          let tjM;
          while ((tjM = tjRe.exec(decompressed)) !== null) textChunks.push(tjM[1]);
          const TJRe = /\[([^\]]*)\]\s*TJ/g;
          let TJM;
          while ((TJM = TJRe.exec(decompressed)) !== null) {
            const strRe = /\(([^)]*)\)/g;
            let sM;
            while ((sM = strRe.exec(TJM[1])) !== null) textChunks.push(sM[1]);
          }
          const hexTjRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
          let htM;
          while ((htM = hexTjRe.exec(decompressed)) !== null) {
            const hex = htM[1];
            let decoded = "";
            for (let i = 0; i < hex.length; i += 4) {
              decoded += String.fromCharCode(parseInt(hex.substring(i, i + 4), 16));
            }
            textChunks.push(decoded);
          }
          const hexTJRe = /\[\s*<([0-9A-Fa-f]+)>\s*\]\s*TJ/g;
          let hTJM;
          while ((hTJM = hexTJRe.exec(decompressed)) !== null) {
            const hex = hTJM[1];
            let decoded = "";
            for (let i = 0; i < hex.length; i += 4) {
              decoded += String.fromCharCode(parseInt(hex.substring(i, i + 4), 16));
            }
            textChunks.push(decoded);
          }
        }
      }

      if (textChunks.length === 0) {
        const plainStreams = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
        let pm;
        while ((pm = plainStreams.exec(raw)) !== null) {
          const s = pm[1];
          const tjRe = /\(([^)]*)\)\s*Tj/g;
          let tjM;
          while ((tjM = tjRe.exec(s)) !== null) textChunks.push(tjM[1]);
          const TJRe = /\[([^\]]*)\]\s*TJ/g;
          let TJM;
          while ((TJM = TJRe.exec(s)) !== null) {
            const strRe = /\(([^)]*)\)/g;
            let sM;
            while ((sM = strRe.exec(TJM[1])) !== null) textChunks.push(sM[1]);
          }
          const hexTjRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
          let htM;
          while ((htM = hexTjRe.exec(s)) !== null) {
            const hex = htM[1];
            let decoded = "";
            for (let i = 0; i < hex.length; i += 4) {
              decoded += String.fromCharCode(parseInt(hex.substring(i, i + 4), 16));
            }
            textChunks.push(decoded);
          }
        }
      }

      const decodedChunks = textChunks.map(chunk =>
        chunk
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "")
          .replace(/\\t/g, " ")
          .replace(/\\\(/g, "(")
          .replace(/\\\)/g, ")")
          .replace(/\\\\/g, "\\")
      );

      const text = decodedChunks.join("\n\n");
      const paragraphs = text.split(/\n{2,}/).filter((p: string) => p.trim().length > 0);
      html = paragraphs
        .map((p: string) => {
          const trimmed = p.trim();
          const lines = trimmed.split("\n");
          if (lines.length === 1) {
            return `<p>${escapeHtml(lines[0].trim())}</p>`;
          }
          return lines.map((l: string) => `<p>${escapeHtml(l.trim())}</p>`).join("\n");
        })
        .join("\n");

      const titleMatch = raw.match(/\/Title\s*\(([^)]+)\)/);
      if (titleMatch && titleMatch[1].trim()) suggestedTitle = titleMatch[1].trim();

      if (!suggestedTitle && paragraphs.length > 0) {
        const firstLine = paragraphs[0].split("\n")[0].trim();
        if (firstLine.length >= 3 && firstLine.length <= 200) suggestedTitle = firstLine;
      }
      if (paragraphs.length > 1) {
        const desc = paragraphs[1].replace(/\n/g, " ").trim();
        suggestedDescription = desc.length > 500 ? desc.slice(0, 497) + "..." : desc;
      }
    } else {
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({ arrayBuffer });
      html = result.value;

      const tempDiv = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      const firstSentence = tempDiv.split(/[.!?]\s/)[0];
      if (firstSentence && firstSentence.length >= 3 && firstSentence.length <= 200) {
        suggestedTitle = firstSentence.trim();
      }
      const rest = tempDiv.slice(suggestedTitle.length).trim();
      if (rest) {
        suggestedDescription = rest.length > 500 ? rest.slice(0, 497) + "..." : rest;
      }
    }

    const content = sanitizeBlogHtml(html);
    const textOnly = content.replace(/<[^>]*>/g, "").trim();
    if (textOnly.length < 10) {
      return c.json({ error: "Document appears empty or contains less than 10 visible characters" }, 400);
    }

    return c.json({ success: true, content, charCount: textOnly.length, suggestedTitle, suggestedDescription });
  } catch (e: any) {
    console.error("upload-document error:", e?.message, e?.stack);
    return errorResponse(c, "Failed to parse document: " + e.message, 500);
  }
});

// Upload source PDF/DOCX to R2 for download link
app.post("/api/case-studies/upload-source", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden: Members only" }, 403);
    const rl = await checkRateLimit(c, "case_study_upload_source", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);

    const fd = await c.req.formData();
    const file = fd.get("file");
    if (!file || typeof file === "string") return c.json({ error: "No file provided" }, 400);

    const typedFile = file as File;
    const ext = typedFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      return c.json({ error: "Invalid file type. Allowed: pdf, docx" }, 400);
    }
    if (typedFile.size > MAX_DOC_SIZE) {
      return c.json({ error: "File too large. Max 20 MB" }, 400);
    }

    const key = `source/${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await typedFile.arrayBuffer();
    await c.env.CASE_STUDIES.put(key, arrayBuffer, {
      httpMetadata: { contentType: typedFile.type },
    });

    const url = `/api/case-studies/images/${key}`;
    return c.json({ success: true, url, key });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// CONSULTING REQUESTS
// ---------------------------------------------------------

// 1. Public: Submit a consulting request
app.post("/api/consulting-request", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "consulting_request", 1, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const name = sanitizeStr(body.name);
    const email = validateEmail(body.email);
    const phone = sanitizeStr(body.phone);
    const organization = sanitizeStr(body.organization);
    const roleInOrg = sanitizeStr(body.roleInOrg);
    const requirement = sanitizeStr(body.requirement, MAX_MSG_LEN);

    if (!name || !email || !phone || !organization || !requirement) {
      return c.json({ error: "Missing required fields: name, email, phone, organization, requirement" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO consulting_requests (id, name, email, phone, organization, role_in_org, requirement, status) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, 'pending')",
    ).bind(name, email, phone, organization, roleInOrg || null, requirement).run();

    return c.json({ success: true, message: "Consulting request submitted successfully." });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 2. Admin: List all consulting requests (Board only)
app.get("/api/consulting-requests", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT * FROM consulting_requests ORDER BY created_at DESC",
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 3. Admin: Accept a consulting request with custom email (Board only)
app.post("/api/consulting-requests/:id/accept", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "consulting_accept", 10, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    requireBoard(c);
    const id = c.req.param("id");

    const request: any = await c.env.DB.prepare(
      "SELECT * FROM consulting_requests WHERE id = ?",
    ).bind(id).first();

    if (!request) return c.json({ error: "Request not found" }, 404);
    if (request.status !== "pending") return c.json({ error: "Request already processed" }, 400);

    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const emailSubject = sanitizeStr(body.emailSubject);
    const emailBody = sanitizeStr(body.emailBody, MAX_MSG_LEN * 2);

    if (!emailSubject || !emailBody) {
      return c.json({ error: "Missing email subject or body" }, 400);
    }

    // Send the email
    const apiKey = c.env.RESEND_API_KEY;
    if (apiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "180DC Consulting <team@180dcvitc.org>",
          to: request.email,
          subject: emailSubject,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:24px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">Consulting Request Update</h1>
</td></tr>
<tr><td style="padding:28px">
<div style="font-size:14px;color:#555555;margin:0;line-height:1.8;white-space:pre-wrap">${escapeHtml(emailBody).replace(/\n/g, "<br>")}</div>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting Ã¢â‚¬â€ VIT Chennai</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
        }),
      });
    }

    // Update status and store response
    await c.env.DB.prepare("UPDATE consulting_requests SET status = 'accepted' WHERE id = ?").bind(id).run();
    await c.env.DB.prepare(
      "INSERT INTO consulting_responses (id, request_id, email_subject, email_body) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
    ).bind(id, emailSubject, emailBody).run();

    return c.json({ success: true, message: "Request accepted and email sent." });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 4. Admin: Reject a consulting request with custom email (Board only)
app.post("/api/consulting-requests/:id/reject", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "consulting_reject", 10, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    requireBoard(c);
    const id = c.req.param("id");
    const request: any = await c.env.DB.prepare(
      "SELECT * FROM consulting_requests WHERE id = ?",
    ).bind(id).first();
    if (!request) return c.json({ error: "Request not found" }, 404);
    if (request.status !== "pending") return c.json({ error: "Request already processed" }, 400);

    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const emailSubject = sanitizeStr(body.emailSubject);
    const emailBody = sanitizeStr(body.emailBody, MAX_MSG_LEN * 2);

    if (!emailSubject || !emailBody) {
      return c.json({ error: "Missing email subject or body" }, 400);
    }

    // Send the email
    const apiKey = c.env.RESEND_API_KEY;
    if (apiKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "180DC Consulting <team@180dcvitc.org>",
          to: request.email,
          subject: emailSubject,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:24px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">Consulting Request Update</h1>
</td></tr>
<tr><td style="padding:28px">
<div style="font-size:14px;color:#555555;margin:0;line-height:1.8;white-space:pre-wrap">${escapeHtml(emailBody).replace(/\n/g, "<br>")}</div>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting Ã¢â‚¬â€ VIT Chennai</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
        }),
      });
    }

    await c.env.DB.prepare("UPDATE consulting_requests SET status = 'rejected' WHERE id = ?").bind(id).run();
    await c.env.DB.prepare(
      "INSERT INTO consulting_responses (id, request_id, email_subject, email_body) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
    ).bind(id, emailSubject, emailBody).run();

    return c.json({ success: true, message: "Request rejected and email sent." });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 5. Admin: Delete a consulting request (any status)
app.delete("/api/consulting-requests/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    requireBoard(c);
    const id = c.req.param("id");

    const request: any = await c.env.DB.prepare(
      "SELECT id FROM consulting_requests WHERE id = ?",
    ).bind(id).first();

    if (!request) return c.json({ error: "Request not found" }, 404);

    await c.env.DB.prepare("DELETE FROM consulting_responses WHERE request_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM consulting_requests WHERE id = ?").bind(id).run();

    return c.json({ success: true, message: "Request deleted." });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// CASE STUDIES (member-posted, no approval needed)
// ---------------------------------------------------------

// 1. Create a case study (authenticated, power >= 10)
app.post("/api/case-studies", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "case_study_create", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden: Members only" }, 403);

    const body = await c.req.json();
    const tag = sanitizeStr(body.tag) || "Uncategorized";
    const title = sanitizeStr(body.title) || "Untitled";
    const description = sanitizeStr(body.description) || "";
    const rawContent = body.content;
    const sourceFileUrl = sanitizeStr(body.sourceFileUrl);

    if (!rawContent || typeof rawContent !== "string" || rawContent.length < 10) {
      return c.json({ error: "Content must be at least 10 characters" }, 400);
    }
    if (rawContent.length > 100000) return c.json({ error: "Content too long (max 100,000 chars)" }, 400);

    const content = sanitizeBlogHtml(rawContent);
    const textOnly = content.replace(/<[^>]*>/g, "").trim();
    if (textOnly.length < 10) {
      return c.json({ error: "Content must contain at least 10 visible characters after sanitization" }, 400);
    }

    const id = crypto.randomUUID().replace(/-/g, "");
    const authorName = user.name || "Member";

    await c.env.DB.prepare(
      "INSERT INTO case_studies (id, tag, title, description, content, image_url, author_name, created_by, source_file_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, tag, title, description, content, null, authorName, user.id, sourceFileUrl || null).run();

    await addAuditLog(c, "case_study_created", "case_study", id, "Case study created: " + title);

    return c.json({ success: true, message: "Case study published", id });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 2. List all case studies for admin/members (authenticated, power >= 10)
app.get("/api/case-studies", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden" }, 403);

    const rows = await c.env.DB.prepare("SELECT * FROM case_studies ORDER BY created_at DESC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 3. Delete a case study (power >= 50)
app.delete("/api/case-studies/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 50) return c.json({ error: "Forbidden: Lead or above only" }, 403);

    const id = c.req.param("id");
    const row: any = await c.env.DB.prepare("SELECT id, title, image_url, source_file_url FROM case_studies WHERE id = ?").bind(id).first();
    if (!row) return c.json({ error: "Case study not found" }, 404);

    await c.env.DB.prepare("DELETE FROM case_studies WHERE id = ?").bind(id).run();

    if (row.image_url) {
      try {
        const imgKey = row.image_url.replace(/^\/api\/case-studies\/images\//, "");
        if (imgKey.startsWith("images/")) await c.env.CASE_STUDIES.delete(imgKey);
      } catch {}
    }
    if (row.source_file_url) {
      try {
        const srcKey = row.source_file_url.replace(/^\/api\/case-studies\/images\//, "");
        if (srcKey.startsWith("source/")) await c.env.CASE_STUDIES.delete(srcKey);
      } catch {}
    }

    await addAuditLog(c, "case_study_deleted", "case_study", id, "Case study deleted: " + row.title);

    return c.json({ success: true, message: "Case study deleted" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 4. Edit a case study (authenticated, power >= 10)
app.put("/api/case-studies/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "case_study_edit", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden: Members only" }, 403);

    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT id FROM case_studies WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Case study not found" }, 404);

    const body = await c.req.json();
    const tag = sanitizeStr(body.tag) || "Uncategorized";
    const title = sanitizeStr(body.title) || "Untitled";
    const description = sanitizeStr(body.description) || "";
    const rawContent = body.content;
    const sourceFileUrl = sanitizeStr(body.sourceFileUrl);

    if (!rawContent || typeof rawContent !== "string" || rawContent.length < 10) {
      return c.json({ error: "Content must be at least 10 characters" }, 400);
    }
    if (rawContent.length > 100000) return c.json({ error: "Content too long (max 100,000 chars)" }, 400);

    const content = sanitizeBlogHtml(rawContent);
    const textOnly = content.replace(/<[^>]*>/g, "").trim();
    if (textOnly.length < 10) {
      return c.json({ error: "Content must contain at least 10 visible characters after sanitization" }, 400);
    }

    await c.env.DB.prepare(
      "UPDATE case_studies SET tag = ?, title = ?, description = ?, content = ?, image_url = NULL, source_file_url = ? WHERE id = ?",
    ).bind(tag, title, description, content, sourceFileUrl || null, id).run();

    await addAuditLog(c, "case_study_updated", "case_study", id, "Case study updated: " + title);

    return c.json({ success: true, message: "Case study updated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 6. Admin: Send arbitrary email (Board: anyone · Directors: own department only)
app.post("/api/send-email", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const user: any = c.get("user");
    if (!user || user.power_level < 50) {
      return c.json({ error: "Forbidden: Board and directors only" }, 403);
    }
    const rl = await checkRateLimit(c, "send_email", 10, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const to = sanitizeStr(body.to, MAX_MSG_LEN);
    const subject = sanitizeStr(body.subject);
    const htmlBody = sanitizeStr(body.body, MAX_MSG_LEN * 2);

    if (!to || !subject || !htmlBody) {
      return c.json({ error: "Missing recipient, subject, or body" }, 400);
    }

    const apiKey = c.env.RESEND_API_KEY;
    if (!apiKey) return c.json({ error: "Email not configured" }, 500);

    const currentCount = await getTodayEmailCount(c.env.DB);
    if (currentCount >= 100) {
      return c.json({ error: "Daily email quota reached (100 emails). Try again after 24 hours." }, 429);
    }

    // Support multiple recipients separated by comma/semicolon
    const recipients = to.split(/[;,]+/).map((e: string) => e.trim()).filter(Boolean);
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    let validRecipients = recipients.filter((e: string) => EMAIL_RE.test(e));

    // Directors (power < 100) can only email members of their own department
    if (user.power_level < 100) {
      if (!user.department_id) {
        return c.json({ error: "No department assigned — cannot send department emails" }, 403);
      }
      const deptRows: any = await c.env.DB.prepare(
        "SELECT email FROM users WHERE department_id = ?",
      ).bind(user.department_id).all();
      const deptEmails = new Set((deptRows.results || []).map((r: any) => (r.email || "").toLowerCase()));
      validRecipients = validRecipients.filter((e: string) => deptEmails.has(e.toLowerCase()));
      if (validRecipients.length === 0) {
        return c.json({ error: "Directors can only send emails to members of their own department" }, 403);
      }
    }

    if (validRecipients.length === 0) {
      return c.json({ error: "No valid email addresses provided" }, 400);
    }

    for (const recipient of validRecipients) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "180DC Admin <team@180dcvitc.org>",
          to: recipient,
          subject,
          html: `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&family=Caveat:wght@600&display=swap" rel="stylesheet">
</head><body style="margin:0;padding:0;background-color:#f5f3ee;font-family:'Nunito',-apple-system,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f3ee;padding:32px 12px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;border:3px solid #1a1a1a;box-shadow:5px 5px 0 #1a1a1a">
<tr><td style="background:#8dc63f;padding:24px;text-align:center;border-bottom:3px solid #1a1a1a">
<img src="https://180dcvitc.org/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">180DC Admin Message</h1>
</td></tr>
<tr><td style="padding:28px">
<div style="font-size:14px;color:#555555;margin:0;line-height:1.8;white-space:pre-wrap">${escapeHtml(htmlBody).replace(/\n/g, "<br>")}</div>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting Ã¢â‚¬â€ VIT Chennai</p>
</td></tr>
</table></td></tr></table>
</body></html>`,
        }),
      });
    }

    await incrementEmailCount(c.env.DB);
    return c.json({ success: true, message: `Email sent to ${validRecipients.length} recipient(s)` }, 200);
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// CLUB FILES ENDPOINTS (R2 only Ã¢â‚¬â€ metadata stored as custom metadata on objects)
// ---------------------------------------------------------

function meta(obj: any, key: string): string {
  return obj?.customMetadata?.[key] || "";
}

function fileFromR2Obj(obj: any, key: string): any {
  const m = obj.customMetadata || {};
  const fileName = m.fileName || key.split("/").pop() || "";
  return {
    id: key.split("/").pop()?.split(".")[0] || "",
    category: key.split("/")[0],
    file_name: fileName,
    file_type: obj.httpMetadata?.contentType || m.fileType || "",
    file_size: obj.size,
    event_name: m.eventName || null,
    event_for: m.eventFor || null,
    project_name: m.projectName || null,
    meeting_title: m.meetingTitle || null,
    meeting_date: m.meetingDate || null,
    description: m.description || null,
    uploaded_by: m.uploadedBy || "",
    uploaded_by_name: m.uploadedByName || "",
    created_at: m.createdAt || obj.uploaded,
    r2_key: key,
  };
}

// List files with optional filters
app.get("/api/club-files", async (c) => {
  try {
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden" }, 403);

    const category = c.req.query("category") || "";
    const eventName = (c.req.query("eventName") || "").toLowerCase();
    const projectName = (c.req.query("projectName") || "").toLowerCase();
    const search = (c.req.query("search") || "").toLowerCase();

    const prefix = category ? `${category}/` : "";
    const listed = await c.env.CLUB_FILES.list({ prefix });

    const files: any[] = [];
    for (const obj of listed.objects) {
      const head = await c.env.CLUB_FILES.head(obj.key);
      if (!head) continue;
      const m = head.customMetadata || {};
      const cat = obj.key.split("/")[0];

      if (category && cat !== category) continue;
      if (eventName && (m.eventName || "").toLowerCase() !== eventName) continue;
      if (projectName && (m.projectName || "").toLowerCase() !== projectName) continue;
      if (search) {
        const fileName = (m.fileName || "").toLowerCase();
        const desc = (m.description || "").toLowerCase();
        if (!fileName.includes(search) && !desc.includes(search)) continue;
      }

      files.push(fileFromR2Obj(head, obj.key));
    }

    files.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
    return c.json({ files });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Get unique event names (for filter dropdown)
app.get("/api/club-files/events", async (c) => {
  try {
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden" }, 403);

    const listed = await c.env.CLUB_FILES.list({ prefix: "events/" });
    const names = new Set<string>();
    for (const obj of listed.objects) {
      const head = await c.env.CLUB_FILES.head(obj.key);
      if (head?.customMetadata?.eventName) names.add(head.customMetadata.eventName);
    }
    return c.json({ events: [...names].sort() });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Get unique project names (for filter dropdown)
app.get("/api/club-files/projects", async (c) => {
  try {
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden" }, 403);

    const listed = await c.env.CLUB_FILES.list({ prefix: "projects/" });
    const names = new Set<string>();
    for (const obj of listed.objects) {
      const head = await c.env.CLUB_FILES.head(obj.key);
      if (head?.customMetadata?.projectName) names.add(head.customMetadata.projectName);
    }
    return c.json({ projects: [...names].sort() });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Delete a file (power >= 50 only)
app.delete("/api/club-files/:id", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "club_files_delete", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 50) return c.json({ error: "Forbidden: Lead Consultants and above only" }, 403);

    const id = c.req.param("id");
    const listed = await c.env.CLUB_FILES.list();
    let targetKey = "";
    for (const obj of listed.objects) {
      if (obj.key.endsWith(`/${id}.`) || obj.key.includes(`/${id}.`)) {
        targetKey = obj.key;
        break;
      }
    }
    if (!targetKey) return c.json({ error: "File not found" }, 404);

    await c.env.CLUB_FILES.delete(targetKey);
    await addAuditLog(c, "club_file_deleted", "club_file", id, "Deleted file " + targetKey + " by " + user.email);
    return c.json({ success: true });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Download a file
app.get("/api/club-files/:id/download", async (c) => {
  try {
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden" }, 403);

    const id = c.req.param("id");
    const listed = await c.env.CLUB_FILES.list();
    let targetKey = "";
    for (const obj of listed.objects) {
      if (obj.key.endsWith(`/${id}.`) || obj.key.includes(`/${id}.`)) {
        targetKey = obj.key;
        break;
      }
    }
    if (!targetKey) return c.json({ error: "File not found" }, 404);

    const obj = await c.env.CLUB_FILES.get(targetKey);
    if (!obj) return c.json({ error: "File not found" }, 404);

    const head = await c.env.CLUB_FILES.head(targetKey);
    const fileName = head?.customMetadata?.fileName || targetKey.split("/").pop() || "download";
    const contentType = head?.httpMetadata?.contentType || "application/octet-stream";

    return new Response(obj.body, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Upload a file (power >= 50 only)
app.post("/api/club-files/upload", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "club_files_upload", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 50) return c.json({ error: "Forbidden: Lead Consultants and above only" }, 403);

    const formData = await c.req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return c.json({ error: "No file provided" }, 400);

    const category = (formData.get("category") as string) || "general";
    const id = crypto.randomUUID().replace(/-/g, "");
    const ext = file.name.split(".").pop() || "bin";
    const key = `${category}/${id}.${ext}`;

    const metadata: Record<string, string> = {
      fileName: file.name,
      fileType: file.type,
      uploadedBy: user.email,
      uploadedByName: user.name || user.email,
      createdAt: new Date().toISOString(),
    };
    if (formData.get("eventName")) metadata.eventName = formData.get("eventName") as string;
    if (formData.get("eventFor")) metadata.eventFor = formData.get("eventFor") as string;
    if (formData.get("projectName")) metadata.projectName = formData.get("projectName") as string;
    if (formData.get("meetingTitle")) metadata.meetingTitle = formData.get("meetingTitle") as string;
    if (formData.get("meetingDate")) metadata.meetingDate = formData.get("meetingDate") as string;
    if (formData.get("description")) metadata.description = formData.get("description") as string;

    await c.env.CLUB_FILES.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: metadata,
    });

    await addAuditLog(c, "club_file_uploaded", "club_file", id, "Uploaded " + file.name + " to " + category + " by " + user.email);
    return c.json({ success: true, id, key });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// MAINTENANCE MODE (Board only)
// ---------------------------------------------------------

// GET /api/admin/maintenance Ã¢â‚¬â€ check maintenance status
app.get("/api/admin/maintenance", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const mm: any = await c.env.DB.prepare("SELECT enabled, message FROM maintenance_mode WHERE id = 1").first();
    return c.json({ enabled: mm?.enabled === 1, message: mm?.message || "" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// POST /api/admin/maintenance Ã¢â‚¬â€ toggle maintenance mode (power >= 100)
app.post("/api/admin/maintenance", async (c) => {
  try {
    await ensureDbReady(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "admin_maintenance_toggle", 5, 60);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: President/VP only" }, 403);

    const body = await c.req.json();
    const enabled = body.enabled === true ? 1 : 0;
    const message = typeof body.message === "string" && body.message.trim().length > 0
      ? body.message.trim().slice(0, 500)
      : "Site is under maintenance. Please check back later.";

    await c.env.DB.prepare("UPDATE maintenance_mode SET enabled = ?, message = ?, updated_by = ?, updated_at = datetime('now') WHERE id = 1")
      .bind(enabled, message, user.email).run();

    await addAuditLog(c, "maintenance_toggle", "maintenance", "1",
      "Maintenance mode " + (enabled ? "enabled" : "disabled"));

    return c.json({ success: true, enabled: enabled === 1, message });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

export default {
  async fetch(request: Request, env: any, ctx: any) {
    return app.fetch(request, env, ctx);
  },
};