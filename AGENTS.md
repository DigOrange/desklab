# Repository Guidelines

## Project Structure & Module Organization
- `src/` holds the React + Vite frontend. Core modules live in `features/`, reusable UI in `components/`, routing in `router.tsx`, state in `stores/`, and styles in `styles/`.
- `src-tauri/` contains the Tauri 2 + Rust backend; Rust sources are in `src-tauri/src/`.
- `docs/` documents requirements, architecture, and UI prototypes (see `docs/ui/`).
- `dist/` and `node_modules/` are generated outputs; don’t edit or commit them.

## Build, Test, and Development Commands
- `pnpm dev`: start the Vite dev server for the frontend.
- `pnpm build`: type-check and build the web assets for production.
- `pnpm preview`: serve the production build locally.
- `pnpm tauri dev`: run the desktop app in Tauri dev mode.
- `pnpm tauri build`: build the desktop app bundles.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; match existing formatting in each file.
- TypeScript: use type-only imports (`import type { Foo } from './bar'`) and mark constant arrays as `readonly`.
- Naming: components use `PascalCase.tsx`, hooks use `useX.ts`, Zustand stores use `*Store.ts`, services use `*Service.ts`.
- Keep components focused and extract helper functions when logic repeats.

## Testing Guidelines
- No JS/TS test runner is configured yet; add tests under `src/` or a new `tests/` folder and wire a script before relying on CI.
- Rust tests (if added) can be run from `src-tauri/` with `cargo test`.
- For PRs, include manual verification steps (screenshots or short notes are enough).

## Commit & Pull Request Guidelines
- Git history isn’t available in this workspace; follow team conventions, or use Conventional Commits if starting fresh.
- PRs should include: a clear description, links to relevant docs/issues, and screenshots/GIFs for UI changes.
- Call out whether you ran `pnpm build` and/or `pnpm tauri dev`.

## Security & Configuration Notes
- Keep API keys and secrets out of the repo; use local OS keychains or environment-based configuration.
- If you add new configuration files, document them in `docs/` and provide safe defaults.
