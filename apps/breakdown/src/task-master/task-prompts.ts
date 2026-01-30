/**
 * Centralized prompts for task generation.
 * This file contains the default prompts used for both breakdown and expand operations.
 */

/**
 * Default prompt for detailed task generation.
 * This prompt instructs the AI to generate more specific and detailed tasks,
 * including information about implementation, testing, and dependencies.
 */
export const DEFAULT_TASK_GENERATION_PROMPT = `MANDATORY: Generate EXTREMELY DETAILED, self-contained tasks. Extract ALL relevant information from the PRD and include it directly in each task.

REQUIREMENTS FOR EACH TASK:

1. Description:
   - WHAT needs to be implemented and WHY (from PRD context)
   - Extract and include ALL relevant PRD specifications:
     * Design specs: exact colors (hex codes), dimensions, fonts, spacing, layout measurements
     * UI/UX: interactions, animations, responsive breakpoints
     * Technical: API endpoints, request/response formats, data models, field names, validation rules
     * Business rules and constraints from PRD
     * Performance and security requirements
   - Technical context and architecture decisions

2. Details (MANDATORY - comprehensive field):
   - Extract and include EXACT values from the PRD (ONLY use values actually mentioned in the PRD, do NOT invent or use example values):
     * Colors: extract the exact hex codes or design tokens mentioned in the PRD
     * Dimensions: extract the exact sizes, spacing, and measurements specified in the PRD
     * Typography: extract the exact font families, sizes, and weights specified in the PRD
     * API specifications: extract the exact endpoints, request body structure, response format, and status codes from the PRD
     * Data models: extract the exact field names, types, constraints, and validation rules from the PRD
     * Business logic: extract the exact rules, calculations, and conditions from the PRD
   - Specific files/components/modules to create or modify
   - Step-by-step implementation approach
   - Edge cases and error handling
   - Performance and security considerations

3. Test Strategy:
   - Test types (unit, integration, E2E, performance)
   - Specific test cases covering PRD requirements
   - Acceptance criteria based on PRD specifications

CRITICAL RULES:
- ALWAYS extract relevant information from the PRD and include it directly in the task
- ONLY use values, specifications, and details that are explicitly mentioned in the PRD
- DO NOT invent or use example values - if the PRD doesn't specify a color, dimension, or other detail, do not include it
- Every PRD specification (colors, dimensions, APIs, validation rules, business logic) MUST appear in the task description or details
- Tasks must be detailed enough that a developer can implement them WITHOUT needing to consult the PRD or any other document
- Be specific: include exact values, measurements, codes, and specifications ONLY from the PRD
- The task should be self-contained with all necessary information for implementation`;

/**
 * Gets the prompt to be used for task generation.
 * If a custom prompt is provided, it will be used.
 * Otherwise, returns the default prompt.
 *
 * @param customPrompt - Optional custom prompt
 * @returns The prompt to be used
 */
export function getTaskGenerationPrompt(customPrompt?: string): string {
  return customPrompt?.trim() || DEFAULT_TASK_GENERATION_PROMPT;
}
