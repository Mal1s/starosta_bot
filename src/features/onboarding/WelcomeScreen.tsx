import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, GraduationCap, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button, Card } from '@/components/ui';
import { haptic } from '@/lib/telegram';

const spring = { type: 'spring' as const, stiffness: 260, damping: 20 };

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden px-5 pb-8 pt-12">
      <div className="pointer-events-none absolute -right-24 top-8 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: 'var(--primary)' }} />
      <div className="pointer-events-none absolute -left-24 bottom-24 h-52 w-52 rounded-full opacity-15 blur-3xl" style={{ backgroundColor: 'var(--accent)' }} />

      <div className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--muted)' }}>
          <Sparkles size={14} color="var(--accent)" /> Starosta
        </div>
        <div className="rounded-full px-3 py-1.5 text-[11px] font-medium" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>Telegram Mini App</div>
      </div>

      <div className="relative z-10 flex flex-1 flex-col justify-center py-12">
        <motion.div initial={{ scale: 0.7, rotate: -12, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ ...spring, delay: 0.08 }} className="relative mb-8 h-24 w-24">
          <motion.div animate={{ y: [0, -7, 0] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px]" style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', boxShadow: '0 18px 50px -14px var(--primary)' }}>
            <div className="absolute inset-0 opacity-25" style={{ background: 'radial-gradient(circle at 25% 15%, #fff 0%, transparent 48%)' }} />
            <GraduationCap size={44} color="#FFFFFF" strokeWidth={1.8} />
          </motion.div>
          <motion.div animate={{ scale: [1, 1.22, 1], opacity: [0.4, 0, 0.4] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }} className="absolute -inset-2 rounded-[34px]" style={{ border: '1px solid var(--primary)' }} />
        </motion.div>

        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="mb-3 text-sm font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--primary)' }}>Твоя группа в порядке</motion.p>
        <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }} className="max-w-sm text-[42px] font-bold leading-[1.02] tracking-[-0.04em]" style={{ color: 'var(--text)' }}>{ru.welcome.title}</motion.h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }} className="mt-4 max-w-xs text-base leading-6" style={{ color: 'var(--muted)' }}>{ru.welcome.subtitle}</motion.p>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46 }} className="mt-8 grid grid-cols-3 gap-2">
          {[
            { icon: GraduationCap, label: 'Расписание' },
            { icon: Users, label: 'Опросы' },
            { icon: ShieldCheck, label: 'Журнал' },
          ].map(({ icon: Icon, label }) => <Card key={label} className="flex min-h-[86px] flex-col items-start justify-between p-3"><Icon size={18} color="var(--primary)" /><span className="text-[11px] font-medium leading-4" style={{ color: 'var(--text)' }}>{label}</span></Card>)}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.58 }} className="relative z-10 space-y-3">
        <Button fullWidth size="lg" onClick={() => { haptic('light'); navigate('/create-group'); }}><span className="flex items-center justify-center gap-2"><GraduationCap size={19} /> {ru.welcome.headman} <ArrowRight size={17} /></span></Button>
        <Button fullWidth size="lg" variant="secondary" onClick={() => { haptic('light'); navigate('/join'); }}><span className="flex items-center justify-center gap-2"><Users size={19} /> {ru.welcome.student}</span></Button>
        <p className="pt-2 text-center text-[11px] leading-4" style={{ color: 'var(--muted)' }}>Без регистрации по паролю — вход через Telegram</p>
      </motion.div>
    </div>
  );
}
