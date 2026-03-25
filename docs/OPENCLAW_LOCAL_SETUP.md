# OpenClaw 本机安装与配置手册

## 目的

这份文档用于帮助新同事在一台 Mac 上快速把 `OpenClaw + TIA 项目` 跑起来。

适用目标：

- 在本机安装 OpenClaw
- 把当前项目安装为 OpenClaw 插件
- 启动本地 TIA 服务
- 打开 Web 工作台

相关项目文件：

- 插件清单：[openclaw.plugin.json](/Users/na/na/Antigravity/talent-intelligence-agent/openclaw.plugin.json)
- 插件入口：[index.js](/Users/na/na/Antigravity/talent-intelligence-agent/index.js)
- OpenClaw 示例配置：[openclaw.example.json](/Users/na/na/Antigravity/talent-intelligence-agent/openclaw.example.json)
- 本地服务入口：[server/index.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/server/index.mjs)
- 工作台页面：[public/tia-dashboard.html](/Users/na/na/Antigravity/talent-intelligence-agent/public/tia-dashboard.html)

官方参考：

- [OpenClaw 插件命令文档](https://docs.openclaw.ai/cli/plugins)
- [OpenClaw 技能创建文档](https://docs.openclaw.ai/tools/creating-skills)

## 一、建议的本机架构

推荐按下面这套来跑：

- 本机运行：OpenClaw
- 本机运行：TIA Node 服务
- 外部运行：PostgreSQL
- 可选外部运行：LLM / Embedding API

这样做的好处是：

- 本地资源压力小
- 安装和排障都简单
- 对 MacBook Air 比较友好

## 二、前置要求

在开始之前，请确认本机具备：

- `Node.js >= 20`
- `npm`
- `psql`
- 一个可用的 PostgreSQL 数据库

当前项目在 [package.json](/Users/na/na/Antigravity/talent-intelligence-agent/package.json) 里声明了 `Node >= 20`。

## 三、准备项目目录

先把仓库拉到本机，例如：

```bash
git clone <your-repo-url>
cd talent-intelligence-agent
```

安装依赖：

```bash
npm install
```

## 四、初始化数据库

如果你还没有准备数据库，请先看：

- [PostgreSQL 使用手册](/Users/na/na/Antigravity/talent-intelligence-agent/docs/POSTGRESQL_SETUP.md)
- [Supabase 接入手册](/Users/na/na/Antigravity/talent-intelligence-agent/docs/SUPABASE_SETUP.md)

完成后，在终端里配置：

```bash
export PG_URL="postgresql://用户名:密码@主机:5432/数据库名"
```

执行初始化：

```bash
psql "$PG_URL" -f sql/tia_schema.sql
psql "$PG_URL" -f sql/tia_seed.sql
```

## 五、安装 OpenClaw 插件

当前项目已经带有插件清单文件 [openclaw.plugin.json](/Users/na/na/Antigravity/talent-intelligence-agent/openclaw.plugin.json#L1)。

在项目根目录执行：

```bash
openclaw plugins install /absolute/path/to/talent-intelligence-agent
```

这里的路径要替换成你的本机绝对路径，例如：

```bash
openclaw plugins install /Users/yourname/code/talent-intelligence-agent
```

安装完成后，可以用官方插件命令检查是否安装成功。

## 六、配置 OpenClaw

### 1. 准备配置文件

项目已经提供了示例配置：

- [openclaw.example.json](/Users/na/na/Antigravity/talent-intelligence-agent/openclaw.example.json)

你需要把里面的示例值改成自己的实际值，至少包括：

- `pgUrl`
- `llmBaseUrl`
- `llmApiKey`
- `llmModel`
- `reportDir`

### 2. 一个可用的最小配置

```json
{
  "plugins": {
    "entries": {
      "tia": {
        "enabled": true,
        "config": {
          "pgUrl": "postgresql://postgres:你的密码@db.example.com:5432/postgres",
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

说明：

- `pgUrl` 用于插件连接数据库
- `tools.allow` 允许 OpenClaw 调用 `tia` provider
- `reportDir` 决定报告写到哪里

## 七、启动本地 TIA 服务

虽然插件会提供工具能力，但这套项目还包含本地 HTTP API 和工作台页面，所以建议同时启动本地服务：

```bash
export PG_URL="postgresql://用户名:密码@主机:5432/数据库名"
npm run start
```

服务入口见 [server/index.mjs](/Users/na/na/Antigravity/talent-intelligence-agent/server/index.mjs#L18)。

默认端口：

```text
8788
```

启动后可访问：

- 工作台：`http://127.0.0.1:8788/tia`
- 主 UI：`http://127.0.0.1:8788/ui`

## 八、首次验证清单

新同事第一次装好后，按下面顺序验证。

### 1. 验证数据库连通

```bash
psql "$PG_URL" -c "SELECT NOW();"
```

### 2. 验证 Node 服务可启动

```bash
npm run start
```

看到本地监听端口日志即可。

### 3. 验证工作台页面

打开：

```text
http://127.0.0.1:8788/tia
```

页面能正常展示六视图工作台，说明前后端主链路正常。

### 4. 验证 API

在另一个终端执行：

```bash
curl http://127.0.0.1:8788/api/tia/positions
curl http://127.0.0.1:8788/api/tia/workbench
curl http://127.0.0.1:8788/api/tia/clients
```

### 5. 验证测试

```bash
npm test
npm run test:tia:e2e
```

## 九、常见运行方式

### 方式 A：只跑本地工作台

适合前端联调或功能演示：

- 配 `PG_URL`
- 运行 `npm run start`
- 浏览器打开 `/tia`

### 方式 B：只让 OpenClaw 调插件

适合只用工具，不看工作台：

- OpenClaw 里配置 `pgUrl`
- 确保插件已安装
- 不一定需要手动打开 `/tia`

### 方式 C：OpenClaw + 本地工作台一起用

这是最推荐的方式：

- OpenClaw 负责工具调用
- 本地服务负责页面和 API
- 两边都连同一个 PostgreSQL

## 十、给新同事的推荐安装顺序

建议按下面顺序做，最不容易出错：

1. 安装 Node.js 20+
2. 拉项目代码
3. `npm install`
4. 准备 PostgreSQL 并拿到连接串
5. 执行 `sql/tia_schema.sql`
6. 执行 `sql/tia_seed.sql`
7. 配置 `PG_URL`
8. 安装 OpenClaw 插件
9. 配置 OpenClaw 中的 `pgUrl`
10. 启动 `npm run start`
11. 打开 `/tia`
12. 执行 `npm test` 和 `npm run test:tia:e2e`

## 十一、常见问题

### 1. 插件安装了，但 OpenClaw 里调用不到

先检查：

- 插件是否安装到正确路径
- `openclaw.plugin.json` 是否存在
- `tools.allow` 是否包含 `tia`
- `plugins.entries.tia.enabled` 是否为 `true`

### 2. 页面能打开，但数据不对

通常是数据库问题：

- `PG_URL` 没配
- `pgUrl` 没配
- schema 没初始化
- 服务回退到了 `demo-memory`

先查：

```bash
psql "$PG_URL" -c "SELECT COUNT(*) FROM clients;"
```

### 3. OpenClaw 配了数据库，但本地页面还是旧数据

这通常说明：

- OpenClaw 插件用了 `pgUrl`
- 但你手动启动的本地 Node 服务没有配置 `PG_URL`

建议两边都连同一个数据库。

### 4. 新人最容易漏掉什么

最常见的四个遗漏：

- 没执行 `sql/tia_schema.sql`
- 没执行 `sql/tia_seed.sql`
- 本地服务没配 `PG_URL`
- OpenClaw 里没允许 `tia` 工具

## 十二、最短启动路径

如果你要给新人一个最快路径，直接发下面这组命令：

```bash
git clone <your-repo-url>
cd talent-intelligence-agent
npm install
export PG_URL="postgresql://用户名:密码@主机:5432/数据库名"
psql "$PG_URL" -f sql/tia_schema.sql
psql "$PG_URL" -f sql/tia_seed.sql
openclaw plugins install "$(pwd)"
npm run start
```

然后：

- 配置 OpenClaw 中的 `pgUrl`
- 打开 `http://127.0.0.1:8788/tia`
- 执行 `npm test`
- 执行 `npm run test:tia:e2e`
