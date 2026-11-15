import { useNavigate } from "react-router";
import { MapPinOff } from "lucide-react";
import { Button, EmptyState } from "../components/ui";

/** Unknown URL (ui_design.md §5.13). */
export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <div className="p-centered">
      <EmptyState
        icon={<MapPinOff size={48} />}
        title="This page doesn't exist"
        actions={<Button onClick={() => navigate("/")}>Back to the map</Button>}
      />
    </div>
  );
}
