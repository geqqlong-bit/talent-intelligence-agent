# Intake fields

Use this reference when converting a fuzzy request into a structured brief.

## 1) Core search fields
- `projectName`: short task name, usually client + role + goal
- `roleTitle`: target role title, required and must be non-empty after trimming
- `clientName`: hiring company or external client name
- `searchType`: `executive_search`, `talent_map`, `replacement`, `succession`, or similar
- `mandateType`: `retained`, `contingent`, or `in_house`
- `companyContext`: employer stage, team context, business model, or search context
- `companyStage`: e.g. Seed, Series B, listed company, turnaround
- `businessModel`: SaaS, consumer internet, industrial automation, etc.
- `teamStage`: build, rebuild, scale, turnaround, succession
- `hiringBrief`: raw business need or JD summary
- `objective`: what deliverable the user wants
- `targetIndustry`: likely talent source industry
- `targetCompanies`: likely company pool
- `targetFunctions`: adjacent functions or transferable backgrounds worth searching
- `targetBackgrounds`: labels such as 0→1, 1→10, multinational, founder-led, platform business
- `offLimits`: companies that cannot be touched because of conflicts or client rules
- `location`: primary hiring market
- `targetGeographies`: secondary candidate markets to include
- `salaryRange`: cash compensation band if known
- `compensationMix`: base / bonus / LTIP / sign-on structure
- `equity`: option or stock guidance if relevant
- `templateId`: the closest workflow template

## 2) Calibration fields that make a real search better
- `reportingLine`: who the role reports to
- `level`: Director / VP / GM / Partner / C-level
- `headcount`: number of hires in this mandate
- `urgency`: urgent / normal / confidential / backfill with date pressure
- `searchReason`: growth, replacement, stealth build, succession, underperformance, etc.
- `successProfile`: what “good” looks like in the first 12-18 months
- `successMetrics`: concrete outcomes to judge success
- `stakeholderBrief`: founder / CEO / CHRO preferences, biases, or non-obvious expectations
- `mustHaveSkills`: non-negotiables
- `niceToHaveSkills`: useful but not essential
- `dealBreakers`: explicit no-go conditions
- `sourceChannels`: network, direct approach, platforms, industry communities
- `interviewProcess`: process shape and stage design
- `interviewPanel`: who will interview / assess
- `processConstraints`: notice period limits, budget cap, confidentiality, relocation constraints
- `marketSignals`: known market scarcity, competitor activity, or comp pressure

## 3) Candidate-assessment fields
- `candidateName`: person being assessed
- `candidateSummary`: condensed profile / resume summary
- `candidateHighlights`: strongest selling points
- `candidateConcerns`: risks, gaps, or doubts
- `interviewerNotes`: debrief notes or transcript summary

## 4) Practical defaults
If the user is vague, infer sensible working defaults:
- unknown company name -> `Confidential Client`
- unspecified search type -> `executive_search`
- unspecified mandate type -> `in_house` if clearly internal, else `TBD`
- unspecified location -> main market mentioned, else `China`
- unspecified salary -> `TBD`
- unspecified off-limits -> empty list, not `TBD`

## 5) Intake quality bar
A search brief is usually strong enough to run when you have:
1. business reason for the hire
2. role scope + reporting line
3. must-have vs nice-to-have split
4. target company hypotheses
5. compensation / geography / timing constraints

If one of these is missing, still proceed, but make the gap explicit in the report.