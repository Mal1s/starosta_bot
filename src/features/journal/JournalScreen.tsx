import { type ReactNode } from 'react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const group = me?.group;
  const today = todayISO(group?.timezone);

  const { data: journal, isLoading } = useQuery({
    queryKey: ['journal', today],
    queryFn: () => client.getJournal(today),
    enabled: !!client,
  });

  const attendanceMutation = useMutation({
    mutationFn: async ({ row, status }: { row: JournalRow; status: string }) => {
      await Promise.all(row.cells.map((cell) => client.setAttendance({
        membership_id: row.membership_id,
        date: today,
        slot_id: cell.slot_id,
        status,
      })));
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['journal', today] });
    },
    onError: () => setError(ru.error.generic),
  });

  const closeMutation = useMutation({
    mutationFn: () => client.closeDay(today, !!journal?.rows.some((row) => row.cells.some((cell) => cell.status === 'no_data'))),
    onSuccess: async () => {
      setShowCloseConfirm(false);
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['journal', today] });
    },
    onError: () => setError('Не получилось закрыть день. Проверь отметки и попробуй ещё раз.'),
  });

  const reopenMutation = useMutation({
    mutationFn: () => client.reopenDay(today),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ['journal', today] });
    },
    onError: () => setError(ru.error.generic),
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
  const noAnswerCount = journal.rows.reduce((count, row) => count + row.cells.filter((cell) => cell.status === 'no_data').length, 0);

  return (
    <div>
      <ScreenHeader title={ru.nav.journal} />
      <div className="mb-4 flex items-center justify-between rounded-2xl px-4 py-3" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{journal.closed ? 'День закрыт' : 'Журнал за сегодня'}</p>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            {noAnswerCount ? `${noAnswerCount} отметок ещё нет` : 'Все пары отмечены'}
          </p>
        </div>
        <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ color: noAnswerCount ? 'var(--warning)' : 'var(--success)', backgroundColor: noAnswerCount ? 'color-mix(in srgb, var(--warning) 13%, transparent)' : 'color-mix(in srgb, var(--success) 13%, transparent)' }}>
          {journal.rows.length} студентов
        </span>
      </div>
      {error && <p role="alert" className="mb-3 text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      <StaggerGroup className="space-y-4">
        <StaggerItem>
          <JournalBlock title={ru.journal.blockWill} rows={willBlock} variant="will" delay={0} onStatus={(row, status) => attendanceMutation.mutate({ row, status })} busy={attendanceMutation.isPending} />
        </StaggerItem>
        <StaggerItem>
          <JournalBlock title={ru.journal.blockNoAnswer} rows={noAnswerBlock} variant="noanswer" delay={0.06} onStatus={(row, status) => attendanceMutation.mutate({ row, status })} busy={attendanceMutation.isPending} />
        </StaggerItem>
        {othersBlock.length > 0 && (
          <StaggerItem>
            <JournalBlock title={ru.journal.blockOthers} rows={othersBlock} variant="others" delay={0.12} onStatus={(row, status) => attendanceMutation.mutate({ row, status })} busy={attendanceMutation.isPending} />
          </StaggerItem>
        )}
      </StaggerGroup>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
        {journal.closed ? (
          <Button fullWidth variant="secondary" onClick={() => reopenMutation.mutate()} loading={reopenMutation.isPending}>
            Переоткрыть день
          </Button>
        ) : (
          <Button fullWidth variant="danger" onClick={() => setShowCloseConfirm(true)} disabled={closeMutation.isPending}>
            {ru.journal.close}
          </Button>
        )}
      </motion.div>

      {showCloseConfirm && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 px-4 pb-6 pt-10" role="presentation" onClick={() => setShowCloseConfirm(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="close-day-title"
            className="w-full max-w-md rounded-3xl p-5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
            <h2 id="close-day-title" className="text-lg font-bold" style={{ color: 'var(--text)' }}>Закрыть журнал за сегодня?</h2>
            <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>
              {noAnswerCount
                ? `Останется без отметки: ${noAnswerCount}. Закрытие всё равно сохранит журнал.`
                : 'После закрытия ответы опроса попадут в журнал посещаемости.'}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setShowCloseConfirm(false)}>Отмена</Button>
              <Button variant="danger" onClick={() => closeMutation.mutate()} loading={closeMutation.isPending}>
                Закрыть день
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function JournalBlock({
  title,
  rows,
  variant,
  delay = 0,
  onStatus,
  busy,
}: {
  title: string;
  rows: JournalRow[];
  variant: 'will' | 'noanswer' | 'others';
  delay?: number;
  onStatus: (row: JournalRow, status: string) => void;
  busy: boolean;
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
                  onClick={() => { haptic('medium'); onStatus(row, 'absent'); }}
                  disabled={busy}
                  className="min-h-[40px] text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--danger)' }}
                >
                  {ru.journal.notCameBtn}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { haptic('medium'); onStatus(row, 'late'); }}
                  disabled={busy}
                  className="min-h-[40px] text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
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
                  onClick={() => { haptic('medium'); onStatus(row, 'present'); }}
                  disabled={busy}
                  className="min-h-[40px] text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--success)' }}
                >
                  {ru.journal.came}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { haptic('medium'); onStatus(row, 'absent'); }}
                  disabled={busy}
                  className="min-h-[40px] text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
                  style={{ backgroundColor: 'var(--surface-2)', color: 'var(--danger)' }}
                >
                  {ru.journal.notCame}
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { haptic('medium'); onStatus(row, 'valid'); }}
                  disabled={busy}
                  className="min-h-[40px] text-xs px-2.5 py-1 rounded-lg font-medium disabled:opacity-50"
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
