import { useQuery } from '@tanstack/react-query';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, LoadingSpinner, EmptyState, Button } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { todayISO } from '@/lib/time';

export function JournalScreen() {
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);
  const group = me?.group;
  const today = todayISO(group?.timezone);

  const { data: journal, isLoading } = useQuery({
    queryKey: ['journal', today],
    queryFn: () => client.getJournal(today),
    enabled: !!client,
  });

  if (isLoading) return <div><ScreenHeader title={ru.nav.journal} /><LoadingSpinner /></div>;

  if (!journal || journal.slots.length === 0) {
    return (
      <div>
        <ScreenHeader title={ru.nav.journal} />
        <EmptyState title={ru.schedule.noLessons} />
      </div>
    );
  }

  const willBlock = journal.rows.filter((r) => r.cells.some((c) => c.status === 'present' || c.status === 'will'));
  const noAnswerBlock = journal.rows.filter((r) => r.cells.every((c) => c.status === 'no_data'));
  const othersBlock = journal.rows.filter((r) => !willBlock.includes(r) && !noAnswerBlock.includes(r));

  return (
    <div>
      <ScreenHeader title={ru.nav.journal} />

      <div className="space-y-4">
        <JournalBlock title={ru.journal.blockWill} rows={willBlock} variant="will" />
        <JournalBlock title={ru.journal.blockNoAnswer} rows={noAnswerBlock} variant="noanswer" />
        {othersBlock.length > 0 && (
          <JournalBlock title={ru.journal.blockOthers} rows={othersBlock} variant="others" />
        )}
      </div>

      <div className="mt-6">
        <Button fullWidth variant="danger">
          {ru.journal.close}
        </Button>
      </div>
    </div>
  );
}

function JournalBlock({ title, rows, variant }: { title: string; rows: import('@/api/types').JournalRow[]; variant: 'will' | 'noanswer' | 'others' }) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>
        {title} <span style={{ color: 'var(--muted)' }}>({rows.length})</span>
      </p>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.membership_id} className="flex items-center justify-between py-2">
            <span className="text-sm" style={{ color: 'var(--text)' }}>{row.full_name}</span>
            {variant === 'will' && (
              <div className="flex gap-1">
                <button className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--danger)' }}>
                  {ru.journal.notCameBtn}
                </button>
                <button className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--warning)' }}>
                  {ru.journal.lateBtn}
                </button>
              </div>
            )}
            {variant === 'noanswer' && (
              <div className="flex gap-1">
                <button className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--success)' }}>
                  {ru.journal.came}
                </button>
                <button className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--danger)' }}>
                  {ru.journal.notCame}
                </button>
                <button className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--warning)' }}>
                  {ru.journal.validReason}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
