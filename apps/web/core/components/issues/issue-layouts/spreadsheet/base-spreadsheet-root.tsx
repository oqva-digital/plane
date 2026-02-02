import type { FC } from "react";
import { useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { ALL_ISSUES, EIssueFilterType, EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type {
  EIssuesStoreType,
  IIssueDisplayFilterOptions,
  IIssueDisplayProperties as _IIssueDisplayProperties,
} from "@plane/types";
import { EIssueLayoutTypes } from "@plane/types";
// hooks
import { useIssues } from "@/hooks/store/use-issues";
import { useUserPermissions } from "@/hooks/store/user";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useIssuesActions } from "@/hooks/use-issues-actions";
// local imports
import { IssueLayoutHOC } from "../issue-layout-HOC";
import type { IQuickActionProps, TRenderQuickActions } from "../list/list-view-types";
import { SpreadsheetView } from "./spreadsheet-view";

export type SpreadsheetStoreType =
  | EIssuesStoreType.PROJECT
  | EIssuesStoreType.MODULE
  | EIssuesStoreType.CYCLE
  | EIssuesStoreType.PROJECT_VIEW
  | EIssuesStoreType.TEAM
  | EIssuesStoreType.TEAM_VIEW
  | EIssuesStoreType.EPIC;

interface IBaseSpreadsheetRoot {
  QuickActions: FC<IQuickActionProps>;
  canEditPropertiesBasedOnProject?: (projectId: string) => boolean;
  isCompletedCycle?: boolean;
  viewId?: string | undefined;
  isEpic?: boolean;
}

export const BaseSpreadsheetRoot = observer(function BaseSpreadsheetRoot(props: IBaseSpreadsheetRoot) {
  const { QuickActions, canEditPropertiesBasedOnProject, isCompletedCycle = false, viewId, isEpic = false } = props;
  // router
  const { projectId } = useParams();
  // store hooks
  const storeType = useIssueStoreType() as SpreadsheetStoreType;
  const { allowPermissions } = useUserPermissions();
  const { issues, issuesFilter } = useIssues(storeType);
  const {
    fetchIssues,
    fetchNextIssues,
    quickAddIssue,
    updateIssue,
    removeIssue,
    removeIssueFromView,
    archiveIssue,
    restoreIssue,
    updateFilters,
  } = useIssuesActions(storeType);
  // derived values
  const { enableInlineEditing, enableQuickAdd, enableIssueCreation } = issues?.viewFlags || {};
  // user role validation
  const isEditingAllowed = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );

  useEffect(() => {
    void fetchIssues("init-loader", { canGroup: false, perPageCount: 100 }, viewId);
  }, [fetchIssues, storeType, viewId]);

  const canEditProperties = useCallback(
    (projectId: string | undefined) => {
      const isEditingAllowedBasedOnProject =
        canEditPropertiesBasedOnProject && projectId ? canEditPropertiesBasedOnProject(projectId) : isEditingAllowed;

      return enableInlineEditing && isEditingAllowedBasedOnProject;
    },
    [canEditPropertiesBasedOnProject, enableInlineEditing, isEditingAllowed]
  );

  const issueIds = issues.groupedIssueIds?.[ALL_ISSUES] ?? [];
  const nextPageResults = issues.getPaginationData(ALL_ISSUES, undefined)?.nextPageResults;

  const handleDisplayFiltersUpdate = useCallback(
    (updatedDisplayFilter: Partial<IIssueDisplayFilterOptions>) => {
      void updateFilters(projectId?.toString() ?? "", EIssueFilterType.DISPLAY_FILTERS, {
        ...updatedDisplayFilter,
      });
    },
    [projectId, updateFilters]
  );

  const renderQuickActions: TRenderQuickActions = useCallback(
    ({ issue, parentRef, customActionButton, placement, portalElement, selectionHelpers, groupId }) => (
      <QuickActions
        parentRef={parentRef}
        customActionButton={customActionButton}
        issue={issue}
        handleDelete={async () => removeIssue(issue.project_id, issue.id)}
        handleUpdate={async (data) => updateIssue && updateIssue(issue.project_id, issue.id, data)}
        handleRemoveFromView={async () => removeIssueFromView && removeIssueFromView(issue.project_id, issue.id)}
        handleArchive={async () => archiveIssue && archiveIssue(issue.project_id, issue.id)}
        handleRestore={async () => restoreIssue && restoreIssue(issue.project_id, issue.id)}
        portalElement={portalElement}
        readOnly={!canEditProperties(issue.project_id ?? undefined) || isCompletedCycle}
        placements={placement} // eslint-disable-line @typescript-eslint/no-unsafe-assignment -- placement from args
        selectionHelpers={selectionHelpers}
        groupId={groupId}
      />
    ),
    [
      QuickActions,
      isCompletedCycle,
      canEditProperties,
      removeIssue,
      updateIssue,
      removeIssueFromView,
      archiveIssue,
      restoreIssue,
    ]
  );

  if (!Array.isArray(issueIds)) return null;

  return (
    <IssueLayoutHOC layout={EIssueLayoutTypes.SPREADSHEET}>
      <SpreadsheetView
        displayProperties={issuesFilter.issueFilters?.displayProperties ?? {}}
        displayFilters={issuesFilter.issueFilters?.displayFilters ?? {}}
        handleDisplayFilterUpdate={handleDisplayFiltersUpdate}
        issueIds={issueIds}
        quickActions={renderQuickActions}
        updateIssue={updateIssue}
        canEditProperties={canEditProperties}
        quickAddCallback={quickAddIssue}
        enableQuickCreateIssue={enableQuickAdd}
        disableIssueCreation={!enableIssueCreation || !isEditingAllowed || isCompletedCycle}
        canLoadMoreIssues={!!nextPageResults}
        loadMoreIssues={(groupId?: string) => void fetchNextIssues(groupId)}
        isEpic={isEpic}
      />
    </IssueLayoutHOC>
  );
});
