/** The config file is unreadable or has a shape the standard does not allow. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigError'
  }
}

/** The ast-grep binary is missing or exited with an error. */
export class AstGrepError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AstGrepError'
  }
}

/** `cargo` is not on PATH (or not runnable); Rust checks are skipped. */
export class CargoUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CargoUnavailableError'
  }
}

/** `@ast-grep/cli` (project or this CLI) or `@pleaseai/ast-grep-config` (this CLI, then the project) cannot be resolved. */
export class MissingDependencyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingDependencyError'
  }
}
