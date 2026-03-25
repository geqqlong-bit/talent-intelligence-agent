INSERT INTO clients (
  id, name, industry, status, contract_expires, account_owner, notes, created_at, updated_at
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '未来智造科技',
    'AI SaaS',
    'active',
    NOW() + INTERVAL '5 days',
    'geqqlong',
    'Demo client for TIA',
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '55555555-5555-5555-5555-555555555551',
    '腾讯互娱',
    '互联网',
    'active',
    NOW() + INTERVAL '18 days',
    'geqqlong',
    '高价值技术岗位合作客户',
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '55555555-5555-5555-5555-555555555552',
    '快手电商',
    '电商',
    'active',
    NOW() + INTERVAL '25 days',
    'geqqlong',
    '高速扩张中的产品团队',
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '55555555-5555-5555-5555-555555555553',
    '美团到家',
    '本地生活',
    'active',
    NOW() + INTERVAL '7 days',
    'geqqlong',
    '交付稳定的关键客户',
    NOW() - INTERVAL '180 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '55555555-5555-5555-5555-555555555554',
    '蔚来汽车',
    '新能源',
    'active',
    NOW() + INTERVAL '55 days',
    'geqqlong',
    '高端职能与财务岗位',
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '3 days'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  industry = EXCLUDED.industry,
  status = EXCLUDED.status,
  contract_expires = EXCLUDED.contract_expires,
  account_owner = EXCLUDED.account_owner,
  notes = EXCLUDED.notes,
  updated_at = EXCLUDED.updated_at;

INSERT INTO client_preferences (
  client_id, hard_requirements, rejection_patterns, off_limits, preferred_sources, salary_ceiling, created_at, updated_at
)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    '{"must_have":["大型 B 端系统经验","跨团队 owner 经验"],"languages":["中文","英文"]}'::jsonb,
    '[{"reason":"候选人缺少千万 DAU 系统经验","createdAt":"2026-03-01T10:00:00Z"},{"reason":"薪资超预算 15%","createdAt":"2026-03-04T11:00:00Z"}]'::jsonb,
    ARRAY['竞对公司A', '竞对公司B'],
    ARRAY['阿里云', '腾讯云', '火山引擎'],
    120000,
    NOW() - INTERVAL '40 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '55555555-5555-5555-5555-555555555551',
    '{"must_have":["大型前端架构改造经验","带团队经历"],"companies":["腾讯","阿里","字节"]}'::jsonb,
    '[{"reason":"候选人薪资普遍超预算 15-20%","createdAt":"2026-03-09T10:00:00Z"},{"reason":"缺少复杂跨端架构 owner 经历","createdAt":"2026-03-03T10:00:00Z"}]'::jsonb,
    ARRAY['腾讯互娱', '腾讯广告'],
    ARRAY['字节跳动', '快手', '阿里本地生活'],
    100000,
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '55555555-5555-5555-5555-555555555552',
    '{"must_have":["AI 产品落地经验","带过 30 人以上团队"],"style":["快","狠","准"]}'::jsonb,
    '[{"reason":"管理跨度不足","createdAt":"2026-03-13T10:00:00Z"},{"reason":"业务 sense 不够强","createdAt":"2026-03-06T10:00:00Z"}]'::jsonb,
    ARRAY['快手电商'],
    ARRAY['美团', '字节跳动', '网易'],
    100000,
    NOW() - INTERVAL '90 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '55555555-5555-5555-5555-555555555553',
    '{"must_have":["推荐系统建模经验","高并发数据平台"],"languages":["中文"]}'::jsonb,
    '[{"reason":"稳定性存疑","createdAt":"2026-03-10T10:00:00Z"}]'::jsonb,
    ARRAY['美团到家'],
    ARRAY['滴滴', '字节跳动', '京东'],
    68000,
    NOW() - INTERVAL '180 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '55555555-5555-5555-5555-555555555554',
    '{"must_have":["新能源或汽车行业财务负责人经验","IPO 或融资经历"],"certificates":["CPA 优先"]}'::jsonb,
    '[{"reason":"缺少新能源赛道经验","createdAt":"2026-03-15T10:00:00Z"}]'::jsonb,
    ARRAY['蔚来汽车'],
    ARRAY['理想汽车', '小鹏汽车', '宁德时代'],
    150000,
    NOW() - INTERVAL '22 days',
    NOW() - INTERVAL '3 days'
  )
ON CONFLICT (client_id) DO UPDATE SET
  hard_requirements = EXCLUDED.hard_requirements,
  rejection_patterns = EXCLUDED.rejection_patterns,
  off_limits = EXCLUDED.off_limits,
  preferred_sources = EXCLUDED.preferred_sources,
  salary_ceiling = EXCLUDED.salary_ceiling,
  updated_at = EXCLUDED.updated_at;

INSERT INTO positions (
  id, client_id, title, jd_raw, jd_diagnosis, rubric, status, target_fee, created_at, updated_at
)
VALUES
  (
    '22222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    '资深 AI 架构师',
    '负责大模型推理架构、跨团队协作、支撑企业级产品落地。',
    '{"difficulty":"high","market":"competitive"}'::jsonb,
    '[{"id":"tech_depth","label":"核心技术深度","description":"推理优化与底层架构 owner 经验","weight":35},{"id":"scale_delivery","label":"规模化落地经验","description":"高并发场景下的稳定交付","weight":25},{"id":"ownership","label":"Ownership 与影响力","description":"跨团队协同推进复杂项目","weight":20},{"id":"motivation","label":"动机与岗位适配","description":"动机、稳定性与组织阶段匹配","weight":20}]'::jsonb,
    'active',
    180000,
    NOW() - INTERVAL '35 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '22222222-2222-2222-2222-222222222223',
    '55555555-5555-5555-5555-555555555552',
    'AI产品总监',
    '负责电商场景 AI 产品战略与落地，带领 30 人以上团队，面向 GMV 增长负责。',
    '{"difficulty":"medium_high","market":"hot"}'::jsonb,
    '[{"id":"business_sense","label":"业务 Sense","description":"对电商增长和 AI 场景有深刻理解","weight":30},{"id":"ai_depth","label":"AI 产品深度","description":"具备模型或推荐策略落地经验","weight":25},{"id":"management","label":"团队管理","description":"带过 30 人以上团队","weight":25},{"id":"culture_fit","label":"文化匹配","description":"适应高节奏执行环境","weight":20}]'::jsonb,
    'active',
    92000,
    NOW() - INTERVAL '28 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '22222222-2222-2222-2222-222222222224',
    '55555555-5555-5555-5555-555555555553',
    '数据科学家（Senior）',
    '负责推荐模型与商业化策略优化，推进实验平台与线上稳定性。',
    '{"difficulty":"medium","market":"balanced"}'::jsonb,
    '[{"id":"modeling","label":"建模能力","description":"推荐或排序模型经验","weight":35},{"id":"production","label":"生产落地","description":"模型上线与平台协作经验","weight":30},{"id":"communication","label":"沟通协作","description":"能推进跨团队项目","weight":20},{"id":"motivation","label":"动机","description":"对业务和团队有真实兴趣","weight":15}]'::jsonb,
    'active',
    55000,
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '22222222-2222-2222-2222-222222222225',
    '55555555-5555-5555-5555-555555555551',
    '资深前端架构师',
    '负责复杂 Web 平台架构升级，推进跨端标准化和工程效率体系。',
    '{"difficulty":"high","market":"scarce"}'::jsonb,
    '[{"id":"arch","label":"架构深度","description":"复杂前端架构和性能治理 owner 经验","weight":35},{"id":"cross_team","label":"协作推动力","description":"跨团队标准制定和落地经验","weight":25},{"id":"people","label":"团队影响力","description":"带队或 mentoring 经验","weight":20},{"id":"fit","label":"动机匹配","description":"对平台型工作有兴趣","weight":20}]'::jsonb,
    'active',
    78000,
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '22222222-2222-2222-2222-222222222226',
    '55555555-5555-5555-5555-555555555554',
    'CFO · 新能源',
    '负责新能源企业资本市场与财务体系建设，推动融资和 IPO 准备。',
    '{"difficulty":"very_high","market":"niche"}'::jsonb,
    '[{"id":"capital","label":"资本市场经验","description":"融资、IPO 或并购经历","weight":35},{"id":"industry","label":"行业经验","description":"新能源或汽车行业背景","weight":30},{"id":"leadership","label":"组织领导力","description":"财务体系搭建与团队管理","weight":20},{"id":"board","label":"董事会协同","description":"与 CEO/董事会高效协同","weight":15}]'::jsonb,
    'active',
    180000,
    NOW() - INTERVAL '8 days',
    NOW() - INTERVAL '3 days'
  )
ON CONFLICT (id) DO UPDATE SET
  client_id = EXCLUDED.client_id,
  title = EXCLUDED.title,
  jd_raw = EXCLUDED.jd_raw,
  jd_diagnosis = EXCLUDED.jd_diagnosis,
  rubric = EXCLUDED.rubric,
  status = EXCLUDED.status,
  target_fee = EXCLUDED.target_fee,
  updated_at = EXCLUDED.updated_at;

INSERT INTO candidates (
  id, position_id, name, current_company, current_title, years_experience, resume_text, stage, stage_updated_at,
  ai_assessment, salary_current, salary_expected, offer_risk, onboard_date, created_at, updated_at
)
VALUES
  (
    '33333333-3333-3333-3333-333333333331',
    '22222222-2222-2222-2222-222222222222',
    '张大牛',
    '某头部互联网公司',
    '资深算法架构师',
    10,
    '主导过千亿参数大模型预训练与推理优化，负责跨团队协作和企业级客户交付。',
    'recommended',
    NOW() - INTERVAL '6 days',
    '{}'::jsonb,
    95000,
    130000,
    'counter_offer',
    NULL,
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '6 days'
  ),
  (
    '33333333-3333-3333-3333-333333333332',
    '22222222-2222-2222-2222-222222222222',
    '李云龙',
    '创业公司',
    '后端工程师',
    5,
    '5 年后端开发经验，近 1 年转 AI 方向，做过 LangChain 和知识库问答系统。',
    'sourcing',
    NOW() - INTERVAL '9 days',
    '{}'::jsonb,
    48000,
    65000,
    'none',
    NULL,
    NOW() - INTERVAL '9 days',
    NOW() - INTERVAL '9 days'
  ),
  (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    '王码农',
    '独角兽公司',
    'NLP 技术负责人',
    11,
    '负责 vLLM 生产化落地与推理加速，吞吐提升 3 倍，协调模型与平台团队。',
    'placed',
    NOW() - INTERVAL '35 days',
    '{"candidateName":"王码农","overallScore":91,"recommendation":"建议推进","summary":"在推理架构和跨团队推动上具备明显优势。"}'::jsonb,
    76000,
    90000,
    'none',
    CURRENT_DATE - 30,
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '35 days'
  ),
  (
    '33333333-3333-3333-3333-333333333334',
    '22222222-2222-2222-2222-222222222223',
    '陈晓明',
    '字节跳动',
    '算法产品经理',
    5,
    '负责推荐与内容理解产品，近三年持续推动 AI 驱动的增长实验。',
    'sourcing',
    NOW() - INTERVAL '2 days',
    '{}'::jsonb,
    72000,
    90000,
    'none',
    NULL,
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '33333333-3333-3333-3333-333333333335',
    '22222222-2222-2222-2222-222222222223',
    '李四',
    '美团',
    'AI产品总监',
    8,
    '带过 35 人团队，主导外卖推荐和商家增长策略，具备业务和算法协同经验。',
    'eval',
    NOW() - INTERVAL '5 days',
    '{"candidateName":"李四","overallScore":88,"recommendation":"建议推进","summary":"管理跨度和 AI 业务理解较强，接近目标画像。"}'::jsonb,
    85000,
    100000,
    'none',
    NULL,
    NOW() - INTERVAL '18 days',
    NOW() - INTERVAL '5 days'
  ),
  (
    '33333333-3333-3333-3333-333333333336',
    '22222222-2222-2222-2222-222222222223',
    '张伟',
    '美团',
    '商业化产品负责人',
    9,
    '负责商业化和推荐系统产品，近两年带团队做 GMV 提升专项。',
    'offer',
    NOW() - INTERVAL '2 days',
    '{}'::jsonb,
    85000,
    100000,
    'competing_offer',
    NULL,
    NOW() - INTERVAL '21 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '33333333-3333-3333-3333-333333333337',
    '22222222-2222-2222-2222-222222222223',
    '周静',
    '网易',
    '高级产品经理',
    7,
    '做过内容推荐和增长产品，有中型团队协作经验。',
    'client_interview',
    NOW() - INTERVAL '1 day',
    '{}'::jsonb,
    68000,
    86000,
    'none',
    NULL,
    NOW() - INTERVAL '14 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '33333333-3333-3333-3333-333333333338',
    '22222222-2222-2222-2222-222222222223',
    '赵六',
    '快手',
    '算法工程师',
    6,
    '推荐与搜索算法工程师，转管理路径初期。',
    'placed',
    NOW() - INTERVAL '30 days',
    '{}'::jsonb,
    56000,
    70000,
    'none',
    CURRENT_DATE - 30,
    NOW() - INTERVAL '54 days',
    NOW() - INTERVAL '30 days'
  ),
  (
    '33333333-3333-3333-3333-333333333339',
    '22222222-2222-2222-2222-222222222224',
    '王五',
    '滴滴',
    '数据科学家',
    7,
    '推荐系统建模与实验平台经验丰富，近两年聚焦转化率优化。',
    'offer',
    NOW() - INTERVAL '1 day',
    '{}'::jsonb,
    58000,
    65000,
    'counter_offer',
    NULL,
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '1 day'
  ),
  (
    '33333333-3333-3333-3333-333333333340',
    '22222222-2222-2222-2222-222222222224',
    '孙飞',
    '京东',
    '高级算法工程师',
    8,
    '做过推荐算法和实验平台，稳定性和收益都较强。',
    'placed',
    NOW() - INTERVAL '75 days',
    '{}'::jsonb,
    52000,
    60000,
    'none',
    CURRENT_DATE - 75,
    NOW() - INTERVAL '120 days',
    NOW() - INTERVAL '75 days'
  ),
  (
    '33333333-3333-3333-3333-333333333341',
    '22222222-2222-2222-2222-222222222225',
    '张三',
    '阿里本地生活',
    '前端架构负责人',
    10,
    '负责复杂前端平台架构升级，推动多端标准和工程效率体系。',
    'recommended',
    NOW() - INTERVAL '3 days',
    '{}'::jsonb,
    90000,
    110000,
    'none',
    NULL,
    NOW() - INTERVAL '17 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    '33333333-3333-3333-3333-333333333342',
    '22222222-2222-2222-2222-222222222225',
    '何安',
    '字节跳动',
    '前端技术专家',
    9,
    '擅长大型 Web 应用性能治理和跨团队基建协作。',
    'interview',
    NOW() - INTERVAL '8 days',
    '{}'::jsonb,
    88000,
    105000,
    'none',
    NULL,
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '8 days'
  ),
  (
    '33333333-3333-3333-3333-333333333343',
    '22222222-2222-2222-2222-222222222226',
    '高远',
    '理想汽车',
    '财务副总裁',
    16,
    '具备 IPO 和融资经验，长期负责汽车行业财务体系搭建。',
    'sourcing',
    NOW() - INTERVAL '4 days',
    '{}'::jsonb,
    125000,
    145000,
    'none',
    NULL,
    NOW() - INTERVAL '6 days',
    NOW() - INTERVAL '4 days'
  )
ON CONFLICT (id) DO UPDATE SET
  position_id = EXCLUDED.position_id,
  name = EXCLUDED.name,
  current_company = EXCLUDED.current_company,
  current_title = EXCLUDED.current_title,
  years_experience = EXCLUDED.years_experience,
  resume_text = EXCLUDED.resume_text,
  stage = EXCLUDED.stage,
  stage_updated_at = EXCLUDED.stage_updated_at,
  ai_assessment = EXCLUDED.ai_assessment,
  salary_current = EXCLUDED.salary_current,
  salary_expected = EXCLUDED.salary_expected,
  offer_risk = EXCLUDED.offer_risk,
  onboard_date = EXCLUDED.onboard_date,
  updated_at = EXCLUDED.updated_at;

INSERT INTO touch_records (
  id, candidate_id, position_id, touch_type, summary, sentiment, next_action, created_at, updated_at
)
VALUES
  (
    '44444444-4444-4444-4444-444444444441',
    '33333333-3333-3333-3333-333333333331',
    '22222222-2222-2222-2222-222222222222',
    'client_feedback',
    '客户认可技术深度，但担心薪资超预算。',
    'neutral',
    '准备薪资对齐方案',
    NOW() - INTERVAL '4 days',
    NOW() - INTERVAL '4 days'
  ),
  (
    '44444444-4444-4444-4444-444444444442',
    '33333333-3333-3333-3333-333333333332',
    '22222222-2222-2222-2222-222222222222',
    'wechat',
    '已发送首轮跟进消息，等待回复。',
    'neutral',
    '48 小时后再次跟进',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '44444444-4444-4444-4444-444444444443',
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    'onboarding_checkin',
    '候选人已入职一个月，准备 30 天回访。',
    'positive',
    '安排回访电话',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '44444444-4444-4444-4444-444444444444',
    '33333333-3333-3333-3333-333333333336',
    '22222222-2222-2222-2222-222222222223',
    'client_feedback',
    '客户认可业务理解，但要求本周内推进终面与 offer。',
    'positive',
    '48 小时内锁定薪资区间',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '2 days'
  ),
  (
    '44444444-4444-4444-4444-444444444445',
    '33333333-3333-3333-3333-333333333339',
    '22222222-2222-2222-2222-222222222224',
    'wechat',
    '候选人透露现东家已经给出 counter-offer。',
    'negative',
    '今天内完成反 offer 沟通',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
  ),
  (
    '44444444-4444-4444-4444-444444444446',
    '33333333-3333-3333-3333-333333333341',
    '22222222-2222-2222-2222-222222222225',
    'client_feedback',
    '客户认为技术深度可以，但需要再验证跨团队推动案例。',
    'neutral',
    '补充跨团队项目证据',
    NOW() - INTERVAL '3 days',
    NOW() - INTERVAL '3 days'
  ),
  (
    '44444444-4444-4444-4444-444444444447',
    '33333333-3333-3333-3333-333333333338',
    '22222222-2222-2222-2222-222222222223',
    'onboarding_checkin',
    '入职 30 天跟进，整体适应良好。',
    'positive',
    '同步客户 HR，确认试用期目标',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  candidate_id = EXCLUDED.candidate_id,
  position_id = EXCLUDED.position_id,
  touch_type = EXCLUDED.touch_type,
  summary = EXCLUDED.summary,
  sentiment = EXCLUDED.sentiment,
  next_action = EXCLUDED.next_action,
  updated_at = EXCLUDED.updated_at;
