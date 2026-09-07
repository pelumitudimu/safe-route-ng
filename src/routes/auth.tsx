import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — SafeRoute Nigeria" }] }),
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Enter a valid email").max(255);
const passwordSchema = z.string().min(6, "Password must be at least 6 characters").max(72);

function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials"))
    return "That email and password don't match. Check the password, or sign up if you're new.";
  if (m.includes("email not confirmed")) return "Confirm your email first, then sign in.";
  if (m.includes("user already registered"))
    return "You already have an account — signing you in instead.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Too many attempts. Wait a minute and try again.";
  if (m.includes("fetch") || m.includes("network"))
    return "Network problem reaching the server. Check your connection and retry.";
  return message;
}

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("sr:last-email") : null;
    if (saved) setEmail(saved);

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard" });
    });
  }, [navigate]);

  const rememberEmail = (value: string) => {
    try {
      localStorage.setItem("sr:last-email", value);
    } catch {
      /* storage unavailable — non-fatal */
    }
  };

  const done = (value: string, message: string) => {
    rememberEmail(value);
    toast.success(message);
    navigate({ to: "/dashboard" });
  };

  // One button: sign in if the account exists, otherwise create it.
  const continueWithEmail = async () => {
    const e = emailSchema.safeParse(email);
    const p = passwordSchema.safeParse(password);
    if (!e.success) return toast.error(e.error.issues[0].message);
    if (!p.success) return toast.error(p.error.issues[0].message);

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: e.data,
      password: p.data,
    });

    if (!error && data.session) {
      setLoading(false);
      return done(e.data, "Welcome back!");
    }

    const msg = (error?.message ?? "").toLowerCase();
    if (!msg.includes("invalid login credentials")) {
      setLoading(false);
      return toast.error(friendlyError(error?.message ?? "Sign-in did not complete."));
    }

    // No account with that password — try creating one.
    const { data: created, error: signUpError } = await supabase.auth.signUp({
      email: e.data,
      password: p.data,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { display_name: e.data.split("@")[0] },
      },
    });
    setLoading(false);

    if (signUpError) {
      if (signUpError.message.toLowerCase().includes("already registered")) {
        return toast.error("That email already has an account, but the password is wrong. Use “Forgot password?”.");
      }
      return toast.error(friendlyError(signUpError.message));
    }

    if (created.session) return done(e.data, "Account created — you're signed in!");
    rememberEmail(e.data);
    toast.success("Account created! Check your email to confirm, then come back here.");
  };

  const googleSignIn = async () => {
    // Must return to a public, same-origin URL — a protected page bounces
    // back to sign-in before the session is stored.
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/auth",
    });
    if (result.error) return toast.error("Google sign-in failed. Please try again.");
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="flex justify-center">
          <Logo />
        </Link>
        <Card className="mt-6 border-border bg-card p-6 shadow-card">
          <h1 className="text-center text-lg font-semibold">Sign in or create your account</h1>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Enter your email and a password — we'll sign you in, or set you up if you're new.
          </p>

          <Button onClick={googleSignIn} variant="outline" className="mt-5 w-full">
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or use email{" "}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form
            className="space-y-4"
            onSubmit={(ev) => {
              ev.preventDefault();
              if (!loading) continueWithEmail();
            }}
          >
            <Field
              id="auth-email"
              name="email"
              label="Email"
              value={email}
              onChange={setEmail}
              type="email"
              autoComplete="username"
              placeholder="you@example.com"
            />
            <div className="space-y-1.5">
              <Field
                id="auth-password"
                name="password"
                label="Password"
                value={password}
                onChange={setPassword}
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="At least 6 characters"
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  {showPassword ? "Hide password" : "Show password"}
                </button>
                <Link to="/reset-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-primary text-primary-foreground"
            >
              {loading ? "Please wait..." : "Continue"}
            </Button>
          </form>
        </Card>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          By continuing you agree to keep our community safe and report responsibly.
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  name,
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  id?: string;
  name?: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
