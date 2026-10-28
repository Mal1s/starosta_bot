import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, Button } from '@/components/ui';

export function SecurityScreen() {
  return (
    <div>
      <ScreenHeader title={ru.settings.security} />

      <Card className="mb-3">
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>Код восстановления</p>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          Позволяет вернуть роль старосты при смене аккаунта.
        </p>
        <Button fullWidth variant="secondary">Сгенерировать новый</Button>
      </Card>

      <Card className="mb-3">
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{ru.leader.transfer.title}</p>
        <Button fullWidth variant="secondary">{ru.leader.transfer.title}</Button>
      </Card>

      <Card>
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--danger)' }}>{ru.group.delete.confirm}</p>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{ru.group.delete.warn}</p>
        <Button fullWidth variant="danger">{ru.group.delete.confirm}</Button>
      </Card>
    </div>
  );
}
