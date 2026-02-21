import dotenv from 'dotenv';
import type { APIRequestContext } from '@playwright/test';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY;

export function hasPromptApiConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export async function callAiMessageParser(
  request: APIRequestContext,
  message: string,
  options?: {
    currentDate?: string;
    previousContext?: unknown;
    conversationHistory?: Array<{ role: string; content: string; timestamp: string }>;
  },
) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase URL or anon key for live prompt tests');
  }

  const response = await request.post(`${SUPABASE_URL}/functions/v1/ai-message-parser`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    data: {
      message,
      currentDate: options?.currentDate ?? '2026-02-17',
      previousContext: options?.previousContext,
      conversationHistory: options?.conversationHistory ?? [],
    },
    timeout: 60_000,
  });

  let body: any = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return {
    status: response.status(),
    ok: response.ok(),
    body,
  };
}

