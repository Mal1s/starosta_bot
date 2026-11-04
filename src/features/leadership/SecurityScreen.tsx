import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, ArrowRightLeft, Trash2, AlertTriangle, Check, Copy, RotateCcw } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, Button } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { haptic, hapticNotify } from '@/lib/telegram';
import { ConfirmSheet } from '@/features/group/MembersScreen';

export function SecurityScreen() {
  const navigate = useNavigate();
  const client = useAppStore((s) => s.client)!;
  const me = useAppStore((s) => s.me);

  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [loadingRecovery, setLoadingRecovery] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [groupDeleted, setGroupDeleted] = useState(me?.group?.state === 'pending_deletion');

  async function handleRegenerateRecovery() {
    setLoadingRecovery(true);
    haptic('light');
    try {
      const res = await client.regenerateRecovery();
      setRecoveryCode(res.recovery_code);
      setShowRecovery(true);
      hapticNotify('success');
    } catch {
      hapticNotify('error');
    } finally {
      setLoadingRecovery(false);
    }
  }

  function handleCopy() {
    haptic('light');
    navigator.clipboard?.writeText(recoveryCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDeleteGroup() {
    setLoadingDelete(true);
    hapticNotify('warning');
    try {
      await client.deleteGroup();
      setGroupDeleted(true);
      setConfirmDelete(false);
    } catch {
      hapticNotify('error');
    } finally {
      setLoadingDelete(false);
    }
  }

  async function handleRestoreDeletion() {
    haptic('light');
    try {
      await client.restoreDeletion();
      setGroupDeleted(false);
      hapticNotify('success');
    } catch {
      hapticNotify('error');
    }
  }

  return (
    <div>
      <ScreenHeader title={ru.settings.security} />

      {groupDeleted && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-4">
          <Card className="flex items-start gap-3" >
            <AlertTriangle size={20} className="mt-0.5 shrink-0" color="var(--warning)" />
            <div className="flex-1">
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--warning)' }}>Группа на удалении</p>
              <p className="text-xs leading-5 mb-3" style={{ color: 'var(--muted)' }}>{ru.group.delete.warn}</p>
              <Button size="sm" variant="secondary" onClick={handleRestoreDeletion}>
                <span className="flex items-center gap-2"><RotateCcw size={14} /> {ru.group.delete.cancel}</span>
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      <StaggerGroup className="space-y-3">
        <StaggerItem>
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}>
                <KeyRound size={20} color="var(--primary)" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Код восстановления</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Позволяет вернуть роль старосты при смене аккаунта. Старый код перестанет работать.</p>
              </div>
            </div>
            <Button fullWidth variant="secondary" onClick={handleRegenerateRecovery} loading={loadingRecovery}>Сгенерировать новый</Button>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}>
                <ArrowRightLeft size={20} color="var(--accent)" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{ru.leader.transfer.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Передать роль другому участнику группы. Потребуется подтвердить словом «ПЕРЕДАТЬ».</p>
              </div>
            </div>
            <Button fullWidth variant="secondary" onClick={() => { haptic('light'); navigate('/members'); }}>{ru.leader.transfer.title}</Button>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 15%, transparent)' }}>
                <Trash2 size={20} color="var(--danger)" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>{ru.group.delete.confirm}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{ru.group.delete.warn}</p>
              </div>
            </div>
            <Button fullWidth variant="danger" disabled={groupDeleted} onClick={() => { haptic('medium'); setConfirmDelete(true); }}>{ru.group.delete.confirm}</Button>
          </Card>
        </StaggerItem>
      </StaggerGroup>

      <AnimatePresence>
        {showRecovery && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowRecovery(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="w-full max-w-md rounded-t-3xl p-5 pb-8" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none' }} onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'var(--border)' }} />
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
                  <KeyRound size={20} color="var(--primary)" />
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: 'var(--text)' }}>{ru.recovery.title}</p>
                  <p className="text-sm mt-1 leading-5" style={{ color: 'var(--muted)' }}>{ru.recovery.hint}</p>
                </div>
              </div>
              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--surface-2)' }}>
                <code className="block text-center text-2xl font-bold tracking-[0.18em]" style={{ color: 'var(--primary)' }}>{recoveryCode}</code>
              </div>
              <div className="space-y-2">
                <Button fullWidth variant="secondary" onClick={handleCopy}>
                  <span className="flex items-center justify-center gap-2">{copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />} {copied ? ru.recovery.copied : ru.recovery.copy}</span>
                </Button>
                <Button fullWidth onClick={() => setShowRecovery(false)}>{ru.common.close}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDelete && (
          <ConfirmSheet
            title="Удалить группу?"
            message={ru.group.delete.warn}
            confirmLabel={ru.group.delete.confirm}
            loading={loadingDelete}
            onConfirm={handleDeleteGroup}
            onClose={() => setConfirmDelete(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
