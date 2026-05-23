# Agent Instructions

## Git Workflow

- Before any Git sync, push, merge, or rebase task, read `docs/git-workflow.md`.
- Keep `main` as the clean upstream sync branch for `upstream/main`.
- Do not develop on `main`.
- Use `local-dev` for local/custom development work.
- Push only `local-dev` to `origin` unless the user explicitly asks to push another branch.
- Do not push `main` to `origin` unless explicitly requested.
- Do not commit runtime/local files such as `aiproxy.db`.
- Do not touch unknown user files such as `t.md` unless explicitly requested.
- Do not run destructive Git commands such as `git reset --hard`, `git clean`, or force-push unless the user explicitly approves.

## Project Notes

- User wallet and prepaid billing design is documented in `docs/user-wallet-mvp.md`.
- Public-facing page design must follow the design system documented in `design.md`. Before designing or redesigning UI pages, read `design.md` and apply its typography, color, spacing, button, card, shadow, and layout rules unless the user explicitly requests a different style.
- Product-facing changes must be implemented as formal, maintainable product work. Avoid patch-style fixes, temporary workarounds, hard-coded one-off behavior, and scattered local overrides. When an area has accumulated patchy changes, consolidate it into a clear data flow, reusable structure, and stable UI behavior suitable for production.
