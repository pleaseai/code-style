import type { CargoMetadataProvider } from '../../src/check/types.js'
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import { describe, expect, test } from 'bun:test'
import { CargoUnavailableError } from '../../src/check/errors.js'
import { cargoStub, checkFixture } from '../test-utils/fixture.js'

const CARGO = { 'Cargo.toml': '[package]\nname = "fixture"\nversion = "0.1.0"\nedition = "2021"\n' }

/** Stub provider: the package at the fixture root with the given targets. */
function stub(targets: Array<[string, string]>): (root: string) => { cargoMetadata: CargoMetadataProvider } {
  return root => ({ cargoMetadata: () => cargoStub(root, '', targets) })
}

function kinds(result: ReturnType<typeof checkFixture>): string[] {
  return result.findings.map(f => `${f.kind} ${f.file}`).sort()
}

describe('rust include! and macro-loaded modules', () => {
  test('files loaded by include! or by `mod x;` inside a macro body are withheld with a notice', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'include!("gen.rs");\nmacro_rules! m { () => { mod viamacro; } }\nm!();',
      'src/gen.rs': '#[test]\nfn generated() {}',
      'src/viamacro.rs': '#[test]\nfn via_macro() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
    expect(result.notices.join('\n')).toContain('include!')
  })

  test('a non-literal include! withholds the whole crate, including tests/', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'include!(concat!(env!("OUT_DIR"), "/x.rs"));',
      'tests/sub/helper.rs': '#[test]\nfn works() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
    expect(result.notices.join('\n')).toContain('include!')
  })
})

describe('rust integration tests', () => {
  test('reports a nested tests/ file that is neither a target nor reached by mod', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'pub mod commands;',
      'src/commands.rs': '',
      'tests/commands/session_context.rs': '#[test]\nfn works() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(kinds(result)).toEqual(['undiscovered-integration-test tests/commands/session_context.rs'])
  })

  test('a private helper loaded with `mod support;` from one target is not reported', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '',
      'tests/foo.rs': 'mod support;\n#[test]\nfn works() {}',
      'tests/support/mod.rs': 'pub fn setup() {}',
    }, stub([['lib', 'src/lib.rs'], ['test', 'tests/foo.rs']]))
    expect(result.findings).toEqual([])
  })

  test('a helper module outside tests/common/ shared by two targets is a helper-location finding', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '',
      'tests/a.rs': 'mod support;',
      'tests/b.rs': '#[path = "support/mod.rs"]\nmod support;',
      'tests/support/mod.rs': 'pub fn setup() {}',
      'tests/c.rs': 'mod common;',
      'tests/d.rs': 'mod common;',
      'tests/common/mod.rs': 'pub fn shared() {}',
    }, stub([['lib', 'src/lib.rs'], ['test', 'tests/a.rs'], ['test', 'tests/b.rs'], ['test', 'tests/c.rs'], ['test', 'tests/d.rs']]))
    expect(result.findings).toEqual([expect.objectContaining({
      slug: 'test-helpers-in-dedicated-location',
      kind: 'shared-helper-outside-location',
      file: 'tests/support/mod.rs',
    })])
  })

  test('a helper outside tests/ shared by two targets is reported', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '',
      'src/support.rs': 'pub fn setup() {}',
      'tests/a.rs': '#[path = "../src/support.rs"]\nmod support;',
      'tests/b.rs': '#[path = "../src/support.rs"]\nmod support;',
    }, stub([['lib', 'src/lib.rs'], ['test', 'tests/a.rs'], ['test', 'tests/b.rs']]))
    expect(kinds(result)).toEqual(['shared-helper-outside-location src/support.rs'])
  })

  test('tests/common/ and submodules of a tests/<name>/main.rs target are never reported', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '',
      'tests/common/unused.rs': '',
      'tests/cli/main.rs': 'mod run;',
      'tests/cli/run.rs': '',
      'tests/cli/leftover.rs': '',
      'tests/fixtures/data.json': '{}',
    }, stub([['lib', 'src/lib.rs'], ['test', 'tests/cli/main.rs']]))
    expect(result.findings).toEqual([])
  })
})

describe('rust unregistered tests/<name>/main.rs', () => {
  test('a main.rs that is not a registered test target does not exempt its directory', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '',
      'tests/cli/main.rs': 'mod run;',
      'tests/cli/run.rs': '',
    }, stub([['lib', 'src/lib.rs']]))
    expect(kinds(result)).toContain('undiscovered-integration-test tests/cli/run.rs')
  })
})

describe('rust unit-test split files', () => {
  test('follows `#[cfg(test)] mod tests;` and `#[path]` declarations, whatever the file name', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'mod parser;\n#[cfg(test)]\n#[path = "lib_checks.rs"]\nmod checks;',
      'src/parser.rs': '#[cfg(test)]\nmod tests;',
      'src/parser/tests.rs': '#[test]\nfn parses() {}',
      'src/lib_checks.rs': '#[test]\nfn checks() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
  })

  test('follows a raw-string `#[path = r"…"]` to the real file', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '#[cfg(test)]\n#[path = r"renamed.rs"]\nmod checks;',
      'src/checks.rs': '',
      'src/renamed.rs': '#[test]\nfn checks() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
  })

  test('a crate whose metadata failed is a package boundary for its parent', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '',
      'fixtures/broken/Cargo.toml': '[package]\nname = "broken"\n',
      'fixtures/broken/src/lib.rs': '#[test]\nfn t() {}',
    }, {
      cargoMetadata: (dir) => {
        if (dir.endsWith('broken')) {
          throw new Error('bad manifest')
        }
        return cargoStub(dir, '', [['lib', 'src/lib.rs']])
      },
    })
    expect(result.findings).toEqual([])
    expect(result.notices).toEqual([expect.stringContaining('skipped that crate')])
  })

  test('reports a #[test] file that no mod declaration reaches', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'mod parser;',
      'src/parser.rs': '',
      'src/parser_tests.rs': '#[test]\nfn parses() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(kinds(result)).toEqual(['unreachable-unit-test src/parser_tests.rs'])
  })

  test('a #[test] file declared inside an inline module is not reported', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'pub mod outer { mod child; }',
      'src/outer/child.rs': '#[test]\nfn works() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
  })

  test('an unrelated nested `mod x;` withholds only its subtree, with a notice, and orphan tests are still reported', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'pub mod outer { mod child; }',
      'src/outer/child.rs': '#[test]\nfn works() {}',
      'tests/lost/case.rs': '#[test]\nfn lost() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(kinds(result)).toEqual(['undiscovered-integration-test tests/lost/case.rs'])
    expect(result.notices).toEqual([expect.stringContaining('src/ (from src/lib.rs)')])
  })

  test('an unreachable #[test] file outside the withheld subtree is still reported', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'mod outer;',
      'src/outer.rs': 'pub mod inner { mod child; }',
      'src/outer/inner/child.rs': '#[test]\nfn works() {}',
      'src/stray_tests.rs': '#[test]\nfn stray() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(kinds(result)).toEqual(['unreachable-unit-test src/stray_tests.rs'])
    expect(result.notices).toEqual([expect.stringContaining('src/outer/ (from src/outer.rs)')])
  })
})

describe('rust module path edge cases', () => {
  test('a nested `#[path]` mod withholds the whole crate, so a test file it loads under tests/ is not reported', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'mod outer;',
      'src/outer.rs': 'pub mod inner {\n  #[path = "../../tests/loaded.rs"]\n  mod loaded;\n}',
      'tests/loaded.rs': '#[test]\nfn works() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
    expect(result.notices).toEqual([expect.stringContaining('(from src/outer.rs)')])
  })

  test('`#[cfg_attr(test, path = "…")] mod tests;` reaches the conditional file as well as the default one', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '#[cfg_attr(test, path = "checks.rs")]\nmod tests;',
      'src/checks.rs': '#[test]\nfn works() {}',
      'src/tests.rs': '#[test]\nfn also() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
  })

  test('`#[cfg_attr(test, path = r"…")] mod tests;` reaches the raw-string path file', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '#[cfg_attr(test, path = r"checks.rs")]\nmod tests;',
      'src/checks.rs': '#[test]\nfn works() {}',
      'src/tests.rs': '',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
  })

  test('several `#[cfg_attr(…, path = "…")]` attributes on one `mod` each reach their own file', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '#[cfg_attr(unix, path = "unix.rs")]\n#[cfg_attr(windows, path = "windows.rs")]\nmod platform;',
      'src/unix.rs': '#[test]\nfn on_unix() {}',
      'src/windows.rs': '#[test]\nfn on_windows() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
  })

  test('tests/ui and other runtime-loaded fixture dirs are withheld with an aggregated notice', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '',
      'tests/compiletest.rs': 'fn main() { t.compile_fail("tests/ui/*.rs"); t.pass("tests/cases/*.rs"); }',
      'tests/ui/bad.rs': 'fn main() {}',
      'tests/cases/ok.rs': 'fn main() {}',
      'tests/lost/case.rs': '#[test]\nfn lost() {}',
    }, stub([['lib', 'src/lib.rs'], ['test', 'tests/compiletest.rs']]))
    expect(kinds(result)).toEqual(['undiscovered-integration-test tests/lost/case.rs'])
    expect(result.notices).toEqual([expect.stringContaining('skipped 2 file(s) in tests/ subdirectories a test target may load at runtime')])
    expect(result.notices[0]).toContain('tests/cases/ok.rs, tests/ui/bad.rs')
  })

  test('`mod r#async;` loads async.rs', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': 'mod r#async;',
      'src/async.rs': '#[test]\nfn works() {}',
    }, stub([['lib', 'src/lib.rs']]))
    expect(result.findings).toEqual([])
  })
})

describe('rust without cargo', () => {
  test('skips Rust with a visible notice instead of passing silently', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '',
      'tests/commands/session_context.rs': '',
    }, { cargoMetadata: () => { throw new CargoUnavailableError('cargo: command not found') } })
    expect(result.findings).toEqual([])
    expect(result.notices).toEqual([expect.stringContaining('cargo is not available')])
  })
})

const cargo = process.env.CARGO ?? 'cargo'
const hasCargo = spawnSync(cargo, ['--version']).status === 0

describe('rust with real cargo metadata', () => {
  test.skipIf(!hasCargo)('autotests discovery matches cargo: tests/<dir>/<file>.rs without [[test]] is reported', () => {
    const result = checkFixture({
      ...CARGO,
      'src/lib.rs': '',
      'tests/session.rs': '#[test]\nfn ok() {}',
      'tests/commands/session_context.rs': '#[test]\nfn lost() {}',
    })
    expect(result.notices).toEqual([])
    expect(kinds(result)).toEqual(['undiscovered-integration-test tests/commands/session_context.rs'])
  })
})
