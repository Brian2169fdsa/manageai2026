export interface ScheduledJob {
  name: string;
  schedule: string; // cron expression
  department: string;
  agentName: string;
  task: string; // what to tell the agent to do
  enabled: boolean;
}

export const SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: 'ceo-morning-brief',
    schedule: '0 7 * * 1-5', // 7am weekdays
    department: 'ceo',
    agentName: 'Executive AI',
    task: `Generate the daily executive brief. Include:
      1. Pipeline summary: total open deals, total value, deals moved yesterday
      2. Build queue: tickets in BUILDING status, any overdue (>5 days)
      3. Deployment health: any failed deploys in last 24h
      4. Client alerts: any clients needing attention
      5. Team capacity: open tickets per person
      Format as a clean summary Dave can read in 2 minutes.
      Post to Slack #leadership channel.
      Save to activity_events with event_type='morning_brief'.`,
    enabled: true,
  },
  {
    name: 'sales-pipeline-review',
    schedule: '0 8 * * 1-5', // 8am weekdays
    department: 'sales',
    agentName: 'Sales AI',
    task: `Run daily pipeline review.
      1. Find all deals with no activity in 7+ days — draft a follow-up note for each
      2. Find deals where expected close date has passed — flag for Tony
      3. Find deals with $0 value — list them for Tony to update
      4. Identify the top 3 deals most likely to close this week
      Post summary to Slack #sales.
      Save findings to activity_events.`,
    enabled: true,
  },
  {
    name: 'build-queue-check',
    schedule: '0 9 * * 1-5', // 9am weekdays
    department: 'engineering',
    agentName: 'Engineering AI',
    task: `Check the build queue.
      1. List all tickets in BUILDING status with age > 3 days — flag as at-risk
      2. List tickets in SUBMITTED status not yet analyzed — trigger analysis if stuck
      3. List tickets in REVIEW_PENDING for > 2 days — nudge reviewer
      4. Summarize: X builds in progress, Y at risk, Z waiting review
      Post to Slack #builds.
      Save to activity_events.`,
    enabled: true,
  },
  {
    name: 'delivery-health-check',
    schedule: '0 9 * * 1-5', // 9am weekdays
    department: 'delivery',
    agentName: 'Delivery AI',
    task: `Run client health check.
      1. Check all deployments from last 30 days — any errors or failures?
      2. List clients with no ticket activity in 30+ days — potential churn risk
      3. List clients with builds completing this week — schedule delivery review
      4. Flag any client with 2+ failed deployments
      Post health summary to Slack #delivery.
      Save to activity_events with event_type='health_check'.`,
    enabled: true,
  },
  {
    name: 'weekly-ceo-report',
    schedule: '0 8 * * 1', // 8am every Monday
    department: 'ceo',
    agentName: 'Executive AI',
    task: `Generate weekly company report for Dave.
      1. Deals: new deals added, deals closed, pipeline value change WoW
      2. Builds: tickets created, completed, deployed last week
      3. Revenue signals: total deployment value, retainer clients active
      4. Team: busiest team members, capacity for new work
      5. Wins: notable completions from last week
      6. Risks: stalled deals, overdue builds, unhappy clients
      Email report to dave@manageai.io.
      Post summary to #leadership.`,
    enabled: true,
  },
  {
    name: 'monthly-client-reports',
    schedule: '0 9 1 * *', // 9am on the 1st of every month
    department: 'delivery',
    agentName: 'Delivery AI',
    task: `Generate monthly performance reports for all active clients.
      For each client with at least one deployed automation:
      1. Pull deployment records and any available run data
      2. Generate a performance summary: automations active, estimated tasks saved
      3. Calculate estimated hours saved (assume 2min per automated task)
      4. Draft the client email with the report attached
      5. Save report to client_reports table with status='pending_review'
      Alert Dan in Slack #delivery: "X monthly reports ready for review"
      Dan will review and approve before sending.`,
    enabled: true,
  },
  {
    name: 'marketing-content-pipeline',
    schedule: '0 10 * * 1', // 10am every Monday
    department: 'marketing',
    agentName: 'Marketing AI',
    task: `Weekly content generation.
      1. Find all tickets that moved to CLOSED status last week
      2. For each completed build: draft a case study outline (company type, problem, solution, automation built, expected ROI)
      3. Draft 3 LinkedIn posts for the week based on completed builds
      4. Draft 1 longer-form blog post idea with outline
      5. Save all drafts to activity_events with event_type='content_draft'
      Post to Slack #marketing: "X content pieces ready for Robert to review"`,
    enabled: true,
  },
];

export function getJobByName(name: string): ScheduledJob | undefined {
  return SCHEDULED_JOBS.find((j) => j.name === name);
}

export function getJobsBySchedule(cronExpression: string): ScheduledJob[] {
  return SCHEDULED_JOBS.filter((j) => j.enabled && j.schedule === cronExpression);
}
