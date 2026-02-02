import { useEffect, useRef, useState } from "react";
import { xor } from "lodash-es";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// Plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { TBaseIssue, TIssue, TIssueSubIssues } from "@plane/types";
import { EIssuesStoreType } from "@plane/types";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useIssueModal } from "@/hooks/context/use-issue-modal";
import { useCycle } from "@/hooks/store/use-cycle";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssues } from "@/hooks/store/use-issues";
import { useModule } from "@/hooks/store/use-module";
import { useProject } from "@/hooks/store/use-project";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
// services
import { FileService } from "@/services/file.service";
const fileService = new FileService();
// local imports
import { CreateIssueToastActionItems } from "../create-issue-toast-action-items";
import { DraftIssueLayout } from "./draft-issue-layout";
import { IssueFormRoot } from "./form";
import type { IssueFormProps } from "./form";
import type { IssuesModalProps } from "./modal";

export const CreateUpdateIssueModalBase = observer(function CreateUpdateIssueModalBase(props: IssuesModalProps) {
  const {
    data,
    isOpen,
    onClose,
    beforeFormSubmit,
    onSubmit,
    withDraftIssueWrapper = true,
    storeType: issueStoreFromProps,
    isDraft = false,
    fetchIssueDetails = true,
    moveToIssue = false,
    modalTitle,
    primaryButtonText,
    isProjectSelectionDisabled = false,
    showActionItemsOnUpdate = false,
  } = props;
  const issueStoreType = useIssueStoreType();

  let storeType = issueStoreFromProps ?? issueStoreType;
  // Fallback to project store if epic store is used in issue modal.
  if (storeType === EIssuesStoreType.EPIC) {
    storeType = EIssuesStoreType.PROJECT;
  }
  // ref
  const issueTitleRef = useRef<HTMLInputElement>(null);
  // states
  const [changesMade, setChangesMade] = useState<Partial<TIssue> | null>(null);
  const [createMore, setCreateMore] = useState(false);
  const [copyDescendants, setCopyDescendants] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [uploadedAssetIds, setUploadedAssetIds] = useState<string[]>([]);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [copyProgress, setCopyProgress] = useState<{ done: number; total: number } | null>(null);
  // State to preserve data/description when modal is closing (prevents content flash during close animation)
  const [preservedData, setPreservedData] = useState<Partial<TIssue> | undefined>(undefined);
  const [preservedDescription, setPreservedDescription] = useState<string | undefined>(undefined);
  // store hooks
  const { t } = useTranslation();
  const { workspaceSlug, projectId: routerProjectId, cycleId, moduleId, workItem } = useParams();
  const { fetchCycleDetails } = useCycle();
  const { fetchModuleDetails } = useModule();
  const { issues } = useIssues(storeType);
  const { issues: projectIssues } = useIssues(EIssuesStoreType.PROJECT);
  const { issues: draftIssues } = useIssues(EIssuesStoreType.WORKSPACE_DRAFT);
  const { fetchIssue, subIssues } = useIssueDetail();
  const { allowedProjectIds, handleCreateUpdatePropertyValues, handleCreateSubWorkItem } = useIssueModal();
  const { getProjectByIdentifier } = useProject();
  // current store details
  const { createIssue, updateIssue } = useIssuesActions(storeType);
  // derived values
  const routerProjectIdentifier = workItem?.toString().split("-")[0];
  const projectIdFromRouter = getProjectByIdentifier(routerProjectIdentifier)?.id;
  const projectId = data?.project_id ?? routerProjectId?.toString() ?? projectIdFromRouter;

  const fetchIssueDetail = async (issueId: string | undefined) => {
    setDescription(undefined);
    if (!workspaceSlug) return;

    if (!projectId || issueId === undefined || !fetchIssueDetails) {
      // Set description to the issue description from the props if available
      setDescription(data?.description_html || "<p></p>");
      return;
    }
    const response = await fetchIssue(workspaceSlug.toString(), projectId.toString(), issueId);
    if (response) setDescription(response?.description_html || "<p></p>");
  };

  useEffect(() => {
    // fetching issue details
    if (isOpen) void fetchIssueDetail(data?.id ?? data?.sourceIssueId);

    // Keep display data and description in state when modal is open (so content does not disappear on close).
    // Do not overwrite during copy-with-descendants so progress re-renders do not clear the snapshot.
    if (isOpen && data && copyProgress == null) {
      setPreservedData(data);
      setPreservedDescription(description ?? data.description_html ?? preservedDescription);
    }

    // When modal closes: delay clearing state until after animation (content stays visible until modal is gone)
    if (!isOpen) {
      const closeTimeout = setTimeout(() => {
        setActiveProjectId(null);
        setChangesMade(null);
      }, 350);
      return () => clearTimeout(closeTimeout);
    }

    // if data is present, set active project to the project of the
    // issue. This has more priority than the project in the url.
    if (data && data.project_id) {
      setActiveProjectId(data.project_id);
      return;
    }

    // if data is not present, set active project to the first project in the allowedProjectIds array
    if (allowedProjectIds && allowedProjectIds.length > 0 && !activeProjectId)
      setActiveProjectId(projectId?.toString() ?? allowedProjectIds?.[0]);

    // clearing up the description state when we leave the component
    return () => setDescription(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.project_id, data?.id, data?.sourceIssueId, projectId, isOpen, activeProjectId, copyProgress]);

  useEffect(() => {
    // Do not overwrite snapshot state during copy-with-descendants
    if (copyProgress != null) return;
    if (isOpen && description !== undefined) setPreservedDescription(description);
  }, [isOpen, description, copyProgress]);

  // Form data: use preserved data when closing (for smooth animation), but during copy-with-descendants
  // progress updates, use preserved data to prevent content flash.
  // Always use data prop when modal is open to avoid hydration mismatches.
  // When modal is closed, use preserved data for close animation (but component typically returns null anyway)
  const displayData = copyProgress != null
    ? (preservedData ?? data)
    : isOpen
      ? data
      : preservedData;
  const displayDescription = copyProgress != null
    ? (preservedDescription ?? description ?? data?.description_html)
    : isOpen
      ? (description ?? data?.description_html)
      : preservedDescription;

  const addIssueToCycle = async (issue: TIssue, cycleId: string) => {
    if (!workspaceSlug || !issue.project_id) return;

    await issues.addIssueToCycle(workspaceSlug.toString(), issue.project_id, cycleId, [issue.id]);
    void fetchCycleDetails(workspaceSlug.toString(), issue.project_id, cycleId);
  };

  const addIssueToModule = async (issue: TIssue, moduleIds: string[]) => {
    if (!workspaceSlug || !issue.project_id) return;

    await Promise.all([
      issues.changeModulesInIssue(workspaceSlug.toString(), issue.project_id, issue.id, moduleIds, []),
      ...moduleIds.map(
        (moduleId) => issue.project_id && fetchModuleDetails(workspaceSlug.toString(), issue.project_id, moduleId)
      ),
    ]);
  };

  const handleCreateMoreToggleChange = (value: boolean) => {
    setCreateMore(value);
  };

  const handleCopyDescendantsToggleChange = (value: boolean) => {
    setCopyDescendants(value);
  };

  const BATCH_SIZE = 5;

  /** Fetches all descendants in BFS order (root → children → grandchildren → …). Nested sub-work-items work because we create in order and idMap has the new parent_id when creating each child. */
  const fetchAllDescendants = async (ws: string, projectId: string, rootIssueId: string): Promise<TIssue[]> => {
    const result: TIssue[] = [];
    const queue: string[] = [rootIssueId];
    while (queue.length > 0) {
      const parentId = queue.shift();
      if (!parentId) break;
      const response: TIssueSubIssues = await subIssues.fetchSubIssues(ws, projectId, parentId);
      const children: TIssue[] = Array.isArray(response.sub_issues)
        ? response.sub_issues
        : response.sub_issues
          ? Object.values(response.sub_issues).flat()
          : [];
      for (const child of children) {
        result.push(child);
        if ((child.sub_issues_count ?? 0) > 0) queue.push(child.id);
      }
    }
    return result;
  };

  const buildDescendantPayload = (
    desc: TIssue,
    newParentId: string,
    projectId: string,
    fallbackTypeId: string | null
  ): Partial<TIssue> => {
    const name = (desc.name ?? "").trim();
    return {
      project_id: projectId,
      parent_id: newParentId,
      name: name.endsWith(" (Copy)") ? name : `${name} (Copy)`,
      state_id: desc.state_id ?? null,
      priority: desc.priority ?? null,
      assignee_ids: desc.assignee_ids ?? [],
      label_ids: desc.label_ids ?? [],
      start_date: desc.start_date ?? null,
      target_date: desc.target_date ?? null,
      cycle_id: desc.cycle_id ?? null,
      module_ids: desc.module_ids ?? null,
      type_id: desc.type_id ?? fallbackTypeId,
      estimate_point: desc.estimate_point ?? null,
    };
  };

  const handleClose = (saveAsDraft?: boolean) => {
    if (changesMade && saveAsDraft && !data) {
      void handleCreateIssue(changesMade, true);
    }

    // Close modal first (onClose); do not clear activeProjectId here so content does not disappear before modal closes. useEffect clears when isOpen becomes false.
    onClose();
    handleDuplicateIssueModal(false);
  };

  const handleCreateIssue = async (
    payload: Partial<TIssue>,
    is_draft_issue: boolean = false,
    skipSuccessToastAndClose: boolean = false
  ): Promise<TIssue | undefined> => {
    if (!workspaceSlug || !payload.project_id) return;

    try {
      let response: TIssue | undefined;
      // if draft issue, use draft issue store to create issue
      if (is_draft_issue) {
        response = (await draftIssues.createIssue(workspaceSlug.toString(), payload)) as TIssue;
      }
      // if cycle id in payload does not match the cycleId in url
      // or if the moduleIds in Payload does not match the moduleId in url
      // use the project issue store to create issues
      else if (
        (payload.cycle_id !== cycleId && storeType === EIssuesStoreType.CYCLE) ||
        (!payload.module_ids?.includes(moduleId?.toString()) && storeType === EIssuesStoreType.MODULE)
      ) {
        response = await projectIssues.createIssue(workspaceSlug.toString(), payload.project_id, payload);
      } // else just use the existing store type's create method
      else if (createIssue) {
        response = await createIssue(payload.project_id, payload);
      }

      // update uploaded assets' status
      if (uploadedAssetIds.length > 0) {
        await fileService.updateBulkProjectAssetsUploadStatus(
          workspaceSlug?.toString() ?? "",
          response?.project_id ?? "",
          response?.id ?? "",
          {
            asset_ids: uploadedAssetIds,
          }
        );
        setUploadedAssetIds([]);
      }

      if (!response) throw new Error();

      // check if we should add issue to cycle/module
      if (!is_draft_issue) {
        if (
          payload.cycle_id &&
          payload.cycle_id !== "" &&
          (payload.cycle_id !== cycleId || storeType !== EIssuesStoreType.CYCLE)
        ) {
          await addIssueToCycle(response, payload.cycle_id);
        }
        if (
          payload.module_ids &&
          payload.module_ids.length > 0 &&
          (!payload.module_ids.includes(moduleId?.toString()) || storeType !== EIssuesStoreType.MODULE)
        ) {
          await addIssueToModule(response, payload.module_ids);
        }
      }

      // add other property values
      if (response.id && response.project_id) {
        await handleCreateUpdatePropertyValues({
          issueId: response.id,
          issueTypeId: response.type_id,
          projectId: response.project_id,
          workspaceSlug: workspaceSlug?.toString(),
          isDraft: is_draft_issue,
        });

        // create sub work item
        await handleCreateSubWorkItem({
          workspaceSlug: workspaceSlug?.toString(),
          projectId: response.project_id,
          parentId: response.id,
        });
      }

      if (!skipSuccessToastAndClose) {
        setToast({
          type: TOAST_TYPE.SUCCESS,
          title: t("success"),
          message: `${is_draft_issue ? t("draft_created") : t("issue_created_successfully")} `,
          actionItems: !is_draft_issue && response?.project_id && (
            <CreateIssueToastActionItems
              workspaceSlug={workspaceSlug.toString()}
              projectId={response?.project_id}
              issueId={response.id}
            />
          ),
        });
        if (!createMore) handleClose();
        if (createMore && issueTitleRef) issueTitleRef?.current?.focus();
      }
      // Do not reset description during copy-with-descendants (skipSuccessToastAndClose) so refs are not overwritten
      if (!skipSuccessToastAndClose) {
        setDescription("<p></p>");
        setChangesMade(null);
      }
      return response;
    } catch (error: unknown) {
      const message =
        error !== null && typeof error === "object" && "error" in error
          ? String((error as { error?: unknown }).error)
          : undefined;
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("error"),
        message: message ?? t(is_draft_issue ? "draft_creation_failed" : "issue_creation_failed"),
      });
      throw error;
    }
  };

  const handleUpdateIssue = async (payload: Partial<TIssue>): Promise<TIssue | undefined> => {
    if (!workspaceSlug || !payload.project_id || !data?.id) return;

    try {
      if (isDraft) await draftIssues.updateIssue(workspaceSlug.toString(), data.id, payload);
      else if (updateIssue) await updateIssue(payload.project_id, data.id, payload);

      // check if we should add/remove issue to/from cycle
      if (
        payload.cycle_id &&
        payload.cycle_id !== "" &&
        (payload.cycle_id !== cycleId || storeType !== EIssuesStoreType.CYCLE)
      ) {
        await addIssueToCycle(data as TBaseIssue, payload.cycle_id);
      }
      if (data.cycle_id && !payload.cycle_id && data.project_id) {
        await issues.removeIssueFromCycle(workspaceSlug.toString(), data.project_id, data.cycle_id, data.id);
        void fetchCycleDetails(workspaceSlug.toString(), data.project_id, data.cycle_id);
      }

      if (data.module_ids && payload.module_ids && data.project_id) {
        const updatedModuleIds = xor(data.module_ids, payload.module_ids);
        const modulesToAdd: string[] = [];
        const modulesToRemove: string[] = [];

        for (const moduleId of updatedModuleIds) {
          if (data.module_ids.includes(moduleId)) {
            modulesToRemove.push(moduleId);
          } else {
            modulesToAdd.push(moduleId);
          }
        }
        await issues.changeModulesInIssue(
          workspaceSlug.toString(),
          data.project_id,
          data.id,
          modulesToAdd,
          modulesToRemove
        );
      }

      // add other property values
      await handleCreateUpdatePropertyValues({
        issueId: data.id,
        issueTypeId: payload.type_id,
        projectId: payload.project_id,
        workspaceSlug: workspaceSlug?.toString(),
        isDraft: isDraft,
      });

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("success"),
        message: t("issue_updated_successfully"),
        actionItems:
          showActionItemsOnUpdate && payload.project_id ? (
            <CreateIssueToastActionItems
              workspaceSlug={workspaceSlug.toString()}
              projectId={payload.project_id}
              issueId={data.id}
            />
          ) : undefined,
      });
      handleClose();
    } catch (error: unknown) {
      console.error(error);
      const message =
        error !== null && typeof error === "object" && "error" in error
          ? String((error as { error?: unknown }).error)
          : undefined;
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("error"),
        message: message ?? t("issue_could_not_be_updated"),
      });
    }
  };

  const handleFormSubmit = async (payload: Partial<TIssue>, is_draft_issue: boolean = false) => {
    if (!workspaceSlug || !payload.project_id || !storeType) return;
    // Capture sourceIssueId before any mutation (do not mutate data/props)
    const sourceIssueId = data?.sourceIssueId;

    let response: TIssue | undefined = undefined;
    let wasCopyingDescendants = false;

    try {
      if (beforeFormSubmit) await beforeFormSubmit();

      if (!data?.id && sourceIssueId && copyDescendants) {
        wasCopyingDescendants = true;
        // Preserve description and data in state before any setCopyProgress (progress bar re-renders must not clear content)
        const descToPreserve =
          payload.description_html ?? description ?? data?.description_html ?? preservedDescription;
        setPreservedDescription(descToPreserve);
        setPreservedData(data ? { ...data, description_html: descToPreserve } : preservedData);
        setCopyProgress({ done: 0, total: 0 });
        try {
          const descendants = await fetchAllDescendants(workspaceSlug.toString(), payload.project_id, sourceIssueId);
          const progressTotal = 1 + descendants.length;
          setCopyProgress((prev) => (prev ? { ...prev, total: progressTotal } : null));

          const rootName = (payload.name ?? data?.name ?? "").trim();
          const rootPayload: Partial<TIssue> = {
            ...payload,
            name: rootName.endsWith(" (Copy)") ? rootName : `${rootName || "Issue"} (Copy)`,
            parent_id: undefined,
          };
          const rootResponse = await handleCreateIssue(rootPayload, is_draft_issue, true);
          if (!rootResponse?.id) throw new Error("Root create failed");
          const idMap = new Map<string, string>();
          idMap.set(sourceIssueId, rootResponse.id);
          setCopyProgress((prev) => (prev ? { ...prev, done: 1 } : null));

          const ws = workspaceSlug.toString();
          const projId = payload.project_id;
          const fallbackTypeId = payload.type_id ?? data?.type_id ?? null;
          for (let i = 0; i < descendants.length; i += BATCH_SIZE) {
            const batch = descendants.slice(i, i + BATCH_SIZE);
            const created = await Promise.all<TIssue | undefined>(
              batch.map((desc) => {
                const newParentId = idMap.get(desc.parent_id ?? "");
                if (!newParentId) throw new Error("Parent not found for " + desc.id);
                const childPayload = buildDescendantPayload(desc, newParentId, projId, fallbackTypeId);
                return projectIssues.createIssue(ws, projId, childPayload);
              })
            );
            for (let j = 0; j < batch.length; j++) {
              const c = created[j];
              if (c?.id) idMap.set(batch[j].id, c.id);
            }
            setCopyProgress((prev) => (prev ? { ...prev, done: prev.done + batch.length } : null));
          }

          response = rootResponse;
          setToast({
            type: TOAST_TYPE.SUCCESS,
            title: t("success"),
            message: t("issue_created_successfully"),
            actionItems: rootResponse?.project_id && (
              <CreateIssueToastActionItems
                workspaceSlug={workspaceSlug.toString()}
                projectId={rootResponse.project_id}
                issueId={rootResponse.id}
              />
            ),
          });
          if (!createMore) handleClose();
          if (createMore && issueTitleRef) issueTitleRef?.current?.focus();
        } finally {
          setCopyProgress(null);
        }
      } else if (!data?.id) {
        response = await handleCreateIssue(payload, is_draft_issue);
      } else {
        response = await handleUpdateIssue(payload);
      }
    } catch (err: unknown) {
      if (wasCopyingDescendants) {
        const message =
          err !== null && typeof err === "object" && "error" in err
            ? String((err as { error?: unknown }).error)
            : undefined;
        setToast({
          type: TOAST_TYPE.ERROR,
          title: t("error"),
          message: message ?? t("issue_creation_failed"),
        });
        setCopyProgress(null);
      }
      throw err;
    } finally {
      if (response != undefined && onSubmit) await onSubmit(response);
    }
  };

  const handleFormChange = (formData: Partial<TIssue> | null) => setChangesMade(formData);

  const handleUpdateUploadedAssetIds = (assetId: string) => setUploadedAssetIds((prev) => [...prev, assetId]);

  const handleDuplicateIssueModal = (value: boolean) => setIsDuplicateModalOpen(value);

  // don't open the modal if there are no projects
  if (!allowedProjectIds || allowedProjectIds.length === 0 || !activeProjectId) return null;

  const commonIssueModalProps: IssueFormProps = {
    issueTitleRef: issueTitleRef,
    data: displayData
      ? {
          ...displayData,
          description_html: displayDescription ?? displayData.description_html,
          cycle_id: displayData.cycle_id ?? cycleId?.toString() ?? null,
          module_ids: displayData.module_ids ?? (moduleId ? [moduleId.toString()] : null),
        }
      : undefined,
    onAssetUpload: handleUpdateUploadedAssetIds,
    onClose: handleClose,
    onSubmit: (payload) => handleFormSubmit(payload, isDraft),
    projectId: activeProjectId,
    isCreateMoreToggleEnabled: createMore,
    onCreateMoreToggleChange: handleCreateMoreToggleChange,
    isCopyDescendantsEnabled: copyDescendants,
    onCopyDescendantsChange: handleCopyDescendantsToggleChange,
    copyProgress,
    isDraft: isDraft,
    moveToIssue: moveToIssue,
    modalTitle: modalTitle,
    primaryButtonText: primaryButtonText,
    isDuplicateModalOpen: isDuplicateModalOpen,
    handleDuplicateIssueModal: handleDuplicateIssueModal,
    isProjectSelectionDisabled: isProjectSelectionDisabled,
  };

  return (
    <ModalCore
      isOpen={isOpen}
      position={EModalPosition.TOP}
      width={isDuplicateModalOpen ? EModalWidth.VIXL : EModalWidth.XXXXL}
      className="!bg-transparent rounded-lg shadow-none transition-[width] ease-linear"
    >
      {withDraftIssueWrapper ? (
        <DraftIssueLayout {...commonIssueModalProps} changesMade={changesMade} onChange={handleFormChange} />
      ) : (
        <IssueFormRoot {...commonIssueModalProps} />
      )}
    </ModalCore>
  );
});
