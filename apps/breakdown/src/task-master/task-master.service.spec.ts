import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { TaskMasterService } from "./task-master.service";
import { TaskMasterStorageService } from "./task-master-storage.service";
import type { SuggestedTask } from "./task-master.types";

describe("TaskMasterService", () => {
  let service: TaskMasterService;
  let storageService: jest.Mocked<TaskMasterStorageService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockStorageService = {
      ensureProjectDir: jest.fn(),
      initTaskMaster: jest.fn(),
      getTagName: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskMasterService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: TaskMasterStorageService,
          useValue: mockStorageService,
        },
      ],
    }).compile();

    service = module.get<TaskMasterService>(TaskMasterService);
    storageService = module.get(TaskMasterStorageService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("parsePrdFromContent", () => {
    it("should parse PRD content into tasks", async () => {
      const prdContent = "# Test PRD\n\nThis is a test PRD.";
      const workspaceSlug = "test-workspace";
      const projectId = "project-uuid";
      const workItemId = "PRD-1";

      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.initTaskMaster.mockResolvedValue();
      storageService.getTagName.mockReturnValue("prd-PRD-1");
      configService.get.mockReturnValue(10);

      // Mock file system operations
      jest.spyOn(require("fs"), "writeFileSync").mockImplementation();
      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          "prd-PRD-1": {
            tasks: [
              {
                id: 1,
                title: "Task 1",
                description: "Description 1",
                priority: "high",
              },
            ],
          },
        })
      );
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);

      // Mock CLI execution
      jest.spyOn(service as any, "runCli").mockResolvedValue(undefined);

      const result = await service.parsePrdFromContent(prdContent, workspaceSlug, projectId, workItemId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(storageService.ensureProjectDir).toHaveBeenCalledWith(workspaceSlug, projectId);
      expect(storageService.initTaskMaster).toHaveBeenCalled();
    });

    it("should use custom maxTasks from options", async () => {
      const prdContent = "# Test PRD";
      const workspaceSlug = "test-workspace";
      const projectId = "project-uuid";
      const workItemId = "PRD-1";

      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.initTaskMaster.mockResolvedValue();
      storageService.getTagName.mockReturnValue("prd-PRD-1");

      jest.spyOn(require("fs"), "writeFileSync").mockImplementation();
      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          "prd-PRD-1": { tasks: [] },
        })
      );
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);

      const runCliSpy = jest.spyOn(service as any, "runCli").mockResolvedValue(undefined);

      await service.parsePrdFromContent(prdContent, workspaceSlug, projectId, workItemId, {
        maxTasks: 20,
      });

      expect(runCliSpy).toHaveBeenCalledWith(expect.arrayContaining(["-n", "20"]), expect.any(String));
    });

    it("should include research flag when requested", async () => {
      const prdContent = "# Test PRD";
      const workspaceSlug = "test-workspace";
      const projectId = "project-uuid";
      const workItemId = "PRD-1";

      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.initTaskMaster.mockResolvedValue();
      storageService.getTagName.mockReturnValue("prd-PRD-1");

      jest.spyOn(require("fs"), "writeFileSync").mockImplementation();
      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          "prd-PRD-1": { tasks: [] },
        })
      );
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);

      const runCliSpy = jest.spyOn(service as any, "runCli").mockResolvedValue(undefined);

      await service.parsePrdFromContent(prdContent, workspaceSlug, projectId, workItemId, {
        research: true,
      });

      expect(runCliSpy).toHaveBeenCalledWith(expect.arrayContaining(["--research"]), expect.any(String));
    });
  });

  describe("expandTask", () => {
    it("should expand a task into subtasks", async () => {
      const content = {
        title: "Parent Task",
        description: "Parent description",
      };
      const workspaceSlug = "test-workspace";
      const projectId = "project-uuid";
      const tag = "prd-PRD-1";
      const taskId = 1;

      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.initTaskMaster.mockResolvedValue();

      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          "prd-PRD-1": {
            tasks: [
              {
                id: 1,
                title: "Parent Task",
                description: "Parent description",
              },
            ],
          },
        })
      );
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);
      jest.spyOn(require("fs"), "writeFileSync").mockImplementation();

      const runCliSpy = jest.spyOn(service as any, "runCli").mockResolvedValue(undefined);

      const result = await service.expandTask(content, workspaceSlug, projectId, tag, taskId);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(runCliSpy).toHaveBeenCalledWith(expect.arrayContaining(["expand", "--id=1"]), expect.any(String));
    });

    it("should include custom prompt when provided", async () => {
      const content = {
        title: "Parent Task",
        description: "Parent description",
      };
      const workspaceSlug = "test-workspace";
      const projectId = "project-uuid";
      const tag = "prd-PRD-1";
      const taskId = 1;

      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.initTaskMaster.mockResolvedValue();

      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          "prd-PRD-1": {
            tasks: [
              {
                id: 1,
                title: "Parent Task",
              },
            ],
          },
        })
      );
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);
      jest.spyOn(require("fs"), "writeFileSync").mockImplementation();

      const runCliSpy = jest.spyOn(service as any, "runCli").mockResolvedValue(undefined);

      await service.expandTask(content, workspaceSlug, projectId, tag, taskId, {
        prompt: "Focus on security",
      });

      expect(runCliSpy).toHaveBeenCalledWith(expect.arrayContaining(["-p", "Focus on security"]), expect.any(String));
    });

    it("should handle nested tasks", async () => {
      const content = {
        title: "Nested Task",
        description: "Nested description",
      };
      const workspaceSlug = "test-workspace";
      const projectId = "project-uuid";
      const tag = "prd-PRD-1";
      const taskId = 2;

      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.initTaskMaster.mockResolvedValue();

      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          "prd-PRD-1": {
            tasks: [
              {
                id: 1,
                title: "Parent Task",
                subtasks: [
                  {
                    id: 2,
                    title: "Nested Task",
                    description: "Nested description",
                  },
                ],
              },
            ],
          },
        })
      );
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);
      jest.spyOn(require("fs"), "writeFileSync").mockImplementation();

      const runCliSpy = jest.spyOn(service as any, "runCli").mockResolvedValue(undefined);

      const result = await service.expandTask(content, workspaceSlug, projectId, tag, taskId);

      expect(result).toBeDefined();
      // Should flatten nested tasks for CLI
      expect(runCliSpy).toHaveBeenCalled();
    });

    it("should throw error when task not found", async () => {
      const content = {
        title: "Non-existent Task",
      };
      const workspaceSlug = "test-workspace";
      const projectId = "project-uuid";
      const tag = "prd-PRD-1";
      const taskId = 999;

      storageService.ensureProjectDir.mockReturnValue("/tmp/test-project");
      storageService.initTaskMaster.mockResolvedValue();

      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(
        JSON.stringify({
          "prd-PRD-1": {
            tasks: [
              {
                id: 1,
                title: "Existing Task",
              },
            ],
          },
        })
      );
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);

      await expect(service.expandTask(content, workspaceSlug, projectId, tag, taskId)).rejects.toThrow(
        "Task with id 999 not found"
      );
    });
  });

  describe("timeout configuration", () => {
    it("should use custom timeout from config", () => {
      configService.get.mockReturnValue(60000);

      const timeout = (service as any).timeoutMs;

      expect(timeout).toBe(60000);
      expect(configService.get).toHaveBeenCalledWith("TASK_MASTER_TIMEOUT_MS");
    });

    it("should use default timeout when not configured", () => {
      configService.get.mockReturnValue(undefined);

      const timeout = (service as any).timeoutMs;

      expect(timeout).toBe(120000); // Default value
    });
  });
});
