export interface TokenHealthStatus {
  valid: boolean;
  status: number;
  configured: boolean;
  expiresAt?: string;
  daysUntilExpiration?: number;
  rateLimitRemaining?: number;
  rateLimitReset?: number;
  scopes?: string[];
  warning?: string;
  error?: string;
}

/**
 * Proactively checks GitHub token validity, fine-grained expiration header,
 * and API rate limits.
 */
export async function checkTokenHealth(
  token: string | undefined,
  repo?: string,
  f: typeof fetch = fetch
): Promise<TokenHealthStatus> {
  if (!token) {
    return {
      valid: false,
      status: 0,
      configured: false,
      error: 'BLAZE_GITHUB_TOKEN is not configured'
    };
  }

  const url = repo ? `https://api.github.com/repos/${repo}` : 'https://api.github.com/user';

  try {
    const res = await f(url, {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'user-agent': 'blazeresolver'
      },
      signal: AbortSignal.timeout(10_000)
    });

    const status = res.status;
    const expiresHeader = res.headers.get('github-authentication-token-expiration');
    const rateLimitRemHeader = res.headers.get('x-ratelimit-remaining');
    const rateLimitResetHeader = res.headers.get('x-ratelimit-reset');
    const scopesHeader = res.headers.get('x-oauth-scopes');

    const rateLimitRemaining = rateLimitRemHeader !== null ? parseInt(rateLimitRemHeader, 10) : undefined;
    const rateLimitReset = rateLimitResetHeader !== null ? parseInt(rateLimitResetHeader, 10) : undefined;
    const scopes = scopesHeader ? scopesHeader.split(',').map((s) => s.trim()) : undefined;

    let daysUntilExpiration: number | undefined = undefined;
    let warning: string | undefined = undefined;

    if (expiresHeader) {
      const expDate = new Date(expiresHeader);
      if (!isNaN(expDate.getTime())) {
        const msDiff = expDate.getTime() - Date.now();
        daysUntilExpiration = Math.max(0, Math.ceil(msDiff / (1000 * 60 * 60 * 24)));
        if (daysUntilExpiration <= 7) {
          warning = `BLAZE_GITHUB_TOKEN will expire in ${daysUntilExpiration} day(s) on ${expiresHeader}. Please rotate token promptly.`;
        }
      }
    }

    if (rateLimitRemaining !== undefined && rateLimitRemaining < 10) {
      warning = (warning ? `${warning}; ` : '') + `GitHub rate limit critically low (${rateLimitRemaining} remaining).`;
    }

    if (status === 401) {
      return {
        valid: false,
        status,
        configured: true,
        error: 'BLAZE_GITHUB_TOKEN is expired or invalid (HTTP 401 Unauthorized)'
      };
    }

    if (status === 403 || status === 404) {
      // 404 on private repo when token lacks permission, or 403 permission/rate limit
      const body = await res.text().catch(() => '');
      return {
        valid: false,
        status,
        configured: true,
        expiresAt: expiresHeader ?? undefined,
        daysUntilExpiration,
        rateLimitRemaining,
        rateLimitReset,
        scopes,
        error: `GitHub returned ${status} for ${url}: ${body.slice(0, 150) || 'Check repository access permissions'}`
      };
    }

    return {
      valid: res.ok,
      status,
      configured: true,
      expiresAt: expiresHeader ?? undefined,
      daysUntilExpiration,
      rateLimitRemaining,
      rateLimitReset,
      scopes,
      warning
    };
  } catch (err: unknown) {
    return {
      valid: false,
      status: 0,
      configured: true,
      error: `Could not connect to GitHub API: ${err instanceof Error ? err.message : String(err)}`
    };
  }
}
