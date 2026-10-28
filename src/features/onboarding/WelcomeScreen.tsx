import { useNavigate } from 'react-router-dom';
import { GraduationCap, Users } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { Button } from '@/components/ui';

export function WelcomeScreen() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
      <div
        className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6"
        style={{ backgroundColor: 'var(--primary)' }}
      >
        <GraduationCap size={40} color="#FFFFFF" />
      </div>
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
        {ru.welcome.title}
      </h1>
      <p className="text-base mb-10 max-w-xs" style={{ color: 'var(--muted)' }}>
        {ru.welcome.subtitle}
      </p>
      <div className="w-full max-w-xs space-y-3">
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
      </div>
    </div>
  );
}
