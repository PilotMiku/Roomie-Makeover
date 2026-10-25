import { GAME } from '../data/constants';
import { deltaText } from '../domain/activityText';
import type { GameState } from '../domain/model';
import { previewEffects, type EffectRequest } from '../domain/preview';
import { statLabel } from '../domain/presentation';

export function EffectPreview({
  game,
  request,
  unavailable = false,
}: {
  game: GameState;
  request: EffectRequest;
  unavailable?: boolean;
}) {
  if (unavailable) return null;
  const preview = previewEffects(game, request);
  const risky = preview.residents.filter((row) => row.incidents.length);
  const changes = preview.residents.map((row) => (
    <p key={row.characterId}>
      {row.name} · 结算后净变化：{deltaText(game, row.characterId, row.delta)}
    </p>
  ));
  return (
    <div className="effect-preview" aria-label="操作后果预览">
      {risky.length > 0 && (
        <div className="effect-warning" role="note">
          <strong>⚠ 本次操作会触发状态后果</strong>
          {risky.map((row) => (
            <div key={row.characterId}>
              {row.incidents.map((incident) => (
                <p key={incident.reason}>
                  {row.name}：
                  {incident.reason === 'stamina'
                    ? '体力将归零，请假 ' +
                      GAME.leaveDays +
                      ' 个游戏日，暂停成长与活动，第 ' +
                      incident.leaveUntilDay +
                      ' 天返寝。'
                    : incident.reason === 'mood'
                      ? '心情将归零，好感与男娘进度减半。预计好感 ' +
                        row.before.affection +
                        ' → ' +
                        row.after.affection +
                        '，男娘进度 ' +
                        row.before.progress +
                        ' → ' +
                        row.after.progress +
                        '。'
                      : '精力将归零，心情 -' +
                        GAME.exhaustionMoodLoss +
                        '、' +
                        statLabel(
                          game,
                          game.characters.find(
                            (character) => character.id === row.characterId,
                          ),
                          'rapport',
                        ) +
                        ' -' +
                        GAME.exhaustionRapportLoss +
                        '。'}
                </p>
              ))}
              {row.outfitStored && (
                <p>低于个人穿戴门槛的妆造将收起，衣柜收藏保留。</p>
              )}
            </div>
          ))}
        </div>
      )}
      {changes.length <= 1 ? (
        changes
      ) : (
        <details>
          <summary>查看 {changes.length} 位室友的预计数值</summary>
          {changes}
        </details>
      )}
      {request.cost?.tokens || request.tokenChange ? (
        <p>
          心意点 {game.wallet.tokens} → {preview.tokens}
        </p>
      ) : null}
      {preview.room && (
        <p>
          「{preview.room.name}」宜居度 {preview.room.before} →{' '}
          {preview.room.after}
        </p>
      )}
    </div>
  );
}
