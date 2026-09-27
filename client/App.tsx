import React, { useState, useEffect, useRef } from 'react';
import {
  FiActivity,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiCpu,
  FiDollarSign,
  FiLayers,
  FiMic,
  FiMicOff,
  FiPlay,
  FiRefreshCw,
  FiSend,
  FiShield,
  FiUserCheck,
  FiZap,
  FiChevronRight,
  FiDatabase,
  FiLock,
  FiInbox,
  FiTrendingUp
} from 'react-icons/fi';
import { TbGitFork, TbArrowsExchange } from 'react-icons/tb';
import { RiCustomerService2Line, RiCpuLine } from 'react-icons/ri';
import { VoiceAgentConsole } from './components/VoiceAgentConsole.js';
import { AdminSupportDesk } from './components/support/AdminSupportDesk.js';

interface PipelineResult {
  complaintId: string;
  input: {
    id: string;
    channel: string;
    rawText: string;
    orderId?: string;
    customerId?: string;
    resourceId?: string;
    timestamp: string;
  };
  triage: {
    id: string;
    intent: string;
    category: string;
    severity: string;
    sentiment: string;
    itemName?: string;
    resourceId?: string;
    orderId?: string;
    claimedAmount?: number;
    urgencyScore: number;
    isPromptInjection: boolean;
    guardrailPassed: boolean;
    incidentLinked: boolean;
  };
  correlation: {
    isSystemic: boolean;
    cluster?: {
      clusterKey: string;
      resourceId: string;
      category: string;
      itemName?: string;
      count: number;
      signal?: SignalSummary;
      isAnomalous: boolean;
      rootCauseHypothesis?: string;
    };
    incident?: {
      incidentId: string;
      title: string;
      summary: string;
      resourceId: string;
      category: string;
      complaintCount: number;
      signal?: SignalSummary;
      managerNotified: boolean;
      itemDisabled: boolean;
      recommendedAction: string;
    };
  };
  resolution: {
    policyDecision: {
      allowed: boolean;
      rationale: string;
      recommendedAction: string;
      suggestedAmount?: number;
      requiresHitl: boolean;
    };
    actions: Array<{
      id: string;
      actionType: string;
      idempotencyKey: string;
      amount?: number;
      orderId?: string;
      reason: string;
      approvalStatus: string;
      executionResult?: any;
    }>;
    hitlRequired: boolean;
  };
  response: {
    text: string;
    channel: string;
    tone: string;
    containsRefundConfirmation: boolean;
    qualityPassed: boolean;
  };
  executionDurationMs: number;
  timestamp: string;
}

interface SignalSummary {
  metric: string;
  label: string;
  unit: string;
  average: number;
  baseline: number;
  ratio: number;
}

interface CorrelatedIncident {
  incidentId: string;
  title: string;
  summary: string;
  resourceId: string;
  category: string;
  itemName?: string;
  complaintCount: number;
  signal?: SignalSummary;
  status: string;
  recommendedAction: string;
  managerNotified: boolean;
  itemDisabled: boolean;
  createdAt: string;
}

/** Subset of the server's DomainProfile served by GET /api/profile. */
export interface ProfileInfo {
  id: string;
  name: string;
  labels: { business: string; item: string; resource: string };
  currency: { code: string; symbol: string };
  moneyPolicy: { autoApproveThreshold: number; maxCreditAmount: number };
  categories: Array<{ id: string; label: string }>;
  items: Array<{ id: string; name: string }>;
  resources: Array<{ id: string; name: string }>;
  demo: {
    defaultCustomerId: string;
    sampleOrders: Array<{ id: string; label: string }>;
    samplePrompts: Array<{ label: string; text: string; tone?: 'warning' | 'danger' }>;
    complaintPlaceholder: string;
  };
}

interface HitlAction {
  id: string;
  complaintId: string;
  actionType: string;
  idempotencyKey: string;
  amount?: number;
  orderId?: string;
  customerId?: string;
  reason: string;
  approvalStatus: string;
  createdAt: string;
}

export default function App() {
  const [feed, setFeed] = useState<PipelineResult[]>([]);
  const [incidents, setIncidents] = useState<CorrelatedIncident[]>([]);
  const [hitlQueue, setHitlQueue] = useState<HitlAction[]>([]);
  const [adaptersData, setAdaptersData] = useState<any>(null);
  const [primaryMode, setPrimaryMode] = useState<'support' | 'engine'>('support');
  const [activeTab, setActiveTab] = useState<'feed' | 'incidents' | 'hitl' | 'adapters' | 'byo' | 'voice'>('voice');
  const [adapterSubTab, setAdapterSubTab] = useState<'orderSource' | 'refundGateway' | 'ticketSink' | 'availabilityControl'>('orderSource');
  const [profile, setProfile] = useState<ProfileInfo | null>(null);

  const [inputText, setInputText] = useState('');
  const [inputOrderId, setInputOrderId] = useState('');
  const [inputResource, setInputResource] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);

  // Fetch state on mount & set up WebSocket
  useEffect(() => {
    fetchState();
    fetchProfile();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pipeline_result') {
            setFeed((prev) => [msg.data, ...prev]);
            fetchState();
          } else if (msg.type === 'hitl_updated' || msg.type === 'pipeline_reset') {
            fetchState();
          }
        } catch (e) {
          console.error('WS parse error:', e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
      };
    } catch (err) {
      console.warn('WS connection skipped:', err);
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const fetchState = async () => {
    try {
      const [feedRes, incRes, hitlRes, adaptRes] = await Promise.all([
        fetch('/api/pipeline/feed').then((r) => r.json()),
        fetch('/api/correlate/incidents').then((r) => r.json()),
        fetch('/api/hitl/queue').then((r) => r.json()),
        fetch('/api/adapters/overview').then((r) => r.json()),
      ]);

      if (feedRes.results) setFeed(feedRes.results);
      if (incRes.incidents) setIncidents(incRes.incidents);
      if (hitlRes.queue) setHitlQueue(hitlRes.queue);
      if (adaptRes) setAdaptersData(adaptRes);
    } catch (err) {
      console.error('Error fetching dashboard state:', err);
    }
  };

  const fetchProfile = async () => {
    try {
      const data: ProfileInfo = await fetch('/api/profile').then((r) => r.json());
      setProfile(data);
      setInputOrderId(data.demo.sampleOrders[0]?.id ?? '');
      setInputResource(data.resources[0]?.id ?? '');
    } catch (err) {
      console.error('Error fetching domain profile:', err);
    }
  };

  const money = (amount: number | undefined) => `${profile?.currency.symbol ?? ''}${amount ?? 0}`;
  const resourceName = (id: string) => profile?.resources.find((r) => r.id === id)?.name ?? id;
  const itemLabel = profile?.labels.item ?? 'Item';
  const resourceLabel = profile?.labels.resource ?? 'Location';
  const approvalThreshold = profile?.moneyPolicy.autoApproveThreshold ?? 0;

  const handleRunSeedDemo = async () => {
    setIsSeeding(true);
    try {
      const res = await fetch('/api/pipeline/seed', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchState();
      }
    } catch (err) {
      console.error('Error running seed demo:', err);
    } finally {
      setIsSeeding(false);
    }
  };

  const handleResetState = async () => {
    try {
      await fetch('/api/pipeline/reset', { method: 'POST' });
      setFeed([]);
      setIncidents([]);
      setHitlQueue([]);
      await fetchState();
    } catch (err) {
      console.error('Error resetting state:', err);
    }
  };

  const handleSendComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/pipeline/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: inputText,
          orderId: inputOrderId || undefined,
          resourceId: inputResource || undefined,
          channel: 'text',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setInputText('');
        await fetchState();
      }
    } catch (err) {
      console.error('Error processing complaint:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleHitlDecision = async (actionId: string, decision: 'approve' | 'reject') => {
    try {
      await fetch('/api/hitl/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId, decision }),
      });
      await fetchState();
    } catch (err) {
      console.error('Error updating HITL decision:', err);
    }
  };

  const handleSimulateVoice = () => {
    setActiveTab('voice');
  };

  // Metrics
  const totalCount = feed.length;
  const autoResolvedCount = feed.filter(
    (f) => f.resolution.actions[0]?.approvalStatus === 'executed' && !f.triage.isPromptInjection
  ).length;
  const autoResolvedRate = totalCount > 0 ? Math.round((autoResolvedCount / totalCount) * 100) : 0;
  const hitlPendingCount = hitlQueue.length;
  const attacksBlockedCount = feed.filter((f) => f.triage.isPromptInjection).length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b border-slate-800/80 bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-40 px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img
            src="/blazyy.png"
            alt="Blazyy"
            className="h-9 w-9 rounded-xl object-cover border border-orange-500/30 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-base tracking-tight text-white">BlazeResolver</h1>
              <span className="text-[10.5px] font-mono font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                v1.0 • AI Support Engine{profile ? ` • ${profile.name}` : ''}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Full End-to-End Customer Support, AI Triage & Self-Healing Pipeline
            </p>
          </div>
        </div>

        {/* Primary Workspace Navigation Switcher */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setPrimaryMode('support')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              primaryMode === 'support'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RiCustomerService2Line className="w-4 h-4 text-orange-200" />
            <span>Support Desk & Portal</span>
          </button>
          <button
            type="button"
            onClick={() => setPrimaryMode('engine')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
              primaryMode === 'engine'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <RiCpuLine className="w-4 h-4 text-orange-200" />
            <span>Engine Pipeline & Voice</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-1">
            <span
              className={`h-2 w-2 rounded-full ${
                wsConnected ? 'bg-emerald-500 badge-pulse' : 'bg-amber-500'
              }`}
            ></span>
            <span className="text-[10.5px] font-mono text-slate-400 hidden md:inline">
              {wsConnected ? 'Socket Live' : 'Connecting...'}
            </span>
          </div>

          <button
            onClick={handleRunSeedDemo}
            disabled={isSeeding}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-all disabled:opacity-50 border border-orange-400/30"
          >
            <FiPlay className={isSeeding ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">{isSeeding ? 'Running...' : 'Run Seed Claims'}</span>
          </button>

          <button
            onClick={handleResetState}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-all border border-slate-700"
            title="Reset pipeline and stores"
          >
            <FiRefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {primaryMode === 'support' ? (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <AdminSupportDesk />
        </div>
      ) : (
        <>
          {/* Metrics Row */}
          <section className="px-6 py-4 grid grid-cols-2 md:grid-cols-5 gap-3.5 bg-[#0b101b] border-b border-slate-800/60">
        <div className="glass-card p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <FiInbox className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Ingested Complaints</div>
            <div className="text-xl font-bold text-white font-mono">{totalCount}</div>
          </div>
        </div>

        <div className="glass-card p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <FiActivity className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Systemic Incidents</div>
            <div className="text-xl font-bold text-purple-400 font-mono">{incidents.length}</div>
          </div>
        </div>

        <div className="glass-card p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <FiCheckCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Auto-Resolved Rate</div>
            <div className="text-xl font-bold text-emerald-400 font-mono">{autoResolvedRate}%</div>
          </div>
        </div>

        <div className="glass-card p-3.5 rounded-xl flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <FiUserCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Money Gate (HITL Queue)</div>
            <div className="text-xl font-bold text-amber-400 font-mono">{hitlPendingCount}</div>
          </div>
        </div>

        <div className="glass-card p-3.5 rounded-xl flex items-center gap-3 col-span-2 md:col-span-1">
          <div className="p-2.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
            <FiShield className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Attacks Blocked</div>
            <div className="text-xl font-bold text-red-400 font-mono">{attacksBlockedCount}</div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="flex-1 px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] w-full mx-auto">
        {/* Left Column (7 cols): Live Feed & Interactive Input */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          {/* Custom Input Bar */}
          <div className="glass-panel p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FiSend className="text-orange-400" /> Test Customer Complaint Input
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={inputResource}
                  onChange={(e) => setInputResource(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-[11px] rounded-lg px-2 py-1 text-slate-300 focus:outline-none focus:border-orange-500"
                >
                  <option value="">Any {resourceLabel.toLowerCase()}</option>
                  {profile?.resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder={`Order ID${profile?.demo.sampleOrders[0] ? ` (e.g. ${profile.demo.sampleOrders[0].id})` : ''}`}
                  value={inputOrderId}
                  onChange={(e) => setInputOrderId(e.target.value)}
                  className="bg-slate-900 border border-slate-700 text-[11px] rounded-lg px-2 py-1 text-slate-300 w-28 focus:outline-none focus:border-orange-500 font-mono"
                />
              </div>
            </div>

            <form onSubmit={handleSendComplaint} className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={profile?.demo.complaintPlaceholder ?? 'Describe a customer complaint...'}
                className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
              />
              <button
                type="submit"
                disabled={isLoading || !inputText.trim()}
                className="px-4 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {isLoading ? <FiRefreshCw className="animate-spin" /> : <FiSend />}
                <span>Process</span>
              </button>
            </form>
          </div>

          {/* Feed Tabs Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <FiZap className="text-amber-400" /> Real-Time Pipeline Execution Feed
              </h2>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                {feed.length} events
              </span>
            </div>
          </div>

          {/* Feed List */}
          <div className="space-y-3.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
            {feed.length === 0 ? (
              <div className="glass-card p-10 rounded-2xl text-center flex flex-col items-center justify-center">
                <div className="p-4 rounded-2xl bg-orange-500/10 text-orange-400 mb-3 border border-orange-500/20">
                  <FiPlay className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-200">No Complaints Ingested Yet</h3>
                <p className="text-xs text-slate-400 max-w-sm mt-1 mb-4">
                  Click "Run Demo Script" above to benchmark the entire harness with the example's real-world customer complaints!
                </p>
                <button
                  onClick={handleRunSeedDemo}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-semibold transition-all"
                >
                  Run Complaint Benchmark
                </button>
              </div>
            ) : (
              feed.map((item) => (
                <div
                  key={item.complaintId}
                  className={`glass-panel p-4 rounded-2xl border transition-all ${
                    item.correlation.isSystemic
                      ? 'border-purple-500/40 bg-purple-950/10'
                      : item.triage.isPromptInjection
                      ? 'border-red-500/40 bg-red-950/10'
                      : item.resolution.hitlRequired
                      ? 'border-amber-500/40 bg-amber-950/10'
                      : 'border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  {/* Top line: Channel, Order, Timestamp */}
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md ${
                          item.input.channel === 'voice'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {item.input.channel === 'voice' ? '🎙️ VOICE' : '💬 TEXT'}
                      </span>

                      {item.triage.orderId && (
                        <span className="font-mono text-[11px] text-slate-300 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                          {item.triage.orderId}
                        </span>
                      )}

                      {item.triage.resourceId && (
                        <span className="text-[11px] text-slate-400">{resourceName(item.triage.resourceId)}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-slate-500">
                        {item.executionDurationMs}ms latency
                      </span>
                    </div>
                  </div>

                  {/* Customer raw quote */}
                  <p className="text-xs text-slate-200 mb-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-900 italic">
                    "{item.input.rawText}"
                  </p>

                  {/* 4 Pipeline Stages Execution Breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-[11px]">
                    {/* 1. TRIAGE */}
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                      <div className="text-[10px] uppercase font-bold text-sky-400 mb-1 flex items-center justify-between">
                        <span>1. Triage</span>
                        <span className="text-slate-500 font-mono">{Math.round(item.triage.urgencyScore * 100)}%</span>
                      </div>
                      <div className="font-semibold text-slate-200 truncate">
                        {profile?.categories.find((c) => c.id === item.triage.category)?.label ?? item.triage.category.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {item.triage.itemName || item.triage.intent}
                      </div>
                    </div>

                    {/* 2. CORRELATE (The Differentiator) */}
                    <div
                      className={`p-2 rounded-lg border ${
                        item.correlation.isSystemic
                          ? 'bg-purple-900/30 border-purple-500/40 text-purple-200'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold mb-1 flex items-center justify-between">
                        <span className={item.correlation.isSystemic ? 'text-purple-300' : 'text-slate-400'}>
                          2. Correlate
                        </span>
                        {item.correlation.isSystemic && <span className="animate-pulse">🚨</span>}
                      </div>
                      {item.correlation.isSystemic ? (
                        <div>
                          <div className="font-bold text-purple-300">Systemic Incident</div>
                          {item.correlation.incident?.signal && (
                            <div className="text-[10px] text-purple-400 font-mono">
                              {item.correlation.incident.signal.average}
                              {item.correlation.incident.signal.unit} vs {item.correlation.incident.signal.baseline}
                              {item.correlation.incident.signal.unit} base
                            </div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div className="text-slate-300">Isolated Case</div>
                          <div className="text-[10px] text-slate-500">1-off complaint</div>
                        </div>
                      )}
                    </div>

                    {/* 3. RESOLVE */}
                    <div
                      className={`p-2 rounded-lg border ${
                        item.triage.isPromptInjection
                          ? 'bg-red-950/30 border-red-500/40'
                          : item.resolution.hitlRequired
                          ? 'bg-amber-950/30 border-amber-500/40'
                          : 'bg-emerald-950/30 border-emerald-500/40'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold mb-1 flex items-center justify-between">
                        <span
                          className={
                            item.triage.isPromptInjection
                              ? 'text-red-400'
                              : item.resolution.hitlRequired
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }
                        >
                          3. Resolve
                        </span>
                      </div>
                      {item.triage.isPromptInjection ? (
                        <div className="text-red-300 font-bold">Attack Defended</div>
                      ) : item.resolution.hitlRequired ? (
                        <div>
                          <div className="text-amber-300 font-bold">HITL Gated</div>
                          <div className="text-[10px] text-amber-400">Claim &gt; {money(approvalThreshold)}</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-emerald-300 font-bold truncate">
                            {item.resolution.actions[0]?.actionType.toUpperCase() || 'SAFE'} (
                            {money(item.resolution.actions[0]?.amount)})
                          </div>
                          <div className="text-[9px] text-emerald-400/80 font-mono truncate">
                            Idem: {item.resolution.actions[0]?.idempotencyKey.substring(0, 14)}...
                          </div>
                        </div>
                      )}
                    </div>

                    {/* 4. RESPOND */}
                    <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-amber-400 mb-1 flex items-center justify-between">
                          <span>4. Respond</span>
                          <span className="text-[9px] text-emerald-400">✓ Quality Pass</span>
                        </div>
                        <div className="text-[10px] text-slate-300 line-clamp-2">
                          "{item.response.text}"
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Right Column (5 cols): Correlate Incident Center, HITL Queue, & 4-Adapter Explorer */}
        <section className="lg:col-span-5 flex flex-col gap-5">
          {/* Sub-Tabs: Incidents / HITL / Adapters / BYO Agent / Live Voice */}
          <div className="flex bg-slate-900/90 p-1 rounded-xl border border-slate-800 text-xs font-medium overflow-x-auto">
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex-1 min-w-[120px] py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'voice'
                  ? 'bg-orange-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FiMic className="text-orange-300" /> Voice Agent
            </button>
            <button
              onClick={() => setActiveTab('incidents')}
              className={`flex-1 min-w-[100px] py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'incidents'
                  ? 'bg-purple-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FiActivity /> Incidents ({incidents.length})
            </button>
            <button
              onClick={() => setActiveTab('hitl')}
              className={`flex-1 min-w-[100px] py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'hitl'
                  ? 'bg-amber-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FiUserCheck /> HITL ({hitlQueue.length})
            </button>
            <button
              onClick={() => setActiveTab('adapters')}
              className={`flex-1 min-w-[80px] py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'adapters'
                  ? 'bg-slate-700 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TbGitFork /> Adapters
            </button>
            <button
              onClick={() => setActiveTab('byo')}
              className={`flex-1 min-w-[90px] py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'byo'
                  ? 'bg-cyan-600 text-white font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <FiCpu /> BYO
            </button>
          </div>

          {/* TAB 0: Live Voice Agent Console */}
          {activeTab === 'voice' && (
            <div className="h-[640px]">
              <VoiceAgentConsole
                profile={profile}
                onIncidentDetected={fetchState}
                onHitlUpdated={fetchState}
              />
            </div>
          )}

          {/* TAB 1: Correlate Incident Hub (The Star Feature) */}
          {activeTab === 'incidents' && (
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FiActivity className="text-purple-400" /> Correlate Operational Intelligence
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cross-referencing customer complaints with live operational signals
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 text-xs font-mono font-bold border border-purple-500/30">
                  {incidents.length} Active
                </span>
              </div>

              {incidents.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                  <FiCheckCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No operational bottlenecks detected in the buffer window.</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Feed 3+ similar complaints from the same {resourceLabel.toLowerCase()} to trigger anomaly detection.
                  </p>
                </div>
              ) : (
                incidents.map((inc) => (
                  <div
                    key={inc.incidentId}
                    className="p-4 rounded-xl bg-gradient-to-br from-purple-950/40 to-slate-900/80 border border-purple-500/50 shadow-sm flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">
                          SYSTEMIC INCIDENT • {resourceName(inc.resourceId).toUpperCase()}
                        </div>
                        <h4 className="text-sm font-bold text-white mt-0.5">{inc.title}</h4>
                      </div>
                      {inc.signal && (
                        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/30">
                          {inc.signal.ratio}x {inc.signal.label}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-300">{inc.summary}</p>

                    {/* Operational Signal Telemetry */}
                    <div className="grid grid-cols-3 gap-2 bg-purple-950/30 p-2.5 rounded-lg border border-purple-900/40 font-mono text-center">
                      <div>
                        <div className="text-[10px] text-slate-400">Clustered Tickets</div>
                        <div className="text-base font-bold text-white">{inc.complaintCount}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">{inc.signal ? `Avg ${inc.signal.label}` : 'Signal'}</div>
                        <div className="text-base font-bold text-red-400">
                          {inc.signal ? `${inc.signal.average}${inc.signal.unit}` : 'n/a'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">{resourceLabel} Baseline</div>
                        <div className="text-base font-bold text-emerald-400">
                          {inc.signal ? `${inc.signal.baseline}${inc.signal.unit}` : 'n/a'}
                        </div>
                      </div>
                    </div>

                    {/* Root Cause & Actions Taken */}
                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="text-emerald-400 font-bold">✓ TicketSink:</span>
                        <span>Single root incident routed to the {resourceName(inc.resourceId)} manager</span>
                      </div>
                      {inc.itemDisabled && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <span className="text-amber-400 font-bold">✓ AvailabilityControl:</span>
                          <span>
                            {itemLabel} {inc.itemName ?? ''} paused at {resourceName(inc.resourceId)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-slate-300">
                        <span className="text-emerald-400 font-bold">✓ Policy:</span>
                        <span>{inc.recommendedAction}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: HITL Money-Gate Queue */}
          {activeTab === 'hitl' && (
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FiUserCheck className="text-amber-400" /> Human-In-The-Loop Approval Queue
                  </h3>
                  <p className="text-xs text-slate-400">
                    Policy Money-Gate: Auto-resolves ≤ {money(approvalThreshold)}, gates &gt; {money(approvalThreshold)} for human signoff
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-mono font-bold border border-amber-500/30">
                  {hitlQueue.length} Pending
                </span>
              </div>

              {hitlQueue.length === 0 ? (
                <div className="p-8 rounded-xl bg-slate-900/40 border border-slate-800 text-center">
                  <FiCheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-300">HITL Queue is clean. No high-risk claims waiting.</p>
                </div>
              ) : (
                hitlQueue.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/40 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-[10px] font-mono text-amber-400 uppercase font-bold">
                          HIGH-VALUE FINANCIAL MUTATION
                        </span>
                        <h4 className="text-xs font-bold text-white mt-0.5">
                          Claimed Refund: {money(item.amount)} ({item.orderId || 'Order'})
                        </h4>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                        Awaiting Human
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">{item.reason}</p>

                    <div className="text-[10px] font-mono text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800">
                      IdempotencyKey: {item.idempotencyKey}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleHitlDecision(item.id, 'approve')}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-all"
                      >
                        Approve {money(item.amount)} Refund
                      </button>
                      <button
                        onClick={() => handleHitlDecision(item.id, 'reject')}
                        className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all border border-slate-700"
                      >
                        Reject Claim
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: 4-Adapter Explorer */}
          {activeTab === 'adapters' && (
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TbGitFork className="text-sky-400" /> Adapter Architecture Explorer
                </h3>
                <p className="text-xs text-slate-400">
                  The core engine never touches a DB directly; it only talks to these adapter interfaces
                </p>
              </div>

              {/* Sub tabs */}
              <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-mono">
                <button
                  onClick={() => setAdapterSubTab('orderSource')}
                  className={`py-1 rounded-lg ${
                    adapterSubTab === 'orderSource' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  OrderSource
                </button>
                <button
                  onClick={() => setAdapterSubTab('refundGateway')}
                  className={`py-1 rounded-lg ${
                    adapterSubTab === 'refundGateway' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  RefundGateway
                </button>
                <button
                  onClick={() => setAdapterSubTab('ticketSink')}
                  className={`py-1 rounded-lg ${
                    adapterSubTab === 'ticketSink' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  TicketSink
                </button>
                <button
                  onClick={() => setAdapterSubTab('availabilityControl')}
                  className={`py-1 rounded-lg ${
                    adapterSubTab === 'availabilityControl' ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'
                  }`}
                >
                  Availability
                </button>
              </div>

              {/* Adapter Data Viewer */}
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-slate-300 max-h-64 overflow-y-auto">
                {adapterSubTab === 'orderSource' && (
                  <div>
                    <div className="text-sky-400 font-bold mb-2">// OrderSource (Live Order Data)</div>
                    <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
                      {JSON.stringify(adaptersData?.orders?.slice(0, 4) || [], null, 2)}
                    </pre>
                  </div>
                )}
                {adapterSubTab === 'refundGateway' && (
                  <div>
                    <div className="text-emerald-400 font-bold mb-2">// RefundGateway (Processed Idempotent Receipts)</div>
                    <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
                      {JSON.stringify(adaptersData?.refunds || [], null, 2)}
                    </pre>
                  </div>
                )}
                {adapterSubTab === 'ticketSink' && (
                  <div>
                    <div className="text-purple-400 font-bold mb-2">// TicketSink (Incidents & Manager Dispatches)</div>
                    <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
                      {JSON.stringify(adaptersData?.incidents || [], null, 2)}
                    </pre>
                  </div>
                )}
                {adapterSubTab === 'availabilityControl' && (
                  <div>
                    <div className="text-amber-400 font-bold mb-2">// AvailabilityControl (Paused {itemLabel}s & Safeguards)</div>
                    <pre className="text-[10px] text-slate-400 whitespace-pre-wrap">
                      {JSON.stringify(adaptersData?.disabledItems || [], null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: Bring Your Own Agent (BYO Agent) Tool Spec */}
          {activeTab === 'byo' && (
            <div className="glass-panel p-5 rounded-2xl flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FiCpu className="text-orange-400" /> Bring Your Own Agent (BYO-Agent)
                </h3>
                <p className="text-xs text-slate-400">
                  Exposes standard JSON schemas for OpenAI, Claude, LangGraph, or CrewAI agents
                </p>
              </div>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-bold text-orange-400 font-mono">blaze_triage(rawText, channel)</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Classifies intent, category, urgency, and tests prompt-injection security.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-bold text-purple-400 font-mono">blaze_correlate(complaintId, resourceId)</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Cross-references with live operational signals to identify systemic bottlenecks.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-bold text-emerald-400 font-mono">blaze_resolve(triageId, orderId)</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Executes policy-gated idempotent financial mutations or routes to HITL.
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="font-bold text-amber-400 font-mono">blaze_respond(triageId, channel)</div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    Generates empathetic contextual replies with a second-pass quality review.
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/60 px-6 py-3 text-center text-xs text-slate-500 font-mono flex items-center justify-between">
        <span>BlazeResolver • Open Source AI Harness for Customer Service</span>
        <span>Apache-2.0 License • Plug Into Any Backend or Agent</span>
      </footer>
        </>
      )}
    </div>
  );
}
