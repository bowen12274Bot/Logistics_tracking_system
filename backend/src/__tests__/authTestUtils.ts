import { describe, it, expect } from "vitest";
import { apiRequest } from "./helpers";

interface EndpointTestConfig {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  description?: string;
  body?: Record<string, any>;
}

export function describe401Tests(endpoints: EndpointTestConfig[]) {
  describe("Authentication (401)", () => {
    endpoints.forEach(({ method, path, description, body }) => {
      it(`should return 401 for ${method} ${path}${description ? ` (${description})` : ""}`, async () => {
        const { status } = await apiRequest(path, {
          method,
          body: body ? JSON.stringify(body) : undefined,
        });
        expect(status).toBe(401);
      });
    });
  });
}

export async function expect401(
  method: string,
  path: string,
  body?: Record<string, any>
): Promise<void> {
  const { status } = await apiRequest(path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
  });
  expect(status).toBe(401);
}
