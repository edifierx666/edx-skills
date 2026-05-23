---
name: api-field-contract-guard
description: Use this skill whenever a task touches API response fields, DTO/interface/type definitions, mock data, transformers/adapters, store data mapping, UI rendering from backend data, or questions like “接口返回了哪些字段”, “这个字段为什么为空”, “还需要后端补什么字段”, “根据接口改页面”, “字段对不上”, or “迁移/重构旧接口”. This skill prevents hallucinated API fields, separates confirmed facts from inferred gaps, and requires a field-source and gap-report workflow before code or recommendations.
version: "1.0.0"
---

# API Field Contract Guard

## Purpose

Use this skill to keep interface-driven work grounded in evidence. The model should treat API fields like a contract: confirmed fields can enter code and types; inferred fields can enter a gap report; unknown fields must not be silently used, defaulted, or mocked as if they were real.

## Core rule

API fields must be evidence-backed. Business needs may be inferred, but inference must stay visibly separate from confirmed facts and must not become production code, formal DTOs, or authoritative documentation until the contract is confirmed.

## Trigger checklist

Apply this workflow when the task involves any of these:

- Reading, explaining, or modifying API response fields.
- Creating or changing TypeScript `interface`, `type`, DTO, GraphQL/proto/OpenAPI schema, or backend response model.
- Writing mock data, fixtures, adapters, transformers, normalizers, stores, selectors, or UI rendering based on backend data.
- Debugging empty UI values, field mismatches, missing list columns, pagination totals, status badges, search/filter params, edit-detail round trips, or legacy API migration.
- Answering whether an interface “returns” a field or what backend fields are needed to implement a feature.

## Evidence hierarchy

Before treating a field as real, locate at least one source:

1. Real response: Network panel, response log, captured payload, integration fixture.
2. Contract: Swagger/OpenAPI, proto, GraphQL schema.
3. Type source: TypeScript interface, DTO, backend model, generated client type.
4. Mock source: maintained mock file or test fixture.
5. Backend source: controller/service serializer, query projection, response builder.

If none of these confirms a field, call it “未确认”, “待确认”, or “[推测]”. Do not call it “接口返回了”.

## Required workflow

### 1. Establish field facts first

Before writing code or making a recommendation, list what is confirmed and where it came from.

Use precise wording:

```md
✅ 接口已确认返回的字段（来源：IUserResponse 类型定义）
- `id`: string
- `name`: string
```

Avoid vague wording like “应该有”, “一般会有”, or “后端会返回”.

### 2. Separate inferred business gaps

If the UI or business logic needs data not found in the contract, list it separately.

```md
❓ 业务需要但接口未确认的字段（推测，需后端确认）
- `avatarUrl`：用途 = 用户头像展示；推荐类型 = string；依据 = UserAvatar 需要图片地址；置信度 = 高
```

When naming is uncertain, offer candidates instead of choosing one as fact:

```md
头像字段命名待确认：`avatarUrl` / `avatar_url` / `profileImageUrl`。
```

### 3. Explicitly constrain what code will not assume

State the negative boundary before implementation or final recommendation:

```md
🚫 本次不假设存在的字段
- 未列入“已确认返回”的字段，代码中不直接访问。
- 推测字段只进入缺口报告，不进入正式类型、Mock 或核心数据流。
```

### 4. Implement with zero-assumption discipline

In code:

- Access only confirmed fields.
- Treat optional fields as optional only when the contract says they are optional.
- Do not use similar-looking names as substitutes, such as `uuid` for `userId`, unless the contract confirms the mapping.
- Do not add unconfirmed fields to DTOs, generated types, mock data, or docs to make code convenient.
- Do not use optional chaining or default values to hide an unconfirmed field.

Bad pattern:

```ts
const avatar = user?.avatarUrl ?? defaultAvatar;
const status = item.status ?? 'active';
```

Why it is bad: if `avatarUrl` or `status` is not contract-confirmed, the code turns “unknown contract” into “known field with fallback”.

Safer pattern:

```ts
// TODO[字段待确认]: avatarUrl 未在接口契约中确认，当前不渲染头像区域
const shouldRenderAvatar = false;
```

### 5. Keep placeholders local and removable

If the user explicitly wants UI scaffolding before the backend contract is ready:

- Keep placeholder data local to the component/story/demo.
- Use a visibly fake constant or placeholder value.
- Add a short Chinese `TODO` or `FIXME` explaining the missing field and replacement condition.
- Do not add the placeholder as a real API field or shared type.

Example:

```ts
// FIXME: 接口未返回 avatarUrl，当前仅使用本地占位图；后端补齐后改为读取真实字段
const placeholderAvatarUrl = '/images/avatar-placeholder.png';
```

### 6. Audit legacy migrations for regressions

When replacing or refactoring old API logic:

1. List fields consumed by the old code.
2. Compare them with fields confirmed in the new contract.
3. Identify missing fields and the UI/behavior that will regress.
4. Recommend one of: restore backend field, hide/defer UI, revise product behavior, or add a clearly marked temporary placeholder.

Use this format:

```md
旧逻辑字段缺口：
- `creatorName`：旧列表用于展示创建人，新接口未确认返回；移除后会导致创建人列无法展示。
- `lastLoginTime`：旧详情页用于展示最后登录时间，新接口未确认返回；移除后该信息会退化为空。
```

## Required output template

For any API-field-related implementation plan, code modification summary, or answer about field availability, include this structure when field facts are relevant:

```md
✅ 接口已确认返回的字段（来源：xxx）
- field1: string
- field2: number

❓ 业务需要但接口未确认的字段（推测，需后端确认）
- extraField：用途 = xxx；推荐类型 = xxx；依据 = xxx；置信度 = 高/中/低

🚫 本次不假设存在的字段
- 凡未列入“已确认返回”的字段，代码中不直接访问。
- 推测字段只进入缺口报告，不进入正式类型或核心数据流。
```

If backend changes are needed, add this table:

| 业务交互场景 | 建议新增/调整字段 | 推荐类型与示例值 | 为什么需要 |
| --- | --- | --- | --- |
| 分页加载列表 | `totalCount` | `number`，如 `240` | 分页器需要计算总页数，仅有当前页 list 不够 |
| 状态徽章展示 | `status` | `'pending' \| 'success' \| 'failed'` | 避免解析文案或 message 来判断颜色 |
| 编辑页回显 | `id` | `string`，如 `"129845"` | 跳转详情和提交更新需要稳定主键 |

## Self-check before finishing

Before finalizing, verify:

- Every field called “returned by the API” has a cited source.
- Confirmed fields and inferred fields are separated.
- No unconfirmed `data.xxx` / `item.yyy` access was introduced.
- Optional chaining or default values are not hiding an unconfirmed contract.
- Temporary placeholders are local and marked with Chinese TODO/FIXME.
- Legacy migrations call out missing fields and resulting regressions.
- The final answer states what changed and what was intentionally not assumed.
