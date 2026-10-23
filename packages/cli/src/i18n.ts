import process from 'node:process'
import { LANGUAGES } from './languages.js'

export type Locale = 'en' | 'ko'

interface Messages {
  appTitle: string
  detectedPm: (pm: string) => string
  selectTools: string
  alreadyInstalled: string
  nothingSelected: string
  installing: string
  installFailed: string
  installDone: string
  overwritePrompt: (file: string) => string
  skipped: (file: string) => string
  created: (file: string) => string
  updated: (file: string) => string
  agentsBlockUpdated: string
  astGrepPlugNPlay: string
  editorconfigPlugNPlay: string
  doctorHeading: string
  doctorOk: string
  doctorMissing: string
  done: string
  cancelled: string
  unknownCommand: (cmd: string) => string
  unexpectedArguments: (args: string) => string
  optionBeforeCheck: (option: string) => string
  deprecatedLangFlag: (locale: Locale) => string
  ignoredLangFlag: (locale: Locale) => string
  invalidLocaleFlag: (value: string) => string
  invalidLangFlag: (value: string) => string
  selectLanguages: string
  doctorLanguages: (languages: string) => string
  doctorNoLanguages: string
  doctorSelectedLanguages: (languages: string) => string
  usage: string
  checkUsage: string
}

const messages: Record<Locale, Messages> = {
  en: {
    appTitle: 'PleaseAI code-style setup',
    detectedPm: pm => `Detected package manager: ${pm}`,
    selectTools: 'Select items to install or update',
    alreadyInstalled: '(installed)',
    nothingSelected: 'Nothing selected — exiting.',
    installing: 'Installing packages…',
    installFailed: 'Package installation failed. Check your network or install manually.',
    installDone: 'Packages installed.',
    overwritePrompt: file => `${file} already exists. Overwrite?`,
    skipped: file => `Skipped ${file}`,
    created: file => `Created ${file}`,
    updated: file => `Updated ${file}`,
    agentsBlockUpdated: 'Refreshed AGENTS.md pleaseai-code-style block.',
    astGrepPlugNPlay: 'Yarn Plug\'n\'Play has no node_modules, so ast-grep cannot read the rules from node_modules/@pleaseai/ast-grep-config. Set `nodeLinker: node-modules` in .yarnrc.yml, run yarn install, and run init again.',
    editorconfigPlugNPlay: 'Yarn Plug\'n\'Play has no node_modules, so .editorconfig was not copied from node_modules/@pleaseai/editorconfig. Copy it with: yarn node -e "const fs = require(\'fs\'); fs.copyFileSync(require.resolve(\'@pleaseai/editorconfig/.editorconfig\'), \'.editorconfig\', fs.constants.COPYFILE_EXCL)"',
    doctorHeading: 'Project status',
    doctorOk: 'OK',
    doctorMissing: 'missing',
    done: 'Done!',
    cancelled: 'Cancelled.',
    unknownCommand: cmd => `Unknown command: ${cmd}`,
    unexpectedArguments: args => `Unexpected arguments: ${args}`,
    optionBeforeCheck: option => `${option} is a check option; put it after \`check\` (please-style check ${option})`,
    deprecatedLangFlag: locale => `--lang ${locale} is deprecated; use --locale ${locale}. Use --lang to select programming languages.`,
    ignoredLangFlag: locale => `--lang ${locale} is deprecated and ignored because --locale is set; remove it. Use --lang to select programming languages.`,
    invalidLocaleFlag: value => `Unknown --locale value: "${value}". Use ko or en.`,
    invalidLangFlag: value => `Unknown --lang value: "${value}". Use a comma-separated list of: ${LANGUAGES.join(', ')}. To set the CLI locale, use --locale <ko|en>.`,
    selectLanguages: 'Select the languages for the AGENTS.md rules block',
    doctorLanguages: languages => `Detected languages: ${languages}`,
    doctorNoLanguages: 'Detected languages: none',
    doctorSelectedLanguages: languages => `Selected languages (--lang): ${languages}`,
    usage: `Usage:
  pleaseai-code-style <command> [options]

Commands:
  init       Interactive setup (select packages + write configs)
  update     Re-apply the AGENTS.md rules block only
  doctor     Check current project status
  check      Check file names, test paths, and shared test helpers (see check --help)

Options:
  --yes, -y        Accept defaults, overwrite existing files
  --lang <list>    Languages for the rules block, comma-separated (default: detected)
  --locale <ko|en> Force CLI locale
  --help, -h       Show this message
  --version, -v    Print version`,
    checkUsage: `Usage:
  please-style check [path] [options]

Checks file names, test locations, and shared test helpers against the
ADR-0022 code-organization standard (layer 3). Structural rules (layer 2) run
separately with \`ast-grep scan\`.

Options:
  --json             Print findings as JSON
  --strict           Exit 1 when there is any finding (default: warn only, exit 0)
  --config <file>    Config file (default: <path>/code-organization.json)
  --help, -h         Show this message
  --version, -v      Print version

Exit codes: 0 ok or warnings only, 1 findings with --strict, 2 usage or config error, or a dependency that cannot be resolved when a file needs extraction.
`,
  },
  ko: {
    appTitle: 'PleaseAI code-style 설치',
    detectedPm: pm => `감지된 패키지 매니저: ${pm}`,
    selectTools: '설치하거나 업데이트할 항목을 선택하세요',
    alreadyInstalled: '(설치됨)',
    nothingSelected: '선택된 항목이 없어 종료합니다.',
    installing: '패키지 설치 중…',
    installFailed: '패키지 설치 실패. 네트워크를 확인하거나 수동으로 설치해주세요.',
    installDone: '패키지 설치 완료.',
    overwritePrompt: file => `${file}가 이미 존재합니다. 덮어쓸까요?`,
    skipped: file => `${file} 건너뜀`,
    created: file => `${file} 생성됨`,
    updated: file => `${file} 업데이트됨`,
    agentsBlockUpdated: 'AGENTS.md의 pleaseai-code-style 블록을 갱신했습니다.',
    astGrepPlugNPlay: 'Yarn Plug\'n\'Play는 node_modules를 만들지 않아 ast-grep이 node_modules/@pleaseai/ast-grep-config의 규칙을 읽을 수 없습니다. .yarnrc.yml에 `nodeLinker: node-modules`를 설정하고 yarn install 후 init을 다시 실행하세요.',
    editorconfigPlugNPlay: 'Yarn Plug\'n\'Play는 node_modules를 만들지 않아 node_modules/@pleaseai/editorconfig에서 .editorconfig를 복사하지 못했습니다. 다음 명령으로 복사하세요: yarn node -e "const fs = require(\'fs\'); fs.copyFileSync(require.resolve(\'@pleaseai/editorconfig/.editorconfig\'), \'.editorconfig\', fs.constants.COPYFILE_EXCL)"',
    doctorHeading: '프로젝트 상태',
    doctorOk: '정상',
    doctorMissing: '없음',
    done: '완료!',
    cancelled: '취소되었습니다.',
    unknownCommand: cmd => `알 수 없는 명령어: ${cmd}`,
    unexpectedArguments: args => `예상하지 못한 인자: ${args}`,
    optionBeforeCheck: option => `${option}는 check 옵션입니다. \`check\` 뒤에 쓰세요 (please-style check ${option})`,
    deprecatedLangFlag: locale => `--lang ${locale} 옵션은 더 이상 권장하지 않습니다. 대신 --locale ${locale} 옵션을 쓰세요. 프로그래밍 언어는 --lang으로 고르세요.`,
    ignoredLangFlag: locale => `--lang ${locale} 옵션은 더 이상 권장하지 않으며, --locale 옵션이 있어 무시합니다. 이 옵션을 지우세요. 프로그래밍 언어는 --lang으로 고르세요.`,
    invalidLocaleFlag: value => `알 수 없는 --locale 값: "${value}". ko 또는 en을 쓰세요.`,
    invalidLangFlag: value => `알 수 없는 --lang 값: "${value}". 쉼표로 구분한 목록으로 지정하세요: ${LANGUAGES.join(', ')}. CLI 로케일은 --locale <ko|en>으로 지정하세요.`,
    selectLanguages: 'AGENTS.md 룰 블록에 넣을 언어를 선택하세요',
    doctorLanguages: languages => `감지된 언어: ${languages}`,
    doctorNoLanguages: '감지된 언어: 없음',
    doctorSelectedLanguages: languages => `선택한 언어(--lang): ${languages}`,
    usage: `사용법:
  pleaseai-code-style <command> [options]

명령어:
  init       대화형 설치 (패키지 선택 + 설정 파일 생성)
  update     AGENTS.md 룰 블록만 다시 적용
  doctor     현재 프로젝트 상태 점검
  check      파일 이름, 테스트 경로, 공유 테스트 헬퍼 검사 (check --help 참고)

옵션:
  --yes, -y        기본값 수락, 기존 파일 덮어쓰기
  --lang <list>    룰 블록에 넣을 언어, 쉼표로 구분 (기본: 자동 감지)
  --locale <ko|en> CLI 로케일 강제 지정
  --help, -h       이 메시지 표시
  --version, -v    버전 출력`,
    checkUsage: `사용법:
  please-style check [path] [options]

파일 이름, 테스트 위치, 공유 테스트 헬퍼를 ADR-0022 code-organization 표준
(3층)에 맞춰 검사합니다. 구조 규칙(2층)은 \`ast-grep scan\`으로 따로
실행합니다.

옵션:
  --json             발견 사항을 JSON으로 출력
  --strict           발견 사항이 하나라도 있으면 exit 1 (기본: 경고만, exit 0)
  --config <file>    설정 파일 (기본: <path>/code-organization.json)
  --help, -h         이 메시지 표시
  --version, -v      버전 출력

종료 코드: 0 정상 또는 경고만, 1 --strict에서 발견 사항 있음, 2 사용법 또는 설정 오류, 또는 추출이 필요한 파일이 있는데 의존성을 찾을 수 없음.
`,
  },
}

export function detectLocale(override?: string): Locale {
  if (override === 'ko' || override === 'en') {
    return override
  }
  const env = process.env.LC_ALL || process.env.LANG || process.env.LC_MESSAGES || ''
  return env.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

type FlagValue = string | boolean | undefined

export interface LangWarning {
  kind: 'deprecated' | 'ignored'
  locale: Locale
}

export type LocaleFlags
  = | { kind: 'ok', locale: Locale, langWarning?: LangWarning }
    | { kind: 'invalid', locale: Locale, value: string }

function asLocale(value: FlagValue): Locale | undefined {
  return value === 'ko' || value === 'en' ? value : undefined
}

function flagText(value: FlagValue): string {
  return typeof value === 'string' ? value : ''
}

export function resolveLocaleFlags(flags: { locale?: FlagValue, lang?: FlagValue }): LocaleFlags {
  const fromLocale = asLocale(flags.locale)
  const fromLang = asLocale(flags.lang)
  const locale = fromLocale ?? fromLang ?? detectLocale()
  if (flags.locale !== undefined && fromLocale === undefined) {
    return { kind: 'invalid', locale, value: flagText(flags.locale) }
  }
  if (fromLang === undefined) {
    return { kind: 'ok', locale }
  }
  return { kind: 'ok', locale, langWarning: { kind: fromLocale === undefined ? 'deprecated' : 'ignored', locale: fromLang } }
}

let current: Locale = 'en'

export function setLocale(locale: Locale): void {
  current = locale
}

export function t<K extends keyof Messages>(key: K): Messages[K] {
  return messages[current][key]
}
