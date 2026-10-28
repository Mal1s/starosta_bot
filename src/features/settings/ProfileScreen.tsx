import { useNavigate } from 'react-router-dom';
import { Settings, HelpCircle, LogOut, BarChart3, Shield } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, ScreenHeader } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { isStaff, isAdmin } from '@/lib/permissions';
import type { Role } from '@/lib/permissions';

const roleLabels: Record<string, string> = {
  student: ru.role.student,
  deputy: ru.role.deputy,
  headman: ru.role.headman,
  admin: ru.role.admin,
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

      <Card className="mb-4">
        <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{membership?.full_name}</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{group?.name}</p>
        <div className="mt-2">
          <span
            className="text-xs px-2 py-1 rounded-md"
            style={{ backgroundColor: 'var(--primary)20', color: 'var(--primary)' }}
          >
            {roleLabels[role]}
          </span>
        </div>
      </Card>

      <div className="space-y-2">
        <MenuItem icon={BarChart3} label={ru.profile.statistics} onClick={() => navigate('/stats')} />
        <MenuItem icon={Settings} label={ru.profile.settings} onClick={() => navigate('/settings')} />
        <MenuItem icon={HelpCircle} label={ru.profile.help} onClick={() => navigate('/help')} />
        {isAdmin(role) && (
          <MenuItem icon={Shield} label={ru.profile.admin} onClick={() => navigate('/admin')} />
        )}
        <MenuItem icon={LogOut} label={ru.profile.exit} danger />
      </div>
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
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-xl transition-all active:scale-[0.98]"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        color: danger ? 'var(--danger)' : 'var(--text)',
      }}
    >
      <Icon size={20} />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
