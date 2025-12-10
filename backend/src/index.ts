import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList";
import { MapFetch } from "./endpoints/mapFetch";
import { MapEdgeUpdate } from "./endpoints/mapUpdate";
import { PackageEventCreate } from "./endpoints/packageEventCreate";
import { PackageStatusQuery, PackageList } from "./endpoints/packageStatusQuery";
import { PackageCreate } from "./endpoints/packageCreate";

type Bindings = {
  DB: D1Database;
};

type UserRecord = {
  id: string;
  user_name: string;
  phone_number: string | null;
  address: string | null;
  email: string;
  password_hash: string;
  user_type: string;
  user_class: string;
};

const sha256Hex = async (input: string) => {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
};

const publicUser = (user: UserRecord) => ({
  id: user.id,
  user_name: user.user_name,
  phone_number: user.phone_number,
  address: user.address,
  email: user.email,
  user_type: user.user_type,
  user_class: user.user_class,
});

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// CORS for local dev (前端 http://localhost:5173 或 Pages 預覽)
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["*"],
  }),
);

app.get("/api/hello", (c) => {
  return c.json(
    { message: "Hello from Worker!" },
    200,
    {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  );
});

// 註冊新使用者（主要為客戶）
app.post("/api/auth/register", async (c) => {
  const body = await c.req.json<{
    user_name?: string;
    phone_number?: string;
    address?: string;
    email?: string;
    password?: string;
    user_type?: string;
    user_class?: string;
  }>();

  if (!body.email || !body.password || !body.user_name) {
    return c.json({ error: "email, password, user_name 為必填" }, 400);
  }

  const userType = body.user_type ?? "customer";
  const userClass = body.user_class ?? "non_contract_customer";
  const passwordHash = await sha256Hex(body.password);
  const id = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, user_name, phone_number, address, email, password_hash, user_type, user_class) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        body.user_name,
        body.phone_number ?? null,
        body.address ?? null,
        body.email,
        passwordHash,
        userType,
        userClass,
      )
      .run();
  } catch (err: any) {
    if (String(err).includes("UNIQUE")) {
      return c.json({ error: "Email 已被使用" }, 409);
    }
    return c.json({ error: "註冊失敗", detail: String(err) }, 500);
  }

  return c.json({
    user: publicUser({
      id,
      user_name: body.user_name,
      phone_number: body.phone_number ?? null,
      address: body.address ?? null,
      email: body.email,
      password_hash: passwordHash,
      user_type: userType,
      user_class: userClass,
    }),
    token: crypto.randomUUID(),
  });
});

// 登入：支援 email 或 phone_number 為 identifier
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ identifier?: string; password?: string }>();
  if (!body.identifier || !body.password) {
    return c.json({ error: "identifier 與 password 必填" }, 400);
  }
  const passwordHash = await sha256Hex(body.password);
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE email = ? OR phone_number = ?",
  )
    .bind(body.identifier, body.identifier)
    .first<UserRecord>();

  if (!user || user.password_hash !== passwordHash) {
    return c.json({ error: "帳號或密碼錯誤" }, 401);
  }

  return c.json({ user: publicUser(user), token: crypto.randomUUID() });
});

// 🆕 新增物流資料
app.post("/api/shipments", async (c) => {
  const data = await c.req.json();
  const id = data.id ?? crypto.randomUUID();

  await c.env.DB.prepare(
    "INSERT INTO shipments (id, sender, receiver, status, created_at) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(id, data.sender, data.receiver, "pending", new Date().toISOString())
    .run();

  return c.json({ id, message: "Shipment created" });
});

// 🔍 查詢物流資料
app.get("/api/shipments/:id", async (c) => {
  const id = c.req.param("id");
  const result = await c.env.DB.prepare(
    "SELECT * FROM shipments WHERE id = ?",
  )
    .bind(id)
    .first();

  if (!result) return c.json({ error: "Not found" }, 404);
  return c.json(result);
});

// Register OpenAPI endpoints
openapi.get("/api/tasks", TaskList);
openapi.post("/api/tasks", TaskCreate);
openapi.get("/api/tasks/:taskSlug", TaskFetch);
openapi.delete("/api/tasks/:taskSlug", TaskDelete);

// Map APIs
openapi.get("/api/map", MapFetch);
openapi.put("/api/map/edges/:id", MapEdgeUpdate);

// Package APIs (T3 & T4)
openapi.post("/api/packages", PackageCreate);
openapi.post("/api/packages/:packageId/events", PackageEventCreate);
openapi.get("/api/packages/:packageId/status", PackageStatusQuery);
openapi.get("/api/packages", PackageList);

// Export the Hono app
export default app;
