import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

export class ContractApplicationCreate extends OpenAPIRoute {
	schema = {
		tags: ["Customers"],
		summary: "提交合約客戶申請",
		description:
			"將非合約客戶的申請資料寫入 contract_applications 資料表，供客服與管理員後續審核使用。",
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							customer_id: Str({
								description: "客戶 ID（前端以目前登入使用者的 ID 帶入）",
							}),
							company_name: Str({ description: "公司名稱 / 抬頭" }),
							tax_id: Str({ description: "統一編號" }),
							contact_person: Str({ description: "聯絡人姓名" }),
							contact_phone: Str({ description: "聯絡人電話" }),
							billing_address: Str({ description: "開立發票用地址" }),
							notes: Str({
								required: false,
								description: "備註或特殊需求（選填）",
							}),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "申請建立成功",
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
			"400": {
				description: "輸入資料有誤或客戶不存在",
			},
			"403": {
				description: "已是合約客戶，或已有待審或已核准的申請",
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const {
			customer_id,
			company_name,
			tax_id,
			contact_person,
			contact_phone,
			billing_address,
			notes,
		} = data.body;

		const customer = await c.env.DB.prepare(
			"SELECT id, user_class, user_type FROM users WHERE id = ?",
		)
			.bind(customer_id)
			.first<{ id: string; user_class: string; user_type: string }>();

		if (!customer) {
			return c.json({ success: false, error: "Customer not found" }, 404);
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
			message: "合約申請已送出，客服將盡快審核。",
		});
	}
}

