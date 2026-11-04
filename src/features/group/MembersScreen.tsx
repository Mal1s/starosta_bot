import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, X, UserPlus, Trash2, Crown, AlertTriangle } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, LoadingSpinner, Badge, Button } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { isStaff } from '@/lib/permissions';
import { haptic, hapticNotify } from '@/lib/telegram';

const roleLabels: Record<string, string> = {
  student: ru.role.student,
  deputy: ru.role.deputy,
  headman: ru.role.headman,
};

const roleColors: Record<string, 'primary' | 'warning' | 'success'> = {
  headman: 'primary',
  deputy: 'warning',
  student: 'success',
};

export function MembersScreen() {
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);
  const role = me?.membership?.role ?? 'student';
  const queryClient = useQueryClient();
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const { data: members, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => client.getMembers(),
    enabled: !!client,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['members'] });
    queryClient.invalidateQueries({ queryKey: ['me'] });
  };

  const approveMutation = useMutation({ mutationFn: (id: string) => client.approveMember(id), onSuccess: invalidate });
  const rejectMutation = useMutation({ mutationFn: (id: string) => client.rejectMember(id), onSuccess: invalidate });
  const removeMutation = useMutation({ mutationFn: (id: string) => client.removeMember(id), onSuccess: invalidate });

  function handleApprove(id: string) {
    hapticNotify('success');
    approveMutation.mutate(id);
  }

  function handleReject(id: string) {
    haptic('medium');
    rejectMutation.mutate(id);
  }

  function handleRemove(id: string) {
    hapticNotify('warning');
    removeMutation.mutate(id);
    setConfirmRemove(null);
  }

  if (isLoading) return <div><ScreenHeader title="Участники" /><LoadingSpinner /></div>;

  const pending = members?.filter((m) => m.status === 'pending') ?? [];
  const active = members?.filter((m) => m.status === 'active') ?? [];

  return (
    <div>
      <ScreenHeader title="Участники" subtitle={`Всего: ${active.length}`} />

      {isStaff(role) && pending.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <Card className="mb-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--warning) 15%, transparent)' }}>
                <UserPlus size={15} color="var(--warning)" />
              </div>
              <p className="text-sm font-semibold" style={{ color: 'var(--warning)' }}>Заявки ({pending.length})</p>
            </div>
            <div className="space-y-2">
              {pending.map((m) => (
                <div key={m.id} className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: 'var(--text)' }}>{m.full_name}</span>
                  <div className="flex gap-1">
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => handleApprove(m.id)}
                      disabled={approveMutation.isPending}
                      className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-50"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)' }}
                      aria-label="Принять"
                    >
                      <Check size={16} color="var(--success)" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.88 }}
                      onClick={() => handleReject(m.id)}
                      disabled={rejectMutation.isPending}
                      className="w-9 h-9 rounded-lg flex items-center justify-center disabled:opacity-50"
                      style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 15%, transparent)' }}
                      aria-label="Отклонить"
                    >
                      <X size={16} color="var(--danger)" />
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      <StaggerGroup className="space-y-2">
        {active.map((m) => (
          <StaggerItem key={m.id}>
            <Card>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: 'var(--surface-2)', color: 'var(--text)' }}>
                  {m.full_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {m.role === 'headman' && <Crown size={13} color="var(--primary)" />}
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{m.full_name}</p>
                  </div>
                  <div className="mt-1">
                    <Badge color={roleColors[m.role] ?? 'success'}>{roleLabels[m.role]}</Badge>
                  </div>
                </div>
                {isStaff(role) && m.role === 'student' && (
                  <motion.button
                    whileTap={{ scale: 0.88 }}
                    onClick={() => { haptic('medium'); setConfirmRemove(m.id); }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)' }}
                    aria-label="Удалить"
                  >
                    <Trash2 size={15} color="var(--danger)" />
                  </motion.button>
                )}
              </div>
            </Card>
          </StaggerItem>
        ))}
      </StaggerGroup>

      {confirmRemove && (
        <ConfirmSheet
          title="Удалить участника?"
          message="Участник будет удалён из группы. Он сможет снова войти по ссылке, но потребуется новое одобрение."
          confirmLabel={ru.common.delete}
          loading={removeMutation.isPending}
          onConfirm={() => handleRemove(confirmRemove)}
          onClose={() => setConfirmRemove(null)}
        />
      )}
    </div>
  );
}

export function ConfirmSheet({ title, message, confirmLabel, loading, onConfirm, onClose }: { title: string; message: string; confirmLabel: string; loading?: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="w-full max-w-md rounded-t-3xl p-5 pb-8" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none' }} onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'var(--border)' }} />
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)' }}>
            <AlertTriangle size={20} color="var(--danger)" />
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: 'var(--text)' }}>{title}</p>
            <p className="text-sm mt-1 leading-5" style={{ color: 'var(--muted)' }}>{message}</p>
          </div>
        </div>
        <div className="space-y-2">
          <Button fullWidth variant="danger" onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
          <Button fullWidth variant="ghost" onClick={onClose}>{ru.common.cancel}</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
