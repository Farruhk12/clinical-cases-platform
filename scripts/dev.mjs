import { spawn } from "node:child_process";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });

function portAvailable(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    const finish = (ok) => {
      s.removeAllListeners();
      s.close(() => resolve(ok));
    };
    s.once("error", () => finish(false));
    s.listen({ port, host: "127.0.0.1", exclusive: true }, () => finish(true));
  });
}

async function pickPort(preferred) {
  const start = Number(preferred);
  const base = Number.isFinite(start) && start > 0 ? start : 3001;
  for (let p = base; p < base + 80; p++) {
    if (await portAvailable(p)) return p;
  }
  throw new Error(
    `Не найден свободный порт TCP (пробовал ${base}…${base + 79}).`,
  );
}

const preferred = process.env.PORT || "3001";
const apiPort = await pickPort(preferred);

if (String(apiPort) !== String(preferred)) {
  console.log(
    `[dev] Порт ${preferred} занят → API и прокси Vite на ${apiPort}.`,
  );
} else {
  console.log(`[dev] API на порту ${apiPort}`);
}

const childEnv = {
  ...process.env,
  PORT: String(apiPort),
  VITE_DEV_API_PORT: String(apiPort),
};

const tsxCli = path.join(root, "node_modules", "tsx", "dist", "cli.mjs");
const viteCli = path.join(root, "node_modules", "vite", "bin", "vite.js");

const apiChild = spawn(process.execPath, [tsxCli, "watch", "server/index.ts"], {
  stdio: "inherit",
  cwd: root,
  env: childEnv,
});

const uiChild = spawn(process.execPath, [viteCli], {
  stdio: "inherit",
  cwd: root,
  env: childEnv,
});

console.log(`[dev] UI  → http://localhost:5173/`);
console.log(`[dev] API → http://127.0.0.1:${apiPort}/`);

let stopping = false;
function shutdown(exitCode) {
  if (stopping) return;
  stopping = true;
  try {
    apiChild.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  try {
    uiChild.kill("SIGTERM");
  } catch {
    /* ignore */
  }
  setTimeout(() => process.exit(exitCode), 200);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

apiChild.on("exit", (code) => {
  if (stopping) return;
  console.error(`[dev] API остановился (код ${code}). Закрываю Vite.`);
  shutdown(code === 0 ? 0 : code ?? 1);
});

uiChild.on("exit", (code) => {
  if (stopping) return;
  console.error(`[dev] Vite остановился (код ${code}). Закрываю API.`);
  shutdown(code === 0 ? 0 : code ?? 1);
});
