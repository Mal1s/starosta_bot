import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, Copy } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button, Card } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { haptic } from '@/lib/telegram';

const stepTransition = { duration: 0.3, ease: [0.32, 0.72, 0, 1] as const };

export function CreateGroupScreen() {
  const navigate = useNavigate();
  const client = useAppStore((s) => s.client);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [course, setCourse] = useState('');
  const [fullName, setFullName] = useState('');
  const [timezone, setTimezone] = useState(
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'Europe/Moscow'
  );
  const [recoveryCode, setRecoveryCode] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = ['Данные группы', 'Часовой пояс', 'ФИО'];

  async function handleCreate() {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const res = await client.createGroup({
        name,
        institution: institution || undefined,
        course: course ? parseInt(course) : undefined,
        timezone,
        full_name: fullName,
      });
      setRecoveryCode(res.recovery_code);
      setStep(3);
    } catch {
      setError(ru.error.generic);
    } finally {
      setLoading(false);
    }
  }

  if (step === 3) {
    return (
      <div className="flex flex-col min-h-screen px-6 pt-12">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}>
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)' }}
          >
            <Check size={32} color="var(--success)" />
          </div>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-2xl font-bold mb-2"
          style={{ color: 'var(--text)' }}
        >
          {ru.recovery.title}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-sm mb-6"
          style={{ color: 'var(--muted)' }}
        >
          {ru.recovery.hint}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="mb-6">
            <code className="text-xl font-mono tracking-wider block text-center" style={{ color: 'var(--primary)' }}>
              {recoveryCode}
            </code>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="space-y-3">
          <Button
            fullWidth
            variant="secondary"
            onClick={() => {
              haptic('light');
              navigator.clipboard?.writeText(recoveryCode);
            }}
          >
            <span className="flex items-center justify-center gap-2">
              <Copy size={16} /> {ru.recovery.copy}
            </span>
          </Button>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={saved}
              onChange={(e) => setSaved(e.target.checked)}
              className="w-5 h-5 rounded"
              style={{ accentColor: 'var(--primary)' }}
            />
            <span className="text-sm" style={{ color: 'var(--text)' }}>{ru.recovery.saved}</span>
          </label>
          <Button fullWidth disabled={!saved} onClick={() => navigate('/today')}>
            {ru.common.next}
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen px-4">
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          haptic('light');
          step === 0 ? navigate('/') : setStep(step - 1);
        }}
        className="flex items-center gap-1 pt-6 pb-2 text-sm"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={18} /> {ru.common.back}
      </motion.button>

      <div className="flex gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={i} className="flex-1">
            <motion.div
              animate={{ backgroundColor: i <= step ? 'var(--primary)' : 'var(--surface-2)' }}
              transition={{ duration: 0.3 }}
              className="h-1.5 rounded-full"
            />
            <p className="text-[10px] mt-1" style={{ color: i <= step ? 'var(--text)' : 'var(--muted)' }}>
              {s}
            </p>
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={stepTransition}
          className="space-y-4"
        >
          {step === 0 && (
            <>
              <FormField label={ru.group.name} value={name} onChange={setName} placeholder="ПИ-21" />
              <FormField label={ru.group.institution} value={institution} onChange={setInstitution} placeholder="МГУ" />
              <FormField label={ru.group.course} value={course} onChange={setCourse} placeholder="3" type="number" />
              <Button fullWidth disabled={!name} onClick={() => { haptic('light'); setStep(1); }}>
                {ru.common.next}
              </Button>
            </>
          )}

          {step === 1 && (
            <>
              <FormField label={ru.group.timezone} value={timezone} onChange={setTimezone} />
              <Button fullWidth onClick={() => { haptic('light'); setStep(2); }}>
                {ru.common.next}
              </Button>
            </>
          )}

          {step === 2 && (
            <>
              <FormField label={ru.group.fullName} value={fullName} onChange={setFullName} placeholder="Фамилия Имя" />
              {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
              <Button fullWidth disabled={!fullName || loading} onClick={handleCreate} loading={loading}>
                {ru.common.save}
              </Button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={type}
        className="w-full px-4 py-3 rounded-xl outline-none transition-all"
        style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
      />
    </div>
  );
}
