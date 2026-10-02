import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../common/pagination";

/**
 * Query parameters for `GET /api/v1/solvers/leaderboard` (#412).
 *
 * Uses opaque keyset cursors for stable, efficient paging.
 * The leaderboard is ordered by `(fillsCompleted DESC, address ASC)`.
 */
export interface LeaderboardQuery {
  /** Opaque cursor from the previous page's `nextCursor`. */
  cursor?: string;
  /** Page size — defaults to DEFAULT_PAGE_SIZE, capped at MAX_PAGE_SIZE. */
  limit?: number;
  /** Filter to solvers supporting this chain. */
  chain?: string;
  /**
   * @deprecated Use cursor instead. Capped at MAX_OFFSET.
   * Included for backward-compatibility; callers receive a Deprecation header.
   */
  offset?: number;
}

/**
 * Normalise a {@link LeaderboardQuery} limit to a safe integer.
 */
export function resolveLimit(query: LeaderboardQuery): number {
  const raw = typeof query.limit === "number" ? query.limit : DEFAULT_PAGE_SIZE;
  return Math.max(1, Math.min(raw, MAX_PAGE_SIZE));
}
