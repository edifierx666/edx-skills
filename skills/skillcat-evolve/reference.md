# SkillCAT 论文参考细节

> 论文：SkillCAT: Contrastive Assessment Topology-Aware Skill Self-Evolution for LLM Agents
> 作者：Kunfeng Chen, Qihuang Zhong, Juhua Liu, Bo Du
> 链接：https://arxiv.org/abs/2606.13317
> 性质：training-free（不微调模型），只进化 skill 文本

## 关键超参数

| 参数 | 论文取值 | 说明 |
| --- | --- | --- |
| 轨迹采样种子数 K | 5 | 在 {1,3,5,7,9} 中扫参，5 为精度-成本最优；采样耗时从 1 seed 约 23 分钟到 9 seeds 约 4.7 小时 |
| 评估分数门槛 θ | 2.0 | 只保留 失败→成功(3分) 与 成功→成功(2分) 补丁 |
| 路由预算 top-k | 7 | prompt-based LLM graph router；对比过 embedding 检索（top-k=3 时峰值 57.00% Vrf） |
| 进化/测试划分 | 200/200 | SpreadsheetBench-Verified 共 400 样本，测试集从不参与进化 |

## 公式

### 因果分水岭（Eq. 1）

```
wᵢ = min{ t : α⁺ₜ ≠ α⁻ₜ }
```

成功轨迹与失败轨迹动作序列的第一个分歧步。

### 评估打分（Eq. 2）

基线结局 yⱼ 与回放结局 ŷⱼ ∈ {0,1}：

| (yⱼ, ŷⱼ) | aⱼ |
| --- | --- |
| (0, 1) | 3.0 |
| (1, 1) | 2.0 |
| (0, 0) | 1.0 |
| (1, 0) | 0.0 |

对 CCE 产出的补丁，「对比对中成功侧」定义基线状态。

### 门槛筛选（Eq. 3）

保留 aⱼ ≥ θ = 2.0 的补丁。

### 分层合并（Eq. 4）

```
S⁽ℓ⁾ = μ( S⁽ℓ⁻¹⁾, 𝒫⁽ℓ⁾_θ ),  S⁽⁰⁾ = S₀,  S* = S⁽ᴸ⁾
```

按分数分层、从低层到高层依次合并；高分补丁后合入获得优先权。合并算子 μ 复用 Trace2Skill 的 skill 编辑流程，AAE 只改变「哪些补丁进合并、以什么顺序」。

### 路由与拼装（Eq. 5-6）

```
𝒱̃꜀ = ρ( c, Σ; k )          # LLM 路由器从拓扑摘要 Σ 中选 ≤k 个主节点
𝒱꜀ = Expand( 𝒱̃꜀, Σ )       # 确定性扩展：校验节点 ID、补依赖边、补基础节点
S꜀ = S∘ ⊕ ⨁_{v∈𝒱꜀} Bᵥ      # 常驻核心 + 选中节点正文，顺序字符串拼接，不重写文本
```

## 拓扑编译规则

- Markdown 一级内容 → 常驻核心 S∘（always-on）
- 二级节 → 可路由节点集 𝒱，每节点保留原文 Bᵥ，抽取 title / keywords / summary / deps 作为路由元数据，元数据汇总成拓扑摘要 Σ

## 打分设计的实证依据

197 条候选补丁按回放迁移分桶，等量抽样后各桶单独合并的下游 Vrf：

| 迁移桶 | Vrf | 相对 Trace2Skill |
| --- | --- | --- |
| 失败→成功 | 51.00% | +21.33 |
| 成功→成功 | 41.00% | +11.33 |
| 失败→失败 | 32.00% | +2.33 |
| 成功→失败 | 23.50% | −6.17 |

结论：回放迁移携带下游信号；成功→失败桶为负收益，必须拒绝。

## 实验设置摘要

- Agent 框架：ReAct 风格，文件系统 + 表格工具
- 基准：SpreadsheetBench-Verified、WikiTableQuestions（转成 xlsx 格式复用同一 skill）、DocVQA（2700 进化 / 2649 评估）
- 两种初始化：Skill Deepening（从 Anthropic 官方人写 xlsx skill 起步）、Skill Creation（从弱的 prompt 生成 skill 起步）
- 跨模型 OOD 提升最高 40.40%
- TTE 收益：LLM graph router 在 55.50% Vrf 下减少 41.6% 上下文；零 TTE（全量加载）基线 46.50% Vrf

## 论文反对的三个先前做法（本 skill 的设计动机）

1. 单轨迹学习：把运气与任务难度误当技能证据 → 用同任务对比对替代
2. 先合并后验证（premature merging）：坏补丁污染 skill → 验证与打分前置
3. 推理时全量加载 skill 语料 → 拓扑路由按需加载
