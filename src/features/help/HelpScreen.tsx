import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Bug, Check, X } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, Button } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { useAppStore } from '@/app/store';
import { haptic, hapticNotify } from '@/lib/telegram';

const faqs: { q: string; a: string }[] = [
  { q: 'Староста ушёл, что делать?', a: 'Если староста долго не отмечает журнал, бот предложит группе выбрать нового. Нужно не менее 3 голосов.' },
  { q: 'Почему не приходят опросы?', a: 'Проверь, что бот не заблокирован. Объявления и опросы приходят только если ты не заблокировал бота.' },
  { q: 'Как сменить часовой пояс?', a: 'Часовой пояс меняет староста в настройках группы. У всех участников он общий.' },
  { q: 'Как поменять подгруппу?', a: 'Подгруппу назначает староста. Обратись к нему, и он поменяет её в разделе «Участники».' },
  { q: 'Что видит староста про мои пропуски?', a: 'Староста видит твои ответы, причины пропусков и отметки. Другие студенты чужих причин не видят.' },
  { q: 'Как удалить мои данные?', a: 'Зайди в «Мои данные» в настройках. Отметки останутся в статистике группы без твоего имени.' },
];

const checklist: { label: string; done: (s: { shared: boolean; schedule: boolean; journal: boolean }) => boolean }[] = [
  { label: 'Поделись ссылкой с группой', done: (s) => s.shared },
  { label: 'Введи расписание', done: (s) => s.schedule },
  { label: 'Открой журнал', done: (s) => s.journal },
];

export function HelpScreen() {
  const me = useAppStore((s) => s.me);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [showBugReport, setShowBugReport] = useState(false);
  const [bugText, setBugText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleBugSubmit() {
    if (!bugText.trim()) return;
    hapticNotify('success');
    setSubmitted(true);
    setTimeout(() => {
      setShowBugReport(false);
      setBugText('');
      setSubmitted(false);
    }, 1500);
  }

  return (
    <div>
      <ScreenHeader title={ru.profile.help} />

      {me?.group && (
        <StaggerGroup className="space-y-2 mb-4">
          <StaggerItem>
            <Card>
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Чек-лист запуска группы</p>
              <div className="space-y-2">
                {checklist.map((item) => {
                  const done = item.done(me.onboarding);
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: done ? 'var(--success)' : 'var(--surface-2)' }}>
                        {done && <Check size={12} color="#fff" />}
                      </div>
                      <span className="text-sm" style={{ color: done ? 'var(--text)' : 'var(--muted)', textDecoration: done ? 'none' : 'none' }}>{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          </StaggerItem>
        </StaggerGroup>
      )}

      <StaggerGroup className="space-y-2 mb-4">
        {faqs.map((faq, i) => (
          <StaggerItem key={i}>
            <Card>
              <button onClick={() => { haptic('light'); setOpenIdx(openIdx === i ? null : i); }} className="w-full flex items-center justify-between text-left">
                <span className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>{faq.q}</span>
                <motion.div animate={{ rotate: openIdx === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={18} color="var(--muted)" />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIdx === i && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} className="overflow-hidden">
                    <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--muted)' }}>{faq.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Button fullWidth variant="secondary" onClick={() => { haptic('light'); setShowBugReport(true); }}>
          <span className="flex items-center justify-center gap-2"><Bug size={18} /> Сообщить об ошибке</span>
        </Button>
      </motion.div>

      <AnimatePresence>
        {showBugReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[60] flex items-end justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowBugReport(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="w-full max-w-md rounded-t-3xl p-5 pb-8" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none' }} onClick={(e) => e.stopPropagation()}>
              <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: 'var(--border)' }} />
              <div className="flex items-center justify-between mb-3">
                <p className="text-base font-bold" style={{ color: 'var(--text)' }}>Сообщить об ошибке</p>
                <button onClick={() => setShowBugReport(false)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--surface-2)' }}><X size={16} color="var(--muted)" /></button>
              </div>
              <p className="text-xs mb-3 leading-5" style={{ color: 'var(--muted)' }}>Опиши, что произошло. Мы получим сообщение и постараемся быстро починить.</p>
              <textarea value={bugText} onChange={(e) => setBugText(e.target.value)} placeholder="Что случилось, на каком экране…" rows={4} className="w-full rounded-xl p-3 text-sm outline-none resize-none mb-3" style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} />
              <Button fullWidth disabled={!bugText.trim() || submitted} onClick={handleBugSubmit} loading={submitted}>
                <span className="flex items-center justify-center gap-2">{submitted ? <><Check size={16} /> Отправлено</> : 'Отправить'}</span>
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
