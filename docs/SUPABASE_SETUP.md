# Supabase 接入手册

## 目的

这份文档说明如何用 `Supabase Postgres` 作为 TIA 项目的外部数据库，并让新同事可以在一台 Mac 上快速起一个可用环境。

适用场景：

- 本机运行 OpenClaw
- 本机运行 TIA Node 服务
- 数据库存放在 Supabase
- 可选接入远程 LLM / Embedding API

相关项目文件：

- 数据库结构：[sql/tia_schema.sql](/Users/na/na/Antigravity/talent-intelligence-agent/sql/tia_schema.sql)
- 示例数据：[sql/tia_seed.sql](/Users/na/na/Antigravity/talent-intelligence-agent/sql/tia_seed.sql)
- 配置读取：[src/tia/config.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/src/tia/config.mjs)
- OpenClaw 示例配置：[openclaw.example.json](/Users/na/na/Antigravity/talent-intelligence-agent/openclaw.example.json)

## 为什么推荐 Supabase

对当前项目来说，Supabase 的好处是：

- 本质就是标准 PostgreSQL，和现有 SQL / `pg` 驱动直接兼容
- 官方提供标准连接串，适合 `psql`、Node 后端和 GUI 工具
- 支持连接池和 `pgvector` 这类扩展能力

官方参考：

- [Supabase 连接数据库文档](https://supabase.com/docs/reference/postgres/connection-strings)
- [Supabase Session / Transaction pooler 说明](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers)

## 一、准备 Supabase 项目

### 1. 创建项目

在 Supabase 控制台创建一个新项目，创建时记住：

- 项目区域
- 数据库密码

项目创建完成后，会得到一个默认 Postgres 数据库，数据库名一般是：

```text
postgres
```

### 2. 获取连接串

在 Supabase 项目里点击 `Connect`，会看到几种连接方式。

官方建议：

- 持久运行的服务：优先 `Direct connection`
- 如果当前网络环境不支持 IPv6：使用 `Session pooler`
- 临时 serverless 连接：使用 `Transaction pooler`

对本项目来说，推荐优先级如下：

1. `Direct connection`
2. 如果本机网络对 IPv6 不友好，再用 `Session pooler`

一个典型连接串长这样：

```text
postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxxx.supabase.co:5432/postgres
```

如果使用 Session pooler，通常类似：

```text
postgres://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

## 二、初始化数据库

### 1. 设置连接串

在项目根目录执行：

```bash
export PG_URL="postgresql://postgres:你的密码@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"
```

你也可以用 `TIA_PG_URL`，但建议统一使用 `PG_URL`。

### 2. 执行 schema

```bash
psql "$PG_URL" -f sql/tia_schema.sql
```

这一步会创建：

- 枚举类型
- 数据表
- 索引
- `pgcrypto`
- `vector`

### 3. 导入示例数据

```bash
psql "$PG_URL" -f sql/tia_seed.sql
```

导入完成后，Supabase 中会有和当前六视图工作台一致的一批客户、职位、候选人和跟进记录。

## 三、本机启动项目

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm run start
```

启动后打开：

```text
http://127.0.0.1:8788/tia
```

### 3. 验证是否已经连接 Supabase

用 `psql` 直接检查：

```bash
psql "$PG_URL" -c "SELECT id, name FROM clients;"
psql "$PG_URL" -c "SELECT id, title FROM positions;"
psql "$PG_URL" -c "SELECT id, name, stage FROM candidates ORDER BY updated_at DESC LIMIT 10;"
```

如果工作台里修改候选人状态、重启服务后数据还在，也说明已经不是 `demo-memory`。

## 四、在 OpenClaw 中配置 Supabase

如果你是通过 OpenClaw 使用这个项目，推荐在 OpenClaw 插件配置里写 `pgUrl`。

参考：[openclaw.example.json](/Users/na/na/Antigravity/talent-intelligence-agent/openclaw.example.json)

示例：

```json
{
  "plugins": {
    "entries": {
      "tia": {
        "enabled": true,
        "config": {
          "pgUrl": "postgresql://postgres:你的密码@db.xxxxxxxxxxxxx.supabase.co:5432/postgres",
          "llmBaseUrl": "https://api.openai.com/v1",
          "llmApiKey": "sk-xxx",
          "llmModel": "qwen-max",
          "reportDir": "./state/reports"
        }
      }
    }
  },
  "tools": {
    "allow": [
      "tia"
    ]
  }
}
```

注意：

- `pgUrl` 是给 OpenClaw 插件用的
- `PG_URL` 是给本地直接启动 `npm run start` 用的
- 如果两种方式都会跑，建议两边都配成同一个数据库

## 五、推荐团队使用方式

如果你要让别的人快速上手，建议用下面这套：

- 共享一个 Supabase 项目作为团队开发环境
- 每个人本地只跑 OpenClaw + TIA Node 服务
- 数据统一进同一个 Supabase

优点：

- 本地环境轻
- 团队数据一致
- 不用每台电脑单独装 PostgreSQL

如果后面团队人数变多，再拆：

- 一个共享开发库
- 一个共享测试库
- 一个正式生产库

## 六、推荐配置策略

### 开发环境

- `Supabase Session pooler`
- 共享一套演示数据
- 报告输出保留本地目录

### 稍稳定的内测环境

- `Direct connection` 或 `Session pooler`
- 独立 Supabase 项目
- 单独保存真实测试数据

### 正式环境

- 独立 Supabase 项目
- 严格区分测试和生产
- 控制数据库访问账号和 API Key

## 七、常见问题

### 1. 连接 Supabase 失败

常见原因：

- 密码错误
- 连接串复制不完整
- 当前网络不支持 IPv6，但你用了 Direct connection

处理方法：

- 先在终端验证：

```bash
psql "$PG_URL" -c "SELECT NOW();"
```

- 如果 Direct 连不上，改用 Supabase 的 `Session pooler`

### 2. schema 初始化时报扩展错误

当前项目依赖：

- `pgcrypto`
- `vector`

Supabase 通常支持这些扩展；如果失败，先到项目控制台确认扩展能力是否可用，再重新执行初始化脚本。

### 3. 为什么项目里还会写本地文件

数据库负责结构化业务数据。

报告文件仍然会写入本地 `reportDir`，默认是：

```text
state/reports
```

这和 Supabase 并不冲突。

### 4. 能不能直接用 Supabase REST API，不走 PostgreSQL 连接串

当前项目不是按 Supabase JS SDK 或 REST API 写的，而是标准 `pg` 驱动直连 PostgreSQL。  
所以这里推荐的接法是：**把 Supabase 当作托管 PostgreSQL 来用。**

## 八、最短上手路径

给新同事的最短路径如下：

1. 在 Supabase 控制台创建项目
2. 点击 `Connect` 拿数据库连接串
3. 在本地设置 `PG_URL`
4. 执行初始化 SQL
5. 启动服务

命令如下：

```bash
export PG_URL="postgresql://postgres:你的密码@db.xxxxxxxxxxxxx.supabase.co:5432/postgres"
psql "$PG_URL" -f sql/tia_schema.sql
psql "$PG_URL" -f sql/tia_seed.sql
npm install
npm run start
```

然后访问：

```text
http://127.0.0.1:8788/tia
```
