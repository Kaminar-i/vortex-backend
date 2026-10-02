import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { SolversService } from "./solvers.service";
import { RegisterSolverDto } from "./dto/register-solver.dto";
import { UpdateSolverDto } from "./dto/update-solver.dto";
import { SolverRecord } from "./solvers.types";
import { resolveLimit, LeaderboardQuery } from "./leaderboard-query";
import {
  PaginatedResponse,
  encodeCursor,
  decodeCursor,
  hashFilter,
  getCursorSecret,
  DEFAULT_PAGE_SIZE,
  MAX_OFFSET,
} from "../common/pagination";

/**
 * REST controller for solver management (#412 pagination).
 *
 * - GET /solvers             — list all solvers
 * - GET /solvers/leaderboard — paginated leaderboard (keyset)
 * - GET /solvers/:addr       — get by address
 * - POST /solvers            — register
 * - PUT /solvers/:addr       — update profile
 * - GET /solvers/:addr/fills — fill history (keyset)
 */
@ApiTags("solvers")
@Controller("api/v1/solvers")
export class SolversController {
  constructor(private readonly solversService: SolversService) {}

  // ─── List / leaderboard ───────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: "List all solvers" })
  async listAll(): Promise<SolverRecord[]> {
    return this.solversService.getAll();
  }

  /**
   * GET /api/v1/solvers/leaderboard — keyset-paginated solver leaderboard (#412).
   *
   * Ordered by (fillsCompleted DESC, address ASC) for stability.
   */
  @Get("leaderboard")
  @ApiOperation({ summary: "Solver leaderboard (keyset-paginated)" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({ name: "chain", required: false, type: String })
  @ApiQuery({ name: "offset", required: false, type: Number, deprecated: true })
  async leaderboard(
    @Query("limit") rawLimit?: string,
    @Query("cursor") cursor?: string,
    @Query("chain") chain?: string,
    @Query("offset") rawOffset?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<PaginatedResponse<SolverRecord>> {
    const query: LeaderboardQuery = {
      limit: parseInt(rawLimit ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE,
      cursor,
      chain,
      offset: rawOffset !== undefined ? parseInt(rawOffset, 10) : undefined,
    };

    const limit = resolveLimit(query);
    const secret = getCursorSecret();
    const filterObj: Record<string, unknown> = {};
    if (chain) filterObj.chain = chain;
    const filterHash = hashFilter(filterObj);

    // Deprecated offset.
    let offset: number | undefined;
    if (query.offset !== undefined && !Number.isNaN(query.offset)) {
      if (query.offset > MAX_OFFSET) {
        throw new BadRequestException(`offset exceeds maximum of ${MAX_OFFSET}; use cursor`);
      }
      res?.setHeader("Deprecation", "true");
      res?.setHeader("Link", "</api/v1/solvers/leaderboard>; rel=\"successor-version\"");
      offset = query.offset;
    }

    // Decode cursor.
    let cursorPayload: { createdAt: number; id: string } | undefined;
    if (cursor) {
      cursorPayload = decodeCursor(cursor, secret, filterHash);
    }

    // Load all solvers and sort by (fillsCompleted DESC, address ASC).
    let all = await this.solversService.getAll();
    if (chain) {
      all = all.filter((s) => s.supportedChains.includes(chain as SolverRecord["supportedChains"][number]));
    }
    all = all.filter((s) => s.isActive);
    all.sort((a, b) => {
      if (b.fillsCompleted !== a.fillsCompleted) return b.fillsCompleted - a.fillsCompleted;
      return a.address.localeCompare(b.address);
    });

    // Seek: the cursor encodes (fillsCompleted as createdAt, address as id).
    let startIdx = offset ?? 0;
    if (cursorPayload) {
      const pos = all.findIndex(
        (s) =>
          s.fillsCompleted < cursorPayload!.createdAt ||
          (s.fillsCompleted === cursorPayload!.createdAt && s.address > cursorPayload!.id),
      );
      startIdx = pos === -1 ? all.length : pos;
    }

    const page = all.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < all.length;

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = encodeCursor(
        { createdAt: last.fillsCompleted, id: last.address, filterHash },
        secret,
      );
    }

    return new PaginatedResponse(page, nextCursor);
  }

  // ─── Fill history ─────────────────────────────────────────────────────────

  /**
   * GET /api/v1/solvers/:addr/fills — keyset-paginated fill history (#412).
   *
   * Ordered by (timestamp DESC, slashId ASC).
   */
  @Get(":addr/fills")
  @ApiOperation({ summary: "Solver fill / slash history (keyset-paginated)" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({ name: "offset", required: false, type: Number, deprecated: true })
  async fillHistory(
    @Param("addr") addr: string,
    @Query("limit") rawLimit?: string,
    @Query("cursor") cursor?: string,
    @Query("offset") rawOffset?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<PaginatedResponse<unknown>> {
    const solver = await this.solversService.get(addr);
    if (!solver) throw new NotFoundException(`Solver ${addr} not found`);

    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 100);
    const secret = getCursorSecret();
    const filterHash = hashFilter({ addr });

    let offset: number | undefined;
    if (rawOffset !== undefined) {
      const parsedOffset = parseInt(rawOffset, 10);
      if (!Number.isNaN(parsedOffset)) {
        if (parsedOffset > MAX_OFFSET) {
          throw new BadRequestException(`offset exceeds maximum of ${MAX_OFFSET}`);
        }
        res?.setHeader("Deprecation", "true");
        offset = parsedOffset;
      }
    }

    let cursorPayload: { createdAt: number; id: string } | undefined;
    if (cursor) {
      cursorPayload = decodeCursor(cursor, secret, filterHash);
    }

    const { records: all } = await this.solversService.getSlashHistory(addr, 1, 10_000);
    all.sort((a, b) => b.timestamp - a.timestamp || a.slashId.localeCompare(b.slashId));

    let startIdx = offset ?? 0;
    if (cursorPayload) {
      const pos = all.findIndex(
        (r) =>
          r.timestamp < cursorPayload!.createdAt ||
          (r.timestamp === cursorPayload!.createdAt && r.slashId > cursorPayload!.id),
      );
      startIdx = pos === -1 ? all.length : pos;
    }

    const page = all.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < all.length;
    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = encodeCursor({ createdAt: last.timestamp, id: last.slashId, filterHash }, secret);
    }

    return new PaginatedResponse(page, nextCursor);
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  @Get(":addr")
  @ApiOperation({ summary: "Get solver by address" })
  @ApiParam({ name: "addr", description: "Solver Stellar address" })
  async getByAddress(@Param("addr") addr: string): Promise<SolverRecord> {
    const solver = await this.solversService.get(addr);
    if (!solver) throw new NotFoundException(`Solver ${addr} not found`);
    return solver;
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: "Register a solver" })
  async register(@Body() dto: RegisterSolverDto): Promise<SolverRecord> {
    return this.solversService.register({
      address: dto.address,
      name: dto.name,
      bondAmount: dto.bondAmount,
      avgFillTime: dto.avgFillTime,
      supportedChains: dto.supportedChains,
      supportedTokens: dto.supportedTokens,
      isActive: true,
    });
  }

  @Put(":addr")
  @ApiOperation({ summary: "Update solver profile" })
  async update(
    @Param("addr") addr: string,
    @Body() dto: UpdateSolverDto,
  ): Promise<SolverRecord> {
    const updated = await this.solversService.update(addr, dto);
    if (!updated) throw new NotFoundException(`Solver ${addr} not found`);
    return updated;
  }

  @Post(":addr/deactivate")
  @HttpCode(200)
  @ApiOperation({ summary: "Deactivate a solver" })
  async deactivate(@Param("addr") addr: string): Promise<SolverRecord> {
    const result = await this.solversService.deactivate(addr);
    if (!result) throw new NotFoundException(`Solver ${addr} not found`);
    return result;
  }

  @Post(":addr/reactivate")
  @HttpCode(200)
  @ApiOperation({ summary: "Reactivate a solver" })
  async reactivate(@Param("addr") addr: string): Promise<SolverRecord> {
    const result = await this.solversService.reactivate(addr);
    if (!result) throw new NotFoundException(`Solver ${addr} not found`);
    return result;
  }
}
