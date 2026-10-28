import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, MapPin, User } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, LoadingSpinner, EmptyState, Badge } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { haptic } from '@/lib/telegram';

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

      <div className="flex gap-2 mb-4 relative">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              haptic('light');
              setTab(t.key);
            }}
            className="relative flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 z-10"
            style={{
              color: tab === t.key ? '#fff' : 'var(--muted)',
            }}
          >
            {tab === t.key && (
              <motion.div
                layoutId="scheduleTabBg"
                className="absolute inset-0 rounded-xl z-[-1]"
                style={{ backgroundColor: 'var(--primary)' }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <LoadingSpinner />
          </motion.div>
        ) : schedule && schedule.length > 0 ? (
          <motion.div key={`${tab}-${schedule.length}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <StaggerGroup className="space-y-4">
              {schedule.map((day, dayIdx) => (
                <div key={day.date}>
                  {tab === 'week' && (
                    <motion.p
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: dayIdx * 0.05 }}
                      className="text-xs font-semibold mb-2 uppercase tracking-wide"
                      style={{ color: 'var(--muted)' }}
                    >
                      {new Date(day.date + 'T00:00:00Z').toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'short' })}
                    </motion.p>
                  )}
                  <div className="space-y-2">
                    {day.slots.map((slot, i) => (
                      <StaggerItem key={slot.id}>
                        <Card delay={i * 0.04}>
                          <div className="flex items-start justify-between">
                            <div className={slot.cancelled ? 'line-through opacity-50' : ''}>
                              <p className="font-semibold" style={{ color: 'var(--text)' }}>{slot.subject}</p>
                              <div className="flex items-center gap-3 mt-1.5 text-xs" style={{ color: 'var(--muted)' }}>
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
                              <Badge color="accent">{slot.subgroup_name}</Badge>
                            )}
                          </div>
                          {slot.cancelled && (
                            <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{ru.schedule.cancelled}</p>
                          )}
                        </Card>
                      </StaggerItem>
                    ))}
                  </div>
                </div>
              ))}
            </StaggerGroup>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <EmptyState title={ru.schedule.empty} hint={ru.schedule.noLessons} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
