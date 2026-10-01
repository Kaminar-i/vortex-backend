import { Module, forwardRef } from "@nestjs/common";
import { SolversController } from "./solvers.controller";
import { SolversService } from "./solvers.service";
import { SOLVERS_REPOSITORY } from "./solvers.repository";
import { InMemorySolversRepository } from "./in-memory-solvers.repository";
import { PrismaSolversRepository } from "./prisma-solvers.repository";
import { PrismaService } from "../prisma/prisma.service";
import { IntentsModule } from "../intents/intents.module";
import { SolverGriefingService } from "./solver-griefing.service";
import { SolverGriefingController } from "./solver-griefing.controller";

@Module({
  imports: [forwardRef(() => IntentsModule)],
  controllers: [SolversController, SolverGriefingController],
  providers: [
    // Select the persistence adapter based on SOLVERS_PERSISTENCE env var.
    {
      provide: SOLVERS_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => {
        const adapter = process.env.SOLVERS_PERSISTENCE ?? "memory";
        if (adapter === "prisma") {
          return new PrismaSolversRepository(prisma);
        }
        return new InMemorySolversRepository();
      },
    },
    SolversService,
    // Anti-griefing enforcement engine (issue #453).
    SolverGriefingService,
  ],
  exports: [SolversService, SolverGriefingService],
})
export class SolversModule {}
