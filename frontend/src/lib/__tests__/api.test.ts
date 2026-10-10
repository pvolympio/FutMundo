import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiFetch, getLatestMatch, getTeams } from '../api';

describe('FutMundo Resilient API Client (apiFetch)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('retorna dados deserializados com sucesso na primeira tentativa', async () => {
    const mockData = { match_id: 100, round: 10 };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockData,
    } as Response);

    const result = await apiFetch('/matches/latest', { match_id: 50, round: 5 }, { retries: 0 });
    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retorna fallback imediatamente em erros 404 sem gastar retentativas desnecessárias', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);

    const fallback = { match_id: 50, round: 5 };
    const result = await apiFetch('/matches/99999', fallback, { retries: 2, backoffMs: 10 });
    expect(result).toEqual(fallback);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('executa retentativas exponenciais em erros 500 antes de acionar fallback', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const fallback = { match_id: 50, round: 5 };
    const result = await apiFetch('/error-endpoint', fallback, { retries: 2, backoffMs: 10 });
    expect(result).toEqual(fallback);
    // 1 chamada inicial + 2 retries = 3 tentativas
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  it('retorna fallback quando o sinal de cancelamento (AbortSignal) já está abortado', async () => {
    const controller = new AbortController();
    controller.abort();

    globalThis.fetch = vi.fn();

    const fallback = { match_id: 50, round: 5 };
    const result = await apiFetch('/matches/latest', fallback, {
      signal: controller.signal,
      retries: 2,
    });

    expect(result).toEqual(fallback);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('retorna fallback ao estourar o timeout configurado', async () => {
    globalThis.fetch = vi.fn().mockImplementation((_url, init) => {
      return new Promise((resolve, reject) => {
        const signal = init?.signal as AbortSignal | undefined;
        const timer = setTimeout(() => {
          resolve({
            ok: true,
            status: 200,
            json: async () => ({ data: 'late' }),
          } as Response);
        }, 200);

        signal?.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new DOMException('The operation was aborted', 'AbortError'));
        });
      });
    });

    const fallback = { timeout: true };
    const result = await apiFetch('/slow-endpoint', fallback, {
      timeoutMs: 30,
      retries: 0,
    });

    expect(result).toEqual(fallback);
  });

  it('getLatestMatch e getTeams utilizam apiFetch com fallback padrão válido', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

    const latest = await getLatestMatch({ retries: 0 });
    expect(latest).toBeDefined();
    expect(latest.match_id).toBe(50);

    const teams = await getTeams({ retries: 0 });
    expect(Array.isArray(teams)).toBe(true);
    expect(teams.length).toBeGreaterThan(0);
    expect(teams[0].canonical_name).toBe('Arsenal');
  });
});
