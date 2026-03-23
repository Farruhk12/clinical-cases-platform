import type { Role } from "./db";

export type AppUser = {
  id: string;
  login: string;
  name: string | null;
  role: Role;
  departmentId: string | null;
};

export type AppSession = { user: AppUser };
