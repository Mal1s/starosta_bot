import { motion } from 'framer-motion';
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
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <Card className="mb-4">
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Моя статистика</p>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Посещено" value={myStats.visited} color="var(--success)" delay={0.05} />
              <StatBox label="Пропущено" value={myStats.missed} color="var(--danger)" delay={0.1} />
              <StatBox label="Больничных" value={myStats.sick} color="var(--warning)" delay={0.15} />
              <StatBox label="Уважительных" value={myStats.valid} color="var(--accent)" delay={0.2} />
            </div>
            {myStats.rate !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200, damping: 15 }}
                className="mt-4 text-center"
              >
                <div className="relative inline-block">
                  <p className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>
                    {Math.round(myStats.rate * 100)}%
                  </p>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>посещаемость</p>
              </motion.div>
            )}
          </Card>
        </motion.div>
      )}

      {isStaff(role) && groupStats && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <Card>
            <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Статистика группы</p>
            <div className="grid grid-cols-2 gap-3">
              <StatBox label="Присутствуют" value={groupStats.present} color="var(--success)" delay={0.2} />
              <StatBox label="Отсутствуют" value={groupStats.absent} color="var(--danger)" delay={0.25} />
              <StatBox label="Опоздали" value={groupStats.late} color="var(--warning)" delay={0.3} />
              <StatBox label="Уважительных" value={groupStats.valid} color="var(--accent)" delay={0.35} />
            </div>
            {groupStats.rate !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 200, damping: 15 }}
                className="mt-4 text-center"
              >
                <p className="text-4xl font-bold" style={{ color: 'var(--primary)' }}>
                  {Math.round(groupStats.rate * 100)}%
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>общая посещаемость</p>
              </motion.div>
            )}
          </Card>
        </motion.div>
      )}

      {!myStats && !groupStats && <EmptyState title={ru.common.empty} />}
    </div>
  );
}

function StatBox({ label, value, color, delay = 0 }: { label: string; value: number; color: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 15 }}
      className="text-center p-3 rounded-xl"
      style={{ backgroundColor: 'var(--surface-2)' }}
    >
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{label}</p>
    </motion.div>
  );
}
