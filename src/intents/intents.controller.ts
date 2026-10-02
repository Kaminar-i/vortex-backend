import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { IntentsService } from "./intents.service";
import { BatchLookupDto } from "./dto/batch-lookup.dto";
import { AcceptIntentDto } from "./dto/accept-intent.dto";
import { ListIntentsDto } from "./dto/list-intents.dto";
import { Intent } from "./intents.types";
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
 * REST controller for intent lifecycle (#412 pagination, #410 FK columns).
 *
 * All list endpoints use keyset pagination.  Legacy `offset` params are still
 * accepted but deprecated: callers receive a `Deprecation` response header.
 */
@ApiTags("intents")
@Controller("api/v1/intents")
export class IntentsController {
  constructor(private readonly intentsService: IntentsService) {}

  // ─── List intents ─────────────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: "List intents (keyset-paginated)" })
  async list(
    @Query() query: ListIntentsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PaginatedResponse<Intent>> {
    return this.listPage(query, res);
  }

  // ─── Get by user ──────────────────────────────────────────────────────────

  @Get("user/:addr")
  @ApiOperation({ summary: "List intents for a user (keyset-paginated)" })
  @ApiParam({ name: "addr", description: "User Stellar or EVM address" })
  async listByUser(
    @Param("addr") addr: string,
    @Query() query: ListIntentsDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PaginatedResponse<Intent>> {
    return this.listPage({ ...query, user: addr }, res);
  }

  // ─── Get single intent ────────────────────────────────────────────────────

  @Get(":id")
  @ApiOperation({ summary: "Get intent by ID" })
  async getById(@Param("id") id: string): Promise<Intent> {
    const intent = await this.intentsService.get(id);
    if (!intent) throw new NotFoundException(`Intent ${id} not found`);
    return intent;
  }

  // ─── Batch lookup ─────────────────────────────────────────────────────────

  @Post("batch")
  @HttpCode(200)
  @ApiOperation({ summary: "Batch-fetch intents by IDs" })
  async batchLookup(@Body() dto: BatchLookupDto): Promise<Intent[]> {
    return this.intentsService.getMany(dto.intentIds);
  }

  // ─── Audit log ────────────────────────────────────────────────────────────

  /**
   * GET /api/v1/intents/:id/audit — keyset-paginated audit log (#412).
   *
   * Returns audit entries for the given intent in newest-first order.
   * The `offset` param is deprecated; use `cursor` instead.
   */
  @Get(":id/audit")
  @ApiOperation({ summary: "Intent audit log (keyset-paginated)" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "cursor", required: false, type: String })
  @ApiQuery({ name: "offset", required: false, type: Number, deprecated: true })
  async getAuditLog(
    @Param("id") id: string,
    @Query("limit") rawLimit?: string,
    @Query("cursor") cursor?: string,
    @Query("offset") rawOffset?: string,
    @Res({ passthrough: true }) res?: Response,
  ): Promise<PaginatedResponse<unknown>> {
    const intent = await this.intentsService.get(id);
    if (!intent) throw new NotFoundException(`Intent ${id} not found`);

    const limit = Math.min(parseInt(rawLimit ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE, 100);
    const offset = rawOffset !== undefined ? parseInt(rawOffset, 10) : undefined;

    if (offset !== undefined && !Number.isNaN(offset)) {
      if (offset > MAX_OFFSET) {
        throw new BadRequestException(`offset exceeds maximum of ${MAX_OFFSET}; use cursor pagination`);
      }
      res?.setHeader("Deprecation", "true");
      res?.setHeader("Link", `</api/v1/intents/${id}/audit>; rel="successor-version"`);
    }

    const allEntries = this.intentsService.getAuditLog(id);
    const skip = cursor
      ? this.auditCursorToOffset(cursor, id)
      : (offset ?? 0);
    const page = allEntries.slice(skip, skip + limit);
    const hasMore = skip + limit < allEntries.length;
    const nextCursor = hasMore
      ? this.encodeAuditCursor(skip + limit, id)
      : null;

    return new PaginatedResponse(page, nextCursor);
  }

  // ─── Accept / Fill / Cancel ───────────────────────────────────────────────

  @Post(":id/accept")
  @HttpCode(200)
  @ApiOperation({ summary: "Accept an intent" })
  @ApiHeader({ name: "X-Idempotency-Key", required: false })
  async accept(
    @Param("id") id: string,
    @Body() dto: AcceptIntentDto,
  ): Promise<Intent> {
    const updated = await this.intentsService.acceptIfOpen(id, dto.solver);
    if (!updated) throw new BadRequestException("Intent is not open or past deadline");
    return updated;
  }

  @Post(":id/cancel")
  @HttpCode(200)
  @ApiOperation({ summary: "Cancel an open intent" })
  async cancel(@Param("id") id: string): Promise<Intent> {
    const updated = await this.intentsService.cancelIfOpen(id);
    if (!updated) throw new BadRequestException("Intent is not open");
    return updated;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Core list logic shared by GET /intents and GET /intents/user/:addr.
   */
  private async listPage(
    query: ListIntentsDto & { user?: string },
    res: Response,
  ): Promise<PaginatedResponse<Intent>> {
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, 100);
    const secret = getCursorSecret();

    // Build a filter fingerprint to bind the cursor.
    const filterObj: Record<string, unknown> = {};
    if (query.state) filterObj.state = query.state;
    if (query.user) filterObj.user = query.user;
    if (query.chain) filterObj.chain = query.chain;
    const filterHash = hashFilter(filterObj);

    // Deprecated offset fallback.
    let offset: number | undefined;
    if (query.offset !== undefined) {
      if (query.offset > MAX_OFFSET) {
        throw new BadRequestException(`offset exceeds maximum of ${MAX_OFFSET}; use cursor pagination`);
      }
      res.setHeader("Deprecation", "true");
      res.setHeader("Link", "</api/v1/intents>; rel=\"successor-version\"");
      offset = query.offset;
    }

    // Decode cursor position.
    let cursorPayload: { createdAt: number; id: string } | undefined;
    if (query.cursor) {
      cursorPayload = decodeCursor(query.cursor, secret, filterHash);
    }

    // Fetch all matching intents (sorted createdAt DESC, intentId ASC).
    let all: Intent[];
    if (query.state) {
      all = await this.intentsService.getByState(query.state);
    } else if (query.user) {
      all = await this.intentsService.getByUser(query.user);
    } else {
      all = await this.intentsService.getAll();
    }

    // Apply chain filter in-memory (fast path for in-memory adapter).
    if (query.chain) {
      all = all.filter((i) => i.srcChain === query.chain);
    }

    // Sort: createdAt DESC, intentId ASC (stable tie-breaker).
    all.sort((a, b) => {
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return a.intentId.localeCompare(b.intentId);
    });

    // Seek to cursor position.
    let startIdx = offset ?? 0;
    if (cursorPayload) {
      const pos = all.findIndex(
        (i) => i.createdAt < cursorPayload!.createdAt ||
          (i.createdAt === cursorPayload!.createdAt && i.intentId > cursorPayload!.id),
      );
      startIdx = pos === -1 ? all.length : pos;
    }

    const page = all.slice(startIdx, startIdx + limit);
    const hasMore = startIdx + limit < all.length;

    let nextCursor: string | null = null;
    if (hasMore && page.length > 0) {
      const last = page[page.length - 1];
      nextCursor = encodeCursor({ createdAt: last.createdAt, id: last.intentId, filterHash }, secret);
    }

    return new PaginatedResponse(page, nextCursor);
  }

  /**
   * Encode an audit-log offset as an opaque cursor.
   * The cursor is intentId-scoped so it cannot be used against a different intent.
   */
  private encodeAuditCursor(offset: number, intentId: string): string {
    const secret = getCursorSecret();
    return encodeCursor({ createdAt: offset, id: intentId, filterHash: hashFilter({ intentId }) }, secret);
  }

  private auditCursorToOffset(cursor: string, intentId: string): number {
    const secret = getCursorSecret();
    const filterHash = hashFilter({ intentId });
    const payload = decodeCursor(cursor, secret, filterHash);
    return payload.createdAt; // createdAt field holds the offset for audit log cursors
  }
}
