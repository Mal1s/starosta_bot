import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarCheck2, Check, Clock3, HeartPulse, RotateCcw } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { ru } from '@/i18n/ru';
import { haptic, hapticNotify } from '@/lib/telegram';
import type { PollAnswerInput, PollReason, Slot } from '@/api/types';

type PollAction = 'all' | 'partial' | 'no' | 'late';

export function PollCard({ date, slots }: { date: string; slots: Slot[] }) {
  const client = useAppStore((s) => s.client);
  const queryClient = useQueryClient();
  const pollableSlots = slots.filter((slot) => !('cancelled' in slot && slot.cancelled));
  const [mode, setMode] = useState<'default' | 'partial' | 'reason'>('default');
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { data: poll, isLoading, isError } = useQuery({
    queryKey: ['day-poll', date],
    queryFn: () => client!.getDayPoll(date),
    enabled: !!client && pollableSlots.length > 0,
  });

  const mutation = useMutation({
    mutationFn: async ({ answers, reason }: { answers: PollAnswerInput[]; reason?: PollReason }) => {
      if (!client) throw new Error('API client is unavailable');
      if (reason === 'sick' && !poll?.answers.some((answer) => answer.reason === 'sick')) {
        await client.createAbsence({ date_from: date, date_to: date, reason: 'sick' });
      }
      await client.submitPollAnswers({ date, answers });
    },
    onSuccess: async () => {
      setError(null);
      setMode('default');
      hapticNotify('success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['day-poll', date] }),
        queryClient.invalidateQueries({ queryKey: ['schedule', date, date] }),
      ]);
    },
    onError: () => {
      setError(ru.error.generic);
      hapticNotify('error');
    },
  });

  const savedAnswers = poll?.answers ?? [];
  const hasAnswer = savedAnswers.length > 0;
  const answerMap = new Map(savedAnswers.map((answer) => [answer.slot_id, answer]));
  const allWill = hasAnswer && pollableSlots.every((slot) => answerMap.get(slot.id)?.answer === 'will');
  const allWont = hasAnswer && pollableSlots.every((slot) => answerMap.get(slot.id)?.answer === 'wont');
  const summary = allWill
    ? ru.poll.allYes
    : allWont
      ? ru.poll.no
      : savedAnswers.some((answer) => answer.answer === 'late')
        ? ru.poll.late
        : `Ответ по парам: ${savedAnswers.length} из ${pollableSlots.length}`;

  function submitAction(action: PollAction, reason?: PollReason) {
    if (action === 'partial') {
      setSelectedSlots(pollableSlots.map((slot) => slot.id));
      setMode('partial');
      return;
    }

    if (action === 'no' && !reason) {
      setMode('reason');
      return;
    }

    const answers: PollAnswerInput[] = action === 'all'
      ? pollableSlots.map((slot) => ({ slot_id: slot.id, answer: 'will' }))
      : action === 'late'
        ? pollableSlots.slice(0, 1).map((slot) => ({ slot_id: slot.id, answer: 'late' }))
        : pollableSlots.map((slot) => ({ slot_id: slot.id, answer: 'wont', reason }));

    setError(null);
    mutation.mutate({ answers, reason });
  }

  function savePartial() {
    const answers = pollableSlots.map((slot) => ({
      slot_id: slot.id,
      answer: selectedSlots.includes(slot.id) ? 'will' as const : 'wont' as const,
      ...(!selectedSlots.includes(slot.id) ? { reason: 'dont_want' as const } : {}),
    }));
    mutation.mutate({ answers });
  }

  function toggleSlot(id: string) {
    haptic('light');
    setSelectedSlots((current) => current.includes(id)
      ? current.filter((slotId) => slotId !== id)
      : [...current, id]);
  }

  if (pollableSlots.length === 0) return null;

  return (
    <Card className="mb-4 overflow-hidden p-0">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)' }}
          >
            {hasAnswer
              ? <CalendarCheck2 size={19} color="var(--primary)" />
              : <Clock3 size={19} color="var(--primary)" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Планы на пары</p>
              {hasAnswer && (
                <span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold" style={{ color: 'var(--success)', backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                  Ответ сохранён
                </span>
              )}
            </div>
            <p className="mt-1 text-xs leading-5" style={{ color: 'var(--muted)' }}>
              {hasAnswer && mode === 'default'
                ? summary
                : `Отметь планы на ${pollableSlots.length} ${pollableSlots.length === 1 ? 'пару' : 'пары'}. Ответ можно изменить.`}
            </p>
          </div>
        </div>

        {isLoading && <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>Загружаю сохранённый ответ…</p>}
        {isError && <p role="status" className="mt-3 text-xs" style={{ color: 'var(--warning)' }}>Не удалось загрузить ответ. Новое действие всё ещё можно отправить.</p>}

        {hasAnswer && mode === 'default' ? (
          <Button
            fullWidth
            size="sm"
            variant="secondary"
            className="mt-4"
            onClick={() => { setError(null); setMode('partial'); setSelectedSlots(pollableSlots.map((slot) => slot.id)); }}
          >
            <span className="flex items-center justify-center gap-2"><RotateCcw size={15} /> {ru.poll.change}</span>
          </Button>
        ) : mode === 'partial' ? (
          <div className="mt-4 space-y-3">
            <div className="space-y-2">
              {pollableSlots.map((slot) => {
                const checked = selectedSlots.includes(slot.id);
                return (
                  <button
                    key={slot.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleSlot(slot.id)}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-left"
                    style={{ border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, backgroundColor: checked ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : 'var(--surface-2)' }}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md" style={{ backgroundColor: checked ? 'var(--primary)' : 'transparent', border: `1px solid ${checked ? 'var(--primary)' : 'var(--muted)'}` }}>
                      {checked && <Check size={13} color="#fff" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium" style={{ color: 'var(--text)' }}>{slot.subject}</span>
                    <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{slot.starts}</span>
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="ghost" onClick={() => setMode('default')}>Назад</Button>
              <Button onClick={savePartial} loading={mutation.isPending} disabled={mutation.isPending}>
                Сохранить
              </Button>
            </div>
          </div>
        ) : mode === 'reason' ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Почему не будешь?</p>
            <ReasonButton icon={<Check size={16} />} label={ru.poll.reasonValid} onClick={() => submitAction('no', 'valid')} loading={mutation.isPending} />
            <ReasonButton icon={<CalendarCheck2 size={16} />} label={ru.poll.reasonDontWant} onClick={() => submitAction('no', 'dont_want')} loading={mutation.isPending} />
            <ReasonButton icon={<HeartPulse size={16} />} label="Больничный сегодня" onClick={() => submitAction('no', 'sick')} loading={mutation.isPending} />
            <Button fullWidth variant="ghost" onClick={() => setMode('default')}>Назад</Button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button fullWidth onClick={() => submitAction('all')} loading={mutation.isPending} disabled={mutation.isPending}>
              {ru.poll.allYes}
            </Button>
            <Button fullWidth variant="secondary" onClick={() => submitAction('partial')} disabled={mutation.isPending}>
              {ru.poll.partial}
            </Button>
            <Button fullWidth variant="ghost" onClick={() => submitAction('no')} disabled={mutation.isPending} className="border border-[var(--border)]">
              {ru.poll.no}
            </Button>
            <Button fullWidth variant="secondary" onClick={() => submitAction('late')} disabled={mutation.isPending}>
              <span className="flex items-center justify-center gap-1"><Clock3 size={15} /> {ru.poll.late}</span>
            </Button>
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-xs" style={{ color: 'var(--danger)' }}>{error}</p>}
      </div>
    </Card>
  );
}

function ReasonButton({ icon, label, onClick, loading }: { icon: React.ReactNode; label: string; onClick: () => void; loading: boolean }) {
  return (
    <Button fullWidth variant="secondary" onClick={onClick} loading={loading} disabled={loading}>
      <span className="flex items-center justify-center gap-2">{icon}{label}</span>
    </Button>
  );
}
