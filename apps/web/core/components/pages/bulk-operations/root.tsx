import { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Archive, ArchiveRestore, TrashIcon } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { Button } from "@plane/propel/button";
import { AlertModalCore } from "@plane/ui";
import { cn } from "@plane/utils";
import type { TPageNavigationTabs } from "@plane/types";
// hooks
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import type { TSelectionHelper } from "@/hooks/use-multiple-select";
// plane web hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";

type Props = {
  className?: string;
  selectionHelpers: TSelectionHelper;
  pageType: TPageNavigationTabs;
};

export const PageBulkOperationsRoot = observer(function PageBulkOperationsRoot(props: Props) {
  const { className, selectionHelpers, pageType } = props;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const idsToDeleteRef = useRef<string[]>([]);
  // store hooks
  const { isSelectionActive, selectedEntityIds, clearSelection } = useMultipleSelectStore();
  const { workspaceSlug, projectId } = useParams();
  const { bulkArchivePages, bulkUnarchivePages, bulkDeletePages } = usePageStore(EPageStoreType.PROJECT);
  const { t } = useTranslation();

  // Manter montado quando o modal de deletar está aberto (evita fechar ao limpar seleção por clique fora)
  const showBar = isSelectionActive && !selectionHelpers.isSelectionDisabled;
  if (!showBar && !deleteModalOpen) return null;

  const count = deleteModalOpen ? idsToDeleteRef.current.length : selectedEntityIds.length;

  const handleArchiveClick = async () => {
    if (!workspaceSlug || !projectId || selectedEntityIds.length === 0) return;

    setIsArchiving(true);
    try {
      await bulkArchivePages(workspaceSlug.toString(), projectId.toString(), selectedEntityIds);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.success"),
        message: `${selectedEntityIds.length} page(s) archived successfully.`,
      });
      clearSelection();
    } catch (error) {
      const err = error as { error?: string; unauthorized_page_ids?: string[] };
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: err?.error || "Failed to archive pages. Please try again.",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleUnarchiveClick = async () => {
    if (!workspaceSlug || !projectId || selectedEntityIds.length === 0) return;

    setIsArchiving(true);
    try {
      await bulkUnarchivePages(workspaceSlug.toString(), projectId.toString(), selectedEntityIds);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.success"),
        message: `${selectedEntityIds.length} page(s) unarchived successfully.`,
      });
      clearSelection();
    } catch (error) {
      const err = error as { error?: string; unauthorized_page_ids?: string[] };
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message: err?.error || "Failed to unarchive pages. Please try again.",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDeleteAllClick = () => {
    idsToDeleteRef.current = [...selectedEntityIds];
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    const idsToDelete = idsToDeleteRef.current.length > 0 ? idsToDeleteRef.current : selectedEntityIds;
    if (!workspaceSlug || !projectId || idsToDelete.length === 0) {
      setDeleteModalOpen(false);
      return;
    }
    setIsDeleting(true);
    const deleteCount = idsToDelete.length;
    try {
      await bulkDeletePages(workspaceSlug.toString(), projectId.toString(), idsToDelete);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: t("common.success"),
        message: `${deleteCount} page(s) deleted successfully.`,
      });
      idsToDeleteRef.current = [];
      clearSelection();
      setDeleteModalOpen(false);
    } catch (error) {
      const err = error as { error?: string; not_archived_page_ids?: string[]; unauthorized_page_ids?: string[] };
      setToast({
        type: TOAST_TYPE.ERROR,
        title: t("common.error"),
        message:
          err?.error ||
          (err?.not_archived_page_ids?.length
            ? "Some pages must be archived before deleting."
            : "Failed to delete pages. Please try again."),
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
            {count} {count === 1 ? "page" : "pages"} {t("common.selected")}
          </span>
          <div className="flex items-center gap-2">
            {/* Show Archive button for Active pages (public/private) */}
            {(pageType === "public" || pageType === "private") && (
              <Button
                variant="neutral-outline"
                size="sm"
                onClick={handleArchiveClick}
                loading={isArchiving}
                className="flex items-center gap-1.5"
              >
                <Archive className="h-3.5 w-3.5" />
                Archive
              </Button>
            )}
            {/* Show Unarchive button for Archived pages */}
            {pageType === "archived" && (
              <Button
                variant="neutral-outline"
                size="sm"
                onClick={handleUnarchiveClick}
                loading={isArchiving}
                className="flex items-center gap-1.5"
              >
                <ArchiveRestore className="h-3.5 w-3.5" />
                Unarchive
              </Button>
            )}
            {/* Show Delete button only for Archived pages */}
            {pageType === "archived" && (
              <Button
                variant="error-fill"
                size="sm"
                onClick={handleDeleteAllClick}
                className="flex items-center gap-1.5"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      <AlertModalCore
        isOpen={deleteModalOpen}
        handleClose={() => setDeleteModalOpen(false)}
        handleSubmit={() => {
          void handleConfirmDelete();
        }}
        isSubmitting={isDeleting}
        title="Delete Pages"
        content={
          <>
            Are you sure you want to permanently delete {count} page(s)? This action cannot be undone.
          </>
        }
      />
    </>
  );
});
