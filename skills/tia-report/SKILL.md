---
name: tia-report
description: 生成标准化推荐报告，输出 Markdown，并落地到 report 目录。
metadata:
  openclaw:
    requires:
      bins:
        - node
      config:
        - plugins.entries.tia.config.reportDir
---

# tia-report

使用 `tia_report` 生成客户可直接阅读的推荐报告。

报告至少包含：

- 候选人摘要
- 核心优势
- 风险点
- 匹配度分析
- 建议面试方向
- 顾问推荐意见
