import { useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import type { NotificationOut } from "../api/schema";
import { listNotifications, markRead } from "../api/inbox";
import { Button, EmptyState, Skeleton, TopBar } from "../components/ui";
import { InboxRow } from "../components/domain";
import { useApi } from "../hooks/data";
import { useToast } from "../hooks/toast";
import { useOpenEvent } from "../routing/useOpenEvent";
import { useSession } from "../session/session";

/**
 * `/inbox` – messages newest first, one expanded at a time (ui_design.md §5.8, US-22).
 * Opening a message marks it as read and updates the unread badge.
 */
export function InboxPage() {
  const openEvent = useOpenEvent();
  const toast = useToast();
  const { refresh: refreshSession } = useSession();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pages, setPages] = useState(1);
  const first = useApi(() => listNotifications(1), []);
  const [older, setOlder] = useState<NotificationOut[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Ids read in this visit, so the row turns "read" at once without reloading the list. */
  const [readNow, setReadNow] = useState<Set<number>>(new Set());

  // A reload of page 1 (after any write) restarts paging, so no message is listed twice.
  useEffect(() => {
    setOlder([]);
    setPages(1);
  }, [first.data]);

  const messages = [...(first.data?.items ?? []), ...older];
  const total = first.data?.count ?? 0;

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const next = await listNotifications(pages + 1);
      setOlder((list) => [...list, ...next.items]);
      setPages((value) => value + 1);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setLoadingMore(false);
    }
  };

  const toggle = (message: NotificationOut) => {
    setExpanded((current) => (current === message.id ? null : message.id));
    if (message.is_read || readNow.has(message.id)) return;
    setReadNow((ids) => new Set(ids).add(message.id));
    markRead(message.id).then(
      () => void refreshSession(),
      () => undefined,
    );
  };

  return (
    <>
      <TopBar title="Inbox" />
      <div className="l-page-body">
        {first.loading && (
          <div className="l-page-padded l-stack">
            {[0, 1, 2].map((key) => (
              <Skeleton key={key} height={56} />
            ))}
          </div>
        )}
        {first.error && <EmptyState icon={<Inbox size={48} />} title="Couldn't load messages" text={first.error.message} actions={<Button onClick={first.reload}>Try again</Button>} />}
        {first.data && messages.length === 0 && <EmptyState icon={<Inbox size={48} />} title="No messages yet" text="Changes to events you're going to show up here." />}
        {messages.map((message) => (
          <InboxRow
            key={message.id}
            message={readNow.has(message.id) ? { ...message, is_read: true } : message}
            expanded={expanded === message.id}
            onToggle={() => toggle(message)}
            onOpenEvent={openEvent}
          />
        ))}
        {messages.length < total && (
          <div className="l-page-padded">
            <Button variant="secondary" fullWidth loading={loadingMore} onClick={() => void loadMore()}>
              Show older messages
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
