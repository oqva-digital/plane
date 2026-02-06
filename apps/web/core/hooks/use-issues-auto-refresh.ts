import { useEffect } from "react";

const DEFAULT_POLLING_INTERVAL_MS = 15000;

type UseIssuesAutoRefreshParams = {
  /**
   * Função que executa o refresh dos issues em background (sem mostrar loading).
   * Deve usar fetchIssuesWithExistingPagination ou fetchIssues com "background-refresh".
   */
  refreshFn: () => void | Promise<void>;
  /**
   * Habilita/desabilita o auto-refresh.
   */
  enabled?: boolean;
  /**
   * Intervalo de polling em ms (ex.: 15000 = 15s). Só roda quando a aba está visível.
   * Default 15s. O hook só está ativo enquanto estiver na página de work items (qualquer layout).
   */
  pollingIntervalMs?: number;
};

/**
 * Refresh de issues em background (sem loading/skeleton):
 * - Ao voltar para a aba (visibility/focus)
 * - A cada N segundos (polling) enquanto estiver na página de work items e aba visível.
 * Só ativo quando o componente está montado (ou seja, só na página de issues).
 */
export const useIssuesAutoRefresh = ({
  refreshFn,
  enabled = true,
  pollingIntervalMs = DEFAULT_POLLING_INTERVAL_MS,
}: UseIssuesAutoRefreshParams) => {
  useEffect(() => {
    if (!enabled) return;

    if (typeof window === "undefined" || typeof document === "undefined") return;

    const runRefresh = () => {
      if (document.visibilityState !== "visible") return;
      void refreshFn();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") runRefresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);

    const intervalMs = pollingIntervalMs > 0 ? pollingIntervalMs : DEFAULT_POLLING_INTERVAL_MS;
    const intervalId = window.setInterval(runRefresh, intervalMs);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
    };
  }, [enabled, pollingIntervalMs, refreshFn]);
};
