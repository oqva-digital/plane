import type {
  ITaskBreakdownConfirmRequest,
  ITaskBreakdownConfirmResponse,
  ITaskBreakdownExpandRequest,
  ITaskBreakdownRequest,
  ITaskBreakdownResponse,
} from "@/types/breakdown";
import type { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import axios from "axios";

/**
 * Service responsible for talking to the external Task Master breakdown API.
 * This service is frontend-specific and should not be in shared packages.
 * Uses a separate axios instance without credentials since it's an external API.
 */
export class TaskBreakdownService {
  private breakdownApiUrl: string;
  private axiosInstance: AxiosInstance;

  constructor() {
    const breakdownApiUrl = process.env.VITE_BREAKDOWN_API_URL || "";
    this.breakdownApiUrl = breakdownApiUrl;

    // Create axios instance without credentials for external API
    this.axiosInstance = axios.create({
      baseURL: breakdownApiUrl,
      withCredentials: false, // External API doesn't need credentials
    });
  }

  /**
   * Request AI breakdown suggestions for a parent work item (PRD).
   * Wraps POST /api/breakdown.
   */
  async generateBreakdown(payload: ITaskBreakdownRequest, apiKey: string): Promise<ITaskBreakdownResponse> {
    return this.axiosInstance
      .post("/breakdown", payload, {
        headers: {
          "X-Breakdown-API-Key": apiKey,
        },
      } as AxiosRequestConfig)
      .then((res) => res?.data as ITaskBreakdownResponse)
      .catch((error: unknown) => {
        const axiosError = error as AxiosError;
        throw axiosError?.response?.data ?? error;
      });
  }

  /**
   * Request AI expansion suggestions for a child work item (subtask).
   * Wraps POST /api/expand.
   */
  async generateExpand(payload: ITaskBreakdownExpandRequest, apiKey: string): Promise<ITaskBreakdownResponse> {
    return this.axiosInstance
      .post("/expand", payload, {
        headers: {
          "X-Breakdown-API-Key": apiKey,
        },
      } as AxiosRequestConfig)
      .then((res) => res?.data as ITaskBreakdownResponse)
      .catch((error: unknown) => {
        const axiosError = error as AxiosError;
        throw axiosError?.response?.data ?? error;
      });
  }

  /**
   * Confirm and create tasks from breakdown suggestions.
   * Wraps POST /api/breakdown/confirm.
   */
  async confirmBreakdown(
    payload: ITaskBreakdownConfirmRequest,
    apiKey: string
  ): Promise<ITaskBreakdownConfirmResponse> {
    return this.axiosInstance
      .post("/breakdown/confirm", payload, {
        headers: {
          "X-Breakdown-API-Key": apiKey,
        },
      } as AxiosRequestConfig)
      .then((res) => res?.data as ITaskBreakdownConfirmResponse)
      .catch((error: unknown) => {
        const axiosError = error as AxiosError;
        throw axiosError?.response?.data ?? error;
      });
  }
}
