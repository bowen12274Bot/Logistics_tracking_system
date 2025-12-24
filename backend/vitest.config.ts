import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => {
  return {
    test: {
      pool: "@cloudflare/vitest-pool-workers" as const,
      include: ["src/__tests__/**/*.test.ts"],
      exclude: ["src/__tests__/benchmark.test.ts"],
      poolOptions: {
        workers: {
          main: "./src/index.ts",
          isolatedStorage: true,
          singleWorker: true,
          wrangler: { configPath: "./wrangler.jsonc" },
        },
      },
      setupFiles: ["./src/__tests__/setup.ts"],
      coverage: {
        provider: "istanbul" as const,
        reporter: ["text", "html", "json"],
        reportsDirectory: "./coverage",
        include: ["src/**/*.ts"],
        exclude: [
          "src/__tests__/**",
          "src/**/*.test.ts",
          "src/**/*.d.ts",
        ],
      },
    },
  };
});
