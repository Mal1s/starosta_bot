import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, EmptyState } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { isStaff } from '@/lib/permissions';
import { useQuery } from '@tanstack/react-query';

export function StatsScreen() {
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);
  const role = me?.membership?.role ?? 'student';

  const { data: myStats } = useQuery({
    queryKey: ['my-stats'],
    queryFn: () => client.getMyStats(),
    enabled: !!client,
  });

  const { data: groupStats } = useQuery({
    queryKey: ['group-stats'],
    queryFn: () => client.getStats('2026-09-01', '2026-12-31'),
    enabled: !!client && isStaff(role),
  });

  return (
    <div>
      <ScreenHeader title={ru.profile.statistics} />

      {myStats && (
        <Card className="mb-4">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Моя статистика</p>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Посещено" value={myStats.visited} color="var(--success)" />
            <StatBox label="Пропущено" value={myStats.missed} color="var(--danger)" />
            <StatBox label="Больничных" value={myStats.sick} color="var(--warning)" />
            <StatBox label="Уважительных" value={myStats.valid} color="var(--accent)" />
          </div>
          {myStats.rate !== null && (
            <div className="mt-3 text-center">
              <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
                {Math.round(myStats.rate * 100)}%
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>посещаемость</p>
            </div>
          )}
        </Card>
      )}

      {isStaff(role) && groupStats && (
        <Card>
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Статистика группы</p>
          <div className="grid grid-cols-2 gap-3">
            <StatBox label="Присутствуют" value={groupStats.present} color="var(--success)" />
            <StatBox label="Отсутствуют" value={groupStats.absent} color="var(--danger)" />
            <StatBox label="Опоздали" value={groupStats.late} color="var(--warning)" />
            <StatBox label="Уважительных" value={groupStats.valid} color="var(--accent)" />
          </div>
          {groupStats.rate !== null && (
            <div className="mt-3 text-center">
              <p className="text-3xl font-bold" style={{ color: 'var(--primary)' }}>
                {Math.round(groupStats.rate * 100)}%
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>общая посещаемость</p>
            </div>
          )}
        </Card>
      )}

      {!myStats && !groupStats && <EmptyState title={ru.common.empty} />}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-3 rounded-xl" style={{ backgroundColor: 'var(--surface-2)' }}>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{label}</p>
    </div>
  );
}
