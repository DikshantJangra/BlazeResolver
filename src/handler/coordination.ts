/**
 * Shared coordination adapters for BlazeResolver multi-instance and serverless deployments.
 * Provides distributed rate limiting and atomic issue deduplication locks backed by
 * Redis or Upstash REST.
 */

export interface RedisLikeClient {
  get?(key: string): Promise<string | null>;
  set?(key: string, value: string, ...args: any[]): Promise<any>;
  del?(...keys: string[]): Promise<number>;
  incr?(key: string): Promise<number>;
  pexpire?(key: string, ms: number): Promise<number>;
  eval?(script: string, numkeys: number, ...args: (string | number)[]): Promise<any>;
}

export interface SharedCoordinationOptions {
  prefix?: string;
  lockTimeoutMs?: number;
  lockRetryIntervalMs?: number;
  lockMaxWaitMs?: number;
}

export interface SharedCoordination {
  rateLimitCheck: (id: string, max: number, windowMs: number) => Promise<boolean>;
  withIssueLock: <T>(key: string, run: () => Promise<T>) => Promise<T>;
}

/**
 * Creates coordination callbacks backed by any Redis-compatible client (ioredis, redis, etc.).
 */
export function createRedisCoordination(
  client: RedisLikeClient,
  opts: SharedCoordinationOptions = {}
): SharedCoordination {
  const prefix = opts.prefix ?? 'blazeresolver:';
  const lockTimeoutMs = opts.lockTimeoutMs ?? 60_000;
  const lockRetryIntervalMs = opts.lockRetryIntervalMs ?? 200;
  const lockMaxWaitMs = opts.lockMaxWaitMs ?? 15_000;

  const rateLimitCheck = async (id: string, max: number, windowMs: number): Promise<boolean> => {
    const key = `${prefix}ratelimit:${id}`;
    if (typeof client.eval === 'function') {
      // Atomic increment + expire via Lua
      const lua = `
        local current = redis.call('INCR', KEYS[1])
        if current == 1 then
          redis.call('PEXPIRE', KEYS[1], ARGV[1])
        end
        return current
      `;
      const current = Number(await client.eval(lua, 1, key, windowMs));
      return current > max;
    }

    if (typeof client.incr === 'function') {
      const count = await client.incr(key);
      if (count === 1 && typeof client.pexpire === 'function') {
        await client.pexpire(key, windowMs);
      }
      return count > max;
    }

    return false;
  };

  const withIssueLock = async <T>(key: string, run: () => Promise<T>): Promise<T> => {
    const lockKey = `${prefix}lock:${key}`;
    const token = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const start = Date.now();

    // Acquire lock with retry
    while (true) {
      let acquired = false;
      if (typeof client.set === 'function') {
        const res = await client.set(lockKey, token, 'PX', lockTimeoutMs, 'NX');
        acquired = res === 'OK' || res === true || res === 1;
      }

      if (acquired) break;
      if (Date.now() - start > lockMaxWaitMs) {
        throw new Error(`Timeout waiting for issue lock on ${key} after ${lockMaxWaitMs}ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, lockRetryIntervalMs));
    }

    try {
      return await run();
    } finally {
      // Release lock safely if token matches
      if (typeof client.eval === 'function') {
        const unlockLua = `
          if redis.call('GET', KEYS[1]) == ARGV[1] then
            return redis.call('DEL', KEYS[1])
          else
            return 0
          end
        `;
        try {
          await client.eval(unlockLua, 1, lockKey, token);
        } catch {}
      } else if (typeof client.del === 'function') {
        try {
          await client.del(lockKey);
        } catch {}
      }
    }
  };

  return { rateLimitCheck, withIssueLock };
}

/**
 * Creates coordination callbacks backed by Upstash Redis REST API (zero npm dependencies, works in Edge/Serverless).
 */
export function createUpstashRestCoordination(options: {
  url: string;
  token: string;
  prefix?: string;
  fetch?: typeof fetch;
}): SharedCoordination {
  const { url, token, prefix = 'blazeresolver:', fetch: customFetch = fetch } = options;
  const baseUrl = url.replace(/\/+$/, '');

  const upstashCommand = async (command: string, ...args: (string | number)[]): Promise<any> => {
    const res = await customFetch(`${baseUrl}/${command}/${args.map(encodeURIComponent).join('/')}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    if (!res.ok) {
      throw new Error(`Upstash REST API error: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json()) as { result: any };
    return json.result;
  };

  const rateLimitCheck = async (id: string, max: number, windowMs: number): Promise<boolean> => {
    const key = `${prefix}ratelimit:${id}`;
    try {
      const count = await upstashCommand('INCR', key);
      if (count === 1) {
        await upstashCommand('PEXPIRE', key, windowMs);
      }
      return Number(count) > max;
    } catch (err) {
      console.warn('[blazeresolver] Upstash rate limit error, falling back to allow:', err);
      return false;
    }
  };

  const withIssueLock = async <T>(key: string, run: () => Promise<T>): Promise<T> => {
    const lockKey = `${prefix}lock:${key}`;
    const lockVal = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const start = Date.now();
    const maxWaitMs = 15_000;
    const retryIntervalMs = 250;

    while (true) {
      try {
        const res = await upstashCommand('SET', lockKey, lockVal, 'PX', 60_000, 'NX');
        if (res === 'OK' || res === true || res === 1) {
          break;
        }
      } catch {}

      if (Date.now() - start > maxWaitMs) {
        throw new Error(`Timeout acquiring Upstash lock on ${key}`);
      }
      await new Promise((resolve) => setTimeout(resolve, retryIntervalMs));
    }

    try {
      return await run();
    } finally {
      try {
        await upstashCommand('DEL', lockKey);
      } catch {}
    }
  };

  return { rateLimitCheck, withIssueLock };
}
