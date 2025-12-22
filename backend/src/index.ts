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
import { CustomerExists } from "./endpoints/customerExists";
import { ContractApplicationCreate } from "./endpoints/contractApplicationCreate";
import { ContractApplicationStatus } from "./endpoints/contractApplicationStatus";
import { TrackingPublic } from "./endpoints/trackingPublic";
import { TrackingSearch } from "./endpoints/trackingSearch";
import { DriverTaskList, DriverUpdateStatus } from "./endpoints/driverTasks";
import { DriverTaskListV2, DriverTaskAccept, DriverTaskComplete } from "./endpoints/driverTaskPool";
import { WarehouseBatchOperation } from "./endpoints/warehouseOperations";
import { WarehousePackagesList } from "./endpoints/warehousePackages";
import { WarehousePackagesReceive } from "./endpoints/warehouseReceive";
import { WarehouseDispatchNextTask } from "./endpoints/warehouseTaskDispatch";
import { BillingBillList, BillingBillDetail } from "./endpoints/billingBills";
import { BillingPaymentCreate, BillingPaymentList } from "./endpoints/billingPayments";
import { AdminUserCreate } from "./endpoints/adminUsers";
import { AdminContractList, AdminContractReview } from "./endpoints/adminContracts";
import { AdminSystemErrors } from "./endpoints/adminErrors";
import { VehicleMeGet, VehicleMeMove } from "./endpoints/vehiclesMe";
import { DriverPackageExceptionCreate, DriverPackageExceptionList } from "./endpoints/driverPackageException";
import { VehicleMeCargoList } from "./endpoints/vehiclesCargoMe";
import { DriverTaskPickup, DriverTaskDropoff } from "./endpoints/driverTaskCargo";
import { DriverTaskEnRoute } from "./endpoints/driverTaskEnRoute";
import { CustomerServiceExceptionHandle, CustomerServiceExceptionList } from "./endpoints/csExceptions";

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

// CORS for local dev (??癟竄簪 http://localhost:5173 ??Pages ??癡礎翻)
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

// 癡穡罈疇??簞瓣翻聶?穡癡?砂污?瓣繡罈癡??繙疇簧瞽?繞簿?
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

  const email = body.email.trim().toLowerCase();
  const userName = body.user_name.trim();
  const phoneNumber = body.phone_number?.trim() || null;
  const address = body.address?.trim() || null;

  if (!email || !body.password || !userName) {
    return c.json({ error: "email, password, and user_name are required" }, 400);
  }

  // 摰韏瑁?嚗egister ?芸遣蝡?customer 撣唾?嚗蕭??user_type/user_class
  const userType = "customer";
  const userClass = "non_contract_customer";
  const billingPreference = body.billing_preference ?? null;
  const passwordHash = await sha256Hex(body.password);
  const id = crypto.randomUUID();

  try {
    const existing = await c.env.DB.prepare("SELECT 1 FROM users WHERE lower(email) = ? LIMIT 1")
      .bind(email)
      .first();
    if (existing) {
      return c.json({ error: "Email already exists" }, 409);
    }

    await c.env.DB.prepare(
      "INSERT INTO users (id, user_name, phone_number, address, email, password_hash, user_type, user_class, billing_preference) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        userName,
        phoneNumber,
        address,
        email,
        passwordHash,
        userType,
        userClass,
        billingPreference,
      )
      .run();
  } catch (err: any) {
    if (String(err).includes("UNIQUE")) {
      return c.json({ error: "Email 摰貉?行童頝冽" }, 409);
    }
    return c.json({ error: "?瑁租?瞉嗉儘?", detail: String(err) }, 500);
  }

  const token = crypto.randomUUID();

  // ??? token ????甈
  try {
    await c.env.DB.prepare("INSERT INTO tokens (id, user_id) VALUES (?, ?)").bind(token, id).run();
  } catch (err: any) {
    return c.json({ error: "Auth token storage failed", detail: String(err) }, 500);
  }

  return c.json({
    user: publicUser({
      id,
      user_name: userName,
      phone_number: phoneNumber,
      address,
      email,
      password_hash: passwordHash,
      user_type: userType,
      user_class: userClass,
      billing_preference: billingPreference,
    }),
    token,
  });
});

// ?霂脣??鬼???email ??phone_number ??identifier
app.post("/api/auth/login", async (c) => {
  const body = await c.req.json<{ identifier?: string; password?: string }>();
  if (!body.identifier || !body.password) {
    return c.json({ error: "identifier and password are required" }, 400);
  }

  const identifier = body.identifier.trim();
  const passwordHash = await sha256Hex(body.password);
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE lower(email) = ? OR phone_number = ?")
    .bind(identifier.toLowerCase(), identifier)
    .first<UserRecord>();

  if (!user || user.password_hash !== passwordHash) {
    return c.json({ error: "Invalid credentials" }, 401);
  }

  const token = crypto.randomUUID();

  // ??? token ????甈
  try {
    await c.env.DB.prepare("INSERT INTO tokens (id, user_id) VALUES (?, ?)").bind(token, user.id).run();
  } catch (err: any) {
    return c.json({ error: "Auth token storage failed", detail: String(err) }, 500);
  }

  return c.json({ user: publicUser(user), token });
});

// ?? ?簞贍??穢?????＿?
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

// ?? ???穢??穢?????＿?
app.get("/api/shipments/:id", async (c) => {
  const id = c.req.param("id");
  const result = await c.env.DB.prepare("SELECT * FROM shipments WHERE id = ?").bind(id).first();

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

// Vehicles APIs (driver only)
openapi.get("/api/vehicles/me", VehicleMeGet);
openapi.post("/api/vehicles/me/move", VehicleMeMove);
openapi.get("/api/vehicles/me/cargo", VehicleMeCargoList);

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
openapi.get("/api/customers/exists", CustomerExists);

// Tracking APIs
openapi.get("/api/tracking/search", TrackingSearch);
openapi.get("/api/tracking/:trackingNumber", TrackingPublic);

// Staff APIs
openapi.get("/api/driver/tasks", DriverTaskListV2);
openapi.post("/api/driver/tasks/:taskId/accept", DriverTaskAccept);
openapi.post("/api/driver/tasks/:taskId/complete", DriverTaskComplete);
openapi.post("/api/driver/tasks/:taskId/pickup", DriverTaskPickup);
openapi.post("/api/driver/tasks/:taskId/dropoff", DriverTaskDropoff);
openapi.post("/api/driver/tasks/:taskId/enroute", DriverTaskEnRoute);
openapi.post("/api/driver/packages/:packageId/status", DriverUpdateStatus);
openapi.post("/api/driver/packages/:packageId/exception", DriverPackageExceptionCreate);
openapi.get("/api/driver/exceptions", DriverPackageExceptionList);
openapi.get("/api/cs/exceptions", CustomerServiceExceptionList);
openapi.post("/api/cs/exceptions/:exceptionId/handle", CustomerServiceExceptionHandle);
openapi.get("/api/warehouse/packages", WarehousePackagesList);
openapi.post("/api/warehouse/packages/receive", WarehousePackagesReceive);
openapi.post("/api/warehouse/batch-operation", WarehouseBatchOperation);
openapi.post("/api/warehouse/packages/:packageId/dispatch-next", WarehouseDispatchNextTask);

import { BillingSettle } from "./endpoints/billingCycle";
import { BillingAdminUpdate, BillingAdminAddItem, BillingAdminRemoveItem } from "./endpoints/billingAdmin";

// ... existing code ...

// Billing APIs
openapi.get("/api/billing/bills", BillingBillList);
openapi.get("/api/billing/bills/:billId", BillingBillDetail);
openapi.post("/api/billing/payments", BillingPaymentCreate);
openapi.get("/api/billing/payments", BillingPaymentList);

// Admin Billing APIs
openapi.post("/api/admin/billing/settle", BillingSettle);
openapi.patch("/api/admin/billing/bills/:billId", BillingAdminUpdate);
openapi.post("/api/admin/billing/bills/:billId/items", BillingAdminAddItem);
openapi.delete("/api/admin/billing/bills/:billId/items/:itemId", BillingAdminRemoveItem);

// Admin APIs
openapi.post("/api/admin/users", AdminUserCreate);
openapi.get("/api/admin/contract-applications", AdminContractList);
openapi.put("/api/admin/contract-applications/:id", AdminContractReview);
openapi.get("/api/admin/system/errors", AdminSystemErrors);

// Export the Hono app
export default app;
