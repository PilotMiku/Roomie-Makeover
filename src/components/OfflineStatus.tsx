import { useEffect, useState } from 'react';
import { usePwa } from '../state/pwa';
import { useGame } from '../state/game';

export function OfflineStatus() {
  const { status, waiting, registration } = usePwa();
  const [online, setOnline] = useState(navigator.onLine);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    window.addEventListener('online', change);
    window.addEventListener('offline', change);
    return () => {
      window.removeEventListener('online', change);
      window.removeEventListener('offline', change);
    };
  }, []);
  const update = async () => {
    setBusy(true);
    setError('');
    const state = useGame.getState();
    if (state.status !== 'ready' || state.dirty) {
      setError('请先处理存档提示并可靠保存，再更新应用。');
      setBusy(false);
      return;
    }
    const result = state.empty ? {} : await state.retrySave();
    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }
    if (!registration?.waiting) {
      setError('新版本尚未就绪，请稍后重试。');
      setBusy(false);
      return;
    }
    const reload = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', reload, {
      once: true,
    });
    try {
      registration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
    } catch {
      navigator.serviceWorker.removeEventListener('controllerchange', reload);
      setError('更新暂未完成，当前故事已保存，请稍后重试。');
      setBusy(false);
    }
  };
  return (
    <aside
      className="offline-status"
      aria-label="离线与更新"
      aria-live="polite"
    >
      <span>
        {status === 'development'
          ? '开发预览 · 离线功能在生产版本启用'
          : status === 'ready'
            ? online
              ? '✓ 已准备好离线使用'
              : '♡ 离线游玩中 · 进度保存在此浏览器'
            : status === 'installing'
              ? '正在准备离线小屋…'
              : status === 'unsupported'
                ? '此环境可在线游玩，暂不支持离线安装'
                : '离线准备未完成，联网刷新后可重试'}
      </span>
      {waiting && (
        <button
          className="button"
          disabled={busy}
          onClick={() => void update()}
        >
          保存并更新应用
        </button>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </aside>
  );
}
