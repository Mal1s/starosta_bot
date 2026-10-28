import { useQuery } from '@tanstack/react-query';
import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, LoadingSpinner, Badge, Button } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { isStaff } from '@/lib/permissions';

const roleLabels: Record<string, string> = {
  student: ru.role.student,
  deputy: ru.role.deputy,
  headman: ru.role.headman,
};

export function MembersScreen() {
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);
  const role = me?.membership?.role ?? 'student';

  const { data: members, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => client.getMembers(),
    enabled: !!client,
  });

  if (isLoading) return <div><ScreenHeader title="Участники" /><LoadingSpinner /></div>;

  const pending = members?.filter((m) => m.status === 'pending') ?? [];
  const active = members?.filter((m) => m.status === 'active') ?? [];

  return (
    <div>
      <ScreenHeader title="Участники" subtitle={`Всего: ${active.length}`} />

      {isStaff(role) && pending.length > 0 && (
        <Card className="mb-4">
          <p className="text-sm font-semibold mb-3" style={{ color: 'var(--warning)' }}>Заявки ({pending.length})</p>
          <div className="space-y-2">
            {pending.map((m) => (
              <div key={m.id} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--text)' }}>{m.full_name}</span>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost">Принять</Button>
                  <Button size="sm" variant="ghost">Отклонить</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {active.map((m) => (
          <Card key={m.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{m.full_name}</p>
                <Badge color={m.role === 'headman' ? 'primary' : m.role === 'deputy' ? 'warning' : 'success'}>
                  {roleLabels[m.role]}
                </Badge>
              </div>
              {isStaff(role) && m.role === 'student' && (
                <Button size="sm" variant="ghost">Удалить</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
