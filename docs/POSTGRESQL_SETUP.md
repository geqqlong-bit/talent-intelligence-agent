# PostgreSQL 使用手册

## 目的

这份文档说明如何把 TIA 项目从内置 `demo-memory` 切换到真实 `PostgreSQL`。

切换后，以下数据会持久化存储：

- 客户 `clients`
- 客户偏好 `client_preferences`
- 职位 `positions`
- 候选人 `candidates`
- 跟进记录 `touch_records`

项目内相关文件：

- 数据库结构：[sql/tia_schema.sql](/Users/na/na/Antigravity/talent-intelligence-agent/sql/tia_schema.sql)
- 示例数据：[sql/tia_seed.sql](/Users/na/na/Antigravity/talent-intelligence-agent/sql/tia_seed.sql)
- 配置读取：[src/tia/config.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/src/tia/config.mjs)
- 服务启动：[server/index.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/server/index.mjs)

## 运行原理

TIA 启动时会优先尝试连接 PostgreSQL。

- 如果配置了 `PG_URL` 或 `TIA_PG_URL` 且连接成功，就使用 PostgreSQL
- 如果未配置，或连接失败，就自动回退到内置 `demo-memory`

相关逻辑见 [src/tia/config.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/src/tia/config.mjs#L20) 和 [src/tia/service-container.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/src/tia/service-container.mjs#L31)

## 前置要求

你需要准备以下环境：

- `Node.js >= 20`
- 一个可访问的 PostgreSQL 实例
- 命令行工具 `psql`

如果你还没有 PostgreSQL，建议优先选托管实例：

- `Supabase`：最适合现在这套项目
- `Neon`：适合开发测试
- `Render Postgres`：适合后续把服务也托管上云

## 一、准备 PostgreSQL 数据库

你需要拿到一个连接串，格式如下：

```text
postgresql://用户名:密码@主机:端口/数据库名
```

例子：

```text
postgresql://postgres:abc123@127.0.0.1:5432/tia
```

如果你使用 Supabase，一般可以在项目控制台找到数据库连接串。

## 二、初始化数据库

在项目根目录执行：

```bash
psql "$PG_URL" -f sql/tia_schema.sql
psql "$PG_URL" -f sql/tia_seed.sql
```

说明：

- `sql/tia_schema.sql` 会创建表、索引、枚举类型和 `pgvector` 扩展
- `sql/tia_seed.sql` 会写入与当前六视图工作台对齐的示例数据

如果你的数据库用户没有安装扩展权限，`CREATE EXTENSION vector` 可能失败。这时有两种处理方式：

- 使用已经支持 `pgvector` 的 PostgreSQL 托管服务
- 让数据库管理员先安装 `vector` 扩展

## 三、配置环境变量

项目支持以下数据库环境变量：

- `PG_URL`
- `TIA_PG_URL`

推荐直接配置 `PG_URL`：

```bash
export PG_URL="postgresql://postgres:abc123@127.0.0.1:5432/tia"
```

然后启动服务：

```bash
npm install
npm run start
```

启动后打开：

```text
http://127.0.0.1:8788/tia
```

## 四、在 OpenClaw 中配置 PostgreSQL

如果你是通过 OpenClaw 使用这个项目，可以在插件配置里写 `pgUrl`。

参考文件：[openclaw.example.json](/Users/na/na/Antigravity/talent-intelligence-agent/openclaw.example.json)

示例：

```json
{
  "plugins": {
    "entries": {
      "tia": {
        "enabled": true,
        "config": {
          "pgUrl": "postgresql://postgres:abc123@db.example.com:5432/tia",
          "llmBaseUrl": "https://api.openai.com/v1",
          "llmApiKey": "sk-xxx",
          "llmModel": "qwen-max",
          "reportDir": "./state/reports"
        }
      }
    }
  }
}
```

注意：

- `pgUrl` 是 OpenClaw 插件配置字段
- `PG_URL` / `TIA_PG_URL` 是本地直接运行 Node 服务时的环境变量

两种方式配置其一即可

## 五、如何确认已经切到 PostgreSQL

### 方法 1：看功能表现

启动后在工作台里做这些动作：

- 调整候选人阶段
- 生成推荐报告
- 写入跟进记录

然后重启服务，如果数据仍然存在，说明已经不是 `demo-memory`。

### 方法 2：直接查数据库

```bash
psql "$PG_URL"
```

进入后执行：

```sql
SELECT id, name FROM clients;
SELECT id, title FROM positions;
SELECT id, name, stage FROM candidates ORDER BY updated_at DESC;
SELECT id, touch_type, summary FROM touch_records ORDER BY created_at DESC LIMIT 20;
```

### 方法 3：看运行模式

项目内部会根据连接情况决定运行模式，逻辑在 [src/tia/service-container.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/src/tia/service-container.mjs#L29)。

- 成功连接 PostgreSQL：`storageMode = postgres`
- 连接失败或未配置：`storageMode = demo-memory`

## 六、推荐部署方式

如果你是在一台 MacBook Air 上本地跑 OpenClaw，推荐这样使用：

- 本机运行：OpenClaw + TIA Node 服务 + Web UI
- 外部托管：PostgreSQL
- 可选外部托管：LLM / Embedding API

这是当前最稳妥的结构，因为本机只负责：

- 页面展示
- HTTP API
- 报告生成
- 业务规则判断

不会把数据库和模型推理都压在本机上。

## 七、Notion 能不能替代 PostgreSQL

不建议。

Notion 更适合做：

- 客户会议纪要
- 顾问知识库
- BD 台账
- 项目周报

不适合直接承担这套系统的主数据库职责，因为这套系统需要：

- 结构化查询
- 多视图聚合
- 阶段流转
- 高频写入
- 风险扫描
- 相似案例与后续向量检索能力

建议做法：

- PostgreSQL 做主库
- Notion 做协作层和展示层

## 八、常见问题

### 1. 启动后还是演示数据

通常有三种原因：

- 没有配置 `PG_URL`
- `PG_URL` 配了但连不上
- 数据库 schema 还没初始化

先检查：

```bash
echo "$PG_URL"
psql "$PG_URL" -c "SELECT NOW();"
```

### 2. 执行 `sql/tia_schema.sql` 时报 `vector` 扩展错误

说明当前 PostgreSQL 没有 `pgvector`。

处理方式：

- 换支持 `pgvector` 的托管实例
- 或让管理员执行扩展安装

### 3. 为什么报告文件还写在本地

因为报告输出目录走的是 `reportDir`，默认值在 [src/tia/config.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/src/tia/config.mjs#L27)，默认会写到：

```text
state/reports
```

这和数据库是否使用 PostgreSQL 是两回事。

### 4. OpenClaw 和本地 Node 服务都需要配置数据库吗

看你怎么运行：

- 如果只通过 OpenClaw 插件调用，通常配 `openclaw` 插件里的 `pgUrl`
- 如果你还会直接 `npm run start` 跑本地服务，最好同时配本地 `PG_URL`

## 九、最短操作路径

如果你只是要尽快跑起来，按下面做：

1. 准备一个 PostgreSQL 实例
2. 设置连接串
3. 执行初始化
4. 启动服务

命令如下：

```bash
export PG_URL="postgresql://postgres:abc123@127.0.0.1:5432/tia"
psql "$PG_URL" -f sql/tia_schema.sql
psql "$PG_URL" -f sql/tia_seed.sql
npm install
npm run start
```

然后访问：

```text
http://127.0.0.1:8788/tia
```
