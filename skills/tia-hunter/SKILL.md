---
name: tia-hunter
description: Browser automation for candidate sourcing on recruiting platforms (猎聘/脉脉/Boss直聘)
---

# TIA Hunter — 浏览器自动化寻访

## 概述

Hunter 通过浏览器自动化在猎聘、脉脉、Boss 直聘等平台搜索和提取候选人信息。

## 前提条件

- 你的 Chrome 浏览器已登录目标平台
- OpenClaw 已连接到你的 Chrome（通过 Chrome DevTools MCP）

## 完整工作流

### Step 1: 获取职位上下文

先了解职位要求和客户偏好：

```
调用 tia_get_position_context(positionId)
→ 获取 roleTitle、hardRequirements、preferredSources
```

### Step 2: 搜索候选人

根据职位要求构建搜索：

```
调用 tia_browser_search({
  platform: "liepin",     // 或 "maimai" 或 "boss"
  keywords: "AI 架构师",
  city: "北京",
  filters: {
    salaryMin: "50",
    salaryMax: "120",
    experience: "5"
  }
})
→ 返回搜索 URL 和浏览器操作指令
```

### Step 3: 提取候选人信息

从搜索结果中提取结构化数据：

```
调用 tia_browser_extract({
  platform: "liepin",
  pageContent: [
    { name: "张三", company: "阿里巴巴", title: "AI架构师", ... },
    { name: "李四", company: "字节跳动", title: "算法专家", ... }
  ]
})
→ 返回标准化的候选人列表
```

### Step 4: 导入数据库

将候选人写入 TIA 数据库：

```
调用 tia_resume_import({
  candidates: [...],
  platform: "liepin",
  positionId: "xxx-xxx"
})
→ 返回导入结果（成功/跳过/失败）
```

### Step 5: 交给 Candidate 评估

候选人入库后，Candidate Agent 可以接管：

```
调用 tia_assess(candidateId)   → 结构化评估
调用 tia_cc(candidateId)       → 生成 CC 话术
调用 tia_report(candidateId)   → 生成推荐报告
```

## 安全限制

| 规则 | 限制 |
|---|---|
| 单次搜索最大结果 | 30 条 |
| 每日总量上限 | 100 条 |
| 操作间隔 | 2-5 秒 |
| 验证码 | 暂停并通知用户 |

## 多平台搜索

可以对同一个职位在多个平台搜索，使用不同关键词组合：

```
- 猎聘: 适合高端职位，JD 匹配度高
- 脉脉: 适合社交人脉挖掘，看人脉关系
- Boss 直聘: 适合看候选人活跃度和求职状态
```
