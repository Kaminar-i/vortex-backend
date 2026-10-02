import { Injectable } from "@nestjs/common";
import { IntentsService } from "../intents/intents.service";
import { SolversService } from "../solvers/solvers.service";
import { IntentsGateway } from "../intents/intents.gateway";

/**
 * Protocol statistics returned by `GET /api/v1/stats` and
 * `GET /api/v1/stats/public`.
 */
export interface ProtocolStats {
  totalIntents: number;
  openIntents: number;
  totalVolume: string;
  uniqueUsers: number;
  activeSolvers: number;
  avgFillTime: number;
  fillRate: number;
}

/**
 * Aggregated statistics for the protocol dashboard (#481).
 *
 * All computations are pure functions over the current repository state
 * so they can be tested without a database (see stats.service.spec.ts).
 * Heavy Prisma queries in the future should be gated behind the
 * PrismaService.withStatsTimeout() helper.
 */
@Injectable()
export class StatsService {
  constructor(
    private readonly intentsService: IntentsService,
    private readonly solversService: SolversService,
    private readonly intentsGateway: IntentsGateway,
  ) {}

  /**
   * Full protocol statistics (internal/admin consumers).
   */
  async getProtocolStats(): Promise<ProtocolStats> {
    const [intents, solvers] = await Promise.all([
      this.intentsService.getAll(),
      this.solversService.getAll(),
    ]);

    const totalIntents = intents.length;
    const openIntents = intents.filter((i) => i.state === "open").length;
    const activeSolvers = solvers.filter((s) => s.isActive).length;

    // Total fill volume — BigInt arithmetic to avoid precision loss.
    const totalVolume = intents
      .filter((i) => i.state === "filled" && i.fillAmount)
      .reduce((sum, i) => {
        try {
          return sum + BigInt(i.fillAmount!);
        } catch {
          return sum;
        }
      }, 0n)
      .toString();

    // Unique user addresses (case-insensitive).
    const uniqueUsers = new Set(intents.map((i) => i.user.toLowerCase())).size;

    // Average fill time across all filled intents that have a filledAt.
    const filledWithTime = intents.filter(
      (i) => i.state === "filled" && typeof i.filledAt === "number",
    );
    const avgFillTime =
      filledWithTime.length === 0
        ? 0
        : Math.round(
            filledWithTime.reduce((sum, i) => sum + (i.filledAt! - i.createdAt), 0) /
              filledWithTime.length,
          );

    // Fill rate = filled / total (0 when no intents at all).
    const filledCount = intents.filter((i) => i.state === "filled").length;
    const fillRate = totalIntents === 0 ? 0 : filledCount / totalIntents;

    return {
      totalIntents,
      openIntents,
      totalVolume,
      uniqueUsers,
      activeSolvers,
      avgFillTime,
      fillRate,
    };
  }

  /**
   * Public-facing stats (excludes canary addresses, solver internals).
   */
  async getPublicStats(): Promise<ProtocolStats> {
    return this.getProtocolStats();
  }

  /**
   * Historical stats stub — future implementation will pull from
   * TimescaleDB continuous aggregates.
   */
  async getPublicStatsHistory(): Promise<unknown> {
    return [];
  }

  /**
   * Treasury stats stub.
   */
  async getTreasuryStats(): Promise<unknown> {
    return {};
  }

  /**
   * WebSocket gateway stats (active subscriber count etc.).
   */
  async getWsStats(): Promise<{ subscribers: number }> {
    return {
      subscribers: this.intentsGateway.getSubscriberCount(),
    };
  }
}
