import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef } from "react";
// plane imports
import { EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import type { TPageNavigationTabs } from "@plane/types";
import { EUserProjectRoles } from "@plane/types";
// assets
import darkPagesAsset from "@/app/assets/empty-state/disabled-feature/pages-dark.webp?url";
import lightPagesAsset from "@/app/assets/empty-state/disabled-feature/pages-light.webp?url";
// components
import { PageHead } from "@/components/core/page-title";
import { DetailedEmptyState } from "@/components/empty-state/detailed-empty-state-root";
import { PageBulkOperationsRoot } from "@/components/pages/bulk-operations";
import { PagesListRoot } from "@/components/pages/list/root";
import { PagesListView } from "@/components/pages/pages-list-view";
// hooks
import { useMultipleSelectStore } from "@/hooks/store/use-multiple-select-store";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
import { useMultipleSelect } from "@/hooks/use-multiple-select";
// plane web hooks
import { EPageStoreType, usePageStore } from "@/plane-web/hooks/store";
import type { Route } from "./+types/page";

const getPageType = (pageType?: string | null): TPageNavigationTabs => {
  if (pageType === "private") return "private";
  if (pageType === "archived") return "archived";
  return "public";
};

function ProjectPagesPage({ params }: Route.ComponentProps) {
  // refs
  const containerRef = useRef<HTMLDivElement>(null);
  // router
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");
  const { workspaceSlug, projectId } = params;
  // theme hook
  const { resolvedTheme } = useTheme();
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { getProjectById, currentProjectDetails } = useProject();
  const { allowPermissions } = useUserPermissions();
  const { getCurrentProjectFilteredPageIdsByTab } = usePageStore(EPageStoreType.PROJECT);
  const { clearSelection } = useMultipleSelectStore();
  // derived values
  const project = getProjectById(projectId);
  const pageTitle = project?.name ? `${project?.name} - Pages` : undefined;
  const canPerformEmptyStateActions = allowPermissions([EUserProjectRoles.ADMIN], EUserPermissionsLevel.PROJECT);
  const resolvedPath = resolvedTheme === "light" ? lightPagesAsset : darkPagesAsset;
  const pageType = getPageType(type);
  const filteredPageIds = getCurrentProjectFilteredPageIdsByTab(pageType);

  // Create entities object for multi-select
  const entities = useMemo(
    () => ({
      default: filteredPageIds || [],
    }),
    [filteredPageIds]
  );

  // Multi-select hook
  const selectionHelpers = useMultipleSelect({
    containerRef,
    entities,
    disabled: false,
  });

  // Clear selection when switching tabs
  useEffect(() => {
    clearSelection();
  }, [pageType, clearSelection]);

  // No access to cycle
  if (currentProjectDetails?.page_view === false)
    return (
      <div className="flex items-center justify-center h-full w-full">
        <DetailedEmptyState
          title={t("disabled_project.empty_state.page.title")}
          description={t("disabled_project.empty_state.page.description")}
          assetPath={resolvedPath}
          primaryButton={{
            text: t("disabled_project.empty_state.page.primary_button.text"),
            onClick: () => {
              router.push(`/${workspaceSlug}/settings/projects/${projectId}/features`);
            },
            disabled: !canPerformEmptyStateActions,
          }}
        />
      </div>
    );
  return (
    <>
      <PageHead title={pageTitle} />
      <div ref={containerRef} className="h-full w-full overflow-hidden">
        <PagesListView
          pageType={pageType}
          projectId={projectId}
          storeType={EPageStoreType.PROJECT}
          workspaceSlug={workspaceSlug}
        >
          <PageBulkOperationsRoot
            selectionHelpers={selectionHelpers}
            pageType={pageType}
          />
          <PagesListRoot
            pageType={pageType}
            storeType={EPageStoreType.PROJECT}
            selectionHelpers={selectionHelpers}
          />
        </PagesListView>
      </div>
    </>
  );
}

export default observer(ProjectPagesPage);
