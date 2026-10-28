import { motion } from 'framer-motion';
import { KeyRound, ArrowRightLeft, Trash2 } from 'lucide-react';
import { ru } from '@/i18n/ru';
import { ScreenHeader, Card, Button } from '@/components/ui';
import { StaggerGroup, StaggerItem } from '@/components/PageTransition';

export function SecurityScreen() {
  return (
    <div>
      <ScreenHeader title={ru.settings.security} />

      <StaggerGroup className="space-y-3">
        <StaggerItem>
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
              >
                <KeyRound size={20} color="var(--primary)" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Код восстановления</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Позволяет вернуть роль старосты при смене аккаунта.
                </p>
              </div>
            </div>
            <Button fullWidth variant="secondary">Сгенерировать новый</Button>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 15%, transparent)' }}
              >
                <ArrowRightLeft size={20} color="var(--accent)" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{ru.leader.transfer.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  Передать роль другому участнику группы.
                </p>
              </div>
            </div>
            <Button fullWidth variant="secondary">{ru.leader.transfer.title}</Button>
          </Card>
        </StaggerItem>

        <StaggerItem>
          <Card>
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: 'color-mix(in srgb, var(--danger) 15%, transparent)' }}
              >
                <Trash2 size={20} color="var(--danger)" />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--danger)' }}>{ru.group.delete.confirm}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{ru.group.delete.warn}</p>
              </div>
            </div>
            <Button fullWidth variant="danger">{ru.group.delete.confirm}</Button>
          </Card>
        </StaggerItem>
      </StaggerGroup>
    </div>
  );
}
