/*
 * BlazeResolver support widget (Blazzy AI). Loaded from CDN or local bundle.
 *   <script src="https://cdn.jsdelivr.net/npm/blazeresolver@latest/widget/widget.js" data-endpoint="/api/blaze" data-app-version="1.4.2"></script>
 *
 * Optional attributes:
 *   data-user-id, data-user-email   who is reporting (or call BlazeResolver.identify({ id, email }))
 *   data-accent="#ff7a00"            brand color
 *   data-position="right|left"
 *   data-title="Ask Blazzy"
 *   data-ask-email="true"            ask for an email to be told about the fix
 *   data-launcher="false"            no floating button; open it from your own UI instead
 * Open it from anywhere: <a href="#" data-blazeresolver-open>Ask Blazzy</a>, or BlazeResolver.open('optional text').
 */
(function () {
  'use strict';
  if (window.BlazeResolver && window.BlazeResolver.version) return;

  var script = document.currentScript || document.querySelector('script[src*="widget.js"]');
  var attr = function (name) { return (script && script.getAttribute('data-' + name)) || ''; };
  var endpoint = attr('endpoint') || '/api/blaze';
  var version = attr('app-version');
  var user = { id: attr('user-id'), email: attr('user-email') };
  var title = attr('title') || 'Ask Blazzy';
  var showLauncher = attr('launcher') !== 'false';
  var askEmail = attr('ask-email') === 'true';

  // Limits match the handler's schema
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

  // Official Blazzy Mascot SVG
  var BLAZZY_SVG = '<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    '<circle cx="24" cy="24" r="22" fill="#FFF7ED" stroke="#FF7A00" stroke-width="2.5"/>' +
    '<path d="M12 24C12 17.3726 17.3726 12 24 12C30.6274 12 36 17.3726 36 24" stroke="#FF7A00" stroke-width="3" stroke-linecap="round"/>' +
    '<rect x="9" y="20" width="5" height="10" rx="2.5" fill="#FF7A00"/>' +
    '<rect x="34" y="20" width="5" height="10" rx="2.5" fill="#FF7A00"/>' +
    '<path d="M36 27C36 32 30 35 27 35" stroke="#FF7A00" stroke-width="2.5" stroke-linecap="round"/>' +
    '<circle cx="26" cy="35" r="2" fill="#FF7A00"/>' +
    '<circle cx="19" cy="23" r="2.5" fill="#EA580C"/>' +
    '<circle cx="29" cy="23" r="2.5" fill="#EA580C"/>' +
    '<circle cx="20" cy="22" r="0.8" fill="#FFFFFF"/>' +
    '<circle cx="30" cy="22" r="0.8" fill="#FFFFFF"/>' +
    '<path d="M19 28C20.5 30.5 27.5 30.5 29 28" stroke="#EA580C" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  var icon = function (path) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>';
  };
  var CLOSE = icon('<path d="M18 6 6 18M6 6l12 12"/>');
  var CHECK = icon('<path d="M20 6 9 17l-5-5"/>');

  var CSS =
    ':host{all:initial;--accent:#ff7a00;--accent-hover:#e66e00;--bg:#ffffff;--text:#111827;--muted:#6b7280;--line:#e5e7eb;' +
    'font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;color-scheme:light}' +
    '*{box-sizing:border-box}[hidden]{display:none!important}' +
    'button{font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent}' +
    'button:focus-visible,input:focus-visible,textarea:focus-visible{outline:2px solid var(--accent);outline-offset:2px}' +
    'svg{display:block}' +

    '.launcher{position:fixed;right:20px;bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:2147483646;width:58px;height:58px;padding:0;' +
    'border-radius:50%;border:2px solid var(--accent);background:#fff7ed;color:var(--text);display:grid;place-items:center;' +
    'box-shadow:0 6px 20px rgba(0,0,0,.15);transition:transform .2s cubic-bezier(0.16,1,0.3,1),box-shadow .2s ease}' +
    '.launcher:hover{transform:scale(1.08) translateY(-2px);box-shadow:0 8px 26px rgba(0,0,0,.18)}' +
    '.launcher svg{width:40px;height:40px}' +
    '.launcher.open{background:#fff;border-color:var(--line)}' +
    '.launcher.open svg{width:24px;height:24px;color:var(--accent)}' +

    '.panel{position:fixed;right:20px;bottom:calc(90px + env(safe-area-inset-bottom,0px));z-index:2147483647;width:370px;max-width:calc(100vw - 32px);' +
    'max-height:calc(100vh - 120px);overflow-y:auto;background:#fff;color:var(--text);border:1px solid var(--line);border-radius:20px;' +
    'box-shadow:0 16px 48px rgba(0,0,0,.14),0 2px 8px rgba(0,0,0,.06);font-size:14px;line-height:1.5;' +
    'opacity:0;transform:translateY(10px) scale(0.98);transition:opacity .18s ease,transform .18s ease}' +
    '.panel.open{opacity:1;transform:none}' +
    '.head{display:flex;align-items:center;gap:10px;padding:14px 14px 12px 16px;border-bottom:1px solid var(--line);background:#fff7ed}' +
    '.head svg{width:32px;height:32px;flex:none}' +
    '.title-wrap{flex:1;min-width:0}' +
    '.title{margin:0;font-size:15px;font-weight:700;color:#111827;display:flex;align-items:center;gap:6px}' +
    '.badge{background:#ea580c;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:10px;text-transform:uppercase;letter-spacing:0.5px}' +
    '.subtitle{margin:2px 0 0;font-size:11.5px;color:var(--muted)}' +
    '.x{width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:var(--muted);display:grid;place-items:center;transition:background .15s}' +
    '.x:hover{background:#f3f4f6;color:var(--text)}' +
    '.x svg{width:18px;height:18px}' +
    '.body{padding:14px 16px 16px}' +
    'textarea,.email{display:block;width:100%;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--text);font:inherit;font-size:14px;outline:0;transition:border-color .15s,box-shadow .15s}' +
    'textarea{min-height:115px;max-height:240px;padding:12px 14px;resize:none;line-height:1.5}' +
    '.email{height:42px;margin-top:10px;padding:0 14px}' +
    'textarea:focus,.email:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(255,122,0,.15)}' +
    'textarea::placeholder,.email::placeholder{color:#9ca3af}' +
    '.row{display:flex;align-items:center;gap:12px;margin-top:14px}' +
    '.ctx{flex:1;display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);cursor:pointer}' +
    '.ctx input{margin:0;accent-color:var(--accent)}' +
    '.send,.done-btn{height:40px;padding:0 20px;border:0;border-radius:12px;background:var(--accent);color:#fff;font-size:14px;font-weight:700;transition:background .15s,opacity .15s;cursor:pointer}' +
    '.send:hover:not(:disabled),.done-btn:hover{background:var(--accent-hover)}' +
    '.send:disabled{opacity:.45;cursor:not-allowed}' +
    '.count{font-size:12px;color:var(--muted);margin-top:6px;text-align:right}' +
    '.count:empty{display:none}' +
    '.status{margin-top:10px;font-size:13px;color:#dc2626}' +
    '.status:empty{display:none}' +

    '.done{padding:28px 20px 24px;text-align:center}' +
    '.tick{width:52px;height:52px;margin:0 auto 12px;border-radius:50%;background:#fff7ed;color:var(--accent);display:grid;place-items:center}' +
    '.tick svg{width:26px;height:26px}' +
    '.done h3{margin:0;font-size:16px;font-weight:700;outline:0}' +
    '.done p{margin:6px 0 18px;color:var(--muted);font-size:13.5px}' +
    '.done.answered p{max-height:260px;overflow-y:auto;color:var(--text);text-align:left;white-space:pre-line;line-height:1.5}' +

    ':host([data-position=left]) .launcher,:host([data-position=left]) .panel{right:auto;left:20px}' +
    ':host([data-launcher=false]) .panel{bottom:calc(20px + env(safe-area-inset-bottom,0px))}' +
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
    '<button class="launcher" type="button" aria-haspopup="dialog" aria-expanded="false" aria-controls="bz-panel">' + BLAZZY_SVG + '</button>' +
    '<section class="panel" id="bz-panel" role="dialog" aria-labelledby="bz-title" hidden>' +
    '<div class="head">' + BLAZZY_SVG + '<div class="title-wrap"><h2 class="title" id="bz-title"><span class="title-text"></span><span class="badge">Live</span></h2><p class="subtitle">AI Resolution & Support</p></div>' +
    '<button class="x" type="button" aria-label="Close">' + CLOSE + '</button></div>' +
    '<div class="body form">' +
    '<textarea maxlength="' + MAX_MESSAGE + '" placeholder="Describe what happened or ask a question..." aria-label="Describe what happened or ask a question"></textarea>' +
    '<div class="count" aria-live="polite"></div>' +
    '<input class="email" type="email" inputmode="email" autocomplete="email" maxlength="200" placeholder="Your email, to hear when it\'s resolved (optional)" aria-label="Your email (optional)" hidden>' +
    '<div class="row"><label class="ctx"><input type="checkbox" checked>Include page details</label>' +
    '<button class="send" type="button" disabled>Send to Blazzy</button></div>' +
    '<div class="status" role="alert"></div>' +
    '</div>' +
    '<div class="done" hidden><div class="tick">' + CHECK + '</div>' +
    '<h3 tabindex="-1">Thanks, Blazzy got it!</h3><p></p>' +
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

  $('.title-text').textContent = title;
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
    sendBtn.textContent = sending ? 'Sending…' : 'Send to Blazzy';
  }

  function autosize() {
    field.style.height = 'auto';
    field.style.height = Math.min(field.scrollHeight + 2, 240) + 'px';
  }

  function failure(code) {
    if (code === 429) return "You've sent a few messages recently. Please try again in a moment.";
    if (code === 413 || code === 400) return "That message was too long. Try shortening it a little.";
    if (navigator.onLine === false) return "You're offline. Your message is saved, send once reconnected.";
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
        return res.text().then(function (t) {
          try { return JSON.parse(t).answer; } catch (e) { return undefined; }
        });
      })
      .then(
        function (answer) {
          settle();
          field.value = '';
          emailInput.value = '';
          saveDraft();
          autosize();
          var answered = typeof answer === 'string' && answer;
          done.classList.toggle('answered', !!answered);
          $('.done h3').textContent = answered ? "Here's what Blazzy found" : 'Thanks, Blazzy got it!';
          $('.done p').textContent = answered
            ? answer
            : email && !emailInput.hidden ? "We'll email " + email + " when it's resolved." : "Blazzy is looking into it.";
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
    launcher.innerHTML = BLAZZY_SVG;
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
