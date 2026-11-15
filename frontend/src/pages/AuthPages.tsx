import { useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Info, MapPinned } from "lucide-react";
import { getEvent } from "../api/events";
import { ApiError } from "../api/client";
import { Banner, Button, IconButton, TextField } from "../components/ui";
import { useApi } from "../hooks/data";
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

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  required?: boolean;
  error?: string;
}

function PasswordField({ label, value, onChange, autoComplete, required, error }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      label={label}
      required={required}
      type={visible ? "text" : "password"}
      autoComplete={autoComplete}
      value={value}
      error={error}
      onChange={(e) => onChange(e.target.value)}
      trailing={
        <IconButton
          label={visible ? "Hide password" : "Show password"}
          icon={visible ? <EyeOff size={20} /> : <Eye size={20} />}
          onClick={() => setVisible((current) => !current)}
        />
      }
    />
  );
}

type FieldErrors = Partial<Record<"username" | "email" | "password", string>>;

/**
 * Submits a login/register form: errors with a `field` go under that field, others into the red
 * Banner (§5.6); success goes to the safe `next` path (US-06 "back to the card after logging in").
 */
function useAuthSubmit(send: () => Promise<void>) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    setFieldErrors({});
    try {
      await send();
      navigate(safeNext(params.get("next")), { replace: true });
    } catch (error) {
      const field = error instanceof ApiError ? error.field : null;
      const message = error instanceof Error ? error.message : "Something went wrong. Try again.";
      if (field === "username" || field === "email" || field === "password") setFieldErrors({ [field]: message });
      else setFormError(message);
    } finally {
      setBusy(false);
    }
  };
  return { submit, busy, formError, fieldErrors, params };
}

function FormError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <Banner variant="danger" icon={<AlertTriangle size={18} />}>
      {message}
    </Banner>
  );
}

/** `/login` (ui_design.md §5.6). Shows which event the user wanted to RSVP to (US-06). */
export function LoginPage() {
  const { login } = useSession();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { submit, busy, formError, fieldErrors, params } = useAuthSubmit(() => login({ username: username.trim(), password }));
  const eventId = Number(/^\/events\/(\d+)$/.exec(params.get("next") ?? "")?.[1]);
  const event = useApi(eventId ? () => getEvent(eventId) : null, [eventId]).data;

  return (
    <AuthFrame title="Log in">
      <form className="p-auth__form" onSubmit={(e) => void submit(e)}>
        {event && (
          <Banner variant="info" icon={<Info size={18} />}>
            Log in to RSVP to <em>{event.title}</em>
          </Banner>
        )}
        <TextField label="Username" autoComplete="username" autoFocus required value={username} error={fieldErrors.username} onChange={(e) => setUsername(e.target.value)} />
        <PasswordField label="Password" autoComplete="current-password" required value={password} error={fieldErrors.password} onChange={setPassword} />
        <FormError message={formError} />
        <Button type="submit" size="l" fullWidth loading={busy} disabled={!username.trim() || !password}>
          Log in
        </Button>
      </form>
      <p className="t-body-s p-auth__switch">
        No account? <Link to={`/register?${params.toString()}`}>Create one</Link>
      </p>
    </AuthFrame>
  );
}

/** `/register` (ui_design.md §5.6). The backend checks email format and password strength. */
export function RegisterPage() {
  const { register } = useSession();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { submit, busy, formError, fieldErrors, params } = useAuthSubmit(() => register({ username: username.trim(), email: email.trim(), password }));

  return (
    <AuthFrame title="Create account">
      <form className="p-auth__form" onSubmit={(e) => void submit(e)}>
        <TextField
          label="Username"
          required
          helper="Shown to organizers"
          autoComplete="username"
          autoFocus
          value={username}
          error={fieldErrors.username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <TextField
          label="Email"
          required
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          error={fieldErrors.email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordField label="Password" autoComplete="new-password" required value={password} error={fieldErrors.password} onChange={setPassword} />
        <FormError message={formError} />
        <Button type="submit" size="l" fullWidth loading={busy} disabled={!username.trim() || !email.trim() || !password}>
          Create account
        </Button>
      </form>
      <p className="t-body-s p-auth__switch">
        Already have an account? <Link to={`/login?${params.toString()}`}>Log in</Link>
      </p>
    </AuthFrame>
  );
}
