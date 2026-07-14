import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { verifyToken } from "@clerk/backend";

type Bindings = {
  DB: any;
  ARCHIVE_DB: any;
  CLUB_FILES: R2Bucket;
  BLOG_IMAGES: R2Bucket;
  AUTH_SESSIONS: any;
  ENVIRONMENT?: string;
  RESEND_API_KEY?: string;
  CLERK_SECRET_KEY?: string;
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
    ["/api/recruitment/register"],
    ["/api/recruitment/login"],
    ["/api/recruitment/open-domains"],
    ["/api/blogs"],
    ["/api/blogs/upload-image", "POST"],
  ];
  for (const [route, requiredMethod] of PUBLIC_ROUTES) {
    if (pathname === route && (!requiredMethod || method === requiredMethod)) return true;
  }

  if (pathname.startsWith("/api/content") && method === "GET") return true;
  if (pathname.startsWith("/api/blogs/") && method === "GET" && !pathname.startsWith("/api/blogs/admin")) return true;
  if (pathname.startsWith("/api/case-studies/images/") && method === "GET") return true;
  if (pathname === "/api/admin/maintenance" && method === "GET") return true;

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
  if (isProduction(c)) {
    return c.json({ error: "An error occurred" }, status);
  }
  return c.json({ error: message }, status);
}

const URL_RE = /^https?:\/\/.+/;

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
<img src="https://180dc.shop/images/180DC.png" alt="180DC" width="56" style="margin-bottom:8px">
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
<a href="https://180dc.shop" style="color:#1a1a1a;text-decoration:none;font-size:13px;font-weight:800;text-transform:uppercase;letter-spacing:1px">Open Admin Portal</a>
</td></tr>
</table>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">This is the only time this token will be shown in full. Keep it safe and don't share it with anyone.</p>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:16px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting — VIT Chennai<br><span style="color:#777777;font-weight:400">Didn't request this? Contact your club admin immediately.</span></p>
</td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

async function sendTokenEmail(c: any, email: string, token: string, name: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not configured — skipping email to " + email);
    return { ok: false, error: "RESEND_API_KEY not configured" };
  }
  const from = "180DC Admin <noreply@180dc.shop>";
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
<img src="https://180dc.shop/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
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
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting — VIT Chennai</p>
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

async function sendMeetEmail(c: any, to: string, name: string, title: string, description: string | null, meetLink: string | null, scheduledAt: string, meetType: string) {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "180DC Admin <noreply@180dc.shop>",
        to,
        subject: "New Meet: " + title,
        html: meetEmailHtml(title, description, meetLink, scheduledAt, meetType),
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("Meet email failed (" + res.status + "): " + body);
    }
  } catch (e: any) {
    console.error("Meet email error: " + e.message);
  }
}

async function queueOrSendMeetEmails(c: any, recipients: { email: string; name: string }[], meetId: string, meetType: string, title: string, description: string | null, meetLink: string | null, scheduledAt: string) {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) { console.warn("RESEND_API_KEY not configured — skipping meet emails"); return { sent: 0, queued: 0 }; }

  let count = await getTodayEmailCount(c.env.DB);
  const MAX_DAILY = 100;
  let sent = 0;
  let queued = 0;

  for (const r of recipients) {
    if (r.email === DEV_ADMIN_EMAIL) continue;
    if (count < MAX_DAILY) {
      await sendMeetEmail(c, r.email, r.name, title, description, meetLink, scheduledAt, meetType);
      await incrementEmailCount(c.env.DB);
      count++;
      sent++;
    } else {
      await c.env.DB.prepare(
        "INSERT INTO pending_emails (id, meet_id, meet_type, recipient_email, recipient_name, meet_title, meet_description, meet_link, scheduled_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(meetId, meetType, r.email, r.name, title, description, meetLink, scheduledAt).run();
      queued++;
    }
  }
  return { sent, queued };
}

async function getMeetRecipients(db: any, meetType: string, departmentId?: string, departments?: string[]): Promise<{ email: string; name: string }[]> {
  const advisoryFilter = " AND NOT (role_id = 'advisory' AND secondary_role_id IS NULL)";
  if (meetType === "department_meet" && departmentId) {
    const rows: any = await db.prepare("SELECT email, name FROM users WHERE department_id = ? AND email != ?" + advisoryFilter).bind(departmentId, DEV_ADMIN_EMAIL).all();
    return rows.results || [];
  }
  if (meetType === "club_meet") {
    const rows: any = await db.prepare("SELECT email, name FROM users WHERE email != ?" + advisoryFilter).bind(DEV_ADMIN_EMAIL).all();
    return rows.results || [];
  }
  if (meetType === "inter_dept_meet" && departments && departments.length > 0) {
    const placeholders = departments.map(() => "?").join(",");
    const rows: any = await db.prepare(`SELECT email, name FROM users WHERE department_id IN (${placeholders}) AND email != ?` + advisoryFilter).bind(...departments, DEV_ADMIN_EMAIL).all();
    return rows.results || [];
  }
  return [];
}

async function sendProjectAssignmentEmail(c: any, projectName: string, departmentIds: string[]) {
  const apiKey = c.env.RESEND_API_KEY;
  if (!apiKey) return;
  const safeProjectName = escapeHtml(projectName);
  const rows: any = await c.env.DB.prepare(
    `SELECT u.email, u.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.department_id IN (${departmentIds.map(() => "?").join(",")}) AND r.power_level >= 50 AND u.email != ? AND NOT (u.role_id = 'advisory' AND u.secondary_role_id IS NULL)`
  ).bind(...departmentIds, DEV_ADMIN_EMAIL).all();
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
          from: "180DC Admin <noreply@180dc.shop>",
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
<img src="https://180dc.shop/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">New Project Assigned</h1>
</td></tr>
<tr><td style="padding:28px">
<p style="font-size:16px;color:#1a1a1a;margin:0 0 16px;font-weight:700">${safeProjectName}</p>
<p style="font-size:14px;color:#555555;margin:0 0 16px;line-height:1.6">A new project has been assigned to your department. Please review the details and begin planning your team's approach.</p>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">Check the 180DC Admin Portal for more information.</p>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting — VIT Chennai</p>
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
        from: "180DC Admin <noreply@180dc.shop>",
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
<img src="https://180dc.shop/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">New Role Assigned</h1>
</td></tr>
<tr><td style="padding:28px">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;font-weight:600">Hey ${safeName}!</p>
<p style="font-size:14px;color:#555555;margin:0 0 16px;line-height:1.6">You have been assigned the role of <strong>${safeRoleName}</strong> for the project <strong>${safeProjectName}</strong>.</p>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">Log in to the 180DC Admin Portal to view your project dashboard and tasks.</p>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting — VIT Chennai</p>
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
        from: "180DC Admin <noreply@180dc.shop>",
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
<img src="https://180dc.shop/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">Role Updated</h1>
</td></tr>
<tr><td style="padding:28px">
<p style="font-size:15px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;font-weight:600">Hey ${safeName}!</p>
<p style="font-size:14px;color:#555555;margin:0 0 16px;line-height:1.6">Your role in 180 Degrees Consulting has been updated to <strong>${safeRoleName}</strong>.</p>
<p style="font-size:12px;color:#777777;margin:0;line-height:1.5">Log in to the 180DC Admin Portal to view your updated access and responsibilities.</p>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting — VIT Chennai</p>
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
    CREATE TABLE IF NOT EXISTS blog_posts (id TEXT PRIMARY KEY, date TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS announcements (id TEXT PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS role_transfers (id TEXT PRIMARY KEY, from_user_id TEXT NOT NULL, to_user_id TEXT NOT NULL, role_id TEXT NOT NULL, status TEXT DEFAULT 'pending', created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (from_user_id) REFERENCES users(id), FOREIGN KEY (to_user_id) REFERENCES users(id), FOREIGN KEY (role_id) REFERENCES roles(id));
    CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, company_org TEXT, status TEXT DEFAULT 'upcoming', deadline DATETIME, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS project_departments (project_id TEXT NOT NULL, department_id TEXT NOT NULL, PRIMARY KEY (project_id, department_id), FOREIGN KEY (project_id) REFERENCES projects(id), FOREIGN KEY (department_id) REFERENCES departments(id));
    CREATE TABLE IF NOT EXISTS project_roles (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, user_id TEXT NOT NULL, role_name TEXT NOT NULL, created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES projects(id), FOREIGN KEY (user_id) REFERENCES users(id));
    CREATE TABLE IF NOT EXISTS project_tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, description TEXT, assigned_to TEXT, status TEXT DEFAULT 'pending', created_by TEXT, completed_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (project_id) REFERENCES projects(id));
    CREATE TABLE IF NOT EXISTS recruitment_rounds (id TEXT PRIMARY KEY, name TEXT NOT NULL, is_active INTEGER DEFAULT 0, start_date DATETIME, end_date DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS recruitment_applicants (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS recruitment_applications (id TEXT PRIMARY KEY, applicant_id TEXT NOT NULL, round_id TEXT NOT NULL, name TEXT NOT NULL, email TEXT NOT NULL, year TEXT NOT NULL, course TEXT NOT NULL, primary_domain TEXT NOT NULL, secondary_domain TEXT, why_join TEXT NOT NULL, why_domain TEXT NOT NULL, prior_experience TEXT, portfolio_link TEXT, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (applicant_id) REFERENCES recruitment_applicants(id), FOREIGN KEY (round_id) REFERENCES recruitment_rounds(id));
    CREATE TABLE IF NOT EXISTS recruitment_evaluation_criteria (id TEXT PRIMARY KEY, round_id TEXT NOT NULL, name TEXT NOT NULL, max_score REAL NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (round_id) REFERENCES recruitment_rounds(id));
    CREATE TABLE IF NOT EXISTS recruitment_evaluations (id TEXT PRIMARY KEY, application_id TEXT NOT NULL, criterion_id TEXT NOT NULL, evaluator_id TEXT NOT NULL, score REAL NOT NULL, comment TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (application_id) REFERENCES recruitment_applications(id), FOREIGN KEY (criterion_id) REFERENCES recruitment_evaluation_criteria(id));
    CREATE TABLE IF NOT EXISTS recruitment_domain_settings (domain_name TEXT PRIMARY KEY, is_open INTEGER DEFAULT 0, updated_by TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS rate_limits (ip TEXT NOT NULL, endpoint TEXT NOT NULL, count INTEGER DEFAULT 1, window_start DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (ip, endpoint));
    CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, action TEXT NOT NULL, actor_email TEXT, target_type TEXT, target_id TEXT, details TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS daily_email_count (date TEXT PRIMARY KEY, count INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS pending_emails (id TEXT PRIMARY KEY, meet_id TEXT NOT NULL, meet_type TEXT NOT NULL, recipient_email TEXT NOT NULL, recipient_name TEXT NOT NULL, meet_title TEXT NOT NULL, meet_description TEXT, meet_link TEXT, scheduled_at TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS consulting_requests (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL, organization TEXT NOT NULL, role_in_org TEXT, requirement TEXT NOT NULL, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS consulting_responses (id TEXT PRIMARY KEY, request_id TEXT NOT NULL, email_subject TEXT NOT NULL, email_body TEXT NOT NULL, sent_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (request_id) REFERENCES consulting_requests(id));
    CREATE TABLE IF NOT EXISTS chat_room_settings (room TEXT PRIMARY KEY, enabled INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS posts (id TEXT PRIMARY KEY, title TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, content TEXT NOT NULL, excerpt TEXT, image_url TEXT, author_id TEXT NOT NULL, author_name TEXT NOT NULL, status TEXT DEFAULT 'pending', is_published INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME);
    CREATE TABLE IF NOT EXISTS maintenance_mode (id INTEGER PRIMARY KEY DEFAULT 1, enabled INTEGER DEFAULT 0, message TEXT DEFAULT 'Site is under maintenance. Please check back later.', updated_by TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);
  await runMigrations(db);
}

async function runMigrations(db: any) {
  try { await db.exec("ALTER TABLE role_transfers ADD COLUMN from_user_accepted INTEGER DEFAULT 0"); } catch { console.warn("Migration: from_user_accepted may already exist"); }
  try { await db.exec("ALTER TABLE role_transfers ADD COLUMN to_user_accepted INTEGER DEFAULT 0"); } catch { console.warn("Migration: to_user_accepted may already exist"); }
  try { await db.exec("ALTER TABLE signup_requests ADD COLUMN department_id TEXT"); } catch { console.warn("Migration: department_id may already exist"); }
  try { await db.exec("ALTER TABLE projects ADD COLUMN company_org TEXT"); } catch { console.warn("Migration: company_org may already exist"); }
  try { await db.exec("ALTER TABLE projects ADD COLUMN year TEXT"); } catch { console.warn("Migration: year may already exist"); }
  try { await db.exec("ALTER TABLE recruitment_evaluations ADD COLUMN comment TEXT"); } catch { console.warn("Migration: recruitment_evaluations.comment may already exist"); }
  try { await db.exec("ALTER TABLE recruitment_applicants ADD COLUMN salt TEXT"); } catch { console.warn("Migration: salt may already exist"); }
  try { await db.exec("ALTER TABLE admin_tokens ADD COLUMN expires_at DATETIME"); } catch { console.warn("Migration: expires_at may already exist"); }
  try { await db.exec("ALTER TABLE recruitment_sessions ADD COLUMN token_hash TEXT"); } catch { console.warn("Migration: token_hash may already exist"); }
  try { await db.exec("ALTER TABLE recruitment_sessions RENAME COLUMN token TO token_old"); } catch { console.warn("Migration: token column rename"); }
  try { await db.exec("UPDATE recruitment_sessions SET token_hash = token_old WHERE token_hash IS NULL"); } catch { console.warn("Migration: token_hash backfill"); }
  try { await db.exec("ALTER TABLE posts ADD COLUMN author_name TEXT DEFAULT 'Anonymous'"); } catch { console.warn("Migration: author_name may already exist"); }
  try { await db.exec("ALTER TABLE posts ADD COLUMN author_association TEXT DEFAULT ''"); } catch { console.warn("Migration: author_association may already exist"); }
  try { await db.exec("ALTER TABLE posts ADD COLUMN excerpt TEXT"); } catch { console.warn("Migration: excerpt may already exist"); }
  try { await db.exec("ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'pending'"); } catch { console.warn("Migration: status may already exist"); }
  try { await db.exec("ALTER TABLE posts ADD COLUMN is_published INTEGER DEFAULT 0"); } catch { console.warn("Migration: is_published may already exist"); }
  try { await db.exec("ALTER TABLE posts ADD COLUMN updated_at DATETIME"); } catch { console.warn("Migration: updated_at may already exist"); }
  try { await db.exec("ALTER TABLE case_studies ADD COLUMN content TEXT DEFAULT ''"); } catch { console.warn("Migration: case_studies.content may already exist"); }
  try { await db.exec("ALTER TABLE case_studies ADD COLUMN image_url TEXT"); } catch { console.warn("Migration: case_studies.image_url may already exist"); }
  try { await db.exec("ALTER TABLE case_studies ADD COLUMN author_name TEXT DEFAULT 'Anonymous'"); } catch { console.warn("Migration: case_studies.author_name may already exist"); }
  try { await db.exec("ALTER TABLE case_studies ADD COLUMN created_by TEXT"); } catch { console.warn("Migration: case_studies.created_by may already exist"); }
  try { await db.exec("DELETE FROM case_studies WHERE id LIKE 'cs%' AND content IS NULL"); } catch { console.warn("Migration: could not remove seed case studies"); }
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS recruitment_sessions (
      id TEXT PRIMARY KEY, applicant_id TEXT NOT NULL, token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (applicant_id) REFERENCES recruitment_applicants(id)
    )`);
  } catch (e: any) { logError("Migration: recruitment_sessions table", e); }
  try { await db.exec("DELETE FROM rate_limits WHERE endpoint IN ('dev_login', 'recruitment_login', 'recruitment_register')"); } catch (e: any) { console.warn("Migration: clear login rate limits"); }
  try { await db.exec("ALTER TABLE users ADD COLUMN secondary_role_id TEXT"); } catch { console.warn("Migration: secondary_role_id may already exist"); }
  try { await db.exec("ALTER TABLE admin_tokens ADD COLUMN active_role_id TEXT"); } catch { console.warn("Migration: active_role_id may already exist"); }
  try { await db.exec("ALTER TABLE users ADD COLUMN ex_title TEXT"); } catch { console.warn("Migration: ex_title may already exist"); }
  try { await db.exec("ALTER TABLE users ADD COLUMN clerk_user_id TEXT"); } catch { console.warn("Migration: clerk_user_id may already exist"); }
  try { await db.exec("ALTER TABLE users ADD COLUMN oauth_enabled INTEGER DEFAULT 0"); } catch { console.warn("Migration: oauth_enabled may already exist"); }
  try { await db.exec("DROP TABLE IF EXISTS chat_messages"); } catch { console.warn("Migration: drop chat_messages"); }
  try { await db.exec("DROP INDEX IF EXISTS idx_chat_messages_room_ts"); } catch { console.warn("Migration: drop chat index"); }
  try { await db.exec("INSERT OR IGNORE INTO maintenance_mode (id, enabled, message) VALUES (1, 0, 'Site is under maintenance. Please check back later.')"); } catch { console.warn("Migration: maintenance_mode seed"); }
}

let currentEnv: any = null;

async function seedData(db: any, env?: any) {
  if (env) currentEnv = env;
  try {
    const roleSql = "INSERT OR IGNORE INTO roles (id, name, power_level, created_by) VALUES (?, ?, ?, ?)";
    await db.prepare(roleSql).bind("president", "President", 100, "system").run();
    await db.prepare(roleSql).bind("vice_president", "Vice President", 100, "system").run();
    await db.prepare(roleSql).bind("technical_director", "Technical Director", 100, "system").run();
    await db.prepare(roleSql).bind("marketing_director", "Marketing Director", 80, "system").run();
    await db.prepare(roleSql).bind("secretary", "Secretary", 80, "system").run();
    await db.prepare(roleSql).bind("lead", "Technical Lead", 50, "system").run();
    await db.prepare(roleSql).bind("lead_rnd", "R&D Lead", 50, "system").run();
    await db.prepare(roleSql).bind("lead_marketing", "Marketing Lead", 50, "system").run();
    await db.prepare(roleSql).bind("lead_social", "Social Media Lead", 50, "system").run();
    await db.prepare(roleSql).bind("lead_finance", "Finance Lead", 50, "system").run();
    await db.prepare(roleSql).bind("lead_events", "Events and Initiatives Lead", 50, "system").run();
    await db.prepare(roleSql).bind("business_strategy_director", "Business Strategy Director", 70, "system").run();
    await db.prepare(roleSql).bind("lead_cps", "Client Partner Sponsor Lead", 50, "system").run();
    await db.prepare(roleSql).bind("lead_hr", "HR Lead", 50, "system").run();
    await db.prepare(roleSql).bind("member", "General Member", 10, "system").run();
    await db.prepare(roleSql).bind("advisory", "Advisory Board", 30, "system").run();

    await db.prepare("INSERT OR IGNORE INTO users (id, name, email, role_id) VALUES (?, ?, ?, ?)").bind("anonymous", "Anonymous", "anonymous@180dc.shop", "member").run();

    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("tech", "Technical", "Handles technical infrastructure and UI").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("rnd", "Research & Development", "Handles consulting research").run();
    await db.prepare("INSERT OR REPLACE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("marketing", "Marketing", "Handles marketing, outreach, and communications").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("social_media", "Social Media", "Handles social media presence and content").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("finance", "Finance", "Handles budgeting and financial planning").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("events-initiatives", "Events and Initiatives", "Plans and executes events and club initiatives").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("client-partner-sponsor", "Client Partner Sponsor", "Manages client relationships, partnerships, and sponsorships").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("hr", "Human Resources", "Handles recruitment and people management").run();

    if (!currentEnv || (currentEnv.ENVIRONMENT || "").toLowerCase() !== "production") {
      const devToken = crypto.randomUUID().replace(/-/g, "");
      await db.prepare("INSERT OR REPLACE INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)").bind(devToken, "admin@vitstudent.ac.in", "Dev Admin", "president", "system").run();
      console.info("Dev token generated (visible only in dev mode)");
    }

    const tmCount: any = await db.prepare("SELECT COUNT(*) as cnt FROM team_members").first();
    if (tmCount && tmCount.cnt === 0) {
      const tm = "INSERT OR IGNORE INTO team_members (id, initials, name, role) VALUES (?, ?, ?, ?)";
      await db.prepare(tm).bind("tm1", "JD", "John Doe", "President").run();
      await db.prepare(tm).bind("tm2", "JS", "Jane Smith", "Director of External Relations").run();
      await db.prepare(tm).bind("tm3", "AT", "Alex Turner", "Director of Internal Relations").run();
      await db.prepare(tm).bind("tm4", "EC", "Emily Chen", "Director of L&D").run();
      await db.prepare(tm).bind("tm5", "MR", "Michael Ross", "VP of Projects").run();
      await db.prepare(tm).bind("tm6", "SL", "Sarah Lee", "Head of Marketing").run();
    }

    const bpCount: any = await db.prepare("SELECT COUNT(*) as cnt FROM blog_posts").first();
    if (bpCount && bpCount.cnt === 0) {
      const bp = "INSERT OR IGNORE INTO blog_posts (id, date, title, description) VALUES (?, ?, ?, ?)";
      await db.prepare(bp).bind("bp1", "Jan 15, 2026", "The Future of Social Impact", "How Gen-Z consultants are changing the non-profit landscape with innovative strategies and digital-first approaches.").run();
      await db.prepare(bp).bind("bp2", "Jan 10, 2026", "Strategy Frameworks 101", "A deep dive into MECE and creating effective structures for problem-solving in consulting engagements.").run();
      await db.prepare(bp).bind("bp3", "Jan 5, 2026", "Building Sustainable NGOs", "Key insights from our 20+ projects on what makes non-profits thrive in the long term.").run();
      await db.prepare(bp).bind("bp4", "Dec 28, 2025", "Student Leadership Guide", "How to lead high-performing student teams and deliver real impact for social organizations.").run();
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
    const rrCount: any = await db.prepare("SELECT COUNT(*) as cnt FROM recruitment_rounds").first();
    if (rrCount && rrCount.cnt === 0) {
      await db.prepare("INSERT OR IGNORE INTO recruitment_rounds (id, name, is_active) VALUES (?, ?, ?)").bind("round1", "Round 1", 1).run();
      await db.prepare("INSERT OR IGNORE INTO recruitment_rounds (id, name, is_active) VALUES (?, ?, ?)").bind("round2", "Round 2", 0).run();
    }

    const knownDomains = ["Technical", "Research & Development", "Marketing", "Social Media", "Finance", "Events and Initiatives", "Client Partner Sponsor", "Human Resources"];
    for (const domain of knownDomains) {
      await db.prepare("INSERT OR IGNORE INTO recruitment_domain_settings (domain_name, is_open) VALUES (?, ?)").bind(domain, 1).run();
    }
  } catch (e: any) {
    logError("Seed failed", e);
  }
}

/**
 * Middleware: Verify Authentication & Inject User Context
 * (In production, this decodes the Google/Clerk JWT token mapped to the VIT email)
 */
// CORS — runs first, handles preflight OPTIONS automatically
app.use("*", async (c, next) => {
  await next();
  c.res.headers.set("X-Content-Type-Options", "nosniff");
  c.res.headers.set("X-Frame-Options", "DENY");
  c.res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  c.res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
});

const ALLOWED_ORIGINS = [
  "https://180dc.shop",
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
    await ensureTables(c.env.DB);
    await seedData(c.env.DB);
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

  // Validate Bearer token against admin_tokens registry.
  let email = undefined as undefined | string;
  let tokenRow: any = null;
  try {
    const authHeader = c.req.header("Authorization") || "";
    if (authHeader.trim().toLowerCase().startsWith("bearer ")) {
      const token = authHeader.slice(7).trim();
      tokenRow = await c.env.DB.prepare(
        "SELECT token, email, name, role_id, revoked_at, expires_at, active_role_id FROM admin_tokens WHERE token = ?",
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

  // If token has an active_role_id (dual-role choice), override the user's role
  const tokenRowActiveRole = tokenRow?.active_role_id;
  if (tokenRowActiveRole && tokenRowActiveRole !== user.role_id) {
    const activeRole: any = await c.env.DB.prepare(
      "SELECT id, name, power_level FROM roles WHERE id = ?",
    ).bind(tokenRowActiveRole).first();
    if (activeRole) {
      user.role_id = activeRole.id;
      user.role_name = activeRole.name;
      user.power_level = activeRole.power_level;
    }
  }

  const mm: any = await c.env.DB.prepare("SELECT enabled, message FROM maintenance_mode WHERE id = 1").first();
  if (mm && mm.enabled === 1 && user.power_level < 100) {
    return c.json({ error: mm.message || "Site is under maintenance." }, 503);
  }

  c.set("user", user);
  await next();
});

/**
 * Helper to check if current user is President/VP (Power == 100)
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
      "Forbidden: Requires President or Vice President privileges.",
    );
  }
};

async function getSessionApplicant(c: any): Promise<any | null> {
  const token = c.req.header("X-Session-Token") || "";
  if (!token) return null;
  const tokenHash = await sha256Hex(token);
  await c.env.DB.prepare("DELETE FROM recruitment_sessions WHERE expires_at <= datetime('now')").run();
  const session: any = await c.env.DB.prepare(
    "SELECT sa.* FROM recruitment_sessions rs JOIN recruitment_applicants sa ON rs.applicant_id = sa.id WHERE rs.token_hash = ? AND rs.expires_at > datetime('now')",
  ).bind(tokenHash).first();
  return session || null;
}

async function sha256Hex(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------
// CONTENT ENDPOINTS (Public — landing page data)
// ---------------------------------------------------------
app.get("/api/content/case-studies", async (c) => {
  try {
    await ensureTables(c.env.DB);
    await seedData(c.env.DB, c.env);
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
    await ensureTables(c.env.DB);
    await seedData(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "content_team_members", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const rows = await c.env.DB.prepare("SELECT * FROM team_members ORDER BY created_at ASC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.get("/api/content/blog-posts", async (c) => {
  try {
    await ensureTables(c.env.DB);
    await seedData(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "content_blog_posts", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const approvedRows = await c.env.DB.prepare(
      "SELECT id, created_at, title, excerpt, image_url, author_name, author_association, slug FROM posts WHERE status = 'approved' AND is_published = 1 ORDER BY created_at DESC",
    ).all();
    return c.json({ success: true, data: approvedRows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.get("/api/content/partners", async (c) => {
  try {
    await ensureTables(c.env.DB);
    await seedData(c.env.DB, c.env);
    const rl = await checkRateLimit(c, "content_partners", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const rows = await c.env.DB.prepare("SELECT * FROM partners ORDER BY created_at ASC").all();
    return c.json({ success: true, data: rows.results || [] });
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
// ADMIN_TOKENS example: { "token123": { "email": "admin@vitstudent.ac.in", "roleId": "president", "name": "Admin" } }
// This returns the mapped email so the frontend can use it as the dev identity.
// Supports dual-role login for Technical Director (can login as lead or director).
app.post("/api/dev-login", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
      "SELECT u.email, u.name, u.role_id, u.department_id, u.secondary_role_id, r.power_level, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?",
    )
      .bind(entry.email)
      .first();

    // If user is null here, the role_id in admin_tokens doesn't match any row in roles.
    if (!user) {
      return c.json({ error: "User role misconfigured: role not found" }, 500);
    }

    await resetLoginRateLimit(c, "dev_login");

    // Dual-role support: if user has a secondary_role_id, show role choice prompt
    if (user.secondary_role_id) {
      const loginAs = body.loginAs;
      if (loginAs && loginAs !== "director") {
        // Look up the secondary role's power_level and name
        const secondaryRole: any = await c.env.DB.prepare(
          "SELECT id, name, power_level FROM roles WHERE id = ?",
        ).bind(user.secondary_role_id).first();
        if (secondaryRole) {
          // Persist the chosen role on the token for subsequent requests
          await c.env.DB.prepare(
            "UPDATE admin_tokens SET active_role_id = ? WHERE token = ?",
          ).bind(secondaryRole.id, token).run();
          return c.json({
            success: true,
            email: entry.email,
            name: user.name || entry.name,
            roleId: secondaryRole.id,
            roleName: secondaryRole.name,
            powerLevel: secondaryRole.power_level,
            departmentId: user.department_id || null,
            dualRole: true,
            dualRoleChosen: true,
          });
        }
        // Fallback: if secondary role not found, fall through to director
      }

      // Look up secondary role details for the prompt (only on first call without loginAs)
      let secondaryRoleName = null;
      if (!loginAs) {
        const sr: any = await c.env.DB.prepare(
          "SELECT name FROM roles WHERE id = ?",
        ).bind(user.secondary_role_id).first();
        secondaryRoleName = sr?.name || null;
      }

      // Default or "director" — primary role; clear any active role choice
      await c.env.DB.prepare(
        "UPDATE admin_tokens SET active_role_id = NULL WHERE token = ?",
      ).bind(token).run();
      return c.json({
        success: true,
        email: entry.email,
        name: user.name || entry.name,
        roleId: user.role_id || entry.role_id || "member",
        roleName: user.role_name || null,
        powerLevel: user.power_level ?? 10,
        departmentId: user.department_id || null,
        dualRole: true,
        dualRoleChosen: !!loginAs,
        secondaryRoleId: user.secondary_role_id,
        secondaryRoleName,
      });
  }

    // Clear any stale active_role_id (e.g. from a removed secondary_role_id)
    await c.env.DB.prepare(
      "UPDATE admin_tokens SET active_role_id = NULL WHERE token = ?",
    ).bind(token).run();

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
// FORGOT TOKEN (public — sends token to email if registered)
// ---------------------------------------------------------
app.post("/api/auth/forgot-token", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
// CLERK LOGIN (public — verifies Clerk JWT, returns session)
// ---------------------------------------------------------
app.post("/api/auth/clerk-login", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
// LINK CLERK (authenticated — links Clerk user ID to member)
// ---------------------------------------------------------
app.post("/api/auth/link-clerk", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
// UNLINK CLERK (authenticated — disconnects Google login)
// ---------------------------------------------------------
app.post("/api/auth/unlink-clerk", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
// CHAT — Lock / unlock all rooms
// ---------------------------------------------------------
app.post("/api/chat/rooms/lock-all", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden" }, 403);
    await c.env.DB.prepare("UPDATE chat_room_settings SET enabled = 0").run();
    return c.json({ success: true, locked: true });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/chat/rooms/unlock-all", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden" }, 403);
    await c.env.DB.prepare("UPDATE chat_room_settings SET enabled = 1").run();
    return c.json({ success: true, locked: false });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// DASHBOARD BOOTSTRAP (single server payload for the members page)
// ---------------------------------------------------------
app.get("/api/dashboard", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
            "SELECT token, email, name, role_id, created_by, created_at, revoked_at FROM admin_tokens ORDER BY created_at DESC",
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    const secondaryRoleId = sanitizeStr(body.secondaryRoleId) || null;

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
        { error: "Role must be lead-level or above" },
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
        "UPDATE users SET name = ?, role_id = ?, department_id = ?, secondary_role_id = ? WHERE email = ?",
      )
        .bind(name, roleId, departmentId, secondaryRoleId, email)
        .run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO users (id, name, email, role_id, department_id, secondary_role_id) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)",
      )
        .bind(name, email, roleId, departmentId, secondaryRoleId)
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
    await ensureTables(c.env.DB);
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
        "UPDATE users SET name = ?, role_id = 'advisory', ex_title = ?, department_id = ?, secondary_role_id = ? WHERE email = ?",
      ).bind(name, exTitle, memberDeptId, memberDeptId ? "member" : null, email).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO users (id, name, email, role_id, department_id, secondary_role_id, ex_title) VALUES (lower(hex(randomblob(16))), ?, ?, 'advisory', ?, ?, ?)",
      ).bind(name, email, memberDeptId, memberDeptId ? "member" : null, exTitle).run();
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
// 2. PROMOTE / CHANGE ROLE (Only Pres / VP)
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
    const secondaryRoleId = sanitizeStr(body.secondaryRoleId) || null;
    const exTitle = sanitizeStr(body.exTitle) || null;
    if (!newRoleId) {
      return c.json({ error: "Missing newRoleId" }, 400);
    }

    await c.env.DB.prepare(
      "UPDATE users SET role_id = ?, department_id = ?, secondary_role_id = ?, ex_title = ? WHERE id = ?",
    )
      .bind(newRoleId, departmentId || null, secondaryRoleId, exTitle, targetUserId)
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
            "Cannot create roles equal or greater than President/VP level (100).",
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
    await ensureTables(c.env.DB);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT u.id, u.name, u.email, u.role_id, u.department_id, u.secondary_role_id, u.ex_title, u.created_at, r.name as role_name, r.power_level, sr.name as secondary_role_name FROM users u JOIN roles r ON u.role_id = r.id LEFT JOIN roles sr ON u.secondary_role_id = sr.id ORDER BY u.name ASC",
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// Export all users as CSV for download
app.get("/api/members/export", async (c) => {
  try {
    await ensureTables(c.env.DB);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT u.name, u.email, r.name as role_name, d.name as department_name, sr.name as secondary_role_name, u.ex_title, u.created_at FROM users u JOIN roles r ON u.role_id = r.id LEFT JOIN departments d ON u.department_id = d.id LEFT JOIN roles sr ON u.secondary_role_id = sr.id ORDER BY r.power_level DESC, u.name ASC"
    ).all();

    const esc = (v: any) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n") ? '"' + s.replace(/"/g, '""') + '"' : s;
    };

    let csv = "Name,Email,Role,Department,Secondary Role,Ex.Title,Created At\r\n";
    for (const r of (rows.results || [])) {
      csv += `${esc(r.name)},${esc(r.email)},${esc(r.role_name)},${esc(r.department_name)},${esc(r.secondary_role_name)},${esc(r.ex_title)},${esc(r.created_at)}\r\n`;
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
      return c.json({ error: "Cannot transfer President/VP roles" }, 400);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
      // Both accepted — execute the swap
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
        return c.json({ error: "Cannot transfer President/VP roles" }, 400);
      }

      await c.env.DB.prepare("UPDATE users SET role_id = ? WHERE id = ?").bind(row.role_id, row.to_user_id).run();
      await c.env.DB.prepare("UPDATE users SET role_id = 'member' WHERE id = ?").bind(row.from_user_id).run();
      await c.env.DB.prepare("UPDATE role_transfers SET status = 'approved' WHERE id = ?").bind(id).run();
      return c.json({ success: true, message: "Both accepted — roles swapped" });
    }

    return c.json({ success: true, message: "You accepted — waiting for the other party" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/my-role-transfers/:id/decline", async (c) => {
  try {
    await ensureTables(c.env.DB);
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

    // Prevent deleting other Presidents
    const targetUser = await c.env.DB.prepare(
      "SELECT power_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?",
    )
      .bind(targetId)
      .first();
    const tUserOptions: any = targetUser;

    if (tUserOptions && tUserOptions.power_level === 100) {
      return c.json(
        { error: "Cannot remove another President or Vice President." },
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
  // Roles with multi-department access
  const roleDeptAccess: Record<string, string[]> = {
    marketing_director: ["marketing", "social_media"],
    business_strategy_director: ["client-partner-sponsor"],
  };
  const allowedDepts = roleDeptAccess[user.role_id];
  if (allowedDepts && allowedDepts.includes(deptId)) return true;
  if (user.power_level >= 50 && user.department_id === deptId) return true;
  throw new Error("Forbidden: you do not have access to this department");
}

// GET /api/departments/:id/overview — all department data in one call
app.get("/api/departments/:id/overview", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
    const rows = await c.env.DB.prepare("SELECT * FROM club_meets ORDER BY scheduled_at ASC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/club-meets", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
    const rows = await c.env.DB.prepare("SELECT * FROM inter_dept_meets ORDER BY scheduled_at ASC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/inter-dept-meets", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (user.power_level < 100) return c.json({ error: "Forbidden: President or VP only" }, 403);

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
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    let rows: any;
    if (user.power_level >= 100) {
      rows = await c.env.DB.prepare(
        "SELECT dm.*, d.name as department_name FROM department_meets dm JOIN departments d ON dm.department_id = d.id ORDER BY dm.scheduled_at ASC",
      ).all();
    } else if (user.department_id) {
      rows = await c.env.DB.prepare(
        "SELECT dm.*, d.name as department_name FROM department_meets dm JOIN departments d ON dm.department_id = d.id WHERE dm.department_id = ? ORDER BY dm.scheduled_at ASC",
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
    await ensureTables(c.env.DB);
    const rows = await c.env.DB.prepare("SELECT * FROM announcements ORDER BY created_at DESC").all();
    const user: any = c.get("user");
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/announcements", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: President or VP only" }, 403);
    }
    const rl = await checkRateLimit(c, "create_announcement", 5, 3600);
    if (!rl.allowed) {
      return c.json({ error: "Too many announcements. Try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const title = sanitizeStr(body.title);
    const content = sanitizeStr(body.content);
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
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: President or VP only" }, 403);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: President or VP only" }, 403);
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
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: President or VP only" }, 403);
    }
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM project_departments WHERE project_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM project_roles WHERE project_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM project_tasks WHERE project_id = ?").bind(id).run();
    await c.env.DB.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
    return c.json({ success: true, message: "Project removed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// Project role assignments
app.post("/api/projects/:id/roles", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
    const projectId = c.req.param("id");
    const user: any = c.get("user");
    await canManageProjectTasks(c, projectId);
    await c.env.DB.prepare("UPDATE project_tasks SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE project_id = ? AND status = 'pending'").bind(projectId).run();
    return c.json({ success: true, message: "All tasks completed" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/projects/:id/complete", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const projectId = c.req.param("id");
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: President or VP only" }, 403);
    }
    await c.env.DB.prepare("UPDATE projects SET status = 'completed' WHERE id = ?").bind(projectId).run();
    return c.json({ success: true, message: "Project marked as complete" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/projects/:id/reopen", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const projectId = c.req.param("id");
    const user: any = c.get("user");
    if (user.power_level < 100) {
      return c.json({ error: "Forbidden: President or VP only" }, 403);
    }
    await c.env.DB.prepare("UPDATE projects SET status = 'upcoming' WHERE id = ?").bind(projectId).run();
    return c.json({ success: true, message: "Project reopened" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// Public endpoint — returns completed projects (no auth required)
app.get("/api/projects/completed", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "public_completed_projects", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const projects = await c.env.DB.prepare(
      "SELECT id, name, description, company_org, deadline, created_at FROM projects WHERE status = 'completed' ORDER BY created_at DESC",
    ).all();
    c.header("Cache-Control", "no-cache, no-store, must-revalidate");
    return c.json({ success: true, data: projects.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// RECRUITMENT SYSTEM
// ---------------------------------------------------------

// Helper to check if user can access recruitment admin (lead+)
function canAccessRecruitAdmin(c: any) {
  const user: any = c.get("user");
  if (user.power_level >= 50) return true;
  throw new Error("Forbidden: Leads or above only");
}

// 1. Register a new applicant account
app.post("/api/recruitment/register", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkLoginRateLimit(c, "recruitment_register", 5, 60);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const name = sanitizeStr(body.name);
    const email = validateEmail(body.email);
    const password = sanitizeStr(body.password);
    if (!name || !email || !password) {
      await incrementLoginRateLimit(c, "recruitment_register");
      return c.json({ error: "Missing name, email, or password" }, 400);
    }
    if (password.length < 8) {
      await incrementLoginRateLimit(c, "recruitment_register");
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^a-zA-Z0-9]/.test(password)) {
      await incrementLoginRateLimit(c, "recruitment_register");
      return c.json({ error: "Password must contain uppercase, lowercase, a digit, and a special character" }, 400);
    }

    const existing: any = await c.env.DB.prepare("SELECT id FROM recruitment_applicants WHERE email = ?").bind(email).first();
    if (existing) {
      await resetLoginRateLimit(c, "recruitment_register");
      return c.json({ success: true, message: "Account created. You can now log in." });
    }

    const { hash: passwordHash, salt } = await hashPassword(password);

    await c.env.DB.prepare(
      "INSERT INTO recruitment_applicants (id, email, name, password_hash, salt) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)",
    ).bind(email, name, passwordHash, salt).run();

    await resetLoginRateLimit(c, "recruitment_register");
    return c.json({ success: true, message: "Account created. You can now log in." });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 2. Login applicant
app.post("/api/recruitment/login", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkLoginRateLimit(c, "recruitment_login", 10, 60);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const email = validateEmail(body.email);
    const password = sanitizeStr(body.password);
    if (!email || !password) {
      await incrementLoginRateLimit(c, "recruitment_login");
      return c.json({ error: "Missing email or password" }, 400);
    }

    const applicant: any = await c.env.DB.prepare(
      "SELECT id, email, name, password_hash, salt FROM recruitment_applicants WHERE email = ?",
    ).bind(email).first();

    if (!applicant || !applicant.salt) {
      await incrementLoginRateLimit(c, "recruitment_login");
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const valid = await verifyPassword(password, applicant.salt, applicant.password_hash);
    if (!valid) {
      await incrementLoginRateLimit(c, "recruitment_login");
      return c.json({ error: "Invalid email or password" }, 401);
    }

    // Delete old sessions for this applicant
    await c.env.DB.prepare("DELETE FROM recruitment_sessions WHERE applicant_id = ?").bind(applicant.id).run();

    // Create session token stored in DB (store SHA-256 hash, return raw token)
    const sessionToken = crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await sha256Hex(sessionToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      "INSERT INTO recruitment_sessions (id, applicant_id, token_hash, expires_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
    ).bind(applicant.id, tokenHash, expiresAt).run();

    await resetLoginRateLimit(c, "recruitment_login");

    return c.json({
      success: true,
      applicant: { id: applicant.id, email: applicant.email, name: applicant.name },
      token: sessionToken,
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 3. Submit an application (Round 1)
app.post("/api/recruitment/applications", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "recruitment_application", 3, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const sessionApplicant = await getSessionApplicant(c);
    if (!sessionApplicant) {
      return c.json({ error: "Unauthorized: please log in first" }, 401);
    }
    const applicantId = sessionApplicant.id;

    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const name = sanitizeStr(body.name);
    const email = validateEmail(body.email);
    const year = sanitizeStr(body.year);
    const course = sanitizeStr(body.course);
    const primaryDomain = sanitizeStr(body.primaryDomain);
    const secondaryDomain = sanitizeStr(body.secondaryDomain) || null;
    const whyJoin = sanitizeStr(body.whyJoin);
    const whyDomain = sanitizeStr(body.whyDomain);
    const priorExperience = sanitizeStr(body.priorExperience) || null;
    const portfolioLink = sanitizeStr(body.portfolioLink) || null;

    if (!name || !email || !year || !course || !primaryDomain || !whyJoin || !whyDomain) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Validate portfolio link if provided
    if (portfolioLink && !isValidUrl(portfolioLink)) {
      return c.json({ error: "Invalid portfolio link URL" }, 400);
    }

    // Check if the selected domain is open for recruitment
    const domainRow: any = await c.env.DB.prepare(
      "SELECT is_open FROM recruitment_domain_settings WHERE domain_name = ?",
    ).bind(primaryDomain).first();
    if (!domainRow || !domainRow.is_open) {
      return c.json({ error: "Applications are not currently open for " + primaryDomain }, 400);
    }

    // Check if already applied
    const existing: any = await c.env.DB.prepare(
      "SELECT id FROM recruitment_applications WHERE applicant_id = ?",
    ).bind(applicantId).first();
    if (existing) {
      return c.json({ error: "You have already submitted an application" }, 409);
    }

    // Get active round
    const round: any = await c.env.DB.prepare(
      "SELECT id FROM recruitment_rounds WHERE is_active = 1",
    ).first();
    if (!round) {
      return c.json({ error: "Recruitments are not currently open" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO recruitment_applications (id, applicant_id, round_id, name, email, year, course, primary_domain, secondary_domain, why_join, why_domain, prior_experience, portfolio_link, status) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')",
    ).bind(applicantId, round.id, name, email, year, course, primaryDomain, secondaryDomain, whyJoin, whyDomain, priorExperience, portfolioLink).run();

    return c.json({ success: true, message: "Application submitted successfully" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 4. Get applicant's own application status
app.get("/api/recruitment/my-application", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const sessionApplicant = await getSessionApplicant(c);
    if (!sessionApplicant) {
      return c.json({ error: "Unauthorized: please log in first" }, 401);
    }

    const app: any = await c.env.DB.prepare(
      "SELECT * FROM recruitment_applications WHERE applicant_id = ? ORDER BY created_at DESC",
    ).bind(sessionApplicant.id).first();

    if (!app) return c.json({ success: true, application: null });

    return c.json({ success: true, application: app });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 5. ADMIN: List all applications (with optional filters)
app.get("/api/recruitment/admin/applications", async (c) => {
  try {
    await ensureTables(c.env.DB);
    canAccessRecruitAdmin(c);
    const domain = c.req.query("domain");
    const status = c.req.query("status");

    let sql = "SELECT * FROM recruitment_applications WHERE 1=1";
    const params: string[] = [];

    if (domain) {
      sql += " AND (primary_domain = ? OR secondary_domain = ?)";
      params.push(domain, domain);
    }
    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY created_at DESC";

    const rows = await c.env.DB.prepare(sql).bind(...params).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 6. ADMIN: Get single application with evaluations
app.get("/api/recruitment/admin/applications/:id", async (c) => {
  try {
    await ensureTables(c.env.DB);
    canAccessRecruitAdmin(c);
    const id = c.req.param("id");

    const application: any = await c.env.DB.prepare("SELECT * FROM recruitment_applications WHERE id = ?").bind(id).first();
    if (!application) return c.json({ error: "Application not found" }, 404);

    const criteria = await c.env.DB.prepare(
      "SELECT * FROM recruitment_evaluation_criteria WHERE round_id = ? ORDER BY created_at ASC",
    ).bind(application.round_id).all();

    const evaluations = await c.env.DB.prepare(
      "SELECT re.*, rec.name as criterion_name, u.name as evaluator_name FROM recruitment_evaluations re JOIN recruitment_evaluation_criteria rec ON re.criterion_id = rec.id JOIN users u ON re.evaluator_id = u.id WHERE re.application_id = ? ORDER BY rec.name ASC",
    ).bind(id).all();

    return c.json({
      success: true,
      application,
      criteria: criteria.results || [],
      evaluations: evaluations.results || [],
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 7. ADMIN: Add evaluation criteria for a round
app.post("/api/recruitment/admin/evaluation-criteria", async (c) => {
  try {
    await ensureTables(c.env.DB);
    canAccessRecruitAdmin(c);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const roundId = sanitizeStr(body.roundId);
    const name = sanitizeStr(body.name);
    const maxScore = body.maxScore;

    if (!roundId || !name || typeof maxScore !== "number") {
      return c.json({ error: "Missing roundId, name, or maxScore" }, 400);
    }
    if (maxScore <= 0 || maxScore > 100) {
      return c.json({ error: "maxScore must be between 1 and 100" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO recruitment_evaluation_criteria (id, round_id, name, max_score) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
    ).bind(roundId, name, maxScore).run();

    return c.json({ success: true, message: "Evaluation criterion added" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 8. ADMIN: List evaluation criteria
app.get("/api/recruitment/admin/evaluation-criteria", async (c) => {
  try {
    await ensureTables(c.env.DB);
    canAccessRecruitAdmin(c);
    const roundId = c.req.query("roundId");
    if (!roundId) return c.json({ error: "Missing roundId" }, 400);

    const rows = await c.env.DB.prepare(
      "SELECT * FROM recruitment_evaluation_criteria WHERE round_id = ? ORDER BY created_at ASC",
    ).bind(roundId).all();

    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 9. ADMIN: Add/update evaluation score for an applicant
app.post("/api/recruitment/admin/evaluations", async (c) => {
  try {
    await ensureTables(c.env.DB);
    canAccessRecruitAdmin(c);
    const user: any = c.get("user");
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const applicationId = sanitizeStr(body.applicationId);
    const criterionId = sanitizeStr(body.criterionId);
    const score = body.score;
    const comment = sanitizeStr(body.comment) || null;

    if (!applicationId || !criterionId || typeof score !== "number") {
      return c.json({ error: "Missing applicationId, criterionId, or score" }, 400);
    }
    if (score < 0) {
      return c.json({ error: "Score cannot be negative" }, 400);
    }
    const criterion: any = await c.env.DB.prepare("SELECT max_score FROM recruitment_evaluation_criteria WHERE id = ?").bind(criterionId).first();
    if (!criterion) return c.json({ error: "Evaluation criterion not found" }, 400);
    if (score > criterion.max_score) {
      return c.json({ error: "Score cannot exceed max_score of " + criterion.max_score }, 400);
    }

    // Check if evaluation already exists
    const existing: any = await c.env.DB.prepare(
      "SELECT id FROM recruitment_evaluations WHERE application_id = ? AND criterion_id = ? AND evaluator_id = ?",
    ).bind(applicationId, criterionId, user.id).first();

    if (existing) {
      await c.env.DB.prepare(
        "UPDATE recruitment_evaluations SET score = ?, comment = ? WHERE id = ?",
      ).bind(score, comment, existing.id).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO recruitment_evaluations (id, application_id, criterion_id, evaluator_id, score, comment) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)",
      ).bind(applicationId, criterionId, user.id, score, comment).run();
    }

    return c.json({ success: true, message: "Evaluation saved" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 10. ADMIN: Update application status (shortlist/reject/select)
app.put("/api/recruitment/admin/applications/:id/status", async (c) => {
  try {
    await ensureTables(c.env.DB);
    canAccessRecruitAdmin(c);
    const id = c.req.param("id");
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const status = sanitizeStr(body.status);

    if (!status || !["pending", "shortlisted", "selected", "rejected"].includes(status)) {
      return c.json({ error: "Invalid status" }, 400);
    }

    await c.env.DB.prepare("UPDATE recruitment_applications SET status = ? WHERE id = ?").bind(status, id).run();
    await addAuditLog(c, "application_status_change", "recruitment_application", id, "Status changed to " + status);
    return c.json({ success: true, message: "Status updated to " + status });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 11. ADMIN: Bulk shortlist — auto-shortlist top N applicants by total score
app.post("/api/recruitment/admin/bulk-shortlist", async (c) => {
  try {
    await ensureTables(c.env.DB);
    canAccessRecruitAdmin(c);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const count = body.count;
    const roundId = sanitizeStr(body.roundId);
    if (!roundId || typeof count !== "number" || count < 1) {
      return c.json({ error: "Missing roundId or invalid count" }, 400);
    }

    // Get all pending applications with their total evaluation scores
    const rows: any = await c.env.DB.prepare(
      `SELECT ra.id, COALESCE(SUM(re.score), 0) as total_score
       FROM recruitment_applications ra
       LEFT JOIN recruitment_evaluations re ON ra.id = re.application_id
       WHERE ra.round_id = ? AND ra.status = 'pending'
       GROUP BY ra.id
       ORDER BY total_score DESC`,
    ).bind(roundId).all();

    const applicants = rows.results || [];
    const toShortlist = applicants.slice(0, count);

    for (const app of toShortlist) {
      await c.env.DB.prepare("UPDATE recruitment_applications SET status = 'shortlisted' WHERE id = ?").bind(app.id).run();
    }

    return c.json({
      success: true,
      message: `Shortlisted ${toShortlist.length} applicants`,
      shortlisted: toShortlist,
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 12. ADMIN: Get recruitment domain settings
app.get("/api/recruitment/admin/settings", async (c) => {
  try {
    await ensureTables(c.env.DB);
    canAccessRecruitAdmin(c);
    const rows = await c.env.DB.prepare("SELECT * FROM recruitment_domain_settings ORDER BY domain_name ASC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 13. ADMIN: Update recruitment domain settings (President/VP only)
app.put("/api/recruitment/admin/settings", async (c) => {
  try {
    await ensureTables(c.env.DB);
    requireBoard(c);
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const openDomains = body.openDomains;
    if (!Array.isArray(openDomains)) {
      return c.json({ error: "openDomains must be an array of domain names" }, 400);
    }
    const sanitizedDomains = openDomains.map((d: any) => String(d).trim()).filter(Boolean);
    const user: any = c.get("user");
    await c.env.DB.prepare("UPDATE recruitment_domain_settings SET is_open = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP").bind(user.id).run();
    if (sanitizedDomains.length > 0) {
      const placeholders = sanitizedDomains.map(() => "?").join(",");
      await c.env.DB.prepare(
        `UPDATE recruitment_domain_settings SET is_open = 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE domain_name IN (${placeholders})`,
      ).bind(user.id, ...sanitizedDomains).run();
    }
    return c.json({ success: true, message: "Recruitment settings updated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 14. PUBLIC: Get list of domains currently open for applications
app.get("/api/recruitment/open-domains", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "recruitment_open_domains", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const rows = await c.env.DB.prepare("SELECT domain_name FROM recruitment_domain_settings WHERE is_open = 1 ORDER BY domain_name ASC").all();
    return c.json({ success: true, data: (rows.results || []).map((r: any) => r.domain_name) });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// BLOG POSTS (with R2 image upload)
// ---------------------------------------------------------

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "post";
}

const ALLOWED_IMG_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMG_SIZE = 10 * 1024 * 1024; // 10 MB

// 1. Upload image to R2 (anonymous, rate-limited)
app.post("/api/blogs/upload-image", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "blog_upload_image", 20, 3600);
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
    const key = `blogs/${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await typedFile.arrayBuffer();
    await c.env.BLOG_IMAGES.put(key, arrayBuffer, {
      httpMetadata: { contentType: typedFile.type },
    });

    const url = `/api/blogs/images/${key}`;

    return c.json({ success: true, url, key });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 1b. Serve blog image from R2 (public)
app.get("/api/blogs/images/*", async (c) => {
  try {
    const rl = await checkRateLimit(c, "blog_image_serve", 200, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const url = new URL(c.req.url);
    const prefix = "/api/blogs/images/";
    let key = decodeURIComponent(url.pathname);

    if (key.startsWith(prefix)) {
      key = key.slice(prefix.length);
    } else {
      key = key.replace(/^\/+/, "");
    }

    if (!key || key.includes("..")) return c.json({ error: "Invalid key" }, 400);

    const obj = await c.env.BLOG_IMAGES.get(key);
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

// ─────────────────────────────────────────────
// CASE STUDY IMAGE UPLOAD & SERVE (uses same R2 bucket, separate folder)
// ─────────────────────────────────────────────

app.post("/api/case-studies/upload-image", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
    const key = `case-studies/${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await typedFile.arrayBuffer();
    await c.env.BLOG_IMAGES.put(key, arrayBuffer, {
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

    const obj = await c.env.BLOG_IMAGES.get(key);
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
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden: Members only" }, 403);

    const { key } = await c.req.json();
    if (!key || typeof key !== "string") return c.json({ error: "Image key is required" }, 400);
    if (!key.startsWith("case-studies/")) return c.json({ error: "Invalid image key" }, 400);

    await c.env.BLOG_IMAGES.delete(key);
    return c.json({ success: true, message: "Image deleted" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 2. Create a blog post (anonymous, rate-limited)
app.post("/api/blogs", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "create_blog", 1, 86400);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded. You can only post one blog per day.", retryAfter: rl.retryAfter }, 429);

    const body = await c.req.json();
    if (!body || typeof body !== "object") return c.json({ error: "Invalid request body" }, 400);

    const title = sanitizeStr(body.title);
    const rawContent = body.content;
    const excerpt = sanitizeStr(body.excerpt);
    const imageUrl = sanitizeStr(body.imageUrl);
    const rawSlug = sanitizeStr(body.slug) || slugify(title || "");
    const authorName = sanitizeStr(body.authorName) || "Anonymous";
    const authorAssociation = sanitizeStr(body.authorAssociation) || "";

    if (!title || typeof title !== "string" || title.length < 3) {
      return c.json({ error: "Title must be at least 3 characters" }, 400);
    }
    if (!rawContent || typeof rawContent !== "string" || rawContent.length < 10) {
      return c.json({ error: "Content must be at least 10 characters" }, 400);
    }
    if (rawContent.length > 100000) {
      return c.json({ error: "Content too long (max 100,000 chars)" }, 400);
    }

    const content = sanitizeBlogHtml(rawContent);
    const textOnly = content.replace(/<[^>]*>/g, "").trim();
    if (textOnly.length < 10) {
      return c.json({ error: "Content must contain at least 10 visible characters after sanitization" }, 400);
    }

    // Generate unique slug
    let slug = rawSlug;
    let slugSuffix = 0;
    while (true) {
      const existing: any = await c.env.DB.prepare("SELECT id FROM posts WHERE slug = ?").bind(slug).first();
      if (!existing) break;
      slugSuffix++;
      slug = `${rawSlug}-${slugSuffix}`;
    }

    const id = crypto.randomUUID().replace(/-/g, "");
    await c.env.DB.prepare(
      "INSERT INTO posts (id, title, slug, content, excerpt, image_url, author_id, author_name, author_association, status, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)",
    ).bind(id, title, slug, content, excerpt || null, imageUrl || null, "anonymous", authorName, authorAssociation).run();

    return c.json({ success: true, message: "Blog post submitted for review", id, slug, status: "pending" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 3. Get approved/published blogs (public)
app.get("/api/blogs", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "public_blogs", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const rows = await c.env.DB.prepare(
      "SELECT id, title, slug, excerpt, image_url, author_name, author_association, created_at FROM posts WHERE status = 'approved' AND is_published = 1 ORDER BY created_at DESC LIMIT 50",
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 4. Get all blogs for admin (power >= 50)
app.get("/api/blogs/admin", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (!user || user.power_level < 50) return c.json({ error: "Forbidden: Lead or above only" }, 403);

    const rows = await c.env.DB.prepare(
      "SELECT p.id, p.title, p.slug, p.content, p.excerpt, p.image_url, p.author_name, p.author_association, p.status, p.is_published, p.created_at, p.updated_at FROM posts p ORDER BY p.created_at DESC LIMIT 100",
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 5. Get single blog by slug (public)
app.get("/api/blogs/:slug", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "public_blog_single", 100, 60);
    if (!rl.allowed) return c.json({ error: "Rate limit exceeded", retryAfter: rl.retryAfter }, 429);
    const slug = c.req.param("slug");
    const row: any = await c.env.DB.prepare(
      "SELECT id, title, slug, content, excerpt, image_url, author_name, author_association, created_at FROM posts WHERE (slug = ? OR id = ?) AND status = 'approved' AND is_published = 1",
    ).bind(slug, slug).first();

    if (!row) return c.json({ error: "Blog not found" }, 404);
    return c.json({ success: true, data: row });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 6. Approve a blog post (power >= 100)
app.put("/api/blogs/:id/approve", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "blog_approve", 20, 60);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: President/VP only" }, 403);

    const id = c.req.param("id");
    const row: any = await c.env.DB.prepare("SELECT id, status, title FROM posts WHERE id = ?").bind(id).first();
    if (!row) return c.json({ error: "Blog not found" }, 404);
    if (row.status !== "pending") return c.json({ error: "Blog already processed (current: " + row.status + ")" }, 400);

    await c.env.DB.prepare("UPDATE posts SET status = 'approved', is_published = 1, updated_at = datetime('now') WHERE id = ?").bind(id).run();
    await addAuditLog(c, "blog_approved", "post", id, "Blog approved: " + row.title);

    return c.json({ success: true, message: "Blog approved and published" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 7. Reject a blog post (power >= 100) — also deletes associated images from R2
app.put("/api/blogs/:id/reject", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "blog_reject", 20, 60);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: President/VP only" }, 403);

    const id = c.req.param("id");
    const row: any = await c.env.DB.prepare("SELECT id, status, title, content, image_url FROM posts WHERE id = ?").bind(id).first();
    if (!row) return c.json({ error: "Blog not found" }, 404);
    if (row.status !== "pending") return c.json({ error: "Blog already processed (current: " + row.status + ")" }, 400);

    await c.env.DB.prepare("UPDATE posts SET status = 'rejected', is_published = 0, updated_at = datetime('now') WHERE id = ?").bind(id).run();
    await addAuditLog(c, "blog_rejected", "post", id, "Blog rejected: " + row.title);

    // Delete associated images from R2
    try {
      const keys = new Set<string>();
      // Featured image
      if (row.image_url) {
        const m = row.image_url.match(/\/api\/blogs\/images\/(blogs\/[^"'\s?]+)/);
        if (m) keys.add(m[1]);
      }
      // Images in content
      if (row.content) {
        const imgRe = /<img[^>]+src="\/api\/blogs\/images\/(blogs\/[^"']+?)"/gi;
        let match;
        while ((match = imgRe.exec(row.content)) !== null) {
          keys.add(match[1]);
        }
      }
      for (const key of keys) {
        await c.env.BLOG_IMAGES.delete(key).catch(() => {});
      }
    } catch {}

    return c.json({ success: true, message: "Blog rejected" });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 7a. Edit any blog post (power >= 100)
app.put("/api/blogs/:id/edit", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "blog_edit", 20, 60);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: President/VP only" }, 403);

    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT id FROM posts WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Blog not found" }, 404);

    const body = await c.req.json();
    const title = sanitizeStr(body.title);
    const rawContent = body.content;
    const excerpt = sanitizeStr(body.excerpt);
    const imageUrl = sanitizeStr(body.imageUrl);
    const authorName = sanitizeStr(body.authorName);
    const authorAssociation = sanitizeStr(body.authorAssociation);
    const rawSlug = sanitizeStr(body.slug);

    if (!title || typeof title !== "string" || title.length < 3) {
      return c.json({ error: "Title must be at least 3 characters" }, 400);
    }
    if (!rawContent || typeof rawContent !== "string" || rawContent.length < 10) {
      return c.json({ error: "Content must be at least 10 characters" }, 400);
    }
    if (rawContent.length > 100000) {
      return c.json({ error: "Content too long (max 100,000 chars)" }, 400);
    }

    const content = sanitizeBlogHtml(rawContent);
    const slug = rawSlug ? slugify(rawSlug) : slugify(title);
    const updatedAt = new Date().toISOString();

    await c.env.DB.prepare(
      "UPDATE posts SET title = ?, content = ?, excerpt = ?, image_url = ?, author_name = ?, author_association = ?, slug = ?, updated_at = ? WHERE id = ?",
    ).bind(title, content, excerpt || null, imageUrl || null, authorName, authorAssociation, slug, updatedAt, id).run();

    await addAuditLog(c, "blog_updated", "post", id, "Blog updated: " + title);

    return c.json({ success: true, message: "Blog updated", slug });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 7b. Delete a blog post permanently (power >= 100)
app.delete("/api/blogs/:id", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "blog_delete", 20, 60);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 100) return c.json({ error: "Forbidden: President/VP only" }, 403);

    const id = c.req.param("id");
    const row: any = await c.env.DB.prepare("SELECT id, title, content, image_url FROM posts WHERE id = ?").bind(id).first();
    if (!row) return c.json({ error: "Blog not found" }, 404);

    // Delete associated images from R2
    try {
      const keys = new Set<string>();
      if (row.image_url) {
        const m = row.image_url.match(/\/api\/blogs\/images\/(blogs\/[^"'\s?]+)/);
        if (m) keys.add(m[1]);
      }
      if (row.content) {
        const imgRe = /<img[^>]+src="\/api\/blogs\/images\/(blogs\/[^"']+?)"/gi;
        let match;
        while ((match = imgRe.exec(row.content)) !== null) {
          keys.add(match[1]);
        }
      }
      for (const key of keys) {
        await c.env.BLOG_IMAGES.delete(key).catch(() => {});
      }
    } catch {}

    await c.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
    await addAuditLog(c, "blog_deleted", "post", id, "Blog deleted: " + row.title);

    return c.json({ success: true, message: "Blog permanently deleted" });
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
    await ensureTables(c.env.DB);
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

// 2. Admin: List all consulting requests (President/VP only)
app.get("/api/consulting-requests", async (c) => {
  try {
    await ensureTables(c.env.DB);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT * FROM consulting_requests ORDER BY created_at DESC",
    ).all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// 3. Admin: Accept a consulting request with custom email (President/VP only)
app.post("/api/consulting-requests/:id/accept", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
          from: "180DC Consulting <noreply@180dc.shop>",
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
<img src="https://180dc.shop/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">Consulting Request Update</h1>
</td></tr>
<tr><td style="padding:28px">
<div style="font-size:14px;color:#555555;margin:0;line-height:1.8;white-space:pre-wrap">${escapeHtml(emailBody).replace(/\n/g, "<br>")}</div>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting — VIT Chennai</p>
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

// 4. Admin: Reject a consulting request with custom email (President/VP only)
app.post("/api/consulting-requests/:id/reject", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
          from: "180DC Consulting <noreply@180dc.shop>",
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
<img src="https://180dc.shop/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">Consulting Request Update</h1>
</td></tr>
<tr><td style="padding:28px">
<div style="font-size:14px;color:#555555;margin:0;line-height:1.8;white-space:pre-wrap">${escapeHtml(emailBody).replace(/\n/g, "<br>")}</div>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting — VIT Chennai</p>
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "case_study_create", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden: Members only" }, 403);

    const body = await c.req.json();
    const tag = sanitizeStr(body.tag);
    const title = sanitizeStr(body.title);
    const description = sanitizeStr(body.description);
    const rawContent = body.content;
    const imageUrl = sanitizeStr(body.imageUrl);

    if (!tag) return c.json({ error: "Tag is required (e.g. Strategy, Operations)" }, 400);
    if (!title || title.length < 3) return c.json({ error: "Title must be at least 3 characters" }, 400);
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
      "INSERT INTO case_studies (id, tag, title, description, content, image_url, author_name, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(id, tag, title, description || "", content, imageUrl || null, authorName, user.id).run();

    await addAuditLog(c, "case_study_created", "case_study", id, "Case study created: " + title);

    return c.json({ success: true, message: "Case study published", id });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 2. List all case studies for admin/members (authenticated, power >= 10)
app.get("/api/case-studies", async (c) => {
  try {
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (!user || user.power_level < 50) return c.json({ error: "Forbidden: Lead or above only" }, 403);

    const id = c.req.param("id");
    const row: any = await c.env.DB.prepare("SELECT id, title FROM case_studies WHERE id = ?").bind(id).first();
    if (!row) return c.json({ error: "Case study not found" }, 404);

    await c.env.DB.prepare("DELETE FROM case_studies WHERE id = ?").bind(id).run();
    await addAuditLog(c, "case_study_deleted", "case_study", id, "Case study deleted: " + row.title);

    return c.json({ success: true, message: "Case study deleted" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 4. Edit a case study (authenticated, power >= 10)
app.put("/api/case-studies/:id", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "case_study_edit", 20, 3600);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user || user.power_level < 10) return c.json({ error: "Forbidden: Members only" }, 403);

    const id = c.req.param("id");
    const existing: any = await c.env.DB.prepare("SELECT id FROM case_studies WHERE id = ?").bind(id).first();
    if (!existing) return c.json({ error: "Case study not found" }, 404);

    const body = await c.req.json();
    const tag = sanitizeStr(body.tag);
    const title = sanitizeStr(body.title);
    const description = sanitizeStr(body.description);
    const rawContent = body.content;
    const imageUrl = sanitizeStr(body.imageUrl);

    if (!tag) return c.json({ error: "Tag is required" }, 400);
    if (!title || title.length < 3) return c.json({ error: "Title must be at least 3 characters" }, 400);
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
      "UPDATE case_studies SET tag = ?, title = ?, description = ?, content = ?, image_url = ? WHERE id = ?",
    ).bind(tag, title, description || "", content, imageUrl || null, id).run();

    await addAuditLog(c, "case_study_updated", "case_study", id, "Case study updated: " + title);

    return c.json({ success: true, message: "Case study updated" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 6. Admin: Send arbitrary email (President/VP only)
app.post("/api/send-email", async (c) => {
  try {
    await ensureTables(c.env.DB);
    requireBoard(c);
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
    const validRecipients = recipients.filter((e: string) => EMAIL_RE.test(e));
    if (validRecipients.length === 0) {
      return c.json({ error: "No valid email addresses provided" }, 400);
    }

    for (const recipient of validRecipients) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "180DC Admin <noreply@180dc.shop>",
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
<img src="https://180dc.shop/images/180DC.png" alt="180DC" width="48" style="margin-bottom:6px">
<h1 style="font-family:'Caveat',cursive;color:#ffffff;font-size:24px;margin:0">180DC Admin Message</h1>
</td></tr>
<tr><td style="padding:28px">
<div style="font-size:14px;color:#555555;margin:0;line-height:1.8;white-space:pre-wrap">${escapeHtml(htmlBody).replace(/\n/g, "<br>")}</div>
</td></tr>
<tr><td style="background:#f5f3ee;border-top:3px solid #1a1a1a;padding:14px 28px;text-align:center">
<p style="font-size:11px;color:#555555;margin:0;line-height:1.5;font-weight:600">180 Degrees Consulting — VIT Chennai</p>
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
// CHAT ROOM SETTINGS — enable/disable rooms
// ---------------------------------------------------------
app.get("/api/chat/rooms", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { results } = await c.env.DB.prepare("SELECT * FROM chat_room_settings").all();
    return c.json({ success: true, data: results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.post("/api/chat/rooms/:room/toggle", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const user: any = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const room = c.req.param("room");
    const isDeptRoom = room.startsWith("dept-");
    const deptId = isDeptRoom ? room.replace("dept-", "") : null;

    let canManage = false;
    if (user.power_level >= 100) {
      canManage = true;
    } else if (user.power_level >= 50 && isDeptRoom && (() => {
      if (user.department_id === deptId) return true;
      const roleDeptAccess: Record<string, string[]> = { marketing_director: ["marketing", "social_media"], business_strategy_director: ["client-partner-sponsor"] };
      const allowedDepts = roleDeptAccess[user.role_id];
      return allowedDepts && allowedDepts.includes(deptId);
    })()) {
      canManage = true;
    }

    if (!canManage) return c.json({ error: "Forbidden" }, 403);

    const existing: any = await c.env.DB.prepare("SELECT enabled FROM chat_room_settings WHERE room = ?").bind(room).first();
    const currentEnabled = existing ? existing.enabled : 1;
    const newEnabled = currentEnabled ? 0 : 1;

    await c.env.DB.prepare(
      "INSERT INTO chat_room_settings (room, enabled) VALUES (?, ?) ON CONFLICT(room) DO UPDATE SET enabled = ?"
    ).bind(room, newEnabled, newEnabled).run();

    return c.json({ success: true, enabled: !!newEnabled });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// CHAT — Session init (auth'd users get a WS sessionId)
// ---------------------------------------------------------
app.post("/api/chat/init", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "chat_init", 30, 60);
    if (!rl.allowed) return c.json({ error: "Too many requests", retryAfter: rl.retryAfter }, 429);
    const user: any = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const room = body.room || "advisory";

    // Check if room is enabled
    const setting: any = await c.env.DB.prepare("SELECT enabled FROM chat_room_settings WHERE room = ?").bind(room).first();
    if (setting && !setting.enabled) return c.json({ error: "This chat room is currently disabled" }, 403);

    // Validate room access
    const canAccessAdvisory = user.role_id === "advisory" || user.power_level >= 50;
    const canAccessGeneral = user.power_level >= 10 && user.role_id !== "advisory";
    const canAccessBoard = user.power_level >= 100;
    const canAccessDept = room.startsWith("dept-") && (() => {
      if (user.power_level >= 100) return true;
      const roleDeptAccess: Record<string, string[]> = {
        marketing_director: ["marketing", "social_media"],
        business_strategy_director: ["client-partner-sponsor"],
      };
      const allowedDepts = roleDeptAccess[user.role_id];
      if (allowedDepts && allowedDepts.includes(room.replace("dept-", ""))) return true;
      if (user.department_id === room.replace("dept-", "")) return true;
      return false;
    })();

    let allowed = false;
    if (room === "advisory") allowed = canAccessAdvisory;
    else if (room === "general") allowed = canAccessGeneral;
    else if (room === "board") allowed = canAccessBoard;
    else if (room.startsWith("dept-")) allowed = canAccessDept;
    else allowed = canAccessGeneral;

    if (!allowed) return c.json({ error: "Forbidden" }, 403);

    const sessionId = crypto.randomUUID().replace(/-/g, "");
    const doId = c.env.CHAT_ROOM.idFromName("room-" + room);
    const stub = c.env.CHAT_ROOM.get(doId);

    await stub.fetch("https://internal/register", {
      method: "POST",
      body: JSON.stringify({
        sessionId,
        room,
        userInfo: {
          userId: user.id,
          userName: user.name,
          userEmail: user.email,
          userRole: user.name === "Kevin Daniel" || user.email === "admin@vitstudent.ac.in" || user.email === "kevindaniel.2025@vitstudent.ac.in" ? "test_account" : user.role_id,
          isTestAccount: user.name === "Kevin Daniel" || user.email === "admin@vitstudent.ac.in" || user.email === "kevindaniel.2025@vitstudent.ac.in",
        },
      }),
      headers: { "Content-Type": "application/json" },
    });

    return c.json({ success: true, sessionId, room });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// Load archived messages (older than 6 months)
app.get("/api/chat/archive", async (c) => {
  try {
    const user: any = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const room = c.req.query("room") || "advisory";
    const before = parseInt(c.req.query("before") || String(Date.now()), 10);
    const limit = Math.min(parseInt(c.req.query("limit") || "50", 10), 200);

    // Same room access validation as /api/chat/init
    const canAccessAdvisory = user.role_id === "advisory" || user.power_level >= 50;
    const canAccessGeneral = user.power_level >= 10 && user.role_id !== "advisory";
    const canAccessBoard = user.power_level >= 100;
    let allowed = false;
    if (room === "advisory") allowed = canAccessAdvisory;
    else if (room === "general") allowed = canAccessGeneral;
    else if (room === "board") allowed = canAccessBoard;
    else if (room.startsWith("dept-")) allowed = user.power_level >= 100 || user.department_id === room.replace("dept-", "");
    else allowed = canAccessGeneral;
    if (!allowed) return c.json({ error: "Forbidden" }, 403);

    if (!c.env.ARCHIVE_DB) return c.json({ messages: [] });

    // Sanitize room to prevent glob/pattern injection
    const allowedRoom = typeof room === "string" ? room.replace(/[^a-z0-9\-]/gi, "") : "advisory";

    const { results } = await c.env.ARCHIVE_DB.prepare(
      "SELECT * FROM chat_archive WHERE room = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?"
    ).bind(allowedRoom, before, limit).all();

    const messages = (results || []).map((r: any) => ({
      id: r.id,
      userId: r.user_id,
      userName: r.user_name,
      userRole: r.user_role,
      content: r.content,
      timestamp: r.created_at,
      isTestAccount: !!r.is_test_account,
      mentions: r.mentions ? JSON.parse(r.mentions) : undefined,
      type: r.type === "poll" ? "poll" : undefined,
      poll: r.poll_data ? JSON.parse(r.poll_data) : undefined,
    })).reverse();

    return c.json({ messages });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// ---------------------------------------------------------
// CLUB FILES ENDPOINTS (R2 only — metadata stored as custom metadata on objects)
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
    await ensureTables(c.env.DB);
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
    await ensureTables(c.env.DB);
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
// MAINTENANCE MODE (President/VP only)
// ---------------------------------------------------------

// GET /api/admin/maintenance — check maintenance status
app.get("/api/admin/maintenance", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const mm: any = await c.env.DB.prepare("SELECT enabled, message FROM maintenance_mode WHERE id = 1").first();
    return c.json({ enabled: mm?.enabled === 1, message: mm?.message || "" });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// POST /api/admin/maintenance — toggle maintenance mode (power >= 100)
app.post("/api/admin/maintenance", async (c) => {
  try {
    await ensureTables(c.env.DB);
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

// ---------------------------------------------------------
// CHAT ROOM DURABLE OBJECT
// ---------------------------------------------------------
const MSG_RETENTION_MS = 180 * 24 * 60 * 60 * 1000; // 6 months

export class ChatRoomDO {
  state: any;
  env: any;
  connections: Map<any, any>;
  connById: Map<string, any>;
  messages: any[];
  polls: any[];
  room: string;
  rateLimits: Map<string, { count: number; windowStart: number }>;

  constructor(state: any, env: any) {
    this.state = state;
    this.env = env;
    this.connections = new Map();
    this.connById = new Map();
    this.messages = [];
    this.polls = [];
    this.room = "";
    this.rateLimits = new Map();
  }

  async fetch(request: Request) {
    const url = new URL(request.url);

    // Register a session — called from POST /api/chat/init
    if (url.pathname === "/register" && request.method === "POST") {
      const body: any = await request.json();
      this.room = body.room || "advisory";
      await this.state.storage.put("room", this.room);
      await this.state.storage.put("session:" + body.sessionId, JSON.stringify(body.userInfo));
      await this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
      return new Response(JSON.stringify({ success: true }));
    }

    // WebSocket upgrade — called from the main worker's fetch handler
    if (url.pathname === "/api/chat/ws") {
      const sessionId = url.searchParams.get("sessionId");
      if (!sessionId) return new Response("Missing sessionId", { status: 400 });

      const raw = await this.state.storage.get("session:" + sessionId);
      if (!raw) return new Response("Invalid or expired session", { status: 401 });
      const userInfo = JSON.parse(raw);
      await this.state.storage.delete("session:" + sessionId);

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Create a persistent connection ID
      const connId = crypto.randomUUID().replace(/-/g, "");
      (server as any)._connId = connId;

      const entry: any = { ...userInfo, ws: server, connId };
      this.connections.set(server, entry);
      this.connById.set(connId, entry);

      // Persist in DO storage for restart recovery
      const stored = await this.state.storage.get("conn:" + connId);
      if (!stored) {
        await this.state.storage.put("conn:" + connId, JSON.stringify(userInfo));
      }

      this.state.acceptWebSocket(server);

      // Load all messages from DO storage
      if (this.messages.length === 0) {
        this.messages = await this._loadAllMessages();
      }
      if (this.polls.length === 0) {
        const pollStored = await this.state.storage.get("polls");
        if (pollStored) this.polls = pollStored;
      }
      if (!this.room) {
        const roomStored = await this.state.storage.get("room");
        if (roomStored) this.room = roomStored;
      }

      // Filter to last 6 months
      const cutoff = Date.now() - MSG_RETENTION_MS;
      const recentMessages = this.messages.filter((m: any) => m.timestamp > cutoff);

      // Send history + online users + polls to the new connection
      server.send(JSON.stringify({
        type: "history",
        connId,
        messages: recentMessages,
        onlineUsers: Array.from(this.connections.values()).map((c: any) => ({
          userId: c.userId, userName: c.userName, userRole: c.userRole,
        })),
        currentUser: { userId: userInfo.userId, userName: userInfo.userName, userRole: userInfo.userRole, isTestAccount: userInfo.isTestAccount },
        polls: this.polls,
      }));

      // Broadcast user joined
      this.broadcast({ type: "user_joined", userId: userInfo.userId, userName: userInfo.userName, userRole: userInfo.userRole }, server);

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    let data: any;
    try { data = JSON.parse(raw); } catch { return; }

    const sender = await this._resolveSender(ws, data);
    if (!sender) return;

    const throttled = this._checkChatRateLimit(ws, sender, data.type);
    if (throttled) return;

    if (data.type === "message") { await this._handleChatMessage(ws, sender, data); return; }
    if (data.type === "typing") { this._handleTyping(ws, sender, data); return; }
    if (data.type === "create_poll") { await this._handleCreatePoll(ws, sender, data); return; }
    if (data.type === "vote") { await this._handleVote(ws, sender, data); return; }
    if (data.type === "close_poll") { await this._handleClosePoll(ws, sender, data); return; }
    if (data.type !== "ping") {
      try { ws.send(JSON.stringify({ type: "_echo", received: data, senderId: sender.userId })); } catch {}
    }
  }

  async _resolveSender(ws: WebSocket, data: any) {
    let sender = this.connections.get(ws);
    if (!sender && data.connId) {
      sender = this.connById.get(data.connId);
      if (!sender) {
        try {
          const rawStored = await this.state.storage.get("conn:" + data.connId);
          if (rawStored) {
            const userInfo = JSON.parse(rawStored);
            sender = { ...userInfo, ws, connId: data.connId };
            this.connById.set(data.connId, sender);
            this.connections.set(ws, sender);
          }
        } catch {}
      }
    }
    if (!sender && (ws as any)._connId) {
      sender = this.connById.get((ws as any)._connId);
      if (!sender) {
        try {
          const rawStored = await this.state.storage.get("conn:" + (ws as any)._connId);
          if (rawStored) {
            const userInfo = JSON.parse(rawStored);
            sender = { ...userInfo, ws, connId: (ws as any)._connId };
            this.connById.set((ws as any)._connId, sender);
            this.connections.set(ws, sender);
          }
        } catch {}
      }
    }
    return sender;
  }

  _checkChatRateLimit(ws: WebSocket, sender: any, type: string) {
    if (type !== "message" && type !== "create_poll") return false;
    const now = Date.now();
    const windowMs = 1000;
    const maxPerWindow = 10;
    let rl = this.rateLimits.get(sender.userId);
    if (!rl || now - rl.windowStart > windowMs) {
      rl = { count: 0, windowStart: now };
      this.rateLimits.set(sender.userId, rl);
    }
    rl.count++;
    if (rl.count > maxPerWindow) {
      try { ws.send(JSON.stringify({ type: "rate_limited", retryAfter: Math.ceil((rl.windowStart + windowMs - now) / 1000) })); } catch {}
      return true;
    }
    return false;
  }

  async _handleChatMessage(ws: WebSocket, sender: any, data: any) {
    const content = (data.content || "").trim().slice(0, 2000);
    if (!content) return;

    const mentionRegex = /@(\w+)/g;
    let m;
    const mentionedUserIds: string[] = [];
    while ((m = mentionRegex.exec(content)) !== null) {
      const name = m[1].toLowerCase();
      for (const [_, c] of this.connections) {
        if (c.userName && c.userName.split(" ")[0].toLowerCase() === name && !mentionedUserIds.includes(c.userId)) {
          mentionedUserIds.push(c.userId);
        }
      }
    }

    const msg: any = {
      id: crypto.randomUUID().replace(/-/g, ""),
      userId: sender.userId,
      userName: sender.userName,
      userRole: sender.userRole,
      content,
      timestamp: Date.now(),
      isTestAccount: sender.isTestAccount,
    };
    if (mentionedUserIds.length > 0) msg.mentions = mentionedUserIds;

    this.messages.push(msg);
    await this._saveTail();
    this.broadcast({ type: "message", ...msg }, null);
  }

  _handleTyping(ws: WebSocket, sender: any, data: any) {
    this.broadcast({ type: "typing", userId: sender.userId, userName: sender.userName, active: !!data.active }, ws);
  }

  async _handleCreatePoll(ws: WebSocket, sender: any, data: any) {
    try {
      const question = (data.question || "").trim().slice(0, 200);
      if (!question) return;
      const options: string[] = (data.options || []).slice(0, 10).map((o: string) => (o || "").trim()).filter(Boolean);
      if (options.length < 2) return;

      const poll: any = {
        id: crypto.randomUUID().replace(/-/g, ""),
        creatorId: sender.userId,
        creatorName: sender.userName,
        question,
        options,
        votes: {},
        active: true,
        timestamp: Date.now(),
      };

      this.polls.push(poll);

      const pollMsg: any = {
        id: poll.id,
        type: "poll",
        poll,
        userId: sender.userId,
        userName: sender.userName,
        userRole: sender.userRole,
        timestamp: poll.timestamp,
        isTestAccount: sender.isTestAccount,
      };

      this.messages.push(pollMsg);
      await this._saveTail();
      this.state.storage.put("polls", this.polls).catch(() => {});

      this.broadcast({ type: "poll", id: poll.id, poll, userId: sender.userId, userName: sender.userName, userRole: sender.userRole, timestamp: poll.timestamp, isTestAccount: sender.isTestAccount }, null);
    } catch {}
  }

  async _handleVote(ws: WebSocket, sender: any, data: any) {
    const pollId = data.pollId;
    const optionIndex = data.optionIndex;
    const poll = this.polls.find((p: any) => p.id === pollId);
    if (!poll || !poll.active) return;
    if (poll.votes[sender.userId] !== undefined) return;
    if (optionIndex < 0 || optionIndex >= poll.options.length) return;

    poll.votes[sender.userId] = optionIndex;

    const pollMsg = this.messages.find((m: any) => m.id === pollId);
    if (pollMsg) {
      pollMsg.poll = poll;
      await this._saveTail();
    }

    this.broadcast({ type: "poll_updated", poll }, null);
    this.state.storage.put("polls", this.polls).catch(() => {});
  }

  async _handleClosePoll(ws: WebSocket, sender: any, data: any) {
    const pollId = data.pollId;
    const poll = this.polls.find((p: any) => p.id === pollId);
    if (!poll || !poll.active) return;
    if (poll.creatorId !== sender.userId) return;

    poll.active = false;

    const pollMsg = this.messages.find((m: any) => m.id === pollId);
    if (pollMsg) {
      pollMsg.poll = poll;
      await this._saveTail();
    }

    this.broadcast({ type: "poll_updated", poll }, null);
    this.state.storage.put("polls", this.polls).catch(() => {});
  }

  async webSocketClose(ws: WebSocket) {
    let entry = this.connections.get(ws);
    if (!entry && (ws as any)._connId) {
      entry = this.connById.get((ws as any)._connId);
    }
    if (entry) {
      if (entry.connId) this.connById.delete(entry.connId);
      this.connections.delete(ws);
      this.broadcast({ type: "user_left", userId: entry.userId, userName: entry.userName }, null);
    }
  }

  async webSocketError(ws: WebSocket) {
    this.webSocketClose(ws);
  }

  async alarm() {
    // Daily cleanup: delete messages older than 6 months
    await this._cleanupOldMessages();
    // Clean up stale rate limit entries (older than 60s)
    const cutoff = Date.now() - 60000;
    for (const [userId, rl] of this.rateLimits) {
      if (rl.windowStart < cutoff) this.rateLimits.delete(userId);
    }
    await this.state.storage.setAlarm(Date.now() + 24 * 60 * 60 * 1000);
  }

  async _saveTail() {
    // Persist the in-memory messages to DO storage in chunks
    const chunkSize = 100;
    const chunks: any[][] = [];
    for (let i = 0; i < this.messages.length; i += chunkSize) {
      chunks.push(this.messages.slice(i, i + chunkSize));
    }
    const pageCount = chunks.length;
    await this.state.storage.put("msg_page_count", pageCount);
    for (let i = 0; i < chunks.length; i++) {
      await this.state.storage.put("msg_page:" + i, chunks[i]);
    }
  }

  async _loadAllMessages(): Promise<any[]> {
    const pageCount = await this.state.storage.get("msg_page_count") || 0;
    const all: any[] = [];
    for (let i = 0; i < pageCount; i++) {
      const page = await this.state.storage.get("msg_page:" + i);
      if (page) all.push(...page);
    }
    return all;
  }

  async _cleanupOldMessages() {
    const cutoff = Date.now() - MSG_RETENTION_MS;
    const pageCount = await this.state.storage.get("msg_page_count") || 0;
    let newCount = 0;
    const toArchive: any[] = [];

    for (let i = 0; i < pageCount; i++) {
      const page = await this.state.storage.get("msg_page:" + i);
      if (!page) continue;

      const keep = page.filter((m: any) => m.timestamp > cutoff);
      const archive = page.filter((m: any) => m.timestamp <= cutoff);
      toArchive.push(...archive);

      if (keep.length > 0) {
        await this.state.storage.put("msg_page:" + newCount, keep);
        newCount++;
      }
      await this.state.storage.delete("msg_page:" + i);
    }

    // Delete any stale pages beyond newCount
    for (let i = newCount; i < pageCount; i++) {
      await this.state.storage.delete("msg_page:" + i);
    }

    await this.state.storage.put("msg_page_count", newCount);

    // Write archived messages to ARCHIVE_DB
    if (toArchive.length > 0 && this.env.ARCHIVE_DB && this.room) {
      try {
        await this.env.ARCHIVE_DB.exec(
          "CREATE TABLE IF NOT EXISTS chat_archive (id TEXT PRIMARY KEY, room TEXT NOT NULL, user_id TEXT NOT NULL, user_name TEXT NOT NULL, user_role TEXT NOT NULL, content TEXT, created_at INTEGER NOT NULL, mentions TEXT, type TEXT, poll_data TEXT, is_test_account INTEGER DEFAULT 0)"
        );
        const stmts = toArchive.map((m: any) =>
          this.env.ARCHIVE_DB.prepare(
            "INSERT OR IGNORE INTO chat_archive (id, room, user_id, user_name, user_role, content, created_at, mentions, type, poll_data, is_test_account) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(
            m.id, this.room, m.userId, m.userName, m.userRole,
            m.content || null, m.timestamp,
            m.mentions ? JSON.stringify(m.mentions) : null,
            m.type === "poll" ? "poll" : null,
            m.poll ? JSON.stringify(m.poll) : null,
            m.isTestAccount ? 1 : 0
          )
        );
        await this.env.ARCHIVE_DB.batch(stmts);
      } catch {}
    }

    // Reload messages into memory
    this.messages = await this._loadAllMessages();
  }

  broadcast(msg: any, excludeWs: WebSocket | null) {
    for (const [ws, data] of this.connections) {
      if (ws !== excludeWs && !data._dead) {
        try { ws.send(JSON.stringify(msg)); } catch { data._dead = true; }
      }
    }
  }
}

export default {
  async fetch(request: Request, env: any, ctx: any) {
    const url = new URL(request.url);

    // WebSocket upgrade for chat — handle before Hono
    if (url.pathname === "/api/chat/ws") {
      const sessionId = url.searchParams.get("sessionId");
      const room = url.searchParams.get("room") || "advisory";
      if (!sessionId) {
        return new Response("Missing sessionId", { status: 400 });
      }
      const doId = env.CHAT_ROOM.idFromName("room-" + room);
      const stub = env.CHAT_ROOM.get(doId);
      return stub.fetch(request);
    }

    return app.fetch(request, env, ctx);
  },
};
