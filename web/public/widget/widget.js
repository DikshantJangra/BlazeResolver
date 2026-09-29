/*
 * BlazeResolver Customer Support & AI Resolution Widget (v0.8.0)
 * Modern, zero-dependency embeddable live chat widget with Blazzy Mascot.
 *
 * Embed snippet:
 *   <script src="https://cdn.jsdelivr.net/npm/blazeresolver@latest/widget/widget.js"
 *           data-endpoint="http://localhost:3000"
 *           data-app-version="1.0.0"
 *           data-user-name="Alex Carter"
 *           data-user-email="alex@example.com"></script>
 *
 * Optional attributes:
 *   data-endpoint           Base API endpoint (default: current origin or /)
 *   data-user-name          Customer display name
 *   data-user-email         Customer email address
 *   data-order-id           Active order or tracking ID
 *   data-accent             Brand accent color (default: #ea580c / fiery orange)
 *   data-position           "right" (default) or "left"
 *   data-title              Header title (default: "Blaze Support")
 *   data-subtitle           Header subtitle (default: "Instant AI Triage & Resolution")
 *   data-launcher           "false" to disable floating button (trigger via UI)
 *   data-logo               Custom mascot image/SVG URL
 *
 * Global JavaScript API:
 *   BlazeResolver.open(optionalMessage)
 *   BlazeResolver.close()
 *   BlazeResolver.toggle()
 *   BlazeResolver.identify({ name, email, orderId, userId })
 *   BlazeResolver.startNewChat()
 */
(function () {
  'use strict';
  if (window.BlazeResolver && window.BlazeResolver.isSupportSuite) return;

  var script = document.currentScript || document.querySelector('script[src*="widget.js"]') || document.querySelector('script[data-endpoint]');
  var attr = function (name) { return (script && script.getAttribute('data-' + name)) || ''; };
  
  var rawEndpoint = attr('endpoint') || '';
  var endpoint = rawEndpoint ? rawEndpoint.replace(/\/+$/, '') : '';
  var appVersion = attr('app-version') || '1.0.0';
  var initialName = attr('user-name') || attr('user-id') || '';
  var initialEmail = attr('user-email') || '';
  var initialOrderId = attr('order-id') || '';
  var customAccent = attr('accent') || '#ea580c';
  var customTitle = attr('title') || 'Blaze Support';
  var customSubtitle = attr('subtitle') || 'Instant AI Triage & Resolution';
  var showLauncher = attr('launcher') !== 'false';
  var position = attr('position') === 'left' ? 'left' : 'right';
  var logoUrl = attr('logo') || '/blazyy.svg';

  var EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var DRAFT_KEY = 'blazeresolver:support:draft';
  var USER_KEY = 'blazeresolver:support:user';
  var ACTIVE_TICKET_KEY = 'blazeresolver:support:active_ticket';

  // Load cached user profile if exists
  var savedUser = {};
  try {
    savedUser = JSON.parse(localStorage.getItem(USER_KEY) || '{}');
  } catch (e) {}

  var state = {
    isOpen: false,
    activeTab: 'chat', // 'chat' | 'requests'
    customerName: initialName || savedUser.name || '',
    customerEmail: initialEmail || savedUser.email || '',
    orderId: initialOrderId || savedUser.orderId || '',
    identityReady: Boolean((initialName || savedUser.name) && (initialEmail || savedUser.email)),
    tickets: [],
    activeTicket: null,
    messages: [],
    isSending: false,
    isTyping: false,
    rating: null,
    ratingStars: 5,
    ratingComment: '',
    ratingSubmitted: false,
    statusText: '',
    unreadCount: 0
  };

  function persistUser() {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify({
        name: state.customerName,
        email: state.customerEmail,
        orderId: state.orderId
      }));
    } catch (e) {}
  }

  // Icons (SVG Strings)
  var ICONS = {
    close: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
    send: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M1.946 9.315c-.522-.174-.527-.455.01-.634l19.087-6.362c.529-.176.832.12.684.638l-5.454 19.086c-.15.529-.455.547-.679.045L12 14l6-8-8 6-6.054-2.685z"></path></svg>',
    chat: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>',
    inbox: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"></polyline><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"></path></svg>',
    sparkle: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 2l2.4 7.2L21.6 12l-7.2 2.4L12 21.6l-2.4-7.2L2.4 12l7.2-2.4z"></path></svg>',
    starFilled: '<svg viewBox="0 0 24 24" width="20" height="20" fill="#f59e0b"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>',
    starEmpty: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#cbd5e1" stroke-width="2"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"></path></svg>',
    checkDouble: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 6 9 17 4 12"></polyline><polyline points="22 10 13 21 11 19"></polyline></svg>',
    plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>',
    flame: '<svg viewBox="0 0 24 24" width="28" height="28" fill="#ea580c"><path d="M12 23c-4.97 0-9-3.8-9-8.5 0-3.64 2.37-6.72 5.6-7.96.48-.19.98.24.91.75-.41 3.01.88 4.41 2.22 4.41 1.76 0 2.27-1.89 2.27-3.7 0-2.31-1.07-4.48-1.57-5.5-.23-.46.12-.99.64-.99 4.3 0 7.93 4.29 7.93 11.49 0 5.52-4.03 10-9 10z"></path></svg>'
  };

  var CSS = [
    ':host { all: initial; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color-scheme: light; }',
    '* { box-sizing: border-box; }',
    '[hidden] { display: none !important; }',
    'button { font: inherit; cursor: pointer; border: 0; outline: none; background: transparent; -webkit-tap-highlight-color: transparent; }',
    'input, textarea { font: inherit; outline: none; }',

    // Floating Mascot Launcher
    '.blazzy-launcher { position: fixed; right: 24px; bottom: calc(24px + env(safe-area-inset-bottom, 0px)); z-index: 2147483646; width: 64px; height: 64px; border-radius: 50%; background: linear-gradient(135deg, #ff8c37, #ea580c); box-shadow: 0 8px 28px rgba(234, 88, 12, 0.4), 0 2px 8px rgba(0,0,0,0.1); display: flex; align-items: center; justify-content: center; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1); cursor: pointer; }',
    '.blazzy-launcher:hover { transform: scale(1.08) translateY(-3px); box-shadow: 0 12px 36px rgba(234, 88, 12, 0.5), 0 4px 12px rgba(0,0,0,0.15); }',
    '.blazzy-launcher.open { transform: scale(0.95); background: #1e293b; box-shadow: 0 6px 20px rgba(0,0,0,0.25); }',
    '.launcher-avatar { width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; pointer-events: none; }',
    '.launcher-avatar img, .launcher-avatar svg { width: 100%; height: 100%; object-fit: contain; }',
    '.launcher-badge { position: absolute; top: -2px; right: -2px; background: #ef4444; color: white; font-size: 11px; font-weight: 700; width: 22px; height: 22px; border-radius: 50%; border: 2.5px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(239,68,68,0.4); }',

    // Main Chat Window Panel
    '.blazzy-panel { position: fixed; right: 24px; bottom: calc(100px + env(safe-area-inset-bottom, 0px)); z-index: 2147483647; width: 400px; max-width: calc(100vw - 32px); height: 640px; max-height: calc(100vh - 120px); background: #ffffff; border-radius: 24px; box-shadow: 0 24px 60px -12px rgba(15,23,42,0.25), 0 0 1px 1px rgba(15,23,42,0.06); border: 1px solid #f1f5f9; display: flex; flex-direction: column; overflow: hidden; opacity: 0; transform: translateY(16px) scale(0.96); pointer-events: none; transition: all 0.22s cubic-bezier(0.16, 1, 0.3, 1); }',
    '.blazzy-panel.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }',

    // Header
    '.panel-header { background: linear-gradient(135deg, #1e293b, #0f172a); color: #ffffff; padding: 18px 20px 14px; position: relative; flex-shrink: 0; border-bottom: 1px solid rgba(255,255,255,0.08); }',
    '.header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }',
    '.brand-wrap { display: flex; align-items: center; gap: 12px; }',
    '.mascot-badge { width: 40px; height: 40px; border-radius: 12px; background: linear-gradient(135deg, rgba(234,88,12,0.25), rgba(255,140,55,0.1)); border: 1px solid rgba(234,88,12,0.4); display: flex; align-items: center; justify-content: center; padding: 4px; }',
    '.mascot-badge img, .mascot-badge svg { width: 100%; height: 100%; object-fit: contain; }',
    '.brand-text h3 { margin: 0; font-size: 16px; font-weight: 700; color: #ffffff; display: flex; align-items: center; gap: 6px; }',
    '.brand-text p { margin: 2px 0 0; font-size: 11.5px; color: #94a3b8; font-weight: 500; }',
    '.live-dot { width: 7px; height: 7px; border-radius: 50%; background: #22c55e; box-shadow: 0 0 8px #22c55e; display: inline-block; }',
    '.header-close { width: 32px; height: 32px; border-radius: 8px; color: #94a3b8; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }',
    '.header-close:hover { background: rgba(255,255,255,0.1); color: #ffffff; }',

    // Navigation Tabs
    '.panel-tabs { display: flex; margin-top: 14px; background: rgba(255,255,255,0.06); border-radius: 10px; padding: 3px; gap: 2px; }',
    '.tab-btn { flex: 1; padding: 7px 10px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: #94a3b8; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s; }',
    '.tab-btn.active { background: #ffffff; color: #0f172a; box-shadow: 0 2px 6px rgba(0,0,0,0.15); }',

    // Body container
    '.panel-body { flex: 1; min-height: 0; display: flex; flex-direction: column; background: #f8fafc; position: relative; overflow: hidden; }',

    // Identity Gate (When name/email is unknown)
    '.identity-gate { padding: 28px 24px; display: flex; flex-direction: column; justify-content: center; flex: 1; background: #ffffff; text-align: center; }',
    '.gate-icon { width: 56px; height: 56px; border-radius: 18px; background: #fff7ed; border: 1.5px solid #fed7aa; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; color: #ea580c; }',
    '.gate-title { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 6px; }',
    '.gate-desc { font-size: 13px; color: #64748b; margin: 0 0 20px; line-height: 1.5; }',
    '.input-group { margin-bottom: 12px; text-align: left; }',
    '.input-label { display: block; font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 6px; }',
    '.input-field { width: 100%; height: 42px; padding: 0 14px; border-radius: 10px; border: 1px solid #cbd5e1; background: #ffffff; color: #0f172a; font-size: 14px; transition: border-color 0.15s, box-shadow 0.15s; }',
    '.input-field:focus { border-color: #ea580c; box-shadow: 0 0 0 3px rgba(234,88,12,0.15); }',
    '.start-chat-btn { width: 100%; height: 44px; margin-top: 8px; border-radius: 12px; background: linear-gradient(135deg, #ff8c37, #ea580c); color: #ffffff; font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(234,88,12,0.3); transition: all 0.15s; }',
    '.start-chat-btn:hover { opacity: 0.95; transform: translateY(-1px); }',

    // Message List View
    '.messages-container { flex: 1; overflow-y: auto; padding: 16px 16px 12px; display: flex; flex-direction: column; gap: 12px; }',
    '.message-row { display: flex; gap: 8px; max-width: 86%; font-size: 13.5px; line-height: 1.5; }',
    '.message-row.customer { align-self: flex-end; flex-direction: row-reverse; }',
    '.message-row.agent, .message-row.system { align-self: flex-start; }',
    '.message-avatar { width: 28px; height: 28px; border-radius: 8px; background: #fff7ed; border: 1px solid #fed7aa; flex-shrink: 0; display: flex; align-items: center; justify-content: center; padding: 2px; }',
    '.message-avatar img, .message-avatar svg { width: 100%; height: 100%; object-fit: contain; }',
    '.bubble { padding: 10px 14px; border-radius: 16px; word-break: break-word; }',
    '.customer .bubble { background: #ea580c; color: #ffffff; border-bottom-right-radius: 4px; }',
    '.agent .bubble { background: #ffffff; color: #1e293b; border-bottom-left-radius: 4px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }',
    '.system .bubble { background: #f1f5f9; color: #475569; border-radius: 12px; font-size: 12.5px; border: 1px dashed #cbd5e1; }',
    '.message-time { font-size: 10.5px; color: #94a3b8; margin-top: 4px; display: flex; align-items: center; gap: 4px; }',
    '.customer .message-time { justify-content: flex-end; }',

    // Typing Indicator
    '.typing-indicator { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; border-bottom-left-radius: 4px; width: fit-content; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }',
    '.typing-dot { width: 6px; height: 6px; border-radius: 50%; background: #ea580c; animation: blazzyBounce 1.4s infinite ease-in-out both; }',
    '.typing-dot:nth-child(1) { animation-delay: -0.32s; }',
    '.typing-dot:nth-child(2) { animation-delay: -0.16s; }',
    '@keyframes blazzyBounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }',

    // Resolution & CSAT Box
    '.csat-card { background: #ffffff; border: 1.5px solid #fed7aa; border-radius: 16px; padding: 14px; margin: 4px 0 8px; box-shadow: 0 4px 12px rgba(234,88,12,0.08); }',
    '.csat-title { font-size: 13px; font-weight: 700; color: #0f172a; margin: 0 0 6px; text-align: center; }',
    '.csat-stars { display: flex; justify-content: center; gap: 8px; margin: 10px 0; }',
    '.star-btn { padding: 4px; cursor: pointer; transition: transform 0.1s; }',
    '.star-btn:hover { transform: scale(1.2); }',
    '.csat-input { width: 100%; height: 36px; padding: 0 10px; border-radius: 8px; border: 1px solid #e2e8f0; font-size: 12.5px; margin-bottom: 8px; }',
    '.csat-submit-btn { width: 100%; height: 34px; border-radius: 8px; background: #ea580c; color: white; font-size: 12.5px; font-weight: 700; }',

    // Input Footer
    '.panel-footer { background: #ffffff; border-top: 1px solid #f1f5f9; padding: 12px 14px; flex-shrink: 0; }',
    '.input-bar { display: flex; align-items: center; gap: 8px; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 6px 8px 6px 14px; transition: border-color 0.15s, box-shadow 0.15s; }',
    '.input-bar:focus-within { border-color: #ea580c; box-shadow: 0 0 0 3px rgba(234,88,12,0.12); background: #ffffff; }',
    '.chat-input { flex: 1; border: 0; background: transparent; font-size: 13.5px; color: #0f172a; resize: none; max-height: 100px; min-height: 24px; line-height: 1.4; padding: 0; }',
    '.send-btn { width: 34px; height: 34px; border-radius: 10px; background: #ea580c; color: #ffffff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s; }',
    '.send-btn:disabled { background: #cbd5e1; cursor: not-allowed; }',
    '.send-btn:hover:not(:disabled) { background: #c2410c; transform: scale(1.05); }',

    // Requests / Tickets Tab
    '.tickets-view { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }',
    '.ticket-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px; cursor: pointer; transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }',
    '.ticket-card:hover { border-color: #ea580c; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); }',
    '.ticket-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }',
    '.ticket-id { font-size: 11.5px; font-weight: 700; color: #64748b; font-family: monospace; }',
    '.ticket-status { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 100px; text-transform: uppercase; }',
    '.status-RESOLVED { background: #dcfce7; color: #15803d; }',
    '.status-OPEN { background: #dbeafe; color: #1d4ed8; }',
    '.status-IN_PROGRESS { background: #fef9c3; color: #a16207; }',
    '.status-ESCALATED { background: #fee2e2; color: #b91c1c; }',
    '.ticket-card-title { font-size: 13.5px; font-weight: 600; color: #0f172a; margin: 0 0 4px; }',
    '.ticket-card-meta { font-size: 11.5px; color: #94a3b8; display: flex; justify-content: space-between; }',
    '.new-ticket-action { margin-top: 10px; height: 40px; border-radius: 10px; background: #fff7ed; border: 1.5px dashed #fed7aa; color: #ea580c; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 6px; }',
    '.new-ticket-action:hover { background: #ffedd5; }',

    // Responsive
    '@media (max-width: 480px) {',
    '  .blazzy-panel { right: 8px; left: 8px; width: auto; max-width: none; bottom: calc(8px + env(safe-area-inset-bottom, 0px)); height: calc(100vh - 16px); max-height: none; border-radius: 20px; }',
    '  .blazzy-launcher.open { display: none; }',
    '}'
  ].join('\n');

  // DOM Container & Shadow Root
  var host = document.createElement('div');
  host.setAttribute('data-blazeresolver-support-suite', '');
  var shadow = host.attachShadow({ mode: 'open' });

  // Render Template
  shadow.innerHTML = [
    '<style>' + CSS + '</style>',
    '<button class="blazzy-launcher" type="button" aria-label="Open Blaze Support">',
    '  <div class="launcher-avatar">',
    '    <img src="' + logoUrl + '" alt="Blazzy Mascot" onerror="this.outerHTML=\'' + ICONS.flame.replace(/'/g, "\\'") + '\'" />',
    '  </div>',
    '  <div class="launcher-badge" hidden>0</div>',
    '</button>',

    '<div class="blazzy-panel" role="dialog">',
    '  <div class="panel-header">',
    '    <div class="header-top">',
    '      <div class="brand-wrap">',
    '        <div class="mascot-badge">',
    '          <img src="' + logoUrl + '" alt="Blazzy" onerror="this.outerHTML=\'' + ICONS.flame.replace(/'/g, "\\'") + '\'" />',
    '        </div>',
    '        <div class="brand-text">',
    '          <h3>' + customTitle + ' <span class="live-dot" title="Autonomous AI Active"></span></h3>',
    '          <p>' + customSubtitle + '</p>',
    '        </div>',
    '      </div>',
    '      <button class="header-close" type="button" aria-label="Close">' + ICONS.close + '</button>',
    '    </div>',
    '    <div class="panel-tabs">',
    '      <button class="tab-btn active" data-tab="chat">' + ICONS.chat + ' Live Chat</button>',
    '      <button class="tab-btn" data-tab="requests">' + ICONS.inbox + ' My Requests (<span class="ticket-count">0</span>)</button>',
    '    </div>',
    '  </div>',

    '  <div class="panel-body">',
    '    <!-- Identity Gate -->',
    '    <div class="identity-gate" hidden>',
    '      <div class="gate-icon">' + ICONS.sparkle + '</div>',
    '      <h4 class="gate-title">Welcome to Live Support</h4>',
    '      <p class="gate-desc">Enter your details to chat directly with Blazzy and track automated resolutions in real-time.</p>',
    '      <div class="input-group">',
    '        <label class="input-label">Your Name</label>',
    '        <input class="input-field name-field" type="text" placeholder="Alex Carter" />',
    '      </div>',
    '      <div class="input-group">',
    '        <label class="input-label">Email Address</label>',
    '        <input class="input-field email-field" type="email" placeholder="alex@example.com" />',
    '      </div>',
    '      <div class="input-group">',
    '        <label class="input-label">Order ID (optional)</label>',
    '        <input class="input-field order-field" type="text" placeholder="ORD-9021" />',
    '      </div>',
    '      <button class="start-chat-btn" type="button">' + ICONS.sparkle + ' Start Live Chat</button>',
    '    </div>',

    '    <!-- Chat View -->',
    '    <div class="chat-view" style="display:flex;flex-direction:column;flex:1;min-height:0;">',
    '      <div class="messages-container"></div>',
    '      <div class="panel-footer">',
    '        <div class="input-bar">',
    '          <textarea class="chat-input" placeholder="Type a message or describe an issue..." rows="1"></textarea>',
    '          <button class="send-btn" type="button" aria-label="Send Message">' + ICONS.send + '</button>',
    '        </div>',
    '      </div>',
    '    </div>',

    '    <!-- Requests View -->',
    '    <div class="requests-view" hidden>',
    '      <div class="tickets-view"></div>',
    '    </div>',
    '  </div>',
    '</div>'
  ].join('\n');

  // Selectors
  var $ = function (sel) { return shadow.querySelector(sel); };
  var $$ = function (sel) { return shadow.querySelectorAll(sel); };

  var launcher = $('.blazzy-launcher');
  var panel = $('.blazzy-panel');
  var closeBtn = $('.header-close');
  var tabBtns = $$('.tab-btn');
  var identityGate = $('.identity-gate');
  var chatView = $('.chat-view');
  var requestsView = $('.requests-view');
  var messagesContainer = $('.messages-container');
  var ticketsContainer = $('.tickets-view');
  var chatInput = $('.chat-input');
  var sendBtn = $('.send-btn');
  var nameField = $('.name-field');
  var emailField = $('.email-field');
  var orderField = $('.order-field');
  var startChatBtn = $('.start-chat-btn');
  var ticketCountSpan = $('.ticket-count');

  // Fill initial form values
  if (state.customerName) nameField.value = state.customerName;
  if (state.customerEmail) emailField.value = state.customerEmail;
  if (state.orderId) orderField.value = state.orderId;

  // Render & UI State Management
  function updateUI() {
    launcher.classList.toggle('open', state.isOpen);
    launcher.innerHTML = state.isOpen
      ? ICONS.close
      : '<div class="launcher-avatar"><img src="' + logoUrl + '" alt="Blazzy" onerror="this.outerHTML=\'' + ICONS.flame.replace(/'/g, "\\'") + '\'" /></div>' +
        (state.unreadCount > 0 ? '<div class="launcher-badge">' + state.unreadCount + '</div>' : '');
    
    panel.classList.toggle('open', state.isOpen);

    tabBtns.forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === state.activeTab);
    });

    ticketCountSpan.textContent = String(state.tickets.length);

    if (!state.identityReady) {
      identityGate.hidden = false;
      chatView.hidden = true;
      requestsView.hidden = true;
    } else {
      identityGate.hidden = true;
      chatView.hidden = state.activeTab !== 'chat';
      requestsView.hidden = state.activeTab !== 'requests';
    }
  }

  function renderMessages() {
    if (!messagesContainer) return;
    var html = '';

    if (state.messages.length === 0) {
      html += [
        '<div class="message-row system">',
        '  <div class="bubble">👋 Hi ' + (state.customerName || 'there') + '! How can we help you today? Describe your issue or ask a question.</div>',
        '</div>'
      ].join('');
    }

    state.messages.forEach(function (msg) {
      var isCustomer = msg.senderType === 'customer';
      var time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      
      html += [
        '<div class="message-row ' + (isCustomer ? 'customer' : 'agent') + '">',
        !isCustomer ? '<div class="message-avatar"><img src="' + logoUrl + '" onerror="this.outerHTML=\'' + ICONS.flame.replace(/'/g, "\\'") + '\'"/></div>' : '',
        '  <div>',
        '    <div class="bubble">' + escapeHtml(msg.text) + '</div>',
        '    <div class="message-time">' + (isCustomer ? ICONS.checkDouble : '') + time + '</div>',
        '  </div>',
        '</div>'
      ].join('');
    });

    if (state.isTyping) {
      html += [
        '<div class="message-row agent">',
        '  <div class="message-avatar"><img src="' + logoUrl + '" onerror="this.outerHTML=\'' + ICONS.flame.replace(/'/g, "\\'") + '\'"/></div>',
        '  <div class="typing-indicator">',
        '    <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>',
        '  </div>',
        '</div>'
      ].join('');
    }

    // CSAT Card if active ticket is resolved
    if (state.activeTicket && state.activeTicket.status === 'RESOLVED' && !state.ratingSubmitted) {
      html += renderCsatCard();
    }

    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function renderCsatCard() {
    var stars = '';
    for (var i = 1; i <= 5; i++) {
      stars += '<button class="star-btn" type="button" data-star="' + i + '">' + (i <= state.ratingStars ? ICONS.starFilled : ICONS.starEmpty) + '</button>';
    }
    return [
      '<div class="csat-card">',
      '  <div class="csat-title">🎉 Issue Resolved! Rate your experience:</div>',
      '  <div class="csat-stars">' + stars + '</div>',
      '  <input class="csat-input" type="text" placeholder="Optional feedback..." value="' + escapeHtml(state.ratingComment) + '" />',
      '  <button class="csat-submit-btn" type="button">Submit CSAT Rating</button>',
      '</div>'
    ].join('');
  }

  function renderTickets() {
    if (!ticketsContainer) return;
    var html = '<button class="new-ticket-action" type="button">' + ICONS.plus + ' Start New Conversation</button>';

    if (state.tickets.length === 0) {
      html += '<div style="text-align:center;padding:32px 16px;color:#94a3b8;font-size:13px;">No past support requests found.</div>';
    } else {
      state.tickets.forEach(function (ticket) {
        var date = ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : '';
        html += [
          '<div class="ticket-card" data-ticket-id="' + ticket.id + '">',
          '  <div class="ticket-card-header">',
          '    <span class="ticket-id">' + ticket.id + '</span>',
          '    <span class="ticket-status status-' + ticket.status + '">' + ticket.status.replace(/_/g, ' ') + '</span>',
          '  </div>',
          '  <div class="ticket-card-title">' + escapeHtml(ticket.subject || 'Support Ticket') + '</div>',
          '  <div class="ticket-card-meta">',
          '    <span>' + (ticket.channel || 'text').toUpperCase() + '</span>',
          '    <span>' + date + '</span>',
          '  </div>',
          '</div>'
        ].join('');
      });
    }

    ticketsContainer.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  // API Actions
  async function fetchTickets() {
    if (!state.customerEmail) return;
    try {
      var res = await fetch(endpoint + '/api/support/tickets?customerEmail=' + encodeURIComponent(state.customerEmail));
      var json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        state.tickets = json.data;
        if (!state.activeTicket && state.tickets.length > 0) {
          state.activeTicket = state.tickets[0];
          await loadMessages(state.activeTicket.id);
        }
        updateUI();
        renderTickets();
      }
    } catch (e) {}
  }

  async function loadMessages(ticketId) {
    if (!ticketId) return;
    try {
      var res = await fetch(endpoint + '/api/support/tickets/' + ticketId + '/messages');
      var json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        state.messages = json.data;
        renderMessages();
      }
    } catch (e) {}
  }

  async function sendMessage() {
    var text = chatInput.value.trim();
    if (!text || state.isSending) return;

    chatInput.value = '';
    state.isSending = true;
    state.isTyping = true;

    // Add customer message locally
    state.messages.push({
      id: 'local-' + Date.now(),
      senderType: 'customer',
      senderName: state.customerName || 'Customer',
      text: text,
      createdAt: new Date().toISOString()
    });
    renderMessages();

    try {
      if (!state.activeTicket) {
        // Create new ticket
        var createRes = await fetch(endpoint + '/api/support/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subject: text.slice(0, 60),
            customerName: state.customerName,
            customerEmail: state.customerEmail,
            orderId: state.orderId || undefined,
            message: text,
            channel: 'text',
            priority: 'normal'
          })
        });
        var createJson = await createRes.json();
        if (createJson.success && createJson.data) {
          state.activeTicket = createJson.data;
          await fetchTickets();
          await loadMessages(state.activeTicket.id);
        }
      } else {
        // Post message to existing ticket
        var msgRes = await fetch(endpoint + '/api/support/tickets/' + state.activeTicket.id + '/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderType: 'customer',
            senderName: state.customerName,
            text: text
          })
        });
        var msgJson = await msgRes.json();
        if (msgJson.success) {
          await loadMessages(state.activeTicket.id);
        }
      }
    } catch (err) {
      state.messages.push({
        id: 'err-' + Date.now(),
        senderType: 'agent',
        senderName: 'Blazzy Support',
        text: '⚠️ Could not reach server. Please check your connection.',
        createdAt: new Date().toISOString()
      });
    } finally {
      state.isSending = false;
      state.isTyping = false;
      renderMessages();
    }
  }

  async function submitRating() {
    if (!state.activeTicket) return;
    try {
      await fetch(endpoint + '/api/support/tickets/' + state.activeTicket.id + '/rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: state.ratingStars,
          comment: state.ratingComment
        })
      });
      state.ratingSubmitted = true;
      renderMessages();
    } catch (e) {}
  }

  // Event Listeners
  launcher.addEventListener('click', function () {
    state.isOpen = !state.isOpen;
    if (state.isOpen) state.unreadCount = 0;
    updateUI();
    if (state.isOpen && state.identityReady) {
      fetchTickets();
      if (state.activeTicket) loadMessages(state.activeTicket.id);
      setTimeout(function () { chatInput.focus(); }, 100);
    }
  });

  closeBtn.addEventListener('click', function () {
    state.isOpen = false;
    updateUI();
  });

  tabBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.activeTab = btn.getAttribute('data-tab');
      updateUI();
      if (state.activeTab === 'requests') {
        fetchTickets();
      }
    });
  });

  startChatBtn.addEventListener('click', function () {
    var name = nameField.value.trim();
    var email = emailField.value.trim();
    var order = orderField.value.trim();

    if (!name) { nameField.focus(); return; }
    if (!email || !EMAIL_REGEX.test(email)) { emailField.focus(); return; }

    state.customerName = name;
    state.customerEmail = email;
    state.orderId = order;
    state.identityReady = true;
    persistUser();
    updateUI();
    fetchTickets();
  });

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Ticket clicks & CSAT delegation
  shadow.addEventListener('click', function (e) {
    var target = e.target;
    
    // Ticket card click
    var card = target.closest('.ticket-card');
    if (card) {
      var ticketId = card.getAttribute('data-ticket-id');
      var match = state.tickets.find(function (t) { return t.id === ticketId; });
      if (match) {
        state.activeTicket = match;
        state.activeTab = 'chat';
        updateUI();
        loadMessages(match.id);
      }
      return;
    }

    // New conversation click
    if (target.closest('.new-ticket-action')) {
      state.activeTicket = null;
      state.messages = [];
      state.activeTab = 'chat';
      updateUI();
      renderMessages();
      chatInput.focus();
      return;
    }

    // CSAT Star Click
    var star = target.closest('.star-btn');
    if (star) {
      state.ratingStars = parseInt(star.getAttribute('data-star') || '5', 10);
      renderMessages();
      return;
    }

    // CSAT Submit Click
    if (target.closest('.csat-submit-btn')) {
      var commentInput = $('.csat-input');
      if (commentInput) state.ratingComment = commentInput.value;
      submitRating();
      return;
    }
  });

  // Global API
  window.BlazeResolver = {
    version: '0.8.0',
    isSupportSuite: true,
    open: function (msg) {
      state.isOpen = true;
      state.unreadCount = 0;
      updateUI();
      if (state.identityReady) {
        fetchTickets();
        if (state.activeTicket) loadMessages(state.activeTicket.id);
      }
      if (msg) {
        chatInput.value = msg;
      }
      setTimeout(function () { chatInput.focus(); }, 100);
    },
    close: function () {
      state.isOpen = false;
      updateUI();
    },
    toggle: function () {
      state.isOpen ? this.close() : this.open();
    },
    identify: function (user) {
      if (!user) return;
      if (user.name) state.customerName = String(user.name);
      if (user.email) state.customerEmail = String(user.email);
      if (user.orderId) state.orderId = String(user.orderId);
      if (state.customerName && state.customerEmail) {
        state.identityReady = true;
      }
      persistUser();
      updateUI();
      if (state.isOpen) fetchTickets();
    },
    startNewChat: function () {
      state.activeTicket = null;
      state.messages = [];
      state.activeTab = 'chat';
      updateUI();
      renderMessages();
    }
  };

  // Mount to page
  function mount() {
    document.body.appendChild(host);
    updateUI();
    renderMessages();
    try { document.dispatchEvent(new CustomEvent('blazeresolver:ready')); } catch (e) {}
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
