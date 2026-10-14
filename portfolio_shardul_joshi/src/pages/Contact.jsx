import './Contact.css';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { FiArrowRight, FiDownload, FiGithub, FiLinkedin, FiMail } from 'react-icons/fi';
import { PROFILE } from '../data/profile';
import { sendMessage, TRANSPORT, DELIVERS_TO_INBOX } from '../data/contactTransport';
import { prefersReducedMotion } from '../components/Flow/stageMath';

// Lazy-loaded so the three.js code only downloads on this page.
const FlowField = lazy(() => import('../components/Flow/FlowField'));
const FormBeacon = lazy(() => import('../components/Flow/FormBeacon'));

/* ---------- the words (edit freely) ---------- */
const COPY = {
  greeting: 'ping shardul',
  title: "Let's connect",
  intro: 'Infrastructure to run, a backend to build, or a question about how something on this site was made — my inbox is open.',
  fine: 'no newsletters · no tracking · just a reply',
  replyPromise: 'usually within a day',
};

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY = { name: '', email: '', message: '' };
const FIELDS = Object.keys(EMPTY);
const fieldDone = (key, value) => (key === 'email' ? EMAIL_OK.test(value.trim()) : value.trim().length > 0);
const countDone = (values) => FIELDS.filter((k) => fieldDone(k, values[k])).length;

export default function Contact() {
  const [values, setValues] = useState(EMPTY);
  const [typed, setTyped] = useState(() => (prefersReducedMotion() ? COPY.greeting : ''));
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState(false);
  const [sent, setSent] = useState(null);       // { first, email, via } once delivered
  const [status, setStatus] = useState(null);   // { key, val } for the corner line

  const flowRef = useRef(null);
  const beaconRef = useRef(null);
  const cardRef = useRef(null);
  const formRef = useRef(null);
  const sealRef = useRef(null);
  const sentAnchorRef = useRef(null);
  const anchorRef = useRef(null);               // the element the beacon sits on right now
  const timers = useRef([]);

  const canTilt = useMemo(() => window.matchMedia('(hover: hover)').matches && !prefersReducedMotion(), []);
  const done = countDone(values);
  const total = FIELDS.length;

  // The greeting types itself.
  useEffect(() => {
    if (prefersReducedMotion()) return undefined;
    const t = timers.current;
    let i = 0;
    const start = setTimeout(() => {
      const tick = setInterval(() => {
        i += 1;
        setTyped(COPY.greeting.slice(0, i));
        if (i >= COPY.greeting.length) clearInterval(tick);
      }, 55);
      t.push(tick);
    }, 420);
    t.push(start);
    return () => { t.forEach((id) => { clearTimeout(id); clearInterval(id); }); t.length = 0; };
  }, []);

  // Where the beacon should sit: the card's corner seal, or the centre of the "received" card.
  useEffect(() => {
    anchorRef.current = sent ? sentAnchorRef.current : sealRef.current;
  }, [sent]);

  /* ---------- the field answers the form ---------- */
  const onFocus = (e) => {
    if (!e.target.matches('input, textarea')) return;
    if (flowRef.current) flowRef.current.setFocus(e.target);
    if (beaconRef.current) beaconRef.current.wake();
  };
  const onBlur = () => { if (flowRef.current) flowRef.current.setFocus(null); };
  const onChange = (e) => {
    const { name, value } = e.target;
    const next = { ...values, [name]: value };
    setValues(next);
    if (flowRef.current) flowRef.current.ripple(e.target);
    const d = countDone(next);
    if (beaconRef.current) {
      if (d > 0) beaconRef.current.wake();
      beaconRef.current.charge(d / total);
    }
  };

  /* ---------- the card answers the cursor ---------- */
  const onCardEnter = () => { if (beaconRef.current) beaconRef.current.wake(); };
  const onCardMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const b = card.getBoundingClientRect();
    const px = (e.clientX - b.left) / b.width;
    const py = (e.clientY - b.top) / b.height;
    card.style.setProperty('--mx', `${px * 100}%`);
    card.style.setProperty('--my', `${py * 100}%`);
    if (canTilt) {
      card.style.setProperty('--ry', `${(px - 0.5) * 5}deg`);
      card.style.setProperty('--rx', `${(0.5 - py) * 4}deg`);
    }
  };
  const onCardLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
  };

  /* ---------- Send ---------- */
  const onSubmit = (e) => {
    e.preventDefault();
    if (sending || sent) return;
    if (done < total) { if (formRef.current) formRef.current.reportValidity(); return; }
    setSending(true);
    setStatus({ key: 'signal · ', val: 'in flight' });
    const snapshot = { ...values };
    const t = timers.current;

    const arrive = () => {
      setFlash(true);
      t.push(setTimeout(() => setFlash(false), 700));
      if (beaconRef.current) beaconRef.current.strike();
      t.push(setTimeout(async () => {
        setStatus({ key: 'message · ', val: 'received' });
        setSent({ first: snapshot.name.trim().split(' ')[0], email: snapshot.email.trim(), via: TRANSPORT });
        try {
          await sendMessage(snapshot);
        } catch {
          setStatus({ key: 'delivery · ', val: 'failed — please email me directly' });
        }
      }, 420));
    };

    if (flowRef.current && !prefersReducedMotion()) flowRef.current.send(cardRef.current, arrive);
    else arrive();
  };

  const onAgain = () => {
    if (beaconRef.current) beaconRef.current.sleep();
    setValues(EMPTY);
    setSent(null);
    setSending(false);
    setStatus(null);
  };

  return (
    <section className="contact" id="contact">
      {/* the wind map (behind) and the beacon (above the glass) */}
      <Suspense fallback={null}>
        <FlowField ref={flowRef} />
        <FormBeacon ref={beaconRef} anchorRef={anchorRef} />
      </Suspense>

      <span className="contact__corner contact__corner--tl">~/contact</span>
      <span className="contact__corner contact__corner--tr">{PROFILE.timezone}</span>
      <span className={`contact__status ${status ? 'contact__status--on' : ''}`} aria-live="polite">
        {status && (<><span>{status.key}</span><em>{status.val}</em></>)}
      </span>

      <div className="contact__content">
        <div className="contact__words">
          <p className="contact__greeting">
            <span className="contact__prompt">~$</span> {typed}
            <span className="contact__caret" aria-hidden="true" />
          </p>
          <h1 className="contact__title">{COPY.title}</h1>
          <p className="contact__intro">{COPY.intro}</p>
        </div>

        <div className="contact__cardwrap">
          <div
            ref={cardRef}
            className={`contact__card ${flash ? 'contact__card--flash' : ''} ${sent ? 'contact__card--received' : ''}`}
            onPointerEnter={onCardEnter}
            onPointerMove={onCardMove}
            onPointerLeave={onCardLeave}
          >
            <span className="contact__progress" style={{ '--p': `${(done / total) * 100}%` }} aria-hidden="true" />

            {!sent && (
              <>
                <div className="contact__head">
                  <span className="contact__head-title">New message</span>
                  <span className="contact__head-meta">{done} / {total}</span>
                </div>
                <span ref={sealRef} className="contact__seal" aria-hidden="true" />

                <form ref={formRef} className="contact__form" onSubmit={onSubmit} onFocus={onFocus} onBlur={onBlur} noValidate>
                  <div className="contact__row">
                    <div className="contact__field">
                      <label htmlFor="contact-name">Name</label>
                      <input id="contact-name" name="name" value={values.name} onChange={onChange} placeholder="Your name" autoComplete="name" required />
                    </div>
                    <div className="contact__field">
                      <label htmlFor="contact-email">Email</label>
                      <input id="contact-email" name="email" type="email" value={values.email} onChange={onChange} placeholder="you@company.com" autoComplete="email" required />
                    </div>
                  </div>
                  <div className="contact__field">
                    <label htmlFor="contact-message">Message</label>
                    <textarea id="contact-message" name="message" value={values.message} onChange={onChange} placeholder="What are you building?" required />
                  </div>
                  <div className="contact__actions">
                    <span className="contact__fine">{COPY.fine}</span>
                    <button className="contact__send" type="submit" disabled={sending}>
                      <span>{sending ? 'Sending…' : 'Send message'}</span>
                      <FiArrowRight aria-hidden="true" />
                    </button>
                  </div>
                </form>
              </>
            )}

            {sent && (
              <div className="contact__sent">
                <span ref={sentAnchorRef} className="contact__sent-anchor" aria-hidden="true" />
                <p className="contact__sent-status"><span>message · </span><em>received</em></p>
                <h2 className="contact__sent-title">Got it, {sent.first}.</h2>
                {!DELIVERS_TO_INBOX ? (
                  <p className="contact__sent-text">
                    Your mail app should have opened with the message ready — just press send there.
                    If it didn't, write to <a className="contact__mono" href={`mailto:${PROFILE.email}`}>{PROFILE.email}</a>.
                  </p>
                ) : (
                  <p className="contact__sent-text">
                    I'll reply to <span className="contact__mono">{sent.email}</span> — {COPY.replyPromise}.
                  </p>
                )}
                <button className="contact__again" type="button" onClick={onAgain}>Send another</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="contact__channels">
        <a href={`mailto:${PROFILE.email}`}><FiMail aria-hidden="true" /> email</a>
        <a href={PROFILE.github} target="_blank" rel="noopener noreferrer"><FiGithub aria-hidden="true" /> github</a>
        <a href={PROFILE.linkedin} target="_blank" rel="noopener noreferrer"><FiLinkedin aria-hidden="true" /> linkedin</a>
        <a href={PROFILE.resume} target="_blank" rel="noopener noreferrer"><FiDownload aria-hidden="true" /> résumé</a>
      </div>
    </section>
  );
}
