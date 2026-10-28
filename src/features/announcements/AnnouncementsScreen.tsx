import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Megaphone, AlertCircle, Pin, Plus } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, LoadingSpinner, EmptyState, Button, Badge } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { isStaff } from '@/lib/permissions';
import { formatDate } from '@/lib/time';
import { haptic } from '@/lib/telegram';

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
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Button fullWidth variant="secondary" className="mb-4">
            <span className="flex items-center justify-center gap-2">
              <Plus size={18} /> {ru.ann.create}
            </span>
          </Button>
        </motion.div>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : announcements && announcements.length > 0 ? (
        <StaggerGroup className="space-y-3">
          {announcements.map((a) => (
            <StaggerItem key={a.id}>
              <Card>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {a.pinned && <Pin size={14} color="var(--accent)" />}
                    {a.urgent && (
                      <motion.span
                        animate={{ scale: [1, 1.15, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <AlertCircle size={16} color="var(--danger)" />
                      </motion.span>
                    )}
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
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        haptic('light');
                        client.markAnnouncementRead(a.id);
                      }}
                    >
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
            </StaggerItem>
          ))}
        </StaggerGroup>
      ) : (
        <EmptyState title={ru.common.empty} />
      )}
    </div>
  );
}
