---
name: tia-copilot
description: AI Copilot 任务生成器。支持 BD 话术、职位诊断、市场测绘、面试辅导、推进计划、收款邮件、入职回访、短名单总结等 8 类任务。
metadata:
  openclaw:
    requires:
      bins:
        - node
---

# tia-copilot

使用 `tia_copilot` 为顾问生成专业可直接使用的 Markdown 内容。

## 支持的任务类型

| task_type | 用途 |
|---|---|
| `bd_script` | BD 开发话术（冷启动、价值判断、费率建议） |
| `jd_diagnosis` | 职位诊断（交付难点、画像建议、市场动作） |
| `market_map` | 市场测绘（目标公司池、寻访策略） |
| `interview_prep` | 面试辅导（亮点、重点、建议追问） |
| `followup_plan` | 推进跟进计划（48 小时动作、风险点） |
| `invoice_email` | 收款与交付确认邮件 |
| `onboarding_plan` | 入职回访方案（回访目标、建议提纲） |
| `shortlist_summary` | 长名单到短名单总结 |

## 使用规则

1. 必须传 `task_type`，其他参数可选但建议尽量传入以提高质量。
2. 若有具体职位，传 `position_id` 以自动拉取上下文。
3. 若有具体候选人，传 `candidate_id`。
4. `notes` 用于用户自定义补充说明。
5. 输出为结构化 Markdown，可直接发送给客户或候选人。
