import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ScrollText, UserCheck } from "lucide-react";
import { approveRequest, listAuditLog, listPendingRequests, rejectRequest } from "../api/moderation";
import { Button, EmptyState, IconButton, Skeleton, Tabs, TopBar } from "../components/ui";
import { AuditRow, RequestCard } from "../components/domain";
import { useApi, useRefresh } from "../hooks/data";
import { useToast } from "../hooks/toast";

type Tab = "requests" | "audit-log";

function Loading() {
  return (
    <div className="l-page-padded l-stack">
      {[0, 1].map((key) => (
        <Skeleton key={key} height={72} />
      ))}
    </div>
  );
}

/** `/admin/requests` and `/admin/audit-log` (ui_design.md §5.12, US-21/17/18). */
export function ModerationPage({ tab }: { tab: Tab }) {
  const navigate = useNavigate();
  const toast = useToast();
  const refresh = useRefresh();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const requests = useApi(listPendingRequests, []);
  const audit = useApi(tab === "audit-log" ? listAuditLog : null, [tab]);

  /** Approve / reject; the user gets an inbox message and the decision is logged (US-21). */
  const decide = async (id: number, approve: boolean, username: string) => {
    setBusy(id);
    try {
      await (approve ? approveRequest(id) : rejectRequest(id));
      toast(approve ? `${username} is now an organizer` : `Request from ${username} rejected`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const pending = requests.data ?? [];
  return (
    <>
      <TopBar leading={<IconButton label="Back" icon={<ArrowLeft size={24} />} onClick={() => navigate("/account")} />} title="Moderation" />
      <Tabs
        value={tab}
        onChange={(next) => navigate(`/admin/${next}`, { replace: true })}
        items={[
          { value: "requests", label: requests.data ? `Organizer requests (${pending.length})` : "Organizer requests" },
          { value: "audit-log", label: "Audit log" },
        ]}
      />
      <div className="l-page-body">
        {tab === "requests" && (
          <>
            {requests.loading && <Loading />}
            {requests.error && <EmptyState icon={<UserCheck size={48} />} title="Couldn't load requests" text={requests.error.message} actions={<Button onClick={requests.reload}>Try again</Button>} />}
            {requests.data && pending.length === 0 && <EmptyState icon={<UserCheck size={48} />} title="No pending requests" />}
            {pending.length > 0 && (
              <div className="l-page-padded l-stack">
                {pending.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    busy={busy === request.id}
                    onApprove={() => void decide(request.id, true, request.user.username)}
                    onReject={() => void decide(request.id, false, request.user.username)}
                  />
                ))}
              </div>
            )}
          </>
        )}
        {tab === "audit-log" && (
          <>
            {audit.loading && <Loading />}
            {audit.error && <EmptyState icon={<ScrollText size={48} />} title="Couldn't load the audit log" text={audit.error.message} actions={<Button onClick={audit.reload}>Try again</Button>} />}
            {audit.data?.length === 0 && <EmptyState icon={<ScrollText size={48} />} title="Nothing logged yet" />}
            {audit.data?.map((entry) => (
              <AuditRow key={entry.id} entry={entry} expanded={expanded === entry.id} onToggle={() => setExpanded((current) => (current === entry.id ? null : entry.id))} />
            ))}
          </>
        )}
      </div>
    </>
  );
}
