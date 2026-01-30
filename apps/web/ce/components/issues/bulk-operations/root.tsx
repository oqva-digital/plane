import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { TrashIcon } from "lucide-react";
import { Button } from "@plane/propel/button";
import { AlertModalCore } from "@plane/ui";
// hooks
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useIssues } from "@/hooks/store/use-issues";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
import { EIssuesStoreType } from "@plane/types";
import { cn } from "@plane/utils";

type Props = {
  className?: string;
  selectionHelpers: TSelectionHelper;
};

export const IssueBulkOperationsRoot = observer(function IssueBulkOperationsRoot(props: Props) {
  const { className, selectionHelpers } = props;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const idsToDeleteRef = useRef<string[]>([]);
  // store hooks
  const { isSelectionActive, selectedEntityIds, clearSelection } = useMultipleSelectStore();
  const { workspaceSlug, projectId } = useParams();
  const storeType = useIssueStoreType();
  const { issues } = useIssues(storeType);
  const { t } = useTranslation();

  const labelDeleteAll = t("common.actions.delete_all");

  const removeBulkIssues =
    storeType === EIssuesStoreType.PROJECT ||
    storeType === EIssuesStoreType.CYCLE ||
    storeType === EIssuesStoreType.MODULE ||
    storeType === EIssuesStoreType.PROJECT_VIEW
      ? (issues as { removeBulkIssues?: (ws: string, pId: string, ids: string[]) => Promise<void> }).removeBulkIssues
      : undefined;

  // Manter montado quando o modal de deletar está aberto (evita fechar ao limpar seleção por clique fora)
  const showBar = isSelectionActive && !selectionHelpers.isSelectionDisabled;
  if (!showBar && !deleteModalOpen) return null;

  const count = deleteModalOpen ? idsToDeleteRef.current.length : selectedEntityIds.length;

  const handleDeleteAllClick = () => {
    idsToDeleteRef.current = [...selectedEntityIds];
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    const idsToDelete = idsToDeleteRef.current.length > 0 ? idsToDeleteRef.current : selectedEntityIds;
    if (!workspaceSlug || !projectId || !removeBulkIssues || idsToDelete.length === 0) {
      setDeleteModalOpen(false);
      return;
    }
    setIsDeleting(true);
    const deleteCount = idsToDelete.length;
    try {
      await removeBulkIssues(workspaceSlug.toString(), projectId.toString(), idsToDelete);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.success"),
        message: t("entity.delete.bulk_success", {
          count: deleteCount,
          defaultValue: `${deleteCount} work item(s) deleted successfully.`,
        }),
      });
      idsToDeleteRef.current = [];
      clearSelection();
      setDeleteModalOpen(false);
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: t("entity.delete.error", { entity: t("common.work_item") }),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {showBar && (
        <div
          className={cn(
            "sticky top-0 left-0 z-[2] flex items-center justify-between gap-2 border-b border-subtle bg-surface-1 px-3.5 py-2",
            className
          )}
        >
          <span className="text-13 text-secondary">
            {count} {count === 1 ? t("common.work_item") : t("common.work_item", { count })} {t("common.selected")}
          </span>
          <Button variant="error-fill" size="sm" onClick={handleDeleteAllClick} className="flex items-center gap-1.5">
            <TrashIcon className="h-3.5 w-3.5" />
            {t("common.actions.delete_all")}
          </Button>
        </div>
      )}

      <AlertModalCore
        isOpen={deleteModalOpen}
        handleClose={() => setDeleteModalOpen(false)}
        handleSubmit={() => {
          void handleConfirmDelete();
        }}
        isSubmitting={isDeleting}
        title={labelDeleteAll.startsWith("common.") ? "Delete all" : labelDeleteAll}
        content={
          <>
            {t("entity.delete.confirm_bulk", {
              count,
              defaultValue: `Are you sure you want to delete ${count} work item(s)? This action cannot be undone.`,
            })}
          </>
        }
      />
    </>
  );
});
