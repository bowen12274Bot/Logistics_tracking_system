import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

// POST /api/customers/contract-application - 客戶申請合約客戶
export class ContractApplicationCreate extends OpenAPIRoute {
	schema = {
		tags: ["Customers"],
		summary: "提交合約客戶申請",
		security: [{ bearerAuth: [] }],
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							company_name: Str({ description: "公司名稱 / 抬頭" }),
							tax_id: Str({ description: "統一編號" }),
							contact_person: Str({ description: "聯絡人姓名" }),
							contact_phone: Str({ description: "聯絡人電話" }),
							billing_address: Str({ description: "發票/帳單地址" }),
							notes: Str({
								required: false,
								description: "備註/特殊需求",
							}),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "申請成功",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							application_id: Str(),
							status: Str(),
							message: Str(),
						}),
					},
				},
			},
			"400": { description: "輸入資料不完整" },
			"401": { description: "未授權" },
			"403": { description: "已是合約客戶或已有申請" },
		},
	};

	async handle(c: AppContext) {
		const authHeader = c.req.header("Authorization");
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return c.json({ success: false, error: "Token missing" }, 401);
		}

		const token = authHeader.replace("Bearer ", "");
		const tokenRecord = await c.env.DB.prepare(
			"SELECT user_id FROM tokens WHERE id = ?",
		)
			.bind(token)
			.first<{ user_id: string }>();

		if (!tokenRecord) {
			return c.json({ success: false, error: "Invalid token" }, 401);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const {
			company_name,
			tax_id,
			contact_person,
			contact_phone,
			billing_address,
			notes,
		} = data.body;

		const customer_id = tokenRecord.user_id;

		const customer = await c.env.DB.prepare(
			"SELECT id, user_class, user_type FROM users WHERE id = ?",
		)
			.bind(customer_id)
			.first<{ id: string; user_class: string; user_type: string }>();

		if (!customer) {
			return c.json({ success: false, error: "Customer not found" }, 401);
		}

		if (customer.user_type !== "customer") {
			return c.json({ success: false, error: "Only customers can apply" }, 403);
		}

		if (customer.user_class === "contract_customer") {
			return c.json(
				{ success: false, error: "Customer is already a contract customer" },
				403,
			);
		}

		const existing = await c.env.DB.prepare(
			"SELECT id, status FROM contract_applications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1",
		)
			.bind(customer_id)
			.first<{ id: string; status: string }>();

		if (existing && (existing.status === "pending" || existing.status === "approved")) {
			return c.json(
				{
					success: false,
					error: "An application already exists for this customer",
					application_id: existing.id,
					status: existing.status,
				},
				403,
			);
		}

		const id = crypto.randomUUID();

		await c.env.DB.prepare(
			`INSERT INTO contract_applications (
        id, customer_id, company_name, tax_id, contact_person, contact_phone, billing_address, notes, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
		)
			.bind(
				id,
				customer_id,
				company_name,
				tax_id,
				contact_person,
				contact_phone,
				billing_address,
				notes ?? null,
			)
			.run();

		return c.json({
			success: true,
			application_id: id,
			status: "pending",
			message: "申請已送出，請等待審核",
		});
	}
}
