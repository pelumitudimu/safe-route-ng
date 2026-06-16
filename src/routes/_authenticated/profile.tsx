import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { LogOut, Save, ShieldCheck, Flag, Bell } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);

  const { data: stats } = useQuery({
    queryKey: ["profile_stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [reports, verified, sos] = await Promise.all([
        supabase
          .from("incidents")
          .select("id", { count: "exact", head: true })
          .eq("reporter_id", user!.id),
        supabase
          .from("incidents")
          .select("id", { count: "exact", head: true })
          .eq("reporter_id", user!.id)
          .eq("status", "verified"),
        supabase
          .from("sos_alerts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id),
      ]);
      return {
        reports: reports.count ?? 0,
        verified: verified.count ?? 0,
        sos: sos.count ?? 0,
      };
    },
  });

  const save = async () => {
    const parsed = z
      .object({
        display_name: z.string().trim().min(2, "Name is too short").max(60),
        phone: z
          .string()
          .trim()
          .max(20)
          .optional()
          .or(z.literal("")),
      })
      .safeParse({ display_name: displayName, phone });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: parsed.data.display_name,
          phone: parsed.data.phone || null,
        })
        .eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile updated");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (profile?.display_name || user?.email || "U")
    .slice(0, 2)
    .toUpperCase();

  return (
    <AppLayout title="Profile">
      <div className="mx-auto max-w-2xl space-y-4 animate-float-up">
        <Card className="flex items-center gap-4 border-border bg-card p-5 shadow-card">
          <Avatar className="h-16 w-16 border border-border">
            <AvatarFallback className="bg-primary/15 text-xl font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate font-display text-xl font-bold">
              {profile?.display_name || "Member"}
            </h2>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Flag} label="Reports" value={stats?.reports ?? 0} />
          <StatCard icon={ShieldCheck} label="Verified" value={stats?.verified ?? 0} />
          <StatCard icon={Bell} label="SOS sent" value={stats?.sos ?? 0} />
        </div>

        <Card className="space-y-4 border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-bold">Account details</h3>
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Phone (optional)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. +234 800 000 0000"
              maxLength={20}
            />
          </div>
          <Button
            onClick={save}
            disabled={saving}
            className="bg-gradient-primary text-primary-foreground shadow-glow"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save changes"}
          </Button>
        </Card>

        <Card className="space-y-4 border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-bold">Preferences</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Theme</p>
              <p className="text-xs text-muted-foreground">Switch between light and dark</p>
            </div>
            <ThemeToggle />
          </div>
          <Separator />
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="w-full text-destructive hover:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </Card>
      </div>
    </AppLayout>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Flag;
  label: string;
  value: number;
}) {
  return (
    <Card className="border-border bg-card p-4 text-center shadow-card">
      <Icon className="mx-auto h-5 w-5 text-primary" />
      <p className="mt-2 font-display text-xl font-bold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </Card>
  );
}
