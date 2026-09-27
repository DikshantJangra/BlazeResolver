import {
  RiUser3Line,
  RiBuilding2Line,
  RiShoppingBag3Line,
  RiMailLine,
  RiPhoneLine,
  RiAwardLine,
  RiStarFill,
  RiStickyNoteLine,
  RiCpuLine,
  RiShieldCheckLine,
  RiAlertLine,
  RiPulseLine,
  RiCheckDoubleLine,
  RiTimerLine,
  RiGitPullRequestLine,
  RiGitBranchLine,
  RiExternalLinkLine,
  RiTerminalLine,
  RiSparklingLine
} from 'react-icons/ri';
import { BlazzyIcon } from './BlazzyMascot.js';
import type { CustomerContext, SupportMessage, SupportTicket, TicketRating } from './types.js';

export interface CustomerContextPanelProps {
  customerContext: CustomerContext | null;
  selectedTicket?: SupportTicket | null;
  firstCustomerMessage?: SupportMessage | null;
  ticketRating?: TicketRating | null;
  internalNotes?: SupportMessage[];
  onExecuteAction?: (action: string, amount?: number) => Promise<void>;
  onDiagnoseTicket?: () => Promise<void>;
  isExecutingAction?: boolean;
  isDiagnosing?: boolean;
}

export const CustomerContextPanel: React.FC<CustomerContextPanelProps> = ({
  customerContext,
  selectedTicket,
  firstCustomerMessage,
  ticketRating,
  internalNotes,
  onExecuteAction,
  onDiagnoseTicket,
  isExecutingAction,
  isDiagnosing
}) => {
  const aiReport = selectedTicket?.aiReport;
  const urgencyScore = aiReport?.urgencyScore == null ? null : Math.round(aiReport.urgencyScore * 100);

  return (
    <div className="w-80 lg:w-96 bg-gray-50/80 p-4 border-l border-gray-200 overflow-y-auto flex flex-col gap-4 text-xs shrink-0">
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">
          Customer 360 & AI Diagnostics
        </h4>
        {aiReport && (
          <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold flex items-center gap-1">
            <BlazzyIcon className="w-3 h-3 shrink-0" color="#EA580C" /> AI Inspected
          </span>
        )}
      </div>

      {selectedTicket && (
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-gray-900">Request intake</span>
            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] capitalize">
              {(selectedTicket.intakeChannel || 'support API').replace(/[_-]/g, ' ')}
            </span>
          </div>
          <span className="text-[10px] text-gray-500">
            Received {new Date(selectedTicket.createdAt).toLocaleString()}
          </span>
          <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap line-clamp-5">
            {firstCustomerMessage?.body || firstCustomerMessage?.content || selectedTicket.subject}
          </p>
        </div>
      )}

      {/* BlazeResolver Automated Fix Pipeline Task Card */}
      {selectedTicket && (selectedTicket.isEscalated || selectedTicket.githubIssueUrl || aiReport?.triageCategory === 'bug' || aiReport?.intent?.includes('Bug')) && (
        <div className="bg-gradient-to-br from-orange-50/90 to-amber-50/50 p-3.5 rounded-2xl border border-orange-200 shadow-2xs flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs">
              <RiSparklingLine className="w-4 h-4 text-orange-600" />
              <span>BlazeResolver Fix Task</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-orange-200 text-orange-950 font-bold text-[10px] uppercase tracking-wider">
              {selectedTicket.pulseStatus === 'investigating' ? '⚡ In Progress' : 'Queued'}
            </span>
          </div>

          <div className="bg-white/80 p-2.5 rounded-xl border border-orange-100 flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-[10.5px]">GitHub Tracking:</span>
              {selectedTicket.githubIssueUrl ? (
                <a
                  href={selectedTicket.githubIssueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-orange-700 hover:text-orange-900 flex items-center gap-1 text-[11px]"
                >
                  <span>Issue #{selectedTicket.githubIssueNumber || 'Linked'}</span>
                  <RiExternalLinkLine className="w-3 h-3" />
                </a>
              ) : (
                <span className="font-mono text-gray-700 text-[10.5px]">Issue Registered</span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-[10.5px]">Fix Engine Branch:</span>
              <span className="font-mono text-[10px] font-semibold text-gray-800 bg-gray-100 px-1.5 py-0.5 rounded border border-gray-200 flex items-center gap-1">
                <RiGitBranchLine className="w-3 h-3 text-gray-500" />
                <span>{selectedTicket.githubBranch || `blazeresolver/fix-${selectedTicket.ticketNumber?.toLowerCase() || 'task'}`}</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500 text-[10.5px]">Resolution Target:</span>
              {selectedTicket.githubPullRequestUrl ? (
                <a
                  href={selectedTicket.githubPullRequestUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 text-[11px]"
                >
                  <RiGitPullRequestLine className="w-3.5 h-3.5 text-purple-600" />
                  <span>View Pull Request</span>
                  <RiExternalLinkLine className="w-3 h-3" />
                </a>
              ) : (
                <span className="font-semibold text-gray-800 flex items-center gap-1">
                  <RiGitPullRequestLine className="w-3.5 h-3.5 text-purple-600" />
                  <span>Reviewed PR</span>
                </span>
              )}
            </div>
          </div>

          <div className="bg-gray-900 text-gray-200 p-2 rounded-xl text-[10px] font-mono flex flex-col gap-1">
            <div className="flex items-center justify-between text-gray-400 text-[9px] uppercase tracking-wider font-sans font-bold">
              <span className="flex items-center gap-1">
                <RiTerminalLine className="w-3 h-3 text-orange-400" /> Local Fix Command
              </span>
            </div>
            <code className="text-orange-300 break-all select-all">
              npx blazeresolver try --title &quot;{selectedTicket.subject.slice(0, 32)}&quot; --description &quot;{selectedTicket.subject}&quot;
            </code>
          </div>
        </div>
      )}

      {/* AI Performance & Triage Execution Report */}
      {aiReport && (
        <div className="bg-white p-3.5 rounded-2xl border border-orange-200 shadow-2xs flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 text-xs">
              <RiCpuLine className="w-4 h-4 text-orange-600" />
              <span>AI Triage & Policy Verdict</span>
            </div>
            {aiReport.executionDurationMs != null && (
              <span className="text-[10px] font-mono text-gray-500 flex items-center gap-0.5">
                <RiTimerLine className="w-3 h-3 text-gray-400" />
                {aiReport.executionDurationMs}ms
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 bg-orange-50/50 p-2.5 rounded-xl border border-orange-100 text-[11px]">
            <div>
              <span className="text-gray-500 block text-[10px]">Intent Classified</span>
              <span className="font-bold text-gray-900 capitalize break-all">{aiReport.intent || selectedTicket?.category || 'General'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Category / Severity</span>
              <span className="font-bold text-gray-900 capitalize break-all">{aiReport.triageCategory || '—'} / {aiReport.triageSeverity || '—'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Customer Sentiment</span>
              <span className="font-bold text-gray-900 capitalize">{aiReport.sentiment || 'Neutral'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Guardrail Check</span>
              <span className={`font-semibold flex items-center gap-1 ${aiReport.guardrailPassed === true ? 'text-emerald-700' : aiReport.guardrailPassed === false ? 'text-red-700' : 'text-gray-500'}`}>
                <RiShieldCheckLine className="w-3.5 h-3.5" />
                {aiReport.guardrailPassed === true ? 'Passed' : aiReport.guardrailPassed === false ? 'Blocked' : 'Not recorded'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Triage ID</span>
              <span className="font-mono text-[10px] text-gray-800 break-all">{aiReport.triageId || 'Not recorded'}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Prompt injection</span>
              <span className={`font-semibold ${aiReport.isPromptInjection ? 'text-red-700' : 'text-gray-700'}`}>
                {aiReport.isPromptInjection == null ? 'Not recorded' : aiReport.isPromptInjection ? 'Detected' : 'Not detected'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Human review</span>
              <span className="font-semibold text-gray-800">
                {aiReport.requiresHitl == null ? 'Not recorded' : aiReport.requiresHitl ? 'Required' : 'Not required'}
              </span>
            </div>
            <div>
              <span className="text-gray-500 block text-[10px]">Urgency Score</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      (urgencyScore ?? 0) > 75
                        ? 'bg-red-500'
                        : (urgencyScore ?? 0) > 50
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${urgencyScore ?? 0}%` }}
                  />
                </div>
                <span className="font-mono font-bold text-gray-800 text-[10px]">
                  {urgencyScore == null ? 'Not recorded' : `${urgencyScore}/100`}
                </span>
              </div>
            </div>
          </div>

          {/* Policy decision */}
          <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200/80 flex flex-col gap-1 text-[11px]">
            <div className="flex items-center justify-between font-bold">
              <span className="text-gray-700">Policy Authorization:</span>
              <span
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  aiReport.policyAllowed === true
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : aiReport.policyAllowed === false
                      ? 'bg-amber-50 text-amber-800 border border-amber-200'
                      : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                {aiReport.policyAllowed === true ? 'Auto-Approve Eligible' : aiReport.policyAllowed === false ? 'Requires Review' : 'Not recorded'}
              </span>
            </div>
            {aiReport.policyRationale && (
              <p className="text-gray-600 leading-relaxed text-[11px] mt-0.5">
                {aiReport.policyRationale}
              </p>
            )}
            {aiReport.suggestedAction && (
              <div className="mt-1 pt-1 border-t border-gray-200 text-[10.5px] text-gray-800">
                <strong className="text-orange-900">Recommended Action:</strong> {aiReport.suggestedAction}
              </div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 flex flex-col gap-1.5 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-blue-950">Knowledge retrieval (RAG)</span>
              <span className="text-[10px] font-semibold text-blue-800">
                {aiReport.ragApplied ? 'Used in reply' : aiReport.ragMatches === undefined ? 'Not run' : aiReport.ragMatches.length ? 'Retrieved, not applied' : 'No match'}
              </span>
            </div>
            {aiReport.ragMatches?.length ? (
              <ul className="list-disc pl-4 text-blue-900 space-y-0.5">
                {aiReport.ragMatches.map((match, index) => <li key={`${match}-${index}`} className="line-clamp-3">{match}</li>)}
              </ul>
            ) : (
              <p className="text-blue-900/70">{aiReport.ragMatches ? 'No knowledge sections matched this message.' : 'No retrieval run is recorded for this analysis.'}</p>
            )}
          </div>

          {aiReport.resolutionActions?.length ? (
            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 flex flex-col gap-1.5 text-[11px]">
              <span className="font-bold text-gray-800">Resolution actions</span>
              {aiReport.resolutionActions.map((action, index) => (
                <div key={`${action.actionType}-${index}`} className="flex items-start justify-between gap-2">
                  <span className="capitalize text-gray-700">{action.actionType}{action.amount != null ? ` · ₹${action.amount}` : ''}</span>
                  <span className="capitalize text-gray-500">{action.approvalStatus.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          ) : null}

          {(aiReport.responseChannel || aiReport.responseTone || aiReport.responseQualityPassed != null) && (
            <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-[11px]">
              <span className="font-bold text-gray-800 block mb-1">Assistant response</span>
              <div className="text-gray-600 flex flex-wrap gap-x-3 gap-y-1">
                {aiReport.responseChannel && <span>Channel: {aiReport.responseChannel}</span>}
                {aiReport.responseTone && <span>Tone: {aiReport.responseTone}</span>}
                {aiReport.responseQualityPassed != null && <span>Quality: {aiReport.responseQualityPassed ? 'passed' : 'review'}</span>}
              </div>
            </div>
          )}

          {/* 1-Click HITL Action & AI Harness Controls */}
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
              1-Click HITL Actions
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onExecuteAction?.('credit', aiReport.claimedAmount || 150)}
                disabled={isExecutingAction}
                className="p-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-900 border border-orange-200 font-bold text-[10.5px] transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <span>💳 ₹{aiReport.claimedAmount || 150} Credit</span>
              </button>
              <button
                type="button"
                onClick={() => onExecuteAction?.('replacement')}
                disabled={isExecutingAction}
                className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-[10.5px] transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <span>📦 Replacement</span>
              </button>
              <button
                type="button"
                onClick={() => onExecuteAction?.('coupon')}
                disabled={isExecutingAction}
                className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-[10.5px] transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <span>🎟️ Coupon</span>
              </button>
              <button
                type="button"
                onClick={() => onDiagnoseTicket?.()}
                disabled={isDiagnosing}
                className="p-2 rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-900 border border-gray-300 font-bold text-[10.5px] transition-colors flex items-center justify-center gap-1 disabled:opacity-50"
              >
                <span>⚡ {isDiagnosing ? 'Running...' : 'Re-Diagnose'}</span>
              </button>
            </div>
          </div>

          {/* Incident link if systemic */}
          {aiReport.isSystemic && (
            <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-[11px] flex flex-col gap-1">
              <div className="flex items-center gap-1 font-bold">
                <RiPulseLine className="w-4 h-4 text-purple-700" />
                <span>Correlated Systemic Incident</span>
              </div>
              <p className="text-purple-800 text-[10.5px]">
                {aiReport.incidentTitle || 'Active incident cluster linked with this customer complaint.'}
              </p>
            </div>
          )}
        </div>
      )}
      {selectedTicket && !aiReport && (
        <div className="bg-white p-3.5 rounded-2xl border border-gray-200 text-[11px] text-gray-600">
          No AI triage report is recorded for this request yet.
        </div>
      )}

      {/* Customer Profile Card */}
      {customerContext ? (
        <>
          <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-2.5">
            <div className="font-bold text-gray-800 flex items-center justify-between">
              <span>Customer Profile</span>
              {customerContext.isVip && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1">
                  <RiAwardLine className="w-3 h-3 text-amber-600" /> VIP Member
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2 text-gray-600">
              <div className="flex items-center gap-2">
                <RiUser3Line className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="truncate font-semibold text-gray-900">
                  {customerContext.name || selectedTicket?.customerName || 'Customer'}
                </span>
              </div>
              {(customerContext.email || selectedTicket?.customerEmail) && (
                <div className="flex items-center gap-2">
                  <RiMailLine className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate">{customerContext.email || selectedTicket?.customerEmail}</span>
                </div>
              )}
              {(customerContext.phone || selectedTicket?.customerPhone) && (
                <div className="flex items-center gap-2">
                  <RiPhoneLine className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-mono">{customerContext.phone || selectedTicket?.customerPhone}</span>
                </div>
              )}
              {(customerContext.outletName || selectedTicket?.outletName) && (
                <div className="flex items-center gap-2 text-gray-500 pt-1 border-t border-gray-100">
                  <RiBuilding2Line className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="truncate">{customerContext.outletName || selectedTicket?.outletName}</span>
                </div>
              )}
            </div>
          </div>

          {/* Linked Orders / Activity */}
          {customerContext.recentOrders && customerContext.recentOrders.length > 0 && (
            <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-2">
              <span className="font-bold text-gray-800">Linked Order History</span>
              <div className="space-y-2">
                {customerContext.recentOrders.map((ord: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-gray-50 p-2.5 rounded-xl border border-gray-200 text-[11px] flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span className="text-gray-900 font-mono">#{ord.orderNumber}</span>
                      <span className="text-gray-900 font-mono">
                        ₹{((ord.totalPaise || 0) / 100).toFixed(2)}
                      </span>
                    </div>
                    {ord.itemsSummary && (
                      <p className="text-gray-600 text-[10.5px] line-clamp-1">{ord.itemsSummary}</p>
                    )}
                    <div className="flex items-center justify-between text-gray-500 text-[10px] pt-0.5">
                      <span className="capitalize font-semibold text-gray-700">{ord.status}</span>
                      {ord.outletName && <span>{ord.outletName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ticket CSAT Rating */}
          {ticketRating && (
            <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-2xs flex flex-col gap-1.5">
              <div className="font-bold text-gray-800 flex items-center justify-between">
                <span>CSAT Score</span>
                <span className="flex items-center gap-1 text-amber-500 font-bold">
                  <RiStarFill className="w-3.5 h-3.5" />
                  <span>{ticketRating.rating} / 5</span>
                </span>
              </div>
              {ticketRating.comment && (
                <p className="text-[11px] text-gray-600 italic mt-0.5 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                  &ldquo;{ticketRating.comment}&rdquo;
                </p>
              )}
            </div>
          )}

          {/* Internal Staff Notes */}
          {internalNotes && internalNotes.length > 0 && (
            <div className="bg-amber-50/60 p-3.5 rounded-2xl border border-amber-200 shadow-2xs space-y-2">
              <span className="font-bold text-amber-900 flex items-center gap-1 text-xs">
                <RiStickyNoteLine className="w-4 h-4 text-amber-700" />
                <span>Internal Staff Notes ({internalNotes.length})</span>
              </span>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {internalNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-2 rounded-xl bg-white border border-amber-100 text-[11px] text-gray-800 shadow-2xs"
                  >
                    <p className="leading-relaxed">{note.content || note.body}</p>
                    <span className="text-[9.5px] text-gray-400 mt-1 block">
                      {note.authorName || note.senderName || 'Agent'} •{' '}
                      {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 text-gray-400 bg-white rounded-2xl border border-gray-200 p-4">
          <RiShoppingBag3Line className="w-8 h-8 mx-auto text-gray-300 mb-1" />
          <p className="font-medium text-xs text-gray-600">No customer profile linked</p>
        </div>
      )}
    </div>
  );
};
