# .please/ Workspace Index

> Central navigation for all project artifacts managed by the please plugin.

## Project Documents

| Document                       | Purpose                                                 |
| ------------------------------ | ------------------------------------------------------- |
| [`../AGENTS.md`](../AGENTS.md) | Project-level AI instructions (imported by `CLAUDE.md`) |

## Directory Map

| Path                   | Purpose                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `state/`               | Runtime session state (progress), not tracked in git                                      |
| `docs/tracks/`         | Implementation tracks (spec + plan) → [Tracks](docs/tracks.jsonl)                         |
| module `SPEC.md` files | Product-level specifications, next to the code they describe (`product-spec check --all`) |
| `../docs/adr/`         | Architecture Decision Records → [Decisions Index](../docs/adr/index.md)                   |
| `docs/investigations/` | Bug investigation reports                                                                 |
| `docs/research/`       | Research documents                                                                        |
| `../docs/references/`  | External reference materials (-llms.txt etc.)                                             |
| `../docs/knowledge/`   | Stable project context (product, tech-stack, guidelines)                                  |
| `docs/brainstorms/`    | Brainstorm requirements documents (`$PLEASE_DOCS_BRAINSTORMS`)                            |
| `docs/ideation/`       | Ideation candidate documents (`$PLEASE_DOCS_IDEATION`)                                    |
| `docs/review/`         | Review rejected-findings ledger (`$PLEASE_DOCS_REVIEW`)                                   |
| `templates/`           | Workflow templates (plugin-provided)                                                      |
| `scripts/`             | Utility scripts (plugin-provided)                                                         |

## Configuration

See [config.yml](config.yml) for workspace settings.

## Workflows

- `/please:new-track`: Create feature specification and architecture plan
- `/please:implement`: implementation from plan file
- `/please:finalize`: Finalize PR, move track to completed
