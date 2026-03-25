import crypto from 'crypto';
import { emitWebhookEvents } from './webhooks.mjs';

const PRIMARY_KEYS = {
  clients: 'id',
  client_preferences: 'client_id',
  positions: 'id',
  candidates: 'id',
  touch_records: 'id'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function daysAgo(days) {
  return new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString();
}

function createSeedState() {
  return {
    clients: [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: '未来智造科技',
        industry: 'AI SaaS',
        status: 'active',
        contract_expires: new Date(Date.now() + (5 * 24 * 60 * 60 * 1000)).toISOString(),
        account_owner: 'geqqlong',
        webhook_url: null,
        notes: 'Demo client for TIA',
        created_at: daysAgo(40),
        updated_at: daysAgo(1)
      },
      {
        id: '55555555-5555-5555-5555-555555555551',
        name: '腾讯互娱',
        industry: '互联网',
        status: 'active',
        contract_expires: new Date(Date.now() + (18 * 24 * 60 * 60 * 1000)).toISOString(),
        account_owner: 'geqqlong',
        webhook_url: null,
        notes: '高价值技术岗位合作客户',
        created_at: daysAgo(120),
        updated_at: daysAgo(2)
      },
      {
        id: '55555555-5555-5555-5555-555555555552',
        name: '快手电商',
        industry: '电商',
        status: 'active',
        contract_expires: new Date(Date.now() + (25 * 24 * 60 * 60 * 1000)).toISOString(),
        account_owner: 'geqqlong',
        webhook_url: null,
        notes: '高速扩张中的产品团队',
        created_at: daysAgo(90),
        updated_at: daysAgo(1)
      },
      {
        id: '55555555-5555-5555-5555-555555555553',
        name: '美团到家',
        industry: '本地生活',
        status: 'active',
        contract_expires: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
        account_owner: 'geqqlong',
        webhook_url: null,
        notes: '交付稳定的关键客户',
        created_at: daysAgo(180),
        updated_at: daysAgo(1)
      },
      {
        id: '55555555-5555-5555-5555-555555555554',
        name: '蔚来汽车',
        industry: '新能源',
        status: 'active',
        contract_expires: new Date(Date.now() + (55 * 24 * 60 * 60 * 1000)).toISOString(),
        account_owner: 'geqqlong',
        webhook_url: null,
        notes: '高端职能与财务岗位',
        created_at: daysAgo(22),
        updated_at: daysAgo(3)
      }
    ],
    client_preferences: [
      {
        client_id: '11111111-1111-1111-1111-111111111111',
        hard_requirements: {
          must_have: ['大型 B 端系统经验', '跨团队 owner 经验'],
          languages: ['中文', '英文']
        },
        rejection_patterns: [
          { reason: '候选人缺少千万 DAU 系统经验', createdAt: '2026-03-01T10:00:00Z' },
          { reason: '薪资超预算 15%', createdAt: '2026-03-04T11:00:00Z' }
        ],
        off_limits: ['竞对公司A', '竞对公司B'],
        preferred_sources: ['阿里云', '腾讯云', '火山引擎'],
        salary_ceiling: 120000,
        created_at: daysAgo(40),
        updated_at: daysAgo(1)
      },
      {
        client_id: '55555555-5555-5555-5555-555555555551',
        hard_requirements: {
          must_have: ['大型前端架构改造经验', '带团队经历'],
          companies: ['腾讯', '阿里', '字节']
        },
        rejection_patterns: [
          { reason: '候选人薪资普遍超预算 15-20%', createdAt: daysAgo(12) },
          { reason: '缺少复杂跨端架构 owner 经历', createdAt: daysAgo(18) }
        ],
        off_limits: ['腾讯互娱', '腾讯广告'],
        preferred_sources: ['字节跳动', '快手', '阿里本地生活'],
        salary_ceiling: 100000,
        created_at: daysAgo(120),
        updated_at: daysAgo(1)
      },
      {
        client_id: '55555555-5555-5555-5555-555555555552',
        hard_requirements: {
          must_have: ['AI 产品落地经验', '带过 30 人以上团队'],
          style: ['快', '狠', '准']
        },
        rejection_patterns: [
          { reason: '管理跨度不足', createdAt: daysAgo(8) },
          { reason: '业务 sense 不够强', createdAt: daysAgo(15) }
        ],
        off_limits: ['快手电商'],
        preferred_sources: ['美团', '字节跳动', '网易'],
        salary_ceiling: 100000,
        created_at: daysAgo(90),
        updated_at: daysAgo(1)
      },
      {
        client_id: '55555555-5555-5555-5555-555555555553',
        hard_requirements: {
          must_have: ['推荐系统建模经验', '高并发数据平台'],
          languages: ['中文']
        },
        rejection_patterns: [
          { reason: '稳定性存疑', createdAt: daysAgo(11) }
        ],
        off_limits: ['美团到家'],
        preferred_sources: ['滴滴', '字节跳动', '京东'],
        salary_ceiling: 68000,
        created_at: daysAgo(180),
        updated_at: daysAgo(1)
      },
      {
        client_id: '55555555-5555-5555-5555-555555555554',
        hard_requirements: {
          must_have: ['新能源或汽车行业财务负责人经验', 'IPO 或融资经历'],
          certificates: ['CPA 优先']
        },
        rejection_patterns: [
          { reason: '缺少新能源赛道经验', createdAt: daysAgo(6) }
        ],
        off_limits: ['蔚来汽车'],
        preferred_sources: ['理想汽车', '小鹏汽车', '宁德时代'],
        salary_ceiling: 150000,
        created_at: daysAgo(22),
        updated_at: daysAgo(3)
      }
    ],
    positions: [
      {
        id: '22222222-2222-2222-2222-222222222222',
        client_id: '11111111-1111-1111-1111-111111111111',
        title: '资深 AI 架构师',
        jd_raw: '负责大模型推理架构、跨团队协作、支撑企业级产品落地。',
        jd_diagnosis: { difficulty: 'high', market: 'competitive' },
        rubric: [
          { id: 'tech_depth', label: '核心技术深度', description: '推理优化与底层架构 owner 经验', weight: 35 },
          { id: 'scale_delivery', label: '规模化落地经验', description: '高并发场景下的稳定交付', weight: 25 },
          { id: 'ownership', label: 'Ownership 与影响力', description: '跨团队协同推进复杂项目', weight: 20 },
          { id: 'motivation', label: '动机与岗位适配', description: '动机、稳定性与组织阶段匹配', weight: 20 }
        ],
        status: 'active',
        target_fee: 180000,
        created_at: daysAgo(35),
        updated_at: daysAgo(2)
      },
      {
        id: '22222222-2222-2222-2222-222222222223',
        client_id: '55555555-5555-5555-5555-555555555552',
        title: 'AI产品总监',
        jd_raw: '负责电商场景 AI 产品战略与落地，带领 30 人以上团队，面向 GMV 增长负责。',
        jd_diagnosis: { difficulty: 'medium_high', market: 'hot' },
        rubric: [
          { id: 'business_sense', label: '业务 Sense', description: '对电商增长和 AI 场景有深刻理解', weight: 30 },
          { id: 'ai_depth', label: 'AI 产品深度', description: '具备模型或推荐策略落地经验', weight: 25 },
          { id: 'management', label: '团队管理', description: '带过 30 人以上团队', weight: 25 },
          { id: 'culture_fit', label: '文化匹配', description: '适应高节奏执行环境', weight: 20 }
        ],
        status: 'active',
        target_fee: 92000,
        created_at: daysAgo(28),
        updated_at: daysAgo(1)
      },
      {
        id: '22222222-2222-2222-2222-222222222224',
        client_id: '55555555-5555-5555-5555-555555555553',
        title: '数据科学家（Senior）',
        jd_raw: '负责推荐模型与商业化策略优化，推进实验平台与线上稳定性。',
        jd_diagnosis: { difficulty: 'medium', market: 'balanced' },
        rubric: [
          { id: 'modeling', label: '建模能力', description: '推荐或排序模型经验', weight: 35 },
          { id: 'production', label: '生产落地', description: '模型上线与平台协作经验', weight: 30 },
          { id: 'communication', label: '沟通协作', description: '能推进跨团队项目', weight: 20 },
          { id: 'motivation', label: '动机', description: '对业务和团队有真实兴趣', weight: 15 }
        ],
        status: 'active',
        target_fee: 55000,
        created_at: daysAgo(15),
        updated_at: daysAgo(1)
      },
      {
        id: '22222222-2222-2222-2222-222222222225',
        client_id: '55555555-5555-5555-5555-555555555551',
        title: '资深前端架构师',
        jd_raw: '负责复杂 Web 平台架构升级，推进跨端标准化和工程效率体系。',
        jd_diagnosis: { difficulty: 'high', market: 'scarce' },
        rubric: [
          { id: 'arch', label: '架构深度', description: '复杂前端架构和性能治理 owner 经验', weight: 35 },
          { id: 'cross_team', label: '协作推动力', description: '跨团队标准制定和落地经验', weight: 25 },
          { id: 'people', label: '团队影响力', description: '带队或 mentoring 经验', weight: 20 },
          { id: 'fit', label: '动机匹配', description: '对平台型工作有兴趣', weight: 20 }
        ],
        status: 'active',
        target_fee: 78000,
        created_at: daysAgo(45),
        updated_at: daysAgo(2)
      },
      {
        id: '22222222-2222-2222-2222-222222222226',
        client_id: '55555555-5555-5555-5555-555555555554',
        title: 'CFO · 新能源',
        jd_raw: '负责新能源企业资本市场与财务体系建设，推动融资和 IPO 准备。',
        jd_diagnosis: { difficulty: 'very_high', market: 'niche' },
        rubric: [
          { id: 'capital', label: '资本市场经验', description: '融资、IPO 或并购经历', weight: 35 },
          { id: 'industry', label: '行业经验', description: '新能源或汽车行业背景', weight: 30 },
          { id: 'leadership', label: '组织领导力', description: '财务体系搭建与团队管理', weight: 20 },
          { id: 'board', label: '董事会协同', description: '与 CEO/董事会高效协同', weight: 15 }
        ],
        status: 'active',
        target_fee: 180000,
        created_at: daysAgo(8),
        updated_at: daysAgo(3)
      }
    ],
    candidates: [
      {
        id: '33333333-3333-3333-3333-333333333331',
        position_id: '22222222-2222-2222-2222-222222222222',
        name: '张大牛',
        mobile: null,
        email: null,
        current_company: '某头部互联网公司',
        current_title: '资深算法架构师',
        years_experience: 10,
        resume_text: '主导过千亿参数大模型预训练与推理优化，负责跨团队协作和企业级客户交付。',
        resume_path: null,
        notes: null,
        stage: 'recommended',
        stage_updated_at: daysAgo(6),
        ai_assessment: {},
        salary_current: 95000,
        salary_expected: 130000,
        offer_risk: 'counter_offer',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(12),
        updated_at: daysAgo(6)
      },
      {
        id: '33333333-3333-3333-3333-333333333332',
        position_id: '22222222-2222-2222-2222-222222222222',
        name: '李云龙',
        mobile: null,
        email: null,
        current_company: '创业公司',
        current_title: '后端工程师',
        years_experience: 5,
        resume_text: '5 年后端开发经验，近 1 年转 AI 方向，做过 LangChain 和知识库问答系统。',
        resume_path: null,
        notes: null,
        stage: 'sourcing',
        stage_updated_at: daysAgo(9),
        ai_assessment: {},
        salary_current: 48000,
        salary_expected: 65000,
        offer_risk: 'none',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(9),
        updated_at: daysAgo(9)
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        position_id: '22222222-2222-2222-2222-222222222222',
        name: '王码农',
        mobile: null,
        email: null,
        current_company: '独角兽公司',
        current_title: 'NLP 技术负责人',
        years_experience: 11,
        resume_text: '负责 vLLM 生产化落地与推理加速，吞吐提升 3 倍，协调模型与平台团队。',
        resume_path: null,
        notes: null,
        stage: 'placed',
        stage_updated_at: daysAgo(35),
        ai_assessment: {
          candidateName: '王码农',
          overallScore: 91,
          recommendation: '建议推进',
          summary: '在推理架构和跨团队推动上具备明显优势。',
          dimensions: [
            {
              key: 'tech_depth',
              label: '核心技术深度',
              score: 94,
              confidence: '高',
              evidenceStatus: '证据充分',
              evidenceQuotes: ['负责 vLLM 生产化落地与推理加速，吞吐提升 3 倍'],
              judgement: '具备清晰的推理优化 owner 经历。',
              missingInformation: []
            }
          ],
          overallRisks: [],
          followUpQuestions: ['请进一步说明你在跨团队协作中的决策机制。']
        },
        salary_current: 76000,
        salary_expected: 90000,
        offer_risk: 'none',
        onboard_date: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
        embedding: [],
        created_at: daysAgo(60),
        updated_at: daysAgo(35)
      },
      {
        id: '33333333-3333-3333-3333-333333333334',
        position_id: '22222222-2222-2222-2222-222222222223',
        name: '陈晓明',
        mobile: null,
        email: null,
        current_company: '字节跳动',
        current_title: '算法产品经理',
        years_experience: 5,
        resume_text: '负责推荐与内容理解产品，近三年持续推动 AI 驱动的增长实验。',
        resume_path: null,
        notes: null,
        stage: 'sourcing',
        stage_updated_at: daysAgo(2),
        ai_assessment: {},
        salary_current: 72000,
        salary_expected: 90000,
        offer_risk: 'none',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(4),
        updated_at: daysAgo(2)
      },
      {
        id: '33333333-3333-3333-3333-333333333335',
        position_id: '22222222-2222-2222-2222-222222222223',
        name: '李四',
        mobile: null,
        email: null,
        current_company: '美团',
        current_title: 'AI产品总监',
        years_experience: 8,
        resume_text: '带过 35 人团队，主导外卖推荐和商家增长策略，具备业务和算法协同经验。',
        resume_path: null,
        notes: null,
        stage: 'eval',
        stage_updated_at: daysAgo(5),
        ai_assessment: {
          candidateName: '李四',
          overallScore: 88,
          recommendation: '建议推进',
          summary: '管理跨度和 AI 业务理解较强，接近目标画像。',
          dimensions: [],
          overallRisks: [{ label: '文化适配待验证', detail: '需确认高压节奏下的执行方式。', confidence: '中', evidenceStatus: '证据有限', evidenceQuotes: [] }],
          followUpQuestions: ['请说明你如何在高压周期内推进跨部门项目。']
        },
        salary_current: 85000,
        salary_expected: 100000,
        offer_risk: 'none',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(18),
        updated_at: daysAgo(5)
      },
      {
        id: '33333333-3333-3333-3333-333333333336',
        position_id: '22222222-2222-2222-2222-222222222223',
        name: '张伟',
        mobile: null,
        email: null,
        current_company: '美团',
        current_title: '商业化产品负责人',
        years_experience: 9,
        resume_text: '负责商业化和推荐系统产品，近两年带团队做 GMV 提升专项。',
        resume_path: null,
        notes: null,
        stage: 'offer',
        stage_updated_at: daysAgo(2),
        ai_assessment: {},
        salary_current: 85000,
        salary_expected: 100000,
        offer_risk: 'competing_offer',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(21),
        updated_at: daysAgo(2)
      },
      {
        id: '33333333-3333-3333-3333-333333333337',
        position_id: '22222222-2222-2222-2222-222222222223',
        name: '周静',
        mobile: null,
        email: null,
        current_company: '网易',
        current_title: '高级产品经理',
        years_experience: 7,
        resume_text: '做过内容推荐和增长产品，有中型团队协作经验。',
        resume_path: null,
        notes: null,
        stage: 'client_interview',
        stage_updated_at: daysAgo(1),
        ai_assessment: {},
        salary_current: 68000,
        salary_expected: 86000,
        offer_risk: 'none',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(14),
        updated_at: daysAgo(1)
      },
      {
        id: '33333333-3333-3333-3333-333333333338',
        position_id: '22222222-2222-2222-2222-222222222223',
        name: '赵六',
        mobile: null,
        email: null,
        current_company: '快手',
        current_title: '算法工程师',
        years_experience: 6,
        resume_text: '推荐与搜索算法工程师，转管理路径初期。',
        resume_path: null,
        notes: null,
        stage: 'placed',
        stage_updated_at: daysAgo(30),
        ai_assessment: {},
        salary_current: 56000,
        salary_expected: 70000,
        offer_risk: 'none',
        onboard_date: new Date(Date.now() - (30 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
        embedding: [],
        created_at: daysAgo(54),
        updated_at: daysAgo(30)
      },
      {
        id: '33333333-3333-3333-3333-333333333339',
        position_id: '22222222-2222-2222-2222-222222222224',
        name: '王五',
        mobile: null,
        email: null,
        current_company: '滴滴',
        current_title: '数据科学家',
        years_experience: 7,
        resume_text: '推荐系统建模与实验平台经验丰富，近两年聚焦转化率优化。',
        resume_path: null,
        notes: null,
        stage: 'offer',
        stage_updated_at: daysAgo(1),
        ai_assessment: {},
        salary_current: 58000,
        salary_expected: 65000,
        offer_risk: 'counter_offer',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(20),
        updated_at: daysAgo(1)
      },
      {
        id: '33333333-3333-3333-3333-333333333340',
        position_id: '22222222-2222-2222-2222-222222222224',
        name: '孙飞',
        mobile: null,
        email: null,
        current_company: '京东',
        current_title: '高级算法工程师',
        years_experience: 8,
        resume_text: '做过推荐算法和实验平台，稳定性和收益都较强。',
        resume_path: null,
        notes: null,
        stage: 'placed',
        stage_updated_at: daysAgo(75),
        ai_assessment: {},
        salary_current: 52000,
        salary_expected: 60000,
        offer_risk: 'none',
        onboard_date: new Date(Date.now() - (75 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10),
        embedding: [],
        created_at: daysAgo(120),
        updated_at: daysAgo(75)
      },
      {
        id: '33333333-3333-3333-3333-333333333341',
        position_id: '22222222-2222-2222-2222-222222222225',
        name: '张三',
        mobile: null,
        email: null,
        current_company: '阿里本地生活',
        current_title: '前端架构负责人',
        years_experience: 10,
        resume_text: '负责复杂前端平台架构升级，推动多端标准和工程效率体系。',
        resume_path: null,
        notes: null,
        stage: 'recommended',
        stage_updated_at: daysAgo(3),
        ai_assessment: {},
        salary_current: 90000,
        salary_expected: 110000,
        offer_risk: 'none',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(17),
        updated_at: daysAgo(3)
      },
      {
        id: '33333333-3333-3333-3333-333333333342',
        position_id: '22222222-2222-2222-2222-222222222225',
        name: '何安',
        mobile: null,
        email: null,
        current_company: '字节跳动',
        current_title: '前端技术专家',
        years_experience: 9,
        resume_text: '擅长大型 Web 应用性能治理和跨团队基建协作。',
        resume_path: null,
        notes: null,
        stage: 'interview',
        stage_updated_at: daysAgo(8),
        ai_assessment: {},
        salary_current: 88000,
        salary_expected: 105000,
        offer_risk: 'none',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(12),
        updated_at: daysAgo(8)
      },
      {
        id: '33333333-3333-3333-3333-333333333343',
        position_id: '22222222-2222-2222-2222-222222222226',
        name: '高远',
        mobile: null,
        email: null,
        current_company: '理想汽车',
        current_title: '财务副总裁',
        years_experience: 16,
        resume_text: '具备 IPO 和融资经验，长期负责汽车行业财务体系搭建。',
        resume_path: null,
        notes: null,
        stage: 'sourcing',
        stage_updated_at: daysAgo(4),
        ai_assessment: {},
        salary_current: 125000,
        salary_expected: 145000,
        offer_risk: 'none',
        onboard_date: null,
        embedding: [],
        created_at: daysAgo(6),
        updated_at: daysAgo(4)
      }
    ],
    touch_records: [
      {
        id: '44444444-4444-4444-4444-444444444441',
        candidate_id: '33333333-3333-3333-3333-333333333331',
        position_id: '22222222-2222-2222-2222-222222222222',
        touch_type: 'client_feedback',
        summary: '客户认可技术深度，但担心薪资超预算。',
        sentiment: 'neutral',
        next_action: '准备薪资对齐方案',
        created_at: daysAgo(4),
        updated_at: daysAgo(4)
      },
      {
        id: '44444444-4444-4444-4444-444444444442',
        candidate_id: '33333333-3333-3333-3333-333333333332',
        position_id: '22222222-2222-2222-2222-222222222222',
        touch_type: 'wechat',
        summary: '已发送首轮跟进消息，等待回复。',
        sentiment: 'neutral',
        next_action: '48 小时后再次跟进',
        created_at: daysAgo(2),
        updated_at: daysAgo(2)
      },
      {
        id: '44444444-4444-4444-4444-444444444443',
        candidate_id: '33333333-3333-3333-3333-333333333333',
        position_id: '22222222-2222-2222-2222-222222222222',
        touch_type: 'onboarding_checkin',
        summary: '候选人已入职一个月，准备 30 天回访。',
        sentiment: 'positive',
        next_action: '安排回访电话',
        created_at: daysAgo(1),
        updated_at: daysAgo(1)
      },
      {
        id: '44444444-4444-4444-4444-444444444444',
        candidate_id: '33333333-3333-3333-3333-333333333336',
        position_id: '22222222-2222-2222-2222-222222222223',
        touch_type: 'client_feedback',
        summary: '客户认可业务理解，但要求本周内推进终面与 offer。',
        sentiment: 'positive',
        next_action: '48 小时内锁定薪资区间',
        created_at: daysAgo(2),
        updated_at: daysAgo(2)
      },
      {
        id: '44444444-4444-4444-4444-444444444445',
        candidate_id: '33333333-3333-3333-3333-333333333339',
        position_id: '22222222-2222-2222-2222-222222222224',
        touch_type: 'wechat',
        summary: '候选人透露现东家已经给出 counter-offer。',
        sentiment: 'negative',
        next_action: '今天内完成反 offer 沟通',
        created_at: daysAgo(1),
        updated_at: daysAgo(1)
      },
      {
        id: '44444444-4444-4444-4444-444444444446',
        candidate_id: '33333333-3333-3333-3333-333333333341',
        position_id: '22222222-2222-2222-2222-222222222225',
        touch_type: 'client_feedback',
        summary: '客户认为技术深度可以，但需要再验证跨团队推动案例。',
        sentiment: 'neutral',
        next_action: '补充跨团队项目证据',
        created_at: daysAgo(3),
        updated_at: daysAgo(3)
      },
      {
        id: '44444444-4444-4444-4444-444444444447',
        candidate_id: '33333333-3333-3333-3333-333333333338',
        position_id: '22222222-2222-2222-2222-222222222223',
        touch_type: 'onboarding_checkin',
        summary: '入职 30 天跟进，整体适应良好。',
        sentiment: 'positive',
        next_action: '同步客户 HR，确认试用期目标',
        created_at: daysAgo(0),
        updated_at: daysAgo(0)
      }
    ]
  };
}

function sortByUpdatedDesc(rows) {
  return [...rows].sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')));
}

function pickKey(table) {
  const key = PRIMARY_KEYS[table];
  if (!key) throw new Error(`Unsupported table: ${table}`);
  return key;
}

function getStateRow(tableRows, key, value) {
  return tableRows.find((row) => row[key] === value) || null;
}

function buildPositionJoinRow(state, positionId) {
  const position = getStateRow(state.positions, 'id', positionId);
  if (!position) return null;
  const client = getStateRow(state.clients, 'id', position.client_id);
  const preferences = getStateRow(state.client_preferences, 'client_id', position.client_id);
  return {
    ...position,
    client_name: client?.name || null,
    client_industry: client?.industry || null,
    contract_expires: client?.contract_expires || null,
    hard_requirements: preferences?.hard_requirements || {},
    rejection_patterns: preferences?.rejection_patterns || [],
    off_limits: preferences?.off_limits || [],
    preferred_sources: preferences?.preferred_sources || [],
    salary_ceiling: preferences?.salary_ceiling || null
  };
}

function buildCandidateReportRow(state, candidateId) {
  const candidate = getStateRow(state.candidates, 'id', candidateId);
  if (!candidate) return null;
  const position = getStateRow(state.positions, 'id', candidate.position_id);
  const client = position ? getStateRow(state.clients, 'id', position.client_id) : null;
  const preferences = client ? getStateRow(state.client_preferences, 'client_id', client.id) : null;
  return {
    ...candidate,
    position_title: position?.title || null,
    jd_raw: position?.jd_raw || null,
    rubric: position?.rubric || [],
    client_name: client?.name || null,
    hard_requirements: preferences?.hard_requirements || {},
    salary_ceiling: preferences?.salary_ceiling || null
  };
}

function parseSql(sql) {
  return String(sql || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function createDemoRepository({
  defaultWebhookUrls = [],
  logger = console
} = {}) {
  const state = createSeedState();

  function readRows(table) {
    return state[table] || [];
  }

  async function dbQuery(sql, params = []) {
    const normalized = parseSql(sql);

    if (normalized === 'select * from candidates where id = $1') {
      const row = getStateRow(state.candidates, 'id', params[0]);
      return row ? [clone(row)] : [];
    }

    if (normalized.includes('from candidates') && normalized.includes('where position_id = $1') && normalized.includes('order by updated_at desc')) {
      return sortByUpdatedDesc(state.candidates.filter((candidate) => candidate.position_id === params[0])).map(clone);
    }

    if (normalized === 'select * from candidates order by updated_at desc') {
      return sortByUpdatedDesc(state.candidates).map(clone);
    }

    if (normalized.includes('from candidates') && normalized.includes('group by stage') && normalized.includes('where position_id = $1')) {
      const filtered = state.candidates.filter((candidate) => candidate.position_id === params[0]);
      return buildFunnelRows(filtered);
    }

    if (normalized.includes('from candidates') && normalized.includes('group by stage') && !normalized.includes('where position_id = $1')) {
      return buildFunnelRows(state.candidates);
    }

    if (normalized.includes('from positions p') && normalized.includes('where p.id = $1')) {
      const row = buildPositionJoinRow(state, params[0]);
      return row ? [clone(row)] : [];
    }

    if (normalized.includes('from touch_records tr') && normalized.includes('tr.touch_type = \'client_feedback\'')) {
      const rows = state.touch_records
        .filter((record) => record.touch_type === 'client_feedback')
        .map((record) => {
          const candidate = getStateRow(state.candidates, 'id', record.candidate_id);
          return {
            summary: record.summary,
            created_at: record.created_at,
            candidate_name: candidate?.name || null,
            position_id: candidate?.position_id || null
          };
        })
        .filter((row) => row.position_id === params[0])
        .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
        .slice(0, 5)
        .map(({ position_id, ...row }) => row);
      return rows;
    }

    if (normalized.includes('from candidates cd') && normalized.includes('where cd.id = $1')) {
      const row = buildCandidateReportRow(state, params[0]);
      return row ? [clone(row)] : [];
    }

    if (normalized.includes('from positions p') && normalized.includes('join clients c on c.id = p.client_id') && normalized.includes('order by p.created_at desc')) {
      return state.positions
        .map((position) => {
          const client = getStateRow(state.clients, 'id', position.client_id);
          return {
            ...position,
            client_name: client?.name || null,
            contract_expires: client?.contract_expires || null
          };
        })
        .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
        .map(clone);
    }

    throw new Error(`Demo repository does not support SQL: ${sql}`);
  }

  async function dbWrite(table, operation, data = {}) {
    const key = pickKey(table);
    const rows = readRows(table);
    const timestamp = nowIso();

    if (operation === 'insert') {
      const inserted = {
        ...data,
        [key]: data[key] || crypto.randomUUID(),
        created_at: data.created_at || timestamp,
        updated_at: data.updated_at || timestamp
      };
      rows.push(inserted);
      return clone(inserted);
    }

    if (operation === 'update') {
      const row = getStateRow(rows, key, data[key] || data.id || data.client_id);
      if (!row) return null;
      Object.assign(row, data, { updated_at: data.updated_at || timestamp });
      return clone(row);
    }

    if (operation === 'delete') {
      const rowIndex = rows.findIndex((row) => row[key] === (data[key] || data.id || data.client_id));
      if (rowIndex === -1) return null;
      const [removed] = rows.splice(rowIndex, 1);
      return clone(removed);
    }

    throw new Error(`Unsupported operation: ${operation}`);
  }

  function buildFunnelRows(candidates) {
    const counts = new Map();
    for (const candidate of candidates) {
      counts.set(candidate.stage, (counts.get(candidate.stage) || 0) + 1);
    }
    return [...counts.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([stage, candidate_count]) => ({ stage, candidate_count }));
  }

  return {
    async dbQuery(sql, params = []) {
      return dbQuery(sql, params);
    },

    async dbWrite(table, operation, data = {}) {
      return dbWrite(table, operation, data);
    },

    async getPositionContext(positionId) {
      const positionRow = buildPositionJoinRow(state, positionId);
      if (!positionRow) throw new Error(`Position not found: ${positionId}`);

      const recentRejections = state.touch_records
        .filter((record) => record.touch_type === 'client_feedback')
        .map((record) => {
          const candidate = getStateRow(state.candidates, 'id', record.candidate_id);
          return {
            candidateName: candidate?.name || null,
            summary: record.summary,
            createdAt: record.created_at,
            positionId: candidate?.position_id || null
          };
        })
        .filter((row) => row.positionId === positionId)
        .sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))
        .slice(0, 5);

      return {
        position: {
          id: positionRow.id,
          title: positionRow.title,
          status: positionRow.status,
          jdRaw: positionRow.jd_raw,
          jdDiagnosis: positionRow.jd_diagnosis,
          rubric: positionRow.rubric,
          targetFee: positionRow.target_fee,
          createdAt: positionRow.created_at
        },
        client: {
          id: positionRow.client_id,
          name: positionRow.client_name,
          industry: positionRow.client_industry,
          contractExpires: positionRow.contract_expires
        },
        clientPreferences: {
          hardRequirements: positionRow.hard_requirements,
          rejectionPatterns: positionRow.rejection_patterns,
          offLimits: positionRow.off_limits,
          preferredSources: positionRow.preferred_sources,
          salaryCeiling: positionRow.salary_ceiling
        },
        recentRejections,
        funnel: buildFunnelRows(state.candidates.filter((candidate) => candidate.position_id === positionId)).map((row) => ({
          stage: row.stage,
          candidateCount: row.candidate_count
        }))
      };
    },

    async stageUpdate(candidateId, newStage, options = {}) {
      const candidate = getStateRow(state.candidates, 'id', candidateId);
      if (!candidate) throw new Error(`Candidate not found: ${candidateId}`);

      const previousStage = candidate.stage;
      candidate.stage = newStage;
      candidate.stage_updated_at = nowIso();
      candidate.updated_at = candidate.stage_updated_at;
      if (newStage === 'placed' && !candidate.onboard_date) {
        candidate.onboard_date = candidate.stage_updated_at.slice(0, 10);
      }

      const touchRecord = await dbWrite('touch_records', 'insert', {
        candidate_id: candidateId,
        position_id: candidate.position_id,
        touch_type: 'stage_change',
        summary: options.summary || `Candidate moved to ${newStage}`,
        sentiment: 'neutral',
        next_action: options.nextAction || null
      });

      const webhookResults = await emitWebhookEvents(
        options.webhookUrls || defaultWebhookUrls,
        {
          type: 'candidate.stage_changed',
          candidateId,
          positionId: candidate.position_id,
          previousStage,
          newStage,
          occurredAt: candidate.stage_updated_at
        },
        logger
      );

      return {
        candidate: clone(candidate),
        touchRecord,
        webhookResults
      };
    },

    async listPositions() {
      return dbQuery(
        `SELECT
           p.*,
           c.name AS client_name,
           c.contract_expires AS contract_expires
         FROM positions p
         JOIN clients c ON c.id = p.client_id
         ORDER BY p.created_at DESC`
      );
    },

    async listClients() {
      return state.clients
        .map((client) => {
          const positions = state.positions.filter((position) => position.client_id === client.id);
          return {
            ...clone(client),
            position_count: positions.length,
            active_position_count: positions.filter((position) => position.status === 'active').length,
            pipeline_fee: positions.reduce((sum, position) => sum + Number(position.target_fee || 0), 0)
          };
        })
        .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')));
    },

    async listCandidates(positionId = undefined) {
      return positionId
        ? dbQuery('SELECT * FROM candidates WHERE position_id = $1 ORDER BY updated_at DESC', [positionId])
        : dbQuery('SELECT * FROM candidates ORDER BY updated_at DESC');
    },

    async getFunnel(positionId = undefined) {
      return positionId
        ? buildFunnelRows(state.candidates.filter((candidate) => candidate.position_id === positionId))
        : buildFunnelRows(state.candidates);
    },

    async listTouchRecords({
      positionId = undefined,
      candidateId = undefined,
      limit = 20
    } = {}) {
      return state.touch_records
        .filter((record) => !positionId || record.position_id === positionId)
        .filter((record) => !candidateId || record.candidate_id === candidateId)
        .map((record) => {
          const candidate = getStateRow(state.candidates, 'id', record.candidate_id);
          const position = getStateRow(state.positions, 'id', record.position_id);
          const client = position ? getStateRow(state.clients, 'id', position.client_id) : null;
          return {
            ...clone(record),
            candidate_name: candidate?.name || null,
            candidate_stage: candidate?.stage || null,
            position_title: position?.title || null,
            client_name: client?.name || null
          };
        })
        .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
        .slice(0, limit);
    },

    async getCandidateProfile(candidateId) {
      const candidate = getStateRow(state.candidates, 'id', candidateId);
      if (!candidate) return null;
      const position = getStateRow(state.positions, 'id', candidate.position_id);
      const client = position ? getStateRow(state.clients, 'id', position.client_id) : null;
      const preferences = client ? getStateRow(state.client_preferences, 'client_id', client.id) : null;

      return {
        ...clone(candidate),
        position_title: position?.title || null,
        jd_raw: position?.jd_raw || null,
        target_fee: position?.target_fee || null,
        position_status: position?.status || null,
        client_id: client?.id || null,
        client_name: client?.name || null,
        client_industry: client?.industry || null,
        contract_expires: client?.contract_expires || null,
        hard_requirements: clone(preferences?.hard_requirements || {}),
        rejection_patterns: clone(preferences?.rejection_patterns || []),
        off_limits: clone(preferences?.off_limits || []),
        preferred_sources: clone(preferences?.preferred_sources || []),
        salary_ceiling: preferences?.salary_ceiling || null
      };
    },

    async findSimilarSuccessfulCandidates({ positionId = undefined, candidateId = undefined, limit = 3 } = {}) {
      return state.candidates
        .filter((candidate) => candidate.id !== candidateId)
        .filter((candidate) => !positionId || candidate.position_id === positionId)
        .filter((candidate) => ['recommended', 'client_interview', 'offer', 'placed'].includes(candidate.stage))
        .sort((left, right) => String(right.updated_at || '').localeCompare(String(left.updated_at || '')))
        .slice(0, limit)
        .map((candidate) => ({
          id: candidate.id,
          position_id: candidate.position_id,
          name: candidate.name,
          current_company: candidate.current_company,
          current_title: candidate.current_title,
          stage: candidate.stage,
          ai_assessment: clone(candidate.ai_assessment),
          resume_text: candidate.resume_text,
          similarity: null
        }));
    }
  };
}
