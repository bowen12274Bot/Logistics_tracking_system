declare module "cloudflare:test" {
  // Make `env.DB` type-safe in tests.
  interface ProvidedEnv extends Env {}
}

