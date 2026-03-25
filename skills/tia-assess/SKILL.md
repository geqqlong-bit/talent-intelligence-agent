---
name: tia-assess
description: 基于职位上下文、rubric 和客户偏好的结构化候选人评估。
metadata:
  openclaw:
    requires:
      bins:
        - node
      config:
        - plugins.entries.tia.config.pgUrl
        - plugins.entries.tia.config.llmModel
---

# tia-assess

使用 `tia_assess` 做候选人评估。

规则：

1. 默认先调 `tia_get_position_context`。
2. 评估输出必须包含：
   - `dimensions[]`
   - `evidenceQuotes`
   - `confidence`
   - `overallRisks`
3. 若有 `candidate_id`，评估结果必须写回 `candidates.ai_assessment`。
