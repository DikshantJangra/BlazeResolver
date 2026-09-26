/**
 * Tells a customer their bug is fixed, through Resend (RESEND_API_KEY + BLAZE_FROM_EMAIL).
 * Without them this does nothing, so notification is opt-in.
 */
export async function sendFixedEmail(to: string, title: string, f: typeof fetch = fetch): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.BLAZE_FROM_EMAIL;
  if (!key || !from) return false;
  const res = await f('https://api.resend.com/emails', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from,
      to,
      subject: 'The problem you reported is fixed',
      text: `Good news: we fixed the problem you reported (${title}). Thank you for telling us.`
    }),
    signal: AbortSignal.timeout(15_000)
  });
  return res.ok;
}
