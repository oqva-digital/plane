import { useState } from "react";
import { observer } from "mobx-react";
import { AlertTriangle } from "lucide-react";
import { Button, TOAST_TYPE, setToast } from "@plane/ui";
// components
import { EModalPosition, EModalWidth, ModalCore } from "@/components/core";
// hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";

type TBulkDeletePagesModal = {
  isOpen: boolean;
  onClose: () => void;
  pageIds: string[];
  storeType: EPageStoreType;
};

export const BulkDeletePagesModal = observer(function BulkDeletePagesModal(props: TBulkDeletePagesModal) {
  const { isOpen, onClose, pageIds, storeType } = props;
  const [isDeleting, setIsDeleting] = useState(false);
  // store hooks
  const { bulkDeletePages } = usePageStore(storeType);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await bulkDeletePages(pageIds);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Success!",
        message: `${pageIds.length} ${pageIds.length === 1 ? "page" : "pages"} deleted successfully.`,
      });
      onClose();
    } catch (error) {
      console.error("Failed to delete pages:", error);
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Error!",
        message: "Failed to delete pages. Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={onClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-500/10">
            <AlertTriangle className="h-6 w-6 text-red-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold">Delete {pageIds.length} {pageIds.length === 1 ? "page" : "pages"}?</h3>
            <p className="mt-2 text-sm text-text-secondary">
              Are you sure you want to permanently delete {pageIds.length === 1 ? "this page" : "these pages"}? This
              action cannot be undone.
            </p>
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="neutral-primary" size="sm" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDelete} loading={isDeleting}>
            Delete {pageIds.length === 1 ? "page" : "pages"}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
