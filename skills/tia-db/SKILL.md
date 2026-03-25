---
name: tia-db
description: TIA 业务数据库操作。用于读写 clients / positions / candidates / touch_records / client_preferences，并组装完整职位上下文。
metadata:
  openclaw:
    requires:
      bins:
        - node
      config:
        - plugins.entries.tia.config.pgUrl
---

# tia-db

当你需要读取职位、候选人、客户、漏斗、阶段状态时，优先使用以下工具：

- `tia_db_query`
- `tia_db_write`
- `tia_get_position_context`
- `tia_stage_update`

规则：

1. 任何和具体职位相关的判断，先调 `tia_get_position_context`。
2. 任何阶段推进都必须走 `tia_stage_update`，不要只口头说明。
3. 原始 SQL 只用于查询，写操作优先走 `tia_db_write`。
