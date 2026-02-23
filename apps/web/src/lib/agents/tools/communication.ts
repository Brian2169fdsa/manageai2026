/* eslint-disable @typescript-eslint/no-explicit-any */
import { AgentTool } from '../types';

export const communicationTools: AgentTool[] = [
  {
    name: 'sendEmail',
    description: 'Draft and send an email. Currently logs the intent and returns a mock confirmation.',
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
          description: 'Email body text (plain text or simple HTML)',
        },
      },
      required: ['to', 'subject', 'body'],
    },
    execute: async ({ to, subject, body }: any, _supabase: any) => {
      const start = Date.now();
      console.log(`[tool:sendEmail] Intent: to=${to}, subject="${subject}", body length=${body.length}`);
      // Mock implementation — replace with Resend/SendGrid when email infra is ready
      const result = {
        success: true,
        message_id: `mock-${Date.now()}`,
        to,
        subject,
        sent_at: new Date().toISOString(),
        note: 'Email logged (live sending not yet configured)',
        duration_ms: Date.now() - start,
      };
      console.log(`[tool:sendEmail] Mock sent in ${result.duration_ms}ms`);
      return result;
    },
  },

  {
    name: 'sendSlackMessage',
    description: 'Send a message to a Slack channel. Currently logs the intent and returns a mock confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        channel: {
          type: 'string',
          description: 'Slack channel name (e.g. "#general", "#sales", "@username")',
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
      console.log(`[tool:sendSlackMessage] Intent: channel=${channel}, message="${message.slice(0, 100)}"`);
      const result = {
        success: true,
        ts: `${Date.now() / 1000}`,
        channel,
        sent_at: new Date().toISOString(),
        note: 'Slack message logged (Slack integration not yet configured)',
        duration_ms: Date.now() - start,
      };
      console.log(`[tool:sendSlackMessage] Mock sent in ${result.duration_ms}ms`);
      return result;
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
      console.log(`[tool:createCalendarEvent] Intent: title="${title}", date=${date}, attendees=${attendees.length}`);
      const result = {
        success: true,
        event_id: `mock-event-${Date.now()}`,
        title,
        date,
        attendees,
        description,
        created_at: new Date().toISOString(),
        note: 'Calendar event logged (calendar integration not yet configured)',
        duration_ms: Date.now() - start,
      };
      console.log(`[tool:createCalendarEvent] Mock created in ${result.duration_ms}ms`);
      return result;
    },
  },

  {
    name: 'updatePipedrive',
    description: 'Update a deal or contact in Pipedrive CRM. Currently logs the intent and returns a mock confirmation.',
    input_schema: {
      type: 'object',
      properties: {
        deal_id: {
          type: 'string',
          description: 'Pipedrive deal ID to update',
        },
        stage: {
          type: 'string',
          description: 'New pipeline stage for the deal',
        },
        note: {
          type: 'string',
          description: 'Note to add to the deal',
        },
      },
      required: ['deal_id'],
    },
    execute: async ({ deal_id, stage, note }: any, _supabase: any) => {
      const start = Date.now();
      console.log(`[tool:updatePipedrive] Intent: deal_id=${deal_id}, stage=${stage}, note="${(note ?? '').slice(0, 80)}"`);
      const result = {
        success: true,
        deal_id,
        stage,
        note,
        updated_at: new Date().toISOString(),
        note_msg: 'Pipedrive update logged (CRM integration not yet configured)',
        duration_ms: Date.now() - start,
      };
      console.log(`[tool:updatePipedrive] Mock updated in ${result.duration_ms}ms`);
      return result;
    },
  },
];
