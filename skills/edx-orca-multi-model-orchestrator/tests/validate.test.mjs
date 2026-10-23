import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadDocuments, validateDocuments } from '../scripts/validate.mjs';

const original = loadDocuments();
const clone = source => new Map(source);
const mutate = (source, path, from, to) => {
  const files = clone(source);
  assert.ok(files.get(path)?.includes(from), `fixture 找不到替换点：${path}: ${from}`);
  files.set(path, files.get(path).replace(from, to));
  return files;
};
const tableLines = (text, headerToken) => {
  const lines = text.split('\n');
  const headerIndex = lines.findIndex(line => line.startsWith('|') && line.includes(headerToken));
  assert.notEqual(headerIndex, -1, `fixture 找不到表格：${headerToken}`);
  let end = headerIndex + 1;
  while (end < lines.length && lines[end].startsWith('|')) end += 1;
  return { lines, headerIndex, end };
};
const editTableRow = (files, path, headerToken, key, transform) => {
  const text = files.get(path);
  const { lines, headerIndex, end } = tableLines(text, headerToken);
  const rowIndex = lines.findIndex((line, index) => index > headerIndex && index < end && line.startsWith('|') && line.split('|')[1]?.trim().replaceAll('`', '') === key);
  assert.notEqual(rowIndex, -1, `fixture 找不到 ${key} 行`);
  const replacement = transform(lines[rowIndex]);
  if (replacement === null) lines.splice(rowIndex, 1);
  else lines[rowIndex] = replacement;
  files.set(path, lines.join('\n'));
};
const addRole = source => {
  const files = clone(source);
  let skill = files.get('SKILL.md');
  const roleIndexRow = '| extra | `roles/extra.md` | extra | 独占扩展文件 |';
  const roleIndex = tableLines(skill, '| 角色 |');
  roleIndex.lines.splice(roleIndex.end, 0, roleIndexRow);
  skill = roleIndex.lines.join('\n');
  files.set('SKILL.md', skill);
  const routeText = files.get('SKILL.md');
  const routeRow = '| `extra` | Qwen3.8 Max | max |';
  const { lines, end } = tableLines(routeText, '默认模型意图');
  lines.splice(end, 0, routeRow);
  files.set('SKILL.md', lines.join('\n'));
  files.set('roles/extra.md', files.get('roles/tester.md').replaceAll('tester', 'extra'));
  return files;
};
const withWorkerCommand = (command = 'orca orchestration worker-start --run run-1 --task task-1 --worktree current --agent claude --model model-id --effort max') => {
  const files = clone(original);
  files.set('SKILL.md', `${files.get('SKILL.md')}\n${command}\n`);
  return files;
};
const reject = (files, code) => {
  const errors = validateDocuments(files);
  assert.ok(errors.some(error => error.startsWith(`${code}:`)), `预期 ${code}，实际 ${errors.join('\n')}`);
};
const replaceCandidate = (source, label, transform) => {
  const files = clone(source);
  const lines = files.get('references/model-catalog.md').split('\n');
  const index = lines.findIndex(line => line.startsWith(`- **${label}**`));
  assert.notEqual(index, -1, `fixture 找不到 ${label} 候选链`);
  lines[index] = transform(lines[index]);
  files.set('references/model-catalog.md', lines.join('\n'));
  return files;
};

test('当前文档通过静态校验', () => assert.deepEqual(validateDocuments(original), []));
test('正文超过 15000 bytes 时拒绝', () => {
  const files = clone(original);
  files.set('SKILL.md', `${files.get('SKILL.md')}\n${'字'.repeat(5000)}`);
  reject(files, 'skill-size');
});
test('有效 name 可与目录名不同', () => {
  const files = mutate(original, 'SKILL.md', 'name: edx-orca-multi-model-orchestrator', 'name: valid-alternate-name');
  assert.deepEqual(validateDocuments(files), []);
});
test('无效 name 格式被拒绝', () => reject(mutate(original, 'SKILL.md', 'name: edx-orca-multi-model-orchestrator', 'name: Invalid_Name'), 'frontmatter'));
test('角色目录发现忽略隐藏 markdown 文件', () => {
  const root = mkdtempSync(join(tmpdir(), 'orca-validate-'));
  try {
    mkdirSync(join(root, 'roles'));
    mkdirSync(join(root, 'references'));
    writeFileSync(join(root, 'SKILL.md'), '');
    writeFileSync(join(root, 'roles', '.hidden.md'), 'hidden');
    writeFileSync(join(root, 'roles', '._visible.md'), 'AppleDouble');
    writeFileSync(join(root, 'roles', 'visible.md'), 'visible');
    assert.equal(loadDocuments(root).has('roles/.hidden.md'), false);
    assert.equal(loadDocuments(root).has('roles/._visible.md'), false);
    assert.equal(loadDocuments(root).has('roles/visible.md'), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
test('新增角色不依赖固定角色数量', () => assert.deepEqual(validateDocuments(addRole(original)), []));
test('角色缺少统一模型目录引用时拒绝', () => reject(mutate(original, 'roles/coder.md', '[references/model-catalog.md]', '[旧模型目录]'), 'role-model'));
test('非 Git 文档并发 profile 具备基线和 Ownership 边界', () => assert.deepEqual(validateDocuments(original), []));
test('路由表缺少必需列时拒绝', () => reject(mutate(original, 'SKILL.md', '| 路由键 | 默认模型意图 | 默认 effort |', '| 路由键 | 默认模型意图 |'), 'role-route'));
test('角色索引缺少列时拒绝', () => reject(mutate(original, 'SKILL.md', '| 角色 | 文件 | 路由键 | Ownership |', '| 角色 | 文件 | 其他键 | Ownership |'), 'role-index'));
test('角色索引中的无效文件路径不能静默跳过', () => reject(mutate(original, 'SKILL.md', '`roles/tester.md`', '`roles/.hidden.md`'), 'role-index'));
test('非 Git 文档并发缺少文件清单/hash 基线时拒绝', () => reject(mutate(original, 'references/coordinator-protocol.md', '完整文件清单及每个现存文件的 hash', '文件清单'), 'contract'));
test('非 Git 文档并发允许共写物理文件时拒绝', () => reject(mutate(original, 'references/coordinator-protocol.md', '不得共写一个物理文件', '允许共写一个物理文件'), 'contract'));
test('非 Git 文档并发未归属 coordinator 控制文件时拒绝', () => reject(mutate(original, 'references/coordinator-protocol.md', 'coordinator-owned', 'unowned'), 'contract'));
test('索引引用角色但其路由行缺失', () => {
  const files = clone(original);
  editTableRow(files, 'SKILL.md', '默认模型意图', 'tester', () => null);
  reject(files, 'role-route');
});
test('路由存在但没有索引角色', () => {
  const files = clone(original);
  const { lines, end } = tableLines(files.get('SKILL.md'), '默认模型意图');
  lines.splice(end, 0, '| `orphan` | Qwen3.8 Max | max |');
  files.set('SKILL.md', lines.join('\n'));
  reject(files, 'role-route');
});
test('缺角色文件', () => { const files = clone(original); files.delete('roles/tester.md'); reject(files, 'missing-role'); });
test('缺引用文件', () => { const files = clone(original); files.delete('references/coordinator-protocol.md'); reject(files, 'missing-reference'); });
test('重复路由键', () => {
  const files = clone(original);
  editTableRow(files, 'SKILL.md', '默认模型意图', 'tester', row => row.replace('| `tester` |', '| `coder` |'));
  reject(files, 'duplicate-route');
});
test('角色索引与路由键不对应', () => {
  const files = mutate(original, 'SKILL.md', '| tester | 独占测试文件/fixture；按阶段执行 |', '| coder | 独占测试文件/fixture；按阶段执行 |');
  reject(files, 'role-route');
});
test('角色文件未进入索引', () => { const files = clone(original); files.set('roles/extra.md', files.get('roles/tester.md')); reject(files, 'unindexed-role'); });
test('路由默认模型必须映射到精确 ID 和 family', () => {
  const files = clone(original);
  editTableRow(files, 'SKILL.md', '默认模型意图', 'coder', row => row.replace('GPT-6.1 Sol', 'Unmapped Model X'));
  reject(files, 'model-mapping');
});
test('模型候选说明不能使 red-team 跳过精确映射', () => {
  const files = clone(original);
  editTableRow(files, 'SKILL.md', '默认模型意图', 'red-team', row => row.replace('gpt-6-astra', 'Unknown Model X'));
  reject(files, 'model-mapping');
});
test('未知模型带上动态路由说明仍被拒绝', () => {
  const files = clone(original);
  editTableRow(files, 'SKILL.md', '默认模型意图', 'coder', row => row.replace('GPT-6.1 Sol', 'Unknown Model X；按 model-catalog 回避家族'));
  reject(files, 'model-mapping');
});
test('同一精确 ID 不能映射到多个 family', () => {
  const files = clone(original);
  const { lines, end } = tableLines(files.get('references/model-catalog.md'), '路由显示名');
  lines.splice(end, 0, '| `Unexpected Alias` | `gpt-6.1-sol` | `my` | Anthropic | 本机已配置 |');
  files.set('references/model-catalog.md', lines.join('\n'));
  reject(files, 'model-family');
});
test('可分配路由不能使用禁用模型', () => {
  const files = clone(original);
  editTableRow(files, 'SKILL.md', '默认模型意图', 'coder', row => row.replace('GPT-6.1 Sol', 'gs/gpt-5.6-sol'));
  reject(files, 'disabled-model');
});
test('禁用模型仍须保留精确 ID 和 family 映射', () => {
  const files = clone(original);
  const catalog = files.get('references/model-catalog.md').split('\n');
  const index = catalog.findIndex(line => line.includes('`Gemini 4 Argon`'));
  assert.notEqual(index, -1, 'fixture 找不到禁用模型映射');
  catalog.splice(index, 1);
  files.set('references/model-catalog.md', catalog.join('\n'));
  reject(files, 'disabled-model');
});
test('reviewer 候选链覆盖至少五个模型家族', () => assert.deepEqual(validateDocuments(original), []));
for (const label of ['Reviewer', 'Red-team']) {
  test(`${label} 恰好五个家族时通过`, () => {
    const files = replaceCandidate(original, label, () => `- **${label}**：\`gpt-6-astra\`、\`claude-opus-5-5\`、\`gemini-3.8-flash\`、\`grok-4.7\`、\`qwen3.8-max\``);
    assert.deepEqual(validateDocuments(files), []);
  });
  test(`${label} 四个家族时拒绝`, () => {
    const files = replaceCandidate(original, label, () => `- **${label}**：\`gpt-6-astra\`、\`claude-opus-5-5\`、\`gemini-3.8-flash\`、\`grok-4.7\``);
    reject(files, 'family-coverage');
  });
}
test('reviewer 候选链少于五个模型家族时拒绝', () => {
  const files = replaceCandidate(original, 'Reviewer', line => line.replaceAll('`gemini-3.8-flash`', '').replaceAll('`grok-4.7`', '').replaceAll('`DeepSeek-V4.1-Flash-1017`', '').replaceAll('`qwen3.8-max`', '').replaceAll('`glm-5.3-flashx`', ''));
  reject(files, 'family-coverage');
});
test('red-team 候选链覆盖至少五个模型家族', () => assert.deepEqual(validateDocuments(original), []));
test('red-team 候选链少于五个模型家族时拒绝', () => {
  const files = replaceCandidate(original, 'Red-team', line => line.replaceAll('`gemini-3.8-flash`', '').replaceAll('`DeepSeek-V4.1-Flash-1017`', '').replaceAll('`qwen3.8-max`', '').replaceAll('`glm-5.3-flashx`', ''));
  reject(files, 'family-coverage');
});
test('未知候选模型 ID 被拒绝', () => reject(replaceCandidate(original, 'Reviewer', line => line.replace('`gpt-6.1-sol`', '`unknown-model-id`')), 'model-mapping'));
test('未知候选显示名也必须映射', () => reject(replaceCandidate(original, 'Reviewer', line => line.replace('`gpt-6.1-sol`', '`Unknown Model X`')), 'model-mapping'));
test('完整的新 worker 启动参数通过', () => assert.deepEqual(validateDocuments(withWorkerCommand()), []));
test('复用终端具有精确 placement 且无冲突参数时通过', () => assert.deepEqual(validateDocuments(withWorkerCommand('orca orchestration worker-start --run run-1 --task task-1 --worktree id:terminal --terminal handle --json')), []));
test('非复用启动缺 effort', () => reject(withWorkerCommand('orca orchestration worker-start --run run-1 --task task-1 --worktree current --agent claude --model model-id'), 'start-required'));
test('非复用启动缺 placement', () => reject(withWorkerCommand('orca orchestration worker-start --run run-1 --task task-1 --agent claude --model model-id --effort max'), 'start-required'));
test('非复用启动缺 model', () => reject(withWorkerCommand('orca orchestration worker-start --run run-1 --task task-1 --worktree current --agent claude --effort max'), 'start-required'));
test('复用终端禁止 model', () => reject(withWorkerCommand('orca orchestration worker-start --run run-1 --task task-1 --worktree id:terminal --terminal handle --model x --json'), 'terminal-conflict'));
test('复用终端禁止 effort', () => reject(withWorkerCommand('orca orchestration worker-start --run run-1 --task task-1 --worktree id:terminal --terminal handle --effort max --json'), 'terminal-conflict'));
test('复用终端须精确 worktree', () => reject(withWorkerCommand('orca orchestration worker-start --run run-1 --task task-1 --worktree current --terminal handle --json'), 'terminal-placement'));
test('retry 缺 task', () => reject(withWorkerCommand('orca orchestration worker-start --run run-1 --retry-of dispatch-1 --worktree current --agent claude --model model-id --effort max'), 'retry-required'));
test('retry 不允许 spec 替代 task', () => reject(withWorkerCommand('orca orchestration worker-start --run run-1 --spec "x" --retry-of dispatch-1 --worktree current --agent claude --model model-id --effort max'), 'retry-required'));
test('角色前置提示词退回纯文本代码块时拒绝', () => reject(mutate(original, 'roles/reviewer.md', '```xml\n<role_prompt', '```\n<role_prompt'), 'role-prompt-xml'));
test('角色前置提示词缺少根元素时拒绝', () => reject(mutate(original, 'roles/writer.md', '<role_prompt role="writer" name="撰稿人">', '<prompt>'), 'role-prompt-xml'));
test('角色 role 属性与文件名不一致时拒绝', () => reject(mutate(original, 'roles/coder.md', '<role_prompt role="coder"', '<role_prompt role="tester"'), 'role-prompt-xml'));
test('角色前置提示词缺少核心分节时拒绝', () => reject(mutate(original, 'roles/planner.md', '<permissions>', '<scope>'), 'role-prompt-xml'));
test('角色占位符使用尖括号破坏 XML 时拒绝', () => reject(mutate(original, 'roles/researcher.md', '{{摘要路径}}', '<摘要路径>'), 'role-prompt-xml'));
test('角色前置提示词含未转义 & 时拒绝', () => reject(mutate(original, 'roles/editor.md', '让中文表达更流畅', '让中文表达更流畅 & 统一'), 'role-prompt-xml'));
test('生命周期缺 fenced 处理', () => reject(mutate(original, 'roles/writer.md', 'consumer_fenced', 'unknown_state'), 'role-lifecycle'));
test('完成与质量门缺失', () => {
  const files = clone(original);
  files.set('references/coordinator-protocol.md', files.get('references/coordinator-protocol.md').replaceAll('verification_status', 'other_status'));
  reject(files, 'contract');
});
test('工具错误不能冒充 Orca 终态', () => reject(mutate(original, 'references/worker-lifecycle.md', '工具调用失败不等于 Orca Task/Dispatch 终态', '工具调用失败就是 Orca Task/Dispatch 终态'), 'tool-failure-state'));
test('工具失败不得盲目重试或静默 fallback', () => reject(mutate(original, 'references/recovery.md', '只有能证明调用未启动、没有副作用且该工具契约允许时', '所有工具错误都可自动重试'), 'tool-retry-safety'));
test('父 worker 必须逐项对账 child', () => reject(mutate(original, 'references/coordinator-protocol.md', '必须按 manifest 逐项核对每个必需 child', '可以只统计收到的 worker_done 数量'), 'child-accounting'));
test('未知 child 禁止整体完成', () => reject(mutate(original, 'references/coordinator-protocol.md', '若账本和 Orca 状态无法对齐，整体状态不得为 `complete`', '即使账本和 Orca 状态无法对齐也可以为 `complete`'), 'incomplete-aggregation'));
test('部分汇报必须显式告知用户', () => reject(mutate(original, 'references/coordinator-protocol.md', '未形成可信的整体完成结论', '可以省略整体完成可信度说明'), 'partial-reporting'));
test('清理丢失分页约束', () => reject(mutate(original, 'references/coordinator-protocol.md', 'page.nextCursor', 'cursor'), 'contract'));
test('错误恢复 coder 测试职责', () => {
  const files = clone(original);
  files.set('roles/coder.md', `${files.get('roles/coder.md')}\n为自己的改动补上必要的最小测试`);
  reject(files, 'unsafe-contract');
});
test('报告目录不能冒充报告文件', () => {
  const files = clone(original);
  files.set('roles/slide-designer.md', `${files.get('roles/slide-designer.md')}\n用 --report-path 给出渲染图目录`);
  reject(files, 'unsafe-contract');
});
test('事实修正不能交给 editor', () => reject(mutate(original, 'references/coordinator-protocol.md', 'editor 只做语言/结构编辑', 'editor 修改事实'), 'contract'));
test('固定契约：审查候选须排除作者家族', () => reject(mutate(original, 'references/model-catalog.md', '跳过 `authorFamilies`', '忽略 `authorFamilies`'), 'family-guard'));
test('固定契约：未知请求仍 ack', () => reject(mutate(original, 'references/coordinator-protocol.md', '无法唯一确认时暂停 ack、dispatch、retry、release 及其他写操作', '无法唯一确认时暂停 dispatch，但继续 ack、retry、release'), 'unknown-mutation'));
test('固定契约：修复后沿用旧证据', () => reject(mutate(original, 'references/coordinator-protocol.md', '任何修复都使对应测试、事实核查或审查证据失效', '任何修复均可沿用对应测试、事实核查或审查证据'), 'revision-guard'));
test('固定契约：完成后继续工作', () => reject(mutate(original, 'references/worker-lifecycle.md', '完成报告发送后停止 check、轮询和新工作', '完成报告发送后继续 check、轮询和新工作'), 'completion-guard'));
test('固定契约：多作者未排除完整集合', () => reject(mutate(original, 'SKILL.md', '排除各自范围的完整 authorFamilies', '只排除最后作者的 family'), 'author-families'));
test('固定契约：测试通过成为候选组装前提', () => reject(mutate(original, 'references/coordinator-protocol.md', '候选组装不要求测试通过', '候选组装要求测试通过'), 'candidate-order'));
test('固定契约：tester 在候选组装前运行', () => reject(mutate(original, 'references/coordinator-protocol.md', 'tester 进入该现有候选 worktree 独占测试文件并写测/运行，不从共同基线另开空白 child', 'tester 从共同基线另开空白 child，测试后再组装实现'), 'candidate-order'));
test('tester spec 未引用所选 Profile 时拒绝', () => reject(mutate(original, 'roles/tester.md', '工作区交接与冻结执行 spec 附带的 references/coordinator-protocol.md 所选 Profile 全文', '自行选择一个工作区'), 'candidate-order'));

const boundaryMutations = [
  ['spec 安全传参', 'SKILL.md', '--spec "$(cat "$spec_file")"', '--spec "<inline spec>"', 'spec-input'],
  ['spec 文件与参数分别记 hash', 'SKILL.md', '账本同时记录原文件 SHA 和按相同读取方式得到的传入文本 SHA', '只记录标题', 'spec-input'],
  ['网关环境变量', 'SKILL.md', '`MAGPIE_BASE_URL`、`MAGPIE_TOKEN` 必须由用户/环境配置，缺失则停止', '使用未确认的默认连接', 'gateway-config'],
  ['运行目录本地忽略', 'SKILL.md', '只在 Git 仓库时 `.orca-notes/` 加入该仓库 `.git/info/exclude`，不改共享 `.gitignore`', '修改共享忽略文件', 'local-ignore'],
  ['冻结后终审', 'SKILL.md', '默认只对整合后的冻结版本做最终 reviewer 和 red-team', '对写入中的版本做最终 reviewer 和 red-team', 'review-timing'],
  ['目录校验入口', 'SKILL.md', 'node scripts/validate.mjs\nnode --test tests/', 'node scripts/validate.mjs', 'validation-entry'],
  ['多模型 review 优先 orchestration', 'SKILL.md', '触发本 Skill 即使用 `orchestration`', '触发本 Skill 即使用 `orca-cli` handoff', 'orca-launch-routing'],
  ['orca-cli 仅作底层或 handoff', 'SKILL.md', '`orca-cli` 只用于完整 handoff 或底层 terminal/worktree 控制，不代替监督编排。', '`orca-cli` 负责多模型监督编排', 'orca-cli-boundary'],
  ['SKILL 极速 review 最少智能体数', 'SKILL.md', '至少并发派发 2 个、默认 3 个不同家族的只读审查 worker', '派发 1 个只读审查 worker', 'multi-agent-minimum'],
  ['SKILL 禁止 coordinator 自审', 'SKILL.md', 'coordinator 读代码只为写 spec，严禁自己出结论代替 worker', 'coordinator 可以直接读代码出结论', 'coordinator-no-self-review'],
  ['极速 review reference 最少智能体数', 'references/multi-agent-review.md', '至少 **2 个** worker，默认 **3 个**', '至少 1 个 worker', 'multi-agent-minimum'],
  ['极速 review reference 家族覆盖', 'references/multi-agent-review.md', '至少 **2 个不同开发者家族**', '同一开发者家族即可', 'multi-agent-family-coverage'],
  ['极速 review reference 禁止自审', 'references/multi-agent-review.md', 'coordinator 不得亲自阅读被审代码或需求文档后直接输出审查结论，代替 worker。', 'coordinator 可直接阅读代码输出审查结论。', 'coordinator-no-self-review'],
  ['极速 review reference 禁止伪造多智能体', 'references/multi-agent-review.md', '不得用 1 个 worker 的结果复制成多份报告，冒充多智能体交叉审查。', '可用 1 个 worker 结果拆成多份报告。', 'multi-agent-no-fake-parallel'],
  ['极速 review 免计划阻塞', 'references/multi-agent-review.md', '不需要用户先批准角色/模型/Ownership 计划', '必须先停下等用户批准计划', 'multi-agent-no-plan-gate'],
  ['极速 review 必须逐项完成', 'references/multi-agent-review.md', '每个 reviewer 都是 manifest 中的必需 child', '只看到父 worker 的 worker_done 就算 reviewer 完成', 'child-accounting'],
  ['极速 review 未完成不得出最终结论', 'references/multi-agent-review.md', '不能输出最终整合 verdict', '可以用部分 reviewer 结果输出最终整合 verdict', 'incomplete-aggregation'],
  ['单 Agent 任务不触发本 Skill', 'SKILL.md', '一个 agent 可独立完成的任务不要使用本 skill', '所有任务都使用本 skill', 'skill-trigger'],
  ['确认实际 Dispatch receipt', 'SKILL.md', '每个 worker 必须核验 Dispatch receipt/handle。', '检查 --help 后即可视为启动成功。', 'launch-receipt'],

  ['启动失败后停止报告', 'SKILL.md', '启动失败或不确定时停止报告', '启动失败时改用本地 gateway', 'orca-launch-failure'],
  ['父 worker 汇报前逐项核对 child', 'references/coordinator-protocol.md', '必须按 manifest 逐项核对每个必需 child', '可以只统计收到的 worker_done 数量', 'child-accounting'],
  ['部分状态优先告知用户', 'references/coordinator-protocol.md', '未形成可信的整体完成结论', '可以省略整体完成可信度说明', 'partial-reporting'],
  ['禁止直连模型 API 代做审查', 'SKILL.md', '禁止用 HTTP、gateway、`fetch`、`curl` 或 `ctx_execute` 调模型代做审查', '可以用 HTTP 或 gateway 生成替代审查结论', 'direct-model-call'],
  ['保留 ctx_execute 非推理用途', 'SKILL.md', '`ctx_execute` 可做非推理分析', '禁止使用 ctx_execute 做任何分析', 'analysis-tool-boundary'],

  ['安装模板使用正确启动分流', 'references/install.md', '多模型 review 默认创建 Run/Task 并用 `orchestration worker-start` 派发；只有用户明确要求完整 handoff 且不需要当前协调器跟进时才用 `orca-cli`。', '所有多模型 review 均用 orca-cli handoff。', 'orca-launch-routing'],
  ['安装模板明确 orca-cli 边界', 'references/install.md', '启动路由：多模型 review 默认用 orchestration 创建 Run/Task 并用 worker-start 派发；只有完整 handoff 且当前不跟进时才用 orca-cli。', 'orca-cli 负责等待和质量门。', 'orca-launch-routing'],

  ['Orchestration reference 禁止推理 API 回退', 'references/agent-launch.md', '禁止用 `ctx_execute`、JavaScript `fetch`、`curl`、`child_process`、直接 HTTP 或本地 gateway 的 `/v1/chat/completions` 生成审查结论或替代角色交付。', '允许用 HTTP 或 gateway 生成审查结论。', 'direct-model-call'],
  ['Orchestration reference 保留非推理分析', 'references/agent-launch.md', '`ctx_execute` 仍可用于不调用模型的本地分析', '禁止使用 ctx_execute 分析本地数据', 'analysis-tool-boundary'],
  ['Dispatch receipt 必须有有效 handle', 'references/agent-launch.md', '启动后核对 Dispatch receipt、outcome、Task/Dispatch ID 和 worker handle。', '检查 help 后算启动成功。', 'launch-receipt'],
  ['Orchestration 启动失败后停止', 'references/agent-launch.md', '若 Orca CLI 不可用、`worker-start` 被拒绝、模型解析失败、receipt 缺失或结果不确定，停止该角色', '遇到启动失败就调用备用 gateway', 'orca-launch-failure'],


  ['安装模板禁止 API 回退', 'references/install.md', 'Orca 启动失败或结果不确定时停止并报告，不要用 HTTP、本地 gateway 或 ctx_execute 调用模型代替 Agent。', 'Orca 启动失败后可用 HTTP 或本地 gateway 代替 Agent。', 'direct-model-call'],
  ['三次空 wait 检查', 'references/recovery.md', '连续 3 次 `check --wait` 返回空结果后', '无限等待', 'worker-supervision'],
  ['工具失败安全分流', 'references/recovery.md', 'worker 已启动后的工具错误先记入内部执行事件', '工具错误直接映射为 Orca Task/Dispatch 终态', 'tool-failure-state'],
  ['工具重试安全', 'references/recovery.md', '只有能证明调用未启动、没有副作用且该工具契约允许时', '所有工具错误都可自动重试', 'tool-retry-safety'],

  ['等待 prompt 立即通知', 'references/recovery.md', '立即向用户报告 Dispatch、等待原因及所需操作', '继续空等', 'worker-supervision'],
  ['Task 超时时限', 'references/recovery.md', '单 Task 默认最长监督时长 60 分钟', '单 Task 无限运行', 'worker-timeout'],
  ['超时不自动停止', 'references/recovery.md', '不自动 stop、abandon、retry 或 release', '自动 stop 并 retry', 'worker-timeout'],
  ['当前编排设置入口', 'references/install.md', '打开 Orca Settings → Orchestration', '打开未核实的设置入口', 'install-entry'],
  ['请求级档位证据', 'references/recovery.md', '实际采用的档位须关联到该请求的 gateway 日志', '仅按 launch.effective 判定实际档位', 'effort-evidence'],
  ['未核实档位汇报', 'references/recovery.md', '生效档位待核实', '已确认生效', 'effort-evidence'],
  ['用户确认派发额度', 'references/recovery.md', '该 ceiling 是经过用户确认的执行额度', '该 ceiling 是固定的自动额度', 'dispatch-budget'],
  ['临近额度先停派', 'references/recovery.md', '停止新派发，列出剩余工作并询问是否增加额度', '继续派发直到额度耗尽', 'dispatch-budget'],
  ['修复按关卡与范围计数', 'references/coordinator-protocol.md', '每个 `gate × review scope` 的修复轮次分别计数，最多 2 轮', '允许无限修复', 'repair-budget'],
  ['Child 状态聚合门', 'references/coordinator-protocol.md', '全部必需 child 有可核验最终结果、每个关联 Orca 状态已对账且证据齐全时才可为 `complete`', '只要父 worker 有摘要就可为 `complete`', 'incomplete-aggregation'],
  ['Worker spec 使用 XML 根元素', 'references/coordinator-protocol.md', '根元素为 `<worker_spec>`', '格式不限', 'worker-spec-xml'],
  ['Worker spec XML 解析失败不得派发', 'references/coordinator-protocol.md', '解析失败或残留占位符时不得派发', '解析失败时仍可派发', 'worker-spec-xml'],
  ['部分状态汇报字段', 'references/coordinator-protocol.md', '计划任务总数及各状态计数；每个 Task/Dispatch 的 ID、原始状态和查询/回执依据', '只汇报一个整体状态', 'partial-reporting'],
  ['PPT 后置事实门', 'references/coordinator-protocol.md', 'PPT worker 完成并冻结产物后，coordinator 必须再派 fact-checker 核对幻灯片文本、图表标签和数据', 'PPT 视觉自查后直接交付', 'ppt-facts'],
  ['PRD 结论枚举', 'roles/requirement-auditor.md', '- `--body` 第一行写 `VERDICT: SHIP`', '- `--body` 第一行写 `VERDICT: PASS`', 'prd-verdict'],
  ['用户 PRD 不代改', 'roles/requirement-auditor.md', 'coordinator 不得转派 worker 修改用户 PRD', 'coordinator 可转派 worker 修改用户 PRD', 'prd-ownership'],

  // 透明汇报契约
  ['报告适用范围', 'references/worker-lifecycle.md', 'coordinator 的本地报告格式，不是 Orca API 状态；适用于 `complete`、`partial`、`incomplete`、`unknown`、`escalation` 全部结论', '仅适用于 partial 状态', 'report-scope'],
  ['交付结论把握度', 'references/worker-lifecycle.md', '交付结论与把握度', '只需交付结论', 'report-confidence'],
  ['执行轨迹与行动足迹', 'references/worker-lifecycle.md', '执行轨迹与行动足迹', '只需最终状态', 'report-trace'],
  ['可抽检凭证', 'references/worker-lifecycle.md', '可抽检凭证', '无需凭证', 'report-evidence'],
  ['核心取舍与隐式假设', 'references/worker-lifecycle.md', '核心取舍与隐式假设', '无需记录假设', 'report-assumptions'],
  ['盲区与待确认项', 'references/worker-lifecycle.md', '盲区与待确认项', '不必列盲区', 'report-blind-spots'],
  ['Complete 证据齐全门槛', 'references/worker-lifecycle.md', '仅在所有必需 child 有可核验最终结果、关联 Orca 状态已对账且证据齐全时成立', '只需 worker_done 即可标为 complete', 'report-complete-gate'],
  ['Worker 自主决策披露', 'references/worker-lifecycle.md', '原因 → 决定 → 影响与回退方式/位置', '只写最终结果，不披露自主选择', 'worker-autonomy-report'],
  ['自主权不得替代授权', 'references/worker-lifecycle.md', '不得以事后披露替代授权', '不可逆动作可以做完再补报', 'worker-autonomy-boundary'],
  ['清理边界保护他人资源', 'references/worker-lifecycle.md', '不删除用户/他人文件或未知归属资源', '为通过清理声明删除未知归属文件', 'worker-cleanup-boundary'],
  ['完整性与 Mock 声明', 'references/worker-lifecycle.md', '披露 TODO/占位、截断、省略、mock/hardcode', '无需披露 TODO、mock 或弱化校验', 'worker-completeness-report'],
  ['约束与信源分类', 'references/worker-lifecycle.md', '区分本次工具实际读取/检索所得、用户/spec 提供和模型先验推断', '模型先验也可写成实时核实', 'worker-source-report'],
  ['Coordinator 逐 child 透传', 'references/coordinator-protocol.md', '按 child 分别透传职责、关键动作/产物', '只汇报整体摘要', 'child-transparent-report'],
  ['交接契约核对', 'references/coordinator-protocol.md', '核验接口字段/格式、命名、版本/hash', '各 child 独立通过即可视为契约一致', 'handoff-contract-check'],
  ['自主决策验收场景', 'references/acceptance-scenarios.md', 'Autonomous choice disclosure', 'Autonomous decision omitted', 'worker-autonomy-report'],
  ['现场残留验收场景', 'references/acceptance-scenarios.md', 'Temporary artifact residue', 'Temp files ignored', 'worker-cleanup-boundary'],
  ['完整性 Mock 验收场景', 'references/acceptance-scenarios.md', 'Truncated or mocked delivery', 'Partial output accepted', 'worker-completeness-report'],
  ['红线传递验收场景', 'references/acceptance-scenarios.md', 'Constraint transmission', 'Constraint omitted', 'worker-constraint-report'],
  ['并行契约验收场景', 'references/acceptance-scenarios.md', 'Parallel contract conflict', 'Parallel outputs merged', 'handoff-contract-check'],
  ['信源性质验收场景', 'references/acceptance-scenarios.md', 'Prior knowledge presented as live evidence', 'Memory treated as evidence', 'worker-source-report'],

  // 资源责任契约
  ['Coordinator 资源责任', 'references/coordinator-protocol.md', 'coordinator 对自己启动的 worker 负责盘点并处理资源结算', 'worker 自行结算资源', 'resource-owner'],
  ['NextAction 非执行证明', 'references/coordinator-protocol.md', '`projection.nextAction` 是建议而非执行证明', '`projection.nextAction` 是已执行状态', 'resource-action-evidence'],
  ['保留依据记录', 'references/coordinator-protocol.md', '保留资源必须逐项记录依据', '保留资源无需记录依据', 'resource-retain-reason'],
  ['资源状态分离', 'references/coordinator-protocol.md', '`released` 不代表任务通过，`retained` 不代表 worker 未完成，worker 完成也不代表终端已释放', '`released` 代表任务通过', 'resource-state-separation'],
  ['释放未知状态按回执恢复', 'references/coordinator-protocol.md', '`release_pending` / `release_unknown` 必须沿当前 recovery guide 按回执对账恢复，绝不用 `terminal close` 替代', 'release_unknown 时直接 terminal close', 'resource-release-recovery'],
  ['SKILL 入口引用透明汇报契约', 'SKILL.md', '所有结论都按 `references/worker-lifecycle.md「Coordinator 用户可见汇报契约」`交代把握度、假设、行动足迹、抽检凭证和盲区', '所有结论只给最终摘要', 'report-scope'],
  ['SKILL 入口强调 worker 资源责任', 'SKILL.md', 'coordinator 对自己启动的 worker 负责结算', 'worker 完成后无人负责结算资源', 'resource-owner'],
  ['资源验收场景禁止误认 nextAction 已执行', 'references/acceptance-scenarios.md', 'nextAction只是建议；未经回执/查询确认不能记为已释放', '看到 nextAction 即记为已释放', 'resource-action-evidence'],
];
for (const [label, path, from, to, code] of boundaryMutations) {
  test(`${label}：有效规则通过`, () => assert.ok(!validateDocuments(original).some(error => error.startsWith(`${code}:`))));
  test(`${label}：删除或反转规则时拒绝`, () => reject(mutate(original, path, from, to), code));
}
test('角色专属 worker_done 格式不扩散整体汇报模板', () => {
  const originalPrompt = '<role_prompt role="writer" name="撰稿人">';
  const expandedPrompt = `${originalPrompt}\n  <report_contract>## Coordinator 用户可见汇报契约：交付结论与把握度、执行轨迹与行动足迹、可抽检凭证、核心取舍与隐式假设、盲区与待确认项</report_contract>`;
  reject(mutate(original, 'roles/writer.md', originalPrompt, expandedPrompt), 'role-report-isolation');
});

test('worker Done body中三句话仍在 coder 角色，不进入 lifecycle 通用契约', () => {
  assert.ok(original.get('roles/coder.md').includes('`--body`：三句话'));
  assert.ok(!original.get('references/worker-lifecycle.md').includes('`--body`：三句话'));
});
for (const role of ['coder', 'frontend']) {
  test(`${role} 允许待更新测试但禁止假绿`, () => assert.deepEqual(validateDocuments(original), []));
  test(`${role} 删除测试状态区分时拒绝`, () => reject(mutate(original, `roles/${role}.md`, '必须记录 `verification_status=failed`', '记录测试通过'), 'implementation-gate'));
}
for (const role of ['architect', 'reviewer', 'red-team']) {
  test(`${role} 具有独占报告文件契约`, () => assert.deepEqual(validateDocuments(original), []));
  test(`${role} 报告退化为目录时拒绝`, () => reject(mutate(original, `roles/${role}.md`, '实际存在的完整', '渲染输出目录中的'), 'report-file'));
}
for (const role of ['researcher', 'fact-checker']) {
  test(`${role} 网页隔离规则通过`, () => assert.deepEqual(validateDocuments(original), []));
  test(`${role} 允许携带密钥浏览时拒绝`, () => reject(mutate(original, `roles/${role}.md`, '不能退回携带密钥的共享工作区继续浏览', '可以退回携带密钥的共享工作区继续浏览'), 'web-isolation'));
}
