import { Test, TestingModule } from "@nestjs/testing";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { of, throwError } from "rxjs";
import { AxiosResponse } from "axios";
import { PlaneClient } from "./plane.client";
import type { WorkItem, Label, State } from "./plane.types";

describe("PlaneClient", () => {
  let client: PlaneClient;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockHttpService = {
      request: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlaneClient,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    client = module.get<PlaneClient>(PlaneClient);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getWorkItem", () => {
    it("should fetch work item by UUID", async () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const mockWorkItem: WorkItem = {
        id: uuid,
        name: "Test Work Item",
        description_html: "<p>Description</p>",
        sequence_id: "PRD-1",
      };

      const mockResponse: AxiosResponse<WorkItem> = {
        data: mockWorkItem,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await client.getWorkItem("workspace", "project-id", uuid);

      expect(result).toEqual(mockWorkItem);
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: expect.stringContaining("/projects/project-id/work-items"),
        })
      );
    });

    it("should fetch work item by sequence ID", async () => {
      const sequenceId = "PRD-1";
      const mockWorkItem: WorkItem = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Test Work Item",
        sequence_id: sequenceId,
      };

      const mockResponse: AxiosResponse<WorkItem> = {
        data: mockWorkItem,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await client.getWorkItem("workspace", "project-id", sequenceId);

      expect(result).toEqual(mockWorkItem);
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: expect.stringContaining("/work-items"),
        })
      );
    });

    it("should include expand parameter", async () => {
      const mockWorkItem: WorkItem = {
        id: "uuid",
        name: "Test",
      };

      const mockResponse: AxiosResponse<WorkItem> = {
        data: mockWorkItem,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      await client.getWorkItem("workspace", "project-id", "PRD-1");

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: { expand: "state,labels" },
        })
      );
    });

    it("should handle API errors", async () => {
      const error: any = {
        response: {
          status: 404,
          statusText: "Not Found",
          data: { message: "Work item not found" },
        },
        message: "Request failed",
      };

      httpService.request.mockReturnValue(throwError(() => error));

      await expect(client.getWorkItem("workspace", "project-id", "INVALID")).rejects.toEqual(error);
    });
  });

  describe("createWorkItem", () => {
    it("should create a work item", async () => {
      const mockCreatedItem: WorkItem = {
        id: "new-uuid",
        name: "New Task",
        sequence_id: "TASK-1",
      };

      const mockResponse: AxiosResponse<WorkItem> = {
        data: mockCreatedItem,
        status: 201,
        statusText: "Created",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await client.createWorkItem("workspace", "project-id", {
        name: "New Task",
        description_html: "<p>Description</p>",
      });

      expect(result).toEqual(mockCreatedItem);
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: expect.stringContaining("/work-items"),
        })
      );
    });

    it("should handle array response format", async () => {
      const mockCreatedItem: WorkItem = {
        id: "new-uuid",
        name: "New Task",
      };

      const mockResponse: AxiosResponse<WorkItem[]> = {
        data: [mockCreatedItem],
        status: 201,
        statusText: "Created",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await client.createWorkItem("workspace", "project-id", {
        name: "New Task",
      });

      expect(result).toEqual(mockCreatedItem);
    });
  });

  describe("listLabels", () => {
    it("should list labels", async () => {
      const mockLabels: Label[] = [
        { id: "label-1", name: "Backend" },
        { id: "label-2", name: "Frontend" },
      ];

      const mockResponse: AxiosResponse<Label[]> = {
        data: mockLabels,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await client.listLabels("workspace", "project-id");

      expect(result).toEqual(mockLabels);
      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: expect.stringContaining("/labels"),
        })
      );
    });

    it("should handle paginated response", async () => {
      const mockLabels: Label[] = [{ id: "label-1", name: "Backend" }];

      const mockResponse: AxiosResponse<{ results: Label[] }> = {
        data: { results: mockLabels },
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await client.listLabels("workspace", "project-id");

      expect(result).toEqual(mockLabels);
    });
  });

  describe("listStates", () => {
    it("should list states", async () => {
      const mockStates: State[] = [
        { id: "state-1", name: "Backlog", group: "backlog", default: true },
        { id: "state-2", name: "In Progress", group: "started" },
      ];

      const mockResponse: AxiosResponse<State[]> = {
        data: mockStates,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await client.listStates("workspace", "project-id");

      expect(result).toEqual(mockStates);
    });
  });

  describe("listWorkItems", () => {
    it("should list work items", async () => {
      const mockWorkItems: WorkItem[] = [
        { id: "item-1", name: "Task 1" },
        { id: "item-2", name: "Task 2" },
      ];

      const mockResponse: AxiosResponse<WorkItem[]> = {
        data: mockWorkItems,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      const result = await client.listWorkItems("workspace", "project-id");

      expect(result).toEqual(mockWorkItems);
    });

    it("should handle parent filter", async () => {
      const mockWorkItems: WorkItem[] = [{ id: "item-1", name: "Child Task", parent: "parent-uuid" }];

      const mockResponse: AxiosResponse<WorkItem[]> = {
        data: mockWorkItems,
        status: 200,
        statusText: "OK",
        headers: {},
        config: {} as any,
      };

      httpService.request.mockReturnValue(of(mockResponse));

      await client.listWorkItems("workspace", "project-id", {
        parent: "parent-uuid",
      });

      expect(httpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            parent: "parent-uuid",
          }),
        })
      );
    });
  });
});
