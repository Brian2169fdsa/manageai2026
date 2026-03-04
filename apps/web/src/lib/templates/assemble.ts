// ── Template Assembly ────────────────────────────────────────────────────────
// Combines a static HTML template shell with AI-generated data JSON
// to produce the final artifact HTML.

import { getBuildPlanTemplate } from './build-plan-template';
import { getSolutionDemoTemplate } from './solution-demo-template';
import type { BuildPlanData, SolutionDemoData } from './data-schemas';

/**
 * Assemble a build plan HTML artifact from data JSON.
 * The template's getDefaultData() returns __MANAGEAI_DATA__ which we replace
 * with the actual data object.
 */
export function assembleBuildPlan(data: BuildPlanData): string {
  const template = getBuildPlanTemplate();

  // Generate a default system prompt placeholder if not provided
  const dataWithDefaults = {
    ...data,
    systemPromptText: `You are the ${data.clientName} ${data.solutionName} AI. Follow all rules defined in this build manual. Output valid JSON matching the schema provided. No extra keys, no missing required fields.`,
  };

  return template.replace(
    /__MANAGEAI_DATA__/g,
    JSON.stringify(dataWithDefaults)
  );
}

/**
 * Assemble a solution demo HTML artifact from data JSON.
 * Replaces five placeholders:
 * - __MANAGEAI_DATA__              → main editor fields (clientName, etc.)
 * - __MANAGEAI_TRIP_DATA__         → trip/record data array
 * - __MANAGEAI_TRANSCRIPT_LINES__  → transcript conversation lines
 * - __MANAGEAI_TECH_STACK__        → technology stack cards
 * - __MANAGEAI_SCENARIOS__         → scenario specifications
 */
export function assembleSolutionDemo(data: SolutionDemoData): string {
  const template = getSolutionDemoTemplate();

  // Separate the embedded arrays from the main data object
  const { tripData, transcriptLines, scenarios, techStack, ...mainData } = data;

  let result = template;

  // Replace main data (editor fields like clientName, solutionName, etc.)
  result = result.replace(
    /__MANAGEAI_DATA__/g,
    JSON.stringify(mainData)
  );

  // Replace trip data array
  result = result.replace(
    /__MANAGEAI_TRIP_DATA__/g,
    JSON.stringify(tripData)
  );

  // Replace transcript lines array
  result = result.replace(
    /__MANAGEAI_TRANSCRIPT_LINES__/g,
    JSON.stringify(transcriptLines)
  );

  // Replace tech stack array
  result = result.replace(
    /__MANAGEAI_TECH_STACK__/g,
    JSON.stringify(techStack)
  );

  // Replace scenarios array
  result = result.replace(
    /__MANAGEAI_SCENARIOS__/g,
    JSON.stringify(scenarios)
  );

  return result;
}
