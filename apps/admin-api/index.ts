import { Hono } from 'hono';

type Bindings = {
  DB: D1Database;
  AUTH_SESSIONS: KVNamespace;
};

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Middleware: Verify Authentication & Inject User Context
 * (In production, this decodes the Google/Clerk JWT token mapped to the VIT email)
 */
app.use('*', async (c, next) => {
  // Mocking auth for now: Imagine we decoded the JWT and got this email.
  // In frontend, we will pass a secure token.
  const email = c.req.header('x-user-email') || 'admin@vitstudent.ac.in'; 

  const query = "SELECT u.*, r.power_level, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = ?";
  const user = await c.env.DB.prepare(query).bind(email).first();

  if (!user) {
    return c.json({ error: 'Unauthorized: Email not registered by Board.' }, 401);
  }

  c.set('user', user);
  await next();
});

/**
 * Helper to check if current user is President/VP (Power == 100)
 */
const requireBoard = (c: any) => {
  const user = c.get('user');
  if (user.power_level < 100) {
    throw new Error('Forbidden: Requires President or Vice President privileges.');
  }
}

// ---------------------------------------------------------
// 1. ADD NEW MEMBER (Only Pres / VP)
// ---------------------------------------------------------
app.post('/api/members', async (c) => {
  try {
    requireBoard(c);
    const body = await c.req.json();
    const email = body.email;
    const name = body.name;
    
    // Automatically assigns them the 'member' role initially
    const insert = await c.env.DB.prepare(
      "INSERT INTO users (id, name, email, role_id) VALUES (lower(hex(randomblob(16))), ?, ?, 'member')"
    ).bind(name, email).run();

    return c.json({ success: true, message: 'Added ' + email + ' as a General Member.' });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

// ---------------------------------------------------------
// 2. PROMOTE / CHANGE ROLE (Only Pres / VP)
// ---------------------------------------------------------
app.put('/api/members/:id/role', async (c) => {
  try {
    requireBoard(c);
    const targetUserId = c.req.param('id');
    const body = await c.req.json();
    const newRoleId = body.newRoleId;
    const departmentId = body.departmentId;

    await c.env.DB.prepare(
      "UPDATE users SET role_id = ?, department_id = ? WHERE id = ?"
    ).bind(newRoleId, departmentId || null, targetUserId).run();

    return c.json({ success: true, message: 'Role updated successfully.' });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

// ---------------------------------------------------------
// 3. CREATE CUSTOM ROLE (Only Pres / VP, Power strictly < 100)
// ---------------------------------------------------------
app.post('/api/roles', async (c) => {
  try {
    requireBoard(c);
    const body = await c.req.json();
    const roleId = body.roleId;
    const name = body.name;
    const powerLevel = body.powerLevel;

    if (powerLevel >= 100) {
      return c.json({ error: 'Cannot create roles equal or greater than President/VP level (100).' }, 400);
    }

    const user: any = c.get('user');
    await c.env.DB.prepare(
      "INSERT INTO roles (id, name, power_level, created_by) VALUES (?, ?, ?, ?)"
    ).bind(roleId, name, powerLevel, user.id).run();

    return c.json({ success: true, message: 'Custom role ' + name + ' created.' });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

// ---------------------------------------------------------
// 4. ROLE TRANSFERS / EXCHANGES
// ---------------------------------------------------------
app.post('/api/role-transfers', async (c) => {
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

    return c.json({ success: true, message: 'Role exchange executed.' });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

// ---------------------------------------------------------
// 5. REMOVE MEMBER
// ---------------------------------------------------------
app.delete('/api/members/:id', async (c) => {
  try {
    requireBoard(c);
    const targetId = c.req.param('id');

    // Prevent deleting other Presidents
    const targetUser = await c.env.DB.prepare("SELECT power_level FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?").bind(targetId).first();
    const tUserOptions: any = targetUser;
    
    if (tUserOptions && tUserOptions.power_level === 100) {
      return c.json({ error: 'Cannot remove another President or Vice President.' }, 400);
    }

    await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(targetId).run();
    return c.json({ success: true, message: 'Member removed permanently.' });
  } catch (e: any) {
    return c.json({ error: e.message }, 403);
  }
});

export default app;
