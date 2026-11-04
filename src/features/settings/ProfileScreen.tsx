import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, HelpCircle, LogOut, BarChart3, Shield, ChevronRight, AlertTriangle } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader, Button } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { isStaff, isAdmin } from '@/lib/permissions';
import type { Role } from '@/lib/permissions';
import { haptic, hapticNotify } from '@/lib/telegram';

const roleLabels: Record<string, string> = {
  student: ru.role.student,
  deputy: ru.role.deputy,
  headman: ru.role.headman,
  admin: ru.role.admin,
};

const roleColors: Record<string, string> = {
  student: 'var(--success)',
  deputy: 'var(--warning)',
  headman: 'var(--primary)',
  admin: 'var(--danger)',
};

export function ProfileScreen() {
  const navigate = useNavigate();
  const client = useAppStore((s) => s.client);
  const setMe = useAppStore((s) => s.setMe);
  const me = useAppStore((s) => s.me);
  const membership = me?.membership;
  const group = me?.group;
  const role: Role = membership?.role ?? 'student';
  const [showExit, setShowExit] = useState(false);
  const [loadingExit, setLoadingExit] = useState(false);

  async function handleExit() {
    if (!client) return;
    setLoadingExit(true);
    hapticNotify('warning');
    try {
      await client.leaveGroup();
      setMe(null);
      navigate('/');
    } catch {
      hapticNotify('error');
    } finally {
      setLoadingExit(false);
    }
  }

  return (
    <div>
      <ScreenHeader title={ru.nav.profile} />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.28 }}>
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0" style={{ background: `linear-gradient(135deg, ${roleColors[role]} 0%, color-mix(in srgb, ${roleColors[role]} 60%, var(--accent)) 100%)`, color: '#fff' }}>
              {membership?.full_name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold truncate" style={{ color: 'var(--text)' }}>{membership?.full_name}</p>
              <p className="text-sm truncate" style={{ color: 'var(--muted)' }}>{group?.name}</p>
              <div className="mt-1.5">
                <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: `${roleColors[role]}20`, color: roleColors[role] }}>{roleLabels[role]}</span>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <StaggerGroup className="space-y-2">
        <StaggerItem>
          <MenuItem icon={BarChart3} label={ru.profile.statistics} onClick={() => { haptic('light'); navigate('/stats'); }} />
        </StaggerItem>
        <StaggerItem>
          <MenuItem icon={Settings} label={ru.profile.settings} onClick={() => { haptic('light'); navigate('/settings'); }} />
        </StaggerItem>
        <StaggerItem>
          <MenuItem icon={HelpCircle} label={ru.profile.help} onClick={() => { haptic('light'); navigate('/help'); }} />
        </StaggerItem>
        {isAdmin(role) && (
          <StaggerItem>
            <MenuItem icon={Shield} label={ru.profile.admin} onClick={() => { haptic('light'); navigate('/admin'); }} />
          </StaggerItem>
        )}
        {isStaff(role) && (
          <StaggerItem>
            <MenuItem icon={Settings} label="Участники" onClick={() => { haptic('light'); navigate('/members'); }} />
          </StaggerItem>
        )}
        <StaggerItem>
          <MenuItem icon={LogOut} label={ru.profile.exit} danger onClick={() => { haptic('medium'); setShowExit(true); }} />
        </StaggerItem>
      </StaggerGroup>

      <AnimatePresence>
        {showExit && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowExit(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="w-full max-w-md rounded-t-3xl p-5 pb-8" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none' }} onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'var(--border)' }} />
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 12%, transparent)' }}>
                  <AlertTriangle size={20} color="var(--danger)" />
                </div>
                <div>
                  <p className="text-base font-bold" style={{ color: 'var(--text)' }}>Выйти из группы?</p>
                  <p className="text-sm mt-1 leading-5" style={{ color: 'var(--muted)' }}>Ты сможешь вернуться по ссылке или коду группы, но понадобится новое одобрение старосты.</p>
                </div>
              </div>
              <div className="space-y-2">
                <Button fullWidth variant="danger" onClick={handleExit} loading={loadingExit}>{ru.profile.exit}</Button>
                <Button fullWidth variant="ghost" onClick={() => setShowExit(false)}>{ru.common.cancel}</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: typeof Settings; label: string; onClick?: () => void; danger?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-2xl"
      style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: danger ? 'var(--danger)' : 'var(--text)' }}
    >
      <Icon size={20} color={danger ? 'var(--danger)' : 'var(--muted)'} />
      <span className="text-sm font-medium flex-1 text-left">{label}</span>
      {!danger && <ChevronRight size={18} color="var(--muted)" />}
    </motion.button>
  );
}
