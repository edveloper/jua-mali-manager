import { Clock3, UserCircle2, NotebookText } from 'lucide-react';
import { format } from 'date-fns';
import { ServiceSale } from '@/types/inventory';

interface ServiceSessionHistoryProps {
  sessions: ServiceSale[];
}

const statusClass = (status?: string) => {
  if (status === 'scheduled') return 'bg-blue-100 text-blue-700';
  if (status === 'cancelled') return 'bg-destructive/10 text-destructive';
  return 'bg-success/15 text-success';
};

export function ServiceSessionHistory({ sessions }: ServiceSessionHistoryProps) {
  const sorted = [...sessions].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Service Session Log</h3>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
          No service sessions recorded yet.
        </div>
      ) : (
        sorted.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-sm truncate">{s.serviceName}</p>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusClass(s.status)}`}>
                {s.status || 'completed'}
              </span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Qty: {s.quantity} | Amount: KSh {Number(s.totalAmount || 0).toLocaleString()}</p>
              <p className="flex items-center gap-1"><Clock3 className="h-3 w-3" />{format(new Date(s.sessionTime || s.createdAt), 'MMM d, yyyy h:mm a')}</p>
              {s.staffName && <p className="flex items-center gap-1"><UserCircle2 className="h-3 w-3" />{s.staffName}</p>}
              {s.notes && <p className="flex items-center gap-1"><NotebookText className="h-3 w-3" />{s.notes}</p>}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
