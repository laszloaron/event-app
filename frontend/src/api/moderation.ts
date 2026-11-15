/** Admin endpoints (US-17/18/21). */
import { request } from "./client";
import type { AuditLogOut, OrganizerRequestAdminOut } from "./schema";

export function listPendingRequests(): Promise<OrganizerRequestAdminOut[]> {
  return request("GET", "/admin/organizer-requests", { query: { status: "pending" } });
}

export function approveRequest(id: number): Promise<OrganizerRequestAdminOut> {
  return request("POST", `/admin/organizer-requests/${id}/approve`);
}

export function rejectRequest(id: number): Promise<OrganizerRequestAdminOut> {
  return request("POST", `/admin/organizer-requests/${id}/reject`);
}

export function listAuditLog(): Promise<AuditLogOut[]> {
  return request("GET", "/admin/audit-log");
}
