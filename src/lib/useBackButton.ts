import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getTelegramWebApp, haptic } from './telegram';

const authRoutes = ['/', '/create-group', '/join', '/pending'];
const tabRoutes = ['/today', '/schedule', '/journal', '/announcements', '/profile', '/more'];

export function useBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const tg = getTelegramWebApp();
    if (!tg?.BackButton) return;

    const isAuth = authRoutes.includes(location.pathname);
    const isTab = tabRoutes.includes(location.pathname);

    if (isAuth && location.pathname === '/') {
      tg.BackButton.hide();
    } else if (isTab) {
      tg.BackButton.hide();
    } else {
      tg.BackButton.show();
    }

    const handleBack = () => {
      haptic('light');
      if (isTab) {
        navigate('/more');
      } else if (location.pathname === '/more') {
        navigate('/today');
      } else {
        navigate(-1);
      }
    };

    tg.BackButton.onClick(handleBack);

    return () => {
      tg.BackButton.offClick(handleBack);
    };
  }, [location.pathname, navigate]);
}
