---
name: edx-api-field-contract-guard
description: Use this skill whenever a task touches an API contract in either direction—response fields, query/path parameters, request payloads, DTO/interface/type definitions, schemas, mock data, adapters, store mapping, UI rendering, field mismatches, edit round trips, or legacy API migration. It establishes endpoint-scoped field facts, resolves conflicting evidence, separates confirmed contracts from inferred business gaps, and blocks assumptions from entering production code or recommendations.
---

# API Field Contract Guard

## Core model: every field needs an identity card

A field is confirmed only inside a stated contract scope. Record its identity before using it:

- **Direction**: response, query, path, header, or request body.
- **Operation**: HTTP method plus endpoint, or GraphQL operation / RPC method.
- **Version and branch**: API version, success/error response, list/detail variant.
- **Condition**: role, tenant, feature flag, request option, status, or serializer branch.
- **Evidence**: source location and what that source actually proves.

A field confirmed for `GET /users/:id` is not automatically confirmed for `GET /users`; a request-body field is not automatically a response field. Missing scope means the field is only **局部确认** or **未确认**, not a global contract fact.

## Evidence model

Classify evidence by what it can prove instead of treating every source as equal:

1. **Declared contract**: OpenAPI/Swagger, proto, GraphQL schema, generated client type. Proves the declared contract for the matching operation and version.
2. **Runtime sample**: Network response, captured payload, integration trace. Proves that one scoped execution contained the field; it does not alone prove requiredness or universal availability.
3. **Output implementation**: controller serializer, response builder, GraphQL resolver projection. Proves what matching branches attempt to emit; inspect conditions and omissions.
4. **Local type declaration**: handwritten TypeScript interface, DTO, backend model. Treat as an implementation claim until its relationship to the transport contract is established.
5. **Test sample**: mock, fixture, snapshot. Proves test intent only; it cannot independently establish a production contract.

For each field, cite both the source and the strength of the conclusion. Prefer precise wording such as “该字段在 v2 OpenAPI 的 `GET /users/{id}` 200 响应中声明为 required” or “该字段仅在一份管理员响应样本中出现”。

## Conflict gate

When sources disagree, do not silently select a winner. First separate evidence by direction, operation, version, environment, response branch and condition. If the conflict remains:

1. List each source and its claim.
2. Mark the field **契约冲突**.
3. Keep it out of production types, shared mocks, normalize functions and core data flow.
4. State the smallest question and owner needed to resolve it.
5. Classify the impact: shared contract, isolated boundary, UI-only presentation, or documentation/reporting.
6. Block only the affected production path. Continue independent work and safe isolated delivery when it does not promote the field to a shared contract.

A field conflict blocks the whole operation only when proceeding could affect security, authorization, data integrity, billing, destructive or otherwise irreversible writes. Otherwise prefer an explicitly temporary adapter, feature-flagged or experimental path, UI-only placeholder, or gap report with a named replacement condition.

Examples of conflicts include OpenAPI omitting a runtime field, a DTO declaring what the serializer never emits, or a fixture containing a field absent from production responses.

## Required workflow

### 1. Identify contract direction and scope

Before discussing fields, state which contract surface is being examined:

```md
契约作用域
- direction: response
- operation: GET /v2/users/:id
- branch: 200 detail response
- condition: authenticated user
```

For edit round trips, audit both halves independently: the detail response used for display and the update request body used for submission. Same spelling does not prove the two directions share semantics.

**Completion criterion:** every field under discussion belongs to one explicit direction and scoped operation, or is marked scope-unknown.

### 2. Establish facts and evidence strength

Build a field ledger before code or recommendations:

```md
✅ 已确认字段
- `id`: string；direction = response；scope = GET /v2/users/:id 200；evidence = OpenAPI required property
- `name`: string | null；direction = response；scope = 同上；evidence = OpenAPI nullable property

⚠️ 局部确认或弱证据
- `avatarUrl`：仅在管理员响应样本出现；requiredness 与普通用户分支未知
```

Distinguish these absence semantics when evidence permits:

- required and non-null;
- required but nullable;
- optional / omitted;
- conditionally returned;
- absence semantics unknown.

**Completion criterion:** each field claim cites its source, strength, direction, scope and absence semantics; unresolved conflicts have passed through the conflict gate.

### 3. Separate business gaps

Data needed by the UI or workflow but absent from the scoped contract belongs in a gap report:

```md
❓ 业务需要但契约未确认的字段
- `avatarUrl`：用途 = 头像展示；推荐类型 = string；依据 = UserAvatar 需要图片地址；置信度 = 高
```

When naming is unknown, present candidates rather than promoting one to fact. For backend changes, include the interaction, direction, recommended field/type/example and reason.

**Completion criterion:** every business need is mapped to a confirmed field, a contract conflict, or an explicit gap.

### 4. Set the implementation boundary

Production code consumes only fields whose identity matches the current operation. Confirmed nullable or dirty fields may proceed to `assert-normalize-boundary`; contract confirmation is the fact layer, normalization is the structure layer.

Route the remaining cases deliberately:

- **Unconfirmed or conflicting field** → gap report; block only the dependent production contract path. If the dependency can be isolated, continue with a temporary adapter, feature-flagged/experimental path, or clearly fake UI placeholder.
- **UI scaffolding explicitly requested** → local story/demo/component placeholder with a visibly fake value and Chinese `TODO`/`FIXME` naming the replacement condition; do not treat the placeholder as API evidence.
- **Version coexistence** → isolate `Legacy`, `Experimental`, or versioned transport types behind an adapter; keep temporary fields out of the shared domain model and record their removal condition.

Example:

```ts
// FIXME: GET /v2/users/:id 尚未确认 avatarUrl；契约补齐后替换本地占位图
const placeholderAvatarUrl = '/images/avatar-placeholder.png';
```

Optional chaining and defaults are valid only after the field itself and its absence semantics are confirmed; they solve nullable data, not an unknown contract.

**Completion criterion:** every shared production access maps to a confirmed ledger entry; every unresolved field is either blocked at its affected contract boundary, deferred with a gap report, or isolated behind an explicitly temporary boundary with a removal condition.

### 5. Audit legacy migrations bidirectionally

When replacing an API:

1. Inventory old response fields consumed by rendering, selectors and stores.
2. Inventory old query/path/body fields used by requests.
3. Compare each direction with the new scoped contract.
4. Link missing fields to the exact UI, behavior or submission regression.
5. Choose an explicit outcome: restore contract, adapt a confirmed mapping, hide/defer behavior, revise product behavior, or use a removable local placeholder.

Equal-looking names are mappings only when the contract or adapter evidence confirms their semantics.

**Completion criterion:** every old consumed or submitted field has a new confirmed mapping or a named regression and owner.

## Required output

Use the relevant sections; omit empty branches rather than inventing content.

```md
## 契约作用域
- direction / operation / version / branch / condition

## ✅ 已确认字段
- field：type；absence semantics；evidence and strength

## ⚠️ 局部确认或契约冲突
- field：conflicting or limited evidence；blocking question；owner

## ❓ 业务需要但契约未确认的字段
- field：用途；推荐方向与类型；依据；置信度

## 实现边界
- 本次将实现、阻断、延后或局部占位的内容
```

If backend changes are needed, add:

| 业务交互场景 | 方向与作用域 | 建议新增/调整字段 | 推荐类型与示例值 | 为什么需要 |
| --- | --- | --- | --- | --- |
| 分页列表 | response · `GET /v2/orders` 200 | `totalCount` | `number`，如 `240` | 计算总页数 |
| 编辑提交 | request body · `PATCH /v2/orders/:id` | `status` | `'pending' \| 'success' \| 'failed'` | 提交状态变更 |

## Final self-check

- Every field claim has direction, operation scope and cited evidence strength.
- Runtime samples are not generalized into requiredness or universal availability.
- Local types and fixtures are not treated as production contracts without stronger linkage.
- Conflicting evidence is visible and unresolved dependencies remain blocked.
- Request and response contracts are audited separately, including edit round trips.
- Nullable/default handling begins only after field existence and absence semantics are confirmed.
- Legacy migrations account for every old consumed and submitted field.
- The final answer states what is implemented, blocked, deferred and intentionally left unassumed.