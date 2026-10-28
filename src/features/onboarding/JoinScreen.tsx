import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button } from '@/components/ui';
import { useAppStore } from '@/app/store';

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
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 pt-6 pb-2 text-sm"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={18} /> {ru.common.back}
      </button>

      <div className="space-y-4 pt-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block" style={{ color: 'var(--text)' }}>
            {ru.join.enterCode}
          </label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder={ru.join.codePlaceholder}
            className="w-full px-4 py-3 rounded-xl outline-none text-center text-lg font-mono tracking-wider"
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
            className="w-full px-4 py-3 rounded-xl outline-none"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)' }}
          />
        </div>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="w-5 h-5 rounded mt-0.5"
            style={{ accentColor: 'var(--primary)' }}
          />
          <span className="text-xs leading-relaxed" style={{ color: 'var(--muted)' }}>
            {ru.consent.text}
          </span>
        </label>
        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        <Button
          fullWidth
          disabled={!code || !fullName || !consent || loading}
          onClick={handleJoin}
        >
          {loading ? ru.common.loading : ru.join.submit}
        </Button>
      </div>
    </div>
  );
}
