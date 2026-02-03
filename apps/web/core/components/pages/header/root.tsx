import { useCallback } from "react";
import { observer } from "mobx-react";
import { ListFilter } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TPageFilterProps, TPageNavigationTabs } from "@plane/types";
import { Header, EHeaderVariant } from "@plane/ui";
import { calculateTotalFilters } from "@plane/utils";
// components
import { FiltersDropdown } from "@/components/issues/issue-layouts/filters";
import { DOCUMENT_TYPE_OTHER } from "@/components/common/filters/document-type-constants";
// hooks
import { useMember } from "@/hooks/store/use-member";
// plane web hooks
import type { EPageStoreType } from "@/plane-web/hooks/store";
import { usePageStore } from "@/plane-web/hooks/store";
// local imports
import { PageAppliedFiltersList } from "../list/applied-filters";
import { PageFiltersSelection } from "../list/filters";
import { PageOrderByDropdown } from "../list/order-by";
import { PageSearchInput } from "../list/search-input";
import { PageTabNavigation } from "../list/tab-navigation";

type Props = {
  pageType: TPageNavigationTabs;
  projectId: string;
  storeType: EPageStoreType;
  workspaceSlug: string;
};

export const PagesListHeaderRoot = observer(function PagesListHeaderRoot(props: Props) {
  const { pageType, projectId, storeType, workspaceSlug } = props;
  const { t } = useTranslation();
  // store hooks
  const pageStore = usePageStore(storeType);
  const { filters, updateFilters, clearAllFilters } = pageStore;
  const {
    workspace: { workspaceMemberIds },
  } = useMember();

  // Derived from store.data without useMemo so MobX reactivity works: pageStore.data
  // is mutated in place, so the reference never changes and useMemo would keep stale values.
  const workItems = (() => {
    const seen = new Set<string>();
    return Object.values(pageStore.data ?? {}).reduce<{ id: string; name: string }[]>((acc, p) => {
      if (p.work_item_id && p.work_item_name && !seen.has(p.work_item_id)) {
        seen.add(p.work_item_id);
        acc.push({ id: p.work_item_id, name: p.work_item_name });
      }
      return acc;
    }, []);
  })();

  const documentTypeOptions = (() => {
    const fromPages = new Set<string>();
    Object.values(pageStore.data ?? {}).forEach((p) => {
      if (p.document_type?.trim()) fromPages.add(p.document_type.trim());
    });
    const sorted = Array.from(fromPages).sort();
    return [...sorted, DOCUMENT_TYPE_OTHER];
  })();

  const handleRemoveFilter = useCallback(
    (key: keyof TPageFilterProps, value: string | null) => {
      let newValues = filters.filters?.[key];

      if (key === "favorites") newValues = !!value;
      if (Array.isArray(newValues)) {
        if (!value) newValues = [];
        else newValues = newValues.filter((val) => val !== value);
      }

      updateFilters("filters", { ...(filters.filters ?? {}), [key]: newValues });
    },
    [filters.filters, updateFilters]
  );

  const isFiltersApplied = calculateTotalFilters(filters?.filters ?? {}) !== 0;

  return (
    <>
      <Header variant={EHeaderVariant.SECONDARY}>
        <Header.LeftItem>
          <PageTabNavigation workspaceSlug={workspaceSlug} projectId={projectId} pageType={pageType} />
        </Header.LeftItem>
        <Header.RightItem className="items-center">
          <PageSearchInput
            searchQuery={filters.searchQuery}
            updateSearchQuery={(val) => updateFilters("searchQuery", val)}
          />
          <PageOrderByDropdown
            sortBy={filters.sortBy}
            sortKey={filters.sortKey}
            onChange={(val) => {
              if (val.key) updateFilters("sortKey", val.key);
              if (val.order) updateFilters("sortBy", val.order);
            }}
          />
          <FiltersDropdown
            icon={<ListFilter className="h-3 w-3" />}
            title={t("common.filters")}
            placement="bottom-end"
            isFiltersApplied={isFiltersApplied}
          >
            <PageFiltersSelection
              filters={filters}
              handleFiltersUpdate={updateFilters}
              memberIds={workspaceMemberIds ?? undefined}
              workItems={workItems}
              documentTypeOptions={documentTypeOptions}
            />
          </FiltersDropdown>
        </Header.RightItem>
      </Header>
      {calculateTotalFilters(filters?.filters ?? {}) !== 0 && (
        <Header variant={EHeaderVariant.TERNARY}>
          <PageAppliedFiltersList
            appliedFilters={filters.filters ?? {}}
            handleClearAllFilters={clearAllFilters}
            handleRemoveFilter={handleRemoveFilter}
            alwaysAllowEditing
            workItems={workItems}
          />
        </Header>
      )}
    </>
  );
});
