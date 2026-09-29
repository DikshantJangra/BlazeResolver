import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkTokenHealth } from '../github/token-health.js';

describe('GitHub token health checks', () => {
  it('reports unconfigured when token is missing', async () => {
    const status = await checkTokenHealth(undefined);
    assert.equal(status.configured, false);
    assert.equal(status.valid, false);
    assert.match(status.error || '', /not configured/);
  });

  it('detects HTTP 401 unauthorized / expired tokens', async () => {
    const fakeFetch: typeof fetch = (async () => {
      return new Response(JSON.stringify({ message: 'Bad credentials' }), { status: 401 });
    }) as any;

    const status = await checkTokenHealth('ghp_expiredToken', 'acme/repo', fakeFetch);
    assert.equal(status.configured, true);
    assert.equal(status.valid, false);
    assert.equal(status.status, 401);
    assert.match(status.error || '', /expired or invalid/);
  });

  it('detects fine-grained PAT expiration header and warns when expiring soon', async () => {
    const nextWeek = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const fakeFetch: typeof fetch = (async () => {
      const headers = new Headers();
      headers.set('github-authentication-token-expiration', nextWeek);
      headers.set('x-ratelimit-remaining', '4950');
      return new Response(JSON.stringify({ name: 'repo' }), { status: 200, headers });
    }) as any;

    const status = await checkTokenHealth('ghp_validToken', 'acme/repo', fakeFetch);
    assert.equal(status.valid, true);
    assert.equal(status.status, 200);
    assert.equal(status.rateLimitRemaining, 4950);
    assert.equal(status.daysUntilExpiration, 3);
    assert.ok(status.warning && status.warning.includes('will expire in 3 day(s)'));
  });

  it('reports healthy when token is valid and not expiring soon', async () => {
    const nextMonth = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString();
    const fakeFetch: typeof fetch = (async () => {
      const headers = new Headers();
      headers.set('github-authentication-token-expiration', nextMonth);
      headers.set('x-ratelimit-remaining', '5000');
      return new Response(JSON.stringify({ name: 'repo' }), { status: 200, headers });
    }) as any;

    const status = await checkTokenHealth('ghp_validToken', 'acme/repo', fakeFetch);
    assert.equal(status.valid, true);
    assert.equal(status.status, 200);
    assert.equal(status.rateLimitRemaining, 5000);
    assert.equal(status.warning, undefined);
  });
});
