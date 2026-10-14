# Shardul Joshi — Portfolio

A black-and-white personal site for a cloud / DevOps engineer and backend architect. Three pages: a split hero built around a terminal prompt and an orange cloud-lightning beacon, a projects page where every GitHub repository drifts on a tilted language ring, and a contact page where a wind field sweeps across the stage behind a frosted form card.

> Not yet deployed. Live URL goes here when it is.

## Stack

- React 19 and Vite 7
- `react-router-dom` 7 for the three routes
- `react-icons` (Feather) for the glyphs
- `three` + `@react-three/fiber` for the hero beacon, the projects orbit map, and the contact wind map
- A nine-step grayscale token system with a single orange accent (`#F38020`), used only by the cloud-lightning beacon
- No UI library, no CSS framework. Fonts come straight from Google Fonts in `index.html`.

## Local setup

1. Clone the repository.
2. From the `portfolio_shardul_joshi/` folder, run `npm install`.
3. Run `npm run dev`. Dev server at `http://localhost:5173`.

Vite's file watcher is set to polling in `vite.config.js` because the native watcher misses saves on some Windows setups; drop `server.watch.usePolling` on other platforms if the extra CPU bothers you.

## Build

- `npm run build` — Vite production build into `dist/`
- `npm run preview` — serve the built output locally for a sanity check

## Repository layout

```text
src/
  components/
    Hero/              split hero with a floating navbar and a hairline frame
    Cloud/             the orange cloud-lightning beacon that drives the hero
                       (six edge spots on desktop; a halo orbiting the photo on phones)
    Orbit/             the projects page's tilted language rings
    Flow/              the contact page's wind field and its form beacon
    Navbar/            the sticky island navigation
  data/                the one place to change the facts
                       (profile links, featured projects, contact transport)
  pages/               Projects and Contact page bodies
  styles/global.css    colour tokens, typography, resets
```

## Who

**Shardul Joshi** — Cloud & DevOps Engineer · Backend Architect.

- GitHub: [Sharduljoshi2001](https://github.com/Sharduljoshi2001)
- LinkedIn: [shardul-joshi-558137222](https://www.linkedin.com/in/shardul-joshi-558137222/)
