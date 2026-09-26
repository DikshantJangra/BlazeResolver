/*
 * BlazeResolver support widget. Served by the BlazeResolver server, so updating the server updates every install.
 *   <script src="https://YOUR-SERVER/widget.js" data-key="blz_..." data-app-version="1.4.2"></script>
 * No frontend framework? No problem. Building your own UI? POST to /api/report with the x-blaze-key header instead.
 */
(function () {
  var s = document.currentScript;
  var server = new URL(s.src).origin;
  var key = s.getAttribute('data-key');
  var version = s.getAttribute('data-app-version') || undefined;
  var userId = s.getAttribute('data-user-id') || undefined;
  var email = s.getAttribute('data-user-email') || undefined;
  var errors = [];
  window.addEventListener('error', function (e) {
    errors.push(String(e.message) + (e.filename ? ' at ' + e.filename + ':' + e.lineno : ''));
    if (errors.length > 20) errors.shift();
  });

  var host = document.createElement('div');
  var root = host.attachShadow({ mode: 'open' });
  root.innerHTML =
    '<style>' +
    ':host{all:initial;font-family:system-ui,sans-serif}' +
    '.b{position:fixed;right:20px;bottom:20px;z-index:2147483647;background:#f97316;color:#fff;border:0;border-radius:999px;padding:12px 18px;font:600 14px system-ui;cursor:pointer;box-shadow:0 4px 16px #0004}' +
    '.p{position:fixed;right:20px;bottom:76px;z-index:2147483647;width:320px;background:#fff;color:#111;border-radius:12px;padding:16px;box-shadow:0 8px 32px #0004;display:none}' +
    '.p.o{display:block}textarea{width:100%;height:96px;box-sizing:border-box;margin:8px 0;padding:8px;font:14px system-ui;border:1px solid #ccc;border-radius:8px}' +
    '.p button{background:#111;color:#fff;border:0;border-radius:8px;padding:8px 14px;font:600 14px system-ui;cursor:pointer}' +
    '</style><button class="b">Report a problem</button>' +
    '<div class="p"><b>What went wrong?</b><textarea placeholder="Tell us what happened"></textarea>' +
    '<button class="s">Send</button> <span class="m"></span></div>';
  var panel = root.querySelector('.p');
  var msg = root.querySelector('.m');
  root.querySelector('.b').onclick = function () { panel.classList.toggle('o'); };
  root.querySelector('.s').onclick = function () {
    var box = root.querySelector('textarea');
    if (!box.value.trim()) return;
    msg.textContent = 'Sending...';
    fetch(server + '/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-blaze-key': key },
      body: JSON.stringify({ message: box.value, pageUrl: location.href, appVersion: version, userId: userId, email: email, consoleErrors: errors })
    }).then(function (r) {
      if (!r.ok) throw new Error(r.status);
      box.value = '';
      msg.textContent = 'Thanks, we are on it.';
    }).catch(function () { msg.textContent = 'Could not send. Try again.'; });
  };
  document.body.appendChild(host);
})();
