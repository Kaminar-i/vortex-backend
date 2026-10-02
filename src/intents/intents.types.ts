/**
 * Core intent types for vortex-backend.
 *
 * These types are the source of truth for all modules.  The package-level
 * types in src/types/index.ts mirror a subset of these for SDK consumers.
 */

// ─── Chains ──────────────────────────────────────────────────────────────────

export const SUPPORTED_CHAINS = [
  "stellar",
  "ethereum",
  "base",
  "polygon",
  "arbitrum",
  "optimism",
  "avalanche",
] as const;

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

// ─── Intent states ────────────────────────────────────────────────────────────

export const INTENT_STATES = [
  "open",
  "accepted",
  "filled",
  "cancelled",
  "expired",
  "slashed",
] as const;

export type IntentState = (typeof INTENT_STATES)[number];

// ─── Token types ──────────────────────────────────────────────────────────────

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chain: SupportedChain;
  logoURI?: string;
  priceUSD?: number | null;
}

export interface StellarToken {
  contract: string;
  symbol: string;
  decimals: number;
  priceUSD?: number | null;
}

// ─── Source-verification ──────────────────────────────────────────────────────

export type VerificationStatus = "pending" | "verified" | "failed" | "grandfathered";

export interface SrcVerificationResult {
  status: VerificationStatus;
  checkedAt: number;
  blockNumber?: string;
  blockHash?: string;
  detail?: string;
  receivedAmount?: string;
}

// ─── Intent ──────────────────────────────────────────────────────────────────

/**
 * Canonical in-memory representation of a cross-chain swap intent.
 *
 * Bigint amounts (srcAmount, minDstAmount, fillAmount, quotedDstAmount, feeAmount)
 * are stored as decimal strings throughout — never coerced through `Number` so
 * precision is preserved for large ERC-20 amounts.
 *
 * Issue #410 adds `srcTokenId` / `dstTokenId` / `srcDecimals` / `dstDecimals`
 * which are populated by the create path when the token is in the registry.
 * They are intentionally optional so the expand/contract migration can land
 * without breaking the in-memory or dual-write adapters.
 */
export interface Intent {
  intentId: string;
  user: string;
  srcChain: SupportedChain;
  srcToken: TokenInfo;
  srcAmount: string;
  dstToken: StellarToken;
  minDstAmount: string;
  quotedDstAmount?: string;
  acceptedDstAmount?: string;
  solver?: string;
  state: IntentState;
  createdAt: number;
  deadline: number;
  filledAt?: number;
  fillAmount?: string;
  feeAmount?: string;
  txHash?: string;
  slashedAt?: number;
  slashReason?: string;

  // Optimistic concurrency (#404)
  version: number;

  // Dutch auction (#429)
  auction?: Record<string, unknown>;

  // Source-deposit verification (#403)
  srcVerified: boolean;
  srcTxHash?: string;
  srcVerification?: SrcVerificationResult;

  // Governance params snapshot at creation
  paramsVersion?: string;

  // ── #410: FK columns (populated at create-time when token is in registry) ──
  srcTokenId?: string;
  dstTokenId?: string;
  /** Immutable snapshot of src token decimals at intent creation time. */
  srcDecimals?: number;
  /** Immutable snapshot of dst token decimals at intent creation time. */
  dstDecimals?: number;
}

export interface IntentAuditEntry {
  timestamp: string;
  toState: IntentState;
  actor: string;
  reason: string;
  metadata?: Record<string, unknown>;
}
