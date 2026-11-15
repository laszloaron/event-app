import { useNavigate } from "react-router";
import { ChevronRight, FileText, LogOut, Plus, ShieldCheck } from "lucide-react";
import { Button, ListRow, Section, Tag, TopBar } from "../components/ui";
import { drafts } from "../mocks/data";
import { useSession } from "../session/session";

/**
 * `/account` (ui_design.md §5.9). Roles are not checked yet, so every section is shown:
 * organizer tools, the "Become an organizer" card and the admin Moderation entry.
 */
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

        <Section title="Organizing" card>
          <div className="p-account__menu">
            <ListRow compact leading={<Plus size={22} />} title="Create event" trailing={<ChevronRight size={20} />} onClick={() => navigate("/events/new")} />
            <ListRow
              compact
              leading={<FileText size={22} />}
              title={`My drafts (${drafts.length})`}
              trailing={<ChevronRight size={20} />}
              onClick={() => navigate("/account/drafts")}
            />
          </div>
        </Section>

        <Section title="Want to publish events?" card>
          <p className="t-body-s t-muted">Ask an admin for organizer rights.</p>
          <div>
            <Button>Become an organizer</Button>
          </div>
        </Section>

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

        <div>
          <Button
            variant="ghost"
            className="p-account__logout"
            icon={<LogOut size={18} />}
            onClick={() => {
              logout();
              navigate("/");
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </>
  );
}
