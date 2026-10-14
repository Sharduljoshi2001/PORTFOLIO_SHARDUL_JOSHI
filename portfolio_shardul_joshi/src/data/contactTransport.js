import { PROFILE } from './profile';

/* ============================================================
   How a message leaves the Contact page.

   Three ways, picked in this order:

   1. FORMSPREE_ENDPOINT — if set, the page POSTs there. (Formspree needs an
      account; its domain also fails to resolve on some Indian ISPs, so it is
      OFF by default.)
   2. FORMSUBMIT_TO — if set, the page POSTs to formsubmit.co, which forwards
      the message to that inbox. No account. The very first message triggers
      a one-time activation email to that inbox; click the link once and every
      later message is delivered. Free.
   3. mailto — the visitor's own mail app opens with the message filled in.
      Used only if both of the above are empty.
   ============================================================ */

export const FORMSPREE_ENDPOINT = '';            // e.g. 'https://formspree.io/f/abcdwxyz'
export const FORMSUBMIT_TO = PROFILE.email;      // '' to switch FormSubmit off

export const TRANSPORT = FORMSPREE_ENDPOINT ? 'formspree' : FORMSUBMIT_TO ? 'formsubmit' : 'mailto';

// True for the services that deliver straight to your inbox.
export const DELIVERS_TO_INBOX = TRANSPORT !== 'mailto';

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`http ${res.status}`);
  return res.json().catch(() => ({}));
}

export async function sendMessage({ name, email, message }) {
  const n = name.trim(), e = email.trim(), m = message.trim();

  if (TRANSPORT === 'formspree') {
    await post(FORMSPREE_ENDPOINT, { name: n, email: e, message: m, _subject: `Portfolio message from ${n}`, _replyto: e });
    return 'formspree';
  }

  if (TRANSPORT === 'formsubmit') {
    await post(`https://formsubmit.co/ajax/${FORMSUBMIT_TO}`, {
      name: n,
      email: e,
      message: m,
      _subject: `Portfolio message from ${n}`,   // the subject line in your inbox
      _replyto: e,                               // "Reply" in your mail app goes to the visitor
      _template: 'table',                        // tidy layout in the email
    });
    return 'formsubmit';
  }

  const subject = encodeURIComponent(`Hello from ${n}`);
  const body = encodeURIComponent(`${m}\n\n— ${n} (${e})`);
  window.location.href = `mailto:${PROFILE.email}?subject=${subject}&body=${body}`;
  return 'mailto';
}
