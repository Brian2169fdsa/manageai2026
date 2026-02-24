/* eslint-disable @typescript-eslint/no-explicit-any */

const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const PIPEDRIVE_DOMAIN = process.env.PIPEDRIVE_DOMAIN || 'api.pipedrive.com';

async function pipedriveRequest(endpoint: string, method = 'GET', body?: any) {
  if (!PIPEDRIVE_API_TOKEN) {
    return {
      success: false,
      error: 'Pipedrive not configured. Add PIPEDRIVE_API_TOKEN to environment variables.',
    };
  }

  const sep = endpoint.includes('?') ? '&' : '?';
  const url = `https://${PIPEDRIVE_DOMAIN}/v1${endpoint}${sep}api_token=${PIPEDRIVE_API_TOKEN}`;

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) options.body = JSON.stringify(body);

  try {
    const res = await fetch(url, options);
    const data = await res.json();

    if (!data.success) {
      return { success: false, error: data.error || `Pipedrive API error (${res.status})` };
    }

    return { success: true, data: data.data, additional_data: data.additional_data };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

export async function getDeals(options?: {
  status?: 'open' | 'won' | 'lost' | 'all_not_deleted';
  limit?: number;
  stage_id?: number;
  start?: number;
}) {
  let endpoint = `/deals?limit=${options?.limit ?? 50}`;
  if (options?.status) endpoint += `&status=${options.status}`;
  if (options?.stage_id) endpoint += `&stage_id=${options.stage_id}`;
  if (options?.start) endpoint += `&start=${options.start}`;
  return pipedriveRequest(endpoint);
}

export async function getDeal(dealId: number) {
  return pipedriveRequest(`/deals/${dealId}`);
}

export async function updateDeal(
  dealId: number,
  updates: { stage_id?: number; status?: string; value?: number; title?: string }
) {
  return pipedriveRequest(`/deals/${dealId}`, 'PUT', updates);
}

export async function addDealNote(dealId: number, content: string) {
  return pipedriveRequest('/notes', 'POST', { deal_id: dealId, content });
}

export async function getPipelines() {
  return pipedriveRequest('/pipelines');
}

export async function getStages(pipelineId?: number) {
  let endpoint = '/stages';
  if (pipelineId) endpoint += `?pipeline_id=${pipelineId}`;
  return pipedriveRequest(endpoint);
}

export async function getPersons(limit = 50) {
  return pipedriveRequest(`/persons?limit=${limit}`);
}

export async function getDealsSummary() {
  return pipedriveRequest('/deals/summary');
}

export async function searchDeals(term: string) {
  return pipedriveRequest(`/deals/search?term=${encodeURIComponent(term)}&limit=10`);
}

export function isConfigured(): boolean {
  return !!PIPEDRIVE_API_TOKEN;
}
