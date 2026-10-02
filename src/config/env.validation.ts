import Joi from "joi";

/**
 * Joi schema for environment variables.
 *
 * Rules:
 *  - Booleans accept "true"/"false" strings (env vars are always strings).
 *  - Production secrets are required when NODE_ENV=production.
 *  - New env vars for issues #411 (replica URLs), #412 (cursor secret),
 *    and #413 (archival) are added here.
 */

export const envValidationSchema = Joi.object({
  // ── Core ───────────────────────────────────────────────────────────────────
  NODE_ENV: Joi.string().valid("development", "production", "test").default("development"),
  PORT: Joi.number().integer().min(1).max(65535).default(4000),
  CORS_ORIGIN: Joi.string().default("*"),

  // ── Database ───────────────────────────────────────────────────────────────
  DATABASE_URL: Joi.string().default("postgresql://vortex:vortex@localhost:5432/vortex?schema=public"),

  /**
   * #411 — Read-replica URLs.
   * Comma-separated list of Postgres connection strings for read replicas.
   * Leave blank to use the primary for all reads.
   */
  DATABASE_REPLICA_URLS: Joi.string().allow("").default(""),
  MAX_REPLICA_LAG_MS: Joi.number().integer().min(100).max(60000).default(5000),

  // ── Stellar ────────────────────────────────────────────────────────────────
  STELLAR_NETWORK: Joi.string().valid("testnet", "futurenet", "mainnet").default("testnet"),
  SOROBAN_RPC_URL: Joi.string().uri().default("https://soroban-testnet.stellar.org"),
  SOROBAN_RPC_URLS: Joi.string().allow("").default(""),
  ARCHIVAL_RPC_URL: Joi.string().allow("").default(""),
  HORIZON_URL: Joi.string().uri().default("https://horizon-testnet.stellar.org"),
  STELLAR_SIGNER_SECRET_KEY: Joi.string().allow("").default(""),
  SETTLEMENT_CONTRACT_ID: Joi.string().allow("").default(""),
  SOLVER_REGISTRY_CONTRACT_ID: Joi.string().allow("").default(""),
  TREASURY_ADDRESS: Joi.string().allow("").default(""),

  SOROBAN_SIGNING_KEY: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .pattern(/^S[A-Z2-7]{55}$/, "Stellar secret seed (S + 55 base32 chars)")
      .required(),
    otherwise: Joi.string()
      .pattern(/^(S[A-Z2-7]{55})?$/, "Stellar secret seed or empty")
      .allow("")
      .default(""),
  }),

  SIGNER_BACKEND: Joi.string().valid("local", "vault").default("local"),
  VAULT_ADDR: Joi.string().allow("").default(""),
  VAULT_TOKEN: Joi.string().allow("").default(""),
  VAULT_TRANSIT_KEY_NAME: Joi.string().default("vortex-signer"),
  ALLOW_LOCAL_SIGNER_IN_PROD: Joi.boolean().default(false),

  // ── On-chain writes ────────────────────────────────────────────────────────
  ONCHAIN_INTENTS_ENABLED: Joi.boolean().default(false),
  ONCHAIN_DRY_RUN: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.boolean().required(),
    otherwise: Joi.boolean().default(true),
  }),
  SOROBAN_FEE_PERCENTILE: Joi.string()
    .valid("min", "mode", "p10", "p20", "p30", "p40", "p50", "p60", "p70", "p80", "p90", "p95", "p99", "max")
    .default("p50"),
  SOROBAN_MAX_FEE_STROOPS: Joi.number().integer().min(0).default(1_000_000),
  CHANNEL_POOL_SIZE: Joi.number().integer().min(1).default(8),
  CHANNEL_SECRET_KEYS: Joi.string().allow("").default(""),

  // ── Persistence ────────────────────────────────────────────────────────────
  INTENTS_STORE: Joi.string().valid("memory", "dual", "postgres").default("memory"),
  INTENTS_PERSISTENCE: Joi.string().valid("memory", "dual", "postgres").default("memory"),
  INTENTS_VERIFY_INTERVAL_MS: Joi.number().integer().min(0).default(60000),
  SOLVERS_PERSISTENCE: Joi.string().valid("memory", "prisma").default("memory"),
  TOKENS_PERSISTENCE: Joi.string().valid("memory", "prisma").default("memory"),

  // ── Intent retention ───────────────────────────────────────────────────────
  INTENT_RETENTION_DAYS: Joi.number().integer().min(0).default(30),
  INTENT_RETENTION_SWEEP_MS: Joi.number().integer().min(0).default(60000),

  // ── WebSocket ──────────────────────────────────────────────────────────────
  WS_MAX_CONNECTIONS: Joi.number().integer().min(0).default(1000),
  WS_BACKPLANE: Joi.string().valid("memory", "redis").default("memory"),
  WS_MAX_PAYLOAD_BYTES: Joi.number().integer().min(1024).default(16384),
  WS_MAX_CONNECTIONS_PER_IP: Joi.number().integer().min(0).default(20),
  WS_TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(0),
  WS_RATE_LIMIT_PER_SEC: Joi.number().integer().min(0).default(10),
  WS_RATE_LIMIT_BURST: Joi.number().integer().min(0).default(20),
  WS_RATE_LIMIT_MAX_VIOLATIONS: Joi.number().integer().min(0).default(5),
  WS_OUTBOUND_QUEUE_MAX: Joi.number().integer().min(0).default(1000),
  WS_OUTBOUND_BUFFER_BYTES: Joi.number().integer().min(0).default(1048576),
  WS_SLOW_CONSUMER_POLICY: Joi.string().valid("drop_oldest", "disconnect").default("drop_oldest"),
  WS_DRAIN_TIMEOUT_MS: Joi.number().integer().min(0).default(25000),

  // ── SSE ────────────────────────────────────────────────────────────────────
  SSE_HEARTBEAT_MS: Joi.number().integer().min(0).default(15000),
  SSE_MAX_BUFFER_BYTES: Joi.number().integer().min(0).default(1048576),

  // ── Redis ──────────────────────────────────────────────────────────────────
  REDIS_URL: Joi.string().allow("").default("redis://localhost:6379"),

  // ── Jobs ───────────────────────────────────────────────────────────────────
  JOBS_DRIVER: Joi.string().valid("memory", "bullmq").default("memory"),
  JOBS_SHUTDOWN_TIMEOUT_MS: Joi.number().integer().min(0).default(25000),
  PROCESS_ROLE: Joi.string().valid("api", "worker", "all").default("all"),

  // ── Kill-switch ────────────────────────────────────────────────────────────
  KILLSWITCH_OPERATOR_TOKEN: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").default(""),
  }),
  KILLSWITCH_REDIS_URL: Joi.string().allow("").default(""),
  KILLSWITCH_POLL_MS: Joi.number().integer().min(100).max(5000).default(2000),
  KILLSWITCH_PERSISTENCE: Joi.string().valid("memory", "prisma").default("memory"),

  // ── Auth ───────────────────────────────────────────────────────────────────
  AUTH_JWT_SECRET: Joi.string().allow("").default(""),
  ADMIN_API_KEYS: Joi.string().allow("").default(""),

  // ── EVM ────────────────────────────────────────────────────────────────────
  ETHEREUM_RPC_URL: Joi.string().allow("").default(""),
  ETHEREUM_ESCROW_ADDRESS: Joi.string().allow("").default(""),
  BASE_RPC_URL: Joi.string().allow("").default(""),
  BASE_ESCROW_ADDRESS: Joi.string().allow("").default(""),
  POLYGON_RPC_URL: Joi.string().allow("").default(""),
  POLYGON_ESCROW_ADDRESS: Joi.string().allow("").default(""),
  ARBITRUM_RPC_URL: Joi.string().allow("").default(""),
  ARBITRUM_ESCROW_ADDRESS: Joi.string().allow("").default(""),
  OPTIMISM_RPC_URL: Joi.string().allow("").default(""),
  OPTIMISM_ESCROW_ADDRESS: Joi.string().allow("").default(""),
  AVALANCHE_RPC_URL: Joi.string().allow("").default(""),
  AVALANCHE_ESCROW_ADDRESS: Joi.string().allow("").default(""),
  EVM_RPC_ALLOWLIST: Joi.string().allow("").default(""),
  EVM_RPC_URLS: Joi.string().allow("").default("{}"),
  EVM_ESCROW_ADDRESSES: Joi.string().allow("").default("{}"),
  EVM_DEPOSIT_VERIFICATION_ENABLED: Joi.boolean().default(false),
  EVM_TRANSFER_FEE_TOLERANCE_BPS: Joi.number().integer().min(0).default(0),
  EVM_LOG_LOOKBACK_BLOCKS: Joi.number().integer().min(0).default(10000),

  // ── Resource limits ────────────────────────────────────────────────────────
  JSON_MAX_DEPTH: Joi.number().integer().min(1).max(100).default(10),
  WS_MAX_FILTER_CHAINS: Joi.number().integer().min(1).default(20),
  WS_MAX_SUBSCRIPTIONS: Joi.number().integer().min(1).default(10),
  DB_QUERY_TIMEOUT_MS: Joi.number().integer().min(0).default(5000),
  DB_BATCH_QUERY_TIMEOUT_MS: Joi.number().integer().min(0).default(10000),
  DB_STATS_QUERY_TIMEOUT_MS: Joi.number().integer().min(0).default(15000),

  // ── Flags ──────────────────────────────────────────────────────────────────
  FLAGS_PUBSUB: Joi.string().valid("memory", "redis").default("memory"),
  FLAGS_REFRESH_MS: Joi.number().integer().min(0).default(30000),
  FLAG_OVERRIDES: Joi.string().allow("").default(""),

  // ── Shadow mode ────────────────────────────────────────────────────────────
  SHADOW_MODE_ENABLED: Joi.boolean().default(false),
  SHADOW_SAMPLE_RATE: Joi.number().min(0).max(1).default(1),
  SHADOW_QUEUE_MAX: Joi.number().integer().min(0).default(256),
  SHADOW_CONCURRENCY: Joi.number().integer().min(1).default(4),
  SHADOW_SOURCE_ACCOUNT: Joi.string().allow("").default(""),

  // ── Health ─────────────────────────────────────────────────────────────────
  HEALTH_CHECK_INTERVAL_MS: Joi.number().integer().min(100).default(5000),
  HEALTH_READY_FAILURE_THRESHOLD: Joi.number().integer().min(1).default(3),
  HEALTH_READY_SUCCESS_THRESHOLD: Joi.number().integer().min(1).default(2),
  HEALTH_EVENT_LOOP_MAX_LAG_MS: Joi.number().integer().min(100).default(1000),
  SERVICE_ROLES: Joi.string().default("api,ws,worker"),

  // ── Governance ─────────────────────────────────────────────────────────────
  PARAMS_CONTRACT_ID: Joi.string().allow("").default(""),
  PARAMS_POLL_INTERVAL_MS: Joi.number().integer().min(0).default(30000),

  // ── Leader election ────────────────────────────────────────────────────────
  LEADER_ELECTION_ENABLED: Joi.boolean().default(false),
  LEADER_ELECTION_HEARTBEAT_MS: Joi.number().integer().min(0).default(5000),

  // ── Observability ──────────────────────────────────────────────────────────
  LOG_LEVEL: Joi.string().valid("error", "warn", "info", "http", "verbose", "debug", "silly").default("debug"),
  LOG_SERVICE_NAME: Joi.string().default("vortex-backend"),
  SENTRY_DSN: Joi.string().allow("").default(""),
  METRICS_TOKEN: Joi.string().allow("").default(""),
  LOG_SHIPPING_ENABLED: Joi.boolean().default(false),
  LOG_SHIPPING_HOST: Joi.string().allow("").default(""),
  LOG_SHIPPING_PORT: Joi.number().integer().min(1).max(65535).default(514),
  LOG_SHIPPING_PATH: Joi.string().default("/"),
  LOG_SHIPPING_SSL: Joi.boolean().default(false),

  // ── Reconciler ─────────────────────────────────────────────────────────────
  RECONCILE_STALE_SECONDS: Joi.number().integer().min(0).default(300),

  // ── Misc ───────────────────────────────────────────────────────────────────
  CANARY_ADDRESSES: Joi.string().allow("").default(""),
  ALLOW_LEGACY_STELLAR_SIGNATURES: Joi.boolean().default(false),
  SAFETY_SWEEP_INTERVAL_MS: Joi.number().integer().min(0).default(300000),
  RATE_LIMIT_LOCAL_PRUNE_MS: Joi.number().integer().min(0).default(60000),
  RATE_LIMIT_REDIS_URL: Joi.string().allow("").default(""),
  CREDENTIAL_REVOCATION_PUBSUB: Joi.string().valid("memory", "redis").default("memory"),
  GUARDIAN_CONTRACT_ID: Joi.string().allow("").default(""),
  DATASETS_ENABLED: Joi.boolean().default(false),
  DATASETS_ANONYMIZE: Joi.boolean().default(true),
  DATASETS_SALT: Joi.string().allow("").default(""),
  DATASETS_SALT_ROTATION_HOURS: Joi.number().integer().min(1).default(24),
  DATASETS_SALT_RETENTION_WINDOWS: Joi.number().integer().min(1).default(2),
  DATASETS_PUBLIC_BUCKET: Joi.string().allow("").default("vortex-public-datasets"),
  DATASETS_STORAGE_KIND: Joi.string().valid("memory", "local").default("memory"),
  DATASETS_LOCAL_DIR: Joi.string().allow("").default("./data/datasets"),
  SECRETS_PROVIDER: Joi.string().valid("env", "aws-secrets-manager", "vault-kv").default("env"),
  SECRETS_REFRESH_INTERVAL_MS: Joi.number().integer().min(0).default(60000),
  SECRETS_EXTRA: Joi.string().allow("").default(""),
  AWS_SECRETS_MANAGER_PREFIX: Joi.string().allow("").default(""),
  AWS_SECRETS_MANAGER_POLL_INTERVAL_MS: Joi.number().integer().min(0).default(60000),
  VAULT_KV_MOUNT: Joi.string().default("secret"),
  VAULT_KV_PREFIX: Joi.string().default("vortex/"),
  VAULT_KV_POLL_INTERVAL_MS: Joi.number().integer().min(0).default(60000),
  JWT_SIGNING_KEY: Joi.string().allow("").default(""),
  WEBHOOK_SECRET: Joi.string().allow("").default(""),
  CHANNEL_KEY: Joi.string().allow("").default(""),
  EGRESS_TIMEOUT_MS: Joi.number().integer().min(0).default(10000),
  EGRESS_MAX_REDIRECTS: Joi.number().integer().min(0).default(3),
  EGRESS_MAX_BODY_SIZE_BYTES: Joi.number().integer().min(0).default(10485760),
  SOROBAN_RPC_ALLOWLIST: Joi.string().allow("").default("soroban-testnet.stellar.org,soroban-rpc.stellar.org"),
  WEBHOOK_ALLOWLIST: Joi.string().allow("").default(""),
  ORACLE_ALLOWLIST: Joi.string().allow("").default(""),
  MAX_USER_SLIPPAGE_BPS: Joi.number().integer().min(0).default(100),
  MAX_PREMIUM_BPS: Joi.number().integer().min(0).default(50),
  ORACLE_FAIL_OPEN_MAX_USD: Joi.number().min(0).default(100),
  ORACLE_MAX_STALENESS_MS: Joi.number().integer().min(0).default(60000),
  OUTBOX_RELAY_ENABLED: Joi.boolean().default(true),
  OUTBOX_RELAY_INTERVAL_MS: Joi.number().integer().min(0).default(2000),
  OUTBOX_RELAY_BATCH_SIZE: Joi.number().integer().min(1).default(10),
  OUTBOX_MAX_ATTEMPTS: Joi.number().integer().min(1).default(8),
  OUTBOX_LEASE_SECONDS: Joi.number().integer().min(0).default(120),
  SLASH_CHALLENGE_WINDOW_SECONDS: Joi.number().integer().min(0).default(600),
  SLASH_CLOCK_SKEW_TOLERANCE_SECONDS: Joi.number().integer().min(0).default(30),
  SLASH_MAX_SUBMIT_ATTEMPTS: Joi.number().integer().min(1).default(5),
  SOLVER_SECRET: Joi.string().allow("").default(""),
  SOLVER_ADDRESS: Joi.string().allow("").default(""),
  SOLVER_CHAINS: Joi.string().default("stellar,ethereum,base,polygon,arbitrum,optimism,avalanche"),

  // ── #411 — Read replicas ───────────────────────────────────────────────────
  // DATABASE_REPLICA_URLS and MAX_REPLICA_LAG_MS already defined above.

  // ── #412 — Cursor HMAC secret ──────────────────────────────────────────────
  CURSOR_HMAC_SECRET: Joi.string().allow("").default("dev-cursor-hmac-secret-do-not-use-in-prod"),

  // ── #413 — Cold-storage archival ───────────────────────────────────────────
  ARCHIVAL_ENABLED: Joi.boolean().default(false),
  ARCHIVAL_BUCKET_NAME: Joi.string().default("vortex-archives"),
  ARCHIVAL_S3_ENDPOINT: Joi.string().allow("").default(""),
  ARCHIVAL_S3_REGION: Joi.string().default("us-east-1"),
  ARCHIVAL_S3_ACCESS_KEY_ID: Joi.string().allow("").default(""),
  ARCHIVAL_S3_SECRET_ACCESS_KEY: Joi.string().allow("").default(""),
  ARCHIVAL_RETENTION_DAYS: Joi.number().integer().min(1).default(30),
  ARCHIVAL_PARTITION_PREFIX: Joi.string().default("date="),
  ARCHIVAL_MAX_ROWS_PER_FILE: Joi.number().integer().min(1000).default(100000),
}).options({ allowUnknown: true });

// Re-export for consumers that need the inferred type.
export type EnvConfig = ReturnType<typeof envValidationSchema.validate>["value"];
