import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";
import { requireAdmin } from "../utils/authUtils";

// Helper to convert array of objects to CSV
function toCSV(data: any[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = String(val ?? "").replace(/"/g, '""'); // escape double quotes
      return `"${escaped}"`; // wrap in quotes
    });
    csvRows.push(values.join(","));
  }
  return csvRows.join("\n");
}

export class AdminReportBilling extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "Export Billing Report (CSV)",
    security: [{ bearerAuth: [] }],
    request: {
      query: z.object({
        year: z.string().regex(/^\d{4}$/),
        month: z.string().regex(/^(0?[1-9]|1[0-2])$/),
      }),
    },
    responses: {
      "200": {
        description: "CSV File",
        content: {
          "text/csv": {
            schema: z.string(),
          },
        },
      },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;

    const data = await this.getValidatedData<typeof this.schema>();
    const { year, month } = data.query;
    const period = `${year}-${month.padStart(2, "0")}`;

    // Fetch bills and aggregate data
    const bills = await c.env.DB.prepare(`
      SELECT 
        b.period,
        u.user_name as customer_name,
        u.email,
        b.total_amount,
        b.status,
        b.due_date,
        b.paid_at
      FROM monthly_bills b
      JOIN users u ON b.customer_id = u.id
      WHERE b.period = ?
    `).bind(period).all();

    const csvData = (bills.results || []).map((b: any) => ({
      Period: b.period,
      Customer: b.customer_name,
      Email: b.email,
      TotalAmount: b.total_amount,
      Status: b.status,
      DueDate: b.due_date,
      PaidAt: b.paid_at
    }));

    const csvContent = toCSV(csvData);

    return new Response(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="billing_report_${period}.csv"`,
      },
    });
  }
}

export class AdminReportPackages extends OpenAPIRoute {
  schema = {
    tags: ["Admin"],
    summary: "Export Package List (CSV)",
    security: [{ bearerAuth: [] }],
    request: {
       query: z.object({
          date: z.string().date().optional(),
       })
    },
    responses: {
      "200": { description: "CSV File" },
      "401": { description: "Unauthorized" },
      "403": { description: "Forbidden" },
    },
  };

  async handle(c: AppContext) {
    const auth = await requireAdmin(c);
    if (!auth.ok) return (auth as any).res;
    
    const data = await this.getValidatedData<typeof this.schema>();
    const { date } = data.query;

    let query = `
      SELECT 
        p.tracking_number, 
        u.user_name as sender_name,
        p.sender_address,
        p.receiver_name,
        p.receiver_address,
        p.weight,
        p.delivery_type,
        p.created_at
      FROM packages p
      LEFT JOIN users u ON p.customer_id = u.id
    `;
    
    const params: any[] = [];
    if (date) {
        query += " WHERE date(p.created_at) = ?";
        params.push(date);
    }
    query += " ORDER BY p.created_at DESC LIMIT 1000";

    const pkgs = await c.env.DB.prepare(query).bind(...params).all();
    
    const csvData = (pkgs.results || []).map((p: any) => ({
        TrackingNumber: p.tracking_number,
        Sender: p.sender_name || 'N/A',
        SenderAddress: p.sender_address,
        Receiver: p.receiver_name,
        ReceiverAddress: p.receiver_address,
        Weight: p.weight,
        Type: p.delivery_type,
        Created: p.created_at
    }));

    const csvContent = toCSV(csvData);
    
    return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="packages_export_${date || 'all'}.csv"`,
        },
    });
  }
}
