import { useState } from "react";
import { observer } from "mobx-react";
import { Archive, Trash2 } from "lucide-react";
import { Button, TOAST_TYPE, setToast } from "@plane/ui";
// hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// types
import type { TPageNavigationTabs } from "@plane/types";

type TBulkActionToolbar = {
  pageType: TPageNavigationTabs;
  storeType: EPageStoreType;
  onBulkDelete: (pageIds: string[]) => void;
};

export const BulkActionToolbar = observer(function BulkActionToolbar(props: TBulkActionToolbar) {
  const { pageType, storeType, onBulkDelete } = props;
  const [isArchiving, setIsArchiving] = useState(false);
  // store hooks
  const pageStore = usePageStore(storeType);
  const { selectedPageIds, bulkArchivePages, clearSelection } = pageStore;

  const selectedCount = selectedPageIds.size;

  if (selectedCount === 0) return null;

  const handleBulkArchive = async () => {
    try {
      setIsArchiving(true);
      const pageIdsArray = Array.from(selectedPageIds);
      await bulkArchivePages(pageIdsArray);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: `${pageIdsArray.length} ${pageIdsArray.length === 1 ? "page" : "pages"} archived successfully.`,
      });
    } catch (error) {
      console.error("Failed to archive pages:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to archive pages. Please try again.",
      });
    } finally {
      setIsArchiving(false);
    }
  };

  const handleBulkDeleteClick = () => {
    const pageIdsArray = Array.from(selectedPageIds);
    onBulkDelete(pageIdsArray);
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-base px-4 py-3 shadow-lg">
        <span className="text-sm text-text-secondary">
          {selectedCount} {selectedCount === 1 ? "page" : "pages"} selected
        </span>
        <div className="h-4 w-px bg-border-subtle" />
        {pageType === "archived" ? (
          <Button variant="danger" size="sm" onClick={handleBulkDeleteClick} prependIcon={<Trash2 />}>
            Delete
          </Button>
        ) : (
          <Button variant="neutral-primary" size="sm" onClick={handleBulkArchive} loading={isArchiving} prependIcon={<Archive />}>
            Archive
          </Button>
        )}
        <Button variant="outline-primary" size="sm" onClick={clearSelection}>
          Cancel
        </Button>
      </div>
    </div>
  );
});
