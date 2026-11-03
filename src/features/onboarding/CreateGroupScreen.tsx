import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronRight, Copy, GraduationCap, KeyRound, PartyPopper, Sparkles } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button, Card } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { haptic, hapticNotify } from '@/lib/telegram';

const stepTransition = { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };

type Phase = 'wizard' | 'recovery';

export function CreateGroupScreen() {
  const navigate = useNavigate();
  const client = useAppStore((s) => s.client);
  const setMe = useAppStore((s) => s.setMe);

  const [phase, setPhase] = useState<Phase>('wizard');
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [fullName, setFullName] = useState('');
  const [timezone, setTimezone] = useState(
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'Europe/Moscow'
  );
  const [recoveryCode, setRecoveryCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = [ru.create.step1, ru.create.step2, ru.create.step3];

  async function handleCreate() {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.createGroup({
        name: name.trim(),
        institution: institution.trim() || undefined,
        course: course ? parseInt(course) : undefined,
        timezone,
        full_name: fullName.trim(),
      });
      setRecoveryCode(res.recovery_code);
      hapticNotify('success');
      setPhase('recovery');
    } catch {
      hapticNotify('error');
      setError(ru.error.generic);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    haptic('light');
    setError(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(recoveryCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Не удалось скопировать код. Сохраните его вручную.');
    }
  }

  async function handleEnterApp() {
    if (!client) return;
    haptic('light');
    setLoading(true);
    setError(null);
    try {
      const me = await client.getMe();
      if (!me.group || me.membership?.status !== 'active') throw new Error('Group setup is not ready');
      setMe(me);
      navigate('/today', { replace: true });
    } catch {
      setError(ru.error.generic);
    } finally {
      setLoading(false);
    }
  }

  function goBack() {
    haptic('light');
    if (phase === 'recovery') return;
    if (step === 0) navigate('/');
    else setStep(step - 1);
  }

  if (phase === 'recovery') {
    return (
      <div className="relative flex min-h-screen flex-col overflow-hidden px-5 pb-8 pt-12">
        <div className="pointer-events-none absolute -right-20 top-16 h-56 w-56 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: 'var(--success)' }} />

        <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.1 }} className="relative z-10 mb-6 flex h-16 w-16 items-center justify-center rounded-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)' }}>
          <PartyPopper size={30} color="var(--success)" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="relative z-10">
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--success)' }}>{ru.onboarding.done}</p>
          <h1 className="text-3xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{ru.recovery.title}</h1>
          <p className="mt-3 text-sm leading-6" style={{ color: 'var(--muted)' }}>{ru.recovery.hint}</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32 }} className="relative z-10 mt-6">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--muted)' }}>
              <KeyRound size={14} /> {ru.recovery.label}
            </div>
            <code className="block text-center text-2xl font-bold tracking-[0.18em]" style={{ color: 'var(--primary)' }}>
              {recoveryCode}
            </code>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }} className="relative z-10 mt-6 space-y-3">
          <Button fullWidth variant="secondary" onClick={handleCopy}>
            <span className="flex items-center justify-center gap-2">
              {copied ? <Check size={16} color="var(--success)" /> : <Copy size={16} />}
              {copied ? ru.recovery.copied : ru.recovery.copy}
            </span>
          </Button>
          {error && <p role="alert" className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

          <label className="flex cursor-pointer items-center gap-3 rounded-2xl p-4" style={{ backgroundColor: 'var(--surface)', border: `1px solid ${saved ? 'var(--primary)' : 'var(--border)'}` }}>
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="h-5 w-5 shrink-0" style={{ accentColor: 'var(--primary)' }} />
            <span className="text-sm" style={{ color: 'var(--text)' }}>{ru.recovery.saved}</span>
          </label>

          <Button fullWidth size="lg" disabled={!saved || loading} loading={loading} onClick={handleEnterApp}>
            <span className="flex items-center justify-center gap-2">{ru.common.next} <ArrowRight size={18} /></span>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 pb-8">
      <motion.button whileTap={{ scale: 0.94 }} onClick={goBack} className="flex items-center gap-1 pt-6 pb-3 text-sm" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={18} /> {ru.common.back}
      </motion.button>

      <div className="mb-7 flex items-center gap-2" aria-label={`Шаг ${step + 1} из ${steps.length}`}>
        {steps.map((label, i) => (
          <div key={i} className="flex min-w-0 flex-1 items-center gap-2">
            <motion.div animate={{ backgroundColor: i <= step ? 'var(--primary)' : 'var(--surface-2)' }} className="h-1.5 flex-1 rounded-full" />
            {i === step && <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--primary)' }}>{label}</span>}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={stepTransition} className="space-y-5">
          {step === 0 && (
            <section className="space-y-5">
              <IntroIcon icon={<GraduationCap size={24} />} />
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}>{ru.create.headmanLabel}</p>
                <h1 className="text-3xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{ru.create.title}</h1>
                <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{ru.create.step1Hint}</p>
              </div>
              <FormField label={ru.group.name} value={name} onChange={setName} placeholder="ПИ-21" autoFocus />
              <FormField label={ru.group.institution} value={institution} onChange={setInstitution} placeholder="МГУ им. М.В. Ломоносова" />
              <FormField label={ru.group.course} value={course} onChange={setCourse} placeholder="3" type="number" />
              <Button fullWidth size="lg" disabled={!name.trim()} onClick={() => { haptic('light'); setStep(1); }}>
                <span className="flex items-center justify-center gap-2">{ru.common.continue} <ChevronRight size={18} /></span>
              </Button>
            </section>
          )}

          {step === 1 && (
            <section className="space-y-5">
              <IntroIcon icon={<KeyRound size={24} />} />
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}>{ru.create.step2}</p>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{ru.create.timezoneTitle}</h1>
                <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{ru.create.timezoneHint}</p>
              </div>
              <FormField label={ru.group.timezone} value={timezone} onChange={setTimezone} />
              <Card className="flex items-start gap-3 p-3.5" delay={0.05}>
                <Sparkles size={18} className="mt-0.5 shrink-0" color="var(--accent)" />
                <p className="text-xs leading-5" style={{ color: 'var(--muted)' }}>{ru.create.timezoneNote}</p>
              </Card>
              <Button fullWidth size="lg" onClick={() => { haptic('light'); setStep(2); }}>
                <span className="flex items-center justify-center gap-2">{ru.common.continue} <ChevronRight size={18} /></span>
              </Button>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-5">
              <IntroIcon icon={<Sparkles size={24} />} />
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}>{ru.create.step3}</p>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{ru.create.nameTitle}</h1>
                <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{ru.create.nameHint}</p>
              </div>
              <FormField label={ru.group.fullName} value={fullName} onChange={setFullName} placeholder="Фамилия Имя" autoFocus />
              {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
              <Button fullWidth size="lg" disabled={!fullName.trim() || loading} onClick={handleCreate} loading={loading}>
                <span className="flex items-center justify-center gap-2"><GraduationCap size={18} /> {ru.create.createBtn}</span>
              </Button>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text', autoFocus }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; autoFocus?: boolean }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type} autoFocus={autoFocus} className="w-full rounded-2xl px-4 py-3.5 text-sm outline-none transition-all" style={{ backgroundColor: 'var(--surface)', border: `1px solid ${value ? 'var(--primary)' : 'var(--border)'}`, color: 'var(--text)' }} />
    </div>
  );
}

function IntroIcon({ icon }: { icon: ReactNode }) {
  return <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>{icon}</motion.div>;
}
