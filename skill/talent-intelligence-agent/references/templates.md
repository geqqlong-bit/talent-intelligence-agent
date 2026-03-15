# Templates

Use these template IDs when building the workflow payload.

## `jd_diagnosis_cn`
Use for JD analysis, role clarification, hiring difficulty diagnosis, must-have vs nice-to-have breakdown, and requirement tuning.

Suggested output style:
- 一页结论 / 项目背景
- 岗位本质判断
- 必须项 / 加分项 / 可降级项
- 风险判断与建议版 JD 结构
- 面试追问与下一步建议

## `sourcing_strategy_cn`
Use for target-company mapping, talent pool definition, channel planning, keyword design, and Boolean search generation.

Suggested output style:
- 一页结论 / 项目背景
- 核心画像 / 相邻画像 / 不建议画像
- 目标公司地图
- 渠道优先级 / 关键词 / Boolean 示例
- 前两周执行计划与过程指标

## `candidate_assessment_cn`
Use for resume review, candidate fit assessment, interview debrief support, risk flags, and push-or-pass decisions.

Suggested output style:
- 结论先行
- 匹配度快照
- 主要亮点 / 关键风险
- 重点验证假设
- 建议追问清单
- 推荐动作与推进前提

## `search_plan_cn`
Use for end-to-end search planning, weekly execution plans, progress checkpoints, and client advisory recommendations.

Suggested output style:
- 一页结论 / 项目成功定义
- 分阶段推进节奏（kickoff / 市场验证 / 重点推进 / offer 预判）
- 周会建议议程
- 过程指标看板
- 主要风险与对策
- 顾问建议的下一步

## Selection heuristic

- User wants to understand or fix a role -> `jd_diagnosis_cn`
- User wants to know where or how to find people -> `sourcing_strategy_cn`
- User wants to evaluate a person or resume -> `candidate_assessment_cn`
- User wants a broader recruiting execution plan -> `search_plan_cn`
