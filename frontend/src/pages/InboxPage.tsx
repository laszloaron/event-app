import { useState } from "react";
import { Inbox } from "lucide-react";
import { EmptyState, TopBar } from "../components/ui";
import { InboxRow } from "../components/domain";
import { notifications } from "../mocks/data";
import { useOpenEvent } from "../routing/useOpenEvent";

/** `/inbox` – messages newest first, one expanded at a time (ui_design.md §5.8, US-22). */
export function InboxPage() {
  const openEvent = useOpenEvent();
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <>
      <TopBar title="Inbox" />
      <div className="l-page-body">
        {notifications.length === 0 ? (
          <EmptyState icon={<Inbox size={48} />} title="No messages yet" />
        ) : (
          notifications.map((message) => (
            <InboxRow
              key={message.id}
              message={message}
              expanded={expanded === message.id}
              onToggle={() => setExpanded((current) => (current === message.id ? null : message.id))}
              onOpenEvent={openEvent}
            />
          ))
        )}
      </div>
    </>
  );
}
