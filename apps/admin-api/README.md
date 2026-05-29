# Admin API Worker

## Build

```
wrangler build
```

## Develop

```
wrangler dev
```

## Deploy

```
wrangler deploy
```

## Notes

- Ensure D1, R2, KV, and Queue bindings are configured in wrangler.toml.
- Admin auth is custom and stored in D1, not in a Cloudflare secret.
- The `admin_tokens` table links a generated token to an email, name, and role.
- Create a token with `POST /api/admin-tokens` after logging in as a board member.
- Example create payload:

```json
{
  "email": "admin@vitstudent.ac.in",
  "name": "Admin",
  "roleId": "president"
}
```

- Example login payload:

```json
{
  "token": "generated-token-value"
}
```

- To seed manually, insert into `admin_tokens` in D1 with a unique token and the target email.

## First board user bootstrap with Wrangler

Use this when the database is empty or you need the first board account before the dashboard can be used.

1. Insert the first board user directly into D1:

```bash
wrangler d1 execute 180dc-db --remote --command "INSERT INTO users (id, name, email, role_id) VALUES (lower(hex(randomblob(16))), 'Board Admin', 'admin@vitstudent.ac.in', 'president');"
```

2. Generate the first token directly into the token registry:

```bash
wrangler d1 execute 180dc-db --remote --command "INSERT INTO admin_tokens (token, email, name, role_id, created_by) VALUES ('first-board-token', 'admin@vitstudent.ac.in', 'Board Admin', 'president', 'system');"
```

3. Log in at `/members` using `first-board-token`.

4. After that, use the dashboard to create the rest of the board users, members, and tokens.

If you want the token to be random instead of fixed, create it from the dashboard or generate a UUID locally and use the same insert pattern above.
