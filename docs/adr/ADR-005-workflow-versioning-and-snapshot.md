# ADR-005: Workflow Definition Versioning & Immutability Snapshot

## Status
Accepted

## Context
Workflow definitions specify multi-step approval rules, conditional criteria, parallel policies, and designated approvers. Updating a master workflow definition must never retroactively alter active or historical memo approval chains.

## Decision
1. **Versioning**: `WorkflowDefinition` entities are parent templates. All actual step configurations belong to `WorkflowDefinitionVersion`.
2. **Immutable Active Versions**: Modifying an active workflow template creates a new `WorkflowDefinitionVersion` in `DRAFT` state. Only one version per scope/category can be `ACTIVE` at any given time.
3. **Submit Time Snapshot**: When a memo is submitted (`DRAFT` -> `SUBMITTED`), the system captures a frozen snapshot (`WorkflowInstance`) bound to the active `WorkflowDefinitionVersionId`. Future edits to master workflows do not impact running `WorkflowInstance` records.

## Consequences
- **Positive**: Guaranteed workflow audit integrity. Previous memos preserve historical approval chains exactly as executed.
- **Negative**: Requires version management UI and explicit activation transitions in Master Data workflows.
