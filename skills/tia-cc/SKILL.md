---
name: tia-cc
description: 生成 CC 开场白、拒绝处理话术、收尾话术和微信 / 脉脉跟进消息。
metadata:
  openclaw:
    requires:
      bins:
        - node
---

# tia-cc

使用 `tia_cc` 生成候选人触达话术。

输出要包含：

- `opening`
- `objectionHandlers[]`
- `closing`
- `socialMessage`

如果传入 `candidate_id`，结果应自动记录到 `touch_records`。
