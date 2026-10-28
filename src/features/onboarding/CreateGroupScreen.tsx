import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button, ScreenHeader, Card } from '@/components/ui';
import { useAppStore } from '@/app/store';

export function CreateGroupScreen() {
  const navigate = useNavigate();
  const client = useAppStore((s) => s.client);
  const setMe = useAppStore((s) => s.setMe);
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
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text)' }}>
            {ru.recovery.title}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            {ru.recovery.hint}
          </p>
          <Card className="mb-6">
            <code className="text-xl font-mono tracking-wider block text-center" style={{ color: 'var(--primary)' }}>
              {recoveryCode}
            </code>
          </Card>
          <div className="space-y-3">
            <Button
              fullWidth
              variant="secondary"
              onClick={() => navigator.clipboard?.writeText(recoveryCode)}
            >
              {ru.recovery.copy}
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
            <Button
              fullWidth
              disabled={!saved}
              onClick={() => navigate('/today')}
            >
              {ru.common.next}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen px-4">
      <button
        onClick={() => (step === 0 ? navigate('/') : setStep(step - 1))}
        className="flex items-center gap-1 pt-6 pb-2 text-sm"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={18} /> {ru.common.back}
      </button>

      <div className="flex gap-2 mb-6">
        {steps.map((s, i) => (
          <div key={i} className="flex-1">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ backgroundColor: i <= step ? 'var(--primary)' : 'var(--surface-2)' }}
            />
            <p className="text-[10px] mt-1" style={{ color: i <= step ? 'var(--text)' : 'var(--muted)' }}>
              {s}
            </p>
          </div>
        ))}
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text)' }}>
              {ru.group.name}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ПИ-21"
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text)' }}>
              {ru.group.institution}
            </label>
            <input
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="МГУ"
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text)' }}>
              {ru.group.course}
            </label>
            <input
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              placeholder="3"
              type="number"
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <Button fullWidth disabled={!name} onClick={() => setStep(1)}>
            {ru.common.next}
          </Button>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text)' }}>
              {ru.group.timezone}
            </label>
            <input
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          <Button fullWidth onClick={() => setStep(2)}>
            {ru.common.next}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text)' }}>
              {ru.group.fullName}
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Фамилия Имя"
              className="w-full px-4 py-3 rounded-xl outline-none"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
            />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <Button fullWidth disabled={!fullName || loading} onClick={handleCreate}>
            {loading ? ru.common.loading : ru.common.save}
          </Button>
        </div>
      )}
    </div>
  );
}
