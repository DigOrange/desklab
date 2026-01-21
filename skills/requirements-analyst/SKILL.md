---
name: requirements-analyst
description: OOA-based requirements analysis for the DeskLab project. Use when asked to clarify or document requirements, model actors/use cases, create or update `docs/需求规格说明书.md`, and create or maintain RTM tracking (e.g., `docs/00_RTM.md` or `docs/RTM.md`).
---

# Requirements Analyst

## Overview

Analyze product requirements using object-oriented analysis (OOA) tailored to DeskLab.
Clarify ambiguous requirements before drafting the specification.
Create a requirements specification and RTM with full traceability between use cases and requirements.

## Workflow (OOA-driven)

1. Scope the request.
   - Confirm whether the scope is product-wide or module-specific.
   - Read relevant docs when needed: `docs/requirements.md`, `docs/工作流程.md`, `docs/ooa-analysis.md`, and any module docs under `docs/01_analysis/`.

2. Clarify unclear requirements.
   - Ask targeted questions for missing inputs, outputs, constraints, success criteria, exception flows, priorities, and dependencies.
   - Do not proceed with drafting until core ambiguities are resolved; record unresolved items explicitly.

3. Model with OOA.
   - Identify actors, domain objects, and system boundaries.
   - Define use cases with preconditions, main flow, exception flow, and acceptance criteria (AC).
   - Map each use case to requirement IDs.

4. Draft or update the requirements specification.
   - Create or update `docs/需求规格说明书.md` unless the user specifies another location.
   - Keep IDs consistent with existing documents; continue numbering if IDs already exist.

5. Create or update RTM.
   - If `docs/00_RTM.md` exists, update it; otherwise create `docs/RTM.md`.
   - Track every requirement and use case with traceability to AC and documentation.

6. Review and confirm.
   - Summarize decisions and open questions.
   - Ask for confirmation on scope, priorities, and any assumptions.

## Requirements Spec Structure (docs/需求规格说明书.md)

Use this minimal structure unless the user provides a specific template:

- 1. 概述（目标、范围、术语）
- 2. 参与者与系统边界（Actors + 假设/限制）
- 3. 用例清单（UC-xx 与简述）
- 4. 功能需求（REQ-F-xxx + AC）
- 5. 非功能需求（REQ-N-xxx + AC）
- 6. 约束与范围外（Out of Scope）
- 7. 验收要点（与 AC 对齐）
- 8. 未决问题（待澄清项）

## RTM Structure (docs/00_RTM.md or docs/RTM.md)

Preserve any existing RTM format. If creating new, include at least:

- 需求列表表格：`ID | 模块 | 功能 | 优先级 | 审计状态 | 开发进度 | AC | 关联用例`
- 用例列表表格：`UC-ID | 用例名称 | 关联需求`
- 变更日志：`CR-ID | 需求ID | 变更描述 | 影响面 | 状态`
- 审计流水：`日期 | 对象 | 类型 | 结论 | 审计人 | 备注`
- 阻塞问题（如有）：`问题ID | 需求(AC) | 描述 | 复现步骤 | 尝试方案 | 状态`

## ID Rules

- Use existing ID conventions if present (`REQ-F-xxx`, `REQ-N-xxx`, `UC-xx`, `AC-x`).
- Keep IDs stable; do not renumber existing items.
- Ensure every requirement and use case appears in RTM.

## Clarification Rules

- Ask for missing inputs before drafting: scope, target users, success criteria, constraints, edge cases, and priority.
- Keep questions short and grouped by topic.
- Record unresolved items in the spec and RTM; do not invent requirements.
