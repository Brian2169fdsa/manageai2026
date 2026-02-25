import { AgentEvent } from './index';

// ── Event Handler Registry ─────────────────────────────────────────────────────
//
// Maps event types to the agents that should react and how.
// Each handler specifies:
//   department   — used to look up the agent config in /api/agent/chat
//   agentName    — matched against event.toAgents to filter who reacts
//   generateReaction — builds the prompt sent to the agent

export const EVENT_HANDLERS: Record<
  string,
  {
    department: string;
    agentName: string;
    generateReaction: (event: AgentEvent) => string;
  }[]
> = {
  'deal.closed': [
    {
      department: 'engineering',
      agentName: 'Engineering AI',
      generateReaction: (e) =>
        `A new deal just closed: ${e.payload.dealTitle} for ${e.payload.orgName}. Check current build capacity and acknowledge the incoming ticket. Query the current build queue and report how many active builds are in progress.`,
    },
    {
      department: 'delivery',
      agentName: 'Delivery AI',
      generateReaction: (e) =>
        `New client coming: ${e.payload.orgName}. Prepare a delivery readiness check — what's current team capacity and when can we start their build?`,
    },
  ],

  'ticket.deployed': [
    {
      department: 'delivery',
      agentName: 'Delivery AI',
      generateReaction: (e) =>
        `Build deployed for ${e.payload.clientName} on ${e.payload.platform}. Begin monitoring phase: note the deployment URL and set a reminder to check in with the client in 3 days. Log this to activity_events.`,
    },
    {
      department: 'marketing',
      agentName: 'Marketing AI',
      generateReaction: (e) =>
        `New build completed and deployed for ${e.payload.clientName}. Draft a case study outline for this automation project. Keep it to 3 bullet points: the problem, the solution, and the expected impact.`,
    },
  ],

  'automation.error': [
    {
      department: 'engineering',
      agentName: 'Engineering AI',
      generateReaction: (e) =>
        `URGENT: Deployed automation error detected. Workflow ID: ${e.payload.workflowId}. Error: ${e.payload.errorMessage}. Diagnose the likely cause and suggest a fix.`,
    },
  ],

  'client.at_risk': [
    {
      department: 'sales',
      agentName: 'Sales AI',
      generateReaction: (e) =>
        `Client ${e.payload.clientName} health score dropped to ${e.payload.healthScore}. Review their deal in Pipedrive and draft a re-engagement check-in message for Tony to send.`,
    },
  ],

  'ticket.approved': [
    {
      department: 'engineering',
      agentName: 'Engineering AI',
      generateReaction: (e) =>
        `Ticket approved for ${e.payload.clientName} on platform ${e.payload.platform}. Ticket ID: ${e.payload.ticketId}. Acknowledge this in the build queue and confirm it is ready for deployment.`,
    },
    {
      department: 'delivery',
      agentName: 'Delivery AI',
      generateReaction: (e) =>
        `Build approved for client ${e.payload.clientName} (ticket ${e.payload.ticketId}). Prepare delivery checklist for the upcoming deployment.`,
    },
  ],
};
