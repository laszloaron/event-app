import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, UserCheck } from "lucide-react";
import { EmptyState, IconButton, Tabs, TopBar } from "../components/ui";
import { AuditRow, RequestCard } from "../components/domain";
import { auditLog, organizerRequests } from "../mocks/data";

type Tab = "requests" | "audit-log";

/** `/admin/requests` and `/admin/audit-log` (ui_design.md §5.12, US-21/17/18). */
export function ModerationPage({ tab }: { tab: Tab }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState<number | null>(null);
  return (
    <>
      <TopBar leading={<IconButton label="Back" icon={<ArrowLeft size={24} />} onClick={() => navigate("/account")} />} title="Moderation" />
      <Tabs
        value={tab}
        onChange={(next) => navigate(`/admin/${next}`, { replace: true })}
        items={[
          { value: "requests", label: `Organizer requests (${organizerRequests.length})` },
          { value: "audit-log", label: "Audit log" },
        ]}
      />
      <div className="l-page-body">
        {tab === "requests" ? (
          organizerRequests.length === 0 ? (
            <EmptyState icon={<UserCheck size={48} />} title="No pending requests" />
          ) : (
            <div className="l-page-padded l-stack">
              {organizerRequests.map((request) => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>
          )
        ) : (
          auditLog.map((entry) => (
            <AuditRow
              key={entry.id}
              entry={entry}
              expanded={expanded === entry.id}
              onToggle={() => setExpanded((current) => (current === entry.id ? null : entry.id))}
            />
          ))
        )}
      </div>
    </>
  );
}
