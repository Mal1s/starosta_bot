import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Bug } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, Button } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';
import { haptic } from '@/lib/telegram';

const faqs: { q: string; a: string }[] = [
  { q: 'Староста ушёл, что делать?', a: 'Если староста долго не отмечает журнал, бот предложит группе выбрать нового. Нужно не менее 3 голосов.' },
  { q: 'Почему не приходят опросы?', a: 'Проверь, что бот не заблокирован. Объявления и опросы приходят только если ты не заблокировал бота.' },
  { q: 'Как сменить часовой пояс?', a: 'Часовой пояс меняет староста в настройках группы. У всех участников он общий.' },
  { q: 'Как поменять подгруппу?', a: 'Подгруппу назначает староста. Обратись к нему, и он поменяет её в разделе «Участники».' },
  { q: 'Что видит староста про мои пропуски?', a: 'Староста видит твои ответы, причины пропусков и отметки. Другие студенты чужих причин не видят.' },
  { q: 'Как удалить мои данные?', a: 'Зайди в «Мои данные» в настройках. Отметки останутся в статистике группы без твоего имени.' },
];

export function HelpScreen() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <div>
      <ScreenHeader title={ru.profile.help} />

      <StaggerGroup className="space-y-2 mb-4">
        {faqs.map((faq, i) => (
          <StaggerItem key={i}>
            <Card>
              <button
                onClick={() => {
                  haptic('light');
                  setOpenIdx(openIdx === i ? null : i);
                }}
                className="w-full flex items-center justify-between text-left"
              >
                <span className="text-sm font-medium flex-1" style={{ color: 'var(--text)' }}>{faq.q}</span>
                <motion.div animate={{ rotate: openIdx === i ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown size={18} color="var(--muted)" />
                </motion.div>
              </button>
              <AnimatePresence>
                {openIdx === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    className="overflow-hidden"
                  >
                    <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--muted)' }}>
                      {faq.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          </StaggerItem>
        ))}
      </StaggerGroup>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <Button fullWidth variant="secondary">
          <span className="flex items-center justify-center gap-2">
            <Bug size={18} /> Сообщить об ошибке
          </span>
        </Button>
      </motion.div>
    </div>
  );
}
