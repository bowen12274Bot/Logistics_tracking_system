import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext, Package } from "../types";

export class PackageCreate extends OpenAPIRoute {
	schema = {
		tags: ["Packages"],
		summary: "Create package (T2)",
		description: "Create a package draft and generate a tracking number.",
		request: {
			body: {
				content: {
					"application/json": {
						schema: z.object({
							customer_id: Str({ required: false, description: "Customer ID (user_id)" }),

							// Legacy fields (kept for backward compatibility)
							sender: Str({ required: false, description: "Sender name (legacy)" }),
							receiver: Str({ required: false, description: "Receiver name (legacy)" }),

							// Structured sender/receiver fields
							sender_name: Str({ required: false, description: "Sender name" }),
							sender_phone: Str({ required: false, description: "Sender phone" }),
							sender_address: Str({ required: false, description: "Sender address" }),
							receiver_name: Str({ required: false, description: "Receiver name" }),
							receiver_phone: Str({ required: false, description: "Receiver phone" }),
							receiver_address: Str({ required: false, description: "Receiver address" }),

							weight: z.coerce.number().int().optional(),
							size: Str({ required: false, description: "Package size or dimensions" }),
							delivery_time: Str({ required: false, description: "Delivery time tier" }),
							payment_type: Str({ required: false, description: "Payment type (prepaid/cod)" }),
							payment_method: Str({ required: false, description: "Payment method" }),
							declared_value: z.coerce.number().int().optional(),
							dangerous_materials: z.boolean().default(false),
							fragile_items: z.boolean().default(false),
							international_shipments: z.boolean().default(false),
							contents_description: Str({ required: false, description: "Contents description" }),
							pickup_date: Str({ required: false, description: "Pickup date (home pickup)" }),
							pickup_time_window: Str({ required: false, description: "Pickup time window" }),
							pickup_notes: Str({ required: false, description: "Pickup notes" }),
							route_path: Str({ required: false, description: "Route path (JSON string)" }),
							metadata: z.record(z.any()).optional(),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Created",
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
		const body = data.body;

		const resolvedSenderName = body.sender_name ?? body.sender ?? null;
		const resolvedReceiverName = body.receiver_name ?? body.receiver ?? null;

		const normalizedSenderAddress = (body.sender_address ?? "").trim().toUpperCase();
		const normalizedReceiverAddress = (body.receiver_address ?? "").trim().toUpperCase();

		const isEndHome = (value: string) => /^END_HOME_\d+$/.test(value);
		const isEndStore = (value: string) => /^END_STORE_\d+$/.test(value);

		const validateEndpointAddress = async (value: string, expectedSubtype?: "home" | "store") => {
			if (!value) return;

			if (!isEndHome(value) && !isEndStore(value)) {
				throw new Error("Address must be an END_HOME_x or END_STORE_x node id");
			}

			if (expectedSubtype === "home" && !isEndHome(value)) {
				throw new Error("Address must be a home endpoint (END_HOME_x)");
			}
			if (expectedSubtype === "store" && !isEndStore(value)) {
				throw new Error("Address must be a store endpoint (END_STORE_x)");
			}

			const node = await c.env.DB.prepare("SELECT id, subtype FROM nodes WHERE id = ?")
				.bind(value)
				.first<{ id: string; subtype: string | null }>();
			if (!node) {
				throw new Error("Address node does not exist in map");
			}
			if (expectedSubtype && node.subtype !== expectedSubtype) {
				throw new Error("Address node subtype mismatch");
			}
		};

		const pickupType = (body.metadata as any)?.pickup_type;
		const destinationType = (body.metadata as any)?.destination_type;

		try {
			if (pickupType === "home") await validateEndpointAddress(normalizedSenderAddress, "home");
			else if (pickupType === "store") await validateEndpointAddress(normalizedSenderAddress, "store");
			else await validateEndpointAddress(normalizedSenderAddress);

			if (destinationType === "home") await validateEndpointAddress(normalizedReceiverAddress, "home");
			else if (destinationType === "store") await validateEndpointAddress(normalizedReceiverAddress, "store");
			else await validateEndpointAddress(normalizedReceiverAddress);
		} catch (err: any) {
			return c.json({ success: false, error: String(err?.message ?? err) }, 400);
		}

		if (body.payment_type === "cod") {
			const receiverPhone = (body.receiver_phone ?? "").trim();
			const receiverName = (resolvedReceiverName ?? "").trim();

			if (!receiverPhone && !receiverName) {
				return c.json(
					{ success: false, error: "COD requires receiver_phone or receiver_name" },
					400,
				);
			}

			let sql = "SELECT id FROM users WHERE user_type = 'customer'";
			const params: any[] = [];
			if (receiverPhone && receiverName) {
				sql += " AND (phone_number = ? OR user_name = ?)";
				params.push(receiverPhone, receiverName);
			} else if (receiverPhone) {
				sql += " AND phone_number = ?";
				params.push(receiverPhone);
			} else {
				sql += " AND user_name = ?";
				params.push(receiverName);
			}

			const receiverCustomer = await c.env.DB.prepare(sql).bind(...params).first<{ id: string }>();
			if (!receiverCustomer) {
				return c.json(
					{ success: false, error: "Receiver must be a registered customer to use COD" },
					400,
				);
			}
		}

		// Resolve customer_id: prefer explicit id; else try to find by sender user_name
		let resolvedCustomerId: string | null = null;
		if (body.customer_id) {
			const customer = await c.env.DB.prepare("SELECT id FROM users WHERE id = ?")
				.bind(body.customer_id)
				.first();
			if (!customer) {
				return c.json({ success: false, error: "Customer not found" }, 400);
			}
			resolvedCustomerId = body.customer_id;
		} else if (resolvedSenderName) {
			const customerByName = await c.env.DB.prepare("SELECT id FROM users WHERE user_name = ?")
				.bind(resolvedSenderName)
				.first<{ id: string }>();
			if (!customerByName) {
				return c.json(
					{
						success: false,
						error: "Customer not found. Please provide a valid customer_id or sender name that exists.",
					},
					400,
				);
			}
			resolvedCustomerId = customerByName.id;
		} else {
			return c.json({ success: false, error: "customer_id or sender is required to identify customer" }, 400);
		}

		const mapBillingPreferenceToPaymentMethod = (pref: string | null | undefined) => {
			switch (pref) {
				case "cash":
					return "cash";
				case "credit_card":
					return "credit_card";
				case "bank_transfer":
					return "online_bank";
				case "monthly":
					return "monthly_billing";
				case "third_party_payment":
					return "third_party";
				default:
					return "cash";
			}
		};

		// Default payment_method should follow customer's billing_preference (if not explicitly provided)
		const customerPreference = await c.env.DB.prepare("SELECT billing_preference FROM users WHERE id = ?")
			.bind(resolvedCustomerId)
			.first<{ billing_preference: string | null }>();
		const effectivePaymentMethod = body.payment_method ?? mapBillingPreferenceToPaymentMethod(customerPreference?.billing_preference);

		const packageId = crypto.randomUUID();
		const trackingNumber = `TRK-${Date.now().toString(36)}-${packageId.slice(0, 8)}`;
		const createdAt = new Date().toISOString();

		const descriptionJson = {
			sender: resolvedSenderName,
			receiver: resolvedReceiverName,
			sender_name: resolvedSenderName,
			sender_phone: body.sender_phone ?? null,
			sender_address: normalizedSenderAddress || null,
			receiver_name: resolvedReceiverName,
			receiver_phone: body.receiver_phone ?? null,
			receiver_address: normalizedReceiverAddress || null,
			payment_method: effectivePaymentMethod ?? null,
			delivery_time: body.delivery_time ?? null,
			payment_type: body.payment_type ?? null,
			declared_value: body.declared_value ?? null,
			special_handling: {
				dangerous_materials: body.dangerous_materials,
				fragile_items: body.fragile_items,
				international_shipments: body.international_shipments,
			},
			pickup_date: body.pickup_date ?? null,
			pickup_time_window: body.pickup_time_window ?? null,
			pickup_notes: body.pickup_notes ?? null,
			route_path: body.route_path ?? null,
			metadata: body.metadata ?? {},
		};

		const specialHandlingList = [
			body.dangerous_materials ? "dangerous_materials" : null,
			body.fragile_items ? "fragile_items" : null,
			body.international_shipments ? "international_shipments" : null,
		].filter(Boolean);

		try {
			await c.env.DB.prepare(
				`INSERT INTO packages (
			id, customer_id,
			sender_name, sender_phone, sender_address,
			receiver_name, receiver_phone, receiver_address,
			weight, size, delivery_time,
			payment_type, declared_value, final_billing_date, special_handling,
			tracking_number, contents_description, route_path, description_json,
			status, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
				.bind(
					packageId,
					resolvedCustomerId,
					resolvedSenderName,
					body.sender_phone ?? null,
					normalizedSenderAddress || null,
					resolvedReceiverName,
					body.receiver_phone ?? null,
					normalizedReceiverAddress || null,
					body.weight ?? null,
					body.size ?? null,
					body.delivery_time ?? null,
					body.payment_type ?? null,
					body.declared_value ?? null,
					createdAt,
					JSON.stringify(specialHandlingList),
					trackingNumber,
					body.contents_description ?? null,
					body.route_path ?? null,
					JSON.stringify(descriptionJson),
					"created",
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
				sender: resolvedSenderName,
				receiver: resolvedReceiverName,
				sender_name: resolvedSenderName,
				sender_phone: body.sender_phone ?? null,
				sender_address: normalizedSenderAddress || null,
				receiver_name: resolvedReceiverName,
				receiver_phone: body.receiver_phone ?? null,
				receiver_address: normalizedReceiverAddress || null,
				weight: body.weight ?? null,
				size: body.size,
				delivery_time: body.delivery_time,
				payment_type: body.payment_type,
				payment_method: effectivePaymentMethod ?? null,
				declared_value: body.declared_value ?? null,
				tracking_number: trackingNumber,
				contents_description: body.contents_description ?? null,
				description_json: descriptionJson,
				special_handling: specialHandlingList,
				final_billing_date: createdAt,
				route_path: body.route_path ?? null,
				pickup_date: body.pickup_date,
				pickup_time_window: body.pickup_time_window,
				pickup_notes: body.pickup_notes,
			},
		};
	}
}
