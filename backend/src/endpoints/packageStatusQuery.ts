import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext, Package, PackageEvent } from "../types";

export class PackageStatusQuery extends OpenAPIRoute {
	schema = {
		tags: ["Packages"],
		summary: "貨態查詢 API (T4)",
		description: "查詢包裹狀態與事件歷程。客戶只能查自己的包裹。",
		request: {
			params: z.object({
				packageId: Str({ description: "包裹 ID 或追蹤碼" }),
			}),
		},
		responses: {
			"200": {
				description: "返回包裹資訊與事件列表",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							package: Package,
							events: z.array(PackageEvent),
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

		// Try to find by ID or tracking_number
		let pkg = await c.env.DB.prepare("SELECT * FROM packages WHERE id = ?")
			.bind(packageId)
			.first();

		if (!pkg) {
			pkg = await c.env.DB.prepare(
				"SELECT * FROM packages WHERE tracking_number = ?"
			)
				.bind(packageId)
				.first();
		}

		if (!pkg) {
			return c.json({ success: false, error: "Package not found" }, 404);
		}

		// Get all events for this package, ordered by time
		const events = await c.env.DB.prepare(
			"SELECT * FROM package_events WHERE package_id = ? ORDER BY events_at ASC"
		)
			.bind(pkg.id)
			.all();

		let parsedPackage = pkg;
		if (pkg.description_json) {
			try {
				const description = JSON.parse(pkg.description_json as string);
				parsedPackage = {
					...pkg,
					payment_method: pkg.payment_method ?? description.payment_method,
					sender: (pkg as any).sender ?? (pkg as any).sender_name ?? description.sender,
					receiver: (pkg as any).receiver ?? (pkg as any).receiver_name ?? description.receiver,
					delivery_time: pkg.delivery_time ?? description.delivery_time,
					pickup_date: description.pickup_date,
					pickup_time_window: description.pickup_time_window,
					pickup_notes: description.pickup_notes,
					route_path: pkg.route_path ?? description.route_path,
					description_json: description,
				};
			} catch (err) {
				parsedPackage = pkg;
			}
		}

		return {
			success: true,
			package: parsedPackage,
			events: events.results,
		};
	}
}

// List packages endpoint (for querying multiple)
export class PackageList extends OpenAPIRoute {
	schema = {
		tags: ["Packages"],
		summary: "包裹列表查詢",
		description: "查詢包裹列表，可依客戶 ID 篩選",
		request: {
			query: z.object({
				customer_id: Str({ description: "客戶 ID", required: false }),
				limit: z.coerce.number().int().default(20),
			}),
		},
		responses: {
			"200": {
				description: "返回包裹列表",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							packages: z.array(Package),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { customer_id, limit } = data.query;

		let query = "SELECT * FROM packages";
		const params: any[] = [];

		if (customer_id) {
			query += " WHERE customer_id = ?";
			params.push(customer_id);
		}

		query += ` LIMIT ${limit}`;

		const results = await c.env.DB.prepare(query).bind(...params).all();
		const packages = (results.results ?? []).map((pkg) => {
			if (pkg && pkg.description_json) {
				try {
					const description = JSON.parse(pkg.description_json as string);
					return {
						...pkg,
						payment_method: pkg.payment_method ?? description.payment_method,
						sender: (pkg as any).sender ?? (pkg as any).sender_name ?? description.sender,
						receiver: (pkg as any).receiver ?? (pkg as any).receiver_name ?? description.receiver,
						delivery_time: pkg.delivery_time ?? description.delivery_time,
						pickup_date: description.pickup_date,
						pickup_time_window: description.pickup_time_window,
						pickup_notes: description.pickup_notes,
						route_path: pkg.route_path ?? description.route_path,
						description_json: description,
					};
				} catch (err) {
					return pkg;
				}
			}
			return pkg;
		});

		return {
			success: true,
			packages,
		};
	}
}
