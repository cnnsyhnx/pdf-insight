export interface Env {
  /** Secrets: .env.local locally, `wrangler secret put` in production. Either may be missing. */
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;

  ANTHROPIC_MODEL: string;
  OPENAI_MODEL: string;
  ALLOWED_ORIGINS: string;
  DAILY_LIMIT: string;

  PER_IP: RateLimit;
  COUNTERS: KVNamespace;
}
