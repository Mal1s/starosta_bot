import { ru } from '@/i18n/ru';
import { ScreenHeader, EmptyState } from '@/components/ui';

export function CalendarScreen() {
  return (
    <div>
      <ScreenHeader title={ru.settings.calendar} />
      <EmptyState title="Календарь будет доступен позже" />
    </div>
  );
}
