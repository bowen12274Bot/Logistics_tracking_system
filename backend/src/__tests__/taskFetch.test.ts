import { describe, it, expect } from "vitest";
import { apiRequest } from "./helpers";

describe("Task Fetch API", () => {
  describe("GET /api/tasks/:taskSlug", () => {
    it("should return a task object for any slug", async () => {
      const { status, data } = await apiRequest<any>(
        "/api/tasks/my-test-task",
        { method: "GET" }
      );
      
      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.task).toBeDefined();
      expect(data.task.slug).toBe("my-test-task");
      expect(data.task.name).toBe("my task");
    });

    it("should return task with correct structure", async () => {
      const { status, data } = await apiRequest<any>(
        "/api/tasks/another-task",
        { method: "GET" }
      );
      
      expect(status).toBe(200);
      expect(data.task).toHaveProperty("name");
      expect(data.task).toHaveProperty("slug");
      expect(data.task).toHaveProperty("description");
      expect(data.task).toHaveProperty("completed");
      expect(data.task).toHaveProperty("due_date");
    });

    it("should handle special characters in slug", async () => {
      const { status, data } = await apiRequest<any>(
        "/api/tasks/task-with-numbers-123",
        { method: "GET" }
      );
      
      expect(status).toBe(200);
      expect(data.task.slug).toBe("task-with-numbers-123");
    });
  });
});
