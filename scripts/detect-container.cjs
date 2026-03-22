/**
 * Docker/Podman 자동 감지 모듈
 *
 * 감지 순서 (Windows):
 *   1. podman ps (SSH 터널 정상)
 *   2. wsl -d podman-machine-default -- podman ps (SSH 터널 끊김, WSL 직접)
 *   3. docker ps (Rancher Desktop / Docker Desktop)
 *
 * 감지 순서 (Linux/macOS):
 *   1. docker ps
 *   2. podman ps
 *
 * 반환값:
 *   - mode: "native" | "wsl"
 *   - runtime: "podman" | "docker"
 *   - wsl_distro: WSL 모드 시 배포판 이름 (e.g. "podman-machine-default")
 */

const { execSync } = require('child_process');

function isCommandAvailable(cmd) {
  try {
    const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(checkCmd, { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

function canRun(cmd) {
  try { execSync(cmd, { stdio: 'ignore', timeout: 10_000 }); return true; }
  catch { return false; }
}

const WSL_DISTRO = 'podman-machine-default';
const WSL_DOCKER_HOST = 'unix:///run/user/1000/podman/podman.sock';

function detect() {
  const isWindows = process.platform === 'win32';
  const hasPodman = isCommandAvailable('podman');
  const hasDocker = isCommandAvailable('docker');

  // Windows: Podman 우선
  if (isWindows && hasPodman) {
    if (canRun('podman ps')) return { mode: 'native', runtime: 'podman' };
    if (canRun(`wsl -d ${WSL_DISTRO} -- podman ps`)) return { mode: 'wsl', runtime: 'podman', wsl_distro: WSL_DISTRO };
  }
  if (hasDocker && canRun('docker ps')) return { mode: 'native', runtime: 'docker' };
  if (!isWindows && hasPodman && canRun('podman ps')) return { mode: 'native', runtime: 'podman' };

  // 설치되어 있지만 실행 불가 — WSL fallback 재시도 (Windows)
  if (isWindows && hasPodman) {
    console.warn('⚠️  Podman SSH 터널 끊김 — WSL 직접 실행 모드로 전환합니다.');
    return { mode: 'wsl', runtime: 'podman', wsl_distro: WSL_DISTRO };
  }

  if (hasPodman || hasDocker) {
    const names = [hasPodman && 'Podman', hasDocker && 'Docker'].filter(Boolean);
    console.warn(`⚠️  ${names.join('/')} 설치됨, 실행 불가. 데몬을 확인하세요.`);
    return { mode: 'native', runtime: hasPodman ? 'podman' : 'docker' };
  }

  throw new Error('❌ Docker/Podman을 찾을 수 없습니다.');
}

/** Windows 경로 → WSL 마운트 경로. D:\foo → /mnt/d/foo */
function toWslPath(p) {
  return p.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, d) => `/mnt/${d.toLowerCase()}`);
}

/**
 * 명령 실행 래퍼. WSL 모드에서는 bash -c "..." 형태로 감싸고
 * DOCKER_HOST + cwd를 자동 설정한다.
 */
function wrapCommand(info, cmd, opts = {}) {
  if (info.mode !== 'wsl') return cmd;
  const cwd = opts.cwd || process.cwd();
  const wslCwd = toWslPath(cwd);
  // bash -c 내부 처리: Windows 경로 역슬래시→슬래시, 이중 따옴표 이스케이프
  // \t (탭) 등 이스케이프 시퀀스는 보존
  const inner = cmd.replace(/\\(?![tnr])/g, '/').replace(/"/g, '\\"');
  // Rancher Desktop credential helper 충돌 방지:
  // WSL 내에 no-op shim을 사전 배치하고, bash -c 내에서 PATH 참조 없이 실행
  try {
    execSync(`wsl -d ${info.wsl_distro} -- bash -c "mkdir -p /tmp/.podman-shim && printf '#!/bin/sh\\necho {}\\n' > /tmp/.podman-shim/docker-credential-secretservice && chmod +x /tmp/.podman-shim/docker-credential-secretservice && ln -sf '/mnt/c/Program Files/Rancher Desktop/resources/resources/linux/docker-cli-plugins/docker-compose' /tmp/.podman-shim/docker-compose 2>/dev/null; pkill -f 'podman system service' 2>/dev/null; nohup podman system service --timeout 0 unix:///run/user/1000/podman/podman.sock > /dev/null 2>&1 &"`, { stdio: 'ignore' });
  } catch { /* shim already exists or WSL issue -- continue anyway */ }
  // shim 디렉토리: credential no-op + docker-compose 심볼릭 링크
  try {
    execSync(`wsl -d ${info.wsl_distro} -- bash -c "mkdir -p /tmp/.podman-shim && printf '#!/bin/sh\\necho {}\\n' > /tmp/.podman-shim/docker-credential-secretservice && chmod +x /tmp/.podman-shim/docker-credential-secretservice && ln -sf '/mnt/c/Program Files/Rancher Desktop/resources/resources/linux/docker-cli-plugins/docker-compose' /tmp/.podman-shim/docker-compose 2>/dev/null; true"`, { stdio: 'ignore' });
  } catch { /* best effort */ }
  return `wsl -d ${info.wsl_distro} -- bash -c "export DOCKER_HOST=${WSL_DOCKER_HOST} && export PATH=/tmp/.podman-shim:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin && cd ${wslCwd} && ${inner}"`;
}

function getImageName() { return 'soulflow-orchestrator'; }

module.exports = { detect, toWslPath, wrapCommand, getImageName, WSL_DOCKER_HOST };
