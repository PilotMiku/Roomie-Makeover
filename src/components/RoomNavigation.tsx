import { GAME } from '../data/constants';
import type { GameState } from '../domain/model';

export function RoomNavigation({
  game,
  roomId,
  onChoose,
}: {
  game: GameState;
  roomId: string;
  onChoose: (id: string) => void;
}) {
  return (
    <section className="panel room-navigation" aria-label="寝室导航">
      <div className="activity-title">
        <div>
          <p className="eyebrow">NEXT DOOR, MORE STORIES</p>
          <h2>这一层，都有可爱日常</h2>
        </div>
        <span className="token-badge">
          {game.rooms.length} / {GAME.maxRooms} 间寝室 ·{' '}
          {game.characters.length} / {GAME.maxCharacters} 位室友
        </span>
      </div>
      <div className="room-tabs">
        {game.rooms.map((room) => (
          <button
            className="button"
            key={room.id}
            aria-pressed={room.id === roomId}
            onClick={() => onChoose(room.id)}
          >
            <strong>{room.name}</strong>
            <span>
              {
                game.characters.filter(
                  (resident) => resident.roomId === room.id,
                ).length
              }{' '}
              / {room.capacity} 人 ·{' '}
              {room.bedType === 'bunk' ? '双层床' : '上床下桌'}
            </span>
          </button>
        ))}
      </div>
      <p className="quiet-note">
        切换寝室只改变视角；进入下一天会统一结算本存档全部寝室。
      </p>
    </section>
  );
}
