import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// 只读取约定文档；测试通过内存副本注入缺陷，不修改工作区。
export function loadDocuments(root = defaultRoot) {
  const files = new Map();
  for (const dir of ['', 'roles', 'references']) {
    for (const item of readdirSync(resolve(root, dir), { withFileTypes: true })) {
      if (item.isFile() && item.name.endsWith('.md') && !(dir === 'roles' && item.name.startsWith('.'))) {
        const key = dir ? `${dir}/${item.name}` : item.name;
        files.set(key, readFileSync(resolve(root, key), 'utf8'));
      }
    }
  }
  return files;
}

function markdownTable(text, firstHeader) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith('|')) continue;
    const headers = lines[i].slice(1, -1).split('|').map(cell => cell.trim());
    if (!headers.includes(firstHeader)) continue;
    const rows = [];
    for (let j = i + 2; j < lines.length && lines[j].startsWith('|'); j += 1) {
      const cells = lines[j].slice(1, -1).split('|').map(cell => cell.trim());
      if (cells.every(cell => /^:?-{3,}:?$/.test(cell)) || cells.join('|') === headers.join('|')) continue;
      rows.push({ cells, line: lines[j] });
    }
    return { headers, rows };
  }
  return null;
}

const cellValue = value => value?.replaceAll('`', '').trim() ?? '';

export function validateDocuments(files) {
  const errors = [];
  const fail = (code, message) => errors.push(`${code}: ${message}`);
  const skill = files.get('SKILL.md') ?? '';
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)^---\s*(?:\r?\n|$)/m)?.[1] ?? '';
  const name = frontmatter.match(/^name:\s*(.*?)\s*$/m)?.[1];
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) fail('frontmatter', 'name 必须是小写字母、数字与连字符组成的有效标识');
  if (Buffer.byteLength(skill, 'utf8') > 15000) fail('skill-size', 'SKILL.md 必须不超过 15000 bytes');

  const roleTable = markdownTable(skill, '角色');
  const routeTable = markdownTable(skill, '默认模型意图');
  const indexedRoles = [];
  if (!roleTable) {
    fail('role-index', 'SKILL.md 缺少角色索引表');
  } else {
    for (const header of ['角色', '文件', '路由键', 'Ownership']) {
      if (!roleTable.headers.includes(header)) fail('role-index', `角色索引缺少列：${header}`);
    }
    const fileColumn = roleTable.headers.indexOf('文件');
    const routeColumn = roleTable.headers.indexOf('路由键');
    for (const row of roleTable.rows) {
      const rolePath = cellValue(row.cells[fileColumn]);
      const route = cellValue(row.cells[routeColumn]);
      if (!/^roles\/[^/.][^/]*\.md$/.test(rolePath) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(route)) {
        fail('role-index', `角色索引需要有效文件路径与路由键：${row.line}`);
        continue;
      }
      indexedRoles.push({ path: rolePath, route });
    }
  }

  const routes = [];
  if (!routeTable) {
    fail('role-route', 'SKILL.md 缺少路由表');
  } else {
    for (const header of ['路由键', '默认模型意图', '默认 effort']) {
      if (!routeTable.headers.includes(header)) fail('role-route', `路由表缺少列：${header}`);
    }
    const keyColumn = routeTable.headers.indexOf('路由键');
    for (const row of routeTable.rows) {
      routes.push({ key: cellValue(row.cells[keyColumn]), cells: row.cells, headers: routeTable.headers });
    }
  }
  const routeKeys = routes.map(route => route.key);
  if (new Set(routeKeys).size !== routeKeys.length) fail('duplicate-route', '路由键重复');
  if (new Set(indexedRoles.map(role => role.path)).size !== indexedRoles.length || new Set(indexedRoles.map(role => role.route)).size !== indexedRoles.length) {
    fail('role-index', '角色索引路径和路由键必须完整且唯一');
  }

  const roleFiles = [...files.keys()].filter(path => /^roles\/[^/]+\.md$/.test(path) && !path.split('/')[1].startsWith('.'));
  const nonRoleRoutes = new Set(['coordinator', 'bulk', 'chores', 'escalation', 'avoid']);
  for (const role of indexedRoles) {
    if (!files.has(role.path)) fail('missing-role', role.path);
    if (routeKeys.filter(key => key === role.route).length !== 1) fail('role-route', `${role.path} → ${role.route}`);
  }
  for (const path of roleFiles) {
    if (indexedRoles.filter(role => role.path === path).length !== 1) fail('unindexed-role', path);
    const text = files.get(path);
    const preambleBlock = text.split('## 前置提示词')[1]?.match(/```xml\r?\n([\s\S]*?)\r?\n```/)?.[1];
    const preamble = preambleBlock ?? '';
    // 前置提示词以 XML 发给 worker：必须有根元素、核心分节，且占位符不能用会破坏解析的尖括号。
    if (!preambleBlock) fail('role-prompt-xml', `${path} 前置提示词必须是 xml 代码块`);
    else {
      const root = preamble.match(/^<role_prompt role="([a-z0-9-]+)"[^>]*>[\s\S]*<\/role_prompt>$/);
      if (!root) fail('role-prompt-xml', `${path} 前置提示词必须以 <role_prompt role="..."> 为唯一根元素`);
      else if (`roles/${root[1]}.md` !== path) fail('role-prompt-xml', `${path} 的 role 属性与文件名不一致`);
      for (const tag of ['identity', 'permissions', 'task', 'lifecycle']) {
        if (!new RegExp(`<${tag}(?:\\s[^>]*)?>[^<]+</${tag}>`).test(preamble)) fail('role-prompt-xml', `${path} 缺少 <${tag}> 分节`);
      }
      const opened = [...preamble.matchAll(/<([a-z_]+)(?:\s[^>]*)?>/g)].map(match => match[1]).sort();
      const closed = [...preamble.matchAll(/<\/([a-z_]+)>/g)].map(match => match[1]).sort();
      if (opened.join() !== closed.join()) fail('role-prompt-xml', `${path} XML 标签未配对`);
      const stray = preamble.replace(/<\/?[a-z_]+(?:\s[a-z_]+="[^"<>]*")*\s*>/g, '');
      if (/[<>&]/.test(stray)) fail('role-prompt-xml', `${path} 正文含未转义的 <、> 或 &，占位符请用 {{...}}`);
    }
    for (const token of ['references/worker-lifecycle.md', 'consumer_fenced', 'worker_done 后停止', '未知回执先对账', 'succeeded 不等于质量 PASS', 'report-file Ownership']) {
      if (!preamble.includes(token)) fail('role-lifecycle', `${path} 缺 ${token}`);
    }
    if (!text.includes('[SKILL.md「模型路由」]') || !text.includes('[references/model-catalog.md]')) fail('role-model', `${path} 必须引用统一的模型路由与模型目录`);
  }
  const indexedRoutes = new Set(indexedRoles.map(role => role.route));
  for (const route of routeKeys) {
    if (!indexedRoutes.has(route) && !nonRoleRoutes.has(route)) fail('role-route', `路由 ${route} 未在角色索引中对应角色文件`);
  }

  const catalog = files.get('references/model-catalog.md') ?? '';
  const catalogTable = markdownTable(catalog, '路由显示名');
  const modelsByName = new Map();
  const modelsById = new Map();
  const blockedNames = new Set();
  if (!catalogTable) {
    fail('model-catalog', '缺少模型别名与 ID/family 映射表');
  } else {
    const aliasColumn = catalogTable.headers.indexOf('路由显示名');
    const idColumn = catalogTable.headers.indexOf('已知 provider/model ID');
    const familyColumn = catalogTable.headers.indexOf('开发者家族');
    const statusColumn = catalogTable.headers.indexOf('状态/备注');
    for (const row of catalogTable.rows) {
      const alias = cellValue(row.cells[aliasColumn]);
      const id = cellValue(row.cells[idColumn]);
      const family = cellValue(row.cells[familyColumn]);
      const status = cellValue(row.cells[statusColumn]);
      if (!alias || !id || !family) {
        fail('model-catalog', `模型映射必须包含精确 alias、ID 与 family：${row.line}`);
        continue;
      }
      const model = { alias, id, family, blocked: /禁用|暂停|blocked|不得分配/i.test(status) };
      if (modelsByName.has(alias)) fail('model-catalog', `模型 alias 重复：${alias}`);
      modelsByName.set(alias, model);
      if (modelsById.has(id) && modelsById.get(id).family !== family) fail('model-family', `${id} 被映射到多个家族`);
      else if (!modelsById.has(id)) modelsById.set(id, model);
      if (model.blocked) blockedNames.add(alias);
    }
  }
  const resolveModel = value => modelsByName.get(value) ?? modelsById.get(value);
  const routeModelColumn = routeTable?.headers.indexOf('默认模型意图') ?? -1;
  const routeByKey = new Map(routes.map(route => [route.key, route]));
  const avoidRoute = routeByKey.get('avoid');
  const avoidNames = new Set(avoidRoute && routeModelColumn >= 0
    ? cellValue(avoidRoute.cells[routeModelColumn]).split(/[、,，;；]/).map(value => value.trim()).filter(Boolean)
    : []);
  if (!avoidRoute || avoidNames.size === 0) fail('disabled-model', '禁用路由 avoid 缺失或没有明确模型名单');
  for (const alias of blockedNames) {
    if (!avoidNames.has(alias)) fail('disabled-model', `${alias} 在目录中禁用，但未列入 avoid 路由`);
  }
  for (const alias of avoidNames) {
    const model = resolveModel(alias);
    if (!model || !model.blocked) fail('disabled-model', `${alias} 未在模型目录中明确标记为禁用`);
  }

  for (const route of routes) {
    if (route.key === 'avoid' || routeModelColumn < 0) continue;
    const intent = cellValue(route.cells[routeModelColumn]);
    if (route.key === 'reviewer' && intent === '按 authorFamilies 及 model-catalog 选') continue;
    const model = resolveModel(intent);
    if (!model) fail('model-mapping', `${route.key} 的默认模型 ${intent} 未映射到精确 ID/family`);
    else if (model.blocked) fail('disabled-model', `${route.key} 可分配禁用模型 ${intent}`);
  }

  const candidateBullets = [...catalog.matchAll(/^- \*\*(Reviewer|Red-team)\*\*([^\n]*)$/gm)];
  for (const [, label, line] of candidateBullets) {
    const routeKey = label === 'Reviewer' ? 'reviewer' : 'red-team';
    const candidateIds = [...line.matchAll(/`([^`]+)`/g)].map(match => match[1]);
    const families = new Set();
    for (const candidateId of candidateIds) {
      const model = resolveModel(candidateId);
      if (!model) {
        fail('model-mapping', `${routeKey} 候选 ${candidateId} 未映射到精确 ID/family`);
        continue;
      }
      if (model.blocked) fail('disabled-model', `${routeKey} 候选链包含禁用模型 ${candidateId}`);
      families.add(model.family);
    }
    if (families.size < 5) fail('family-coverage', `${routeKey} 候选链仅覆盖 ${families.size} 个不同模型家族`);
  }
  for (const key of ['Reviewer', 'Red-team']) {
    if (!candidateBullets.some(([, label]) => label === key)) fail('family-coverage', `model-catalog 缺少 ${key} 候选链`);
  }

  const requiredReferences = [
    'references/install.md',
    'references/model-catalog.md',
    'references/agent-launch.md',
    'references/multi-agent-review.md',
    'references/recovery.md',
    'references/coordinator-protocol.md',
    'references/acceptance-scenarios.md',
    'references/worker-lifecycle.md',
  ];
  for (const path of requiredReferences) if (!files.has(path)) fail('missing-reference', path);
  for (const [path, text] of files) {
    for (const match of text.matchAll(/\b(?:references|roles)\/[\w-]+\.md\b/g)) {
      if (!files.has(match[0])) fail('missing-reference', `${path} → ${match[0]}`);
    }
  }

  // 仅解析行首的可执行示例，不把解释文字误判为 shell 命令。
  for (const [path, text] of files) {
    const commands = text.replace(/\\\r?\n\s*/g, ' ').split(/\r?\n/).filter(line => /^\s*orca orchestration worker-start\s/.test(line));
    for (const line of commands) {
      const has = flag => new RegExp(`(?:^|\\s)--${flag}(?=\\s|=|$)`).test(line);
      const value = flag => line.match(new RegExp(`--${flag}(?:=|\\s+)("[^"]+"|'[^']+'|\\S+)`))?.[1];
      for (const flag of ['run', 'task', 'worktree']) if (!value(flag) || value(flag).startsWith('--')) fail('start-required', `${path}: 缺 ${flag}`);
      if (has('terminal')) {
        if (has('model') || has('effort') || has('agent')) fail('terminal-conflict', path);
        if (!value('worktree')?.startsWith('id:')) fail('terminal-placement', path);
      } else {
        for (const flag of ['agent', 'model', 'effort']) if (!value(flag) || value(flag).startsWith('--')) fail('start-required', `${path}: 缺 ${flag}`);
        if (value('agent') !== 'claude') fail('start-agent', path);
      }
      if (has('retry-of') && (!has('task') || has('spec') || !has('worktree') || !(has('agent') || has('terminal')))) fail('retry-required', path);
    }
  }

  const protocol = files.get('references/coordinator-protocol.md') ?? '';
  const lifecycle = files.get('references/worker-lifecycle.md') ?? '';
  const fixedContracts = [
    [protocol, 'reviewer、fact-checker、editor 排除该范围整个集合；红方另排除相关 reviewer family 集合。', 'author-families'],
    [files.get('SKILL.md') ?? '', 'reviewer、fact-checker、editor 排除各自范围的完整 authorFamilies；red-team 另外排除 reviewer family。', 'author-families'],
    [protocol, '候选组装不要求测试通过', 'candidate-order'],
    [protocol, 'tester 进入该现有候选 worktree 独占测试文件并写测/运行，不从共同基线另开空白 child', 'candidate-order'],
    [files.get('roles/tester.md') ?? '', '工作区交接与冻结执行 spec 附带的 references/coordinator-protocol.md 所选 Profile 全文', 'candidate-order'],
    [catalog, '跳过 `authorFamilies`', 'family-guard'],
    [protocol, '无法唯一确认时暂停 ack、dispatch、retry、release 及其他写操作', 'unknown-mutation'],
    [protocol, '任何修复都使对应测试、事实核查或审查证据失效', 'revision-guard'],
    [lifecycle, '完成报告发送后停止 check、轮询和新工作', 'completion-guard'],
    [lifecycle, '工具调用失败不等于 Orca Task/Dispatch 终态', 'tool-failure-state'],
    [lifecycle, '父 worker 必须逐项登记每个必需和可选 child', 'child-accounting'],
    [protocol, '必须按 manifest 逐项核对每个必需 child', 'child-accounting'],
    [protocol, '未形成可信的整体完成结论', 'partial-reporting'],
    [protocol, '若账本和 Orca 状态无法对齐，整体状态不得为 `complete`', 'incomplete-aggregation'],
    [protocol, '根元素为 `<worker_spec>`', 'worker-spec-xml'],
    [protocol, '解析失败或残留占位符时不得派发', 'worker-spec-xml'],
    [lifecycle, '不是 Orca API 状态；适用于 `complete`、`partial`、`incomplete`、`unknown`、`escalation` 全部结论', 'report-scope'],
    [lifecycle, '**调度全景**', 'report-overview'],
    [lifecycle, '**逐 worker 施工明细**', 'report-per-worker'],
    [lifecycle, '`[原因] ➔ [擅自做的决定] ➔ [怎么改回来/推翻成本]`', 'report-deviation'],
    [lifecycle, '**防坑自检**', 'report-sanity-check'],
    [lifecycle, '**🕳️ 逻辑缺口与未覆盖盲区**', 'report-logic-gaps'],
    [lifecycle, '[异常与逆向流缺失] / [原需求逻辑漏洞] / [上下游连锁断层]', 'report-logic-gaps'],
    [lifecycle, '不得只写“已完成”', 'report-logic-gaps'],
    [lifecycle, '是否只验证了主流程', 'report-happy-path'],
    [lifecycle, '不能只报跑通的主流程（Happy Path）', 'worker-logic-gaps'],
    [lifecycle, '不得装作没看见硬写', 'worker-logic-gaps'],
    [protocol, '逻辑缺口（异常与逆向流缺失、原需求逻辑漏洞、上下游连锁断层）', 'child-transparent-report'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Happy path only', 'report-happy-path'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Requirement logic hole', 'worker-logic-gaps'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Downstream ripple', 'report-logic-gaps'],
    [lifecycle, '**待你拍板与补漏建议**', 'report-sign-off'],
    [lifecycle, '**写给用户的是任务事实，不是编排运维。**', 'report-no-ops-noise'],
    [lifecycle, '没有内容的项整项省略', 'report-omit-empty'],
    [lifecycle, '流程图只画任务本身的数据/工作流，不画 Orca 调度', 'report-no-ops-noise'],
    [lifecycle, '仅在所有必需 child 有可核验最终结果、关联 Orca 状态已对账且证据齐全时成立', 'report-complete-gate'],
    [lifecycle, '动作与决策偏离', 'worker-autonomy-report'],
    [lifecycle, '原因 → 决定 → 影响与回退方式/位置', 'worker-autonomy-report'],
    [lifecycle, '不得以事后披露替代授权', 'worker-autonomy-boundary'],
    [lifecycle, '不删除用户/他人文件或未知归属资源', 'worker-cleanup-boundary'],
    [lifecycle, '披露 TODO/占位、截断、省略、mock/hardcode', 'worker-completeness-report'],
    [lifecycle, '简述 spec 中关键限制，尤其禁止修改项及遵守情况', 'worker-constraint-report'],
    [lifecycle, '区分本次工具实际读取/检索所得、用户/spec 提供和模型先验推断', 'worker-source-report'],
    [protocol, '按 child 分别透传职责、关键动作/产物', 'child-transparent-report'],
    [protocol, '哪些仅为 worker 自报或仍未知', 'child-transparent-report'],
    [protocol, '核验接口字段/格式、命名、版本/hash', 'handoff-contract-check'],
    [protocol, '未对齐时暂停受影响的下游门或明确报告阻塞', 'handoff-contract-check'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Autonomous choice disclosure', 'worker-autonomy-report'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Temporary artifact residue', 'worker-cleanup-boundary'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Truncated or mocked delivery', 'worker-completeness-report'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Constraint transmission', 'worker-constraint-report'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Parallel contract conflict', 'handoff-contract-check'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Prior knowledge presented as live evidence', 'worker-source-report'],
    [protocol, 'coordinator 对自己启动的 worker 负责盘点并处理资源结算', 'resource-owner'],
    [protocol, '`projection.nextAction` 是建议而非执行证明', 'resource-action-evidence'],
    [protocol, '保留资源必须逐项记录依据', 'resource-retain-reason'],
    [protocol, '`released` 不代表任务通过，`retained` 不代表 worker 未完成，worker 完成也不代表终端已释放', 'resource-state-separation'],
    [protocol, '`release_pending` / `release_unknown` 必须沿当前 recovery guide 按回执对账恢复，绝不用 `terminal close` 替代', 'resource-release-recovery'],
    [files.get('SKILL.md') ?? '', '汇报按 `references/worker-lifecycle.md「Coordinator 用户可见汇报契约」`四段式写任务事实', 'report-scope'],
    [files.get('SKILL.md') ?? '', 'coordinator 对自己启动的 worker 负责结算', 'resource-owner'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Coordinator启动的worker由该coordinator负责盘点与结算', 'resource-owner'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'nextAction只是建议；未经回执/查询确认不能记为已释放', 'resource-action-evidence'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Coordinator reporting without evidence', 'report-scope'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Research/analysis confidence', 'report-confidence'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Content/creative assumptions', 'report-assumptions'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Data operation accounting', 'report-actions'],
    [files.get('references/acceptance-scenarios.md') ?? '', 'Development evidence receipt', 'report-evidence'],
  ];
  for (const [text, sentence, code] of fixedContracts) if (!text.includes(sentence)) fail(code, `固定契约缺失或被改写：${sentence}`);

  for (const path of roleFiles) {
    const text = files.get(path) ?? '';
    const prompt = text.split('## 前置提示词')[1]?.match(/```xml\r?\n([\s\S]*?)\r?\n```/)?.[1] ?? '';
    if (['## Coordinator 用户可见汇报契约', '**调度全景**', '**逐 worker 施工明细**', '**防坑自检**', '**待你拍板与补漏建议**'].every(token => prompt.includes(token))) {
      fail('role-report-isolation', `${path} 不应复制 coordinator 的整体汇报模板`);
    }
  }

  // 关键边界使用完整约束，避免单个关键词仍在、语义却已反转。
  const boundaryContracts = [
    ['SKILL.md', '--spec "$(cat "$spec_file")"', 'spec-input'],
    ['SKILL.md', '账本同时记录原文件 SHA 和按相同读取方式得到的传入文本 SHA', 'spec-input'],
    ['SKILL.md', '`MAGPIE_BASE_URL`、`MAGPIE_TOKEN` 必须由用户/环境配置，缺失则停止', 'gateway-config'],
    ['SKILL.md', '只在 Git 仓库时 `.orca-notes/` 加入该仓库 `.git/info/exclude`，不改共享 `.gitignore`', 'local-ignore'],
    ['SKILL.md', '超过 4 层先解释原因', 'dependency-depth'],
    ['SKILL.md', '默认只对整合后的冻结版本做最终 reviewer 和 red-team', 'review-timing'],
    ['SKILL.md', 'node scripts/validate.mjs\nnode --test tests/', 'validation-entry'],
    ['SKILL.md', '一个 agent 可独立完成的任务不要使用本 skill', 'skill-trigger'],
    ['SKILL.md', '触发本 Skill 即使用 `orchestration`', 'orca-launch-routing'],
    ['SKILL.md', '`orca-cli` 只用于完整 handoff 或底层 terminal/worktree 控制，不代替监督编排。', 'orca-cli-boundary'],
    ['SKILL.md', '至少并发派发 2 个、默认 3 个不同家族的只读审查 worker', 'multi-agent-minimum'],
    ['SKILL.md', 'coordinator 读代码只为写 spec，严禁自己出结论代替 worker', 'coordinator-no-self-review'],
    ['SKILL.md', 'references/multi-agent-review.md', 'multi-agent-reference'],
    ['references/multi-agent-review.md', '至少 **2 个** worker，默认 **3 个**', 'multi-agent-minimum'],
    ['references/multi-agent-review.md', '至少 **2 个不同开发者家族**', 'multi-agent-family-coverage'],
    ['references/multi-agent-review.md', 'coordinator 不得亲自阅读被审代码或需求文档后直接输出审查结论，代替 worker。', 'coordinator-no-self-review'],
    ['references/multi-agent-review.md', '不得用 1 个 worker 的结果复制成多份报告，冒充多智能体交叉审查。', 'multi-agent-no-fake-parallel'],
    ['references/multi-agent-review.md', '不需要用户先批准角色/模型/Ownership 计划', 'multi-agent-no-plan-gate'],
    ['references/multi-agent-review.md', '每个 reviewer 都是 manifest 中的必需 child', 'child-accounting'],
    ['references/multi-agent-review.md', '不能输出最终整合 verdict', 'incomplete-aggregation'],
    ['SKILL.md', '一个 agent 可独立完成的任务不要使用本 skill', 'skill-trigger'],
    ['SKILL.md', '超过 4 层先解释原因', 'dependency-depth'],
    ['SKILL.md', '每个 worker 必须核验 Dispatch receipt/handle。', 'launch-receipt'],

    ['SKILL.md', '启动失败或不确定时停止报告', 'orca-launch-failure'],
    ['SKILL.md', '禁止用 HTTP、gateway、`fetch`、`curl` 或 `ctx_execute` 调模型代做审查', 'direct-model-call'],
    ['SKILL.md', '`ctx_execute` 可做非推理分析', 'analysis-tool-boundary'],

    ['references/install.md', '多模型 review 默认创建 Run/Task 并用 `orchestration worker-start` 派发；只有用户明确要求完整 handoff 且不需要当前协调器跟进时才用 `orca-cli`。', 'orca-launch-routing'],
    ['references/install.md', '启动路由：多模型 review 默认用 orchestration 创建 Run/Task 并用 worker-start 派发；只有完整 handoff 且当前不跟进时才用 orca-cli。', 'orca-launch-routing'],

    ['references/install.md', 'Orca 启动失败或结果不确定时停止并报告，不要用 HTTP、本地 gateway 或 ctx_execute 调用模型代替 Agent。', 'direct-model-call'],
    ['references/agent-launch.md', '若 Orca CLI 不可用、`worker-start` 被拒绝、模型解析失败、receipt 缺失或结果不确定，停止该角色', 'orca-launch-failure'],
    ['references/agent-launch.md', '本 Skill 管理的是拆解、派工、等待、质量门和资源结算，因此多模型 review 与多 agent 协作默认使用当前版本 `orchestration` supervised loop', 'orca-launch-routing'],
    ['references/agent-launch.md', '`orca-cli` 用于完整 handoff', 'orca-cli-boundary'],
    ['references/agent-launch.md', '禁止用 `ctx_execute`、JavaScript `fetch`、`curl`、`child_process`、直接 HTTP 或本地 gateway 的 `/v1/chat/completions` 生成审查结论或替代角色交付。', 'direct-model-call'],

    ['references/agent-launch.md', '`ctx_execute` 仍可用于不调用模型的本地分析', 'analysis-tool-boundary'],
    ['references/agent-launch.md', '启动后核对 Dispatch receipt、outcome、Task/Dispatch ID 和 worker handle。', 'launch-receipt'],


    ['references/recovery.md', '连续 3 次 `check --wait` 返回空结果后', 'worker-supervision'],
    ['references/recovery.md', 'worker 已启动后的工具错误先记入内部执行事件', 'tool-failure-state'],
    ['references/recovery.md', '只有能证明调用未启动、没有副作用且该工具契约允许时', 'tool-retry-safety'],

    ['references/recovery.md', '立即向用户报告 Dispatch、等待原因及所需操作', 'worker-supervision'],
    ['references/recovery.md', '单 Task 默认最长监督时长 60 分钟', 'worker-timeout'],
    ['references/recovery.md', '不自动 stop、abandon、retry 或 release', 'worker-timeout'],
    ['references/worker-lifecycle.md', '**结论先行**：正文第一行就是一句话结论', 'report-lead'],
    ['references/worker-lifecycle.md', '**先答所问**：主交付物必须直接回答用户原话的问题', 'report-answer-first'],
    ['references/worker-lifecycle.md', '**数字要有出处**', 'report-metric-source'],
    ['references/worker-lifecycle.md', '**coordinator 自己的决定要报备**', 'report-coordinator-decision'],
    ['references/multi-agent-review.md', '这张去重清单就是汇报契约中的主交付物', 'report-answer-first'],
    ['references/install.md', '打开 Orca Settings → Orchestration', 'install-entry'],
    ['references/recovery.md', '实际采用的档位须关联到该请求的 gateway 日志', 'effort-evidence'],
    ['references/recovery.md', '生效档位待核实', 'effort-evidence'],
    ['references/recovery.md', '该 ceiling 是经过用户确认的执行额度', 'dispatch-budget'],
    ['references/recovery.md', '停止新派发，列出剩余工作并询问是否增加额度', 'dispatch-budget'],
    ['references/coordinator-protocol.md', '每个 `gate × review scope` 的修复轮次分别计数，最多 2 轮', 'repair-budget'],
    ['references/coordinator-protocol.md', '全部必需 child 有可核验最终结果、每个关联 Orca 状态已对账且证据齐全时才可为 `complete`', 'incomplete-aggregation'],
    ['references/coordinator-protocol.md', '计划任务总数及各状态计数；每个 Task/Dispatch 的 ID、原始状态和查询/回执依据', 'partial-reporting'],
    ['references/coordinator-protocol.md', 'PPT worker 完成并冻结产物后，coordinator 必须再派 fact-checker 核对幻灯片文本、图表标签和数据', 'ppt-facts'],
    ['roles/requirement-auditor.md', '- `--body` 第一行写 `VERDICT: SHIP`', 'prd-verdict'],
    ['roles/requirement-auditor.md', 'coordinator 不得转派 worker 修改用户 PRD', 'prd-ownership'],
  ];
  for (const [path, sentence, code] of boundaryContracts) {
    if (!files.get(path)?.includes(sentence)) fail(code, `${path} 缺少约束：${sentence}`);
  }
  for (const role of ['coder', 'frontend']) {
    const text = files.get(`roles/${role}.md`) ?? '';
    for (const sentence of ['typecheck / lint 不新增错误', '仅缺 tester 待补的测试不应标任务 failed', '必须记录 `verification_status=failed`']) {
      if (!text.includes(sentence)) fail('implementation-gate', `${role} 缺少实现/验证分离：${sentence}`);
    }
  }
  for (const role of ['architect', 'reviewer', 'red-team']) {
    const text = files.get(`roles/${role}.md`) ?? '';
    if (!text.includes('实际存在的完整') || !text.includes('独占') || !text.includes('--report-path')) fail('report-file', `${role} 缺少独占报告文件契约`);
  }
  for (const role of ['researcher', 'fact-checker']) {
    const text = files.get(`roles/${role}.md`) ?? '';
    for (const sentence of ['独立、干净、无密钥文件的 worktree', '不能退回携带密钥的共享工作区继续浏览']) {
      if (!text.includes(sentence)) fail('web-isolation', `${role} 缺少网页隔离约束：${sentence}`);
    }
  }

  const requireTokens = (path, tokens) => {
    const text = files.get(path) ?? '';
    for (const token of tokens) if (!text.includes(token)) fail('contract', `${path} 缺 ${token}`);
  };
  requireTokens('SKILL.md', ['shared-serial', 'parallel-doc', 'parallel-worktree', 'Manual permissions', 'dispatch ceiling', 'references/model-catalog.md', 'launch.effective', '每个角色恰好对应一条路由']);
  requireTokens('references/coordinator-protocol.md', ['append-only', 'execution_status', 'verification_status', 'review_verdict', 'exactly-once', 'risk owner', 'worker-dispatch ceiling', 'page.nextCursor', 'editor 只做语言/结构编辑', '完整文件清单及每个现存文件的 hash', '每个 writer 只写唯一且互不重叠的章节文件路径', '不得共写一个物理文件', 'coordinator-owned']);
  requireTokens('references/acceptance-scenarios.md', ['Non-Git parallel documents', 'disjoint chapter-file paths', 'coordinator-owned']);
  requireTokens('references/worker-lifecycle.md', ['consumer_fenced', 'request-show', 'report-file Ownership', '不是权限沙箱', '不等于质量 PASS', 'authorFamilies']);
  requireTokens('roles/slide-designer.md', ['逐页检查报告文件', '渲染命令', '图片路径']);
  const forbidden = [/依赖链不超过 3[–-]4 层/, /为自己的改动补上必要的最小测试/, /用 --report-path 给出渲染图目录/, /或派 editor 处理措辞/, /恢复这些改动（只恢复这几处）/];
  for (const [path, text] of files) for (const pattern of forbidden) if (pattern.test(text)) fail('unsafe-contract', path);
  return errors;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(process.argv[2] ?? defaultRoot);
    const errors = validateDocuments(loadDocuments(root));
    for (const error of errors) console.error(error);
    console.log(errors.length ? `FAIL：${errors.length} 项契约问题` : 'PASS：Skill 静态契约一致（不证明运行时行为）');
    process.exitCode = errors.length ? 1 : 0;
  } catch (error) {
    console.error(`FAIL：无法读取契约文件：${error.message}`);
    process.exitCode = 1;
  }
}
