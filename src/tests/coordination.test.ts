import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createRedisCoordination, createUpstashRestCoordination } from '../handler/coordination.js';

describe('Shared coordination adapters', () => {
  describe('Redis coordination', () => {
    it('rate limits when max counter is exceeded', async () => {
      const storage = new Map<string, number>();
      const fakeClient = {
        async incr(key: string) {
          const val = (storage.get(key) ?? 0) + 1;
          storage.set(key, val);
          return val;
        },
        async pexpire(_key: string, _ms: number) {
          return 1;
        }
      };

      const { rateLimitCheck } = createRedisCoordination(fakeClient);

      // max 2 allowed
      assert.equal(await rateLimitCheck('user1', 2, 60000), false);
      assert.equal(await rateLimitCheck('user1', 2, 60000), false);
      assert.equal(await rateLimitCheck('user1', 2, 60000), true); // 3rd is blocked
    });

    it('serializes concurrent tasks using withIssueLock', async () => {
      const locks = new Map<string, string>();
      const fakeClient = {
        async set(key: string, value: string, _px: string, _ttl: number, flag: string) {
          if (flag === 'NX' && locks.has(key)) return null;
          locks.set(key, value);
          return 'OK';
        },
        async del(key: string) {
          locks.delete(key);
          return 1;
        }
      };

      const { withIssueLock } = createRedisCoordination(fakeClient);
      const executionOrder: number[] = [];

      const p1 = withIssueLock('issue-1', async () => {
        await new Promise((r) => setTimeout(r, 50));
        executionOrder.push(1);
        return 1;
      });

      const p2 = withIssueLock('issue-1', async () => {
        executionOrder.push(2);
        return 2;
      });

      const [r1, r2] = await Promise.all([p1, p2]);
      assert.equal(r1, 1);
      assert.equal(r2, 2);
      assert.deepEqual(executionOrder, [1, 2]);
    });
  });

  describe('Upstash REST coordination', () => {
    it('rate limits using REST API calls', async () => {
      let callCount = 0;
      const fakeFetch: typeof fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/INCR/')) {
          callCount++;
          return new Response(JSON.stringify({ result: callCount }), { status: 200 });
        }
        if (urlStr.includes('/PEXPIRE/')) {
          return new Response(JSON.stringify({ result: 1 }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
      }) as any;

      const { rateLimitCheck } = createUpstashRestCoordination({
        url: 'https://fake-upstash.com',
        token: 'fake-token',
        fetch: fakeFetch
      });

      assert.equal(await rateLimitCheck('ip-1', 2, 60000), false);
      assert.equal(await rateLimitCheck('ip-1', 2, 60000), false);
      assert.equal(await rateLimitCheck('ip-1', 2, 60000), true);
    });

    it('acquires and releases distributed lock via REST', async () => {
      let locked = false;
      const fakeFetch: typeof fetch = (async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/SET/')) {
          if (locked) return new Response(JSON.stringify({ result: null }), { status: 200 });
          locked = true;
          return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
        }
        if (urlStr.includes('/DEL/')) {
          locked = false;
          return new Response(JSON.stringify({ result: 1 }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
      }) as any;

      const { withIssueLock } = createUpstashRestCoordination({
        url: 'https://fake-upstash.com',
        token: 'fake-token',
        fetch: fakeFetch
      });

      let taskRan = false;
      await withIssueLock('issue-42', async () => {
        taskRan = true;
      });

      assert.ok(taskRan);
      assert.equal(locked, false);
    });
  });
});
