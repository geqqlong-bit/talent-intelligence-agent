import { runTalentIntelligence } from './server/app/service.mjs';

async function testProactive() {
  console.log("--- Testing Proactive Classifier (Missing Role) ---");
  const payload = {
    templateId: "auto",
    searchContext: {
      hiringBrief: "Find me some good candidates."
    },
    runtime: { mode: "local-template", runner: "local-template" }
  };
  
  try {
     await runTalentIntelligence(payload, { requestId: "test" });
  } catch (err) {
     console.log("Proactive Result:", err.error.message);
  }
}

async function testSuccess() {
  console.log("\n--- Testing Successful Classification & RAG & Rules ---");
  const payload = {
    templateId: "auto",
    searchContext: {
      roleTitle: "VP Product",
      hiringBrief: "We need a strong VP Product in Beijing. Focus on sourcing strategy and target companies.",
      targetIndustry: "Enterprise Software"
    },
    runtime: { mode: "local-template", runner: "local-template" }
  };
  
  try {
     const result = await runTalentIntelligence(payload, { requestId: "test" });
     console.log("Template Classified As:", result.templateId);
     console.log("RAG Context found in brief?", result.reportMarkdown.includes('EXPERT RAG INJECTION'));
     console.log("Expert Rule applied to Markdown?", result.reportMarkdown.includes('EXPERT RULE FAILED') || result.reportMarkdown.includes('Expert Rule Validation Failed:'));
     console.log("\nSnippet of Markdown:\n", result.reportMarkdown.substring(0, 500), "\n...\n");
  } catch (err) {
     console.error("Error:", err);
  }
}

async function run() {
  await testProactive();
  await testSuccess();
}

run();
