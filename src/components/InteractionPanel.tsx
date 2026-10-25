import { useState } from 'react';
import {
  GIFTS,
  INTERACTIONS,
  type GiftId,
  type InteractionId,
} from '../data/interactions';
import type { Character, GameState } from '../domain/model';
import { interactionOffer } from '../domain/interactions';
import { costText, renderActivityLog } from '../domain/activityText';
import { EffectPreview } from './EffectPreview';
import { roleplayEnabled } from '../domain/presentation';
import { useGame } from '../state/game';
import { ACTIVITY } from '../data/constants';
import { onLeave } from '../domain/conditions';

export function InteractionPanel({
  game,
  character,
  blocked,
}: {
  game: GameState;
  character: Character;
  blocked: boolean;
}) {
  const [giftId, setGiftId] = useState<GiftId>('bookmark');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receiptId, setReceiptId] = useState('');
  const interact = useGame((state) => state.interact);
  const giftOffer = interactionOffer(game, character, 'gift', giftId);
  const receipt = game.logs.find(
    (log) => log.id === receiptId && log.type === 'interaction',
  );
  const autoReceipt = [...game.logs]
    .reverse()
    .find(
      (log) =>
        log.type === 'interaction' &&
        log.characterId === character.id &&
        log.day === game.lastSettledDay &&
        log.id.startsWith(ACTIVITY.autoInteractionPrefix),
    );
  const perform = async (
    kind: 'normal' | 'gift',
    id: InteractionId | GiftId,
  ) => {
    setBusy(true);
    setError('');
    const operationId = crypto.randomUUID();
    const result = await interact({
      operationId,
      expectedDay: game.day,
      characterId: character.id,
      kind,
      ...(kind === 'normal'
        ? { actionId: id as InteractionId }
        : { giftId: id as GiftId }),
    });
    if (result.error) setError(result.error);
    else setReceiptId(operationId);
    setBusy(false);
  };
  const renderAction = (action: (typeof INTERACTIONS)[number]) => {
    const offer = interactionOffer(game, character, 'normal', action.id);
    return (
      <div
        className="interaction-card"
        key={action.id}
        role="group"
        aria-label={offer.name}
      >
        <EffectPreview
          game={game}
          request={{
            characterIds: [character.id],
            changes: action.delta,
            cost: action.cost,
          }}
          unavailable={blocked || Boolean(offer.error)}
        />
        <button
          className="button"
          disabled={blocked || busy || Boolean(offer.error)}
          onClick={() => void perform('normal', action.id)}
        >
          {offer.name}
        </button>
        <small>消耗：1 次普通互动 · {costText(action.cost)}</small>
        {offer.error && <small className="activity-limit">{offer.error}</small>}
      </div>
    );
  };
  return (
    <section
      className="panel interaction-panel"
      aria-labelledby="interaction-title"
    >
      <div className="activity-title">
        <div>
          <p className="eyebrow">A LITTLE CLOSER</p>
          <h2 id="interaction-title">和{character.name}的日常</h2>
        </div>
        <span className="token-badge">♡ 心意点 {game.wallet.tokens}</span>
      </div>
      <p className="quiet-note">
        第 {game.day} 天 · 普通互动 {character.daily.interactions} / 3 · 送礼{' '}
        {character.daily.gifts} / 1
      </p>
      <p className="quiet-note">
        {onLeave(character, game.day)
          ? '正在请假休养，今天不安排互动或自动日常。'
          : character.daily.interactions > 0 ||
              character.daily.gifts > 0 ||
              character.daily.identityParticipated
            ? '今天已安排互动，日结算时将沿用你的安排。'
            : '今天尚未安排互动，日结算时室友会随机进行一次力所能及的日常互动。'}
      </p>
      <div className="interaction-actions">
        {INTERACTIONS.filter(
          (action) =>
            !action.recovery &&
            (!action.consentRequired || roleplayEnabled(game, character)),
        ).map(renderAction)}
      </div>
      <section className="recovery-actions" aria-label="主动恢复">
        <h3>先照顾好自己 ♡</h3>
        <p className="quiet-note">
          午睡、加餐、散步和安慰都计入每天 3
          次普通互动。午睡不额外收费，其余操作按卡片支付资源；请假期间按日自动恢复。
        </p>
        <div className="interaction-actions">
          {INTERACTIONS.filter((action) => action.recovery).map(renderAction)}
        </div>
      </section>
      <form
        className="gift-form"
        onSubmit={(event) => {
          event.preventDefault();
          void perform('gift', giftId);
        }}
      >
        <label htmlFor="gift-choice">挑选一份小礼物</label>
        <select
          id="gift-choice"
          value={giftId}
          disabled={busy || blocked}
          onChange={(event) => setGiftId(event.target.value as GiftId)}
        >
          {GIFTS.map((gift) => (
            <option value={gift.id} key={gift.id}>
              {gift.name} · {costText(gift.cost)}
            </option>
          ))}
        </select>
        {giftOffer.definition && (
          <EffectPreview
            game={game}
            request={{
              characterIds: [character.id],
              changes: giftOffer.definition.delta,
              cost: giftOffer.definition.cost,
            }}
            unavailable={blocked || Boolean(giftOffer.error)}
          />
        )}
        <button
          className="button button-primary"
          disabled={blocked || busy || Boolean(giftOffer.error)}
        >
          送出礼物 ♡
        </button>
      </form>
      {giftOffer.error && <p className="activity-limit">{giftOffer.error}</p>}
      <p className="quiet-note">
        心意点初始 20，每次日结算补给 8；伸懒腰可恢复精力。全部来源共享当天进度
        +3 额度。
      </p>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div aria-live="polite">
        {autoReceipt?.type === 'interaction' && (
          <p className="activity-auto-receipt">
            第 {autoReceipt.day} 天 · {renderActivityLog(game, autoReceipt)}
          </p>
        )}
        {receipt?.type === 'interaction' && (
          <p className="activity-receipt">{renderActivityLog(game, receipt)}</p>
        )}
      </div>
    </section>
  );
}
