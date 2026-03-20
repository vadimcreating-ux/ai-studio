import { dbQuery } from "../lib/db.js";
import { hashPassword, verifyPassword, setAuthCookie, clearAuthCookie } from "../lib/auth.js";
import { RegisterSchema, LoginSchema } from "../lib/validation.js";
export async function authRoutes(app) {
    // POST /api/auth/register
    app.post("/api/auth/register", async (req, reply) => {
        const parsed = RegisterSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
        }
        const { email, password, name } = parsed.data;
        // Check email uniqueness
        const existing = await dbQuery("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
        if (existing.rows.length > 0) {
            return reply.status(409).send({ ok: false, error: "Пользователь с таким email уже существует" });
        }
        // First ever user gets admin role
        const countResult = await dbQuery("SELECT COUNT(*) as count FROM users");
        const isFirstUser = Number(countResult.rows[0].count) === 0;
        const role = isFirstUser ? "admin" : "user";
        const passwordHash = await hashPassword(password);
        const result = await dbQuery("INSERT INTO users (email, password_hash, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, credits_balance", [email.toLowerCase(), passwordHash, name, role]);
        const user = result.rows[0];
        const payload = { userId: user.id, email: user.email, name: user.name, role: user.role };
        const token = app.jwt.sign(payload, { expiresIn: "30d" });
        setAuthCookie(reply, token);
        return reply.send({ ok: true, data: { id: user.id, email: user.email, name: user.name, role: user.role, credits_balance: user.credits_balance } });
    });
    // POST /api/auth/login
    app.post("/api/auth/login", async (req, reply) => {
        const parsed = LoginSchema.safeParse(req.body);
        if (!parsed.success) {
            return reply.status(400).send({ ok: false, error: parsed.error.issues[0]?.message ?? "Неверные данные" });
        }
        const { email, password } = parsed.data;
        const result = await dbQuery("SELECT id, email, name, role, password_hash, is_active, credits_balance FROM users WHERE email = $1", [email.toLowerCase()]);
        const user = result.rows[0];
        if (!user || !user.password_hash) {
            return reply.status(401).send({ ok: false, error: "Неверный email или пароль" });
        }
        if (!user.is_active) {
            return reply.status(403).send({ ok: false, error: "Аккаунт отключён. Обратитесь к администратору." });
        }
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return reply.status(401).send({ ok: false, error: "Неверный email или пароль" });
        }
        const payload = { userId: user.id, email: user.email, name: user.name, role: user.role };
        const token = app.jwt.sign(payload, { expiresIn: "30d" });
        setAuthCookie(reply, token);
        return reply.send({ ok: true, data: { id: user.id, email: user.email, name: user.name, role: user.role, credits_balance: user.credits_balance } });
    });
    // POST /api/auth/logout
    app.post("/api/auth/logout", async (_req, reply) => {
        clearAuthCookie(reply);
        return reply.send({ ok: true, data: null });
    });
    // GET /api/auth/me
    app.get("/api/auth/me", async (req, reply) => {
        const token = req.cookies?.auth_token;
        if (!token) {
            return reply.status(401).send({ ok: false, error: "Не авторизован" });
        }
        let payload;
        try {
            payload = app.jwt.verify(token);
        }
        catch {
            return reply.status(401).send({ ok: false, error: "Сессия истекла" });
        }
        const result = await dbQuery("SELECT id, email, name, role, is_active, credits_balance, storage_quota_mb, storage_used_mb FROM users WHERE id = $1", [payload.userId]);
        const user = result.rows[0];
        if (!user || !user.is_active) {
            clearAuthCookie(reply);
            return reply.status(401).send({ ok: false, error: "Аккаунт не найден или отключён" });
        }
        return reply.send({ ok: true, data: { id: user.id, email: user.email, name: user.name, role: user.role, credits_balance: user.credits_balance, storage_quota_mb: user.storage_quota_mb, storage_used_mb: Number(user.storage_used_mb) } });
    });
    // ─── Google OAuth ─────────────────────────────────────────────────────────
    // GET /api/auth/google — redirect to Google
    app.get("/api/auth/google", async (_req, reply) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            return reply.status(503).send({ ok: false, error: "Google OAuth не настроен" });
        }
        const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.APP_URL ?? ""}/api/auth/google/callback`;
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "openid email profile",
            access_type: "offline",
            prompt: "select_account",
        });
        return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    });
    // GET /api/auth/google/callback — handle Google callback
    app.get("/api/auth/google/callback", async (req, reply) => {
        const { code, error } = req.query;
        const frontendUrl = process.env.FRONTEND_URL ?? "";
        if (error || !code) {
            return reply.redirect(`${frontendUrl}/login?error=google_denied`);
        }
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? `${process.env.APP_URL ?? ""}/api/auth/google/callback`;
        if (!clientId || !clientSecret) {
            return reply.redirect(`${frontendUrl}/login?error=oauth_not_configured`);
        }
        try {
            // Exchange code for tokens
            const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    code,
                    client_id: clientId,
                    client_secret: clientSecret,
                    redirect_uri: redirectUri,
                    grant_type: "authorization_code",
                }),
            });
            const tokenData = await tokenRes.json();
            if (!tokenData.access_token) {
                app.log.error({ tokenData }, "Google token exchange failed");
                return reply.redirect(`${frontendUrl}/login?error=google_token_failed`);
            }
            // Get user info from Google
            const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            });
            const googleUser = await userRes.json();
            if (!googleUser.sub || !googleUser.email) {
                return reply.redirect(`${frontendUrl}/login?error=google_user_failed`);
            }
            // Find or create user
            let user = (await dbQuery("SELECT id, email, name, role, is_active, credits_balance FROM users WHERE google_id = $1", [googleUser.sub])).rows[0];
            if (!user) {
                // Check if email already exists (link accounts)
                user = (await dbQuery("SELECT id, email, name, role, is_active, credits_balance FROM users WHERE email = $1", [googleUser.email.toLowerCase()])).rows[0];
                if (user) {
                    // Link google_id to existing account
                    await dbQuery("UPDATE users SET google_id = $1 WHERE id = $2", [googleUser.sub, user.id]);
                }
                else {
                    // Create new user
                    const countResult = await dbQuery("SELECT COUNT(*) as count FROM users");
                    const isFirstUser = Number(countResult.rows[0].count) === 0;
                    const role = isFirstUser ? "admin" : "user";
                    const result = await dbQuery("INSERT INTO users (email, google_id, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, is_active, credits_balance", [googleUser.email.toLowerCase(), googleUser.sub, googleUser.name ?? googleUser.email, role]);
                    user = result.rows[0];
                }
            }
            if (!user.is_active) {
                return reply.redirect(`${frontendUrl}/login?error=account_disabled`);
            }
            const payload = { userId: user.id, email: user.email, name: user.name, role: user.role };
            const token = app.jwt.sign(payload, { expiresIn: "30d" });
            setAuthCookie(reply, token);
            return reply.redirect(frontendUrl || "/");
        }
        catch (err) {
            app.log.error(err, "Google OAuth callback error");
            return reply.redirect(`${frontendUrl}/login?error=server_error`);
        }
    });
}
