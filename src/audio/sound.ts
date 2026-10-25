import { create } from 'zustand';

let chime: HTMLAudioElement | undefined;
export const useSound = create<{ error: string }>(() => ({ error: '' }));
export function stopSound() {
  if (chime) {
    chime.pause();
    chime.currentTime = 0;
  }
}
export async function playChime() {
  try {
    chime ??= new Audio(`${import.meta.env.BASE_URL}sounds/chime.wav`);
    chime.volume = 0.35;
    chime.currentTime = 0;
    await chime.play();
    useSound.setState({ error: '' });
  } catch {
    useSound.setState({
      error: '音效暂未播放，请点“试听音效”允许浏览器播放。',
    });
  }
}
