import { useQuery } from '@tanstack/react-query';
import { Megaphone, AlertCircle, Pin } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, LoadingSpinner, EmptyState, Button, Badge } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { isStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/time';

export function AnnouncementsScreen() {
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);
  const role = me?.membership?.role ?? 'student';

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => client.getAnnouncements(),
    enabled: !!client,
  });

  return (
    <div>
      <ScreenHeader title={ru.nav.announcements} />

      {isStaff(role) && (
        <Button fullWidth variant="secondary" className="mb-4">
          <span className="flex items-center justify-center gap-2">
            <Megaphone size={18} /> {ru.ann.create}
          </span>
        </Button>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : announcements && announcements.length > 0 ? (
        <div className="space-y-3">
          {announcements.map((a) => (
            <Card key={a.id}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {a.pinned && <Pin size={14} color="var(--accent)" />}
                  {a.urgent && <AlertCircle size={16} color="var(--danger)" />}
                  <p className="font-semibold" style={{ color: 'var(--text)' }}>{a.title}</p>
                </div>
                {a.unread && <Badge color="primary">новое</Badge>}
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>{a.body}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  {formatDate(a.created_at, 'd MMM, HH:mm')}
                </span>
                {a.unread && (
                  <Button size="sm" variant="ghost" onClick={() => client.markAnnouncementRead(a.id)}>
                    {ru.ann.read}
                  </Button>
                )}
                {isStaff(role) && a.read_count !== undefined && a.total_count !== undefined && (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>
                    {ru.ann.readNofM.replace('{n}', String(a.read_count)).replace('{m}', String(a.total_count))}
                  </span>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title={ru.common.empty} />
      )}
    </div>
  );
}
