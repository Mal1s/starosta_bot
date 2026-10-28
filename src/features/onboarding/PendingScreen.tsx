import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Card, Button } from '@/components/ui';
import { useAppStore } from '@/app/store';

export function PendingScreen() {
  const client = useAppStore((s) => s.client);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
        className="relative mb-6"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            border: '3px solid var(--border)',
            borderTopColor: 'var(--primary)',
          }}
        >
          <Clock size={28} color="var(--muted)" />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid var(--primary)' }}
        />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="text-lg font-medium mb-2"
        style={{ color: 'var(--text)' }}
      >
        {ru.join.pending}
      </motion.p>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-sm mb-8 max-w-xs"
        style={{ color: 'var(--muted)' }}
      >
        Староста получит уведомление и одобрит твою заявку.
      </motion.p>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
        <Button variant="ghost" size="sm">
          {ru.join.revoke}
        </Button>
      </motion.div>
    </div>
  );
}
