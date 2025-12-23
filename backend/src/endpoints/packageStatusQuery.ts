import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext, Package, PackageEvent } from "../types";
import { getActiveException } from "../lib/packageGuards";

async function requireUser(c: AppContext) {
	const authHeader = c.req.header("Authorization");
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return { ok: false as const, res: c.json({ error: "Token missing" }, 401) };
	}

	const token = authHeader.replace("Bearer ", "");
	const tokenRecord = await c.env.DB.prepare("SELECT user_id FROM tokens WHERE id = ?")
		.bind(token)
		.first<{ user_id: string }>();
	if (!tokenRecord) {
		return { ok: false as const, res: c.json({ error: "Invalid token" }, 401) };
	}

	const user = await c.env.DB.prepare("SELECT id, user_type, user_class FROM users WHERE id = ?")
		.bind(tokenRecord.user_id)
		.first<{ id: string; user_type: string; user_class: string }>();
	if (!user) {
		return { ok: false as const, res: c.json({ error: "User not found" }, 401) };
	}

	return { ok: true as const, user };
}

export class PackageStatusQuery extends OpenAPIRoute {
	schema = {
		tags: ["Packages"],
		summary: "Package status query (T4)",
		description: "Query a package and its event history (customer can only access own packages).",
		security: [{ bearerAuth: [] }],
		request: {
			params: z.object({
				packageId: Str({ description: "Package ID or tracking number" }),
			}),
		},
		responses: {
			"200": {
				description: "OK",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							package: Package,
							events: z.array(PackageEvent),
							active_exception: z
								.object({
									id: z.string(),
									reason_code: z.string().nullable(),
									description: z.string().nullable(),
									reported_role: z.string(),
									reported_at: z.string().nullable(),
									location: z.string().nullable(),
								})
								.nullable(),
							vehicle: z
								.object({
									id: z.string(),
									vehicle_code: z.string(),
								})
								.nullable(),
						}),
					},
				},
			},
			"401": { description: "Unauthorized" },
			"403": { description: "Forbidden" },
			"404": { description: "Not found" },
		},
	};

	async handle(c: AppContext) {
		const auth = await requireUser(c);
		if (!auth.ok) return auth.res;

		const data = await this.getValidatedData<typeof this.schema>();
		const { packageId } = data.params;

		let pkg = await c.env.DB.prepare("SELECT * FROM packages WHERE id = ?")
			.bind(packageId)
			.first<any>();
		if (!pkg) {
			pkg = await c.env.DB.prepare("SELECT * FROM packages WHERE tracking_number = ?")
				.bind(packageId)
				.first<any>();
		}
		if (!pkg) {
			return c.json({ success: false, error: "Package not found" }, 404);
		}

		if (auth.user.user_type === "customer" && pkg.customer_id !== auth.user.id) {
			return c.json({ error: "Forbidden" }, 403);
		}

		const events = await c.env.DB.prepare(
			"SELECT * FROM package_events WHERE package_id = ? ORDER BY events_at ASC"
		)
			.bind(pkg.id)
			.all();

		const activeException = await getActiveException(c.env.DB, pkg.id);
		const eventsForUser =
			auth.user.user_type === "customer"
				? (events.results ?? []).map((evt: any) => {
						const status = String(evt?.delivery_status ?? "").trim().toLowerCase();
						if (status === "exception") {
							return { ...evt, delivery_details: null };
						}
						return evt;
					})
				: events.results;
		const activeExceptionForUser =
			activeException && auth.user.user_type === "customer"
				? {
						id: activeException.id,
						reason_code: activeException.reason_code,
						description: null,
						reported_role: activeException.reported_role,
						reported_at: activeException.reported_at,
						location: activeException.location,
					}
				: activeException;

		let vehicle = await c.env.DB.prepare(
			`
			SELECT v.id AS id, v.vehicle_code AS vehicle_code
			FROM vehicle_cargo vc
			JOIN vehicles v ON v.id = vc.vehicle_id
			WHERE vc.package_id = ? AND vc.unloaded_at IS NULL
			ORDER BY vc.loaded_at DESC
			LIMIT 1
			`,
		)
			.bind(pkg.id)
			.first<{ id: string; vehicle_code: string }>();

		// If not loaded yet, but the latest event location is a TRUCK_ code (driver en-route to pickup),
		// resolve it to a vehicle record so the customer UI can show truck code.
		if (!vehicle) {
			const latest = await c.env.DB.prepare(
				"SELECT location FROM package_events WHERE package_id = ? ORDER BY events_at DESC LIMIT 1",
			)
				.bind(pkg.id)
				.first<{ location: string | null }>();
			const loc = String(latest?.location ?? "").trim();
			if (/^TRUCK_/i.test(loc)) {
				vehicle = await c.env.DB.prepare("SELECT id, vehicle_code FROM vehicles WHERE UPPER(vehicle_code) = ? LIMIT 1")
					.bind(loc.toUpperCase())
					.first<{ id: string; vehicle_code: string }>();
			}
		}

		let parsedPackage = pkg;
		if (pkg.description_json) {
			try {
				const description = JSON.parse(pkg.description_json as string);
				let specialHandling: any = description.special_handling ?? [];
				try {
					if ((pkg as any).special_handling) {
						specialHandling = JSON.parse((pkg as any).special_handling as string);
					}
				} catch {
					// ignore parse error
				}

				parsedPackage = {
					...pkg,
					payment_method: pkg.payment_method ?? description.payment_method,
					sender: (pkg as any).sender ?? (pkg as any).sender_name ?? description.sender,
					receiver: (pkg as any).receiver ?? (pkg as any).receiver_name ?? description.receiver,
					special_handling: specialHandling,
					declared_value: (pkg as any).declared_value ?? description.declared_value,
					delivery_time: pkg.delivery_time ?? description.delivery_time,
					pickup_date: description.pickup_date,
					pickup_time_window: description.pickup_time_window,
					pickup_notes: description.pickup_notes,
					route_path: pkg.route_path ?? description.route_path,
					description_json: description,
				};
			} catch {
				parsedPackage = pkg;
			}
		}

		return {
			success: true,
			package: parsedPackage,
			events: eventsForUser,
			active_exception: activeExceptionForUser ?? null,
			vehicle: vehicle ? { id: String(vehicle.id), vehicle_code: String(vehicle.vehicle_code) } : null,
		};
	}
}

export class PackageList extends OpenAPIRoute {
	schema = {
		tags: ["Packages"],
		summary: "Package list query",
		description: "Customer can only list own packages; employees can list all (temporary policy).",
		security: [{ bearerAuth: [] }],
		request: {
			query: z.object({
				customer_id: Str({ description: "Customer ID", required: false }),
				limit: z.coerce.number().int().default(20),
			}),
		},
		responses: {
			"200": {
				description: "OK",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							packages: z.array(Package),
						}),
					},
				},
			},
			"401": { description: "Unauthorized" },
			"403": { description: "Forbidden" },
		},
	};

	async handle(c: AppContext) {
		const auth = await requireUser(c);
		if (!auth.ok) return auth.res;

		const data = await this.getValidatedData<typeof this.schema>();
		const { customer_id, limit } = data.query;

		const effectiveCustomerId = auth.user.user_type === "customer" ? auth.user.id : customer_id;

		let query = "SELECT * FROM packages";
		const params: any[] = [];

		if (effectiveCustomerId) {
			query += " WHERE customer_id = ?";
			params.push(effectiveCustomerId);
		}

		query += ` LIMIT ${limit}`;

		const results = await c.env.DB.prepare(query).bind(...params).all();
		const packages = (results.results ?? []).map((pkg) => {
			if (pkg && pkg.description_json) {
				try {
					const description = JSON.parse(pkg.description_json as string);
					let specialHandling: any = description.special_handling ?? [];
					try {
						if ((pkg as any).special_handling) {
							specialHandling = JSON.parse((pkg as any).special_handling as string);
						}
					} catch {
						// ignore parse error
					}
					return {
						...pkg,
						payment_method: pkg.payment_method ?? description.payment_method,
						sender: (pkg as any).sender ?? (pkg as any).sender_name ?? description.sender,
						receiver: (pkg as any).receiver ?? (pkg as any).receiver_name ?? description.receiver,
						special_handling: specialHandling,
						declared_value: (pkg as any).declared_value ?? description.declared_value,
						delivery_time: pkg.delivery_time ?? description.delivery_time,
						pickup_date: description.pickup_date,
						pickup_time_window: description.pickup_time_window,
						pickup_notes: description.pickup_notes,
						route_path: pkg.route_path ?? description.route_path,
						description_json: description,
					};
				} catch {
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
