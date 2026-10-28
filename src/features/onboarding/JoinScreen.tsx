import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button } from '@/components/ui';
import { useAppStore } from '@/app/store';
import { haptic } from '@/lib/telegram';

export function JoinScreen() {
  const navigate = useNavigate();
  const client = useAppStore((s) => s.client);
  const [code, setCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      await client.joinGroup({ code, full_name: fullName, consent });
      navigate('/pending');
    } catch {
      setError(ru.error.generic);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen px-4">
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => {
          haptic('light');
          navigate('/');
        }}
        className="flex items-center gap-1 pt-6 pb-2 text-sm"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={18} /> {ru.common.back}
      </motion.button>

      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        className="space-y-4 pt-4"
      >
        <div>
          <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text)' }}>
            {ru.join.enterCode}
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={ru.join.codePlaceholder}
            className="w-full px-4 py-3 rounded-xl outline-none text-center text-lg font-mono tracking-wider transition-all"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <div>
          <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text)' }}>
            {ru.join.fullName}
          </label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={ru.join.fullNamePlaceholder}
            className="w-full px-4 py-3 rounded-xl outline-none transition-all"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <div
            onClick={() => {
              haptic('light');
              setConsent(!consent);
            }}
            className="mt-0.5 shrink-0"
          >
            <motion.div
              animate={{ scale: consent ? 1 : 0.9 }}
              className="w-5 h-5 rounded flex items-center justify-center"
              style={{
                backgroundColor: consent ? 'var(--primary)' : 'transparent',
                border: `2px solid ${consent ? 'var(--primary)' : 'var(--border)'}`,
              }}
            >
              {consent && (
                <motion.svg
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                >
                  <path d="M5 13l4 4L19 7" />
                </motion.svg>
              )}
            </motion.div>
          </div>
          <input type="checkbox" checked={consent} onChange={() => {}} className="sr-only" />
          <span className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            {ru.consent.text}
          </span>
        </label>
        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        <Button
          fullWidth
          disabled={!code || !fullName || !consent || loading}
          onClick={handleJoin}
          loading={loading}
        >
          {ru.join.submit}
        </Button>
      </motion.div>
    </div>
  );
}
