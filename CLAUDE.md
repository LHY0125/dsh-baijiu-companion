# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`dsh-baijiu-companion` — a DeepSeek Harness (Cordis) bundle plugin that ports a Chinese baijiu-teaching app's flow control into a state machine. Built as an out-of-tree package, installed into a dsh profile; it is not part of the `deepseek-harness` monorepo.

Design and plan live in `docs/superpowers/specs/` and `docs/superpowers/plans/`. The design doc is the binding authority when it disagrees with the plan.

## Commands

```powershell
pnpm install
pnpm run build          # tsc -> lib/
pnpm test               # vitest, all specs
pnpm vitest run tests/state.spec.ts               # one file
pnpm vitest run tests/state.spec.ts -t "弱点"     # one case
```

Install / inspect the plugin in a real harness profile:

```powershell
dsh plugin --profile web add "D:\Code\doing_exercises\programs\比赛项目\baijiu-dsh-plugin"
dsh --profile web --dump-config | Select-String "baijiu" -Context 0,6
dsh web
```

End-to-end runs need `DEEPSEEK_API_KEY` (or a root `.env`); there is no key checked in.

## Architecture

`src/index.ts` is the only entry point. `apply(ctx, config)` builds one `SessionStore` and hands it to six registrars, in this order: `submit_quiz`, `submit_grade`, `commands`, `prompt`, `router`, `reminder`. Every registrar takes `(ctx, store, config)` and registers effects that Cordis disposes on unload — nothing needs manual teardown.

The teaching flow is a five-phase machine (`explain → qa → quiz → grade → remedial`) held per session in `SessionStore`, keyed by `agent.id`. Only code moves it:


| Mover                                   | Transition                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `/learn`, `/quiz`, `/reset` commands    | enter `explain`, enter `quiz`, delete state                                                    |
| `agent/pre-step` listener (`router.ts`) | `explain → qa` on a human message; `quiz → grade` once a quiz exists and the student answers |
| `turn/end` listener (`router.ts`)       | `remedial → explain`                                                                          |
| tool bodies                             | `submit_quiz` stores the quiz; `submit_grade` moves to `remedial`                              |

The model never writes state directly. Two tools are **always registered**; the phase gate lives inside each `execute` and throws a Chinese error when the phase is wrong.

### Why the pieces are shaped this way

- **`submit_quiz`'s parameter schema has no answer field.** That is the answer-leak guard — not a regex. Adding an `answer` field would silently defeat it.
- **`submit_grade` calls `exec.deferContext()`**, not `followup()`: the remediation request rides the next model call in the same turn, and `renderStateBlock` then renders `phase='remedial'`. It deliberately does **not** call `concludeTurn()`.
- **`prompt.ts` returns `''` for sessions with no state**, so the plugin is invisible in every other session of the profile.
- **The prompt section sets `interpolate: false`.** `renderPrompt` throws on any complete `{{…}}` group; the section embeds student-controlled text (`topic`, `summary`, `focus`). Removing the flag makes one `/learn {{x}}` poison every later turn.
- **`router.ts` filters messages by whitelist (`source.kind === 'user'`), not blacklist.** The host's `MessageSourceMap` is merge-extensible and carries ~23 kinds (`user-approval`, `skill-invocation`, `goal`, `schedule`, …); a blacklist treats all of them as student input.
- **Both tools render their full artifact in `output.render`** (`formatQuiz` / `formatFeedback`). `concludeTurn` stops the model echoing it, so the tool result is the student's only view.
- **Defaults live only in `config.ts`.** `cordis.patch.yml` inserts the plugin row and carries no `config:` block, so there is exactly one source of defaults.

## Constraints that bite

- The published `@deepseek-ai/dsh-tools@0.2.1-rc.2` has **no conditional registration** (`{ when }`). Only unreleased monorepo source has it. Do not add a second argument to `ctx.tools.register`.
- `Agent` exposes `id` (`SessionId`), not `sessionId`; `execute` must be `async`.
- `ctx.commands`, `ctx.systemPrompt`, `ctx.agents` and `AssembleContext.agent` are module augmentations. Each needs `import type {} from '<pkg>'` in the file that uses it, plus the package in both `devDependencies` and `peerDependencies` (`@deepseek-ai/dsh-commands`, `dsh-system-prompt`, `dsh-agent`). All harness deps are pinned to the `0.2.1-rc.2` line.
- `pnpm-workspace.yaml` must stay: it holds `allowBuilds: { esbuild: true }`, the only place pnpm 11 reads that setting. Removing it breaks install.
- ESM + NodeNext: every relative import in `src/` ends in `.js` (tests import `../src/x.js` too).
- `tsconfig.json` compiles only `src/**`; tests are never type-checked by `pnpm run build`. `vitest.config.ts` sets `passWithNoTests` so an empty suite is not a failure.

## Testing conventions

Specs are per-module (`tests/<module>.spec.ts`). Pure logic (`state`, `summary`, `config`, `store`, validators) is tested directly. Cordis wiring is tested by passing a fake `ctx` and capturing what was registered — see `tests/submit-quiz.spec.ts` (`captureDefinition`) and `tests/index.spec.ts` (whole-assembly assertions). New behavior needs a test that fails without it; the previous rounds used mutation checks (break the implementation, watch the named test fail) to prove assertions are load-bearing.

`tests/index.spec.ts` asserts the exact registration counts — adding a command, tool, section, or listener means updating it.
