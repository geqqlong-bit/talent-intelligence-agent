# TIA HEARTBEAT

## 每 30 分钟执行

1. 调用 `tia_risk_scan`，获取当前 workflow 风险。
2. 如果出现 `urgency=HIGH` 的告警：
   输出结构化摘要，并调用通知通道推送飞书 / 企微 / Discord。
3. 检查今天是否已生成今日待办。
   如果当前时间在 08:25-08:35 且尚未发送：
   调用 `tia_risk_scan`，生成今日优先事项。
4. 检查入职回访：
   若候选人 `stage=placed` 且 `onboard_date` 距今为 30/60/90 天，生成回访提醒。
5. 检查合同到期：
   若客户 `contract_expires` 在 7 天内，提醒续签并生成续签邮件草稿。

## 输出规范

- 风险输出：结构化 JSON，字段含 `type`、`urgency`、`candidateId/positionId`、`suggestedAction`
- 今日待办：Markdown 清单
- 所有状态必须从数据库实时读取，不依赖会话记忆
