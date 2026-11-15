import { useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, FileText, Trash2 } from "lucide-react";
import { deleteDraft, listMyDrafts } from "../api/events";
import { Button, ConfirmDialog, EmptyState, Fab, IconButton, ListRow, Skeleton, Tag, TopBar } from "../components/ui";
import { SportBadge } from "../components/domain";
import { useApi, useRefresh } from "../hooks/data";
import { useToast } from "../hooks/toast";
import { browserTimeZone } from "../utils/dates";
import { formatAgo, formatDay } from "../utils/format";

/** `/account/drafts` – the organizer's own unpublished events (ui_design.md §5.11, US-25). */
export function DraftsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const refresh = useRefresh();
  const drafts = useApi(listMyDrafts, []);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    if (deleting === null) return;
    setBusy(true);
    try {
      await deleteDraft(deleting);
      toast("Draft deleted");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
      setDeleting(null);
      refresh();
    }
  };

  return (
    <>
      <TopBar leading={<IconButton label="Back" icon={<ArrowLeft size={24} />} onClick={() => navigate("/account")} />} title="My drafts" />
      <div className="l-page-body">
        {drafts.loading && (
          <div className="l-page-padded l-stack">
            {[0, 1].map((key) => (
              <Skeleton key={key} height={56} />
            ))}
          </div>
        )}
        {drafts.error && <EmptyState icon={<FileText size={48} />} title="Couldn't load drafts" text={drafts.error.message} actions={<Button onClick={drafts.reload}>Try again</Button>} />}
        {drafts.data?.length === 0 && <EmptyState icon={<FileText size={48} />} title="No drafts" text="Events you save as draft appear here." />}
        {drafts.data?.map((draft) => (
          <ListRow
            key={draft.id}
            leading={<SportBadge sport={draft.sport} />}
            title={draft.title || <span className="p-untitled">Untitled draft</span>}
            meta={[draft.start_at ? formatDay(draft.start_at, browserTimeZone()) : "Date not set"]}
            onClick={() => navigate(`/events/${draft.id}/edit`)}
            trailing={<IconButton label="Delete draft" icon={<Trash2 size={20} />} onClick={() => setDeleting(draft.id)} />}
          >
            <span className="p-draft-meta">
              <Tag variant="draft">Draft</Tag>
              <span className="t-caption t-muted">Edited {formatAgo(draft.updated_at)}</span>
            </span>
          </ListRow>
        ))}
      </div>
      <Fab label="Create event" onClick={() => navigate("/events/new")} />
      {deleting !== null && (
        <ConfirmDialog
          title="Delete this draft?"
          message="The draft will be removed. This cannot be undone."
          confirmLabel={busy ? "Deleting…" : "Delete draft"}
          onConfirm={() => void confirmDelete()}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}
