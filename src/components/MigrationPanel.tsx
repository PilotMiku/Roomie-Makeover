import { useState } from 'react';
import type { Character, GameState } from '../domain/model';
import { bedLabel } from '../domain/rules';
import { useGame } from '../state/game';

export function MigrationPanel({
  game,
  character,
  blocked,
  onMoved,
}: {
  game: GameState;
  character: Character;
  blocked: boolean;
  onMoved: (roomId: string, characterId: string) => void;
}) {
  const rooms = game.rooms.filter((room) => room.id !== character.roomId);
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? '');
  const [bedId, setBedId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const target = rooms.find((room) => room.id === roomId);
  const beds =
    target?.beds.filter(
      (bed) => !game.characters.some((resident) => resident.bedId === bed.id),
    ) ?? [];
  const customize = useGame((state) => state.customize);
  if (!rooms.length) return null;
  return (
    <form
      className="migration-form move-form"
      aria-label="跨寝室搬家"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        const result = await customize({
          type: 'migrate',
          characterId: character.id,
          fromRoomId: character.roomId,
          fromBedId: character.bedId,
          roomId,
          bedId,
        });
        if (result.error) setError(result.error);
        else onMoved(roomId, character.id);
        setBusy(false);
      }}
    >
      <h3>带着成长，去隔壁住 ♡</h3>
      <label htmlFor="migration-room">{character.name}的目标寝室</label>
      <select
        id="migration-room"
        value={roomId}
        disabled={blocked || busy}
        onChange={(event) => {
          setRoomId(event.target.value);
          setBedId('');
          setError('');
        }}
      >
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name} ·{' '}
            {
              game.characters.filter((resident) => resident.roomId === room.id)
                .length
            }{' '}
            / {room.capacity} 人
          </option>
        ))}
      </select>
      <label htmlFor="migration-bed">目标空床</label>
      <select
        id="migration-bed"
        value={bedId}
        disabled={blocked || busy || !beds.length}
        onChange={(event) => setBedId(event.target.value)}
      >
        <option value="">
          {beds.length ? '选择目标空床' : '目标寝室已满'}
        </option>
        {beds.map((bed) => (
          <option key={bed.id} value={bed.id}>
            {bedLabel(game, bed.id)}
          </option>
        ))}
      </select>
      <button
        className="button"
        disabled={
          blocked || busy || !bedId || !beds.some((bed) => bed.id === bedId)
        }
      >
        确认搬家
      </button>
      <p className="quiet-note">
        只可搬到空床；六维、穿搭、当天次数与已触发的故事全部保留。
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
