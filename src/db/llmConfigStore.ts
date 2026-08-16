import { getXerocodePool, xerocodeSql as sql } from './xerocodePool.ts';
import { isXerocodeSqlConfigured } from './xerocodeConfig.ts';

export type LlmProviderConfig = {
  provider: string;
  modelName: string;
  apiKey: string;
  baseUrl: string;
};

type CacheEntry = {
  expiresAt: number;
  value: LlmProviderConfig | null;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, CacheEntry>();

export async function getLlmConfig(provider: string): Promise<LlmProviderConfig | null> {
  const normalized = provider.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (!isXerocodeSqlConfigured()) {
    return null;
  }

  const cached = cache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const pool = await getXerocodePool();
  const result = await pool
    .request()
    .input('provider', sql.NVarChar(40), normalized)
    .query<{
      provider: string;
      model_name: string;
      api_key: string | null;
      base_url: string | null;
    }>(`
      SELECT TOP 1 provider, model_name, api_key, base_url
      FROM dbo.LLM_Config
      WHERE LOWER(provider) = @provider
    `);

  const row = result.recordset[0];
  if (!row) {
    cache.set(normalized, { expiresAt: Date.now() + CACHE_TTL_MS, value: null });
    return null;
  }

  const value: LlmProviderConfig = {
    provider: String(row.provider ?? normalized).trim().toLowerCase(),
    modelName: String(row.model_name ?? '').trim(),
    apiKey: String(row.api_key ?? '').trim(),
    baseUrl: String(row.base_url ?? '').trim(),
  };

  cache.set(normalized, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

export async function getOpenAiConfig(): Promise<LlmProviderConfig> {
  const config = await getLlmConfig('openai');
  if (!config?.apiKey) {
    throw new Error(
      'OpenAI is not configured in xerocode.dbo.LLM_Config. Add a row with provider=openai and a valid api_key.',
    );
  }

  return {
    ...config,
    modelName: config.modelName || 'gpt-4.1-mini',
    baseUrl: (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''),
  };
}
