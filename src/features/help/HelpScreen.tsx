import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, Button } from '@/components/ui';

export function HelpScreen() {
  const faqs = [
    'Староста ушёл, что делать?',
    'Почему не приходят опросы?',
    'Как сменить часовой пояс?',
    'Как поменять подгруппу?',
    'Что видит староста про мои пропуски?',
    'Как удалить мои данные?',
  ];

  return (
    <div>
      <ScreenHeader title={ru.profile.help} />

      <Card className="mb-3">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>FAQ</p>
        <div className="space-y-2">
          {faqs.map((q) => (
            <details key={q} className="rounded-lg p-3" style={{ backgroundColor: 'var(--surface-2)' }}>
              <summary className="text-sm cursor-pointer" style={{ color: 'var(--text)' }}>{q}</summary>
              <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                Ответ появится позже.
              </p>
            </details>
          ))}
        </div>
      </Card>

      <Button fullWidth variant="secondary">
        Сообщить об ошибке
      </Button>
    </div>
  );
}
