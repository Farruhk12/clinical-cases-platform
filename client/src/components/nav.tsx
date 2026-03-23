import { Link, NavLink } from "react-router-dom";
import type { Role } from "~types/db";
import { useAuth } from "@/auth-context";
import { IconStethoscope } from "@/components/icons";

const links: { href: string; label: string; roles: Role[] }[] = [
  { href: "/dashboard", label: "Главная", roles: ["ADMIN", "TEACHER"] },
  { href: "/cases", label: "Кейсы", roles: ["ADMIN", "TEACHER"] },
  { href: "/sessions", label: "Сессии", roles: ["ADMIN", "TEACHER"] },
];

const adminNav: { to: string; label: string; end?: boolean }[] = [
  { to: "/admin", label: "Обзор", end: true },
  { to: "/admin/users", label: "Пользователи" },
  { to: "/admin/references", label: "Справочники" },
];

export function NavBar({
  role,
  login,
}: {
  role: Role;
  login?: string | null;
}) {
  const { signOut } = useAuth();
  const visible = links.filter((l) => l.roles.includes(role));

  return (
    <header className="sticky top-0 z-40 border-b border-mist-200/80 bg-white/70 shadow-sm backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-5 lg:gap-8">
          <Link
            to="/dashboard"
            className="group flex shrink-0 items-center gap-2 font-display font-semibold text-brand-700 transition hover:text-brand-800"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-100 to-mist-100 text-brand-600 shadow-sm transition group-hover:shadow-card">
              <IconStethoscope className="h-5 w-5" />
            </span>
            <span className="hidden sm:inline">Клинические кейсы</span>
          </Link>
          <nav
            className="flex flex-wrap gap-1 text-sm sm:gap-2"
            aria-label="Основной раздел"
          >
            {visible.map((l) => (
              <Link
                key={l.href}
                to={l.href}
                className="rounded-lg px-3 py-1.5 font-medium text-slate-600 transition hover:bg-brand-50 hover:text-brand-800"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-sm sm:gap-3">
          <span className="hidden max-w-[10rem] truncate rounded-lg bg-mist-50 px-3 py-1.5 text-slate-600 sm:inline sm:max-w-[14rem]">
            {login}
          </span>
          <button
            type="button"
            className="rounded-xl border border-mist-200 bg-white/90 px-3 py-2 font-medium text-slate-700 shadow-sm transition hover:border-brand-200 hover:bg-brand-50/80 hover:text-brand-800"
            onClick={() => void signOut()}
          >
            Выйти
          </button>
        </div>
      </div>
      {role === "ADMIN" ? (
        <div className="border-t border-mist-100/90 bg-gradient-to-r from-mist-50/95 via-white/60 to-brand-50/40 backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2.5 text-sm">
            <span className="shrink-0 text-xs font-bold uppercase tracking-widest text-brand-600/90">
              Админ
            </span>
            <nav
              className="flex flex-wrap gap-x-1 gap-y-1"
              aria-label="Администрирование"
            >
              {adminNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      "rounded-lg px-3 py-1.5 font-medium transition",
                      isActive
                        ? "bg-white text-brand-800 shadow-sm ring-1 ring-brand-200/60"
                        : "text-slate-600 hover:bg-white/70 hover:text-brand-800",
                    ].join(" ")
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
