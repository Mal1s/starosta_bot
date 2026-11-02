import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Hourglass, UserCheck, X } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { haptic } from '@/lib/telegram';

export function PendingScreen() {
  const navigate = useNavigate();
  const client = useAppStore((s) => s.client);
  const [revoking, setRevoking] = useState(false);

  async function handleRevoke() {
    if (!client) return;
    setRevoking(true);
    haptic('light');
    try {
      await client.leaveGroup();
      navigate('/');
    } catch {
      setRevoking(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      <div className="pointer-events-none absolute -right-20 top-12 h-52 w-52 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: 'var(--primary)' }} />
      <div className="pointer-events-none absolute -left-20 bottom-20 h-48 w-48 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: 'var(--accent)' }} />

      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.1 }} className="relative z-10 mb-8">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="absolute inset-0 rounded-full" style={{ border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
          <motion.div animate={{ scale: [1, 1.18, 1], opacity: [0.25, 0, 0.25] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} className="absolute -inset-3 rounded-full" style={{ border: '2px solid var(--primary)' }} />
          <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 12%, transparent)' }}>
            <Hourglass size={28} color="var(--primary)" />
          </div>
        </div>
      </motion.div>

      <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="relative z-10 text-xl font-bold mb-2" style={{ color: 'var(--text)' }}>
        {ru.join.pending}
      </motion.p>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="relative z-10 text-sm mb-2 max-w-xs leading-6" style={{ color: 'var(--muted)' }}>
        {ru.pending.hint}
      </motion.p>

      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.65 }} className="relative z-10 mb-10 inline-flex items-center gap-2 rounded-full px-4 py-2" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        <UserCheck size={15} color="var(--success)" />
        <span className="text-xs font-medium" style={{ color: 'var(--muted)' }}>{ru.pending.status}</span>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="relative z-10">
        <Button variant="ghost" size="sm" onClick={handleRevoke} disabled={revoking}>
          <span className="flex items-center gap-2" style={{ color: 'var(--danger)' }}>
            <X size={15} /> {ru.join.revoke}
          </span>
        </Button>
      </motion.div>
    </div>
  );
}
