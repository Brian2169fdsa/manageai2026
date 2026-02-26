/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgentTool } from '../types';
import * as slack from '@/lib/integrations/slack';

export const communicationTools: AgentTool[] = [
  {
    name: 'sendEmail',
    description:
      'Send a real email to the specified recipient. Include a clear subject line and professional body text. The email will be sent immediately via Resend. If no API key is configured, it logs the intent instead.',
    input_schema: {
      type: 'object',
      properties: {
        to: {
          type: 'string',
          description: 'Recipient email address',
        },
        subject: {
          type: 'string',
          description: 'Email subject line',
        },
        body: {
          type: 'string',
          description: 'Email body text. Use \\n for line breaks. Write as professional plain text.',
        },
      },
      required: ['to', 'subject', 'body'],
    },
    execute: async ({ to, subject, body }: any, supabase: any) => {
      const startTime = Date.now();
      console.log(`[tool:sendEmail] to=${to}, subject="${subject}", body=${body.length} chars`);

      if (process.env.RESEND_API_KEY) {
        try {
          const { Resend } = await import('resend');
          const resend = new Resend(process.env.RESEND_API_KEY);

          const htmlBody = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #1A1A2E; padding: 20px 24px; border-radius: 8px 8px 0 0;">
                <h2 style="color: white; margin: 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">MANAGE AI</h2>
              </div>
              <div style="padding: 28px 24px; background: #ffffff; border: 1px solid #E8E8F0; border-top: none; border-radius: 0 0 8px 8px;">
                ${body.replace(/\n/g, '<br/>')}
              </div>
              <div style="padding: 14px; text-align: center; font-size: 12px; color: #999;">
                Sent by ManageAI Platform
              </div>
            </div>
          `;

          const { data, error } = await resend.emails.send({
            from: process.env.EMAIL_FROM ?? 'Manage AI <noreply@manageai.app>',
            to,
            subject,
            html: htmlBody,
          });

          if (error) {
            console.error('[tool:sendEmail] Resend error:', error);
            return { success: false, error: error.message, duration_ms: Date.now() - startTime };
          }

          // Log to DB (best-effort)
          try {
            await supabase.from('email_notifications').insert({
              to_email: to,
              subject,
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
          } catch { /* table may not have all columns yet */ }

          console.log(`[tool:sendEmail] Sent via Resend in ${Date.now() - startTime}ms, id=${data?.id}`);
          return {
            success: true,
            message: `Email sent to ${to}`,
            email_id: data?.id,
            duration_ms: Date.now() - startTime,
          };
        } catch (err: any) {
          console.error('[tool:sendEmail] Exception:', err.message);
          return { success: false, error: err.message, duration_ms: Date.now() - startTime };
        }
      }

      // Demo mode — no API key — return not_configured so the agent reports this clearly
      console.log(`[tool:sendEmail] NOT CONFIGURED — no RESEND_API_KEY`);
      return {
        success: false,
        not_configured: true,
        message: `Email NOT sent — RESEND_API_KEY is not configured. Add this env var to enable real email delivery. Intended recipient: ${to}, subject: "${subject}". Go to Settings to check integration status.`,
        action_taken: false,
        duration_ms: Date.now() - startTime,
      };
    },
  },

  {
    name: 'sendSlackMessage',
    description:
      'Send a real message to a Slack channel. If SLACK_BOT_TOKEN is configured, the message is delivered immediately via the Slack Web API. Otherwise logs the intent and returns a demo confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Slack channel name or ID (e.g. "#general", "#sales", "@username", "C0123ABC")',
        },
        message: {
          type: 'string',
          description: 'Message text to send',
        },
      },
      required: ['channel', 'message'],
    },
    execute: async ({ channel, message }: any, _supabase: any) => {
      const start = Date.now();
      console.log(`[tool:sendSlackMessage] channel=${channel}, message="${message.slice(0, 100)}"`);

      if (slack.isConfigured()) {
        const result = await slack.postMessage(channel, message);
        const duration_ms = Date.now() - start;

        if (!result.success) {
          console.error(`[tool:sendSlackMessage] Slack error: ${result.error}`);
          return { success: false, error: result.error, duration_ms };
        }

        console.log(`[tool:sendSlackMessage] Sent via Slack API in ${duration_ms}ms`);
        return {
          success: true,
          ts: result.data?.ts,
          channel: result.data?.channel ?? channel,
          sent_at: new Date().toISOString(),
          duration_ms,
        };
      }

      // Not configured — return not_configured so the agent reports this clearly
      console.log(`[tool:sendSlackMessage] NOT CONFIGURED — no SLACK_BOT_TOKEN`);
      const duration_ms = Date.now() - start;
      return {
        success: false,
        not_configured: true,
        message: `Slack message NOT sent — SLACK_BOT_TOKEN is not configured. Add this env var to enable real Slack messages. Intended channel: ${channel}, message: "${message.slice(0, 100)}". Go to Settings to check integration status.`,
        action_taken: false,
        channel,
        duration_ms,
      };
    },
  },

  {
    name: 'createCalendarEvent',
    description: 'Create a calendar event. Currently logs the intent and returns a mock confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Event title',
        },
        date: {
          type: 'string',
          description: 'Event date and time in ISO 8601 format',
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of attendee email addresses',
        },
        description: {
          type: 'string',
          description: 'Optional event description or agenda',
        },
      },
      required: ['title', 'date'],
    },
    execute: async ({ title, date, attendees = [], description = '' }: any, _supabase: any) => {
      const start = Date.now();
      console.log(`[tool:createCalendarEvent] NOT CONFIGURED — title="${title}", date=${date}`);
      return {
        success: false,
        not_configured: true,
        message: `Calendar event NOT created — calendar integration is not yet configured. To enable, add a Google Calendar or Microsoft Graph API key. Intended event: "${title}" on ${date} with ${attendees.length} attendee(s).`,
        action_taken: false,
        title,
        date,
        attendees,
        description,
        duration_ms: Date.now() - start,
      };
    },
  },
];
