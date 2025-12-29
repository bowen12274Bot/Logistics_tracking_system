import { AppContext } from "../types";

export const sendWebhookNotification = async (
  c: AppContext, 
  customerId: string, 
  eventType: string, 
  payload: any
) => {
  // If no DB, skip (e.g. testing)
  if (!c.env.DB) return;

  try {
    // consistency: find enabled subscriptions for this customer matching the event
    // For simplicity, we fetch all subs for customer and filter in code or SQL.
    // Storing events as JSON string ["a","b"] logic is tricky in SQL directly without JSON functions
    // We'll fetch all and filter in JS for now.
    
    const subs = await c.env.DB.prepare(
      "SELECT url, secret, events FROM webhook_subscriptions WHERE customer_id = ?"
    ).bind(customerId).all<{ url: string, secret: string | null, events: string }>();

    if (!subs.results || subs.results.length === 0) return;

    const notifications = subs.results.filter(sub => {
      try {
        const allowedEvents = JSON.parse(sub.events || "[]");
        return Array.isArray(allowedEvents) && allowedEvents.includes(eventType);
      } catch {
        return false;
      }
    });

    if (notifications.length === 0) return;

    // Send notifications async
    const tasks = notifications.map(async (sub) => {
      try {
        const body = JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            payload
        });
        
        // In a real system, compute signature using sub.secret (HMAC-SHA256)
        // const signature = ...

        const response = await fetch(sub.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "LogisticsSystem-Webhook/1.0",
            // "X-Hub-Signature-256": ...
          },
          body
        });

        if (!response.ok) {
           console.warn(`Webhook failed for ${sub.url}: ${response.status}`);
        }
      } catch (err) {
        console.error(`Webhook error for ${sub.url}:`, err);
      }
    });

    if (c.executionCtx) {
      c.executionCtx.waitUntil(Promise.all(tasks));
    } else {
      await Promise.all(tasks);
    }

  } catch (e) {
    console.error("Webhook notification error:", e);
  }
};
