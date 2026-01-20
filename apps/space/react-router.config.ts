import type { Config } from "@react-router/dev/config";

// Inline to avoid importing @plane/utils at config load (packages may not be built yet)
const basePath = (() => {
  const b = (process.env.VITE_SPACE_BASE_PATH ?? "").trim();
  if (!b) return "/";
  const t = b.replace(/^\/+|\/+$/g, "");
  return t ? `/${t}/` : "/";
})();

export default {
  appDirectory: "app",
  basename: basePath,
  ssr: true,
} satisfies Config;
