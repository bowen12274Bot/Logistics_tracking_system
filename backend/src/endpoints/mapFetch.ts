import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { type AppContext, Node, Edge } from "../types";

export class MapFetch extends OpenAPIRoute {
	schema = {
		tags: ["Map"],
		summary: "Fetch virtual map nodes and edges",
		responses: {
			"200": {
				description: "Returns the complete map structure",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							nodes: z.array(Node),
							edges: z.array(Edge),
						}),
					},
				},
			},
		},
	};

	async handle(c: AppContext) {
		const nodes = await c.env.DB.prepare("SELECT * FROM nodes").all();
		const edges = await c.env.DB.prepare("SELECT * FROM edges").all();

		return {
			success: true,
			nodes: nodes.results,
			edges: edges.results,
		};
	}
}
