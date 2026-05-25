import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Link2, MessageSquareText, Users, ArrowRight } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "ScamShield — Spot fake internships & job scams" },
      { name: "description", content: "Free tools for students to detect internship and job scams: URL checker, message scanner, and community scam reports." },
    ],
  }),
});

function Index() {
  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6">
        <section className="py-20 text-center">
          <div className="inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground">
            <Shield className="h-3.5 w-3.5 text-primary" /> Built for students, by students
          </div>
          <h1 className="mt-6 text-5xl md:text-6xl font-bold tracking-tight">
            Don't fall for fake<br />
            <span className="bg-gradient-to-r from-primary to-[oklch(0.78_0.14_215)] bg-clip-text text-transparent">internships & job scams.</span>
          </h1>
          <p className="mt-6 max-w-2xl mx-auto text-lg text-muted-foreground">
            ScamShield helps you verify suspicious offers in seconds. Check links, scan messages, and learn from a community-reported scam database.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg"><Link to="/url-checker">Check a URL <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="secondary"><Link to="/reports">View reports</Link></Button>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3 pb-24">
          {[
            { icon: Link2, title: "URL Checker", desc: "Paste any suspicious link. We check domain age, typosquatting, and patterns to return a risk score.", to: "/url-checker" },
            { icon: MessageSquareText, title: "Text Scanner", desc: "Paste WhatsApp, Telegram or email messages to flag high-risk language and known scam tactics.", to: "/text-scanner" },
            { icon: Users, title: "Community Reports", desc: "See real scams reported by students. Submit your own to help protect others.", to: "/reports" },
          ].map((f) => (
            <Link key={f.title} to={f.to} className="group glass rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--cyber-cyan)_55%,transparent)] hover:shadow-[0_20px_40px_-20px_color-mix(in_oklab,var(--cyber-cyan)_50%,transparent)]">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-lg">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              <div className="mt-4 inline-flex items-center text-sm text-primary group-hover:gap-2 gap-1 transition-all">
                Open <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
