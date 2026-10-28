import { useQuery } from '@tanstack/react-query';
import { CalendarDays, MapPin, User, Clock } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, LoadingSpinner, EmptyState, Button } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { isStaff } from '@/lib/permissions';
import { formatDate, todayISO } from '@/lib/time';

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
        <Card className="mb-4" >
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--text)' }}>
              {ru.ann.new} ({unreadCount})
            </p>
            <Button size="sm" variant="ghost">{ru.ann.readAll}</Button>
          </div>
        </Card>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : schedule && schedule.length > 0 ? (
        <div className="space-y-3">
          {schedule[0].slots.map((slot) => (
            <Card key={slot.id}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>{slot.subject}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> {slot.starts}–{slot.ends}
                    </span>
                    {slot.room && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {slot.room}
                      </span>
                    )}
                  </div>
                  {slot.teacher && (
                    <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                      <User size={12} /> {slot.teacher}
                    </div>
                  )}
                </div>
                {slot.subgroup_name && (
                  <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--accent)' }}>
                    {slot.subgroup_name}
                  </span>
                )}
              </div>
              {slot.cancelled && (
                <p className="text-xs" style={{ color: 'var(--danger)' }}>{ru.schedule.cancelled}</p>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={ru.schedule.noLessons} />
      )}
    </div>
  );
}

function OnboardingStep({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-5 h-5 rounded-full flex items-center justify-center text-xs"
        style={{ backgroundColor: done ? 'var(--success)' : 'var(--surface-2)', color: done ? '#fff' : 'var(--muted)' }}
      >
        {done ? '✓' : '○'}
      </div>
      <span className="text-sm" style={{ color: done ? 'var(--text)' : 'var(--muted)' }}>{label}</span>
    </div>
  );
}
