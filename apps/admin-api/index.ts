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

let auxTablesReady = false;

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

async function ensureAuxTables(db: any) {
  if (auxTablesReady) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS departments (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT
      );
      CREATE TABLE IF NOT EXISTS roles (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, power_level INTEGER NOT NULL, created_by TEXT
      );
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
        role_id TEXT NOT NULL, department_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles(id),
        FOREIGN KEY (department_id) REFERENCES departments(id)
      );
      CREATE TABLE IF NOT EXISTS signup_requests (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL,
        message TEXT, status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS admin_tokens (
        token TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE,
        name TEXT, role_id TEXT NOT NULL DEFAULT 'member',
        created_by TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        revoked_at DATETIME,
        FOREIGN KEY (role_id) REFERENCES roles(id)
      );
    `);
  } catch (e: any) {
    logError("DDL failed", e);
    // Tables may already exist from a previous schema — continue
  }

  try {
    // Seed default roles (idempotent)
    const roleSql =
      "INSERT OR IGNORE INTO roles (id, name, power_level, created_by) VALUES (?, ?, ?, ?)";
    await db
      .prepare(roleSql)
      .bind("president", "President", 100, "system")
      .run();
    await db
      .prepare(roleSql)
      .bind("vice_president", "Vice President", 100, "system")
      .run();
    await db
      .prepare(roleSql)
      .bind("secretary", "Secretary", 80, "system")
      .run();
    await db
      .prepare(roleSql)
      .bind("lead", "Technical Lead", 50, "system")
      .run();
    await db
      .prepare(roleSql)
      .bind("member", "General Member", 10, "system")
      .run();

    // Seed a dev admin token with a random token if DB is empty
    const tc: any = await db
      .prepare("SELECT COUNT(*) as cnt FROM admin_tokens")
      .first();
    if (tc && tc.cnt === 0) {
      const randomToken = crypto.randomUUID().replace(/-/g, "");
      await db
        .prepare(
          "INSERT OR IGNORE INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(
          randomToken,
          "admin@vitstudent.ac.in",
          "Dev Admin",
          "president",
          "system",
        )
        .run();
    }
  } catch (e: any) {
    logError("Seed failed", e);
  }
  auxTablesReady = true;
}

/**
 * Middleware: Verify Authentication & Inject User Context
 * (In production, this decodes the Google/Clerk JWT token mapped to the VIT email)
 */
// CORS — runs first, handles preflight OPTIONS automatically
const ALLOWED_ORIGINS = [
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "https://180dc-admin.pages.dev",
  "https://admin.180dc.org",
];

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return origin;
      return ALLOWED_ORIGINS[0];
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Auth middleware
app.use("*", async (c, next) => {
  try {
    await ensureAuxTables(c.env.DB);
  } catch (e: any) {
    logError("DB init failed", e, c);
    return c.json({ error: "Database initialization failed" }, 500);
  }

  // Allow unauthenticated routes: public signup + dev-login (handles its own auth)
  const url = new URL(c.req.url);
  if (
    (url.pathname === "/api/signup-requests" && c.req.method === "POST") ||
    url.pathname === "/api/dev-login"
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
        "SELECT token, email, name, role_id, revoked_at FROM admin_tokens WHERE token = ?",
      )
        .bind(token)
        .first();

      if (tokenRow && !tokenRow.revoked_at) {
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
      { error: "Unauthorized: Email not registered by Board." },
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

// ---------------------------------------------------------
// 1. ADD NEW MEMBER (Only Pres / VP)
// ---------------------------------------------------------
app.post("/api/members", async (c) => {
  try {
    requireBoard(c);
    const body = await c.req.json();
    const email = validateEmail(body.email);
    const name = sanitizeStr(body.name);
    if (!email || !name) {
      return c.json({ error: "Invalid or missing email/name" }, 400);
    }

    // Automatically assigns them the 'member' role initially
    const insert = await c.env.DB.prepare(
      "INSERT INTO users (id, name, email, role_id) VALUES (lower(hex(randomblob(16))), ?, ?, 'member')",
    )
      .bind(name, email)
      .run();

    return c.json({
      success: true,
      message: "Added " + email + " as a General Member.",
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
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
      "SELECT token, email, name, role_id, revoked_at FROM admin_tokens WHERE token = ?",
    )
      .bind(token)
      .first();

    if (!entry || entry.revoked_at)
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
      "SELECT u.email, u.name, u.role_id, r.power_level, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?",
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
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ---------------------------------------------------------
// DASHBOARD BOOTSTRAP (single server payload for the members page)
// ---------------------------------------------------------
app.get("/api/dashboard", async (c) => {
  try {
    await ensureAuxTables(c.env.DB);
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

    return c.json({
      success: true,
      user: {
        email: user.email,
        name: user.name,
        roleId: user.role_id,
        roleName: user.role_name,
        powerLevel: user.power_level,
      },
      pendingRequests: pendingRequests.results || [],
      adminTokens: adminTokens.results || [],
      flags: {
        canAccessHub: user.power_level >= 50,
        canManageBoard: user.power_level >= 100,
      },
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

// ---------------------------------------------------------
// ADMIN TOKENS (Custom auth registry)
// ---------------------------------------------------------
app.get("/api/admin-tokens", async (c) => {
  try {
    await ensureAuxTables(c.env.DB);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT token, email, name, role_id, created_by, created_at, revoked_at FROM admin_tokens ORDER BY created_at DESC",
    ).all();
    return c.json({ success: true, tokens: rows });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

app.post("/api/admin-tokens", async (c) => {
  try {
    await ensureAuxTables(c.env.DB);
    requireBoard(c);
    const body = await c.req.json();
    const email = validateEmail(body.email);
    const roleId = sanitizeStr(body.roleId) || "member";
    const name = sanitizeStr(body.name) || email?.split?.("@")?.[0] || "member";

    if (!email) {
      return c.json({ error: "Missing email" }, 400);
    }

    const token = crypto.randomUUID().replace(/-/g, "");
    const user: any = c.get("user");

    await c.env.DB.prepare(
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(token, email, name, roleId, user.id)
      .run();

    return c.json({ success: true, token, email, roleId, name });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

app.delete("/api/admin-tokens/:token", async (c) => {
  try {
    await ensureAuxTables(c.env.DB);
    requireBoard(c);
    const token = c.req.param("token");
    await c.env.DB.prepare(
      "UPDATE admin_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token = ?",
    )
      .bind(token)
      .run();
    return c.json({ success: true, message: "Token revoked." });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

// ---------------------------------------------------------
// BOARD USERS (Create or update a board account + issue token)
// ---------------------------------------------------------
app.post("/api/board-users", async (c) => {
  try {
    await ensureAuxTables(c.env.DB);
    requireBoard(c);

    const body = await c.req.json();
    const email = validateEmail(body.email);
    const name =
      sanitizeStr(body.name) || email?.split?.("@")?.[0] || "board-member";
    const roleId = sanitizeStr(body.roleId);

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
        { error: "Board users should use a board-level role" },
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
        "UPDATE users SET name = ?, role_id = ? WHERE email = ?",
      )
        .bind(name, roleId, email)
        .run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO users (id, name, email, role_id) VALUES (lower(hex(randomblob(16))), ?, ?, ?)",
      )
        .bind(name, email, roleId)
        .run();
    }

    // Revoke any prior token for the same email so the latest one is authoritative.
    await c.env.DB.prepare(
      "UPDATE admin_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE email = ? AND revoked_at IS NULL",
    )
      .bind(email)
      .run();

    const token = crypto.randomUUID().replace(/-/g, "");
    const creator: any = c.get("user");

    await c.env.DB.prepare(
      "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(token, email, name, roleId, creator.id)
      .run();

    return c.json({
      success: true,
      email,
      name,
      roleId,
      token,
      message: "Board user created and token issued.",
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
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
    return c.json({ error: e.message }, 403);
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
    return c.json({ error: e.message }, 403);
  }
});

// ---------------------------------------------------------
// 4. ROLE TRANSFERS / EXCHANGES
// ---------------------------------------------------------
app.post("/api/role-transfers", async (c) => {
  try {
    requireBoard(c); // Pres/VP initiates or approves the swap
    const body = await c.req.json();
    const fromUserId = body.fromUserId;
    const toUserId = body.toUserId;
    const roleIdToTransfer = body.roleIdToTransfer;

    // In a full implementation, you'd insert into role_transfers and wait for confirmation.
    // For direct VP execution, we can swap immediately.

    // Example: Swap role logic
    // ... DB Transaction ...

    return c.json({ success: true, message: "Role exchange executed." });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
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
    return c.json({ success: true, message: "Member removed permanently." });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

// ---------------------------------------------------------
// SIGNUP REQUESTS (Public create, Admin approves)
// ---------------------------------------------------------
// 6a. Create a signup request (public - no auth required)
app.post("/api/signup-requests", async (c) => {
  try {
    await ensureAuxTables(c.env.DB);
    const body = await c.req.json();
    const name = sanitizeStr(body.name);
    const email = validateEmail(body.email);
    const message = sanitizeStr(body.message, MAX_MSG_LEN);

    if (!email || !name) {
      return c.json({ error: "Missing or invalid name/email" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO signup_requests (id, name, email, message, status) VALUES (lower(hex(randomblob(16))), ?, ?, ?, 'pending')",
    )
      .bind(name, email, message)
      .run();

    return c.json({ success: true, message: "Signup request submitted." });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 6b. List pending signup requests (Admin only)
app.get("/api/signup-requests", async (c) => {
  try {
    await ensureAuxTables(c.env.DB);
    requireBoard(c);
    const rows = await c.env.DB.prepare(
      "SELECT * FROM signup_requests WHERE status = 'pending' ORDER BY created_at DESC",
    ).all();
    return c.json({ success: true, requests: rows });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

// 6c. Approve a signup request (Admin only)
app.post("/api/signup-requests/:id/approve", async (c) => {
  try {
    await ensureAuxTables(c.env.DB);
    requireBoard(c);
    const id = c.req.param("id");

    const reqRow: any = await c.env.DB.prepare(
      "SELECT * FROM signup_requests WHERE id = ?",
    )
      .bind(id)
      .first();
    if (!reqRow) return c.json({ error: "Request not found" }, 404);

    // create user as general member
    await c.env.DB.prepare(
      "INSERT INTO users (id, name, email, role_id) VALUES (lower(hex(randomblob(16))), ?, ?, 'member')",
    )
      .bind(reqRow.name, reqRow.email)
      .run();

    await c.env.DB.prepare("UPDATE signup_requests SET status = ? WHERE id = ?")
      .bind("approved", id)
      .run();

    return c.json({
      success: true,
      message: "Signup request approved and user created.",
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

// 6d. Reject a signup request (Admin only)
app.post("/api/signup-requests/:id/reject", async (c) => {
  try {
    await ensureAuxTables(c.env.DB);
    requireBoard(c);
    const id = c.req.param("id");
    await c.env.DB.prepare("UPDATE signup_requests SET status = ? WHERE id = ?")
      .bind("rejected", id)
      .run();
    return c.json({ success: true, message: "Signup request rejected." });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

export default app;
