import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext, PackageEvent } from "../types";

const DeliveryStatusEnum = z.enum([
	"created",
	"picked_up",
	"in_transit",
	"sorting",
	"warehouse_in",
	"warehouse_received",
	"warehouse_out",
	"out_for_delivery",
	"delivered",
	"exception",
	"route_decided",
	"sorting_started",
	"sorting_completed",
	"enroute_pickup",
	"arrived_pickup",
	"payment_collected_prepaid",
	"enroute_delivery",
	"arrived_delivery",
	"payment_collected_cod",
]);

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
							delivery_status: DeliveryStatusEnum.describe("事件狀態"),
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

		if (
			delivery_status === "in_transit" &&
			!(
				String(delivery_details ?? "").match(/(?:\u524d\u5f80|\u4e0b\u4e00\u7ad9)\s*[A-Z0-9_]+/i)
			)
		) {
			return c.json(
				{ success: false, error: "in_transit 必須在 delivery_details 內包含目的地（例如：前往 HUB_0 / 下一站 REG_1）" },
				400,
			);
		}

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
