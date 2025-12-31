import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function hasOptionalVitestHtmlReporter() {
  try {
    require.resolve("@vitest/ui/reporter");
    return true;
  } catch {
    return false;
  }
}

export default defineWorkersConfig(async () => {
  const hasHtmlReporter = hasOptionalVitestHtmlReporter();

  return {
    test: {
      pool: "@cloudflare/vitest-pool-workers" as const,
      include: ["src/__tests__/**/*.test.ts"],
      exclude: ["src/__tests__/benchmark.test.ts"],
      ...(hasHtmlReporter
        ? {
          reporters: ["default", "html"],
          outputFile: { html: "./html-report/index.html" },
        }
        : { reporters: ["default"] }),
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
