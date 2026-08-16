import { getOpenAiConfig } from './db/llmConfigStore.ts';
import { getPitchDeckChatSystemPrompt } from './content/pitchDeckChatKnowledge.ts';

export type ChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type PitchDeckChatResult = {
  reply: string;
  model: string;
  usedWebSearch: boolean;
};

function extractOutputText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = payload.output;
  if (Array.isArray(output)) {
    const chunks: string[] = [];
    for (const item of output) {
      if (!item || typeof item !== 'object') continue;
      const content = (item as { content?: unknown }).content;
      if (!Array.isArray(content)) continue;
      for (const part of content) {
        if (!part || typeof part !== 'object') continue;
        const text = (part as { text?: unknown }).text;
        if (typeof text === 'string' && text.trim()) {
          chunks.push(text.trim());
        }
      }
    }
    if (chunks.length > 0) {
      return chunks.join('\n').trim();
    }
  }

  return '';
}

async function callResponsesApi(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  message: string;
  history: ChatHistoryMessage[];
  enableWebSearch: boolean;
}): Promise<{ reply: string; usedWebSearch: boolean }> {
  const input: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: [{ type: 'input_text', text: options.systemPrompt }],
    },
  ];

  for (const turn of options.history.slice(-8)) {
    input.push({
      role: turn.role === 'assistant' ? 'assistant' : 'user',
      content: [
        {
          type: turn.role === 'assistant' ? 'output_text' : 'input_text',
          text: turn.content,
        },
      ],
    });
  }

  input.push({
    role: 'user',
    content: [{ type: 'input_text', text: options.message }],
  });

  const body: Record<string, unknown> = {
    model: options.model,
    input,
    temperature: 0.3,
  };

  if (options.enableWebSearch) {
    body.tools = [{ type: 'web_search_preview' }];
  }

  const response = await fetch(`${options.baseUrl}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    const error = payload.error as { message?: string } | undefined;
    throw new Error(error?.message || `OpenAI Responses API failed (${response.status}).`);
  }

  const reply = extractOutputText(payload);
  if (!reply) {
    throw new Error('OpenAI returned an empty response.');
  }

  return { reply, usedWebSearch: options.enableWebSearch };
}

async function callChatCompletions(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  message: string;
  history: ChatHistoryMessage[];
}): Promise<string> {
  const messages = [
    { role: 'system', content: options.systemPrompt },
    ...options.history.slice(-8).map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: 'user', content: options.message },
  ];

  const response = await fetch(`${options.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.3,
      messages,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };

  if (!response.ok) {
    throw new Error(payload.error?.message || `OpenAI Chat Completions failed (${response.status}).`);
  }

  const reply = String(payload.choices?.[0]?.message?.content ?? '').trim();
  if (!reply) {
    throw new Error('OpenAI returned an empty response.');
  }

  return reply;
}

export async function answerPitchDeckChat(options: {
  message: string;
  history?: ChatHistoryMessage[];
}): Promise<PitchDeckChatResult> {
  const message = options.message.trim();
  if (!message) {
    throw new Error('Message is required.');
  }
  if (message.length > 4000) {
    throw new Error('Message is too long (max 4000 characters).');
  }

  const history = (options.history ?? [])
    .filter((item) => item && (item.role === 'user' || item.role === 'assistant'))
    .map((item) => ({
      role: item.role,
      content: String(item.content ?? '').trim().slice(0, 4000),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-8);

  const config = await getOpenAiConfig();
  const systemPrompt = getPitchDeckChatSystemPrompt();

  try {
    const result = await callResponsesApi({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: config.modelName,
      systemPrompt,
      message,
      history,
      enableWebSearch: true,
    });
    return {
      reply: result.reply,
      model: config.modelName,
      usedWebSearch: result.usedWebSearch,
    };
  } catch (responsesError) {
    // Fallback: chat completions without web tools (older models / base URLs).
    try {
      const reply = await callChatCompletions({
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        model: config.modelName,
        systemPrompt: `${systemPrompt}\n\nNote: Live web search is unavailable for this request; answer from the knowledge pack and clearly mark any uncertainty about current public market facts.`,
        message,
        history,
      });
      return {
        reply,
        model: config.modelName,
        usedWebSearch: false,
      };
    } catch (chatError) {
      const primary =
        responsesError instanceof Error ? responsesError.message : 'Responses API failed.';
      const secondary = chatError instanceof Error ? chatError.message : 'Chat Completions failed.';
      throw new Error(`${primary} Fallback also failed: ${secondary}`);
    }
  }
}
