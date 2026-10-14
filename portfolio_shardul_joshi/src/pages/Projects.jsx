import './Projects.css';
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { FiArrowUpRight, FiChevronDown } from 'react-icons/fi';
import { FEATURED, GITHUB_USER } from '../data/featuredProjects';

// Lazy-loaded so the three.js code for the orbit map only downloads on this page.
const OrbitMap = lazy(() => import('../components/Orbit/OrbitMap'));

/* ---------- GitHub ---------- */
// per_page=100 so every repository comes back in one call (the default is 30).
const API = `https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=100`;
// GitHub allows 60 anonymous calls per hour per address, so the list is kept
// for an hour in sessionStorage — reloads don't burn the quota.
const CACHE_KEY = 'projects:github-repos:v1';
const CACHE_TTL_MS = 60 * 60 * 1000;

// Some descriptions start with an emoji; a monochrome site doesn't want it.
const cleanDescription = (s) =>
  (s || '').replace(/^[\p{Extended_Pictographic}️‍\s]+/u, '').trim();

const formatMonth = (iso) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

// Keep only real, own, live repositories — newest push first.
function tidy(list) {
  return list
    .filter((r) => !r.fork && !r.archived && r.name !== GITHUB_USER)
    .map((r) => ({
      name: r.name,
      description: cleanDescription(r.description),
      language: r.language,
      stars: r.stargazers_count,
      pushed_at: r.pushed_at,
      html_url: r.html_url,
    }))
    .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { at, repos } = JSON.parse(raw);
    return Date.now() - at < CACHE_TTL_MS ? repos : null;
  } catch {
    return null;
  }
}

function writeCache(repos) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repos }));
  } catch {
    // storage unavailable (private mode etc.) — the page still works, just refetches
  }
}

// true/false for a CSS media query, kept up to date.
function useMatchMedia(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export default function Projects() {
  // { repos, status: 'loading' | 'ready' | 'error', error, source: 'cache' | 'live' }
  const [data, setData] = useState(() => {
    const cached = readCache();
    return cached
      ? { repos: cached, status: 'ready', error: null, source: 'cache' }
      : { repos: [], status: 'loading', error: null, source: 'live' };
  });
  const [active, setActive] = useState('All');     // language filter
  const [open, setOpen] = useState(false);         // "all repositories" unfolded?
  const [chipHover, setChipHover] = useState(null); // chip under the cursor → lights its ring
  const [cardHover, setCardHover] = useState(null); // card under the cursor → lights its dot
  const [dotHover, setDotHover] = useState(null);   // dot under the cursor → lights its card
  const showOrbit = useMatchMedia('(min-width: 480px)');

  useEffect(() => {
    if (data.status !== 'loading') return undefined;
    const ctrl = new AbortController();
    fetch(API, { signal: ctrl.signal, headers: { Accept: 'application/vnd.github+json' } })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 403 ? 'rate limit reached' : `http ${res.status}`);
        return res.json();
      })
      .then((list) => {
        const repos = tidy(list);
        writeCache(repos);
        setData({ repos, status: 'ready', error: null, source: 'live' });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setData({ repos: [], status: 'error', error: err.message, source: 'live' });
      });
    return () => ctrl.abort();
  }, [data.status]);

  const { repos, status, error, source } = data;

  const counts = useMemo(() => {
    const c = {};
    repos.forEach((r) => { if (r.language) c[r.language] = (c[r.language] || 0) + 1; });
    return c;
  }, [repos]);
  const langs = useMemo(
    () => Object.keys(counts).sort((a, b) => counts[b] - counts[a]),
    [counts]
  );

  const shown = active === 'All' ? repos : repos.filter((r) => r.language === active);
  const highlightLang = chipHover ?? (active === 'All' ? null : active);
  const lastPush = repos[0] ? formatMonth(repos[0].pushed_at) : '—';

  // True things about this page, spoken by the beacon in the orbit map
  // ([grey key, orange value]) — one per strike, dealt from a shuffled deck.
  const facts = useMemo(() => [
    ['github · ', source === 'cache' ? 'cached · fresh' : '200 OK'],
    ['repos · ', `${repos.length} synced`],
    ['langs · ', `${langs.length} indexed`],
    ['last push · ', lastPush.toLowerCase()],
    ['orbit · ', `${repos.length} bodies`],
    ['selected · ', `${FEATURED.length} featured`],
    ['forks · ', 'filtered out'],
  ], [source, repos.length, langs.length, lastPush]);

  // Picking a language also unfolds the list, so the click has somewhere to land.
  const pickLang = (lang) => {
    setActive(lang);
    if (lang !== 'All') setOpen(true);
  };

  return (
    <section className="projects" id="projects">
      <header className="projects__head">
        <div className="projects__intro">
          <p className="projects__greeting">
            <span className="projects__prompt">~$</span> ls ~/projects
          </p>
          <h1 className="projects__title">Projects</h1>
          <p className="projects__sub">
            A few pieces I'd point you to first, then everything public on my GitHub, newest first.
          </p>
          <p className="projects__count" aria-live="polite">
            {status === 'loading' && 'fetching repositories from github…'}
            {status === 'error' && `// github didn't answer (${error}) — the full list will be back in a minute`}
            {status === 'ready' && `${FEATURED.length} selected · ${repos.length} repositories · ${langs.length} languages`}
          </p>

          {status === 'ready' && (
            <div className="projects__chips" role="group" aria-label="Filter by language">
              {['All', ...langs].map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={`projects__chip ${active === lang ? 'projects__chip--on' : ''}`}
                  aria-pressed={active === lang}
                  onClick={() => pickLang(lang)}
                  onMouseEnter={() => setChipHover(lang === 'All' ? null : lang)}
                  onMouseLeave={() => setChipHover(null)}
                >
                  {lang}
                  <small>{lang === 'All' ? repos.length : counts[lang]}</small>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The orbit map: the same data as the chips, drawn as rings and dots.
            Not shown on phones (nothing to hover, no room). */}
        {showOrbit && status === 'ready' && (
          <Suspense fallback={<div className="orbit orbit--placeholder" aria-hidden="true" />}>
            <OrbitMap
              key={repos.length}
              repos={repos}
              langs={langs}
              facts={facts}
              highlightLang={highlightLang}
              highlightRepo={cardHover}
              onHoverRepo={setDotHover}
            />
          </Suspense>
        )}
      </header>

      <div className="projects__rule" />

      {/* ==================== SELECTED WORK ==================== */}
      <div className="projects__sec">
        <span className="projects__sec-title">Selected work</span>
        <span className="projects__sec-note">// hand-picked</span>
      </div>
      <div className="projects__featured">
        {FEATURED.map((p, i) => (
          <article key={p.repo} className="projects__fcard">
            <span className="projects__fidx">{String(i + 1).padStart(2, '0')}</span>
            <h2 className="projects__ftitle">{p.title}</h2>
            <span className="projects__frepo">{p.repo}</span>
            <p className="projects__fdesc">{p.description}</p>
            <ul className="projects__tags">
              {p.tags.map((t) => <li key={t} className="projects__tag">{t}</li>)}
            </ul>
            <div className="projects__flinks">
              <a
                className="projects__flink"
                href={`https://github.com/${GITHUB_USER}/${p.repo}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Repository <FiArrowUpRight aria-hidden="true" />
              </a>
              {p.live && (
                <a className="projects__flink" href={p.live} target="_blank" rel="noopener noreferrer">
                  Live <FiArrowUpRight aria-hidden="true" />
                </a>
              )}
            </div>
          </article>
        ))}
      </div>

      {/* ==================== ALL REPOSITORIES (folded) ==================== */}
      {status === 'ready' && (
        <>
          <div className="projects__allbar">
            <button
              type="button"
              className={`projects__allbtn ${open ? 'projects__allbtn--open' : ''}`}
              aria-expanded={open}
              aria-controls="projects-all"
              onClick={() => setOpen((o) => !o)}
            >
              <span>{open ? 'Collapse' : `List all ${repos.length} repositories`}</span>
              <FiChevronDown aria-hidden="true" />
            </button>
          </div>

          <div id="projects-all" className={`projects__all ${open ? 'projects__all--open' : ''}`}>
            <div className="projects__all-inner" inert={!open}>
              <div className="projects__all-pad">
                <div className="projects__sec">
                  <span className="projects__sec-title">All repositories</span>
                  <span className="projects__sec-note">
                    {`// ${active === 'All' ? 'live from github' : active.toLowerCase()} · ${shown.length} repos · last push ${lastPush}`}
                  </span>
                </div>
                <div className="projects__grid">
                  {shown.map((r, i) => (
                    <a
                      key={r.name}
                      className={`projects__card ${dotHover === r.name ? 'projects__card--lit' : ''}`}
                      style={{ animationDelay: `${Math.min(i, 24) * 22}ms` }}
                      href={r.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onMouseEnter={() => setCardHover(r.name)}
                      onMouseLeave={() => setCardHover(null)}
                    >
                      <span className="projects__cidx">{String(i + 1).padStart(2, '0')}</span>
                      <span className="projects__cname">{r.name}</span>
                      <FiArrowUpRight className="projects__carrow" aria-hidden="true" />
                      {r.description
                        ? <p className="projects__cdesc">{r.description}</p>
                        : <p className="projects__cdesc projects__cdesc--none">// no description yet</p>}
                      <span className="projects__cmeta">
                        <span className="projects__clang">{r.language || '—'}</span>
                        {r.stars > 0 && <span>★ {r.stars}</span>}
                        <span className="projects__cdate">{formatMonth(r.pushed_at)}</span>
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
