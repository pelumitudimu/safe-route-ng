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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    // Prefill the last used email so returning users only type a password.
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

  const signIn = async () => {
    const e = emailSchema.safeParse(email);
    const p = passwordSchema.safeParse(password);
    if (!e.success) return toast.error(e.error.issues[0].message);
    if (!p.success) return toast.error(p.error.issues[0].message);
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: e.data,
      password: p.data,
    });
    setLoading(false);
    if (error) return toast.error(friendlyError(error.message));
    if (!data.session) return toast.error("Sign-in did not complete. Please try again.");
    rememberEmail(e.data);
    toast.success("Welcome back!");
    navigate({ to: "/dashboard" });
  };

  const signUp = async () => {
    const e = emailSchema.safeParse(email);
    const p = passwordSchema.safeParse(password);
    if (!e.success) return toast.error(e.error.issues[0].message);
    if (!p.success) return toast.error(p.error.issues[0].message);
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: e.data,
      password: p.data,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { display_name: displayName.trim() || e.data.split("@")[0] },
      },
    });

    // Existing account? Fall straight through to sign-in instead of erroring out.
    if (error && error.message.toLowerCase().includes("already registered")) {
      const { data: signed, error: signInError } = await supabase.auth.signInWithPassword({
        email: e.data,
        password: p.data,
      });
      setLoading(false);
      if (signInError) return toast.error(friendlyError(signInError.message));
      if (signed.session) {
        rememberEmail(e.data);
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      }
      return;
    }

    setLoading(false);
    if (error) return toast.error(friendlyError(error.message));
    rememberEmail(e.data);
    // When email confirmation is disabled, sign-up returns a live session and
    // the browser's password manager can save the new credentials immediately.
    if (data.session) {
      toast.success("Account created! You're signed in.");
      navigate({ to: "/dashboard" });
      return;
    }
    toast.success("Account created! Check your email to confirm, then sign in.");
  };

  const googleSignIn = async () => {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
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
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-5">
              <form
                className="space-y-4"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  if (!loading) signIn();
                }}
              >
                <Field
                  id="signin-email"
                  name="email"
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  autoComplete="username"
                  placeholder="you@example.com"
                />
                <Field
                  id="signin-password"
                  name="password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
                <div className="text-right">
                  <Link to="/reset-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-5">
              <form
                className="space-y-4"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  if (!loading) signUp();
                }}
              >
                <Field
                  id="signup-name"
                  name="name"
                  label="Display name"
                  value={displayName}
                  onChange={setDisplayName}
                  autoComplete="name"
                  placeholder="Your name"
                />
                <Field
                  id="signup-email"
                  name="email"
                  label="Email"
                  value={email}
                  onChange={setEmail}
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                />
                <Field
                  id="signup-password"
                  name="new-password"
                  label="Password"
                  value={password}
                  onChange={setPassword}
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                />
                <Button type="submit" disabled={loading} className="w-full bg-gradient-primary text-primary-foreground">
                  {loading ? "Creating..." : "Create account"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button onClick={googleSignIn} variant="outline" className="w-full">
            Continue with Google
          </Button>
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
