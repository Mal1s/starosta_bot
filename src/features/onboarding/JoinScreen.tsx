import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button, Card, LoadingSpinner } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { haptic, hapticNotify, getStartParam } from '@/lib/telegram';
import type { RosterEntry, Subgroup } from '@/api/types';

const stepTransition = { duration: 0.28, ease: [0.32, 0.72, 0, 1] as const };

type Step = 'code' | 'identity' | 'details';

function formatCode(value: string): string {
  return value.replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase().replace(/(.{3})/, '$1-');
}

export function JoinScreen() {
  const navigate = useNavigate();
  const client = useAppStore((s) => s.client);
  const [step, setStep] = useState<Step>('code');
  const [code, setCode] = useState(() => {
    const startParam = getStartParam();
    return startParam?.match(/^[A-Za-z0-9]{3}-?[A-Za-z0-9]{3}$/) ? formatCode(startParam) : '';
  });
  const [fullName, setFullName] = useState('');
  const [rosterId, setRosterId] = useState<string | undefined>();
  const [selectedSubgroups, setSelectedSubgroups] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [search, setSearch] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!client || step !== 'identity') return;
    let cancelled = false;
    setLoadingData(true);
    Promise.all([client.getRoster(), client.getSubgroups()])
      .then(([rosterData, subgroupData]) => {
        if (!cancelled) {
          setRoster(rosterData);
          setSubgroups(subgroupData);
        }
      })
      .catch(() => {
        if (!cancelled) setError(ru.error.generic);
      })
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => { cancelled = true; };
  }, [client, step]);

  const filteredRoster = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return roster;
    return roster.filter((item) => item.full_name.toLowerCase().includes(query));
  }, [roster, search]);

  function goBack() {
    haptic('light');
    if (step === 'code') navigate('/');
    else if (step === 'identity') setStep('code');
    else setStep('identity');
  }

  function chooseRoster(item: RosterEntry) {
    haptic('light');
    setRosterId(item.id);
    setFullName(item.full_name);
  }

  function toggleSubgroup(id: string) {
    haptic('light');
    setSelectedSubgroups((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  async function handleJoin() {
    if (!client || !consent || !fullName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await client.joinGroup({
        code: code.replace('-', ''),
        full_name: fullName.trim(),
        roster_id: rosterId,
        subgroup_ids: selectedSubgroups,
        consent,
      });
      hapticNotify('success');
      navigate('/pending');
    } catch {
      hapticNotify('error');
      setError(ru.error.generic);
    } finally {
      setLoading(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: 'code', label: ru.join.stepCode },
    { key: 'identity', label: ru.join.stepIdentity },
    { key: 'details', label: ru.join.stepDetails },
  ];
  const stepIndex = steps.findIndex((item) => item.key === step);

  return (
    <div className="min-h-screen px-4 pb-8">
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={goBack}
        className="flex items-center gap-1 pt-6 pb-3 text-sm"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={18} /> {ru.common.back}
      </motion.button>

      <div className="mb-7 flex items-center gap-2" aria-label={`Шаг ${stepIndex + 1} из ${steps.length}`}>
        {steps.map((item, index) => (
          <div key={item.key} className="flex min-w-0 flex-1 items-center gap-2">
            <motion.div
              animate={{ backgroundColor: index <= stepIndex ? 'var(--primary)' : 'var(--surface-2)' }}
              className="h-1.5 flex-1 rounded-full"
            />
            {index === stepIndex && <span className="shrink-0 text-[10px] font-semibold" style={{ color: 'var(--primary)' }}>{item.label}</span>}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={stepTransition}>
          {step === 'code' && (
            <section className="space-y-5">
              <IntroIcon icon={<Users size={24} />} />
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}>{ru.join.studentLabel}</p>
                <h1 className="text-3xl font-bold leading-tight" style={{ color: 'var(--text)' }}>{ru.join.title}</h1>
                <p className="mt-2 text-sm leading-6" style={{ color: 'var(--muted)' }}>{ru.join.codeHint}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>{ru.join.enterCode}</label>
                <input
                  autoFocus
                  inputMode="text"
                  value={code}
                  onChange={(event) => setCode(formatCode(event.target.value))}
                  placeholder={ru.join.codePlaceholder}
                  maxLength={7}
                  className="w-full rounded-2xl px-4 py-4 text-center text-2xl font-semibold tracking-[0.22em] outline-none transition-all placeholder:tracking-[0.18em]"
                  style={{ backgroundColor: 'var(--surface)', border: `1px solid ${code.length === 7 ? 'var(--primary)' : 'var(--border)'}`, color: 'var(--text)', boxShadow: code.length === 7 ? '0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent)' : 'none' }}
                />
              </div>
              <Card className="flex items-start gap-3 p-3.5" delay={0.05}>
                <ShieldCheck size={19} className="mt-0.5 shrink-0" color="var(--success)" />
                <p className="text-xs leading-5" style={{ color: 'var(--muted)' }}>{ru.join.codeSecure}</p>
              </Card>
              <Button fullWidth size="lg" disabled={code.length !== 7} onClick={() => { haptic('light'); setStep('identity'); }}>
                <span className="flex items-center justify-center gap-2">{ru.common.continue} <ChevronRight size={18} /></span>
              </Button>
            </section>
          )}

          {step === 'identity' && (
            <section className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}>{ru.join.stepIdentity}</p>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{ru.join.selectYourself}</h1>
                <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{ru.join.identityHint}</p>
              </div>
              {loadingData ? <LoadingSpinner /> : roster.length > 0 ? (
                <>
                  <div className="relative">
                    <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" color="var(--muted)" />
                    <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={ru.join.search} className="w-full rounded-xl py-3 pl-11 pr-4 text-sm outline-none" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                  </div>
                  <div className="space-y-2">
                    {filteredRoster.map((item) => {
                      const selected = rosterId === item.id;
                      return <button key={item.id} onClick={() => chooseRoster(item)} className="flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 text-left transition-all" style={{ backgroundColor: selected ? 'color-mix(in srgb, var(--primary) 13%, var(--surface))' : 'var(--surface)', border: `1px solid ${selected ? 'var(--primary)' : 'var(--border)'}`, color: 'var(--text)' }}><span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: selected ? 'var(--primary)' : 'var(--surface-2)', color: selected ? '#fff' : 'var(--muted)' }}>{item.full_name.charAt(0)}</span><span className="flex-1 text-sm font-medium">{item.full_name}</span>{selected && <Check size={18} color="var(--primary)" />}</button>;
                    })}
                  </div>
                  <button onClick={() => { setRosterId(undefined); setFullName(''); }} className="w-full rounded-xl border border-dashed p-3 text-sm" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>{ru.join.notInList}</button>
                </>
              ) : null}
              <div>
                <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>{ru.join.fullName}</label>
                <input value={fullName} onChange={(event) => { setFullName(event.target.value); setRosterId(undefined); }} placeholder={ru.join.fullNamePlaceholder} className="w-full rounded-xl px-4 py-3 text-sm outline-none" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              </div>
              <Button fullWidth size="lg" disabled={fullName.trim().length < 3} onClick={() => { haptic('light'); setStep('details'); }}>{ru.common.continue}</Button>
            </section>
          )}

          {step === 'details' && (
            <section className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary)' }}>{ru.join.stepDetails}</p>
                <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{ru.join.detailsTitle}</h1>
                <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>{ru.join.detailsHint}</p>
              </div>
              {subgroups.length > 0 && <Card className="space-y-3 p-4"><div><p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{ru.join.subgroups}</p><p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{ru.join.subgroupsHint}</p></div><div className="grid grid-cols-2 gap-2">{subgroups.map((subgroup) => { const selected = selectedSubgroups.includes(subgroup.id); return <button key={subgroup.id} onClick={() => toggleSubgroup(subgroup.id)} className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-left text-sm" style={{ backgroundColor: selected ? 'color-mix(in srgb, var(--primary) 13%, transparent)' : 'var(--surface-2)', border: `1px solid ${selected ? 'var(--primary)' : 'transparent'}`, color: 'var(--text)' }}>{selected ? <Check size={16} color="var(--primary)" /> : <span className="h-4 w-4 rounded border" style={{ borderColor: 'var(--muted)' }} />}{subgroup.name}</button>; })}</div></Card>}
              <label className="flex cursor-pointer items-start gap-3 rounded-2xl p-4" style={{ backgroundColor: 'var(--surface)', border: `1px solid ${consent ? 'var(--primary)' : 'var(--border)'}` }}><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-5 w-5 shrink-0" style={{ accentColor: 'var(--primary)' }} /><span className="text-xs leading-5" style={{ color: 'var(--muted)' }}>{ru.consent.text}</span></label>
              {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
              <Button fullWidth size="lg" disabled={!consent || loading} onClick={handleJoin} loading={loading}><span className="flex items-center justify-center gap-2"><Sparkles size={18} /> {ru.join.submit}</span></Button>
            </section>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function IntroIcon({ icon }: { icon: ReactNode }) {
  return <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)', color: 'var(--primary)' }}>{icon}</motion.div>;
}
