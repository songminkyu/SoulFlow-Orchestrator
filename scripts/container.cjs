#!/usr/bin/env node

/**
 * 플랫폼 독립적인 컨테이너 관리 헬퍼
 * Docker/Podman을 자동으로 감지하여 사용
 * Windows에서 podman machine SSH 터널 끊김 시 WSL 직접 실행으로 fallback
 *
 * 사용법:
 *   node scripts/container.cjs build           # 단일 이미지 빌드
 *   node scripts/container.cjs bash            # 컨테이너 셸 접속
 *   node scripts/container.cjs test            # 전체 테스트
 *   node scripts/container.cjs test:pty        # PTY 테스트
 *   node scripts/container.cjs compose:build   # compose 빌드
 *   node scripts/container.cjs compose:up      # compose 시작
 *   node scripts/container.cjs compose:down    # compose 종료 + 볼륨 제거
 *   node scripts/container.cjs compose:logs    # orchestrator 로그
 *   node scripts/container.cjs compose:restart # orchestrator 재시작
 *   node scripts/container.cjs ps              # 컨테이너 상태 확인
 */

const { execSync } = require('child_process');
const { detect, toWslPath, wrapCommand, getImageName } = require('./detect-container.cjs');

const command = process.argv[2];
const args = process.argv.slice(3);
const COMPOSE_FILE = 'docker/docker-compose.yml';

try {
  const info = detect();
  const rt = info.runtime;
  const imageName = getImageName();

  // compose 파일 경로: WSL 모드에서는 절대경로로 변환
  const composeFile = info.mode === 'wsl'
    ? toWslPath(`${process.cwd()}/${COMPOSE_FILE}`)
    : COMPOSE_FILE;

  let cmd;

  switch (command) {
    // ── 단일 컨테이너 명령 ──
    case 'build':
      cmd = `${rt} build -t ${imageName} .`; break;
    case 'bash':
      cmd = `${rt} exec -it ${imageName} bash`; break;
    case 'test':
      cmd = `${rt} exec -it ${imageName} npx vitest run`; break;
    case 'test:pty':
      cmd = `${rt} exec -it ${imageName} npx vitest run tests/agent/pty/`; break;

    // ── compose 명령 ──
    case 'compose:build':
      cmd = `${rt} compose -f ${composeFile} build ${args.join(' ')}`.trim(); break;
    case 'compose:up':
      cmd = `${rt} compose -f ${composeFile} up -d ${args.join(' ')}`.trim(); break;
    case 'compose:down':
      cmd = `${rt} compose -f ${composeFile} down -v`; break;
    case 'compose:logs':
      cmd = `${rt} compose -f ${composeFile} logs -f orchestrator`; break;
    case 'compose:restart':
      cmd = `${rt} compose -f ${composeFile} restart orchestrator`; break;
    case 'ps':
      cmd = `${rt} ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'`; break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Commands: build, bash, test, test:pty, compose:build, compose:up, compose:down, compose:logs, compose:restart, ps');
      process.exit(1);
  }

  // WSL 모드: bash -c 래핑 + DOCKER_HOST 설정
  const execCmd = wrapCommand(info, cmd);

  console.log(`mode: ${info.mode} | runtime: ${rt}`);
  console.log(`exec: ${execCmd}\n`);

  execSync(execCmd, { stdio: 'inherit' });
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}
