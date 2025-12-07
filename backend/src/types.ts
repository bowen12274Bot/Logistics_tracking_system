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
