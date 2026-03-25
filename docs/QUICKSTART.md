# TIA Quickstart

## 适合谁看

这份文档给第一次接手这个项目的人用。

如果你想尽快把项目跑起来，不想先读完整实现细节，就从这里开始。

## 你会得到什么

完成这份 Quickstart 后，你会拿到一套可运行环境：

- 本机 OpenClaw
- 本机 TIA Node 服务
- 本机 Web 工作台
- 外部 PostgreSQL 数据库

打开地址：

```text
http://127.0.0.1:8788/tia
```

## 先看哪份文档

根据你的情况走：

### 场景 A：你只想先理解 PostgreSQL 怎么接

看：

- [POSTGRESQL_SETUP.md](/Users/na/na/Antigravity/talent-intelligence-agent/docs/POSTGRESQL_SETUP.md)

### 场景 B：你准备直接用 Supabase

看：

- [SUPABASE_SETUP.md](/Users/na/na/Antigravity/talent-intelligence-agent/docs/SUPABASE_SETUP.md)

### 场景 C：你要在 Mac 上把 OpenClaw 和项目一起跑起来

看：

- [OPENCLAW_LOCAL_SETUP.md](/Users/na/na/Antigravity/talent-intelligence-agent/docs/OPENCLAW_LOCAL_SETUP.md)

## 推荐上手路径

对大多数新同事，建议按这个顺序：

1. 先准备数据库  
推荐直接用 Supabase

2. 初始化数据库

```bash
psql "$PG_URL" -f sql/tia_schema.sql
psql "$PG_URL" -f sql/tia_seed.sql
```

3. 安装项目依赖

```bash
npm install
```

4. 安装 OpenClaw 插件

```bash
openclaw plugins install "$(pwd)"
```

5. 配置数据库连接

```bash
export PG_URL="postgresql://用户名:密码@主机:5432/数据库名"
```

6. 启动本地服务

```bash
npm run start
```

7. 打开工作台

```text
http://127.0.0.1:8788/tia
```

8. 跑测试确认

```bash
npm test
npm run test:tia:e2e
```

## 最短命令版

如果你已经有数据库连接串，可以直接照抄：

```bash
npm install
export PG_URL="postgresql://用户名:密码@主机:5432/数据库名"
psql "$PG_URL" -f sql/tia_schema.sql
psql "$PG_URL" -f sql/tia_seed.sql
openclaw plugins install "$(pwd)"
npm run start
```

然后访问：

```text
http://127.0.0.1:8788/tia
```

## 关键文件在哪里

- 数据库结构：[sql/tia_schema.sql](/Users/na/na/Antigravity/talent-intelligence-agent/sql/tia_schema.sql)
- 示例数据：[sql/tia_seed.sql](/Users/na/na/Antigravity/talent-intelligence-agent/sql/tia_seed.sql)
- OpenClaw 插件清单：[openclaw.plugin.json](/Users/na/na/Antigravity/talent-intelligence-agent/openclaw.plugin.json)
- OpenClaw 示例配置：[openclaw.example.json](/Users/na/na/Antigravity/talent-intelligence-agent/openclaw.example.json)
- 本地服务入口：[server/index.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/server/index.mjs)
- 工作台页面：[public/tia-dashboard.html](/Users/na/na/Antigravity/talent-intelligence-agent/public/tia-dashboard.html)

## 如果出错，先查这几个地方

- 数据库没初始化：重新执行 `sql/tia_schema.sql` 和 `sql/tia_seed.sql`
- 页面还是演示数据：检查 `PG_URL`
- OpenClaw 调不到插件：检查 `openclaw.plugin.json` 和 `tools.allow`
- 页面打不开：确认 `npm run start` 已启动，端口默认是 `8788`

## 更详细的文档索引

- 总体交付说明：[TIA_OPENCLAW_DELIVERY.md](/Users/na/na/Antigravity/talent-intelligence-agent/docs/TIA_OPENCLAW_DELIVERY.md)
- PostgreSQL 使用手册：[POSTGRESQL_SETUP.md](/Users/na/na/Antigravity/talent-intelligence-agent/docs/POSTGRESQL_SETUP.md)
- Supabase 接入手册：[SUPABASE_SETUP.md](/Users/na/na/Antigravity/talent-intelligence-agent/docs/SUPABASE_SETUP.md)
- OpenClaw 本机安装与配置手册：[OPENCLAW_LOCAL_SETUP.md](/Users/na/na/Antigravity/talent-intelligence-agent/docs/OPENCLAW_LOCAL_SETUP.md)
