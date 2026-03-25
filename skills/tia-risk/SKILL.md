---
name: tia-risk
description: TIA 风险扫描器。扫描超期未推进、offer 风险、合同到期和入职回访提醒。
metadata:
  openclaw:
    requires:
      bins:
        - node
      config:
        - plugins.entries.tia.config.pgUrl
---

# tia-risk

使用 `tia_risk_scan` 获取结构化风险预警。

适用场景：

- 今日待办
- 盘点候选人是否卡住
- 客户合同即将到期
- 入职 30/60/90 天回访提醒

输出要求：

- 使用 `alerts[]`
- 每条都要有 `urgency` 和 `suggestedAction`
