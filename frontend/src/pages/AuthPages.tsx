import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Eye, EyeOff, Info, MapPinned } from "lucide-react";
import { Banner, Button, IconButton, TextField } from "../components/ui";
import { eventDetails } from "../mocks/data";
import { useSession } from "../session/session";
import { useBack } from "../routing/useBack";
import { safeNext } from "../routing/safeNext";

/** Shared frame: back arrow, centred logo + title, white card (ui_design.md §5.6). */
function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  const back = useBack("/");
  return (
    <div className="p-auth">
      <div className="p-auth__back">
        <IconButton label="Back" icon={<ArrowLeft size={24} />} onClick={back} />
      </div>
      <div className="p-auth__card">
        <span className="p-auth__logo" aria-hidden>
          <MapPinned size={48} />
        </span>
        <h1 className="t-title-xl p-auth__title">{title}</h1>
        {children}
      </div>
    </div>
  );
}

function PasswordField({ label, required }: { label: string; required?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      label={label}
      required={required}
      type={visible ? "text" : "password"}
      autoComplete="current-password"
      trailing={
        <IconButton
          label={visible ? "Hide password" : "Show password"}
          icon={visible ? <EyeOff size={20} /> : <Eye size={20} />}
          onClick={() => setVisible((value) => !value)}
        />
      }
    />
  );
}

/** Placeholder login: any input (or none) logs you in (no password check yet). */
function useFakeLogin(): (event: FormEvent) => void {
  const { login } = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  return (event: FormEvent) => {
    event.preventDefault();
    login();
    navigate(safeNext(params.get("next")), { replace: true });
  };
}

/** `/login` (ui_design.md §5.6). */
export function LoginPage() {
  const submit = useFakeLogin();
  const [params] = useSearchParams();
  const eventId = /^\/events\/(\d+)/.exec(params.get("next") ?? "")?.[1];
  const event = eventDetails.find((item) => String(item.id) === eventId);
  return (
    <AuthFrame title="Log in">
      <form className="p-auth__form" onSubmit={submit}>
        {event && (
          <Banner variant="info" icon={<Info size={18} />}>
            Log in to RSVP to <em>{event.title}</em>
          </Banner>
        )}
        <TextField label="Username" autoComplete="username" autoFocus />
        <PasswordField label="Password" />
        <Button type="submit" size="l" fullWidth>
          Log in
        </Button>
      </form>
      <p className="t-body-s p-auth__switch">
        No account? <Link to={`/register?${params.toString()}`}>Create one</Link>
      </p>
    </AuthFrame>
  );
}

/** `/register` (ui_design.md §5.6). */
export function RegisterPage() {
  const submit = useFakeLogin();
  const [params] = useSearchParams();
  return (
    <AuthFrame title="Create account">
      <form className="p-auth__form" onSubmit={submit}>
        <TextField label="Username" required helper="Shown to organizers" autoComplete="username" autoFocus />
        <TextField label="Email" required type="email" inputMode="email" autoComplete="email" />
        <PasswordField label="Password" required />
        <Button type="submit" size="l" fullWidth>
          Create account
        </Button>
      </form>
      <p className="t-body-s p-auth__switch">
        Already have an account? <Link to={`/login?${params.toString()}`}>Log in</Link>
      </p>
    </AuthFrame>
  );
}
