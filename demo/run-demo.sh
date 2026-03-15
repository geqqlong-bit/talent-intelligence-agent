#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export TALENT_INTEL_BACKEND_URL="${TALENT_INTEL_BACKEND_URL:-http://127.0.0.1:8788}"

node server/mock-backend.mjs > /tmp/talent-intelligence-mock.log 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null || true' EXIT

for _ in 1 2 3 4 5; do
  if curl -fsS "$TALENT_INTEL_BACKEND_URL/health" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

node skill/talent-intelligence-agent/scripts/talent-intelligence-cli.mjs \
  --projectName "AI 产品总监寻访" \
  --roleTitle "AI 产品总监" \
  --clientName "某 B 轮企业服务公司" \
  --searchType executive_search \
  --mandateType retained \
  --companyContext "一家做企业级 AI 工具的 B 轮 SaaS 公司" \
  --hiringBrief "明确岗位画像并输出目标公司与寻访策略" \
  --objective "产出寻访策略和首轮 search plan" \
  --reportingLine "CEO" \
  --level "总监 / VP-1" \
  --targetIndustry "企业软件, AI SaaS" \
  --targetCompanies "OpenAI, ByteDance, Baidu, MiniMax" \
  --targetFunctions "产品战略, 商业化产品, 平台产品" \
  --mustHaveSkills "企业产品经验, 跨部门推进, 带团队" \
  --offLimits "现有投资组合公司" \
  --location "上海" \
  --salaryRange "月薪 8-12 万" \
  --templateId sourcing_strategy_cn \
  --out state/demo-sourcing-strategy.md

node skill/talent-intelligence-agent/scripts/talent-intelligence-cli.mjs \
  --projectName "销售 VP 招聘诊断" \
  --roleTitle "销售 VP" \
  --clientName "增长放缓中的消费品公司" \
  --companyContext "增长放缓中的消费品公司" \
  --hiringBrief "诊断为什么岗位长期招不到" \
  --objective "输出岗位诊断和调整建议" \
  --reportingLine "CEO" \
  --level VP \
  --targetIndustry "消费品, 渠道销售" \
  --mustHaveSkills "区域团队管理, 大客户成交, 渠道策略" \
  --niceToHaveSkills "品牌协同, 全国化经验" \
  --dealBreakers "纯总部策略岗, 无一线拿结果经历" \
  --location "上海" \
  --salaryRange "年包 120-180 万" \
  --templateId jd_diagnosis_cn \
  --out state/demo-jd-diagnosis.md

node skill/talent-intelligence-agent/scripts/talent-intelligence-cli.mjs \
  --projectName "候选人初评" \
  --roleTitle "增长负责人" \
  --clientName "跨境电商公司" \
  --companyContext "跨境电商公司" \
  --hiringBrief "评估候选人与岗位的匹配度" \
  --objective "输出候选人评估与追问建议" \
  --candidateName "匿名候选人 A" \
  --candidateSummary "做过跨境电商增长，也带过团队，最近两年负责区域经营和投放协同。" \
  --candidateHighlights "带过团队, 做过增长, 有跨境经验" \
  --candidateConcerns "是否真有 owner 级职责, 是否适应更复杂汇报线" \
  --mustHaveSkills "增长策略, 团队管理, 数据驱动" \
  --location "深圳" \
  --salaryRange "月薪 6-9 万" \
  --templateId candidate_assessment_cn \
  --out state/demo-candidate-assessment.md

node skill/talent-intelligence-agent/scripts/talent-intelligence-cli.mjs \
  --projectName "区域总经理 Search Plan" \
  --roleTitle "区域总经理" \
  --clientName "某连锁零售集团" \
  --searchType replacement \
  --mandateType in_house \
  --companyContext "全国连锁零售集团，华南区域业绩承压" \
  --hiringBrief "不仅要补位，还要顺带重整区域团队与经营节奏" \
  --objective "输出 4 周 search plan 和 stakeholder 校准建议" \
  --reportingLine "COO" \
  --level GM \
  --targetIndustry "零售, 连锁经营, 区域管理" \
  --targetCompanies "华润万家, 永辉, 盒马, 名创优品" \
  --mustHaveSkills "区域经营, 多店管理, 团队重整" \
  --dealBreakers "纯总部职能背景" \
  --processConstraints "流程慢，最终 package 需董事会审批" \
  --location "广州" \
  --salaryRange "年包 180-250 万" \
  --templateId search_plan_cn \
  --out state/demo-search-plan.md

node skill/talent-intelligence-agent/scripts/talent-intelligence-cli.mjs \
  --intakeFile examples/executive-search-intake.json \
  --out state/demo-executive-search.md

printf '\nDemo complete. Reports generated:\n'
ls -1 state/demo-*.md
