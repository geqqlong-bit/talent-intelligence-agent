---
name: tia-classify
description: 智能意图分类与主动澄清。将用户输入路由到最佳模板，并在信息不足时主动要求补充。
metadata:
  openclaw:
    requires:
      bins:
        - node
---

# tia-classify

使用 `tia_classify` + `tia_rag` + `tia_validate` 构建完整的智能路由流程。

## 推荐流程

1. **分类** — 调 `tia_classify` 判断意图，获得 `templateId`。
   - 若返回 `needsClarification: true`，先向用户追问缺失信息。
2. **RAG 注入** — 调 `tia_rag` 获取领域知识，补充到上下文中。
3. **执行** — 根据 `templateId` 执行对应任务。
4. **验证** — 调 `tia_validate` 检查输出是否符合专家规则。
   - 若 `passed: false`，根据 `feedback` 修正后重试。

## 注意

- 不要跳过分类步骤，即使用户意图看似明确。
- 验证步骤是质量保障的最后一道关卡，必须执行。
