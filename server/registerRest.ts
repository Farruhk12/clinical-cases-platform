import type { Express } from "express";
import { registerSessionRoutes } from "./session-routes";
import { registerMiscRoutes } from "./misc-routes";
import { registerAdminRoutes } from "./admin-routes";

export function registerRestRoutes(app: Express) {
  registerSessionRoutes(app);
  registerMiscRoutes(app);
  registerAdminRoutes(app);
}
