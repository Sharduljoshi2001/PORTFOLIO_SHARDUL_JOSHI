import './Hero.css';
import { lazy, Suspense } from 'react';
import { FiGithub, FiLinkedin, FiMail, FiDownload } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import profilePhoto from '../../assets/images/photoFront.jpg';

// Lazy-loaded so the three.js bundle only downloads on the home page.
const CloudBackground = lazy(() => import('../Cloud/CloudBackground'));

// DevOps / backend first, frontend last — the order tells the story.
const BADGES = [
  'AWS',
  'Docker',
  'Kubernetes',
  'Linux & Nginx',
  'CI/CD',
  'Grafana',
  'PostgreSQL',
  'MongoDB',
  'Node.js',
  'React',
];

// Tiny mono labels that sit on the hairline frame around the hero
// (top-left, top-right, bottom-left, bottom-right). Plain facts only.
const YEAR = new Date().getFullYear();
const CORNER_LABELS = {
  tl: '~/about',
  tr: 'ist · utc+5:30',
  bl: `© ${YEAR} · shardul joshi`,
  br: 'react · vite · three.js',
};

export default function Hero() {
  return (
    <section className="hero" id="hero">
      {/* Hairline frame: corner ticks + labels. Decoration only, hidden on phones. */}
      <div className="hero__frame" aria-hidden="true">
        <span className="hero__tick hero__tick--tl" />
        <span className="hero__tick hero__tick--tr" />
        <span className="hero__tick hero__tick--bl" />
        <span className="hero__tick hero__tick--br" />
        <span className="hero__corner hero__corner--tl">{CORNER_LABELS.tl}</span>
        <span className="hero__corner hero__corner--tr">{CORNER_LABELS.tr}</span>
        <span className="hero__corner hero__corner--bl">{CORNER_LABELS.bl}</span>
        <span className="hero__corner hero__corner--br">{CORNER_LABELS.br}</span>
      </div>

      {/* The cloud beacon floats in front of everything, click-through
          (null fallback = nothing shows while it loads) */}
      <div className="hero__cloud" aria-hidden="true">
        <Suspense fallback={null}>
          <CloudBackground />
        </Suspense>
      </div>

      <div className="hero__inner">
        {/* Photo + socials. On wide screens this is the left column; on
            smaller screens the wrapper dissolves (CSS display: contents) so
            the socials can drop to the bottom of the centred stack. */}
        <div className="hero__aside">
          <div className="hero__photo-wrap">
            <img
              src={profilePhoto}
              alt="Shardul Joshi"
              className="hero__photo"
            />
          </div>

          <div className="hero__socials">
            <a
              href="https://github.com/Sharduljoshi2001"
              className="hero__social"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
            >
              <FiGithub />
            </a>
            <a
              href="https://www.linkedin.com/in/shardul-joshi-558137222/"
              className="hero__social"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
            >
              <FiLinkedin />
            </a>
            <a
              href="mailto:sharduljoshi2001@gmail.com"
              className="hero__social"
              aria-label="Email"
            >
              <FiMail />
            </a>
          </div>
        </div>

        <div className="hero__main">
          {/* Terminal-style greeting: `whoami` → the name below is the answer */}
          <p className="hero__greeting">
            <span className="hero__greeting-prompt">~$</span> whoami
          </p>

          <h1 className="hero__title">Shardul Joshi</h1>

          {/* Role line sits on a hairline rule (see .hero__role-wrap) */}
          <div className="hero__role-wrap">
            <p className="hero__role">Cloud &amp; DevOps Engineer · Backend Architect</p>
          </div>

          <p className="hero__bio">
            I design, ship, and run the cloud infrastructure and backends that keep
            products alive — AWS, Docker, CI/CD, databases. I reach for the frontend
            when the problem calls for it.
          </p>

          <ul className="hero__badges">
            {BADGES.map((badge) => (
              <li key={badge} className="hero__badge">{badge}</li>
            ))}
          </ul>

          <div className="hero__actions">
            <Link to="/contact" className="hero__cta">Let's Connect</Link>
            <a
              href="/ATS_Shardul.pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="hero__cta hero__cta--ghost"
            >
              <FiDownload aria-hidden="true" /> Résumé
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
