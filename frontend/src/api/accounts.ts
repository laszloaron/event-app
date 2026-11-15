/** Auth and account endpoints (architecture.md §3 "Auth & account"; US-06 login, US-20). */
import { request } from "./client";
import type { LoginIn, MeOut, OkOut, OrganizerRequestOut, RegisterIn, UserOut } from "./schema";

export function login(body: LoginIn): Promise<UserOut> {
  return request("POST", "/auth/login", { body });
}

export function register(body: RegisterIn): Promise<UserOut> {
  return request("POST", "/auth/register", { body });
}

export function logout(): Promise<OkOut> {
  return request("POST", "/auth/logout");
}

/** The logged-in user; rejects with status 401 when nobody is logged in. */
export function getMe(): Promise<MeOut> {
  return request("GET", "/me");
}

/** "Become an organizer" (US-20); 409 while a request is pending. */
export function requestOrganizer(): Promise<OrganizerRequestOut> {
  return request("POST", "/me/organizer-request");
}
