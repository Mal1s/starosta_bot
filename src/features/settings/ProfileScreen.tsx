import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Settings, HelpCircle, LogOut, BarChart3, Shield, ChevronRight } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { isStaff, isAdmin } from '@/lib/permissions';
import type { Role } from '@/lib/permissions';
import { haptic } from '@/lib/telegram';

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
  const me = useAppStore((s) => s.me);
  const membership = me?.membership;
  const group = me?.group;
  const role: Role = membership?.role ?? 'student';

  return (
    <div>
      <ScreenHeader title={ru.nav.profile} />

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.28 }}>
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shrink-0"
              style={{
                background: `linear-gradient(135deg, ${roleColors[role]} 0%, color-mix(in srgb, ${roleColors[role]} 60%, var(--accent)) 100%)`,
                color: '#fff',
              }}
            >
              {membership?.full_name?.charAt(0) ?? '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold truncate" style={{ color: 'var(--text)' }}>{membership?.full_name}</p>
              <p className="text-sm truncate" style={{ color: 'var(--muted)' }}>{group?.name}</p>
              <div className="mt-1.5">
                <span
                  className="text-xs px-2 py-0.5 rounded-md font-medium"
                  style={{ backgroundColor: `${roleColors[role]}20`, color: roleColors[role] }}
                >
                  {roleLabels[role]}
                </span>
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
        <StaggerItem>
          <MenuItem icon={LogOut} label={ru.profile.exit} danger />
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Settings;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      whileHover={{ scale: 1.01 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-2xl"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        color: danger ? 'var(--danger)' : 'var(--text)',
      }}
    >
      <Icon size={20} color={danger ? 'var(--danger)' : 'var(--muted)'} />
      <span className="text-sm font-medium flex-1 text-left">{label}</span>
      {!danger && <ChevronRight size={18} color="var(--muted)" />}
    </motion.button>
  );
}
