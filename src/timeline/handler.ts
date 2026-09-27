import { fetchTimelineEvents, type TimelineEvent } from './index.js';

export interface TimelineHandlerOptions {
  allowOrigin?: string;
  repo?: string;
  githubToken?: string;
}

export function createTimelineHandler(options: TimelineHandlerOptions = {}): (req: Request) => Promise<Response> {
  const allowOrigin = options.allowOrigin || '*';
  const corsHeaders: Record<string, string> = {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization'
  };

  const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json', ...corsHeaders }
    });

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      const url = new URL(req.url);
      const pathname = url.pathname.replace(/\/$/, '');
      const searchParams = url.searchParams;

      // Extract path segments after /api/timeline or /api/pulse
      const match = pathname.match(/\/api\/(?:admin\/)?(?:timeline|pulse)(?:\/(.*))?$/);
      const subPath = match && match[1] ? match[1] : '';
      const segments = subPath ? subPath.split('/') : [];
      const method = req.method.toUpperCase();

      // 1. GET /api/timeline/events or /api/timeline
      if ((segments.length === 0 || (segments.length === 1 && segments[0] === 'events')) && method === 'GET') {
        const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100;
        const source = searchParams.get('source') || undefined;

        let events = await fetchTimelineEvents(limit, false, false);
        if (source && source !== 'all') {
          events = events.filter((e) => e.source === source);
        }
        return json(200, { success: true, data: events });
      }

      // 2. POST /api/timeline/sync-github-commits
      if (segments.length === 1 && segments[0] === 'sync-github-commits' && method === 'POST') {
        const full = searchParams.get('full') === 'true' || searchParams.get('full') === '1';
        const events = await fetchTimelineEvents(full ? 100 : 50, true, full);
        return json(200, { success: true, count: events.length, data: events });
      }

      return json(404, { success: false, error: `Timeline route not found: ${method} ${pathname}` });
    } catch (err: unknown) {
      return json(500, { success: false, error: err instanceof Error ? err.message : String(err) });
    }
  };
}
