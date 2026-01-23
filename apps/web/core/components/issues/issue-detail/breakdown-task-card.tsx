import { useState, useRef, useEffect, useCallback } from "react";
import { X } from "lucide-react";
// plane imports
import { ChevronDownIcon } from "@plane/propel/icons";
import { IconButton } from "@plane/propel/icon-button";
import { Checkbox, Badge, TextArea } from "@plane/ui";
// local imports
import type { TMockBreakdownTask } from "./breakdown-modal";

type Props = {
  task: TMockBreakdownTask;
  allTasks: TMockBreakdownTask[];
  isDependenciesExpanded: boolean;
  onToggleSelect: (id: string) => void;
  onUpdateTask: (id: string, field: "title" | "description", value: string) => void;
  onRemoveTask: (id: string) => void;
  onToggleDependencies: (id: string) => void;
};

export const BreakdownTaskCard = function BreakdownTaskCard(props: Props) {
  const { task, allTasks, isDependenciesExpanded, onToggleSelect, onUpdateTask, onRemoveTask, onToggleDependencies } =
    props;

  const [isEditing, setIsEditing] = useState(false);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editingContainerRef = useRef<HTMLDivElement>(null);
  const taskIdRef = useRef(task.id);
  const lastSyncedTaskRef = useRef({ id: task.id, title: task.title, description: task.description || "" });

  // Initialize state with task values
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDescription, setEditDescription] = useState(task.description || "");

  // Sync state when task changes (only when not editing)
  // Using a ref-based approach to avoid setState in render
  const syncTaskToState = useCallback(() => {
    if (!isEditing && lastSyncedTaskRef.current.id === task.id) {
      if (
        lastSyncedTaskRef.current.title !== task.title ||
        lastSyncedTaskRef.current.description !== (task.description || "")
      ) {
        setEditTitle(task.title);
        setEditDescription(task.description || "");
        lastSyncedTaskRef.current = { id: task.id, title: task.title, description: task.description || "" };
      }
    } else if (lastSyncedTaskRef.current.id !== task.id) {
      // Task changed completely
      setEditTitle(task.title);
      setEditDescription(task.description || "");
      lastSyncedTaskRef.current = { id: task.id, title: task.title, description: task.description || "" };
      taskIdRef.current = task.id;
    }
  }, [task.id, task.title, task.description, isEditing]);

  // Sync when task changes and not editing
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    syncTaskToState();
  }, [syncTaskToState]);

  // Handle clicks outside the editing area
  const handleSaveAndExit = useCallback(() => {
    if (!isEditing) return;

    // Save changes
    if (editTitle.trim() !== task.title) {
      onUpdateTask(task.id, "title", editTitle.trim());
    }
    if (editDescription.trim() !== (task.description || "")) {
      onUpdateTask(task.id, "description", editDescription.trim());
    }
    setIsEditing(false);
  }, [isEditing, editTitle, editDescription, task, onUpdateTask]);

  // Handle clicks outside the editing area - only when editing
  useEffect(() => {
    if (!isEditing) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if click is outside both textareas and the editing container
      const isOutsideTitle = !titleTextareaRef.current?.contains(target);
      const isOutsideDescription = !descriptionTextareaRef.current?.contains(target);
      const isOutsideContainer = !editingContainerRef.current?.contains(target);

      // If clicked outside all editing elements, save and exit
      if (isOutsideTitle && isOutsideDescription && isOutsideContainer) {
        // Use setTimeout to ensure this runs after any other click handlers
        setTimeout(() => {
          handleSaveAndExit();
        }, 0);
      }
    };

    // Use capture phase (true) to catch events before stopPropagation can prevent them
    document.addEventListener("mousedown", handleClickOutside, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
    };
  }, [isEditing, handleSaveAndExit]);

  // Auto-resize textareas
  useEffect(() => {
    if (isEditing) {
      if (titleTextareaRef.current) {
        titleTextareaRef.current.style.height = "auto";
        titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
      }
      if (descriptionTextareaRef.current) {
        descriptionTextareaRef.current.style.height = "auto";
        descriptionTextareaRef.current.style.height = `${descriptionTextareaRef.current.scrollHeight}px`;
      }
    }
  }, [isEditing, editTitle, editDescription]);

  const handleDoubleClickTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    // Focus on title after a small delay to ensure the textarea is rendered
    setTimeout(() => {
      titleTextareaRef.current?.focus();
    }, 0);
  };

  const handleDoubleClickDescription = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    // Focus on description after a small delay to ensure the textarea is rendered
    setTimeout(() => {
      descriptionTextareaRef.current?.focus();
    }, 0);
  };

  const handleBlur = (_field: "title" | "description") => {
    // Clear any existing timeout
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }

    // Use a timeout to check if both fields lost focus
    // This allows time for focus to move between fields
    blurTimeoutRef.current = setTimeout(() => {
      // Check if neither field is focused
      const isTitleFocused = document.activeElement === titleTextareaRef.current;
      const isDescriptionFocused = document.activeElement === descriptionTextareaRef.current;

      // Only exit if both fields lost focus AND we're still in editing mode
      if (isEditing && !isTitleFocused && !isDescriptionFocused) {
        handleSaveAndExit();
      }
    }, 200);
  };

  const handleFocus = () => {
    // Clear blur timeout when any field gets focus
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, field: "title" | "description") => {
    if (e.key === "Enter" && !e.shiftKey && field === "title") {
      e.preventDefault();
      descriptionTextareaRef.current?.focus();
    } else if (e.key === "Escape") {
      // Cancel editing and exit
      setEditTitle(task.title);
      setEditDescription(task.description || "");
      setIsEditing(false);
      // Clear blur timeout
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  const hasDependencies = task.dependencies && task.dependencies.length > 0;
  const dependencyTasks = hasDependencies ? allTasks.filter((t) => task.dependencies!.includes(t.id)) : [];

  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-custom-border-200 bg-custom-background-100 p-4 hover:border-custom-border-300 transition-colors"
      onClick={(e) => {
        // Only stop propagation if not in editing mode
        if (!isEditing) {
          e.stopPropagation();
        }
      }}
      onMouseDown={(e) => {
        // Only stop propagation if not in editing mode
        if (!isEditing) {
          e.stopPropagation();
        }
      }}
      onKeyDown={(e) => {
        // Only stop propagation if not in editing mode
        if (!isEditing && (e.key === "Enter" || e.key === " ")) {
          e.stopPropagation();
        }
      }}
      role={isEditing ? undefined : "button"}
      tabIndex={isEditing ? undefined : 0}
    >
      <div className="flex items-start gap-3">
        <div
          className="pt-0.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          role="none"
          tabIndex={-1}
        >
          <Checkbox
            checked={task.selected}
            onChange={() => onToggleSelect(task.id)}
            aria-label="Select task to create"
          />
        </div>

        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* Title and Description - Card style like KanbanIssueBlock */}
          {isEditing ? (
            <div ref={editingContainerRef} className="flex flex-col gap-2">
              <TextArea
                ref={titleTextareaRef}
                value={editTitle}
                onChange={(e) => {
                  setEditTitle(e.target.value);
                  if (titleTextareaRef.current) {
                    titleTextareaRef.current.style.height = "auto";
                    titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
                  }
                }}
                onBlur={() => handleBlur("title")}
                onFocus={handleFocus}
                onKeyDown={(e) => handleKeyDown(e, "title")}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Task title"
                className="w-full text-sm font-medium resize-none overflow-hidden border-custom-border-300 focus:border-custom-border-400"
              />
              <TextArea
                ref={descriptionTextareaRef}
                value={editDescription}
                onChange={(e) => {
                  setEditDescription(e.target.value);
                  if (descriptionTextareaRef.current) {
                    descriptionTextareaRef.current.style.height = "auto";
                    descriptionTextareaRef.current.style.height = `${descriptionTextareaRef.current.scrollHeight}px`;
                  }
                }}
                onBlur={() => handleBlur("description")}
                onFocus={handleFocus}
                onKeyDown={(e) => handleKeyDown(e, "description")}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="Add an optional description or acceptance criteria"
                className="w-full text-xs min-h-16 resize-none border-custom-border-300 focus:border-custom-border-400"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 cursor-text group/edit">
              <div
                className="w-full text-sm font-medium text-primary line-clamp-2 group-hover/edit:text-secondary transition-colors"
                onDoubleClick={handleDoubleClickTitle}
                title="Double click to edit title"
              >
                {task.title || "Untitled task"}
              </div>
              {task.description ? (
                <div
                  className="w-full text-xs text-secondary line-clamp-3 whitespace-pre-wrap"
                  onDoubleClick={handleDoubleClickDescription}
                  title="Double click to edit description"
                >
                  {task.description}
                </div>
              ) : (
                <div
                  className="w-full text-xs text-tertiary italic opacity-0 group-hover/edit:opacity-100 transition-opacity"
                  onDoubleClick={handleDoubleClickDescription}
                  title="Double click to add description"
                >
                  Double click to add description
                </div>
              )}
            </div>
          )}

          {/* Dependencies section - Expandable */}
          {hasDependencies && (
            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDependencies(task.id);
                }}
                className="flex items-center gap-1.5 text-xs text-secondary hover:text-primary transition-colors w-fit"
              >
                <ChevronDownIcon
                  className={`h-3.5 w-3.5 transition-transform ${isDependenciesExpanded ? "rotate-180" : ""}`}
                />
                <span className="font-medium">Dependencies ({task.dependencies!.length})</span>
              </button>
              {isDependenciesExpanded && dependencyTasks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-5">
                  {dependencyTasks.map((depTask) => (
                    <Badge key={depTask.id} variant="neutral" size="sm" className="text-xs font-normal cursor-default">
                      {depTask.title || `Task ${depTask.id}`}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Metadata badges - Bottom section like KanbanIssueBlock */}
          {(task.priority || task.estimated_hours || (task.tags && task.tags.length > 0)) && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {task.priority && (
                <Badge variant="primary" size="sm" className="text-xs">
                  Priority: {task.priority}
                </Badge>
              )}
              {task.estimated_hours && (
                <Badge variant="primary" size="sm" className="text-xs">
                  {task.estimated_hours}h estimated
                </Badge>
              )}
              {task.tags && task.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {task.tags.map((tag, idx) => (
                    <Badge key={idx} variant="primary" size="sm" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <IconButton
          variant="ghost"
          size="sm"
          icon={X}
          onClick={(e) => {
            e.stopPropagation();
            onRemoveTask(task.id);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="shrink-0 mt-0.5 text-custom-text-400 hover:text-danger-500"
          aria-label="Remove task"
        />
      </div>
    </div>
  );
};
