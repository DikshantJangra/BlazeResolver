/*
 * BlazeResolver support widget. Loaded from a CDN, so every install picks up updates on its own.
 *   <script src="https://cdn.jsdelivr.net/npm/blazeresolver@latest/widget/widget.js" data-endpoint="/api/blaze" data-app-version="1.4.2"></script>
 * data-endpoint is the report handler in your own backend (`npx blazeresolver init` sets it up).
 * Building your own UI? POST {message, pageUrl, appVersion, userId, email, consoleErrors} to that endpoint.
 * data-key is only for the hosted-server mode: with it the default endpoint is <script origin>/api/report.
 *
 * Optional attributes:
 *   data-user-id, data-user-email   who is reporting (or call BlazeResolver.identify({ id, email }))
 *   data-accent="#ff6b00"            brand color
 *   data-position="right|left"
 *   data-title="Report a problem"
 *   data-ask-email="true"            ask for an email to be told about the fix (needs BLAZE_NOTIFY_CUSTOMERS=true)
 *   data-launcher="false"            no floating button; open it from your own UI instead
 * Open it from anywhere: <a href="#" data-blazeresolver-open>Report a bug</a>, or BlazeResolver.open('optional text').
 */
(function () {
  'use strict';
  if (window.BlazeResolver && window.BlazeResolver.version) return;

  var script = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var attr = function (name) { return (script && script.getAttribute('data-' + name)) || ''; };
  var key = attr('key');
  var endpoint = attr('endpoint') || '/api/blaze';
  var version = attr('app-version');
  var user = { id: attr('user-id'), email: attr('user-email') };
  var title = attr('title') || 'Report a problem';
  var showLauncher = attr('launcher') !== 'false';
  var askEmail = attr('ask-email') === 'true';

  // Limits match the handler's schema; anything longer would get the whole report rejected.
  var MAX_MESSAGE = 5000;
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var DRAFT_KEY = 'blazeresolver:draft';

  var errors = [];
  function remember(text) {
    text = String(text || '').slice(0, 1000);
    if (!text || errors[errors.length - 1] === text) return;
    errors.push(text);
    if (errors.length > 20) errors.shift();
  }
  window.addEventListener('error', function (e) {
    remember(e.message + (e.filename ? ' at ' + e.filename + ':' + e.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    remember('Unhandled rejection: ' + (r && r.message ? r.message : String(r)));
  });

  var MASCOT = 'data:image/webp;base64,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';
  var icon = function (path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  };
  var CLOSE = icon('<path d="M18 6 6 18M6 6l12 12"/>');
  var CHECK = icon('<path d="M20 6 9 17l-5-5"/>');

  var CSS =
    ':host{all:initial;--accent:#ff6b00;--text:#111827;--muted:#6b7280;--line:#e5e7eb;' +
    'font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color-scheme:light}' +
    '*{box-sizing:border-box}[hidden]{display:none!important}' +
    'button{font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    'button:focus-visible,input:focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
    'svg{display:block}' +

    '.launcher{position:fixed;right:20px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:2147483646;width:56px;height:56px;padding:0;' +
    'border-radius:50%;border:1px solid var(--line);background:#fff;color:var(--text);display:grid;place-items:center;' +
    'box-shadow:0 4px 14px rgba(0,0,0,.12);transition:transform .15s,box-shadow .15s}' +
    '.launcher:hover{transform:translateY(-1px);box-shadow:0 6px 18px rgba(0,0,0,.16)}' +
    '.launcher img{width:36px;height:auto}' +
    '.launcher svg{width:22px;height:22px}' +

    '.panel{position:fixed;right:20px;bottom:calc(88px + env(safe-area-inset-bottom,0px));z-index:2147483647;width:360px;max-width:calc(100vw - 32px);' +
    'max-height:calc(100vh - 110px);overflow-y:auto;background:#fff;color:var(--text);border:1px solid var(--line);border-radius:16px;' +
    'box-shadow:0 12px 40px rgba(0,0,0,.12),0 2px 8px rgba(0,0,0,.06);font-size:14px;line-height:1.5;' +
    'opacity:0;transform:translateY(8px);transition:opacity .15s ease,transform .15s ease}' +
    '.panel.open{opacity:1;transform:none}' +
    '.head{display:flex;align-items:center;gap:10px;padding:14px 12px 0 16px}' +
    '.head img{width:28px;height:auto;flex:none}' +
    '.title{flex:1;margin:0;font-size:16px;font-weight:600}' +
    '.x{width:32px;height:32px;border:0;border-radius:8px;background:transparent;color:var(--muted);display:grid;place-items:center}' +
    '.x:hover{background:#f3f4f6;color:var(--text)}' +
    '.x svg{width:18px;height:18px}' +
    '.body{padding:12px 16px 16px}' +
    'textarea,.email{display:block;width:100%;border:1px solid var(--line);border-radius:10px;background:#fff;color:var(--text);font:inherit;font-size:14px;outline:0;transition:border-color .15s,box-shadow .15s}' +
    'textarea{min-height:110px;max-height:240px;padding:10px 12px;resize:none;line-height:1.5}' +
    '.email{height:40px;margin-top:8px;padding:0 12px}' +
    'textarea:focus,.email:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(255,107,0,.15)}' +
    'textarea::placeholder,.email::placeholder{color:#9ca3af}' +
    '.row{display:flex;align-items:center;gap:12px;margin-top:12px}' +
    '.ctx{flex:1;display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);cursor:pointer}' +
    '.ctx input{margin:0;accent-color:var(--accent)}' +
    '.send,.done-btn{height:38px;padding:0 18px;border:0;border-radius:10px;background:var(--accent);color:#fff;font-size:14px;font-weight:600;transition:filter .15s,opacity .15s}' +
    '.send:hover:not(:disabled),.done-btn:hover{filter:brightness(.95)}' +
    '.send:disabled{opacity:.45;cursor:not-allowed}' +
    '.count{font-size:12px;color:var(--muted);margin-top:6px;text-align:right}' +
    '.count:empty{display:none}' +
    '.status{margin-top:10px;font-size:13px;color:#dc2626}' +
    '.status:empty{display:none}' +

    '.done{padding:24px 20px 20px;text-align:center}' +
    '.tick{width:48px;height:48px;margin:0 auto 12px;border-radius:50%;background:#fff1e6;color:var(--accent);display:grid;place-items:center}' +
    '.tick svg{width:24px;height:24px}' +
    '.done h3{margin:0;font-size:16px;font-weight:600;outline:0}' +
    '.done p{margin:4px 0 16px;color:var(--muted);font-size:13.5px}' +
    '.done.answered p{max-height:260px;overflow-y:auto;color:var(--text);text-align:left;white-space:pre-line;line-height:1.5}' +

    ':host([data-position=left]) .launcher,:host([data-position=left]) .panel{right:auto;left:20px}' +
    ':host([data-launcher=false]) .panel{bottom:calc(20px + env(safe-area-inset-bottom,0px))}' +
    // Phones: a bottom sheet, with 16px text so iOS doesn't zoom in.
    '@media (max-width:480px){' +
    '.panel,:host([data-position=left]) .panel{left:8px;right:8px;width:auto;max-width:none;bottom:calc(8px + env(safe-area-inset-bottom,0px))}' +
    '.launcher.open{display:none}' +
    'textarea,.email{font-size:16px}}' +
    '@media (prefers-reduced-motion:reduce){*{transition:none!important}}';

  var host = document.createElement('div');
  host.setAttribute('data-blazeresolver', '');
  host.setAttribute('data-position', attr('position') === 'left' ? 'left' : 'right');
  host.setAttribute('data-launcher', String(showLauncher));
  if (attr('accent')) host.style.setProperty('--accent', attr('accent'));
  var root = host.attachShadow({ mode: 'open' });

  root.innerHTML =
    '<style>' + CSS + '</style>' +
    '<button class="launcher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="bz-panel"><img alt="" src="' + MASCOT + '"></button>' +
    '<section class="panel" id="bz-panel" role="dialog" aria-labelledby="bz-title" hidden>' +
    '<div class="head"><img alt="" src="' + MASCOT + '"><h2 class="title" id="bz-title"></h2>' +
    '<button class="x" type="button" aria-label="Close">' + CLOSE + '</button></div>' +
    '<div class="body form">' +
    '<textarea maxlength="' + MAX_MESSAGE + '" placeholder="What went wrong?" aria-label="What went wrong?"></textarea>' +
    '<div class="count" aria-live="polite"></div>' +
    '<input class="email" type="email" inputmode="email" autocomplete="email" maxlength="200" placeholder="Your email, to hear when it\'s fixed (optional)" aria-label="Your email (optional)" hidden>' +
    '<div class="row"><label class="ctx"><input type="checkbox" checked>Include page details</label>' +
    '<button class="send" type="button" disabled>Send</button></div>' +
    '<div class="status" role="alert"></div>' +
    '</div>' +
    '<div class="done" hidden><div class="tick">' + CHECK + '</div>' +
    '<h3 tabindex="-1">Thanks, we got it</h3><p></p>' +
    '<button class="done-btn" type="button">Done</button></div>' +
    '</section>';

  var $ = function (sel) { return root.querySelector(sel); };
  var launcher = $('.launcher');
  var panel = $('.panel');
  var form = $('.form');
  var done = $('.done');
  var field = $('textarea');
  var emailInput = $('.email');
  var ctx = $('.ctx input');
  var sendBtn = $('.send');
  var count = $('.count');
  var status = $('.status');

  $('.title').textContent = title;
  launcher.setAttribute('aria-label', title);
  launcher.hidden = !showLauncher;
  emailInput.hidden = !(askEmail && !user.email);

  function saveDraft() {
    try {
      if (field.value.trim()) localStorage.setItem(DRAFT_KEY, field.value);
      else localStorage.removeItem(DRAFT_KEY);
    } catch (e) {}
  }
  try { field.value = (localStorage.getItem(DRAFT_KEY) || '').slice(0, MAX_MESSAGE); } catch (e) {}

  var sending = false;
  function refresh() {
    var len = field.value.length;
    count.textContent = len > MAX_MESSAGE - 500 ? len + ' / ' + MAX_MESSAGE : '';
    sendBtn.disabled = sending || !field.value.trim();
    sendBtn.textContent = sending ? 'Sending…' : 'Send';
  }

  function autosize() {
    field.style.height = 'auto';
    field.style.height = Math.min(field.scrollHeight + 2, 240) + 'px';
  }

  function failure(code) {
    if (code === 429) return "You've sent a few reports in a short time. Please try again in a few minutes.";
    if (code === 413 || code === 400) return "That couldn't be sent. Try shortening it a little.";
    if (navigator.onLine === false) return "You're offline. Your message is saved, so send it once you're back online.";
    return "Couldn't send just now. Your message is saved, please try again.";
  }

  function send() {
    var text = field.value.trim();
    if (!text || sending) return;
    var email = user.email;
    if (!emailInput.hidden) {
      email = emailInput.value.trim();
      if (email && !EMAIL.test(email)) {
        status.textContent = "That email address doesn't look right.";
        emailInput.focus();
        return;
      }
    }
    email = email && EMAIL.test(email) ? email.slice(0, 200) : undefined;
    var body = {
      message: text.slice(0, MAX_MESSAGE),
      pageUrl: ctx.checked ? location.href.slice(0, 2000) : undefined,
      appVersion: version ? version.slice(0, 100) : undefined,
      userId: user.id ? user.id.slice(0, 200) : undefined,
      email: email,
      consoleErrors: ctx.checked && errors.length ? errors.slice() : undefined
    };
    var headers = { 'content-type': 'application/json' };
    if (key) headers['x-blaze-key'] = key;

    sending = true;
    status.textContent = '';
    refresh();
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 25000) : 0;
    var settle = function () {
      clearTimeout(timer);
      sending = false;
      refresh();
    };
    fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: controller ? controller.signal : undefined })
      .then(function (res) {
        if (!res.ok) throw res.status;
        return res.text().then(function (text) {
          try { return JSON.parse(text).answer; } catch (e) { return undefined; }
        });
      })
      .then(
        function (answer) {
          settle();
          field.value = '';
          emailInput.value = '';
          saveDraft();
          autosize();
          // A question can come back answered from the product's docs; shown as text, never as HTML.
          var answered = typeof answer === 'string' && answer;
          done.classList.toggle('answered', !!answered);
          $('.done h3').textContent = answered ? "Here's what we found" : 'Thanks, we got it';
          $('.done p').textContent = answered
            ? answer
            : email && !emailInput.hidden ? "We'll email " + email + " when it's fixed." : "We'll look into it.";
          form.hidden = true;
          done.hidden = false;
          $('.done h3').focus();
        },
        function (code) {
          settle();
          status.textContent = failure(typeof code === 'number' ? code : 0);
        }
      );
  }

  var isOpen = false;
  var returnFocus = null;
  function open(prefill) {
    if (typeof prefill === 'string' && prefill) {
      done.hidden = true;
      form.hidden = false;
      field.value = prefill.slice(0, MAX_MESSAGE);
      saveDraft();
    }
    if (!isOpen) {
      isOpen = true;
      returnFocus = document.activeElement !== host ? document.activeElement : null;
      panel.hidden = false;
      void panel.offsetWidth;
      panel.classList.add('open');
      launcher.classList.add('open');
      launcher.setAttribute('aria-expanded', 'true');
      launcher.innerHTML = CLOSE;
    }
    autosize();
    refresh();
    setTimeout(function () { (form.hidden ? $('.done h3') : field).focus(); }, 50);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    var hadFocus = document.activeElement === host;
    panel.classList.remove('open');
    launcher.classList.remove('open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.innerHTML = '<img alt="" src="' + MASCOT + '">';
    setTimeout(function () {
      if (isOpen) return;
      panel.hidden = true;
      status.textContent = '';
      done.hidden = true;
      form.hidden = false;
    }, 160);
    if (hadFocus) {
      if (showLauncher) launcher.focus();
      else if (returnFocus && returnFocus.focus) returnFocus.focus();
    }
  }

  launcher.onclick = function () { isOpen ? close() : open(); };
  $('.x').onclick = close;
  $('.done-btn').onclick = close;
  sendBtn.onclick = send;
  field.addEventListener('input', function () {
    autosize();
    refresh();
    saveDraft();
    status.textContent = '';
  });
  field.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  });
  emailInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) {
      e.stopPropagation();
      close();
    }
  });
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('[data-blazeresolver-open]') : null;
    if (!t) return;
    e.preventDefault();
    open(t.getAttribute('data-blazeresolver-open') || '');
  });

  window.BlazeResolver = {
    version: 3,
    open: open,
    close: close,
    toggle: function () { isOpen ? close() : open(); },
    identify: function (u) {
      if (!u) return;
      if (u.id) user.id = String(u.id);
      if (u.email) {
        user.email = String(u.email);
        emailInput.hidden = true;
      }
    }
  };

  function mount() {
    document.body.appendChild(host);
    try { document.dispatchEvent(new CustomEvent('blazeresolver:ready')); } catch (e) {}
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
