import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  DB: any;
  AUTH_SESSIONS: any;
  ENVIRONMENT?: string;
};

type Variables = {
  user: any;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_STR_LEN = 255;
const MAX_MSG_LEN = 2000;

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
    const generic: Record<number, string> = {
      400: "Bad request", 401: "Unauthorized", 403: "Forbidden",
      404: "Not found", 409: "Conflict", 500: "Internal server error",
    };
    return c.json({ error: generic[status] || "An error occurred" }, status);
  }
  return c.json({ error: message }, status);
}

const URL_RE = /^https?:\/\/.+/;

function isValidUrl(val: unknown): boolean {
  if (typeof val !== "string") return false;
  if (!URL_RE.test(val)) return false;
  try { new URL(val); return true; } catch { return false; }
}

function getClientIp(c: any): string {
  return c.req.header("CF-Connecting-IP") || c.req.header("X-Forwarded-For") || "unknown";
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
    const elapsed = (now.getTime() - new Date(row.window_start + "Z").getTime()) / 1000;
    if (elapsed > windowSeconds) {
      await c.env.DB.prepare("UPDATE rate_limits SET count = 1, window_start = ? WHERE ip = ? AND endpoint = ?").bind(ip, endpoint, now.toISOString()).run();
      return { allowed: true, retryAfter: 0 };
    }
    if (row.count >= maxRequests) {
      return { allowed: false, retryAfter: Math.ceil(windowSeconds - elapsed) };
    }
    await c.env.DB.prepare("UPDATE rate_limits SET count = count + 1 WHERE ip = ? AND endpoint = ?").bind(ip, endpoint).run();
    return { allowed: true, retryAfter: 0 };
  } catch { return { allowed: true, retryAfter: 0 }; }
}

async function addAuditLog(c: any, action: string, targetType: string | null, targetId: string | null, details: string | null) {
  try {
    const actorEmail = (c.get("user") as any)?.email || "system";
    await c.env.DB.prepare(
      "INSERT INTO audit_log (id, action, actor_email, target_type, target_id, details) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)",
    ).bind(action, actorEmail, targetType, targetId, details).run();
  } catch { /* audit log silently */ }
}

function maskToken(token: string): string {
  if (token.length <= 8) return token;
  return token.substring(0, 8) + "...";
}

const TOKEN_EXPIRY_DAYS = 90;

async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const salt = Array.from(saltBytes).map(b => b.toString(16).padStart(2, "0")).join("");
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derivedBits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" },
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
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" },
    keyMaterial, 256,
  );
  const hashArray = Array.from(new Uint8Array(derivedBits));
  const hash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hash === storedHash;
}

let tablesEnsured = false;
let seedDone = false;

async function ensureTables(db: any) {
  if (tablesEnsured) {
    // Always run migrations even if tables were already ensured
    await runMigrations(db);
    return;
  }
  await db.exec(`
    CREATE TABLE IF NOT EXISTS departments (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT);
    CREATE TABLE IF NOT EXISTS roles (id TEXT PRIMARY KEY, name TEXT NOT NULL, power_level INTEGER NOT NULL, created_by TEXT);
    CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, role_id TEXT NOT NULL, department_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (role_id) REFERENCES roles(id), FOREIGN KEY (department_id) REFERENCES departments(id));
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
  `);
  await runMigrations(db);
  tablesEnsured = true;
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
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS recruitment_sessions (
      id TEXT PRIMARY KEY, applicant_id TEXT NOT NULL, token TEXT UNIQUE NOT NULL,
      expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (applicant_id) REFERENCES recruitment_applicants(id)
    )`);
  } catch (e: any) { logError("Migration: recruitment_sessions table", e); }
}

let currentEnv: any = null;

async function seedData(db: any, env?: any) {
  if (env) currentEnv = env;
  if (seedDone) return;
  try {
    const roleSql = "INSERT OR IGNORE INTO roles (id, name, power_level, created_by) VALUES (?, ?, ?, ?)";
    await db.prepare(roleSql).bind("president", "President", 100, "system").run();
    await db.prepare(roleSql).bind("vice_president", "Vice President", 100, "system").run();
    await db.prepare(roleSql).bind("secretary", "Secretary", 80, "system").run();
    await db.prepare(roleSql).bind("lead", "Technical Lead", 50, "system").run();
    await db.prepare(roleSql).bind("member", "General Member", 10, "system").run();

    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("tech", "Technical", "Handles technical infrastructure and UI").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("rnd", "Research & Development", "Handles consulting research").run();
    await db.prepare("INSERT OR REPLACE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("marketing", "Marketing", "Handles marketing, outreach, and communications").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("social_media", "Social Media", "Handles social media presence and content").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("finance", "Finance", "Handles budgeting and financial planning").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("legal", "Legal", "Handles legal compliance and documentation").run();
    await db.prepare("INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)").bind("hr", "Human Resources", "Handles recruitment and people management").run();

    if (!currentEnv || (currentEnv.ENVIRONMENT || "").toLowerCase() !== "production") {
      const devToken = crypto.randomUUID().replace(/-/g, "");
      await db.prepare("INSERT OR REPLACE INTO admin_tokens (token, email, name, role_id, created_by, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+90 days'))").bind(devToken, "admin@vitstudent.ac.in", "Dev Admin", "president", "system").run();
      console.info("Dev token generated (visible only in dev mode)");
    }

    const csCount: any = await db.prepare("SELECT COUNT(*) as cnt FROM case_studies").first();
    if (csCount && csCount.cnt === 0) {
      const cs = "INSERT OR IGNORE INTO case_studies (id, tag, title, description) VALUES (?, ?, ?, ?)";
      await db.prepare(cs).bind("cs1", "Strategy", "EdTech Startup Growth", "Developed a comprehensive Go-To-Market strategy and user acquisition model for a rising EdTech platform serving 50K+ students.").run();
      await db.prepare(cs).bind("cs2", "Operations", "NGO Operational Overhaul", "Streamlined logistics and supply chain inefficiencies for a local food distribution non-profit, reducing costs by 30%.").run();
      await db.prepare(cs).bind("cs3", "Marketing", "Social Media Campaign", "Designed a viral social media campaign for a mental health awareness organization, reaching 2M+ impressions.").run();
      await db.prepare(cs).bind("cs4", "Finance", "Fundraising Strategy", "Created a diversified fundraising strategy for an educational NGO, increasing donations by 45% in 6 months.").run();
      await db.prepare(cs).bind("cs5", "Impact", "Rural Education Program", "Developed a scalable rural education program model for an NGO, impacting 10,000+ students across 50 villages.").run();
      await db.prepare(cs).bind("cs6", "Technology", "Digital Transformation", "Led digital transformation for a legacy non-profit, modernizing their tech stack and improving efficiency by 60%.").run();
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

    const knownDomains = ["Technical", "R&D", "Operations", "PR & Outreach", "Design & Creative", "Content & Editorial", "HR & Logistics", "Finance"];
    for (const domain of knownDomains) {
      await db.prepare("INSERT OR IGNORE INTO recruitment_domain_settings (domain_name, is_open) VALUES (?, ?)").bind(domain, 1).run();
    }
    seedDone = true;
  } catch (e: any) {
    logError("Seed failed", e);
  }
}

/**
 * Middleware: Verify Authentication & Inject User Context
 * (In production, this decodes the Google/Clerk JWT token mapped to the VIT email)
 */
// CORS — runs first, handles preflight OPTIONS automatically
const ALLOWED_ORIGINS = [
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

// Auth middleware
app.use("*", async (c, next) => {
  try {
    await ensureTables(c.env.DB);
    await seedData(c.env.DB);
  } catch (e: any) {
    logError("DB init failed", e, c);
    return c.json({ error: "Database initialization failed" }, 500);
  }

  // Allow unauthenticated routes: public signup + dev-login (handles its own auth)
  const url = new URL(c.req.url);
  if (
    (url.pathname === "/api/signup-requests" && c.req.method === "POST") ||
    url.pathname === "/api/dev-login" ||
    url.pathname === "/api/departments" ||
    url.pathname === "/api/projects/completed" ||
    (url.pathname.startsWith("/api/content") && c.req.method === "GET") ||
    url.pathname === "/api/recruitment/register" ||
    url.pathname === "/api/recruitment/login" ||
    url.pathname === "/api/recruitment/open-domains"
  ) {
    await next();
    return;
  }

  // Validate Bearer token against admin_tokens registry.
  let email = undefined as undefined | string;
  try {
    const authHeader = c.req.header("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7).trim();
      const tokenRow: any = await c.env.DB.prepare(
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
  const user = await c.env.DB.prepare(query).bind(email).first();

  if (!user) {
    return c.json(
      { error: "Unauthorized: Email not registered." },
      401,
    );
  }

  c.set("user", user);
  await next();
});

/**
 * Helper to check if current user is President/VP (Power == 100)
 */
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
  // Clean up expired sessions
  await c.env.DB.prepare("DELETE FROM recruitment_sessions WHERE expires_at <= datetime('now')").run();
  const session: any = await c.env.DB.prepare(
    "SELECT sa.* FROM recruitment_sessions rs JOIN recruitment_applicants sa ON rs.applicant_id = sa.id WHERE rs.token = ? AND rs.expires_at > datetime('now')",
  ).bind(token).first();
  return session || null;
}

// ---------------------------------------------------------
// CONTENT ENDPOINTS (Public — landing page data)
// ---------------------------------------------------------
app.get("/api/content/case-studies", async (c) => {
  try {
    await ensureTables(c.env.DB);
    await seedData(c.env.DB, c.env);
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
    const rows = await c.env.DB.prepare("SELECT * FROM blog_posts ORDER BY created_at ASC").all();
    return c.json({ success: true, data: rows.results || [] });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

app.get("/api/content/partners", async (c) => {
  try {
    await ensureTables(c.env.DB);
    await seedData(c.env.DB, c.env);
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
    const email = validateEmail(body.email);
    const name = sanitizeStr(body.name);
    const departmentId = sanitizeStr(body.departmentId) || null;
    if (!email || !name) {
      return c.json({ error: "Invalid or missing email/name" }, 400);
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
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by, expires_at) VALUES (?, ?, ?, 'member', ?, datetime('now', '+90 days'))",
    ).bind(token, email, name, user.id).run();

    await addAuditLog(c, "member_added", "user", null, "Added " + email + " as member");

    return c.json({
      success: true,
      message: "Added " + email + " as a General Member.",
      token,
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// Developer token login (dev only) - maps token -> email via ADMIN_TOKENS
// ADMIN_TOKENS example: { "token123": { "email": "admin@vitstudent.ac.in", "roleId": "president", "name": "Admin" } }
// This returns the mapped email so the frontend can use it as the dev identity.
app.post("/api/dev-login", async (c) => {
  try {
    if (c.env.ENVIRONMENT === "production") {
      return c.json({ error: "Not available in production" }, 403);
    }
    const body = await c.req.json();
    if (!body || typeof body !== "object") {
      return c.json({ error: "Invalid request body" }, 400);
    }
    const token = body.token;
    if (!token) return c.json({ error: "Missing token" }, 400);

    const entry: any = await c.env.DB.prepare(
      "SELECT token, email, name, role_id, revoked_at, expires_at FROM admin_tokens WHERE token = ?",
    )
      .bind(token)
      .first();

    if (!entry || entry.revoked_at || (entry.expires_at && new Date(entry.expires_at + "Z") <= new Date()))
      return c.json({ error: "Invalid token" }, 401);

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
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+90 days'))",
    ).bind(newToken, user.email, user.name, user.role_id, user.id).run();
    await addAuditLog(c, "token_rotated", "admin_token", user.email, "Token rotated for " + user.email);
    return c.json({ success: true, token: newToken });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// DASHBOARD BOOTSTRAP (single server payload for the members page)
// ---------------------------------------------------------
app.get("/api/dashboard", async (c) => {
  try {
    await ensureTables(c.env.DB);
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

    return c.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        roleId: user.role_id,
        roleName: user.role_name,
        powerLevel: user.power_level,
        departmentId: user.department_id || null,
      },
      pendingRequests: pendingRequests.results || [],
      adminTokens: maskedTokens,
      roleTransfers: (await c.env.DB.prepare(
        "SELECT rt.*, fu.name as from_name, fu.email as from_email, tu.name as to_name, tu.email as to_email, r.name as role_name FROM role_transfers rt LEFT JOIN users fu ON rt.from_user_id = fu.id LEFT JOIN users tu ON rt.to_user_id = tu.id LEFT JOIN roles r ON rt.role_id = r.id WHERE rt.status = 'pending' ORDER BY rt.created_at DESC",
      ).all()).results || [],
      departments: (await c.env.DB.prepare("SELECT id, name, description FROM departments ORDER BY name ASC").all()).results || [],
      announcements: (await c.env.DB.prepare("SELECT * FROM announcements ORDER BY created_at DESC LIMIT 20").all()).results || [],
      flags: {
        canAccessHub: user.power_level >= 50,
        canManageBoard: user.power_level >= 100,
      },
    });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

// ---------------------------------------------------------
// ADMIN TOKENS (Custom auth registry)
// ---------------------------------------------------------
app.get("/api/admin-tokens", async (c) => {
  try {
    await ensureTables(c.env.DB);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT token, email, name, role_id, created_by, created_at, revoked_at FROM admin_tokens ORDER BY created_at DESC",
    ).all();
    const masked = (rows.results || []).map((t: any) => ({
      tokenPreview: maskToken(t.token),
      email: t.email, name: t.name, role_id: t.role_id,
      created_by: t.created_by, created_at: t.created_at, revoked_at: t.revoked_at,
    }));
    return c.json({ success: true, tokens: { results: masked } });
  } catch (e: any) {
    return errorResponse(c, e.message, 403);
  }
});

app.post("/api/admin-tokens", async (c) => {
  try {
    await ensureTables(c.env.DB);
    requireBoard(c);
    const body = await c.req.json();
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
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+90 days'))",
    )
      .bind(token, email, name, roleId, user.id)
      .run();

    await addAuditLog(c, "token_created", "admin_token", null, "Token created for " + email);

    return c.json({ success: true, token, email, roleId, name });
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
      "UPDATE admin_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE email = ?",
    )
      .bind(email)
      .run();
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

    const body = await c.req.json();
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
        "UPDATE users SET name = ?, role_id = ?, department_id = ? WHERE email = ?",
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
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by, expires_at) VALUES (?, ?, ?, ?, ?, datetime('now', '+90 days'))",
    )
      .bind(token, email, name, roleId, creator.id)
      .run();

    await addAuditLog(c, "board_user_created", "user", null, "Board user created: " + email + " as " + roleId);

    return c.json({
      success: true,
      email,
      name,
      roleId,
      token,
      message: "Board user created and token issued.",
    });
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
    const newRoleId = sanitizeStr(body.newRoleId);
    const departmentId = sanitizeStr(body.departmentId);
    if (!newRoleId) {
      return c.json({ error: "Missing newRoleId" }, 400);
    }

    await c.env.DB.prepare(
      "UPDATE users SET role_id = ?, department_id = ? WHERE id = ?",
    )
      .bind(newRoleId, departmentId || null, targetUserId)
      .run();

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
    const body = await c.req.json();
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
      "SELECT u.id, u.name, u.email, u.role_id, u.department_id, u.created_at, r.name as role_name, r.power_level FROM users u JOIN roles r ON u.role_id = r.id ORDER BY u.name ASC",
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

    await c.env.DB.prepare("DELETE FROM users WHERE id = ?")
      .bind(targetId)
      .run();
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
    const body = await c.req.json();
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
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by, expires_at) VALUES (?, ?, ?, 'member', ?, datetime('now', '+90 days'))",
    )
      .bind(newToken, reqRow.email, reqRow.name, c.get("user").id)
      .run();

    await c.env.DB.prepare("UPDATE signup_requests SET status = ? WHERE id = ?")
      .bind("approved", id)
      .run();

    await addAuditLog(c, "signup_approved", "signup_request", id, "Approved signup for " + reqRow.email);

    return c.json({
      success: true,
      message: "Signup request approved. Token created.",
      token: newToken,
    });
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
    const title = sanitizeStr(body.title);
    const meetLink = sanitizeStr(body.meetLink);
    const description = sanitizeStr(body.description);
    const scheduledAt = body.scheduledAt;
    if (!title || !scheduledAt) return c.json({ error: "Missing title or scheduledAt" }, 400);
    if (meetLink && !isValidUrl(meetLink)) return c.json({ error: "Invalid meet link URL" }, 400);
    const user: any = c.get("user");
    await c.env.DB.prepare(
      "INSERT INTO department_meets (id, department_id, title, meet_link, description, scheduled_at, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)",
    ).bind(deptId, title, meetLink || null, description || null, scheduledAt, user.id).run();
    return c.json({ success: true, message: "Meet scheduled" });
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
    const title = sanitizeStr(body.title);
    const meetLink = sanitizeStr(body.meetLink);
    const description = sanitizeStr(body.description);
    const scheduledAt = body.scheduledAt;
    if (!title || !scheduledAt) return c.json({ error: "Missing title or scheduledAt" }, 400);
    if (meetLink && !isValidUrl(meetLink)) return c.json({ error: "Invalid meet link URL" }, 400);
    await c.env.DB.prepare(
      "INSERT INTO club_meets (id, title, meet_link, description, scheduled_at, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)",
    ).bind(title, meetLink || null, description || null, scheduledAt, user.id).run();
    return c.json({ success: true, message: "Club-wide meet scheduled" });
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
    const title = sanitizeStr(body.title);
    const meetLink = sanitizeStr(body.meetLink);
    const description = sanitizeStr(body.description);
    const scheduledAt = body.scheduledAt;
    const departments = body.departments;
    if (!title || !scheduledAt || !departments) {
      return c.json({ error: "Missing title, scheduledAt, or departments" }, 400);
    }
    if (meetLink && !isValidUrl(meetLink)) return c.json({ error: "Invalid meet link URL" }, 400);
    const deptsStr = Array.isArray(departments) ? departments.join(",") : String(departments);
    await c.env.DB.prepare(
      "INSERT INTO inter_dept_meets (id, title, meet_link, description, scheduled_at, departments, created_by) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?)",
    ).bind(title, meetLink || null, description || null, scheduledAt, deptsStr, user.id).run();
    return c.json({ success: true, message: "Inter-department meet scheduled" });
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
// DEPARTMENT MEETS (read-only for all authenticated users)
// ---------------------------------------------------------
app.get("/api/department-meets", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rows = await c.env.DB.prepare(
      "SELECT dm.*, d.name as department_name FROM department_meets dm JOIN departments d ON dm.department_id = d.id ORDER BY dm.scheduled_at ASC",
    ).all();
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
    const body = await c.req.json();
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
    const body = await c.req.json();
    const name = sanitizeStr(body.name);
    const description = sanitizeStr(body.description);
    const companyOrg = sanitizeStr(body.companyOrg);
    const yearInput = sanitizeStr(body.year) || null;
    const deadline = body.deadline || null;
    const departmentIds = body.departmentIds;
    if (!name) return c.json({ error: "Missing project name" }, 400);
    if (!Array.isArray(departmentIds) || departmentIds.length === 0) {
      return c.json({ error: "Select at least one department" }, 400);
    }
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

    for (const deptId of departmentIds) {
      await c.env.DB.prepare(
        "INSERT OR IGNORE INTO project_departments (project_id, department_id) VALUES (?, ?)",
      ).bind(projectId, deptId).run();
    }

    return c.json({ success: true, message: "Project created" });
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
    const rl = await checkRateLimit(c, "recruitment_register", 5, 60);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    const name = sanitizeStr(body.name);
    const email = validateEmail(body.email);
    const password = sanitizeStr(body.password);
    if (!name || !email || !password) {
      return c.json({ error: "Missing name, email, or password" }, 400);
    }
    if (password.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return c.json({ error: "Password must contain uppercase, lowercase, and a digit" }, 400);
    }

    const existing: any = await c.env.DB.prepare("SELECT id FROM recruitment_applicants WHERE email = ?").bind(email).first();
    if (existing) {
      return c.json({ error: "An account with this email already exists" }, 409);
    }

    const { hash: passwordHash, salt } = await hashPassword(password);

    await c.env.DB.prepare(
      "INSERT INTO recruitment_applicants (id, email, name, password_hash, salt) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)",
    ).bind(email, name, passwordHash, salt).run();

    return c.json({ success: true, message: "Account created. You can now log in." });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

// 2. Login applicant
app.post("/api/recruitment/login", async (c) => {
  try {
    await ensureTables(c.env.DB);
    const rl = await checkRateLimit(c, "recruitment_login", 10, 60);
    if (!rl.allowed) {
      return c.json({ error: "Too many requests. Please try again later.", retryAfter: rl.retryAfter }, 429);
    }
    const body = await c.req.json();
    const email = validateEmail(body.email);
    const password = sanitizeStr(body.password);
    if (!email || !password) {
      return c.json({ error: "Missing email or password" }, 400);
    }

    const applicant: any = await c.env.DB.prepare(
      "SELECT id, email, name, password_hash, salt FROM recruitment_applicants WHERE email = ?",
    ).bind(email).first();

    if (!applicant || !applicant.salt) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    const valid = await verifyPassword(password, applicant.salt, applicant.password_hash);
    if (!valid) {
      return c.json({ error: "Invalid email or password" }, 401);
    }

    // Create session token stored in DB
    const sessionToken = crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await c.env.DB.prepare(
      "INSERT INTO recruitment_sessions (id, applicant_id, token, expires_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
    ).bind(applicant.id, sessionToken, expiresAt).run();

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
    const sessionApplicant = await getSessionApplicant(c);
    if (!sessionApplicant) {
      return c.json({ error: "Unauthorized: please log in first" }, 401);
    }
    const applicantId = sessionApplicant.id;

    const body = await c.req.json();
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
    const openDomains = body.openDomains;
    if (!Array.isArray(openDomains)) {
      return c.json({ error: "openDomains must be an array of domain names" }, 400);
    }
    const user: any = c.get("user");
    await c.env.DB.prepare("UPDATE recruitment_domain_settings SET is_open = 0, updated_by = ?, updated_at = CURRENT_TIMESTAMP").bind(user.id).run();
    if (openDomains.length > 0) {
      const placeholders = openDomains.map(() => "?").join(",");
      await c.env.DB.prepare(
        `UPDATE recruitment_domain_settings SET is_open = 1, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE domain_name IN (${placeholders})`,
      ).bind(user.id, ...openDomains).run();
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
    const rows = await c.env.DB.prepare("SELECT domain_name FROM recruitment_domain_settings WHERE is_open = 1 ORDER BY domain_name ASC").all();
    return c.json({ success: true, data: (rows.results || []).map((r: any) => r.domain_name) });
  } catch (e: any) {
    return errorResponse(c, e.message, 500);
  }
});

export default app;
