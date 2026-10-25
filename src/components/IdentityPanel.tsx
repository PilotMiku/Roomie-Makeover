import { useState } from 'react';
import { IDENTITY_ACTIONS } from '../data/identityActions';
import { identityLabel } from '../domain/presentation';
import { identityActionError } from '../domain/identityActions';
import { costText } from '../domain/activityText';
import { renderLog } from '../domain/rules';
import type { GameState, Room } from '../domain/model';
import { useGame } from '../state/game';
import { onLeave } from '../domain/conditions';
import { EffectPreview } from './EffectPreview';

export function IdentityPanel({
  game,
  room,
  blocked,
}: {
  game: GameState;
  room: Room;
  blocked: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const perform = useGame((state) => state.identityAction);
  const actions = IDENTITY_ACTIONS.filter((action) =>
    action.identities.includes(game.player.identity),
  );
  const participants = game.characters.filter(
    (character) =>
      character.roomId === room.id && !onLeave(character, game.day),
  );
  const receipt = [...game.logs]
    .reverse()
    .find((log) => log.type === 'identity' && log.roomId === room.id);
  return (
    <section className="panel identity-panel" aria-label="身份专属行动">
      <p className="eyebrow">YOUR ROLE, YOUR LITTLE STORY</p>
      <h2>{identityLabel(game)}的寝室日常</h2>
      <p>
        宜居度 {room.habitability} / 100 · 每间寝室每天可发起 1
        次身份行动，切换身份也保留当天次数。
        请假休养的室友不参加集体行动，也不支付成本。
      </p>
      <div className="identity-action-grid">
        {actions.map((action) => {
          const reason = identityActionError(game, room.id, action.id);
          return (
            <article key={action.id}>
              <h3>{action.name}</h3>
              <p>{action.text}</p>
              <p>
                每位参与室友消耗：
                {costText({
                  energy: action.cost.energy,
                  stamina: action.cost.stamina,
                })}
                ；全寝室心意点 {action.cost.tokens ?? 0}
              </p>
              <EffectPreview
                game={game}
                request={{
                  characterIds: participants.map((character) => character.id),
                  changes: action.delta,
                  cost: action.cost,
                  roomChange: { roomId: room.id, delta: action.habitability },
                }}
                unavailable={blocked || Boolean(reason)}
              />
              <button
                className="button button-primary"
                disabled={blocked || busy || Boolean(reason)}
                onClick={() => {
                  setBusy(true);
                  setError('');
                  void perform({
                    operationId: crypto.randomUUID(),
                    expectedDay: game.day,
                    identity: game.player.identity,
                    roomId: room.id,
                    actionId: action.id,
                  }).then((result) => {
                    setBusy(false);
                    setError(result.error ?? '');
                  });
                }}
              >
                {action.name}
              </button>
              {reason && <p className="quiet-note">{reason}</p>}
            </article>
          );
        })}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {receipt && (
        <details className="identity-receipt">
          <summary>上次身份行动 · 第 {receipt.day} 天</summary>
          <p>{renderLog(game, receipt)}</p>
        </details>
      )}
      <p className="quiet-note">
        宜居度达到 80 时，每日自然心情与体力各额外 +1；低于 30 时自然心情
        -1。所有互动共享当天男娘进度 +3 额度。
      </p>
    </section>
  );
}
