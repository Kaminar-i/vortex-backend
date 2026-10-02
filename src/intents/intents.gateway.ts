import { Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AppConfig } from "../config/configuration";

/**
 * IntentsGateway — WebSocket gateway for real-time intent events.
 *
 * Stub that exposes `getSubscriberCount()` used by StatsService.
 * Full WebSocket implementation delegates to IntentFeedService (issue #433).
 *
 * The stub is Injectable so it can be provided in test modules without
 * requiring a real WS server.
 */
@Injectable()
export class IntentsGateway {
  private readonly logger = new Logger(IntentsGateway.name);

  constructor(
    @Optional() private readonly config?: ConfigService<AppConfig, true>,
  ) {}

  /** Returns the number of currently-connected WebSocket subscribers. */
  getSubscriberCount(): number {
    // Delegates to the feed service in the real implementation.
    // Returning 0 here is correct for the stub / test path.
    return 0;
  }
}
