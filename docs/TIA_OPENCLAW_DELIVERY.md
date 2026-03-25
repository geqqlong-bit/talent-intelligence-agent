# TIA OpenClaw Delivery

## 交付内容

- `openclaw.plugin.json`：OpenClaw provider plugin manifest
- `index.js`：插件入口，注册 8 个 TIA 工具
- `src/tia/`：PostgreSQL 仓储、demo-memory 仓储、评估/CC/风控/报告/offer 核心服务
- `skills/`：6 个业务技能说明
- `agents/`：Orchestrator / Client / Candidate / Hunter 的 SOUL
- `HEARTBEAT.md`：主动行为调度规则
- `sql/tia_schema.sql`：PostgreSQL + pgvector schema
- `sql/tia_seed.sql`：与六视图工作台对齐的示例数据
- `server/`：HTTP API、WebSocket 日志流与 Dashboard 服务
- `public/tia-dashboard.html`：可操作的 TIA 工作台
- `tests/`：服务级测试与 HTTP/WebSocket 烟雾验证

## 当前工作台能力

- 六视图工作台：主控台 / BD开发 / 职位管理 / 候选人看板 / Offer & 交付 / AI工作台
- 聚合接口：`GET /api/tia/workbench`
- AI 协作接口：`POST /api/tia/copilot`
- 结构化动作：`/assess` `/cc` `/report` `/offer` `/stage`
- 实时日志：`GET /api/tia/logs/history` + `ws://.../api/tia/logs/stream`

## 安装步骤

1. 安装依赖：

```bash
npm install
```

2. 初始化数据库：

```bash
psql "$PG_URL" -f sql/tia_schema.sql
psql "$PG_URL" -f sql/tia_seed.sql
```

3. 安装插件：

```bash
openclaw plugins install /absolute/path/to/talent-intelligence-agent
```

4. 参考 `openclaw.example.json` 配置 `plugins.entries.tia.config` 与 `tools.allow`。

5. 启动本地 HTTP 服务：

```bash
npm run start
```

6. 打开工作台：

```text
http://127.0.0.1:8788/tia
```

## Demo 模式

如果没有配置 `PG_URL`，TIA 会自动回退到内置的 demo-memory 数据集：

- `GET /api/tia/*` 仍然可用
- Dashboard 可直接交互
- 报告仍会写入 `state/reports/`
- 适合本地演示和前端联调

生产环境仍建议配置 PostgreSQL + pgvector。

## 验证

- 服务测试：

```bash
npm test
```

- HTTP / WebSocket 烟雾测试：

```bash
npm run test:tia:e2e
```

- `/api/tia/positions`
- `/api/tia/workbench`
- `/api/tia/positions/:positionId/context`
- `/api/tia/candidates?position_id=<id>`
- `/api/tia/clients`
- `/api/tia/touch-records`
- `/api/tia/funnel`
- `/api/tia/alerts`
- `/api/tia/copilot`
- `/api/tia/logs/history`
- `ws://127.0.0.1:8788/api/tia/logs/stream`
- `tia_assess`
- `tia_cc`
- `tia_report`
- `tia_offer`
