import { fromHono } from "chanfana";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { TaskCreate } from "./endpoints/taskCreate";
import { TaskDelete } from "./endpoints/taskDelete";
import { TaskFetch } from "./endpoints/taskFetch";
import { TaskList } from "./endpoints/taskList";
import { MapFetch } from "./endpoints/mapFetch";
import { MapEdgeUpdate } from "./endpoints/mapUpdate";
import { MapRoute } from "./endpoints/mapRoute";
import { PackageEventCreate } from "./endpoints/packageEventCreate";
import { PackageStatusQuery, PackageList } from "./endpoints/packageStatusQuery";
import { PackageCreate } from "./endpoints/packageCreate";
import { PackageEstimate } from "./endpoints/packageEstimate";
import { AuthMe } from "./endpoints/authMe";
import { CustomerUpdate } from "./endpoints/customerUpdate";
import { ContractApplicationCreate } from "./endpoints/contractApplicationCreate";
import { ContractApplicationStatus } from "./endpoints/contractApplicationStatus";
import { TrackingPublic } from "./endpoints/trackingPublic";
import { TrackingSearch } from "./endpoints/trackingSearch";
import { DriverTaskList, DriverUpdateStatus } from "./endpoints/driverTasks";
import { WarehouseBatchOperation } from "./endpoints/warehouseOperations";
import { BillingBillList, BillingBillDetail } from "./endpoints/billingBills";
import { BillingPaymentCreate, BillingPaymentList } from "./endpoints/billingPayments";
import { AdminUserCreate } from "./endpoints/adminUsers";
import { AdminContractList, AdminContractReview } from "./endpoints/adminContracts";
import { AdminSystemErrors } from "./endpoints/adminErrors";

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
  billing_preference: string | null;
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
  billing_preference: user.billing_preference,
});

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

// Setup OpenAPI registry
const openapi = fromHono(app, {
  docs_url: "/",
});

// CORS for local dev (?ç«¯ http://localhost:5173 ??Pages ?è¦½)
app.use(
  "/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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

// è¨»å??°ä½¿?¨è€…ï?ä¸»è??ºå®¢?¶ï?
app.post("/api/auth/register", async (c) => {
  const body = await c.req.json<{
    user_name?: string;
    phone_number?: string;
    address?: string;
    email?: string;
    password?: string;
    user_type?: string;
    user_class?: string;
    billing_preference?: string;
  }>();

  if (!body.email || !body.password || !body.user_name) {
    return c.json({ error: "email, password, and user_name are required" }, 400);
  }

  // 安全起見：register 只建立 customer 帳號，忽略 user_type/user_class
  const userType = "customer";
  const userClass = "non_contract_customer";
  const billingPreference = body.billing_preference ?? null;
  const passwordHash = await sha256Hex(body.password);
  const id = crypto.randomUUID();

  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, user_name, phone_number, address, email, password_hash, user_type, user_class, billing_preference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
        billingPreference,
      )
      .run();
  } catch (err: any) {
    if (String(err).includes("UNIQUE")) {
      return c.json({ error: "Email 宸茶浣跨敤" }, 409);
    }
    return c.json({ error: "瑷诲?澶辨?", detail: String(err) }, 500);
  }

  const token = crypto.randomUUID();
  
  // ?插? token ?拌??欏韩
  await c.env.DB.prepare(
    "INSERT INTO tokens (id, user_id) VALUES (?, ?)"
  ).bind(token, id).run();

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
      billing_preference: billingPreference,
    }),
    token,
  });
});

// ?诲叆锛氭敮??email ??phone_number ??identifier
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ identifier?: string; password?: string }>();
  if (!body.identifier || !body.password) {
    return c.json({ error: "identifier and password are required" }, 400);
  }
  const passwordHash = await sha256Hex(body.password);
  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE email = ? OR phone_number = ?",
  )
    .bind(body.identifier, body.identifier)
    .first<UserRecord>();

  if (!user || user.password_hash !== passwordHash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = crypto.randomUUID();
  
  // ?插? token ?拌??欏韩
  await c.env.DB.prepare(
    "INSERT INTO tokens (id, user_id) VALUES (?, ?)"
  ).bind(token, user.id).run();

  return c.json({ user: publicUser(user), token });
});

// ?? ?°ĺ??©ć?čł‡ć?
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

// ?? ?Ąč©˘?©ć?čł‡ć?
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
openapi.get("/api/map/route", MapRoute);

// Package APIs (T3 & T4)
openapi.post("/api/packages", PackageCreate);
openapi.post("/api/packages/estimate", PackageEstimate);
openapi.post("/api/packages/:packageId/events", PackageEventCreate);
openapi.get("/api/packages/:packageId/status", PackageStatusQuery);
openapi.get("/api/packages", PackageList);

// Contract application (T5 1.5)
openapi.post("/api/customers/contract-application", ContractApplicationCreate);
openapi.get("/api/customers/contract-application/status", ContractApplicationStatus);

// Auth APIs
openapi.get("/api/auth/me", AuthMe);

// Customer APIs
openapi.put("/api/customers/me", CustomerUpdate);

// Tracking APIs
openapi.get("/api/tracking/search", TrackingSearch);
openapi.get("/api/tracking/:trackingNumber", TrackingPublic);

// Staff APIs
openapi.get("/api/driver/tasks", DriverTaskList);
openapi.post("/api/driver/packages/:packageId/status", DriverUpdateStatus);
openapi.post("/api/warehouse/batch-operation", WarehouseBatchOperation);

// Billing APIs
openapi.get("/api/billing/bills", BillingBillList);
openapi.get("/api/billing/bills/:billId", BillingBillDetail);
openapi.post("/api/billing/payments", BillingPaymentCreate);
openapi.get("/api/billing/payments", BillingPaymentList);

// Admin APIs
openapi.post("/api/admin/users", AdminUserCreate);
openapi.get("/api/admin/contract-applications", AdminContractList);
openapi.put("/api/admin/contract-applications/:id", AdminContractReview);
openapi.get("/api/admin/system/errors", AdminSystemErrors);

// Export the Hono app
export default app;
