import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import { observer } from "mobx-react";
import { Button } from "@plane/propel/button";
import type { TIssueServiceType, ICustomSearchSelectOption, TPage } from "@plane/types";
import { CustomSearchSelect, ModalCore } from "@plane/ui";
import { ProjectPageService } from "@/services/page";

type AddPageModalProps = {
  isOpen: boolean;
  handleClose: () => void;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  onAddLinks: (pages: { url: string; title: string }[]) => Promise<void>;
  existingLinkUrls: string[];
  issueServiceType: TIssueServiceType;
};

const projectPageService = new ProjectPageService();

function normalizeUrlForComparison(url: string): string {
  try {
    if (url.startsWith("http")) {
      const parsed = new URL(url);
      return parsed.pathname;
    }
    return url.startsWith("/") ? url : `/${url}`;
  } catch {
    return url;
  }
}

export const AddPageModal = observer(function AddPageModal(props: AddPageModalProps) {
  const { isOpen, handleClose, workspaceSlug, projectId, onAddLinks, existingLinkUrls } = props;

  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);

  const { data: pages = [], isLoading } = useSWR<TPage[]>(
    isOpen && workspaceSlug && projectId ? `PROJECT_PAGES_ADD_LINK_${workspaceSlug}_${projectId}` : null,
    () => projectPageService.fetchAll(workspaceSlug, projectId),
    { revalidateOnFocus: false }
  );

  const filteredPages = useMemo(() => {
    const nonArchived = pages.filter((p) => !p.archived_at);
    const normalizedExisting = new Set(existingLinkUrls.map(normalizeUrlForComparison));
    return nonArchived.filter((page) => {
      const pagePath = `/${workspaceSlug}/projects/${projectId}/pages/${page.id}`;
      const pageUrl = typeof window !== "undefined" ? `${window.location.origin}${pagePath}` : pagePath;
      const normalizedPage = normalizeUrlForComparison(pageUrl);
      return !normalizedExisting.has(normalizedPage);
    });
  }, [pages, existingLinkUrls, workspaceSlug, projectId]);

  const options: ICustomSearchSelectOption[] = useMemo(
    () =>
      filteredPages.map((page) => ({
        value: page.id,
        query: page.name ?? "",
        content: page.name ?? "Untitled",
      })),
    [filteredPages]
  );

  const handleSubmit = useCallback(async () => {
    if (selectedPageIds.length === 0) return;
    const pagesToAdd = filteredPages
      .filter((p) => selectedPageIds.includes(p.id ?? ""))
      .map((page) => {
        const path = `/${workspaceSlug}/projects/${projectId}/pages/${page.id}`;
        const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : `https://example.com${path}`;
        return {
          url,
          title: page.name ?? "Untitled",
        };
      });
    await onAddLinks(pagesToAdd);
    setSelectedPageIds([]);
    handleClose();
  }, [selectedPageIds, filteredPages, workspaceSlug, projectId, onAddLinks, handleClose]);

  const handleCloseModal = useCallback(() => {
    setSelectedPageIds([]);
    handleClose();
  }, [handleClose]);

  return (
    <ModalCore isOpen={isOpen} handleClose={handleCloseModal}>
      <div className="space-y-5 p-5">
        <h3 className="text-h4-medium text-secondary">Add page as link</h3>
        <div className="mt-2 space-y-3">
          <span className="mb-2 block text-secondary text-14 font-medium">Select pages to add as links</span>
          {isLoading ? (
            <p className="text-placeholder italic py-2">Loading pages...</p>
          ) : filteredPages.length === 0 ? (
            <p className="text-placeholder italic py-2">No pages in this project</p>
          ) : (
            <CustomSearchSelect
              value={selectedPageIds}
              onChange={(val: string[] | null) => setSelectedPageIds(val ?? [])}
              options={options}
              multiple
              label={selectedPageIds.length > 0 ? `${selectedPageIds.length} page(s) selected` : "Select pages"}
              noResultsMessage="No matching pages"
              maxHeight="lg"
            />
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t-[0.5px] border-subtle px-5 py-4">
        <Button variant="secondary" size="lg" onClick={handleCloseModal}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => void handleSubmit()}
          disabled={selectedPageIds.length === 0 || isLoading}
        >
          Add link{selectedPageIds.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </ModalCore>
  );
});
