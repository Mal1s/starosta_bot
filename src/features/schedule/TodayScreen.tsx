import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarDays, MapPin, User, Clock, CheckCircle2, Circle, Megaphone } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, LoadingSpinner, EmptyState, Button, Badge } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { isStaff } from '@/lib/permissions';
import { formatDate, todayISO } from '@/lib/time';
import { haptic } from '@/lib/telegram';

export function TodayScreen() {
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);
  const group = me?.group;
  const role = me?.membership?.role ?? 'student';

  const today = todayISO(group?.timezone);
  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedule', today, today],
    queryFn: () => client.getSchedule(today, today),
    enabled: !!client,
  });

  const { data: announcements } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => client.getAnnouncements(),
    enabled: !!client,
  });

  const unreadCount = announcements?.filter((a) => a.unread).length ?? 0;
  const onboardingDone = me?.onboarding;
  const showOnboarding = isStaff(role) && onboardingDone && (!onboardingDone.shared || !onboardingDone.schedule || !onboardingDone.journal);

  return (
    <div>
      <ScreenHeader
        title={ru.nav.today}
        subtitle={formatDate(new Date(), 'EEEE, d MMMM', group?.timezone)}
      />

      {showOnboarding && (
        <Card className="mb-4">
          <p className="font-semibold mb-3" style={{ color: 'var(--text)' }}>{ru.onboarding.title}</p>
          <div className="space-y-2">
            <OnboardingStep label={ru.onboarding.stepShare} done={onboardingDone.shared} />
            <OnboardingStep label={ru.onboarding.stepSchedule} done={onboardingDone.schedule} />
            <OnboardingStep label={ru.onboarding.stepJournal} done={onboardingDone.journal} />
          </div>
        </Card>
      )}

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
              </div>
              <Button size="sm" variant="ghost" onClick={() => { haptic('light'); }}>
                {ru.ann.readAll}
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : schedule && schedule.length > 0 ? (
        <StaggerGroup className="space-y-3">
          {schedule[0].slots.map((slot, i) => (
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

function OnboardingStep({ label, done }: { label: string; done: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2"
    >
      {done ? (
        <CheckCircle2 size={18} color="var(--success)" />
      ) : (
        <Circle size={18} color="var(--muted)" />
      )}
      <span className="text-sm" style={{ color: done ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
    </motion.div>
  );
}
