import { Module } from "@nestjs/common";
import { ApiKeyGuard } from "../common/guards/api-key.guard";
import { PlaneModule } from "../plane/plane.module";
import { TaskMasterModule } from "../task-master/task-master.module";
import { BreakdownController } from "./breakdown.controller";
import { BreakdownService } from "./breakdown.service";

@Module({
  imports: [PlaneModule, TaskMasterModule],
  controllers: [BreakdownController],
  providers: [BreakdownService, ApiKeyGuard],
})
export class BreakdownModule {}
