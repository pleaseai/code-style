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

/** Neither the checked project nor this CLI can resolve `@pleaseai/ast-grep-config` and `@ast-grep/cli`. */
export class MissingDependencyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MissingDependencyError'
  }
}
