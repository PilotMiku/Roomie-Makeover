import { ACHIEVEMENTS } from '../data/achievements';
import { useGame } from '../state/game';
import { Link } from 'react-router-dom';

export function ProgressNotice() {
  const earned = useGame((state) => state.achievementsEarned);
  const dismiss = useGame((state) => state.dismissAchievements);
  if (!earned.length) return null;
  return (
    <aside className="progress-notice" aria-label="新成就" aria-live="polite">
      <span>
        ✨ 成就解锁：
        {earned
          .map((id) => ACHIEVEMENTS.find((item) => item.id === id)?.name ?? id)
          .join('、')}
      </span>
      <Link className="button" to="/collection">
        查看纪念册
      </Link>
      <button type="button" className="button" onClick={dismiss}>
        收好这份开心
      </button>
    </aside>
  );
}
