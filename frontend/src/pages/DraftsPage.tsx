import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";
import { ConfirmDialog, EmptyState, Fab, IconButton, ListRow, Tag, TopBar } from "../components/ui";
import { SportBadge } from "../components/domain";
import { drafts } from "../mocks/data";
import { formatAgo, formatDay } from "../utils/format";

/** `/account/drafts` – the organizer's unpublished events (ui_design.md §5.11, US-25). */
export function DraftsPage() {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState<number | null>(null);
  return (
    <>
      <TopBar leading={<IconButton label="Back" icon={<ArrowLeft size={24} />} onClick={() => navigate("/account")} />} title="My drafts" />
      <div className="l-page-body">
        {drafts.length === 0 ? (
          <EmptyState icon={<FileText size={48} />} title="No drafts" text="Events you save as draft appear here." />
        ) : (
          drafts.map((draft) => (
            <ListRow
              key={draft.id}
              leading={<SportBadge sport={draft.sport} />}
              title={draft.title || <span className="p-untitled">Untitled draft</span>}
              meta={[draft.start_at ? formatDay(draft.start_at, "Europe/Budapest") : "Date not set"]}
              onClick={() => navigate(`/events/${draft.id}/edit`)}
              trailing={<IconButton label="Delete draft" icon={<Trash2 size={20} />} onClick={() => setDeleting(draft.id)} />}
            >
              <span className="p-draft-meta">
                <Tag variant="draft">Draft</Tag>
                <span className="t-caption t-muted">Edited {formatAgo(draft.updated_at)}</span>
              </span>
            </ListRow>
          ))
        )}
      </div>
      <Fab label="Create event" onClick={() => navigate("/events/new")} />
      {deleting !== null && (
        <ConfirmDialog
          title="Delete this draft?"
          message="The draft will be removed. This cannot be undone."
          confirmLabel="Delete draft"
          onConfirm={() => setDeleting(null)}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
