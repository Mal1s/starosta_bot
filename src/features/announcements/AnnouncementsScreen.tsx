import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Megaphone, AlertCircle, Pin, Plus, X } from 'lucide-react';
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
  const queryClient = useQueryClient();
  const role = me?.membership?.role ?? 'student';
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => client.getAnnouncements(),
    enabled: !!client,
  });

  const createMutation = useMutation({
    mutationFn: () => client.createAnnouncement({ title: title.trim(), body: body.trim(), urgent, pinned }),
    onSuccess: async () => {
      setTitle('');
      setBody('');
      setUrgent(false);
      setPinned(false);
      setComposerOpen(false);
      setActionError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['announcements'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
      haptic('medium');
    },
    onError: () => setActionError(ru.error.generic),
  });

  const readMutation = useMutation({
    mutationFn: (id: string) => client.markAnnouncementRead(id),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['announcements'] }),
        queryClient.invalidateQueries({ queryKey: ['me'] }),
      ]);
    },
    onError: () => setActionError(ru.error.generic),
  });

  return (
    <div>
      <ScreenHeader title={ru.nav.announcements} />

      {isStaff(role) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Button fullWidth variant="secondary" className="mb-4" onClick={() => { setActionError(null); setComposerOpen(true); }}>
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
                      loading={readMutation.isPending}
                      onClick={() => { haptic('light'); readMutation.mutate(a.id); }}
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

      {actionError && !composerOpen && <p role="alert" className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>{actionError}</p>}

      {composerOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/55 px-4 pb-5 pt-10" role="presentation" onClick={() => setComposerOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-title"
            className="max-h-full w-full max-w-md overflow-y-auto rounded-3xl p-5"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}>Для всей группы</p>
                <h2 id="announcement-title" className="mt-1 text-lg font-bold" style={{ color: 'var(--text)' }}>Новое объявление</h2>
              </div>
              <button type="button" onClick={() => setComposerOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full" aria-label="Закрыть" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>Заголовок</span>
                <input
                  autoFocus
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder="Например, собрание группы"
                  className="min-h-[48px] w-full rounded-xl px-3 text-sm outline-none"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium" style={{ color: 'var(--muted)' }}>Текст</span>
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  maxLength={3000}
                  rows={5}
                  placeholder="Что нужно знать группе?"
                  className="w-full resize-y rounded-xl px-3 py-3 text-sm leading-5 outline-none"
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <span className="mt-1 block text-right text-[10px]" style={{ color: 'var(--muted)' }}>{body.length}/3000</span>
              </label>
              <label className="flex min-h-[46px] items-center gap-3 rounded-xl px-3" style={{ backgroundColor: 'var(--surface-2)' }}>
                <input type="checkbox" checked={urgent} onChange={(event) => setUrgent(event.target.checked)} className="h-5 w-5" style={{ accentColor: 'var(--danger)' }} />
                <span className="text-sm" style={{ color: 'var(--text)' }}>Срочное объявление</span>
              </label>
              <label className="flex min-h-[46px] items-center gap-3 rounded-xl px-3" style={{ backgroundColor: 'var(--surface-2)' }}>
                <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} className="h-5 w-5" style={{ accentColor: 'var(--primary)' }} />
                <span className="text-sm" style={{ color: 'var(--text)' }}>Закрепить вверху</span>
              </label>
              {actionError && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{actionError}</p>}
              <Button
                fullWidth
                size="lg"
                loading={createMutation.isPending}
                disabled={title.trim().length < 3 || body.trim().length < 3 || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                <span className="flex items-center justify-center gap-2"><Megaphone size={17} /> Опубликовать</span>
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
