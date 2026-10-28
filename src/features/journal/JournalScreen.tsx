import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, X, Clock } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, LoadingSpinner, EmptyState, Button } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { todayISO } from '@/lib/time';
import { haptic } from '@/lib/telegram';
import type { JournalRow } from '@/api/types';

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

      <StaggerGroup className="space-y-4">
        <StaggerItem>
          <JournalBlock title={ru.journal.blockWill} rows={willBlock} variant="will" delay={0} />
        </StaggerItem>
        <StaggerItem>
          <JournalBlock title={ru.journal.blockNoAnswer} rows={noAnswerBlock} variant="noanswer" delay={0.06} />
        </StaggerItem>
        {othersBlock.length > 0 && (
          <StaggerItem>
            <JournalBlock title={ru.journal.blockOthers} rows={othersBlock} variant="others" delay={0.12} />
          </StaggerItem>
        )}
      </StaggerGroup>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
        <Button fullWidth variant="danger">
          {ru.journal.close}
        </Button>
      </motion.div>
    </div>
  );
}

function JournalBlock({
  title,
  rows,
  variant,
  delay = 0,
}: {
  title: string;
  rows: JournalRow[];
  variant: 'will' | 'noanswer' | 'others';
  delay?: number;
}) {
  if (rows.length === 0) return null;

  const iconMap: Record<string, ReactNode> = {
    will: <Check size={14} color="var(--success)" />,
    noanswer: <Clock size={14} color="var(--warning)" />,
    others: <X size={14} color="var(--danger)" />,
  };

  const colorMap = {
    will: 'var(--success)',
    noanswer: 'var(--warning)',
    others: 'var(--danger)',
  };

  return (
    <Card delay={delay}>
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `color-mix(in srgb, ${colorMap[variant]} 15%, transparent)` }}
        >
          {iconMap[variant]}
        </div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {title} <span style={{ color: 'var(--muted)' }}>({rows.length})</span>
        </p>
      </div>
      <div className="space-y-1">
        {rows.map((row, i) => (
          <motion.div
            key={row.membership_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: delay + i * 0.03 }}
            className="flex items-center justify-between py-2"
          >
            <span className="text-sm" style={{ color: 'var(--text)' }}>{row.full_name}</span>
            {variant === 'will' && (
              <div className="flex gap-1">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => haptic('medium')}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--danger)' }}
                >
                  {ru.journal.notCameBtn}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => haptic('medium')}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--warning)' }}
                >
                  {ru.journal.lateBtn}
                </motion.button>
              </div>
            )}
            {variant === 'noanswer' && (
              <div className="flex gap-1">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => haptic('medium')}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--success)' }}
                >
                  {ru.journal.came}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => haptic('medium')}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--danger)' }}
                >
                  {ru.journal.notCame}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => haptic('medium')}
                  className="text-xs px-2.5 py-1 rounded-lg font-medium"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--warning)' }}
                >
                  {ru.journal.validReason}
                </motion.button>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
