import { StartOfWeekPreference } from "@/components/profile/start-of-week-preference";
import { BreakdownMaxTasksPreference } from "@/components/preferences/breakdown-max-tasks-preference";
import { ThemeSwitcher } from "./theme-switcher";

export const PREFERENCE_COMPONENTS = {
  theme: ThemeSwitcher,
  start_of_week: StartOfWeekPreference,
  breakdown_max_tasks: BreakdownMaxTasksPreference,
};
