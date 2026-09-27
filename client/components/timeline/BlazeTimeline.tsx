import React, { useState, useEffect, useRef } from 'react';
import {
  RiFilterLine,
  RiGithubLine,
  RiHistoryLine,
  RiRefreshLine,
  RiLoaderLine,
  RiArrowRightSLine,
  RiArrowDownSLine,
  RiGitCommitLine,
  RiGitPullRequestLine,
  RiBugLine,
  RiServerLine,
  RiArrowRightLine,
  RiTimeLine
} from 'react-icons/ri';
import type { TimelineEvent } from './types.js';

export interface BlazeTimelineProps {
  apiBaseUrl?: string;
  className?: string;
}

export const BlazeTimeline: React.FC<BlazeTimelineProps> = ({
  apiBaseUrl = '',
  className = ''
}) => {
  const baseUrl = apiBaseUrl.replace(/\/$/, '');
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventFilter, setEventFilter] = useState('all');
  const [appFilter, setAppFilter] = useState('all');
  const [isSyncingCommits, setIsSyncingCommits] = useState(false);
  const [isSyncingFullHistory, setIsSyncingFullHistory] = useState(false);
  const [collapsedDays, setCollapsedDays] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);

  const fetchingRef = useRef(false);

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg);
    setToastIsError(isError);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const formatDateDDMMYYYY = (val: number | string | Date | null | undefined): string => {
    if (!val) return '—';
    const time = typeof val === 'number' ? val : new Date(val).getTime();
    if (isNaN(time)) return '—';
    const d = new Date(time);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchEvents = async () => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    setEventsLoading(true);

    try {
      const params = new URLSearchParams();
      if (eventFilter !== 'all') params.append('source', eventFilter);
      params.append('limit', '100');

      // Try /api/timeline/events, fallback to /api/pulse/events if needed
      let res = await fetch(`${baseUrl}/api/timeline/events?${params.toString()}`);
      if (!res.ok) {
        res = await fetch(`${baseUrl}/api/pulse/events?${params.toString()}`);
      }
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          setEvents(data.data);
        }
      }
    } catch (err: any) {
      console.error('Failed to fetch timeline events:', err);
      showToast(err?.message || 'Failed to load timeline events', true);
    } finally {
      fetchingRef.current = false;
      setEventsLoading(false);
    }
  };

  const syncGithubCommits = async (full = false) => {
    if (full) setIsSyncingFullHistory(true);
    else setIsSyncingCommits(true);

    try {
      let url = `${baseUrl}/api/timeline/sync-github-commits${full ? '?full=true' : ''}`;
      let res = await fetch(url, { method: 'POST' });
      if (!res.ok) {
        url = `${baseUrl}/api/pulse/sync-github-commits${full ? '?full=true' : ''}`;
        res = await fetch(url, { method: 'POST' });
      }
      const data = await res.json();
      if (data.success) {
        if (full) {
          showToast(`Full sync complete! ${data.count || data.data?.length || 0} commits fetched from repository.`);
        } else {
          showToast(`Synced ${data.count || data.data?.length || 0} latest commits from repository!`);
        }
        await fetchEvents();
      } else {
        showToast(`Sync failed: ${data.error || 'Check repository access'}`, true);
      }
    } catch (err: any) {
      console.error('Failed to sync GitHub commits:', err);
      showToast(err?.message || 'Sync failed', true);
    } finally {
      setIsSyncingCommits(false);
      setIsSyncingFullHistory(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 30_000);
    return () => clearInterval(interval);
  }, [eventFilter, baseUrl]);

  const groupEventsByDay = () => {
    const groups: Record<string, TimelineEvent[]> = {};
    events.forEach((event) => {
      if (appFilter !== 'all') {
        const target = appFilter.toLowerCase();
        if (
          !event.repo?.toLowerCase().includes(target) &&
          !event.title?.toLowerCase().includes(target)
        ) {
          return;
        }
      }
      const date = formatDateDDMMYYYY(event.occurredAt);
      if (!groups[date]) groups[date] = [];
      groups[date].push(event);
    });
    return groups;
  };

  const eventGroups = groupEventsByDay();

  const isDayCollapsed = (date: string, isFirstDate = false) => {
    if (collapsedDays[date] !== undefined) return collapsedDays[date];
    if (isFirstDate) return false;
    const today = formatDateDDMMYYYY(new Date());
    return date !== today;
  };

  const toggleDayCollapse = (date: string) => {
    setCollapsedDays((prev) => ({ ...prev, [date]: !prev[date] }));
  };

  return (
    <div className={`blaze-timeline-container flex-1 flex flex-col min-h-0 bg-slate-50 overflow-y-auto p-5 md:p-7 ${className}`}>
      {/* Toast notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl shadow-lg text-xs font-bold transition-all animate-in fade-in flex items-center gap-2 ${
            toastIsError ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'
          }`}
        >
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Timeline Card */}
      <div className="max-w-5xl w-full mx-auto bg-white border border-slate-200 rounded-2xl p-5 md:p-6 shadow-2xs">
        {/* Header Title & Subtitle */}
        <div className="flex items-start justify-between flex-wrap gap-4 pb-4 mb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-2xs">
                <RiTimeLine className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight m-0">
                    BlazeTimeline
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Live Feed
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 mb-0">
                  Real-time Git commits, pull requests, and automated resolution activity for BlazeResolver.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSyncingCommits || isSyncingFullHistory}
              onClick={() => syncGithubCommits(false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 transition-all cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <RiGithubLine className="w-3.5 h-3.5" />
              <span>{isSyncingCommits ? 'Syncing...' : 'Sync Latest'}</span>
            </button>

            <button
              type="button"
              disabled={isSyncingCommits || isSyncingFullHistory}
              onClick={() => syncGithubCommits(true)}
              title="Paginate through complete repository history"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            >
              <RiHistoryLine className="w-3.5 h-3.5 text-slate-600" />
              <span>{isSyncingFullHistory ? 'Syncing All...' : 'Sync Full History'}</span>
            </button>

            <button
              type="button"
              onClick={fetchEvents}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all cursor-pointer"
            >
              <RiRefreshLine className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="flex items-center gap-2 mb-5 pb-4 border-b border-slate-200 flex-wrap">
          <RiFilterLine className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            className="border border-slate-200 rounded-lg bg-white text-slate-800 text-xs px-2.5 py-1.5 focus:outline-none focus:border-slate-400"
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
          >
            <option value="all">All Event Types</option>
            <option value="github_push">Commits (Push)</option>
            <option value="github_pr">Pull Requests</option>
            <option value="github_issue">Issues</option>
            <option value="deployment">Deployments</option>
          </select>

          <select
            className="border border-slate-200 rounded-lg bg-white text-slate-800 text-xs px-2.5 py-1.5 focus:outline-none focus:border-slate-400"
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
          >
            <option value="all">All Packages & Modules</option>
            <option value="resolver">Resolver Core</option>
            <option value="web">Web App</option>
            <option value="client">Client Support</option>
            <option value="agent">Autonomous Agents</option>
          </select>

          <div className="ml-auto text-xs font-semibold text-slate-500 font-mono">
            {events.length} total events
          </div>
        </div>

        {/* Events Timeline */}
        {eventsLoading && events.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            <RiLoaderLine className="w-7 h-7 mx-auto mb-2 animate-spin text-orange-600" />
            <span>Loading BlazeTimeline repository history...</span>
          </div>
        ) : Object.keys(eventGroups).length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-xs">
            <RiGithubLine className="w-12 h-12 mx-auto mb-3 opacity-25 text-slate-400" />
            <div className="font-bold text-slate-800 text-sm mb-1">No commits or events loaded yet</div>
            <div className="text-slate-400 mb-4">
              Click 'Sync Latest' to dynamically fetch live commits from GitHub using your configured token.
            </div>
            <button
              type="button"
              onClick={() => syncGithubCommits(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 transition-all cursor-pointer shadow-xs"
            >
              <RiGithubLine className="w-4 h-4" />
              <span>Fetch Live GitHub Commits</span>
            </button>
          </div>
        ) : (
          <div className="relative pl-2">
            {/* Timeline Vertical Axis */}
            <div className="absolute left-6 top-4 bottom-0 w-0.5 bg-slate-200" />

            {Object.entries(eventGroups).map(([date, dayEvents], idx) => {
              const collapsed = isDayCollapsed(date, idx === 0);
              const pushCount = dayEvents.filter((e) => e.source === 'github_push').length;
              const deployCount = dayEvents.filter((e) => e.source === 'deployment' || e.source === 'coolify_deploy').length;
              const prCount = dayEvents.filter((e) => e.source === 'github_pr').length;
              const issueCount = dayEvents.filter((e) => e.source === 'github_issue').length;

              return (
                <div key={date} className="mb-6">
                  <div
                    onClick={() => toggleDayCollapse(date)}
                    className="text-xs font-bold text-slate-700 mb-3 pl-9 flex items-center gap-2 cursor-pointer select-none"
                  >
                    {collapsed ? <RiArrowRightSLine className="w-4 h-4 text-slate-400" /> : <RiArrowDownSLine className="w-4 h-4 text-slate-400" />}
                    <span className="uppercase tracking-wider font-extrabold text-slate-900">{date}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                      {dayEvents.length} events
                      {pushCount > 0 ? ` (${pushCount} commits` : ''}
                      {deployCount > 0 ? `, ${deployCount} deploys` : ''}
                      {prCount > 0 ? `, ${prCount} PRs` : ''}
                      {issueCount > 0 ? `, ${issueCount} issues` : ''}
                      {pushCount > 0 || deployCount > 0 || prCount > 0 || issueCount > 0 ? ')' : ''}
                    </span>
                  </div>

                  {!collapsed && (
                    <div className="space-y-3">
                      {dayEvents.map((event) => {
                        const rawPayload = event.rawPayload;
                        const isSuccess = event.status === 'success' || event.status === 'merged';
                        const isFailed = event.status === 'failed';
                        const isOpen = event.status === 'open';

                        return (
                          <div key={event.id} className="relative pl-9">
                            {/* Circle Dot on axis */}
                            <div
                              className={`absolute left-3.5 top-4 w-3.5 h-3.5 rounded-full border-2 border-white z-10 ${
                                isSuccess
                                  ? 'bg-emerald-500'
                                  : isFailed
                                  ? 'bg-red-500'
                                  : isOpen
                                  ? 'bg-blue-500'
                                  : 'bg-slate-400'
                              }`}
                            />

                            <div
                              onClick={() => event.refUrl && window.open(event.refUrl, '_blank')}
                              className={`bg-white border border-slate-200 rounded-xl p-3.5 transition-all shadow-2xs hover:border-slate-300 hover:shadow-xs ${
                                event.refUrl ? 'cursor-pointer' : 'cursor-default'
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {rawPayload?.author?.avatar_url ? (
                                  <img
                                    src={rawPayload.author.avatar_url}
                                    alt={event.actor}
                                    className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5 border border-slate-200"
                                  />
                                ) : (
                                  <div className="text-slate-500 shrink-0 mt-0.5 p-1 rounded-md bg-slate-100">
                                    {event.source === 'github_push' && <RiGitCommitLine className="w-4 h-4 text-orange-600" />}
                                    {event.source === 'github_pr' && <RiGitPullRequestLine className="w-4 h-4 text-purple-600" />}
                                    {event.source === 'github_issue' && <RiBugLine className="w-4 h-4 text-red-600" />}
                                    {(event.source === 'deployment' || event.source === 'coolify_deploy') && (
                                      <RiServerLine className="w-4 h-4 text-blue-600" />
                                    )}
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className="text-xs font-bold text-slate-900 leading-snug">
                                    {event.title}
                                  </div>

                                  {rawPayload?.commit?.message &&
                                    rawPayload.commit.message
                                      .split('\n')
                                      .slice(1)
                                      .join('\n')
                                      .trim() && (
                                      <div className="text-[11px] text-slate-600 my-1.5 whitespace-pre-wrap bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200 font-mono">
                                        {rawPayload.commit.message
                                          .split('\n')
                                          .slice(1)
                                          .join('\n')
                                          .trim()}
                                      </div>
                                    )}

                                  <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span className="font-bold text-slate-800">{event.actor}</span>
                                    <span>•</span>
                                    <span>
                                      {formatDateDDMMYYYY(event.occurredAt)}{' '}
                                      {new Date(event.occurredAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>

                                    {event.repo && (
                                      <>
                                        <span>•</span>
                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                                          {event.repo}
                                        </span>
                                      </>
                                    )}

                                    {event.sha && (
                                      <>
                                        <span>•</span>
                                        <code className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold border border-slate-200">
                                          #{event.sha}
                                        </code>
                                      </>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {rawPayload?.stats && (
                                    <div className="flex items-center gap-1.5 text-[11px] font-mono font-bold">
                                      {rawPayload.stats.additions > 0 && (
                                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                          +{rawPayload.stats.additions}
                                        </span>
                                      )}
                                      {rawPayload.stats.deletions > 0 && (
                                        <span className="text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">
                                          -{rawPayload.stats.deletions}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {event.refUrl && (
                                    <RiArrowRightLine className="w-4 h-4 text-slate-400 hover:text-slate-900 transition-colors" />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const ActivityTimeline = BlazeTimeline;
