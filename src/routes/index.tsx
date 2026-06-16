import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  MapPin,
  Bell,
  Siren,
  Route as RouteIcon,
  Users,
  Flame,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import heroImg from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SafeRoute Nigeria — Real-time Safety Map & Incident Reporting" },
      {
        name: "description",
        content:
          "Avoid dangerous areas, report incidents in real time, view a live safety map and stay safe across Nigeria.",
      },
      { property: "og:title", content: "SafeRoute Nigeria" },
      { property: "og:description", content: "Community-powered safety for every Nigerian." },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  { icon: MapPin, title: "Live Safety Map", desc: "See verified incidents and heatmaps near you in real time." },
  { icon: Flame, title: "Risk Scoring", desc: "Every area gets a live risk score from community reports." },
  { icon: RouteIcon, title: "Safer Routes", desc: "Check the safest path between two locations before you travel." },
  { icon: Bell, title: "Danger Alerts", desc: "Get notified the moment danger is reported nearby." },
  { icon: Users, title: "Community Verified", desc: "Reports are confirmed or disputed by people on the ground." },
  { icon: Siren, title: "Emergency SOS", desc: "One tap panic button shares your live location instantly." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Log in</Link>
          </Button>
          <Button asChild className="bg-gradient-primary text-primary-foreground">
            <Link to="/auth">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <img
          src={heroImg}
          alt="Aerial night view of a city with glowing safe-route lines"
          width={1280}
          height={960}
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center md:py-36">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Community-powered safety
          </span>
          <h1 className="mt-6 font-display text-4xl font-extrabold leading-tight md:text-6xl">
            Move through Nigeria with <span className="text-gradient-primary">confidence</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            SafeRoute turns real-time community reports into a live safety map, danger alerts,
            safer routes and an emergency SOS — all in one app.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-gradient-primary text-primary-foreground shadow-glow">
              <Link to="/auth">
                Start protecting yourself <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-center font-display text-3xl font-bold md:text-4xl">
          Everything you need to stay safe
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Built for Nigerian cities and roads, powered by the people who travel them every day.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-card transition-colors hover:border-primary/40"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pb-24">
        <div className="rounded-3xl border border-primary/30 bg-gradient-primary p-10 text-center text-primary-foreground shadow-glow">
          <h2 className="font-display text-3xl font-bold">Your safety is a community effort</h2>
          <p className="mx-auto mt-3 max-w-md opacity-90">
            Join thousands of Nigerians keeping each other safe. It's free.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-6">
            <Link to="/auth">Create your free account</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <Logo className="justify-center" />
        <p className="mt-3">© {new Date().getFullYear()} SafeRoute Nigeria. Stay safe.</p>
      </footer>
    </div>
  );
}
