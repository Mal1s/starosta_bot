import { useState } from 'react';
import { setDevRole, getDevRole } from '@/mock';
import { ru } from '@/i18n/ru';
import { useAppStore } from '@/app/store';
import { haptic } from '@/lib/telegram';

type DevRole = 'headman' | 'deputy' | 'student1' | 'student2';

const roles: { key: DevRole; label: string }[] = [
  { key: 'headman', label: ru.dev.headman },
  { key: 'deputy', label: ru.dev.deputy },
  { key: 'student1', label: ru.dev.student1 },
  { key: 'student2', label: ru.dev.student2 },
];

export function DevSwitcher() {
  const [current, setCurrent] = useState<DevRole>(getDevRole());
  const setMe = useAppStore((s) => s.setMe);
  const client = useAppStore((s) => s.client);

  async function switchRole(role: DevRole) {
    haptic('light');
    setDevRole(role);
    setCurrent(role);
    if (client) {
      try {
        const me = await client.getMe();
        setMe(me);
      } catch {
        // ignore
      }
    }
  }

  return (
    <div
      className="fixed top-2 left-2 z-[100] rounded-lg px-2 py-1.5 flex items-center gap-1.5"
      style={{
        backgroundColor: 'var(--surface)',
        border: '1px solid var(--border)',
        fontSize: '10px',
      }}
    >
      <span style={{ color: 'var(--muted)' }}>{ru.dev.loginAs}:</span>
      {roles.map((r) => (
        <button
          key={r.key}
          onClick={() => switchRole(r.key)}
          className="px-1.5 py-0.5 rounded font-medium transition-all"
          style={{
            backgroundColor: current === r.key ? 'var(--primary)' : 'transparent',
            color: current === r.key ? '#fff' : 'var(--text)',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
