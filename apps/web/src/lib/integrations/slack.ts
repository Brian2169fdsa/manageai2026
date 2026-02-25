/* eslint-disable @typescript-eslint/no-explicit-any */

const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_API_BASE = 'https://slack.com/api';

async function slackRequest(method: string, body?: Record<string, any>) {
  if (!SLACK_BOT_TOKEN) {
    return {
      success: false,
      error: 'Slack not configured. Add SLACK_BOT_TOKEN to environment variables.',
    };
  }

  const url = `${SLACK_API_BASE}/${method}`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Bearer ${SLACK_BOT_TOKEN}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json();

    if (!data.ok) {
      return { success: false, error: data.error || `Slack API error (${res.status})` };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function postMessage(
  channel: string,
  text: string,
  options?: { username?: string; icon_emoji?: string; thread_ts?: string }
) {
  return slackRequest('chat.postMessage', {
    channel,
    text,
    ...options,
  });
}

export async function postRichMessage(
  channel: string,
  blocks: any[],
  text?: string
) {
  return slackRequest('chat.postMessage', {
    channel,
    blocks,
    text: text ?? '',
  });
}

export async function lookupUserByEmail(email: string) {
  return slackRequest('users.lookupByEmail', { email });
}

export async function listChannels(limit = 200) {
  return slackRequest('conversations.list', {
    limit,
    exclude_archived: true,
    types: 'public_channel,private_channel',
  });
}

export async function getChannelInfo(channel: string) {
  return slackRequest('conversations.info', { channel });
}

export async function sendMessage(channel: string, text: string, blocks?: any[]) {
  if (blocks && blocks.length > 0) {
    return slackRequest('chat.postMessage', { channel, text, blocks });
  }
  return slackRequest('chat.postMessage', { channel, text });
}

export async function createChannel(name: string) {
  return slackRequest('conversations.create', { name, is_private: false });
}

export async function uploadFile(channel: string, content: string, filename: string) {
  return slackRequest('files.uploadV2', { channel_id: channel, content, filename });
}

export function isConfigured(): boolean {
  return !!SLACK_BOT_TOKEN;
}

export const CHANNELS = {
  BUILDS: '#builds',
  SALES: '#sales',
  ALERTS: '#alerts',
  GENERAL: '#general',
  LEADERSHIP: '#leadership',
} as const;
