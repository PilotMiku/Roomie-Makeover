import { useEffect, useRef, useState } from 'react';
import { findEvent } from '../data/events';
import {
  costText,
  deltaText,
  eventNarrative,
  renderActivityLog,
} from '../domain/activityText';
import { canInteract } from '../domain/interactions';
import {
  eventChoiceError,
  eventConditionText,
  type PendingEvent,
} from '../domain/events';
import type { GameState } from '../domain/model';
import { useGame } from '../state/game';
import { EffectPreview } from './EffectPreview';

function EventDialog({
  game,
  pending,
  onClose,
  onResolved,
}: {
  game: GameState;
  pending: PendingEvent;
  onClose: () => void;
  onResolved: (id: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const choose = useGame((state) => state.chooseEvent);
  const event = findEvent(pending.eventId)!;
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current!;
    element.showModal();
    return () => {
      element.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="event-dialog"
      aria-labelledby="event-dialog-title"
      onCancel={(cancel) => {
        cancel.preventDefault();
        if (!busy) onClose();
      }}
    >
      <p className="eyebrow">A ROOMFUL OF STORIES</p>
      <h2 id="event-dialog-title">{event.title}</h2>
      {game.rooms.length > 1 && (
        <p className="quiet-note">
          来自「{game.rooms.find((room) => room.id === pending.roomId)?.name}」
          · 参与室友：
          {pending.characterIds
            .map(
              (id) =>
                game.characters.find((character) => character.id === id)
                  ?.name ?? '已离开的室友',
            )
            .join('、')}
          。搬家后仍按这次故事原本的参与者结算。
        </p>
      )}
      <p>{eventNarrative(game, event.id, pending.characterIds[0]!)}</p>
      <p className="quiet-note">
        第 {pending.day} 天遇见 · {eventConditionText(event.condition)}
      </p>
      <p className="quiet-note">
        选择后按当前第 {game.day}{' '}
        天的额度结算。属性消耗由每位参与室友承担，心意点只支付一次。关闭可稍后处理。
      </p>
      <div className="event-choices">
        {event.outcomes.map((outcome) => {
          const reason = eventChoiceError(game, pending, outcome);
          return (
            <div className="event-choice" key={outcome.id}>
              <EffectPreview
                game={game}
                request={{
                  characterIds: pending.characterIds,
                  changes: outcome.delta,
                  cost: outcome.cost,
                  tokenChange: outcome.tokens - (outcome.cost?.tokens ?? 0),
                  roomChange: {
                    roomId: pending.roomId,
                    delta: outcome.habitability ?? 0,
                  },
                }}
                unavailable={Boolean(reason)}
              />
              <button
                className="button"
                disabled={busy || Boolean(reason)}
                onClick={async () => {
                  setBusy(true);
                  setError('');
                  const result = await choose({
                    instanceId: pending.id,
                    choiceId: outcome.id,
                  });
                  if (result.error) {
                    setError(result.error);
                    setBusy(false);
                  } else onResolved(`result:${pending.id}`);
                }}
              >
                选择：{outcome.label}
              </button>
              <p>{outcome.text}</p>
              <p>
                预期变化：
                {deltaText(game, pending.characterIds[0]!, outcome.delta)}
                （专业与边界前）
              </p>
              <small>
                消耗：{costText(outcome.cost)} · 心意点奖励 {outcome.tokens}
                {outcome.habitability
                  ? ' · 宜居度 ' +
                    (outcome.habitability > 0 ? '+' : '') +
                    outcome.habitability +
                    '（按边界结算）'
                  : ''}
              </small>
              {reason && <p className="activity-limit">{reason}</p>}
            </div>
          );
        })}
      </div>
      {error && <p role="alert">{error}</p>}
      <button className="button" disabled={busy} onClick={onClose}>
        稍后再说（不结算）
      </button>
    </dialog>
  );
}

export function EventQueue({
  game,
  blocked,
}: {
  game: GameState;
  blocked: boolean;
}) {
  const [openId, setOpenId] = useState('');
  const [resolvedId, setResolvedId] = useState('');
  const pending = game.pendingEvents.find((item) => item.id === openId);
  const result = game.logs.find(
    (log) => log.id === resolvedId && log.type === 'event',
  );
  return (
    <section className="panel event-panel" aria-labelledby="events-title">
      <div className="activity-title">
        <div>
          <p className="eyebrow">LITTLE SURPRISES</p>
          <h2 id="events-title">待选择的小故事</h2>
        </div>
        <span className="token-badge">{game.pendingEvents.length} / 3</span>
      </div>
      {game.pendingEvents.length === 0 ? (
        <div className="event-empty">
          <span aria-hidden="true">✉ ♡</span>
          <p>平静的日常，也很可爱。</p>
          <p className="quiet-note">
            第 2
            天起，结算时可能遇见新故事。无分支事件直接记入手记；需要选择的故事会留在这里。
          </p>
        </div>
      ) : (
        <ul className="pending-events">
          {game.pendingEvents.map((item) => (
            <li key={item.id}>
              <span>
                DAY {item.day} ·{' '}
                {game.rooms.find((room) => room.id === item.roomId)?.name} ·{' '}
                {item.characterIds.length} 位室友
              </span>
              <button
                className="button"
                disabled={blocked}
                onClick={() => setOpenId(item.id)}
              >
                查看「{findEvent(item.eventId)!.title}」
                {game.rooms.length > 1
                  ? ` · ${game.rooms.find((room) => room.id === item.roomId)?.name}`
                  : ''}
              </button>
            </li>
          ))}
        </ul>
      )}
      {game.pendingEvents.length === 3 && (
        <p className="activity-limit">
          待选队列已满，暂停生成新的分支故事。请先处理已有故事。
        </p>
      )}
      {!canInteract(game) && (
        <p className="quiet-note">旁观者可查看故事；切换身份后可作出选择。</p>
      )}
      <p className="quiet-note">
        每寝室每天至多 1
        个主要事件。故事受专业、设施、身份和成长条件影响，同一寝室的同一故事不重复；自动补天不会代选。
      </p>
      <div aria-live="polite">
        {result?.type === 'event' && (
          <p className="activity-receipt">{renderActivityLog(game, result)}</p>
        )}
      </div>
      {pending && !blocked && (
        <EventDialog
          key={pending.id}
          game={game}
          pending={pending}
          onClose={() => setOpenId('')}
          onResolved={(id) => {
            setResolvedId(id);
            setOpenId('');
          }}
        />
      )}
    </section>
  );
}
