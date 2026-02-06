import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import type { TPageNavigationTabs } from "@plane/types";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// local imports
import { PagesListHeaderRoot } from "./header";
import { PagesListMainContent } from "./pages-list-main-content";
import { BulkActionToolbar } from "./list/bulk-action-toolbar";
import { BulkDeletePagesModal } from "./modals/bulk-delete-pages-modal";

type TPageView = {
  children: React.ReactNode;
  pageType: TPageNavigationTabs;
  projectId: string;
  storeType: EPageStoreType;
  workspaceSlug: string;
  enableSelection?: boolean;
};

export const PagesListView = observer(function PagesListView(props: TPageView) {
  const { children, pageType, projectId, storeType, workspaceSlug, enableSelection } = props;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pagesToDelete, setPagesToDelete] = useState<string[]>([]);
  // store hooks
  const { isAnyPageAvailable, fetchPagesList } = usePageStore(storeType);
  // fetching pages list
  useSWR(
    workspaceSlug && projectId && pageType ? `PROJECT_PAGES_${projectId}` : null,
    workspaceSlug && projectId && pageType ? () => fetchPagesList(workspaceSlug, projectId, pageType) : null
  );

  const handleBulkDelete = (pageIds: string[]) => {
    setPagesToDelete(pageIds);
    setDeleteModalOpen(true);
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalOpen(false);
    setPagesToDelete([]);
  };

  // pages loader
  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col">
      {/* tab header */}
      {isAnyPageAvailable && (
        <PagesListHeaderRoot
          pageType={pageType}
          projectId={projectId}
          storeType={storeType}
          workspaceSlug={workspaceSlug}
          enableSelection={enableSelection}
          onToggleSelection={() => {}}
        />
      )}
      <PagesListMainContent pageType={pageType} storeType={storeType}>
        {children}
      </PagesListMainContent>
      {enableSelection && (
        <>
          <BulkActionToolbar pageType={pageType} storeType={storeType} onBulkDelete={handleBulkDelete} />
          <BulkDeletePagesModal
            isOpen={deleteModalOpen}
            onClose={handleCloseDeleteModal}
            pageIds={pagesToDelete}
            storeType={storeType}
          />
        </>
      )}
    </div>
  );
});
