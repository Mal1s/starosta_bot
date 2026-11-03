import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CalendarDays, MapPin, User, Clock, CheckCircle2, Circle, Megaphone } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, LoadingSpinner, EmptyState, Button, Badge } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { isStaff } from '@/lib/permissions';
import { formatDate, todayISO } from '@/lib/time';
import { haptic } from '@/lib/telegram';
import { PollCard } from '@/features/poll/PollCard';

export function TodayScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);
  const group = me?.group;
  const role = me?.membership?.role ?? 'student';
  const staff = isStaff(role);

  const today = todayISO(group?.timezone);
  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedule', today, today],
    queryFn: () => client.getSchedule(today, today),
    enabled: !!client,
  });

  const { data: journal } = useQuery({
    queryKey: ['journal', today],
    queryFn: () => client.getJournal(today),
    enabled: !!client && staff,
  });

  const { data: announcements } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => client.getAnnouncements(),
    enabled: !!client,
  });

  const unreadCount = announcements?.filter((a) => a.unread).length ?? 0;
  const onboardingDone = me?.onboarding;
  const showOnboarding = staff && onboardingDone && (!onboardingDone.shared || !onboardingDone.schedule || !onboardingDone.journal);
  const todaySlots = schedule?.find((day) => day.date === today)?.slots ?? [];
  const waitingCount = journal?.rows.filter((row) => row.cells.some((cell) => cell.status === 'no_data')).length ?? 0;
  const confirmedCount = Math.max(0, (journal?.rows.length ?? 0) - waitingCount);

  const markReadMutation = useMutation({
    mutationFn: () => client.markAllAnnouncementsRead(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['announcements'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
    },
  });

  return (
    <div>
      <ScreenHeader
        title={ru.nav.today}
        subtitle={formatDate(`${today}T12:00:00`, 'EEEE, d MMMM', group?.timezone)}
      />

      {showOnboarding && (
        <Card className="mb-4">
          <p className="font-semibold mb-3" style={{ color: 'var(--text)' }}>{ru.onboarding.title}</p>
          <div className="space-y-2">
            <OnboardingStep label={ru.onboarding.stepShare} done={onboardingDone.shared} onClick={() => navigate('/members')} />
            <OnboardingStep label={ru.onboarding.stepSchedule} done={onboardingDone.schedule} onClick={() => navigate('/schedule')} />
            <OnboardingStep label={ru.onboarding.stepJournal} done={onboardingDone.journal} onClick={() => navigate('/journal')} />
          </div>
        </Card>
      )}

      {staff && (
        <Card className="mb-4 overflow-hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Посещаемость за сегодня</p>
              <p className="mt-1 text-xs leading-5" style={{ color: 'var(--muted)' }}>
                {journal ? `${confirmedCount} из ${journal.rows.length} участников отмечены` : 'Загружаю журнал группы…'}
              </p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 13%, transparent)' }}>
              <CalendarDays size={19} color="var(--primary)" />
            </div>
          </div>
          {journal && (
            <div className="mt-4">
              <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--surface-2)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${journal.rows.length ? (confirmedCount / journal.rows.length) * 100 : 0}%`, backgroundColor: 'var(--success)' }} />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]" style={{ color: 'var(--muted)' }}>
                <span>{waitingCount ? `${waitingCount} ждут отметки` : 'Все ответы обработаны'}</span>
                <span>{journal.rows.length} студентов</span>
              </div>
            </div>
          )}
          <Button fullWidth variant="secondary" className="mt-4" onClick={() => navigate('/journal')}>
            Открыть журнал
          </Button>
        </Card>
      )}

      {!staff && todaySlots.length > 0 && <PollCard date={today} slots={todaySlots} />}

      {unreadCount > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card className="mb-4" delay={0.1}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
              >
                <Megaphone size={20} color="var(--primary)" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                  {ru.ann.new} ({unreadCount})
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>Прочитай важное для группы</p>
              </div>
              <Button size="sm" variant="ghost" loading={markReadMutation.isPending} onClick={() => { haptic('light'); markReadMutation.mutate(); }}>
                {ru.ann.readAll}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : todaySlots.length > 0 ? (
        <StaggerGroup className="space-y-3">
          {todaySlots.map((slot, i) => (
            <StaggerItem key={slot.id}>
              <Card delay={i * 0.06}>
                <div className="flex items-start gap-3">
                  <div
                    className="flex flex-col items-center justify-center rounded-xl px-2 py-1.5 shrink-0"
                    style={{ backgroundColor: 'var(--surface-2)' }}
                  >
                    <span className="text-[10px] font-medium" style={{ color: 'var(--muted)' }}>
                      {slot.starts}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      {slot.ends}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold truncate" style={{ color: 'var(--text)' }}>{slot.subject}</p>
                      {slot.subgroup_name && (
                        <Badge color="accent">{slot.subgroup_name}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {slot.lesson_no}-я пара
                      </span>
                      {slot.room && (
                        <span className="flex items-center gap-1">
                          <MapPin size={12} /> {slot.room}
                        </span>
                      )}
                      {slot.teacher && (
                        <span className="flex items-center gap-1 truncate">
                          <User size={12} /> {slot.teacher}
                        </span>
                      )}
                    </div>
                    {slot.cancelled && (
                      <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{ru.schedule.cancelled}</p>
                    )}
                  </div>
                </div>
              </Card>
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <EmptyState title={ru.schedule.noLessons} />
      )}
    </div>
  );
}

function OnboardingStep({ label, done, onClick }: { label: string; done: boolean; onClick: () => void }) {
  const content = (
    <>
      {done ? (
        <CheckCircle2 size={18} color="var(--success)" />
      ) : (
        <Circle size={18} color="var(--muted)" />
      )}
      <span className="text-sm" style={{ color: done ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
    </>
  );
  return (
    <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
      {done ? (
        <div className="flex min-h-[44px] items-center gap-2">{content}</div>
      ) : (
        <button type="button" onClick={onClick} className="flex min-h-[44px] w-full items-center gap-2 rounded-lg text-left">
          {content}
        </button>
      )}
    </motion.div>
  );
}
