import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../types";

export class ContractApplicationStatus extends OpenAPIRoute {
	schema = {
		tags: ["Customers"],
		summary: "查詢合約申請狀態",
		description:
			"依 customer_id 取得最新一筆合約申請的狀態，用於前端決定是否顯示申請表單。",
		request: {
			query: z.object({
				customer_id: Str({ description: "客戶 ID", required: true }),
			}),
		},
		responses: {
			"200": {
				description: "回傳是否已有申請及其狀態",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							has_application: z.boolean(),
							application_id: Str({ required: false }),
							status: Str({ required: false }),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { customer_id } = data.query;

		const row = await c.env.DB.prepare(
			"SELECT id, status FROM contract_applications WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1",
		)
			.bind(customer_id)
			.first<{ id: string; status: string }>();

		if (!row) {
			return c.json({
				success: true,
				has_application: false,
			});
		}

		return c.json({
			success: true,
			has_application: true,
			application_id: row.id,
			status: row.status,
		});
	}
}

