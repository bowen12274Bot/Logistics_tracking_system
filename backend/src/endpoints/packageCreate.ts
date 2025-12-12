import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext, Package } from "../types";

export class PackageCreate extends OpenAPIRoute {
	schema = {
		tags: ["Packages"],
		summary: "建立寄件 (T2)",
		description: "建立包裹基本資料並產生追蹤號。",
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							customer_id: Str({
								required: false,
								description: "客戶 ID（寄件人 user_id）",
							}),
							sender: Str({ required: false, description: "寄件人姓名" }),
							receiver: Str({ required: false, description: "收件人姓名" }),
							weight: z.coerce.number().int().optional(),
							size: Str({ required: false, description: "尺寸/重量級距" }),
							delivery_time: Str({ required: false, description: "配送時效或服務級距" }),
							payment_type: Str({ required: false, description: "付款類型（預付/到付）" }),
							payment_method: Str({
								required: false,
								description: "付款方式（信用卡、月結等）",
							}),
							declared_value: z.coerce.number().int().optional(),
							dangerous_materials: z.boolean().default(false),
							fragile_items: z.boolean().default(false),
							international_shipments: z.boolean().default(false),
							contents_description: Str({
								required: false,
								description: "貨物描述",
							}),
							pickup_date: Str({ required: false, description: "取件日期" }),
							pickup_time_window: Str({
								required: false,
								description: "取件時段",
							}),
							pickup_notes: Str({
								required: false,
								description: "給司機的備註",
							}),
							route_path: Str({
								required: false,
								description: "物流路徑（JSON 或文字描述）",
							}),
							metadata: z.record(z.any()).optional(),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "建立成功並回傳包裹資料",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							package: Package,
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const {
			customer_id,
			sender,
			receiver,
			weight,
			size,
			delivery_time,
			payment_type,
			payment_method,
			declared_value,
			contents_description,
			dangerous_materials,
			fragile_items,
			international_shipments,
			pickup_date,
			pickup_time_window,
			pickup_notes,
			route_path,
			metadata,
		} = data.body;

		// Resolve customer_id: prefer explicit id; else try to find by sender user_name
		let resolvedCustomerId: string | null = null;
		if (customer_id) {
			const customer = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?")
				.bind(customer_id)
				.first();
			if (!customer) {
				return c.json({ success: false, error: "Customer not found" }, 400);
			}
			resolvedCustomerId = customer_id;
		} else if (sender) {
			const customerByName = await c.env.DB.prepare(
				"SELECT id FROM users WHERE user_name = ?"
			)
				.bind(sender)
				.first<{ id: string }>();
			if (!customerByName) {
				return c.json(
					{
						success: false,
						error: "Customer not found. Please provide a valid customer_id or sender name that exists.",
					},
					400
				);
			}
			resolvedCustomerId = customerByName.id;
		} else {
			return c.json(
				{ success: false, error: "customer_id or sender is required to identify customer" },
				400
			);
		}

		const packageId = crypto.randomUUID();
		const trackingNumber = `TRK-${Date.now().toString(36)}-${packageId.slice(0, 8)}`;
		const createdAt = new Date().toISOString();

		const descriptionJson = {
			sender,
			receiver,
			payment_method,
			delivery_time,
			payment_type,
			declared_value,
			special_handling: {
				dangerous_materials,
				fragile_items,
				international_shipments,
			},
			pickup_date,
			pickup_time_window,
			pickup_notes,
			route_path,
			metadata: metadata ?? {},
		};

		const specialHandlingList = [
			dangerous_materials ? "dangerous_materials" : null,
			fragile_items ? "fragile_items" : null,
			international_shipments ? "international_shipments" : null,
		].filter(Boolean);

		try {
			await c.env.DB.prepare(
				`INSERT INTO packages (
			id, customer_id, sender_name, receiver_name, weight, size, delivery_time,
			payment_type, declared_value, final_billing_date, special_handling,
			tracking_number, contents_description, route_path, description_json,
			status, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
			)
				.bind(
					packageId,
					resolvedCustomerId,
					sender ?? null,
					receiver ?? null,
					weight ?? null,
					size ?? null,
					delivery_time ?? null,
					payment_type ?? null,
					declared_value ?? null,
					createdAt,
					JSON.stringify(specialHandlingList),
					trackingNumber,
					contents_description ?? null,
					route_path ?? null,
					JSON.stringify(descriptionJson),
					"created", // status
					createdAt,
				)
				.run();
		} catch (err: any) {
			return c.json({ success: false, error: "Failed to create package", detail: String(err) }, 500);
		}

		return {
			success: true,
			package: {
				id: packageId,
				customer_id: resolvedCustomerId,
				sender: sender ?? null,
				receiver: receiver ?? null,
				weight: weight ?? null,
				size,
				delivery_time,
				payment_type,
				payment_method: payment_method ?? null,
				declared_value: declared_value ?? null,
				tracking_number: trackingNumber,
				contents_description: contents_description ?? null,
				description_json: descriptionJson,
				special_handling: specialHandlingList,
				final_billing_date: createdAt,
				route_path: route_path ?? null,
				pickup_date,
				pickup_time_window,
				pickup_notes,
			},
		};
	}
}
