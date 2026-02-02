const BREAKDOWN_MAX_TASKS_KEY = "breakdown_max_tasks";
const DEFAULT_MAX_TASKS = 5;
const MIN_MAX_TASKS = 5;
const MAX_MAX_TASKS = 50;

// Helper functions to manage localStorage
export const getBreakdownMaxTasks = (): number => {
  if (typeof window === "undefined") return DEFAULT_MAX_TASKS;
  const stored = localStorage.getItem(BREAKDOWN_MAX_TASKS_KEY);
  if (!stored) return DEFAULT_MAX_TASKS;
  const parsed = parseInt(stored, 10);
  if (isNaN(parsed) || parsed < MIN_MAX_TASKS || parsed > MAX_MAX_TASKS) {
    return DEFAULT_MAX_TASKS;
  }
  return parsed;
};

export const setBreakdownMaxTasks = (value: number): void => {
  if (typeof window === "undefined") return;
  if (value < MIN_MAX_TASKS || value > MAX_MAX_TASKS) {
    console.warn(`Invalid max_tasks value: ${value}. Must be between ${MIN_MAX_TASKS} and ${MAX_MAX_TASKS}`);
    return;
  }
  localStorage.setItem(BREAKDOWN_MAX_TASKS_KEY, value.toString());
};

export const DEFAULT_MAX_TASKS_VALUE = DEFAULT_MAX_TASKS;
export const MIN_MAX_TASKS_VALUE = MIN_MAX_TASKS;
export const MAX_MAX_TASKS_VALUE = MAX_MAX_TASKS;
