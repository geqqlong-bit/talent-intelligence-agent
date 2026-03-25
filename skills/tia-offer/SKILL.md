---
name: tia-offer
description: 生成 offer 谈判分析，包括风险等级、客户侧话术、候选人侧话术和时间节点建议。
metadata:
  openclaw:
    requires:
      bins:
        - node
---

# tia-offer

使用 `tia_offer` 处理 offer 风险与谈判判断。

输出必须结构化，至少包含：

- `riskLevel`
- `clientScript`
- `candidateScript`
- `timeline`
- `counterOfferResponse`
- `recommendation`
