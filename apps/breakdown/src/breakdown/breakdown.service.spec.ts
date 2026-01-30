import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { BreakdownService } from "./breakdown.service";
import { PlaneClient } from "../plane/plane.client";
import { TaskMasterService } from "../task-master/task-master.service";
import { TaskMasterStorageService } from "../task-master/task-master-storage.service";
import { TasksRebuildService } from "../task-master/tasks-rebuild.service";
import type { WorkItem } from "../plane/plane.types";
import type { SuggestedTask } from "../task-master/task-master.types";

describe("BreakdownService", () => {
  let service: BreakdownService;
  let planeClient: jest.Mocked<PlaneClient>;
  let taskMasterService: jest.Mocked<TaskMasterService>;
  let storageService: jest.Mocked<TaskMasterStorageService>;
  let tasksRebuildService: jest.Mocked<TasksRebuildService>;
  let configService: jest.Mocked<ConfigService>;

  const mockWorkItem: WorkItem = {
    id: "work-item-uuid",
    name: "Test PRD",
    description_html: "<p>Test description</p>",
    sequence_id: "PRD-1",
  };

  const mockSuggestedTasks: SuggestedTask[] = [
    {
      temp_id: "temp-1",
      title: "Task 1",
      description: "Description 1",
      priority: "high",
      dependencies: [],
      tags: ["backend"],
    },
    {
      temp_id: "temp-2",
      title: "Task 2",
      description: "Description 2",
      priority: "medium",
      dependencies: ["temp-1"],
      tags: ["frontend"],
    },
  ];

  beforeEach(async () => {
    const mockPlaneClient = {
      getWorkItem: jest.fn(),
      createWorkItem: jest.fn(),
      listStates: jest.fn(),
      listLabels: jest.fn(),
    };

    const mockTaskMasterService = {
      parsePrdFromContent: jest.fn(),
      expandTask: jest.fn(),
    };

    const mockStorageService = {
      ensureProjectDir: jest.fn(),
      getTagName: jest.fn(),
    };

    const mockTasksRebuildService = {
      rebuildTasksJsonFromPlane: jest.fn(),
      findTaskIdForWorkItem: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BreakdownService,
        {
          provide: PlaneClient,
          useValue: mockPlaneClient,
        },
        {
          provide: TaskMasterService,
          useValue: mockTaskMasterService,
        },
        {
          provide: TaskMasterStorageService,
          useValue: mockStorageService,
        },
        {
          provide: TasksRebuildService,
          useValue: mockTasksRebuildService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<BreakdownService>(BreakdownService);
    planeClient = module.get(PlaneClient);
    taskMasterService = module.get(TaskMasterService);
    storageService = module.get(TaskMasterStorageService);
    tasksRebuildService = module.get(TasksRebuildService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("breakdown", () => {
    it("should break down a PRD into tasks", async () => {
      const dto = {
        workspace_slug: "test-workspace",
        project_id: "project-uuid",
        work_item_id: "PRD-1",
      };

      planeClient.getWorkItem.mockResolvedValue(mockWorkItem);
      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.getTagName.mockReturnValue("prd-PRD-1");
      tasksRebuildService.rebuildTasksJsonFromPlane.mockResolvedValue();
      taskMasterService.parsePrdFromContent.mockResolvedValue(mockSuggestedTasks);
      configService.get.mockReturnValue(10);

      const result = await service.breakdown(dto);

      expect(result.success).toBe(true);
      expect(result.source_work_item.title).toBe("Test PRD");
      expect(result.suggested_tasks).toHaveLength(2);
      expect(result.suggested_tasks[0].temp_id).toBe("temp-1");
      expect(planeClient.getWorkItem).toHaveBeenCalledWith("test-workspace", "project-uuid", "PRD-1");
      expect(taskMasterService.parsePrdFromContent).toHaveBeenCalled();
    });

    it("should use custom max_tasks from options", async () => {
      const dto = {
        workspace_slug: "test-workspace",
        project_id: "project-uuid",
        work_item_id: "PRD-1",
        options: {
          max_tasks: 20,
        },
      };

      planeClient.getWorkItem.mockResolvedValue(mockWorkItem);
      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.getTagName.mockReturnValue("prd-PRD-1");
      tasksRebuildService.rebuildTasksJsonFromPlane.mockResolvedValue();
      taskMasterService.parsePrdFromContent.mockResolvedValue(mockSuggestedTasks);

      await service.breakdown(dto);

      expect(taskMasterService.parsePrdFromContent).toHaveBeenCalledWith(
        expect.any(String),
        "test-workspace",
        "project-uuid",
        "PRD-1",
        { maxTasks: 20, research: false }
      );
    });

    it("should use default max_tasks when not provided", async () => {
      const dto = {
        workspace_slug: "test-workspace",
        project_id: "project-uuid",
        work_item_id: "PRD-1",
      };

      planeClient.getWorkItem.mockResolvedValue(mockWorkItem);
      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.getTagName.mockReturnValue("prd-PRD-1");
      tasksRebuildService.rebuildTasksJsonFromPlane.mockResolvedValue();
      taskMasterService.parsePrdFromContent.mockResolvedValue(mockSuggestedTasks);
      configService.get.mockReturnValue(15);

      await service.breakdown(dto);

      expect(taskMasterService.parsePrdFromContent).toHaveBeenCalledWith(
        expect.any(String),
        "test-workspace",
        "project-uuid",
        "PRD-1",
        { maxTasks: 15, research: false }
      );
    });

    it("should handle work items without description", async () => {
      const workItemWithoutDescription = {
        ...mockWorkItem,
        description_html: null,
      };

      const dto = {
        workspace_slug: "test-workspace",
        project_id: "project-uuid",
        work_item_id: "PRD-1",
      };

      planeClient.getWorkItem.mockResolvedValue(workItemWithoutDescription);
      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.getTagName.mockReturnValue("prd-PRD-1");
      tasksRebuildService.rebuildTasksJsonFromPlane.mockResolvedValue();
      taskMasterService.parsePrdFromContent.mockResolvedValue(mockSuggestedTasks);
      configService.get.mockReturnValue(10);

      const result = await service.breakdown(dto);

      expect(result.success).toBe(true);
      expect(result.source_work_item.description).toBe("Test PRD");
    });
  });

  describe("confirm", () => {
    it("should create tasks in Plane.so", async () => {
      const dto = {
        workspace_slug: "test-workspace",
        project_id: "project-uuid",
        parent_work_item_id: "PRD-1",
        tasks_to_create: [
          {
            title: "Task 1",
            description: "Description 1",
            priority: "high",
            labels: ["backend"],
          },
        ],
      };

      const mockState = { id: "state-uuid", name: "Backlog", default: true };
      const mockLabel = { id: "label-uuid", name: "backend" };
      const mockCreatedWorkItem: WorkItem = {
        id: "created-uuid",
        name: "Task 1",
        sequence_id: "TASK-1",
      };

      const mockParentWorkItem: WorkItem = {
        id: "parent-uuid",
        name: "Parent PRD",
        sequence_id: "PRD-1",
      };

      planeClient.listStates.mockResolvedValue([mockState]);
      planeClient.listLabels.mockResolvedValue([mockLabel]);
      planeClient.getWorkItem.mockResolvedValue(mockParentWorkItem);
      planeClient.createWorkItem.mockResolvedValue(mockCreatedWorkItem);
      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.getTagName.mockReturnValue("prd-PRD-1");

      // Mock tasks.json file reading
      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          "prd-PRD-1": {
            tasks: [{ id: 1, title: "Task 1" }],
          },
        })
      );
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);

      const result = await service.confirm(dto);

      expect(result.success).toBe(true);
      expect(result.created).toHaveLength(1);
      expect(result.created[0].name).toBe("Task 1");
      expect(planeClient.createWorkItem).toHaveBeenCalledWith(
        "test-workspace",
        "project-uuid",
        expect.objectContaining({
          name: "Task 1",
          priority: "high",
        })
      );
    });

    it("should handle failed task creation", async () => {
      const dto = {
        workspace_slug: "test-workspace",
        project_id: "project-uuid",
        parent_work_item_id: "PRD-1",
        tasks_to_create: [
          {
            title: "Task 1",
            description: "Description 1",
          },
          {
            title: "Task 2",
            description: "Description 2",
          },
        ],
      };

      const mockState = { id: "state-uuid", name: "Backlog", default: true };
      const mockCreatedWorkItem: WorkItem = {
        id: "created-uuid",
        name: "Task 1",
        sequence_id: "TASK-1",
      };

      const mockParentWorkItem: WorkItem = {
        id: "parent-uuid",
        name: "Parent PRD",
        sequence_id: "PRD-1",
      };

      planeClient.listStates.mockResolvedValue([mockState]);
      planeClient.listLabels.mockResolvedValue([]);
      planeClient.getWorkItem.mockResolvedValue(mockParentWorkItem);
      planeClient.createWorkItem
        .mockResolvedValueOnce(mockCreatedWorkItem)
        .mockRejectedValueOnce(new Error("API Error"));

      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.getTagName.mockReturnValue("prd-PRD-1");

      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          "prd-PRD-1": {
            tasks: [
              { id: 1, title: "Task 1" },
              { id: 2, title: "Task 2" },
            ],
          },
        })
      );
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);

      const result = await service.confirm(dto);

      expect(result.success).toBe(false);
      expect(result.created).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed?.[0].index).toBe(1);
      expect(result.failed?.[0].error).toContain("API Error");
    });
  });

  describe("expand", () => {
    it("should expand a task into subtasks", async () => {
      const dto = {
        workspace_slug: "test-workspace",
        project_id: "project-uuid",
        work_item_id: "TASK-1",
      };

      const mockTaskWorkItem: WorkItem = {
        id: "task-uuid",
        name: "Parent Task",
        description_html: "<p>Task description</p>",
        sequence_id: "TASK-1",
      };

      planeClient.getWorkItem.mockResolvedValue(mockTaskWorkItem);
      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      tasksRebuildService.rebuildTasksJsonFromPlane.mockResolvedValue();
      tasksRebuildService.findTaskIdForWorkItem.mockResolvedValue(1);
      storageService.getTagName.mockReturnValue("prd-PRD-1");
      taskMasterService.expandTask.mockResolvedValue(mockSuggestedTasks);

      // Mock findRootPrdId by mocking the private method behavior
      jest.spyOn(service as any, "findRootPrdId").mockResolvedValue("PRD-1");

      const result = await service.expand(dto);

      expect(result.success).toBe(true);
      expect(result.source_work_item.title).toBe("Parent Task");
      expect(result.suggested_tasks).toHaveLength(2);
      expect(taskMasterService.expandTask).toHaveBeenCalled();
    });

    it("should include parent context when requested", async () => {
      const dto = {
        workspace_slug: "test-workspace",
        project_id: "project-uuid",
        work_item_id: "TASK-1",
        options: {
          include_context_from_parent: true,
        },
      };

      const mockTaskWorkItem: WorkItem = {
        id: "task-uuid",
        name: "Parent Task",
        description_html: "<p>Task description</p>",
        sequence_id: "TASK-1",
      };

      planeClient.getWorkItem.mockResolvedValue(mockTaskWorkItem);
      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      tasksRebuildService.rebuildTasksJsonFromPlane.mockResolvedValue();
      tasksRebuildService.findTaskIdForWorkItem.mockResolvedValue(1);
      storageService.getTagName.mockReturnValue("prd-PRD-1");
      taskMasterService.expandTask.mockResolvedValue(mockSuggestedTasks);

      jest.spyOn(service as any, "findRootPrdId").mockResolvedValue("PRD-1");

      await service.expand(dto);

      expect(taskMasterService.expandTask).toHaveBeenCalledWith(
        expect.any(Object),
        "test-workspace",
        "project-uuid",
        "prd-PRD-1",
        1,
        expect.objectContaining({
          prompt: expect.any(String),
        })
      );
    });

    it("should throw error when task not found", async () => {
      const dto = {
        workspace_slug: "test-workspace",
        project_id: "project-uuid",
        work_item_id: "TASK-999",
      };

      const mockTaskWorkItem: WorkItem = {
        id: "task-uuid",
        name: "Parent Task",
        description_html: "<p>Task description</p>",
        sequence_id: "TASK-999",
      };

      planeClient.getWorkItem.mockResolvedValue(mockTaskWorkItem);
      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      tasksRebuildService.rebuildTasksJsonFromPlane.mockResolvedValue();
      tasksRebuildService.findTaskIdForWorkItem.mockResolvedValue(null);
      storageService.getTagName.mockReturnValue("prd-PRD-1");

      jest.spyOn(service as any, "findRootPrdId").mockResolvedValue("PRD-1");

      await expect(service.expand(dto)).rejects.toThrow("Could not find task_id for work_item_id");
    });
  });
});
