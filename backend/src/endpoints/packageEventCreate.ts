import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext, PackageEvent } from "../types";

export class PackageEventCreate extends OpenAPIRoute {
	schema = {
		tags: ["Packages"],
		summary: "建立貨態事件 (T3)",
		description: "建立包裹事件並更新追蹤資訊。",
		request: {
			params: z.object({
				packageId: Str({ description: "包裹 ID" }),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							delivery_status: Str({
								description: "事件狀態",
								example: "picked_up",
							}),
							delivery_details: Str({
								description: "事件說明",
								required: false,
							}),
							location: Str({
								description: "位置或載具識別碼（節點 ID / 貨車編號）",
								required: false,
							}),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "事件建立成功",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							event_id: z.string(),
							message: z.string(),
						}),
					},
				},
			},
			"404": {
				description: "包裹不存在",
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { packageId } = data.params;
		const { delivery_status, delivery_details, location } = data.body;

		const pkg = await c.env.DB.prepare("SELECT * FROM packages WHERE id = ?")
			.bind(packageId)
			.first();

		if (!pkg) {
			return c.json({ success: false, error: "Package not found" }, 404);
		}

		const eventId = crypto.randomUUID();
		const eventsAt = new Date().toISOString();

		await c.env.DB.prepare(
			"INSERT INTO package_events (id, package_id, delivery_status, delivery_details, events_at, location) VALUES (?, ?, ?, ?, ?, ?)"
		)
			.bind(
				eventId,
				packageId,
				delivery_status,
				delivery_details ?? null,
				eventsAt,
				location ?? null
			)
			.run();

		return {
			success: true,
			event_id: eventId,
			message: "事件建立成功",
		};
	}
}
