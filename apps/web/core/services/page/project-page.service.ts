// types
import type { AxiosResponse } from "axios";
import { API_BASE_URL } from "@plane/constants";
import type { TDocumentPayload, TPage } from "@plane/types";
// helpers
// services
import { APIService } from "@/services/api.service";
import { FileUploadService } from "@/services/file-upload.service";

function throwResponseError(error: unknown): never {
  const err = error as { response?: { data?: unknown } };
  throw err?.response?.data ?? error;
}

export class ProjectPageService extends APIService {
  private fileUploadService: FileUploadService;

  constructor() {
    super(API_BASE_URL);
    // upload service
    this.fileUploadService = new FileUploadService();
  }

  async fetchAll(
    workspaceSlug: string,
    projectId: string,
    params?: { work_item_id?: string; document_type?: string }
  ): Promise<TPage[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/`, {
      params: params ?? {},
    })
      .then((response: AxiosResponse<TPage[]>) => response.data)
      .catch(throwResponseError);
  }

  async fetchById(workspaceSlug: string, projectId: string, pageId: string, trackVisit: boolean): Promise<TPage> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/`, {
      params: {
        track_visit: trackVisit,
      },
    })
      .then((response: AxiosResponse<TPage>) => response.data)
      .catch(throwResponseError);
  }

  async create(workspaceSlug: string, projectId: string, data: Partial<TPage>): Promise<TPage> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/`, data)
      .then((response: AxiosResponse<TPage>) => response.data)
      .catch(throwResponseError);
  }

  async update(workspaceSlug: string, projectId: string, pageId: string, data: Partial<TPage>): Promise<TPage> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/`, data)
      .then((response: AxiosResponse<TPage>) => response.data)
      .catch(throwResponseError);
  }

  async updateAccess(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    data: Pick<TPage, "access">
  ): Promise<void> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/access/`, data)
      .then((response: AxiosResponse<void>) => response.data)
      .catch(throwResponseError);
  }

  async remove(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/`)
      .then((response: AxiosResponse<void>) => response.data)
      .catch(throwResponseError);
  }

  async fetchFavorites(workspaceSlug: string, projectId: string): Promise<TPage[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/favorite-pages/`)
      .then((response: AxiosResponse<TPage[]>) => response.data)
      .catch(throwResponseError);
  }

  async addToFavorites(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/favorite-pages/${pageId}/`)
      .then((response: AxiosResponse<void>) => response.data)
      .catch(throwResponseError);
  }

  async removeFromFavorites(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/favorite-pages/${pageId}/`)
      .then((response: AxiosResponse<void>) => response.data)
      .catch(throwResponseError);
  }

  async fetchArchived(workspaceSlug: string, projectId: string): Promise<TPage[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/archived-pages/`)
      .then((response: AxiosResponse<TPage[]>) => response.data)
      .catch(throwResponseError);
  }

  async archive(
    workspaceSlug: string,
    projectId: string,
    pageId: string
  ): Promise<{
    archived_at: string;
  }> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/archive/`)
      .then((response: AxiosResponse<{ archived_at: string }>) => response.data)
      .catch(throwResponseError);
  }

  async restore(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/archive/`)
      .then((response: AxiosResponse<void>) => response.data)
      .catch(throwResponseError);
  }

  async lock(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/lock/`)
      .then((response: AxiosResponse<void>) => response.data)
      .catch(throwResponseError);
  }

  async unlock(workspaceSlug: string, projectId: string, pageId: string): Promise<void> {
    return this.delete(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/lock/`)
      .then((response: AxiosResponse<void>) => response.data)
      .catch(throwResponseError);
  }

  async fetchDescriptionBinary(workspaceSlug: string, projectId: string, pageId: string): Promise<ArrayBuffer> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/description/`, {
      headers: {
        "Content-Type": "application/octet-stream",
      },
      responseType: "arraybuffer",
    })
      .then((response: AxiosResponse<ArrayBuffer>) => response.data)
      .catch(throwResponseError);
  }

  async updateDescription(
    workspaceSlug: string,
    projectId: string,
    pageId: string,
    data: TDocumentPayload
  ): Promise<TDocumentPayload> {
    return this.patch(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/description/`, data)
      .then((response: AxiosResponse<TDocumentPayload>) => response.data)
      .catch(throwResponseError);
  }

  async duplicate(workspaceSlug: string, projectId: string, pageId: string): Promise<TPage> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/duplicate/`)
      .then((response: AxiosResponse<TPage>) => response.data)
      .catch(throwResponseError);
  }

  async move(workspaceSlug: string, projectId: string, pageId: string, newProjectId: string): Promise<void> {
    return this.post(`/api/workspaces/${workspaceSlug}/projects/${projectId}/pages/${pageId}/move/`, {
      new_project_id: newProjectId,
    })
      .then((response: AxiosResponse<void>) => response.data)
      .catch(throwResponseError);
  }
}
