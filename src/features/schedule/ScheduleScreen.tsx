import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Clock, MapPin, User } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, LoadingSpinner, EmptyState } from '@/components/ui';
import { useAppStore } from '@/app/store';

function addDaysStr(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Tab = 'today' | 'tomorrow' | 'week';

export function ScheduleScreen() {
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);
  const group = me?.group;
  const [tab, setTab] = useState<Tab>('today');

  const today = new Date().toISOString().slice(0, 10);
  const from = tab === 'week' ? today : tab === 'tomorrow' ? addDaysStr(today, 1) : today;
  const to = tab === 'week' ? addDaysStr(today, 7) : from;

  const { data: schedule, isLoading } = useQuery({
    queryKey: ['schedule', from, to],
    queryFn: () => client.getSchedule(from, to),
    enabled: !!client,
  });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'today', label: ru.schedule.today },
    { key: 'tomorrow', label: ru.schedule.tomorrow },
    { key: 'week', label: ru.schedule.week },
  ];

  return (
    <div>
      <ScreenHeader title={ru.nav.schedule} />

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              backgroundColor: tab === t.key ? 'var(--primary)' : 'var(--surface)',
              color: tab === t.key ? '#fff' : 'var(--muted)',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : schedule && schedule.length > 0 ? (
        <div className="space-y-4">
          {schedule.map((day) => (
            <div key={day.date}>
              {tab === 'week' && (
                <p className="text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
                  {new Date(day.date + 'T00:00:00Z').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'short' })}
                </p>
              )}
              <div className="space-y-2">
                {day.slots.map((slot) => (
                  <Card key={slot.id}>
                    <div className="flex items-start justify-between">
                      <div className={slot.cancelled ? 'line-through opacity-50' : ''}>
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
                          {slot.teacher && (
                            <span className="flex items-center gap-1">
                              <User size={12} /> {slot.teacher}
                            </span>
                          )}
                        </div>
                      </div>
                      {slot.subgroup_name && (
                        <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--accent)' }}>
                          {slot.subgroup_name}
                        </span>
                      )}
                    </div>
                    {slot.cancelled && (
                      <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{ru.schedule.cancelled}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title={ru.schedule.empty} hint={ru.schedule.noLessons} />
      )}
    </div>
  );
}
