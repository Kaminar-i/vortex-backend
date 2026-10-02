import { Module } from "@nestjs/common";
import { IntentsService } from "./intents.service";
import { IntentsController } from "./intents.controller";
import { IntentsGateway } from "./intents.gateway";
import { INTENTS_REPOSITORY, InMemoryIntentsRepository } from "./intents.repository";
import { PrismaIntentsRepository } from "./prisma-intents.repository";
import { DualWriteIntentsRepository } from "./dual-write-intents.repository";
import { PrismaService } from "../prisma/prisma.service";

/**
 * IntentsModule wires the intents feature slice.
 *
 * The active repository adapter is selected at startup via INTENTS_STORE:
 *   memory   — InMemoryIntentsRepository  (default, dev/test)
 *   dual     — DualWriteIntentsRepository (migration phase)
 *   postgres — PrismaIntentsRepository    (production)
 *
 * IntentsGateway is exported so StatsModule can inject it for subscriber counts.
 */
@Module({
  controllers: [IntentsController],
  providers: [
    {
      provide: INTENTS_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => {
        const store = process.env.INTENTS_STORE ?? process.env.INTENTS_PERSISTENCE ?? "memory";
        if (store === "postgres") {
          return new PrismaIntentsRepository(prisma);
        }
        if (store === "dual") {
          const primary = new InMemoryIntentsRepository({ seed: false });
          const secondary = new PrismaIntentsRepository(prisma);
          return new DualWriteIntentsRepository(primary, secondary);
        }
        return new InMemoryIntentsRepository();
      },
    },
    IntentsService,
    IntentsGateway,
  ],
  exports: [IntentsService, IntentsGateway, INTENTS_REPOSITORY],
})
export class IntentsModule {}
