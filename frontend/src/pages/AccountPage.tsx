import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronRight, FileText, LogOut, Plus, ShieldCheck } from "lucide-react";
import type { MeOut } from "../api/schema";
import { requestOrganizer } from "../api/accounts";
import { listMyDrafts } from "../api/events";
import { Button, ListRow, Section, Tag, TopBar } from "../components/ui";
import { useApi } from "../hooks/data";
import { useToast } from "../hooks/toast";
import { can, useSession } from "../session/session";

/** Organizer tools: Create event, My drafts (US-09, US-25). */
function OrganizingSection() {
  const navigate = useNavigate();
  const drafts = useApi(listMyDrafts, []).data;
  return (
    <Section title="Organizing" card>
      <div className="p-account__menu">
        <ListRow compact leading={<Plus size={22} />} title="Create event" trailing={<ChevronRight size={20} />} onClick={() => navigate("/events/new")} />
        <ListRow
          compact
          leading={<FileText size={22} />}
          title={drafts ? `My drafts (${drafts.length})` : "My drafts"}
          trailing={<ChevronRight size={20} />}
          onClick={() => navigate("/account/drafts")}
        />
      </div>
    </Section>
  );
}

/** "Become an organizer" by request status (US-20): none / rejected → button, pending → status. */
function BecomeOrganizerSection({ status }: { status: MeOut["organizer_request_status"] }) {
  const { refresh } = useSession();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try {
      await requestOrganizer();
      toast("Request sent. An admin will review it.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
      await refresh();
    }
  };

  if (status === "pending") {
    return (
      <Section title="Organizer request" card>
        <div>
          <Tag variant="pending">Pending</Tag>
        </div>
        <p className="t-body-s t-muted">Your request is being reviewed. You'll get a message in your inbox.</p>
      </Section>
    );
  }
  return (
    <Section title="Want to publish events?" card>
      <p className="t-body-s t-muted">Ask an admin for organizer rights.</p>
      {status === "rejected" && <p className="t-body-s t-muted">Your last request was rejected. You can send a new one.</p>}
      <div>
        <Button loading={busy} onClick={() => void send()}>
          Become an organizer
        </Button>
      </div>
    </Section>
  );
}

/** `/account` (ui_design.md §5.9): sections depend on the role (US-19/20/25). */
export function AccountPage() {
  const navigate = useNavigate();
  const { user, logout } = useSession();
  if (!user) return null;

  return (
    <>
      <TopBar title="Account" />
      <div className="l-page-body l-page-padded l-stack">
        <div className="p-account__header">
          <span className="p-account__avatar" aria-hidden>
            {user.username.charAt(0).toUpperCase()}
          </span>
          <div>
            <h2 className="t-title-l">{user.username}</h2>
            <p className="t-body-s t-muted">{user.email}</p>
            <Tag variant="role">{user.role.charAt(0).toUpperCase() + user.role.slice(1)}</Tag>
          </div>
        </div>

        {can.organize(user) && <OrganizingSection />}
        {user.role === "attendee" && <BecomeOrganizerSection status={user.organizer_request_status} />}
        {can.moderate(user) && (
          <Section title="Administration" card>
            <div className="p-account__menu">
              <ListRow
                compact
                leading={<ShieldCheck size={22} />}
                title="Moderation"
                meta={["Organizer requests and audit log"]}
                trailing={<ChevronRight size={20} />}
                onClick={() => navigate("/admin/requests")}
              />
            </div>
          </Section>
        )}

        <div>
          <Button
            variant="ghost"
            className="p-account__logout"
            icon={<LogOut size={18} />}
            onClick={() => {
              void logout().then(() => navigate("/"));
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </>
  );
}
