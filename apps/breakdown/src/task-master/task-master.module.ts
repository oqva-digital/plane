import { Module } from "@nestjs/common";
import { TaskMasterService } from "./task-master.service";
import { TaskMasterStorageService } from "./task-master-storage.service";
import { WorkItemTreeService } from "./work-item-tree.service";
import { TasksRebuildService } from "./tasks-rebuild.service";
import { PlaneModule } from "../plane/plane.module";

@Module({
  imports: [PlaneModule],
  providers: [TaskMasterService, TaskMasterStorageService, WorkItemTreeService, TasksRebuildService],
  exports: [TaskMasterService, TaskMasterStorageService, WorkItemTreeService, TasksRebuildService],
})
export class TaskMasterModule {}
