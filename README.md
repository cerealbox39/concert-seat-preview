# LANY · Find your view

An unofficial, static 3D seat explorer for **LANY's soft world tour at Singapore Indoor Stadium, 4 November 2026**, based on the event details and block diagram supplied for this project.

Choose a block, row and seat to move into a first-person preview facing the stage. Standing ticket holders can select Pen A or B and drop a pin on the floor. Drag or use arrow keys to look around, adjust the field of view, return to face the stage, expand the preview, or share a link to the exact modelled location.

## Download and open without installing anything

[Download the app as a ZIP](https://github.com/cerealbox39/concert-seat-preview/archive/refs/heads/codex/lany-seat-preview.zip), extract it, then open **`docs/index.html`** in a browser. This file contains the built app, its styles and the 3D engine. No npm install or development server is needed. If the repository is private, sign in to GitHub first.

The repository root's `index.html` is the development entry point; use **`docs/index.html`** for the ready-built app. A browser or viewer must permit JavaScript and WebGL. Some managed browsers disallow opening local HTML files; in that case use the GitHub Pages site described below.

## Run locally

Use **Node.js 24** and npm. No API keys, environment variables, backend, database, paid services, or runtime CDN requests are required.

```sh
npm ci
npm run dev
```

```sh
npm run build       # TypeScript check and static production build
npm run preview     # Serve dist locally
npm test            # Seating geometry and shared-location tests
```

The build refreshes **`docs/index.html`** and creates an identical, ignored **`preview.html`** at the repository root. Both include all JavaScript, CSS and the 3D engine. Sharing requires the hosted website; a local or opaque preview has no public URL to share.

Browser tests exercise desktop and phone layouts, seat/map selection, invalid inputs, standing pins, shared links, camera controls, the WebGL fallback, blocked History API calls, and a real sandboxed `srcdoc` preview with an opaque origin:

```sh
npx playwright install chromium
npm run build
npm run test:e2e
```

To use an existing Chromium installation, set `CHROMIUM_PATH=/path/to/chromium` when running `npm run test:e2e`. The test configuration enables software WebGL for headless environments. Production users need a browser supporting WebGL 2; selection and link sharing still work if 3D rendering is unavailable.

## Deploy free on GitHub Pages

The ready-built copy can be published directly from this branch:

1. Open [Settings → Pages](https://github.com/cerealbox39/concert-seat-preview/settings/pages).
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select branch **`codex/lany-seat-preview`** and folder **`/docs`**, then click **Save**.
4. Wait for GitHub's Pages deployment to finish, then open the site URL shown on that settings page.

After changing the app, run `npm run build` and commit the refreshed `docs/index.html` along with the source so this branch-based site stays current. GitHub Pages is free for public repositories; private repository eligibility depends on the GitHub plan.

### Optional: automatic builds from main

To build from source on every update instead, merge this branch into `main`, change the Pages source to **GitHub Actions**, then run **Actions → Deploy to GitHub Pages → Run workflow**. Future pushes to `main` trigger the workflow automatically.

The workflow installs from the lockfile, runs the unit suite, type-checks and builds, then uploads and deploys `dist/`. It uses the built-in GitHub token and requires no custom secrets.

The production HTML bundles its scripts and styles inline, so it works under a project subpath such as `/concert-seat-preview/`, a custom domain, or a standalone HTML viewer without fetching module files. Location state uses query parameters rather than client-side routes, so shared seat URLs do not need server rewrites. Updating the address bar is optional: embedded previews that block the History API still run. You can also host the contents of `dist/` on another static host.

## Accuracy and references

This is a **conceptual preview, not a verified sightline, ticket checker, or official stage design**.

- The supplied LANY event seating diagram is the primary reference. It explicitly says it is not to scale.
- All 55 numbered blocks in that diagram are included: 109–114, 128–133, 209–233, 309–314, 318–320, 322–324 and 328–333. Their arrangement is an approximate horseshoe, with the stage at one end and Pen B west of Pen A.
- Dimensions, block shapes, row counts, seat counts, seat numbering direction, tier elevations, stage and screen geometry, crowd and lighting are invented modelling assumptions. The screen artwork is generated locally by this project.
- Row 1 is at the front of each modelled block. The app's input limits are model limits, not evidence that a real ticket is invalid. The preview does not account for real obstructions, production equipment, accessible seating arrangements or actual crowd density.
- Standing pins are hypothetical positions. They do not reserve a place or imply assigned standing locations.
- Displayed distance is the horizontal distance to the modelled stage centre. Eye level is measured above the modelled arena floor.
- External photo references could not be accessed during development. The app links to [Singapore Indoor Stadium fan photos](https://aviewfrommyseat.com/venue/Singapore+Indoor+Stadium/) as an optional external reference, not calibration data. **Singapore National Stadium is a separate venue.**

## Implementation

- TypeScript + Vite + Three.js; no application framework or server.
- `src/model.ts`: the single source of truth for block IDs, estimated geometry, standing bounds, and URL validation.
- `src/scene.ts`: the arena, stage, instanced seating/crowd, first-person camera and demand-driven rendering.
- `src/main.ts`: accessible controls, SVG block/pin maps, sharing, information dialogs, and renderer fallback.
- `src/location.ts`: preview-safe URL updates and share links from the current selection.
- `src/style.css`: responsive layout, including touch controls and reduced-motion support.
- `.github/workflows/pages.yml`: static build and Pages deployment.

The renderer caps pixel ratio, reuses instanced geometry, and renders only when the view changes. All scripts, styles, and generated visuals are included in the HTML or generated locally, with no external runtime requests. `vite-plugin-singlefile` creates the standalone production document, and `scripts/prepare-preview.mjs` copies it to the ignored `preview.html` and the checked-in `docs/index.html` for downloads and branch-based GitHub Pages hosting.
