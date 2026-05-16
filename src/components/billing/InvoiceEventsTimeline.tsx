import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchInvoiceEvents, type InvoiceEvent } from "@/lib/invoices";
import { Clock } from "lucide-react";

const EVENT_LABEL: Record<string, string> = {
  draft_created: "Draft created",
  issued: "Issued",
  marked_paid: "Marked paid",
  marked_overdue: "Marked overdue",
  voided: "Voided",
  pdf_generated: "PDF generated",
  pdf_regenerated: "PDF regenerated",
  email_sent: "Email sent",
  auto_generated: "Auto-generated",
};

interface Props { invoiceId: string; refreshKey?: number }

export default function InvoiceEventsTimeline({ invoiceId, refreshKey }: Props) {
  const [events, setEvents] = useState<InvoiceEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    fetchInvoiceEvents(invoiceId)
      .then((e) => { if (!cancel) setEvents(e); })
      .catch(() => { if (!cancel) setEvents([]); })
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [invoiceId, refreshKey]);

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Timeline</CardTitle></CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No events yet.</p>
        ) : (
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <div className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1">
                  <div className="font-medium">{EVENT_LABEL[e.event] ?? e.event}</div>
                  <div className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</div>
                  {Object.keys(e.meta ?? {}).length > 0 && (
                    <pre className="mt-1 text-xs text-muted-foreground bg-muted/40 rounded p-2 overflow-x-auto">
                      {JSON.stringify(e.meta, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
