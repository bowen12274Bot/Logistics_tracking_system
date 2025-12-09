import { OpenAPIRoute, Str } from "chanfana";
import { z } from "zod";
import { type AppContext } from "../types";

export class MapEdgeUpdate extends OpenAPIRoute {
	schema = {
		tags: ["Map"],
		summary: "Update a map edge",
		request: {
			params: z.object({
				id: Str({ description: "Edge ID" }),
			}),
			body: {
				content: {
					"application/json": {
						schema: z.object({
							road_multiple: z.number().int().optional(),
							cost: z.number().int().optional(),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "Updates the edge",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							message: z.string(),
						}),
					},
				},
			},
			"404": {
				description: "Edge not found",
			},
		},
	};

	async handle(c: AppContext) {
		const data = await this.getValidatedData<typeof this.schema>();
		const { id } = data.params;
		const { road_multiple, cost } = data.body;

		// Verify existence
		const edge = await c.env.DB.prepare("SELECT * FROM edges WHERE id = ?")
			.bind(id)
			.first();

		if (!edge) {
			return c.json({ success: false, error: "Edge not found" }, 404);
		}

		// Implement dynamic update query
		let query = "UPDATE edges SET";
		const updates: string[] = [];
		const values: any[] = [];

		if (road_multiple !== undefined) {
			updates.push(" road_multiple = ?");
			values.push(road_multiple);
		}
		if (cost !== undefined) {
			updates.push(" cost = ?");
			values.push(cost);
		}

		if (updates.length === 0) {
			return c.json({ success: true, message: "No changes made" });
		}

		query += updates.join(",") + " WHERE id = ?";
		values.push(id);

		await c.env.DB.prepare(query).bind(...values).run();

		return {
			success: true,
			message: "Edge updated successfully",
		};
	}
}
