/** In-app inbox endpoints (US-22). */
import { request } from "./client";
import type { NotificationOut, PagedNotificationOut } from "./schema";

export const INBOX_PAGE_SIZE = 20;

/** Newest first, one page at a time. */
export function listNotifications(page: number): Promise<PagedNotificationOut> {
  return request("GET", "/inbox", { query: { page, page_size: INBOX_PAGE_SIZE } });
}

/** Opening a message marks it as read (US-22). */
export function markRead(id: number): Promise<NotificationOut> {
  return request("POST", `/inbox/${id}/read`);
}
