import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Building2, Plus, Trash2, Flag } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { BackToDashboard } from "@/components/BackToDashboard";
import { CyberBg } from "@/components/CyberBg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/reports")({
  component: Reports,
  head: () => ({ meta: [{ title: "Community Reports — ScamShield" }, { name: "description", content: "Browse and submit student-reported internship and job scams." }] }),
});

type Report = {
  id: string;
  user_id: string;
  company_name: string;
  platform: string;
  description: string;
  created_at: string;
};

function Reports() {
  const { user, loading: authLoading } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    const { data, error } = await supabase.from("scam_reports").select("*").order("created_at", { ascending: false }).limit(100);
    if (error) toast.error(error.message);
    else setReports(data ?? []);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);

  if (!authLoading && !user) {
    return (
      <div>
        <CyberBg />
        <Navbar />
        <BackToDashboard />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Users className="h-7 w-7" /></div>
          <h1 className="mt-6 text-3xl font-bold">Sign in to view the fraud feed</h1>
          <p className="mt-3 text-muted-foreground">The community scam database is available to verified students.</p>
          <Button asChild className="mt-6 btn-neon-hover"><Link to="/auth" search={{ redirect: "/reports" }}>Sign in</Link></Button>
        </main>
      </div>
    );
  }

  return (
    <div>
      <CyberBg />
      <Navbar />
      <BackToDashboard />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Users className="h-5 w-5" /></div>
              <h1 className="text-3xl font-bold tracking-tight">Crowdsourced Fraud Feed</h1>
            </div>
            <p className="text-muted-foreground mt-2">Live alerts from the student community.</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)} className="btn-neon-hover">
            <Plus className="h-4 w-4 mr-2" />{showForm ? "Close" : "Report scam"}
          </Button>
        </div>

        {showForm && <ReportForm onSubmitted={() => { setShowForm(false); load(); }} />}

        {loading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : reports.length === 0 ? (
          <div className="glass rounded-2xl p-10 text-center">
            <p className="text-muted-foreground">No reports yet. Be the first to submit one.</p>
          </div>
        ) : (
          <div className="glass rounded-2xl p-2 max-h-[70vh] overflow-y-auto">
            <ul className="divide-y divide-cyan-400/10">
              {reports.map((r) => (
                <li key={r.id} className="group p-4 transition-all duration-500 hover:bg-cyan-400/5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/15 text-destructive shrink-0"><Building2 className="h-5 w-5" /></div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{r.company_name}</h3>
                        <div className="text-xs text-muted-foreground">on {r.platform} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                        <p className="mt-2 text-sm text-foreground/90 whitespace-pre-wrap break-words">{r.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        className="btn-neon-hover-red inline-flex items-center gap-1.5 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive"
                        onClick={() => toast.success("Flagged as scam — thanks for protecting the community.")}
                      >
                        <Flag className="h-3.5 w-3.5" /> Report as Scam
                      </button>
                      {r.user_id === user?.id && <DeleteBtn id={r.id} onDone={load} />}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}

function DeleteBtn({ id, onDone }: { id: string; onDone: () => void }) {
  const del = async () => {
    const { error } = await supabase.from("scam_reports").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Report deleted"); onDone(); }
  };
  return <Button size="sm" variant="ghost" onClick={del}><Trash2 className="h-4 w-4" /></Button>;
}

function ReportForm({ onSubmitted }: { onSubmitted: () => void }) {
  const { user } = useAuth();
  const [company, setCompany] = useState("");
  const [platform, setPlatform] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (company.trim().length < 1 || company.length > 200) return toast.error("Company name required (max 200 chars)");
    if (platform.trim().length < 1 || platform.length > 100) return toast.error("Platform required (max 100 chars)");
    if (description.trim().length < 10 || description.length > 2000) return toast.error("Description must be 10–2000 chars");

    setSubmitting(true);
    const { error } = await supabase.from("scam_reports").insert({
      user_id: user.id,
      company_name: company.trim(),
      platform: platform.trim(),
      description: description.trim(),
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Report submitted");
    setCompany(""); setPlatform(""); setDescription("");
    onSubmitted();
  };

  return (
    <form onSubmit={submit} className="glass rounded-2xl p-6 mb-6 space-y-4">
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Company name</label>
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Internships" className="mt-1.5" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Platform found on</label>
        <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. LinkedIn, WhatsApp, Telegram, Email" className="mt-1.5" />
      </div>
      <div>
        <label className="text-xs uppercase tracking-[0.2em] text-cyan-300/80">Scam description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Describe what happened: how they reached out, what they asked for, red flags…" className="mt-1.5 resize-none" />
      </div>
      <Button type="submit" disabled={submitting} className="btn-neon-hover">{submitting ? "Submitting…" : "Submit report"}</Button>
    </form>
  );
}
