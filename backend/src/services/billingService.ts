import { DateTime } from "luxon";

/**
 * Get billing cycle (start/end) for a given date or string (ISO).
 * Cycle is always from 1st day 00:00:00Z to last day 23:59:59Z of the month.
 */
export function getBillingCycle(dateOrIso: Date | string) {
  const dt = typeof dateOrIso === "string" 
    ? DateTime.fromISO(dateOrIso).toUTC() 
    : DateTime.fromJSDate(dateOrIso).toUTC();

  const start = dt.startOf("month").toISO()!; // YYYY-MM-01T00:00:00.000Z
  const end = dt.endOf("month").toISO()!;     // YYYY-MM-LLT23:59:59.999Z
  return { start, end, year: dt.year, month: dt.month };
}

/**
 * Create a monthly bill for a customer if it doesn't already exist for the cycle.
 * Returns the bill ID.
 */
export async function createMonthlyBillForCustomer(
  db: D1Database,
  customerId: string,
  cycleStart: string,
  cycleEnd: string
): Promise<string> {
  // Check if bill exists
  const existing = await db.prepare(
    "SELECT id FROM monthly_billing WHERE customer_id = ? AND cycle_start = ?"
  )
  .bind(customerId, cycleStart)
  .first<{ id: string }>();

  if (existing) {
    return existing.id;
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  
  await db.prepare(`
    INSERT INTO monthly_billing (
      id, customer_id, cycle_start, cycle_end, 
      status, total_amount, created_at
    ) VALUES (?, ?, ?, ?, 'pending', 0, ?)
  `)
  .bind(id, customerId, cycleStart, cycleEnd, createdAt)
  .run();

  return id;
}

/**
 * Add a delivered package to the customer's monthly bill.
 * 1. Calculate cost if needed (from payments table or package cost).
 * 2. Find or create bill for the package's final_billing_date (or current time).
 * 3. Add item to monthly_billing_items.
 * 4. Update monthly_billing.total_amount.
 * 5. Update package.final_billing_date (if not set).
 */
export async function addPackageToBill(
  db: D1Database,
  customerId: string,
  packageId: string,
  billingDateIso?: string
) {
  const billingDate = billingDateIso || new Date().toISOString();
  const { start, end } = getBillingCycle(billingDate);

  // 1. Get package payment amount
  // We assume the payment record exists creating the cost "charge", even if unpaid.
  const payment = await db.prepare(
    "SELECT total_amount FROM payments WHERE package_id = ?"
  ).bind(packageId).first<{ total_amount: number }>();

  // If no payment record, maybe free or error? Assume 0 cost or skip?
  // Term project: assume payment record generated at creation.
  const amount = payment?.total_amount || 0;

  // 2. Find or create bill
  const billId = await createMonthlyBillForCustomer(db, customerId, start, end);

  // 3. Check if item already in bill (idempotency)
  const existingItem = await db.prepare(
    "SELECT id FROM monthly_billing_items WHERE monthly_billing_id = ? AND package_id = ?"
  ).bind(billId, packageId).first();

  if (existingItem) {
    return; // Already added
  }

  // 4. Add item
  const itemId = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO monthly_billing_items (id, monthly_billing_id, package_id) VALUES (?, ?, ?)"
  ).bind(itemId, billId, packageId).run();

  // 5. Update bill total
  await db.prepare(
    "UPDATE monthly_billing SET total_amount = total_amount + ? WHERE id = ?"
  ).bind(amount, billId).run();

  // 6. Update package final_billing_date if different from provided or not set
  await db.prepare(
    "UPDATE packages SET final_billing_date = ? WHERE id = ?"
  ).bind(billingDate, packageId).run();
}

/**
 * Settle billing cycle: 
 * - Mark pending bills as finalized/ready for payment? 
 * - Actually, in this system, 'pending' means accumulating or waiting payment.
 * - We usually just define a Due Date.
 */
export async function settleBillingCycle(
  db: D1Database,
  year: number,
  month: number
) {
  // Construct cycle start for that month
  const dt = DateTime.fromObject({ year, month, day: 1 }).toUTC();
  const cycleStart = dt.startOf("month").toISO()!;
  
  // Due date is 15th of next month
  const nextMonth = dt.plus({ months: 1 });
  const dueDate = nextMonth.set({ day: 15 }).endOf("day").toISO()!;

  // Update all pending bills for this cycle with due_date
  // We might also update status if needed, but 'pending' works until paid.
  // Maybe we want to lock them? Currently schema only has pending/paid/overdue.
  // We keep them as 'pending' but set the due_date.

  await db.prepare(`
    UPDATE monthly_billing 
    SET due_date = ?
    WHERE cycle_start = ? AND status = 'pending' AND due_date IS NULL
  `)
  .bind(dueDate, cycleStart)
  .run();
  
  // Logic to mark OLD bills as overdue could go here too.
  // E.g. bills from 2 months ago that are still pending.
  
  return {
    cycle: `${year}-${month}`,
    message: "Billing cycle settled. Due dates updated."
  };
}
