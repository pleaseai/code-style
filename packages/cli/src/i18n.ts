import process from 'node:process'

export type Locale = 'en' | 'ko'

interface Messages {
  appTitle: string
  noPackageJson: string
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
  doctorHeading: string
  doctorOk: string
  doctorMissing: string
  done: string
  cancelled: string
  unknownCommand: (cmd: string) => string
  usage: string
}

const messages: Record<Locale, Messages> = {
  en: {
    appTitle: 'PleaseAI code-style setup',
    noPackageJson: 'package.json not found. Run this command from your project root.',
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
    doctorHeading: 'Project status',
    doctorOk: 'OK',
    doctorMissing: 'missing',
    done: 'Done!',
    cancelled: 'Cancelled.',
    unknownCommand: cmd => `Unknown command: ${cmd}`,
    usage: `Usage:
  pleaseai-code-style <command> [options]

Commands:
  init       Interactive setup (select packages + write configs)
  update     Re-apply the AGENTS.md rules block only
  doctor     Check current project status

Options:
  --yes, -y        Accept defaults, overwrite existing files
  --lang <ko|en>   Force CLI locale
  --help, -h       Show this message
  --version, -v    Print version`,
  },
  ko: {
    appTitle: 'PleaseAI code-style 설치',
    noPackageJson: 'package.json이 없습니다. 프로젝트 루트에서 실행해주세요.',
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
    doctorHeading: '프로젝트 상태',
    doctorOk: '정상',
    doctorMissing: '없음',
    done: '완료!',
    cancelled: '취소되었습니다.',
    unknownCommand: cmd => `알 수 없는 명령어: ${cmd}`,
    usage: `사용법:
  pleaseai-code-style <command> [options]

명령어:
  init       대화형 설치 (패키지 선택 + 설정 파일 생성)
  update     AGENTS.md 룰 블록만 다시 적용
  doctor     현재 프로젝트 상태 점검

옵션:
  --yes, -y        기본값 수락, 기존 파일 덮어쓰기
  --lang <ko|en>   CLI 로케일 강제 지정
  --help, -h       이 메시지 표시
  --version, -v    버전 출력`,
  },
}

export function detectLocale(override?: string): Locale {
  if (override === 'ko' || override === 'en') {
    return override
  }
  const env = process.env.LC_ALL || process.env.LANG || process.env.LC_MESSAGES || ''
  return env.toLowerCase().startsWith('ko') ? 'ko' : 'en'
}

let current: Locale = 'en'

export function setLocale(locale: Locale): void {
  current = locale
}

export function t<K extends keyof Messages>(key: K): Messages[K] {
  return messages[current][key]
}
