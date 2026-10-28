import { Clock } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, Button } from '@/components/ui';
import { useAppStore } from '@/app/store';

export function PendingScreen() {
  const client = useAppStore((s) => s.client);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'var(--surface-2)' }}>
        <Clock size={32} color="var(--muted)" />
      </div>
      <p className="text-lg font-medium mb-2" style={{ color: 'var(--text)' }}>
        {ru.join.pending}
      </p>
      <Button variant="ghost" size="sm">
        {ru.join.revoke}
      </Button>
    </div>
  );
}
