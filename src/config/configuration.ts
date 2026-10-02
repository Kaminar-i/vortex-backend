import { SupportedChain } from "../intents/intents.types";

// ─── Chain deadline defaults ──────────────────────────────────────────────────

/**
 * Chain-specific default intent deadlines (seconds from creation).
 * Stellar settles in ~5 s; EVM chains have longer finality windows.
 */
export const CHAIN_DEADLINE_DEFAULTS: Partial<Record<SupportedChain, number>> = {
  stellar: 300,
  ethereum: 1800,
  base: 900,
  polygon: 900,
  arbitrum: 900,
  optimism: 900,
  avalanche: 900,
};

export const DEFAULT_DEADLINE_SECONDS = 1800;

/**
 * Chain-specific fill-window defaults (seconds from accept to fill deadline).
 * Shorter chains can fill faster.
 */
export const CHAIN_FILL_WINDOW_DEFAULTS: Partial<Record<SupportedChain, number>> = {
  stellar: 120,
  ethereum: 600,
  base: 300,
  polygon: 300,
  arbitrum: 300,
  optimism: 300,
  avalanche: 300,
};

export const DEFAULT_FILL_WINDOW_SECONDS = 600;

// ─── AppConfig ────────────────────────────────────────────────────────────────

export interface AppConfig {
  nodeEnv: "development" | "production" | "test";
  port: number;
  corsOrigin: string;
  databaseUrl: string;
  /** Comma-separated read-replica URLs (#411). Blank = primary only. */
  databaseReplicaUrls: string;
  /** Maximum replica lag (ms) before a replica is bypassed (#411). */
  maxReplicaLagMs: number;

  intentRetentionDays: number;
  intentRetentionSweepMs: number;
  onchainIntentsEnabled: boolean;
  onchainDryRun: boolean;
  intentsStore: "memory" | "dual" | "postgres";
  intentsVerifyIntervalMs: number;

  stellar: {
    network: "testnet" | "futurenet" | "mainnet";
    sorobanRpcUrl: string;
    sorobanRpcUrls: string;
    archivalRpcUrl: string;
    horizonUrl: string;
    signerSecretKey: string;
    settlementContractId: string;
    solverRegistryContractId: string;
    treasuryAddress: string;
    sorobanSigningKey: string;
  };

  ws: {
    maxConnections: number;
    backplane: string;
    maxPayloadBytes: number;
    maxConnectionsPerIp: number;
    trustProxyHops: number;
    rateLimitPerSec: number;
    rateLimitBurst: number;
    rateLimitMaxViolations: number;
    outboundQueueMax: number;
    outboundBufferBytes: number;
    slowConsumerPolicy: string;
    drainTimeoutMs: number;
  };

  sse: {
    heartbeatMs: number;
    maxBufferBytes: number;
  };

  redis: {
    url: string;
  };

  jobs: {
    driver: "memory" | "bullmq";
    shutdownTimeoutMs: number;
    processRole: "api" | "worker" | "all";
  };

  killswitch: {
    operatorToken: string;
    redisUrl: string;
    pollMs: number;
    persistence: "memory" | "prisma";
  };

  auth: {
    jwtSecret: string;
  };

  evmRpcUrls: Record<string, string>;
  evmDepositVerificationEnabled: boolean;
  evmEscrowAddresses: Record<string, string>;
  evmTransferFeeTolerance: number;
  evmLogLookbackBlocks: number;

  flags: {
    pubsub: "memory" | "redis";
    refreshMs: number;
    overrides: string;
  };

  shadow: {
    enabled: boolean;
    sampleRate: number;
    queueMax: number;
    concurrency: number;
    sourceAccount: string;
  };

  health: {
    checkIntervalMs: number;
    readyFailureThreshold: number;
    readySuccessThreshold: number;
    eventLoopMaxLagMs: number;
    serviceRoles: string;
  };

  governance: {
    paramsContractId: string;
    paramsPollIntervalMs: number;
  };

  leaderElection: {
    enabled: boolean;
    heartbeatMs: number;
  };

  metrics: {
    token: string;
  };

  sentry: {
    dsn: string;
  };

  log: {
    level: string;
    serviceName: string;
    shippingEnabled: boolean;
    shippingHost: string;
    shippingPort: number;
    shippingPath: string;
    shippingSsl: boolean;
  };

  // #413 — Cold-storage archival
  archival: {
    enabled: boolean;
    bucketName: string;
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    retentionDays: number;
    partitionPrefix: string;
    maxRowsPerFile: number;
  };

  // Cursor HMAC secret (#412)
  cursorHmacSecret: string;
}

// ─── Factory function ─────────────────────────────────────────────────────────

export default function configuration(): AppConfig {
  const e = process.env;

  const parseJson = <T>(raw: string | undefined, fallback: T): T => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  return {
    nodeEnv: (e.NODE_ENV ?? "development") as AppConfig["nodeEnv"],
    port: parseInt(e.PORT ?? "4000", 10),
    corsOrigin: e.CORS_ORIGIN ?? "*",
    databaseUrl: e.DATABASE_URL ?? "postgresql://vortex:vortex@localhost:5432/vortex?schema=public",
    databaseReplicaUrls: e.DATABASE_REPLICA_URLS ?? "",
    maxReplicaLagMs: parseInt(e.MAX_REPLICA_LAG_MS ?? "5000", 10),

    intentRetentionDays: parseInt(e.INTENT_RETENTION_DAYS ?? "30", 10),
    intentRetentionSweepMs: parseInt(e.INTENT_RETENTION_SWEEP_MS ?? "60000", 10),
    onchainIntentsEnabled: e.ONCHAIN_INTENTS_ENABLED === "true",
    onchainDryRun: e.ONCHAIN_DRY_RUN !== "false",
    intentsStore: (e.INTENTS_STORE ?? e.INTENTS_PERSISTENCE ?? "memory") as AppConfig["intentsStore"],
    intentsVerifyIntervalMs: parseInt(e.INTENTS_VERIFY_INTERVAL_MS ?? "60000", 10),

    stellar: {
      network: (e.STELLAR_NETWORK ?? "testnet") as AppConfig["stellar"]["network"],
      sorobanRpcUrl: e.SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org",
      sorobanRpcUrls: e.SOROBAN_RPC_URLS ?? "",
      archivalRpcUrl: e.ARCHIVAL_RPC_URL ?? "",
      horizonUrl: e.HORIZON_URL ?? "https://horizon-testnet.stellar.org",
      signerSecretKey: e.STELLAR_SIGNER_SECRET_KEY ?? "",
      settlementContractId: e.SETTLEMENT_CONTRACT_ID ?? "",
      solverRegistryContractId: e.SOLVER_REGISTRY_CONTRACT_ID ?? "",
      treasuryAddress: e.TREASURY_ADDRESS ?? "",
      sorobanSigningKey: e.SOROBAN_SIGNING_KEY ?? "",
    },

    ws: {
      maxConnections: parseInt(e.WS_MAX_CONNECTIONS ?? "1000", 10),
      backplane: e.WS_BACKPLANE ?? "memory",
      maxPayloadBytes: parseInt(e.WS_MAX_PAYLOAD_BYTES ?? "16384", 10),
      maxConnectionsPerIp: parseInt(e.WS_MAX_CONNECTIONS_PER_IP ?? "20", 10),
      trustProxyHops: parseInt(e.WS_TRUST_PROXY_HOPS ?? "0", 10),
      rateLimitPerSec: parseInt(e.WS_RATE_LIMIT_PER_SEC ?? "10", 10),
      rateLimitBurst: parseInt(e.WS_RATE_LIMIT_BURST ?? "20", 10),
      rateLimitMaxViolations: parseInt(e.WS_RATE_LIMIT_MAX_VIOLATIONS ?? "5", 10),
      outboundQueueMax: parseInt(e.WS_OUTBOUND_QUEUE_MAX ?? "1000", 10),
      outboundBufferBytes: parseInt(e.WS_OUTBOUND_BUFFER_BYTES ?? "1048576", 10),
      slowConsumerPolicy: e.WS_SLOW_CONSUMER_POLICY ?? "drop_oldest",
      drainTimeoutMs: parseInt(e.WS_DRAIN_TIMEOUT_MS ?? "25000", 10),
    },

    sse: {
      heartbeatMs: parseInt(e.SSE_HEARTBEAT_MS ?? "15000", 10),
      maxBufferBytes: parseInt(e.SSE_MAX_BUFFER_BYTES ?? "1048576", 10),
    },

    redis: {
      url: e.REDIS_URL ?? "redis://localhost:6379",
    },

    jobs: {
      driver: (e.JOBS_DRIVER ?? "memory") as AppConfig["jobs"]["driver"],
      shutdownTimeoutMs: parseInt(e.JOBS_SHUTDOWN_TIMEOUT_MS ?? "25000", 10),
      processRole: (e.PROCESS_ROLE ?? "all") as AppConfig["jobs"]["processRole"],
    },

    killswitch: {
      operatorToken: e.KILLSWITCH_OPERATOR_TOKEN ?? "",
      redisUrl: e.KILLSWITCH_REDIS_URL ?? "",
      pollMs: parseInt(e.KILLSWITCH_POLL_MS ?? "2000", 10),
      persistence: (e.KILLSWITCH_PERSISTENCE ?? "memory") as AppConfig["killswitch"]["persistence"],
    },

    auth: {
      jwtSecret: e.AUTH_JWT_SECRET ?? "",
    },

    evmRpcUrls: parseJson<Record<string, string>>(e.EVM_RPC_URLS, {}),
    evmDepositVerificationEnabled: e.EVM_DEPOSIT_VERIFICATION_ENABLED === "true",
    evmEscrowAddresses: parseJson<Record<string, string>>(e.EVM_ESCROW_ADDRESSES, {}),
    evmTransferFeeTolerance: parseInt(e.EVM_TRANSFER_FEE_TOLERANCE_BPS ?? "0", 10),
    evmLogLookbackBlocks: parseInt(e.EVM_LOG_LOOKBACK_BLOCKS ?? "10000", 10),

    flags: {
      pubsub: (e.FLAGS_PUBSUB ?? "memory") as AppConfig["flags"]["pubsub"],
      refreshMs: parseInt(e.FLAGS_REFRESH_MS ?? "30000", 10),
      overrides: e.FLAG_OVERRIDES ?? "",
    },

    shadow: {
      enabled: e.SHADOW_MODE_ENABLED === "true",
      sampleRate: parseFloat(e.SHADOW_SAMPLE_RATE ?? "1"),
      queueMax: parseInt(e.SHADOW_QUEUE_MAX ?? "256", 10),
      concurrency: parseInt(e.SHADOW_CONCURRENCY ?? "4", 10),
      sourceAccount: e.SHADOW_SOURCE_ACCOUNT ?? "",
    },

    health: {
      checkIntervalMs: parseInt(e.HEALTH_CHECK_INTERVAL_MS ?? "5000", 10),
      readyFailureThreshold: parseInt(e.HEALTH_READY_FAILURE_THRESHOLD ?? "3", 10),
      readySuccessThreshold: parseInt(e.HEALTH_READY_SUCCESS_THRESHOLD ?? "2", 10),
      eventLoopMaxLagMs: parseInt(e.HEALTH_EVENT_LOOP_MAX_LAG_MS ?? "1000", 10),
      serviceRoles: e.SERVICE_ROLES ?? "api,ws,worker",
    },

    governance: {
      paramsContractId: e.PARAMS_CONTRACT_ID ?? "",
      paramsPollIntervalMs: parseInt(e.PARAMS_POLL_INTERVAL_MS ?? "30000", 10),
    },

    leaderElection: {
      enabled: e.LEADER_ELECTION_ENABLED === "true",
      heartbeatMs: parseInt(e.LEADER_ELECTION_HEARTBEAT_MS ?? "5000", 10),
    },

    metrics: {
      token: e.METRICS_TOKEN ?? "",
    },

    sentry: {
      dsn: e.SENTRY_DSN ?? "",
    },

    log: {
      level: e.LOG_LEVEL ?? "debug",
      serviceName: e.LOG_SERVICE_NAME ?? "vortex-backend",
      shippingEnabled: e.LOG_SHIPPING_ENABLED === "true",
      shippingHost: e.LOG_SHIPPING_HOST ?? "",
      shippingPort: parseInt(e.LOG_SHIPPING_PORT ?? "514", 10),
      shippingPath: e.LOG_SHIPPING_PATH ?? "/",
      shippingSsl: e.LOG_SHIPPING_SSL === "true",
    },

    archival: {
      enabled: e.ARCHIVAL_ENABLED === "true",
      bucketName: e.ARCHIVAL_BUCKET_NAME ?? "vortex-archives",
      endpoint: e.ARCHIVAL_S3_ENDPOINT ?? "",
      region: e.ARCHIVAL_S3_REGION ?? "us-east-1",
      accessKeyId: e.ARCHIVAL_S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: e.ARCHIVAL_S3_SECRET_ACCESS_KEY ?? "",
      retentionDays: parseInt(e.ARCHIVAL_RETENTION_DAYS ?? "30", 10),
      partitionPrefix: e.ARCHIVAL_PARTITION_PREFIX ?? "date=",
      maxRowsPerFile: parseInt(e.ARCHIVAL_MAX_ROWS_PER_FILE ?? "100000", 10),
    },

    cursorHmacSecret: e.CURSOR_HMAC_SECRET ?? "dev-cursor-hmac-secret-do-not-use-in-prod",
  };
}
