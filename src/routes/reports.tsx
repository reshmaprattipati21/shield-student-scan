import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Users, Building2, Plus, Trash2 } from "lucide-react";
import { Navbar } from "@/components/Navbar";
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
        <Navbar />
        <main className="mx-auto max-w-2xl px-6 py-20 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary"><Users className="h-7 w-7" /></div>
          <h1 className="mt-6 text-3xl font-bold">Sign in to view reports</h1>
          <p className="mt-3 text-muted-foreground">The community scam database is available to verified students.</p>
          <Button asChild className="mt-6"><Link to="/auth" search={{ redirect: "/reports" }}>Sign in</Link></Button>
        </main>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary"><Users className="h-5 w-5" /></div>
              <h1 className="text-3xl font-bold">Community Reports</h1>
            </div>
            <p className="text-muted-foreground mt-2">Recent scams reported by other students.</p>
          </div>
          <Button onClick={() => setShowForm((v) => !v)}>
            <Plus className="h-4 w-4 mr-2" />{showForm ? "Close" : "New report"}
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
          <div className="space-y-3">
            {reports.map((r) => (
              <article key={r.id} className="glass rounded-2xl p-5 hover:border-[color-mix(in_oklab,var(--cyber-cyan)_45%,transparent)] transition-all duration-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/15 text-destructive"><Building2 className="h-5 w-5" /></div>
                    <div>
                      <h3 className="font-semibold">{r.company_name}</h3>
                      <div className="text-xs text-muted-foreground">on {r.platform} · {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                    </div>
                  </div>
                  {r.user_id === user?.id && <DeleteBtn id={r.id} onDone={load} />}
                </div>
                <p className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap">{r.description}</p>
              </article>
            ))}
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
        <label className="text-sm font-medium">Company name</label>
        <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Internships" className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">Platform found on</label>
        <Input value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="e.g. LinkedIn, WhatsApp, Telegram, Email" className="mt-1.5" />
      </div>
      <div>
        <label className="text-sm font-medium">Scam description</label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} placeholder="Describe what happened: how they reached out, what they asked for, red flags…" className="mt-1.5 resize-none" />
      </div>
      <Button type="submit" disabled={submitting}>{submitting ? "Submitting…" : "Submit report"}</Button>
    </form>
  );
}
