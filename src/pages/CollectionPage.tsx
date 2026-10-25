import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ACHIEVEMENTS } from '../data/achievements';
import { CLOTHES } from '../data/clothes';
import { CAMPUS_EVENTS } from '../data/events';
import { GAME } from '../data/constants';
import { MAJORS } from '../data/rules';
import { CharacterPreview } from '../components/CharacterPreview';
import { SaveNotice } from '../components/SaveNotice';
import { isComplete } from '../domain/completion';
import { unlockDescription } from '../domain/unlocks';
import { useGame } from '../state/game';

type Tab = 'achievements' | 'characters' | 'clothes' | 'events';
export function CollectionPage() {
  const { game, status, dirty, newRun, revision } = useGame();
  const [tab, setTab] = useState<Tab>('achievements');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const completed = game.characters.filter(isComplete);
  const look = game.characters[0] ?? game.legacy.portraits[0];
  const begin = async () => {
    if (
      !window.confirm(
        '开启新周目？当前槽的室友、寝室、天数、衣柜搭配和待选故事将重置；累计周目数、成就与图鉴保留。其他存档槽不受影响。建议先导出 JSON 备份。',
      )
    )
      return;
    setBusy(true);
    const result = await newRun({
      confirmed: true,
      expectedDay: game.day,
      expectedRuns: game.legacy.runs,
      expectedRevision: revision,
    });
    setBusy(false);
    setError(result.error ?? '');
    if (!result.error) navigate('/customize');
  };
  const includes = (value: string) =>
    value.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  return (
    <section className="collection-page">
      <p className="eyebrow">EVERY DAY IS A KEEPSAKE</p>
      <h1 tabIndex={-1}>星光纪念册</h1>
      <p className="page-lead">
        第 {game.legacy.runs + 1} 周目 · 把相遇、穿搭与日常，装进这本粉色小册。
      </p>
      <SaveNotice />
      <section className="panel new-run-panel" aria-labelledby="new-run-title">
        <h2 id="new-run-title">
          {completed.length
            ? '闪闪发光的这一页，完成啦 ♡'
            : '一起，慢慢变得闪闪发光'}
        </h2>
        <p>
          {completed.length
            ? `${completed.map((character) => character.name).join('、')}已完成阶段养成。可以继续今天的故事，也可以打开新的一页。`
            : '任一室友男娘进度达到 100，并完成至少 30 次日结算，即可开启新周目。'}
        </p>
        <div className="form-actions">
          <Link
            className="button"
            to={game.setup === 'done' ? '/room' : '/customize'}
          >
            继续当前故事 ♡
          </Link>
          <button
            className="button button-primary"
            disabled={!completed.length || status !== 'ready' || dirty || busy}
            onClick={() => void begin()}
          >
            开启新周目
          </button>
          <Link className="button" to="/saves">
            先备份回忆
          </Link>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
      </section>
      <div className="collection-tabs" role="group" aria-label="纪念册分类">
        {(
          [
            ['achievements', '✨ 成就'],
            ['characters', '♡ 角色图鉴'],
            ['clothes', '🎀 服装图鉴'],
            ['events', '💌 事件图鉴'],
          ] as const
        ).map(([value, label]) => (
          <button
            className="button"
            aria-pressed={tab === value}
            key={value}
            onClick={() => {
              setTab(value);
              setQuery('');
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <label className="collection-search">
        搜索当前图鉴
        <input
          value={query}
          maxLength={40}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="输入名字或关键词"
        />
      </label>
      {tab === 'achievements' && (
        <div className="collection-grid" aria-label="成就列表">
          {ACHIEVEMENTS.filter((item) =>
            includes(item.name + item.description),
          ).map((item) => (
            <article
              className={`panel collection-card ${game.legacy.achievements.includes(item.id) ? 'collected' : ''}`}
              key={item.id}
            >
              <span aria-hidden="true">{item.icon}</span>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <strong>
                {game.legacy.achievements.includes(item.id)
                  ? '✓ 已达成'
                  : '尚未达成'}
              </strong>
            </article>
          ))}
        </div>
      )}
      {tab === 'characters' && (
        <>
          <p className="quiet-note">
            已收录 {game.legacy.portraits.length} / {GAME.maxPortraits}{' '}
            位室友，保存最近一次相遇的造型。
            {game.legacy.portraits.length >= GAME.maxPortraits
              ? '纪念册已满，新室友暂不收录，已收录回忆会保留。'
              : ''}
          </p>
          <div className="collection-grid" aria-label="角色图鉴">
            {game.legacy.portraits
              .filter((portrait) =>
                includes(portrait.name + MAJORS[portrait.major].label),
              )
              .map((portrait) => (
                <article
                  className="panel collection-card collected"
                  key={portrait.id}
                >
                  <CharacterPreview character={portrait} />
                  <h2>{portrait.name}</h2>
                  <p>{MAJORS[portrait.major].label}</p>
                  <strong>✓ 已相遇</strong>
                </article>
              ))}
          </div>
          {!game.legacy.portraits.length && (
            <p>完成入住后，会在这里收录你的室友。</p>
          )}
        </>
      )}
      {tab === 'clothes' && (
        <div className="collection-grid" aria-label="服装图鉴">
          {CLOTHES.filter((item) => includes(item.name + item.description)).map(
            (item) => {
              const known = game.legacy.encyclopedia.includes(
                `clothing:${item.id}`,
              );
              return (
                <article
                  className={`panel collection-card ${known ? 'collected' : ''}`}
                  key={item.id}
                >
                  {look ? (
                    <CharacterPreview
                      character={{
                        ...look,
                        name: item.name,
                        outfit: { ...look.outfit, [item.slot]: item.id },
                      }}
                      focusSlot={item.slot}
                    />
                  ) : (
                    <span aria-hidden="true">🎀</span>
                  )}
                  <h2>{item.name}</h2>
                  <p>{item.description}</p>
                  <strong>{known ? '✓ 曾经收藏' : '尚未发现'}</strong>
                  <p className="quiet-note">{unlockDescription(item.unlock)}</p>
                </article>
              );
            },
          )}
        </div>
      )}
      {tab === 'events' && (
        <div className="collection-grid" aria-label="事件图鉴">
          {CAMPUS_EVENTS.filter((item) => includes(item.title)).map((item) => {
            const known = game.legacy.encyclopedia.includes(`event:${item.id}`);
            return (
              <article
                className={`panel collection-card ${known ? 'collected' : ''}`}
                key={item.id}
              >
                <span aria-hidden="true">💌</span>
                <h2>{item.title}</h2>
                <strong>{known ? '✓ 已经历' : '等待相遇'}</strong>
                <p>
                  {known
                    ? item.text
                    : `第 ${item.condition.minDay} 天起，满足条件时有机会遇见。`}
                </p>
                <small>{item.branch ? '有选择的故事' : '寝室小日常'}</small>
              </article>
            );
          })}
        </div>
      )}
      {query && (
        <p className="quiet-note">
          只显示与“{query}”匹配的条目；清空搜索可查看全部。
        </p>
      )}
    </section>
  );
}
