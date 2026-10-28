import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Users } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button } from '@/components/ui';

const spring = { type: 'spring' as const, stiffness: 260, damping: 20 };

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <motion.div
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ ...spring, delay: 0.1 }}
        className="relative mb-8"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="w-24 h-24 rounded-3xl flex items-center justify-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
            boxShadow: '0 12px 40px -8px var(--primary)',
          }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)',
            }}
          />
          <GraduationCap size={44} color="#FFFFFF" />
        </motion.div>
        <motion.div
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-3xl"
          style={{ border: '2px solid var(--primary)' }}
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        className="text-3xl font-bold mb-2"
        style={{ color: 'var(--text)' }}
      >
        {ru.welcome.title}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="text-base mb-12 max-w-xs"
        style={{ color: 'var(--muted)' }}
      >
        {ru.welcome.subtitle}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
        className="w-full max-w-xs space-y-3"
      >
        <Button fullWidth size="lg" onClick={() => navigate('/create-group')}>
          <span className="flex items-center justify-center gap-2">
            <GraduationCap size={20} />
            {ru.welcome.headman}
          </span>
        </Button>
        <Button fullWidth size="lg" variant="secondary" onClick={() => navigate('/join')}>
          <span className="flex items-center justify-center gap-2">
            <Users size={20} />
            {ru.welcome.student}
          </span>
        </Button>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-10 flex items-center gap-1.5"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.2, 0.8, 0.2], scale: [0.8, 1, 0.8] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: 'var(--primary)' }}
          />
        ))}
      </motion.div>
    </div>
  );
}
