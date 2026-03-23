import { Link } from "react-router-dom";
import { useAuth } from "@/auth-context";
import { IconBook, IconClipboard } from "@/components/icons";

export function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-10">
      <div className="motion-safe:animate-fade-up">
        <p className="text-sm font-medium text-brand-600">
          {user.role === "ADMIN" ? "Администратор" : "Преподаватель"}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-900">
          Добро пожаловать{user.name ? `, ${user.name}` : ""}
        </h1>
        <p className="mt-2 text-slate-500">
          Выберите раздел для работы
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Link
          to="/cases"
          className="group rounded-2xl border border-white/80 bg-white/85 p-7 shadow-card backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-brand-200/80 hover:shadow-soft motion-safe:animate-fade-up motion-safe:duration-300"
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-100 text-brand-600 transition group-hover:scale-105">
            <IconBook className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Кейсы
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Создание и редактирование этапов, блоков, эталона для ИИ.
          </p>
        </Link>
        <Link
          to="/sessions"
          className="group rounded-2xl border border-white/80 bg-white/85 p-7 shadow-card backdrop-blur-sm transition hover:-translate-y-0.5 hover:border-brand-200/80 hover:shadow-soft motion-safe:animate-fade-up motion-safe:delay-100 motion-safe:duration-300"
        >
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-mist-100 text-brand-600 transition group-hover:scale-105">
            <IconClipboard className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Сессии
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Запуск прохождения, гипотезы по этапам, итог и экспорт.
          </p>
        </Link>
      </div>
    </div>
  );
}
