import { useMemo, useState } from "react";
import { observer } from "mobx-react";
// ui
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { AlertModalCore } from "@plane/ui";
// types
import type { TPageNavigationTabs } from "@plane/types";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";

type TBulkActionType = "archive" | "restore" | "delete";

type Props = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
  selectedPageIds: string[];
  onClearSelection: () => void;
};

export const PagesBulkActionsBar = observer(function PagesBulkActionsBar(props: Props) {
  const { pageType, storeType, selectedPageIds, onClearSelection } = props;
  const [activeAction, setActiveAction] = useState<TBulkActionType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pageStore = usePageStore(storeType);

  const count = selectedPageIds.length;
  const isArchivedTab = pageType === "archived";

  const showBar = count > 0;

  const modalTitle = useMemo(() => {
    if (!activeAction) return "";
    if (activeAction === "archive") return "Archive pages";
    if (activeAction === "restore") return "Restore pages";
    return "Delete pages";
  }, [activeAction]);

  const modalContent = useMemo(() => {
    if (!activeAction || count === 0) return null;

    if (activeAction === "archive")
      return (
        <>
          Are you sure you want to archive {count} page{count === 1 ? "" : "s"}?
        </>
      );

    if (activeAction === "restore")
      return (
        <>
          Are you sure you want to restore {count} page{count === 1 ? "" : "s"}?
        </>
      );

    return (
      <>
        Are you sure you want to permanently delete {count} page{count === 1 ? "" : "s"}? This action cannot be undone.
      </>
    );
  }, [activeAction, count]);

  const primaryButtonText = useMemo(() => {
    if (!activeAction) return { default: "Confirm", loading: "Processing..." };
    if (activeAction === "archive") return { default: "Archive", loading: "Archiving..." };
    if (activeAction === "restore") return { default: "Restore", loading: "Restoring..." };
    return { default: "Delete", loading: "Deleting..." };
  }, [activeAction]);

  const modalVariant = activeAction === "delete" ? "danger" : "primary";

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setActiveAction(null);
  };

  const handleConfirm = async () => {
    if (!activeAction || count === 0) {
      setActiveAction(null);
      return;
    }

    setIsSubmitting(true);

    const ids = [...selectedPageIds];
    let successCount = 0;
    let failureCount = 0;

    for (const id of ids) {
      const pageInstance = pageStore.getPageById(id);
      if (!pageInstance) {
        failureCount += 1;
         
        continue;
      }

      try {
        if (activeAction === "archive") {
          if (!pageInstance.canCurrentUserArchivePage) {
            failureCount += 1;
             
            continue;
          }
          // archive only non-archived pages
          if (!pageInstance.archived_at) {
             
            await pageInstance.archive({ shouldSync: true });
          }
        } else if (activeAction === "restore") {
          // restore only archived pages
          if (pageInstance.archived_at) {
             
            await pageInstance.restore({ shouldSync: true });
          } else {
            failureCount += 1;
             
            continue;
          }
        } else if (activeAction === "delete") {
          if (!pageInstance.canCurrentUserDeletePage || !pageInstance.archived_at) {
            failureCount += 1;
             
            continue;
          }
           
          await pageStore.removePage({ pageId: id });
        }
        successCount += 1;
      } catch {
        failureCount += 1;
      }
    }

    if (successCount > 0) {
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success",
        message:
          activeAction === "archive"
            ? `${successCount} page(s) archived successfully.`
            : activeAction === "restore"
              ? `${successCount} page(s) restored successfully.`
              : `${successCount} page(s) deleted successfully.`,
      });
    }

    if (failureCount > 0) {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error",
        message:
          activeAction === "archive"
            ? "Some pages could not be archived. Please try again."
            : activeAction === "restore"
              ? "Some pages could not be restored. Please try again."
              : "Some pages could not be deleted. Please try again.",
      });
    }

    setIsSubmitting(false);
    setActiveAction(null);
    onClearSelection();
  };

  if (!showBar && !activeAction) return null;

  return (
    <>
      {showBar && (
        <div className="sticky top-0 left-0 z-[2] flex items-center justify-between gap-3 border-b border-subtle bg-surface-1 px-3.5 py-2">
          <span className="text-13 text-secondary">
            {count} page{count === 1 ? "" : "s"} selected
          </span>
          <div className="flex items-center gap-2">
            {!isArchivedTab && (
              <Button
                size="sm"
                variant="neutral-primary"
                onClick={() => {
                  setActiveAction("archive");
                }}
              >
                Archive
              </Button>
            )}
            {isArchivedTab && (
              <>
                <Button
                  size="sm"
                  variant="neutral-primary"
                  onClick={() => {
                    setActiveAction("restore");
                  }}
                >
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="error-outline"
                  onClick={() => {
                    setActiveAction("delete");
                  }}
                >
                  Delete
                </Button>
              </>
            )}
            <Button size="sm" variant="neutral-secondary" onClick={onClearSelection}>
              Clear selection
            </Button>
          </div>
        </div>
      )}

      <AlertModalCore
        isOpen={!!activeAction}
        handleClose={handleCloseModal}
        handleSubmit={() => {
          void handleConfirm();
        }}
        isSubmitting={isSubmitting}
        title={modalTitle}
        content={modalContent}
        primaryButtonText={primaryButtonText}
        variant={modalVariant}
      />
    </>
  );
});
