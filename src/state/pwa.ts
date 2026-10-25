import { create } from 'zustand';

export const usePwa = create<{
  status: 'development' | 'installing' | 'ready' | 'unsupported' | 'error';
  registration: ServiceWorkerRegistration | null;
  waiting: boolean;
}>(() => ({
  status: import.meta.env.PROD ? 'installing' : 'development',
  registration: null,
  waiting: false,
}));

export async function registerOffline() {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    usePwa.setState({ status: 'unsupported' });
    return;
  }
  try {
    const registration = await navigator.serviceWorker.register(
      `${import.meta.env.BASE_URL}sw.js`,
      { scope: import.meta.env.BASE_URL, updateViaCache: 'none' },
    );
    const check = () =>
      usePwa.setState({ waiting: Boolean(registration.waiting) });
    usePwa.setState({ registration });
    check();
    const watch = () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => {
        check();
        if (worker.state === 'redundant' && !registration.active)
          usePwa.setState({ status: 'error' });
      });
    };
    watch();
    registration.addEventListener('updatefound', watch);
    await navigator.serviceWorker.ready;
    usePwa.setState({ status: 'ready' });
    check();
  } catch {
    usePwa.setState({ status: 'error' });
  }
}
