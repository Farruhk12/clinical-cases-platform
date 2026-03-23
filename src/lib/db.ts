import postgres from "postgres";

const globalForSql = globalThis as unknown as {
  sql: ReturnType<typeof postgres> | undefined;
};

/**
 * В типах postgres.js у TransactionSql нет перегрузки вызова как tagged template,
 * хотя в рантайме это тот же интерфейс, что и Sql.
 */
export function asTransactionSql<S extends postgres.Sql>(
  _pool: S,
  txn: postgres.TransactionSql,
): S {
  return txn as unknown as S;
}

/** Прямое подключение к Postgres Supabase (строка из Dashboard → Database → URI). */
export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  if (!globalForSql.sql) {
    globalForSql.sql = postgres(url, {
      max: 12,
      idle_timeout: 20,
      connect_timeout: 30,
      prepare: false,
    });
  }
  return globalForSql.sql;
}
