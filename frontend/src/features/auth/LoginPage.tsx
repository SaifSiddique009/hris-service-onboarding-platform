import { CircleAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Brand } from "../../components/Brand";
import { Button } from "../../components/Button";
import { Field, Input } from "../../components/Fields";
import { useOnce } from "../../lib/once";
import { useAuth } from "./AuthContext";
import { homePath } from "./roles";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState<{
    email: string;
    error: string;
    fieldError: string;
    done: string;
    busy: boolean;
  } | null>(null);
  const once = useOnce();

  // Go back to the page that was asked for, if it is one of ours.
  const next = new URLSearchParams(location.search).get("next");
  if (user)
    return (
      <Navigate
        to={
          next?.startsWith("/") && !next.startsWith("//")
            ? next
            : homePath(user.role)
        }
        replace
      />
    );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  function askHr(e: FormEvent) {
    e.preventDefault();
    if (!forgot || forgot.busy) return;
    once(async () => {
      setForgot({ ...forgot, busy: true, error: "", fieldError: "" });
      try {
        const res = await api<{ message: string }>("/auth/forgot-password", {
          method: "POST",
          body: JSON.stringify({ email: forgot.email }),
        });
        setForgot({
          ...forgot,
          busy: false,
          error: "",
          fieldError: "",
          done: res.message,
        });
      } catch (err) {
        const fieldError =
          err instanceof ApiError ? (err.fields?.email ?? "") : "";
        const error = fieldError
          ? ""
          : err instanceof ApiError
            ? err.message
            : "Something went wrong";
        setForgot({ ...forgot, busy: false, error, fieldError });
      }
    });
  }

  const back = (
    <button
      type="button"
      onClick={() => setForgot(null)}
      className="self-start text-[13px] font-medium underline"
    >
      Back to sign in
    </button>
  );

  const heading = (eyebrow: string, title: string) => (
    <div>
      <p className="text-[11.5px] font-semibold uppercase tracking-[.08em] text-muted">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-serif text-[38px] font-normal leading-[1.08] tracking-[-0.02em]">
        {title}
      </h1>
    </div>
  );
  const alert = (message: string) => (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xs bg-danger-soft px-3 py-2.5 text-[13.5px] leading-[1.45] text-danger"
    >
      <CircleAlert aria-hidden size={16} strokeWidth={1.8} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );

  return (
    <div className="grid min-h-screen md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="hidden flex-col justify-between bg-ink px-16 py-14 text-paper md:flex">
        <Brand light />
        <div>
          <p className="max-w-[520px] text-balance font-serif text-[56px] leading-[1.02] tracking-[-0.025em]">
            Requests and onboarding, for everyone at Next Venture.
          </p>
          <p className="mt-6 max-w-[420px] text-[15px] leading-[1.6] text-[#c9d6cd]">
            Ask for equipment or help, follow it to the end, and get new colleagues ready for
            their first day.
          </p>
        </div>
        <p className="text-[12.5px] uppercase tracking-[.06em] text-[#a9bcb0]">
          Service requests · Onboarding · People
        </p>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="flex w-full max-w-[380px] flex-col gap-5">
          <div className="mb-3 md:hidden">
            <Brand />
          </div>
          {forgot ? (
            forgot.done ? (
              <>
                {heading("Password", "Request sent.")}
                <p role="status" className="rounded-xs bg-accent-soft px-3 py-2.5 text-sm leading-[1.5]">
                  {forgot.done}
                </p>
                {back}
              </>
            ) : (
              <form onSubmit={askHr} className="flex flex-col gap-5">
                {heading("Password", "Forgot your password?")}
                <Field label="Work email" error={forgot.fieldError}>
                  <Input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    aria-invalid={forgot.fieldError ? true : undefined}
                    value={forgot.email}
                    onChange={(e) => setForgot({ ...forgot, email: e.target.value })}
                  />
                </Field>
                <p className="text-[13px] leading-[1.5] text-muted">
                  We will ask HR to set a new password for you. They will give it to you in
                  person or by phone.
                </p>
                {forgot.error && alert(forgot.error)}
                <Button type="submit" loading={forgot.busy} className="w-full">
                  Ask HR to reset it
                </Button>
                {back}
              </form>
            )
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-5">
              {heading("Sign in", "Welcome back.")}
              <Field label="Work email">
                <Input
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  aria-invalid={error ? true : undefined}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  required
                  autoComplete="current-password"
                  aria-invalid={error ? true : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              {error && alert(error)}
              <Button type="submit" loading={loading} className="w-full">
                Sign in
              </Button>
              {loading && (
                <p role="status" className="text-center text-[13px] leading-[1.5] text-muted">
                  The first sign-in of the day can take up to a minute while the server wakes up.
                </p>
              )}
              <button
                type="button"
                onClick={() => setForgot({ email, error: "", fieldError: "", done: "", busy: false })}
                className="self-start text-[13px] font-medium underline"
              >
                Forgot your password?
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
