---
name: tia-workbench
description: 获取顾问工作台完整快照，包含 Dashboard 指标、优先事项、漏斗、BD 分析、职位看板、Offer 谈判和 AI 工作台。
metadata:
  openclaw:
    requires:
      bins:
        - node
      config:
        - plugins.entries.tia.config.pgUrl
---

# tia-workbench

使用 `tia_workbench` 获取一站式工作台数据。

## 返回数据结构

| 模块 | 说明 |
|---|---|
| `dashboard.metrics` | 已确认佣金、活跃职位数、管线候选人数、平均成单周期 |
| `dashboard.priorities` | 最紧急的待办事项（风险预警 + 跟进动作） |
| `dashboard.funnel` | 全阶段漏斗统计 |
| `bd.clients` | 客户分层（明星/金牛/潜力/观察）+ 合同到期提醒 |
| `bd.opportunities` | BD 机会（续签、扩单） |
| `positions.items` | 职位卡片（天数、推荐人数、风险等级） |
| `kanban.columns` | 选中职位的候选人看板（7 阶段） |
| `offer.negotiations` | Offer 谈判中的候选人列表 |
| `offer.followUps` | 已成单候选人的回访状态 |
| `aiWorkbench.actions` | 可用的 AI Copilot 快捷任务列表 |

## 使用规则

1. 可传 `position_id` 聚焦到某个职位，不传则返回全局视图。
2. 适用于「今日概览」「盘点」「给客户汇报」等场景。
3. 拿到数据后可结合 `tia_copilot` 进一步生成话术或报告。
