import { DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const Task = z.object({
	name: Str({ example: "lorem" }),
	slug: Str(),
	description: Str({ required: false }),
	completed: z.boolean().default(false),
	due_date: DateTime(),
});

export const Node = z.object({
	id: Str({ example: "HUB_0" }),
	name: Str({ example: "HUB_0" }),
	level: z.number().int().min(1).max(4),
	x: z.number().int(),
	y: z.number().int(),
});

export const Edge = z.object({
	id: z.number().int(),
	source: Str({ example: "HUB_0" }),
	target: Str({ example: "REG_1" }),
	distance: z.number(),
	road_multiple: z.number().int(),
	cost: z.number().int(),
});

export const Package = z.object({
	id: Str({ example: "pkg_123" }),
	customer_id: Str({ required: false }),
	sender: Str({ required: false }),
	receiver: Str({ required: false }),
	tracking_number: Str({ required: false }),
	weight: z.number().int().optional(),
	size: Str({ required: false }),
	delivery_time: Str({ required: false }),
	payment_type: Str({ required: false }),
	payment_method: Str({ required: false }),
	special_handling: z.array(z.string()).optional(),
	declared_value: z.number().int().optional(),
	contents_description: Str({ required: false }),
	description_json: z.any().optional(),
	final_billing_date: Str({ required: false }),
	route_path: Str({ required: false }),
	pickup_date: Str({ required: false }),
	pickup_time_window: Str({ required: false }),
	pickup_notes: Str({ required: false }),
});

export const PackageEvent = z.object({
	id: Str({ example: "evt_123" }),
	package_id: Str({ example: "pkg_123" }),
	delivery_status: Str({ example: "收件" }),
	delivery_details: Str({ required: false }),
	events_at: Str({ example: "2025-01-01T12:00:00Z" }),
	location: Str({ required: false }),
});
