import { Link, Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/auth-context";
import { PageLoader } from "@/components/PageLoader";
import { IconHome, IconLock, IconSparkle, IconUser } from "@/components/icons";

export function LoginPage() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <main className="flex flex-1 flex-col">
        <PageLoader />
      </main>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await signIn(login.trim(), password);
    setBusy(false);
    if (!res.ok) {
      setError(res.error || "Неверный логин или пароль");
      return;
    }
    navigate("/dashboard", { replace: true });
  }

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-4 py-12 sm:py-16">
      <div
        className="pointer-events-none absolute -right-16 top-8 text-brand-300/40 motion-safe:animate-floaty"
        aria-hidden
      >
        <IconSparkle className="h-28 w-28 sm:h-36 sm:w-36" />
      </div>
      <div
        className="pointer-events-none absolute -left-8 bottom-24 text-brand-200/50 motion-safe:animate-floaty motion-safe:delay-1000"
        aria-hidden
      >
        <IconSparkle className="h-20 w-20 opacity-80" />
      </div>

      <div className="relative z-10 w-full max-w-md motion-safe:animate-fade-up">
        <Link
          to="/"
          className="group mb-8 inline-flex items-center gap-2 text-sm font-medium text-brand-600 transition hover:text-brand-700"
        >
          <IconHome className="h-4 w-4 transition group-hover:-translate-x-0.5" />
          На главную
        </Link>

        <div className="rounded-3xl border border-white/60 bg-white/75 p-8 shadow-card backdrop-blur-md sm:p-10">
          <div className="mb-8 flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-mist-100 text-brand-600 shadow-soft">
              <IconLock className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Вход в платформу
              </h1>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                Образовательная среда для клинических кейсов и групповых сессий.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-5">
            <label className="group flex flex-col gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                <IconUser className="h-4 w-4 text-brand-500" />
                Логин
              </span>
              <input
                className="rounded-xl border border-mist-200 bg-white/90 px-4 py-3 text-slate-900 shadow-sm outline-none ring-brand-300/30 transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-2"
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="username"
                placeholder="Введите логин"
                required
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium text-slate-700">
                <IconLock className="h-4 w-4 text-brand-500" />
                Пароль
              </span>
              <input
                className="rounded-xl border border-mist-200 bg-white/90 px-4 py-3 text-slate-900 shadow-sm outline-none ring-brand-300/30 transition placeholder:text-slate-400 focus:border-brand-300 focus:ring-2"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                required
              />
            </label>
            {error ? (
              <p
                className="rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700 motion-safe:animate-fade-in"
                role="alert"
              >
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="mt-1 rounded-xl bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3.5 text-sm font-semibold text-white shadow-soft transition hover:from-brand-700 hover:to-brand-600 disabled:cursor-not-allowed disabled:opacity-60 motion-safe:active:scale-[0.99]"
            >
              {busy ? "Вход…" : "Войти"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
