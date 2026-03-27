# Research Protocol: Automated Information Gathering

## Phase 1: Rapid Classification (before any searches)

Determine system type to select the right search template:

| Type | Signals | Protocol |
|------|---------|----------|
| **Public Company** | Stock ticker, SEC filings, earnings calls | Protocol A |
| **Private Company** | Funded startup, PE-backed, family business | Protocol B |
| **Government / Regulator** | Agency, ministry, public institution | Protocol C |
| **DAO / Web3** | On-chain governance, token holders, multisig | Protocol D |
| **Platform Ecosystem** | Marketplace, two-sided network, API economy | Protocol E |
| **Industry / Market** | Sector-level, not single org | Protocol F |

---

## Protocol A: Public Company

Run these searches **in parallel** (3 agents simultaneously):

**Agent 1 — Financial & Governance Signals**
```
Search queries (run all, pick most informative results):
1. "[Company] annual report 2024 OR 10-K"
2. "[Company] proxy statement shareholder 2024"
3. "[Company] CEO compensation vs performance"
4. "[Company] insider selling OR buyback"
5. "[Company] credit rating downgrade OR upgrade"
```

**Agent 2 — Operational & Cultural Signals**
```
1. "[Company] layoffs OR restructuring 2023 2024"
2. "[Company] Glassdoor CEO approval rating"
3. "[Company] employee lawsuit OR EEOC complaint"
4. "[Company] product recall OR regulatory fine"
5. "[Company] innovation lab OR R&D investment"
```

**Agent 3 — Competitive & Narrative Signals**
```
1. "[Company] market share loss OR gain 2024"
2. "[Company] activist investor OR short seller report"
3. "[Company] analyst downgrade OR 'avoid'"
4. "[Company] brand perception OR NPS survey"
5. "[Company] antitrust OR regulatory investigation"
```

**Credibility ranking for sources:**
- Tier 1 (high): SEC filings, audited financials, regulatory orders, court records
- Tier 2 (medium): Bloomberg/FT/WSJ analysis, analyst reports, earnings transcripts
- Tier 3 (low): Press releases, company blog, CEO interviews
- Tier 4 (signal only): Glassdoor, Reddit, Twitter/X, anonymous leaks

---

## Protocol B: Private Company

Private companies have less mandatory disclosure — use triangulation:

**Agent 1 — Funding & Investor Signals**
```
1. "[Company] funding round Crunchbase OR PitchBook"
2. "[Company] valuation down round OR flat round"
3. "[Company] investor [lead VC name] portfolio update"
4. "[Company] acqui-hire OR acquiree"
5. "[Company] runway OR burn rate"
```

**Agent 2 — People & Culture Signals**
```
1. "[Company] LinkedIn headcount growth OR decline"
2. "[Company] CTO OR CPO departure"
3. "[Company] Glassdoor reviews culture"
4. "[Company] hiring freeze OR layoffs"
5. "[Company] founder conflict OR co-founder departure"
```

**Agent 3 — Market & Product Signals**
```
1. "[Company] customer reviews G2 OR Capterra OR Trustpilot"
2. "[Company] pricing change OR freemium pivot"
3. "[Company] competitors beating OR losing to"
4. "[Company] product launch failed OR delayed"
5. "[Company] legal dispute customer OR partner"
```

**Additional technique for private companies:**
- Check LinkedIn for organizational structure signals (how many layers, team sizes)
- Check job postings for strategic signals (what roles are they hiring/not hiring?)
- Check former employee LinkedIn profiles for departure patterns

---

## Protocol C: Government / Public Institution

**Agent 1 — Accountability & Oversight Signals**
```
1. "[Agency] inspector general report OR audit finding"
2. "[Agency] GAO report OR parliamentary inquiry"
3. "[Agency] budget cut OR sequester impact"
4. "[Agency] mission creep OR scope expansion"
5. "[Agency] FOIA request revelations"
```

**Agent 2 — Performance & Delivery Signals**
```
1. "[Agency] backlog OR processing time increase"
2. "[Agency] program failure OR cost overrun"
3. "[Agency] employee morale survey OR union grievance"
4. "[Agency] leadership turnover OR acting director"
5. "[Agency] Congressional testimony criticism"
```

**Agent 3 — Political & Legitimacy Signals**
```
1. "[Agency] political appointee vs career staff conflict"
2. "[Agency] mandate ambiguity OR conflicting legislation"
3. "[Agency] public trust survey OR polling"
4. "[Agency] media criticism OR editorial board"
5. "[Agency] industry capture OR revolving door"
```

---

## Protocol D: DAO / Web3 Organization

**On-chain data (highest credibility for DAOs):**
```
1. Check governance forum (Discourse/Commonwealth): proposal pass rates, voter turnout, debate quality
2. Check on-chain: treasury diversification, token concentration (Gini coefficient)
3. Check Dune Analytics dashboards for the protocol
4. Check Snapshot: voter participation trends over time
5. Check GitHub: contributor diversity, commit frequency, core team size
```

**Agent 1 — Governance Health**
```
1. "[DAO] governance attack OR hostile proposal"
2. "[DAO] voter apathy OR quorum failure"
3. "[DAO] multisig signers concentration"
4. "[DAO] core team vs community conflict"
5. "[DAO] token whale voting dominance"
```

**Agent 2 — Protocol & Treasury Signals**
```
1. "[Protocol] TVL decline OR exploit"
2. "[DAO] treasury runway months"
3. "[Protocol] fee revenue vs token incentive dependency"
4. "[DAO] contributor attrition OR grants program failure"
5. "[Protocol] competitive positioning vs forks"
```

---

## Protocol E: Platform Ecosystem

**Agent 1 — Ecosystem Health**
```
1. "[Platform] developer exodus OR API deprecation anger"
2. "[Platform] third-party app banned OR removed"
3. "[Platform] take rate increase OR policy change"
4. "[Platform] network effects weakening OR multi-homing"
5. "[Platform] complement vs substitute dynamic"
```

**Agent 2 — Supply & Demand Side**
```
1. "[Platform] seller OR creator complaints 2024"
2. "[Platform] buyer OR user trust issues"
3. "[Platform] liquidity crisis OR GMV decline"
4. "[Platform] quality degradation OR spam problem"
5. "[Platform] regulatory antitrust concern"
```

---

## Protocol F: Industry / Market

```
Agent 1 — Industry Structure:
1. "[Industry] consolidation OR fragmentation trend"
2. "[Industry] entry barriers increasing OR decreasing"
3. "[Industry] Porter five forces analysis 2024"
4. "[Industry] dominant design OR standards war"

Agent 2 — Disruption Signals:
1. "[Industry] startup disrupting OR incumbent threat"
2. "[Industry] technology substitution OR obsolescence"
3. "[Industry] regulatory shock OR deregulation"
4. "[Industry] commodity trap OR margin compression"
```

---

## Phase 2: Information Synthesis Protocol

After gathering raw data, before analysis:

1. **Contradiction detection**: Flag any sources that directly contradict each other — this itself is a signal
2. **Recency weighting**: Weight recent signals 3x more than signals >18 months old
3. **Source diversity check**: If all signals come from one source type (e.g., only press releases), flag as incomplete
4. **Gap inventory**: List what you couldn't find — absence of information is data
5. **Confidence calibration**:
   - High confidence: Multiple independent Tier 1-2 sources agree
   - Medium confidence: Single strong source OR multiple weak sources
   - Low confidence: Only Tier 3-4 sources OR contradictory signals
   - No data: Must flag explicitly, cannot analyze what you cannot observe

## Phase 3: Research Completeness Checklist

Before proceeding to diagnosis, confirm:
- [ ] Financial/resource flows can be characterized (even roughly)
- [ ] Key decision-makers identified
- [ ] At least one signal per dimension gathered
- [ ] Source diversity adequate (not all from same angle)
- [ ] Time range covered (recent + historical context)
- [ ] Contradictions flagged and noted

If fewer than 4 of these are met, ask user for additional context before proceeding.
