import { ru } from '@/i18n/ru';
import { ScreenHeader, EmptyState } from '@/components/ui';

export function AdminScreen() {
  return (
    <div>
      <ScreenHeader title={ru.profile.admin} />
      <EmptyState title="Админ-панель будет доступна позже" />
    </div>
  );
}
