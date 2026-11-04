import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { CalendarDays, Clock, BookOpen, Sun } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, LoadingSpinner } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import type { BellEntry } from '@/api/types';

const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function CalendarScreen() {
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);
  const group = me?.group;

  const { data: scheduleRaw, isLoading } = useQuery({
    queryKey: ['schedule-raw'],
    queryFn: () => client.getScheduleRaw(),
    enabled: !!client,
  });

  if (isLoading) return <div><ScreenHeader title={ru.settings.calendar} /><LoadingSpinner /></div>;

  const bell = scheduleRaw?.bell ?? [];
  const workDays = group?.work_days ?? [1, 2, 3, 4, 5];

  return (
    <div>
      <ScreenHeader title={ru.settings.calendar} subtitle={group?.name} />

      <StaggerGroup className="space-y-3">
        <StaggerItem>
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
                <CalendarDays size={20} color="var(--primary)" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Рабочие дни</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>В эти дни проходят пары</p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {weekdayNames.map((name, i) => {
                const dayNum = i + 1;
                const isWork = workDays.includes(dayNum);
                return (
                  <div key={dayNum} className="flex-1 flex flex-col items-center gap-1.5">
                    <motion.div
                      initial={{ scale: 0.8 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="w-full aspect-square rounded-xl flex items-center justify-center text-xs font-bold"
                      style={{
                        backgroundColor: isWork ? 'var(--primary)' : 'var(--surface-2)',
                        color: isWork ? '#fff' : 'var(--muted)',
                      }}
                    >
                      {name}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          </Card>
        </StaggerItem>

        {group?.semester_start && group?.semester_end && (
          <StaggerItem>
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                  <BookOpen size={20} color="var(--accent)" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Семестр</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Период обучения</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl p-3" style={{ backgroundColor: 'var(--surface-2)' }}>
                <div className="text-center flex-1">
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Начало</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text)' }}>{formatDate(group.semester_start)}</p>
                </div>
                <motion.div animate={{ x: [0, 3, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-2xl" style={{ color: 'var(--muted)' }}>→</motion.div>
                <div className="text-center flex-1">
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>Конец</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text)' }}>{formatDate(group.semester_end)}</p>
                </div>
              </div>
            </Card>
          </StaggerItem>
        )}

        {bell.length > 0 && (
          <StaggerItem>
            <Card>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--success) 12%, transparent)' }}>
                  <Clock size={20} color="var(--success)" />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Звонки</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Расписание звонков</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {bell.map((entry: BellEntry) => (
                  <motion.div
                    key={entry.lesson_no}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: entry.lesson_no * 0.04 }}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{ backgroundColor: 'var(--surface-2)' }}
                  >
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>Пара {entry.lesson_no}</span>
                    <span className="text-sm tabular-nums" style={{ color: 'var(--muted)' }}>{entry.starts} — {entry.ends}</span>
                  </motion.div>
                ))}
              </div>
            </Card>
          </StaggerItem>
        )}

        <StaggerItem>
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 12%, transparent)' }}>
                <Sun size={20} color="var(--warning)" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Тихие часы</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>В это время опросы не приходят</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl p-3" style={{ backgroundColor: 'var(--surface-2)' }}>
              <span className="text-sm tabular-nums" style={{ color: 'var(--text)' }}>{group?.quiet_from ?? '23:00'}</span>
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} className="text-xs" style={{ color: 'var(--muted)' }}>тихо</motion.div>
              <span className="text-sm tabular-nums" style={{ color: 'var(--text)' }}>{group?.quiet_to ?? '07:00'}</span>
            </div>
          </Card>
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.slice(0, 10).split('-');
  return `${day}.${month}.${year}`;
}
