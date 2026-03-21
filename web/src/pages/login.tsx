import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStatus, useLogin, type AuthUser } from "../hooks/use-auth";
import { useI18n } from "../i18n";
import { api } from "../api/client";

/** 좌측 아트 패널: samples/better-chatbot-login.png 레퍼런스
 *  - 흰/밝은 배경 + 흑색 커브 라인 (하단부에서 올라오는 곡선)
 *  - 좌상단에 브랜드 ("< SoulFlow")
 *  - 좌하단에 한 줄 설명 */
function ArtPanel() {
  return (
    <div className="login-page__art" aria-hidden="true">
      {/* 브랜드 — 좌상단 */}
      <div className="login-page__art-brand login-page__art-brand--top">
        <span className="login-page__art-logo">SF</span>
        <span className="login-page__art-tagline">SoulFlow</span>
      </div>

      <svg
        className="login-page__art-svg"
        viewBox="0 0 480 640"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="curve-dark" x1="0" y1="640" x2="480" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1a1a1a" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#333" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#666" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="curve-mid" x1="0" y1="640" x2="480" y2="200" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#222" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#888" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* 하단에서 올라오는 흑색 커브 라인 — 레퍼런스처럼 */}
        <path d="M-60 640 C20 580 100 520 200 500 S360 480 520 440" stroke="url(#curve-dark)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M-40 640 C40 590 140 540 240 510 S400 470 540 420" stroke="url(#curve-dark)" strokeWidth="0.8" strokeLinecap="round" />
        <path d="M-20 640 C60 600 160 550 260 530 S420 500 560 450" stroke="url(#curve-mid)" strokeWidth="1.0" strokeLinecap="round" />
        <path d="M0 640 C80 610 180 560 280 540 S440 510 580 460" stroke="url(#curve-mid)" strokeWidth="0.6" strokeLinecap="round" />
        <path d="M20 640 C100 615 200 570 300 545 S450 515 590 470" stroke="url(#curve-dark)" strokeWidth="0.5" strokeLinecap="round" />
        <path d="M40 640 C120 618 220 575 320 548 S460 518 600 475" stroke="url(#curve-mid)" strokeWidth="0.4" strokeLinecap="round" />
        <path d="M60 640 C140 620 240 580 340 555 S470 525 610 485" stroke="url(#curve-dark)" strokeWidth="0.3" strokeLinecap="round" />
        <path d="M-80 640 C0 570 80 500 180 475 S340 450 500 410" stroke="url(#curve-dark)" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M-100 640 C-20 560 60 480 160 450 S320 420 480 380" stroke="url(#curve-mid)" strokeWidth="1.0" strokeLinecap="round" />
        <path d="M-120 640 C-40 550 40 460 140 430 S300 400 460 360" stroke="url(#curve-dark)" strokeWidth="0.7" strokeLinecap="round" />
      </svg>

      {/* 좌하단 설명 */}
      <div className="login-page__art-footer">
        SoulFlow Orchestrator &mdash; AI 에이전트 런타임
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { data: auth_status, isLoading: status_loading } = useAuthStatus();

  if (status_loading) {
    return (
      <div className="login-page">
        <ArtPanel />
        <div className="login-page__form">
          <div className="login-card">
            <div className="skeleton skeleton--row" style={{ height: 32 }} />
          </div>
        </div>
      </div>
    );
  }

  if (auth_status && !auth_status.initialized) {
    return (
      <div className="login-page">
        <ArtPanel />
        <div className="login-page__form">
          <SetupForm />
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <ArtPanel />
      <div className="login-page__form">
        <LoginForm />
      </div>
    </div>
  );
}

/** 첫 실행: superadmin 계정 생성 폼. */
function SetupForm() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setup = useMutation({
    mutationFn: (creds: { username: string; password: string }) =>
      api.post<{ ok: boolean; username: string; role: string }>("/api/auth/setup", creds),
    onSuccess: () => {
      qc.clear();
      void qc.prefetchQuery({
        queryKey: ["auth-me"],
        queryFn: async () => {
          try { return await api.get<AuthUser>("/api/auth/me"); }
          catch { return null; }
        },
      });
      navigate("/", { replace: true });
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError("비밀번호가 일치하지 않습니다."); return; }
    if (password.length < 6) { setError("비밀번호는 6자 이상이어야 합니다."); return; }
    if (username.trim().length < 2) { setError("아이디는 2자 이상이어야 합니다."); return; }
    setup.mutate({ username: username.trim(), password }, {
      onError: () => setError("설정에 실패했습니다. 다시 시도해주세요."),
    });
  };

  return (
    <form className="login-card" onSubmit={submit}>
      <h1 className="login-card__title">{t("login.welcome")}</h1>
      <p className="login-card__subtitle">{t("login.setup_subtitle")}</p>

      {error && (
        <div className="login-card__error" role="alert">{error}</div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="setup-username">관리자 아이디</label>
        <input
          id="setup-username"
          className="form-input"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          disabled={setup.isPending}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="setup-password">비밀번호 (6자 이상)</label>
        <input
          id="setup-password"
          className="form-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          disabled={setup.isPending}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="setup-confirm">비밀번호 확인</label>
        <input
          id="setup-confirm"
          className="form-input"
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
          disabled={setup.isPending}
        />
      </div>

      <button
        className="btn btn--primary btn--full"
        type="submit"
        disabled={setup.isPending || !username || !password || !confirm}
      >
        {setup.isPending ? "생성 중..." : "관리자 계정 생성"}
      </button>
    </form>
  );
}

/** 일반 로그인 폼. */
function LoginForm() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const login = useLogin();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login.mutateAsync({ username: username.trim(), password });
      navigate("/", { replace: true });
    } catch {
      setError("아이디 또는 비밀번호가 올바르지 않습니다.");
    }
  };

  return (
    <form className="login-card" onSubmit={submit}>
      <h1 className="login-card__title">{t("login.welcome")}</h1>
      <p className="login-card__subtitle">{t("login.subtitle")}</p>

      {error && (
        <div className="login-card__error" role="alert">{error}</div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="login-username">Email</label>
        <input
          id="login-username"
          className="form-input"
          type="text"
          placeholder="user@example.com"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoFocus
          disabled={login.isPending}
        />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="login-password">비밀번호</label>
        <input
          id="login-password"
          className="form-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={login.isPending}
        />
      </div>

      <button
        className="btn btn--primary btn--full"
        type="submit"
        disabled={login.isPending || !username || !password}
      >
        {login.isPending ? "로그인 중..." : t("login.submit")}
      </button>

      {/* 엔터프라이즈: 관리자가 계정 관리 — 회원가입 불필요 */}
    </form>
  );
}
