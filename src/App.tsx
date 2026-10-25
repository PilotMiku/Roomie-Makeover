import { lazy, Suspense, useEffect } from 'react';
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { APP_NAME, PROJECT_NAME } from './data/constants';
import { HomePage } from './pages/HomePage';
import { RoadmapPage } from './pages/RoadmapPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { usePreferences } from './state/preferences';
import { RoomPage } from './pages/RoomPage';
import { useGameClock } from './state/useGameClock';
import { useGame } from './state/game';
import { ProgressNotice } from './components/ProgressNotice';
import { OfflineStatus } from './components/OfflineStatus';
import { useSoundEffects } from './state/useSoundEffects';
const CustomizePage = lazy(async () => ({
  default: (await import('./pages/CustomizePage')).CustomizePage,
}));
const WardrobePage = lazy(async () => ({
  default: (await import('./pages/WardrobePage')).WardrobePage,
}));
const SavesPage = lazy(async () => ({
  default: (await import('./pages/SavesPage')).SavesPage,
}));
const CollectionPage = lazy(async () => ({
  default: (await import('./pages/CollectionPage')).CollectionPage,
}));

const pageNames: Record<string, string> = {
  '/home': '小屋首页',
  '/roadmap': '入住计划',
  '/settings': '偏好设置',
  '/room': '晴窗小屋',
  '/customize': '自定义工坊',
  '/wardrobe': '换装衣柜',
  '/saves': '回忆存档',
  '/collection': '星光纪念册',
};

export function App() {
  useGameClock();
  useSoundEffects();
  const { pathname } = useLocation();
  const preferences = usePreferences((state) => state.preferences);
  const generation = useGame((state) => state.generation);
  const activeSlot = useGame((state) => state.activeSlot);
  const workspaceKey = `${activeSlot}:${generation}`;
  useEffect(() => {
    document.title = `${pageNames[pathname] ?? '房间未找到'} · ${APP_NAME} · ${PROJECT_NAME}`;
    const focus = () => {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (!heading || heading.closest('[hidden], [style*="display: none"]'))
        return false;
      heading.focus();
      return true;
    };
    if (focus()) return;
    const observer = new MutationObserver(() => {
      if (focus()) observer.disconnect();
    });
    const main = document.querySelector('main');
    if (main)
      observer.observe(main, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style'],
      });
    return () => observer.disconnect();
  }, [pathname, workspaceKey]);

  return (
    <div
      className="app-shell"
      data-reduce-motion={preferences.reduceMotion}
      data-high-contrast={preferences.highContrast}
    >
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        跳到主要内容
      </a>
      <header className="site-header">
        <NavLink to="/home" className="brand" aria-label={`${APP_NAME}首页`}>
          <span className="brand-icon" aria-hidden="true">
            ♡
          </span>
          <span>
            {APP_NAME}
            <small>{PROJECT_NAME}</small>
          </span>
        </NavLink>
        <nav aria-label="主导航">
          <NavLink to="/home">
            <span aria-hidden="true">⌂</span> 小屋首页
          </NavLink>
          <NavLink to="/room">我的寝室</NavLink>
          <NavLink to="/customize">🎀 自定义工坊</NavLink>
          <NavLink to="/wardrobe">♡ 换装衣柜</NavLink>
          <NavLink to="/saves">✉ 回忆存档</NavLink>
          <NavLink to="/collection">✨ 星光纪念册</NavLink>
          <NavLink to="/roadmap">
            <span aria-hidden="true">☷</span> 入住计划
          </NavLink>
          <NavLink to="/settings">
            <span aria-hidden="true">⚙</span> 偏好设置
          </NavLink>
        </nav>
        <span className="version-tag">
          <span aria-hidden="true">♡</span> M7 · 每一天，都值得收藏
        </span>
      </header>
      <OfflineStatus />
      <main
        id="main-content"
        tabIndex={-1}
        className="main-content w-full min-w-0"
      >
        <ProgressNotice />
        <Suspense fallback={<p role="status">正在打开小屋…</p>}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/room" element={<RoomPage key={workspaceKey} />} />
            <Route
              path="/customize"
              element={<CustomizePage key={workspaceKey} />}
            />
            <Route
              path="/wardrobe"
              element={<WardrobePage key={workspaceKey} />}
            />
            <Route path="/saves" element={<SavesPage />} />
            <Route
              path="/collection"
              element={<CollectionPage key={workspaceKey} />}
            />
            <Route path="/roadmap" element={<RoadmapPage />} />
            <Route
              path="/settings"
              element={<SettingsPage key={workspaceKey} />}
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      <footer className="site-footer">
        <p>
          <span aria-hidden="true">♡</span> 把可爱写进每一天。
        </p>
        <p>本地数据 · 无遥测 · MIT 开源</p>
      </footer>
    </div>
  );
}
