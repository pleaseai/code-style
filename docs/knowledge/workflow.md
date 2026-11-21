# Project Workflow

> Defines the development workflow conventions for the project.

## Guiding Principles

1. **The Plan is the Source of Truth**: Tracked work lives in the track's `plan.md`. A bug fix or refactor skips the track and goes straight to a branch and PR when all of these hold (see `new-track` Track check):
   - The user did not ask for a track, spec, or plan.
   - The work has no requirements doc, Asana-linked report, or multi-part issue or Epic.
   - Nothing is left to decide: the approach is settled and, for a bug, the cause is known.
   - The change is low-risk and easy to reverse: no authentication, payments, data migration, other security/compliance-sensitive work, or breaking public API change.
2. **The Tech Stack is Deliberate**: Changes to the tech stack must be documented in `tech-stack.md` before implementation
3. **Outcome-Gated Testing**: A task is done when its affected tests, the project's quality gates, and its `Method:` pass. Test-first (RED-GREEN-REFACTOR) applies only to tasks the plan opts in with `Testing: tdd` or a `[TDD]` marker
4. **High Code Coverage**: Aim for >80% code coverage for new code
5. **Non-Interactive & CI-Aware**: Prefer non-interactive commands. Use `CI=true` for watch-mode tools

## Task Workflow

Track tasks follow a strict lifecycle within `/please:implement`:

### Standard Task Lifecycle

1. **Select Task**: Choose the next available task from `plan.md`
2. **Mark In Progress**: Update task status from `[ ]` to `[~]`
3. **Implement**: Make the change the task describes. For a task opted into TDD (`Testing: tdd` or `[TDD]`), first write a failing test and confirm it fails, then write the minimum code to make it pass
4. **Prove**: Run the affected tests, the project's quality gates, and the task's `Method:`, and confirm they pass
5. **Refactor (Optional)**:
   - Improve clarity, remove duplication, enhance performance
   - Rerun tests to ensure they still pass
6. **Verify Coverage**: Run coverage reports. Target: >80% for new code
7. **Document Deviations**: If implementation differs from tech stack, update `tech-stack.md` first
8. **Commit**: Stage and commit with conventional commit message
9. **Update Progress**: Mark the task as completed in `## Progress` with a timestamp

### Phase Completion Protocol

Executed when all tasks in a phase are complete:

1. **Verify Test Coverage**: Identify all files changed in the phase, ensure test coverage
2. **Run Full Test Suite**: Execute all tests, debug failures (max 2 fix attempts)
3. **Manual Verification Plan**: Generate step-by-step verification instructions for the user
4. **User Confirmation**: Wait for explicit user approval before proceeding
5. **Create Checkpoint**: Commit with message `chore(checkpoint): complete phase {name}`. If the stacked PR workflow is enabled (`workflow.stacked_pr.enabled=true` AND `workflow.stacked_pr.tool=gh-stack` in `.please/config.yml`), `/please:implement` additionally runs `gh stack submit --auto` at this step to refresh all PRs in the stack.
6. **Update Plan**: Mark phase as complete in `plan.md`

## Quality Gates

Before marking any task complete:

- [ ] All tests pass
- [ ] Code coverage meets requirements (>80%)
- [ ] Code follows project style guidelines
- [ ] No linting or static analysis errors
- [ ] No security vulnerabilities introduced
- [ ] Documentation updated if needed

## Development Commands

### Setup

```bash
mise trust && mise install
bun install
```

### Daily Development

```bash
bun run build        # build all packages (turbo)
bun run docs:dev     # docs site dev server
```

### Testing

```bash
bun run test                              # all packages (turbo, builds first)
cd packages/eslint-config && bun test      # one package
cd packages/ast-grep-config && bun run test  # bun test + ast-grep test
```

### Before Committing

```bash
bun run lint         # or bun run lint:fix
bun run build && bun run test
cd apps/docs && bun run typecheck && bun run lint:docs   # when docs change
```

## Testing Requirements

### Unit Testing

- Every module must have corresponding tests
- Mock external dependencies
- Test both success and failure cases

### Integration Testing

- Test complete user flows
- Verify data transactions
- Test authentication and authorization

## Commit Guidelines

Follow the project's commit convention. See `Skill("standards:commit-convention")` for details.

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Formatting changes
- `refactor`: Code change without behavior change
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

## Definition of Done

A task is complete when:

1. All code implemented to specification
2. Unit tests written and passing
3. Code coverage meets project requirements
4. Code passes all configured checks
5. Progress updated in `plan.md`
6. Changes committed with proper message
