/**
 * Name normalization — one function per language naming convention
 * (ADR-0022 §3: the only language-specific code besides path derivation).
 */

function words(name: string): string[] {
  return name
    // fooBar → foo Bar, v2Api → v2 Api
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // HTTPServer → HTTP Server
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map(w => w.toLowerCase())
}

/** TypeScript file names: `UserService` / `user.service` / `user_service` → `user-service`. */
export function toKebabCase(name: string): string {
  return words(name).join('-')
}

/** Dart file names: `UserRepository` → `user_repository`. */
export function toSnakeCase(name: string): string {
  return words(name).join('_')
}
