# Refactoring Summary

## Frontend Components

- Extracted `SelectedFilesList`, `AgentMentionsDropdown`, and `SuggestionChip` from monolithic components.
- Refactored `ChatInput.tsx` to use the new extracted components, improving readability and maintainability.
- Memoized `ChatMessage.tsx` and `StreamingMessage.tsx` using `React.memo` and `useMemo` to prevent unnecessary re-renders during high-frequency streaming updates.

## Backend / Orchestration

- **Split Orchestrator Service**: Decomposed `service.ts` into specialized modules:
  - `constants.ts`: Centralized configuration for tool timeouts, agent prompts, and confirmation rules.
  - `context-builder.ts`: Logic for constructing system prompts and fetching memory/document context.
  - `agent-runner.ts`: Unified logic for agent tool execution, including timeouts, error handling, and classification.
- **Improved Maintainability**: The main `service.ts` file is now significantly smaller and focused solely on the orchestration flow (routing, generating responses, managing streams).

## Verification

- Ran `npm run typecheck` to ensure no regression in type safety. (Exit Code: 0)
