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
  --companyContext "一家做企业级 AI 工具的 B 轮 SaaS 公司" \
  --hiringBrief "明确岗位画像并输出目标公司与寻访策略" \
  --objective "产出寻访策略和首轮 search plan" \
  --targetIndustry "企业软件, AI SaaS" \
  --targetCompanies "OpenAI, ByteDance, Baidu, MiniMax" \
  --location "上海" \
  --salaryRange "月薪 8-12 万" \
  --templateId sourcing_strategy_cn \
  --out state/demo-sourcing-strategy.md

node skill/talent-intelligence-agent/scripts/talent-intelligence-cli.mjs \
  --projectName "销售 VP 招聘诊断" \
  --roleTitle "销售 VP" \
  --companyContext "增长放缓中的消费品公司" \
  --hiringBrief "诊断为什么岗位长期招不到" \
  --objective "输出岗位诊断和调整建议" \
  --targetIndustry "消费品, 渠道销售" \
  --location "上海" \
  --salaryRange "年包 120-180 万" \
  --templateId jd_diagnosis_cn \
  --out state/demo-jd-diagnosis.md

node skill/talent-intelligence-agent/scripts/talent-intelligence-cli.mjs \
  --projectName "候选人初评" \
  --roleTitle "增长负责人" \
  --companyContext "跨境电商公司" \
  --hiringBrief "评估候选人与岗位的匹配度" \
  --objective "输出候选人评估与追问建议" \
  --targetIndustry "跨境电商, 增长" \
  --location "深圳" \
  --salaryRange "月薪 6-9 万" \
  --templateId candidate_assessment_cn \
  --out state/demo-candidate-assessment.md

printf '\nDemo complete. Reports generated:\n'
ls -1 state/demo-*.md
