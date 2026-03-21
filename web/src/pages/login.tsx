import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStatus, useLogin, type AuthUser } from "../hooks/use-auth";
import { useI18n } from "../i18n";
import { api } from "../api/client";

/** 좌측 아트 패널: 추상 커브 라인 SVG */
function ArtPanel() {
  return (
    <div className="login-page__art" aria-hidden="true">
      <svg
        className="login-page__art-svg"
        viewBox="0 0 480 640"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* 배경 그라디언트 */}
        <defs>
          <linearGradient id="art-bg" x1="0" y1="0" x2="480" y2="640" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent-2, #7c3aed)" stopOpacity="0.06" />
          </linearGradient>
          <linearGradient id="curve-1" x1="0" y1="0" x2="480" y2="640" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="curve-2" x1="480" y1="0" x2="0" y2="640" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--accent-2, #7c3aed)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--accent-2, #7c3aed)" stopOpacity="0.05" />
          </linearGradient>
          <filter id="blur-sm">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* 배경 */}
        <rect width="480" height="640" fill="url(#art-bg)" />

        {/* 커브 라인들 */}
        <path
          d="M-40 120 C80 80 160 200 240 180 S380 100 520 160"
          stroke="url(#curve-1)"
          strokeWidth="1.5"
          strokeLinecap="round"
          filter="url(#blur-sm)"
        />
        <path
          d="M-40 120 C80 80 160 200 240 180 S380 100 520 160"
          stroke="url(#curve-1)"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
        <path
          d="M-40 220 C100 180 180 300 280 270 S420 200 540 250"
          stroke="url(#curve-2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          filter="url(#blur-sm)"
        />
        <path
          d="M-40 220 C100 180 180 300 280 270 S420 200 540 250"
          stroke="url(#curve-2)"
          strokeWidth="0.5"
          strokeLinecap="round"
        />
        <path
          d="M-60 350 C60 310 200 420 320 390 S460 320 560 370"
          stroke="url(#curve-1)"
          strokeWidth="1"
          strokeLinecap="round"
          filter="url(#blur-sm)"
        />
        <path
          d="M-20 450 C120 400 240 500 360 470 S480 410 580 450"
          stroke="url(#curve-2)"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <path
          d="M-60 540 C80 490 220 580 340 560 S480 500 580 540"
          stroke="url(#curve-1)"
          strokeWidth="0.8"
          strokeLinecap="round"
        />

        {/* 원형 장식 */}
        <circle cx="80" cy="180" r="120" fill="var(--accent)" fillOpacity="0.04" />
        <circle cx="380" cy="460" r="160" fill="var(--accent-2, #7c3aed)" fillOpacity="0.04" />
        <circle cx="240" cy="320" r="60" fill="var(--accent)" fillOpacity="0.06" />

        {/* 점 장식 */}
        <circle cx="160" cy="140" r="2" fill="var(--accent)" fillOpacity="0.5" />
        <circle cx="320" cy="200" r="1.5" fill="var(--accent)" fillOpacity="0.4" />
        <circle cx="100" cy="380" r="2" fill="var(--accent-2, #7c3aed)" fillOpacity="0.5" />
        <circle cx="400" cy="300" r="1.5" fill="var(--accent-2, #7c3aed)" fillOpacity="0.4" />
        <circle cx="240" cy="520" r="2" fill="var(--accent)" fillOpacity="0.3" />
      </svg>

      {/* 브랜드 오버레이 */}
      <div className="login-page__art-brand">
        <span className="login-page__art-logo">SF</span>
        <span className="login-page__art-tagline">SoulFlow</span>
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

      {/* OAuth 섹션 */}
      <div className="login-card__divider">
        <span>{t("login.oauth_divider")}</span>
      </div>
      <div className="login-card__oauth">
        <button
          type="button"
          className="btn btn--outline btn--full login-card__oauth-btn"
          onClick={() => { window.location.href = "/api/auth/oauth/google"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </button>
        <button
          type="button"
          className="btn btn--outline btn--full login-card__oauth-btn"
          onClick={() => { window.location.href = "/api/auth/oauth/github"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          GitHub
        </button>
      </div>

      {/* 회원가입 링크 */}
      <p className="login-card__signup">
        {t("login.no_account")} <a href="/signup" className="login-card__signup-link">{t("login.signup")}</a>
      </p>
    </form>
  );
}
