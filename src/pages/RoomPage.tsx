import { SaveNotice } from '../components/SaveNotice';
import { InteractionPanel } from '../components/InteractionPanel';
import { EventQueue } from '../components/EventQueue';
import { RoomNavigation } from '../components/RoomNavigation';
import { ResidentBrowser } from '../components/ResidentBrowser';
import { MigrationPanel } from '../components/MigrationPanel';
import { IdentityPanel } from '../components/IdentityPanel';
import { leaveMessage } from '../domain/conditions';
import { useRoomView } from '../state/useRoomView';
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { GAME } from '../data/constants';
import { FACILITIES, MAJORS } from '../data/rules';
import { PixelAvatar } from '../components/PixelAvatar';
import { bedLabel, isComplete, renderLog, statKeys } from '../domain/rules';
import { isFastMode, useGame } from '../state/game';
import {
  canManage,
  identityLabel,
  majorLabel,
  statLabel,
} from '../domain/presentation';

export function RoomPage() {
  const { game, status, notice, next, move, layout } = useGame();
  const { room, params, chooseRoom } = useRoomView(game);
  const [targetId, setTargetId] = useState('');
  const [feedback, setFeedback] = useState('');
  const residents = game.characters.filter(
    (character) => character.roomId === room.id,
  );
  const selected =
    residents.find((character) => character.id === params.get('resident')) ??
    residents[0];
  const selectedId = selected?.id ?? '';
  const setSelectedId = (id: string) => {
    const resident = game.characters.find((character) => character.id === id);
    if (resident) {
      chooseRoom(resident.roomId, id);
      setTargetId('');
    }
  };
  const roomPath = `/customize?room=${encodeURIComponent(room.id)}`;
  const blocked = status === 'invalid' || status === 'conflict';
  const readOnlyResidents = blocked || !canManage(game, 'residents');
  const readOnlyRoom = blocked || !canManage(game, 'room');
  const fast = isFastMode();
  const interval = fast ? GAME.fastInterval : GAME.normalInterval;
  const remaining = Math.max(
    0,
    Math.ceil(
      (interval - (game.clock.lastObserved - game.clock.anchor)) / 60000,
    ),
  );
  const dayLogs = game.logs.filter((log) => log.type === 'day');
  const latest = dayLogs.at(-1);
  const latestResult = latest?.results.find(
    (result) => result.characterId === selectedId,
  );
  const performMove = (bedId: string, characterId = selectedId) => {
    if (!characterId || readOnlyResidents) return;
    move(characterId, bedId);
    setFeedback('床位操作已完成。可以继续选择其他室友。');
  };

  if (game.setup !== 'done' && !blocked)
    return <Navigate to="/customize" replace />;
  return (
    <>
      <section className="room-heading">
        <div>
          <p className="eyebrow">LITTLE ROOM · BIG EVERYDAY</p>
          <h1 tabIndex={-1}>晴窗里的第 {game.day} 天</h1>
          <p className="quiet-note">
            {residents.length} 位室友 · {identityLabel(game)}视角 ·
            自由表达，平等相处
          </p>
        </div>
        <button
          className="button button-primary"
          disabled={blocked || game.player.identity === 'observer'}
          onClick={() => next(game.day)}
        >
          进入下一天 <span aria-hidden="true">→</span>
        </button>
      </section>
      <RoomNavigation
        game={game}
        roomId={room.id}
        onChoose={(id) => {
          chooseRoom(id);
          setTargetId('');
          setFeedback('');
        }}
      />
      <ResidentBrowser
        game={game}
        selectedId={selectedId}
        onChoose={setSelectedId}
      />
      <div className="room-custom-links">
        <Link className="button" to={roomPath}>
          🎀 自定义寝室与室友
        </Link>
        <Link
          className="button"
          to={
            selected
              ? `/wardrobe?resident=${encodeURIComponent(selected.id)}`
              : '/wardrobe'
          }
        >
          ♡ 给室友换装
        </Link>
        <span>{identityLabel(game)} · 玩家身份不会自动占用床位</span>
      </div>
      <div className="clock-strip">
        <span>
          {fast ? '调试模式 · 每 1 分钟一天' : '自动计时 · 每 2 小时一天'} · 约{' '}
          {remaining} 分钟后结算
        </span>
        <span>
          {status === 'ready' ? '✓ 已保存到此浏览器' : '⚠ 存档需要处理'}
        </span>
      </div>
      <SaveNotice />
      <details className="panel condition-help">
        <summary>状态归零会发生什么？</summary>
        <p>
          体力 0：请假休养 7
          个游戏日，暂停互动、随机事件参与和男娘成长，每日恢复体力 12、精力
          10、心情 6。
        </p>
        <p>
          心情
          0：好感与男娘进度减半并向下取整；低于门槛的妆造收起，收藏保留。精力
          0：心情 -5、默契 -2。
        </p>
        <p>
          同一段归零状态只触发一次，恢复到正数后再次归零会重新触发。随机故事既有好运也有意外，分支的成本和正负变化会提前显示。
        </p>
      </details>
      <p className="progress-gates" aria-label="主线目标">
        🎀 主线目标：把室友的男娘进度培养到 100。男娘值与养成进度共用这一数值；
        50 解锁裙装与妆造，100 解锁女仆套装。 当前已有{' '}
        {
          game.characters.filter(
            (character) => character.stats.progress === 100,
          ).length
        }
        / {game.characters.length} 位室友达到 100。
      </p>
      {game.characters.some(isComplete) && (
        <aside className="panel completion-banner" aria-label="阶段养成完成">
          <strong>✨ 有室友完成阶段养成啦！</strong>
          <p>继续享受寝室日常，或带着成就与图鉴打开新的一页。</p>
          <Link className="button button-primary" to="/collection">
            查看阶段目标与新周目
          </Link>
        </aside>
      )}
      <p className="game-notice" role="status" aria-live="polite">
        {notice ||
          '先选一位室友，再点目标床位交换位置。桌面也可以拖动床上的室友。'}
        {feedback && <span className="selection-feedback">{feedback}</span>}
      </p>
      <div className="game-layout">
        <section className="panel room-map-panel" aria-labelledby="room-title">
          <div className="room-map-title">
            <div>
              <p className="eyebrow">
                ROOM {String(game.rooms.indexOf(room) + 1).padStart(2, '0')}
              </p>
              <h2 id="room-title">{room.name}</h2>
            </div>
            <span className="room-occupancy">
              {residents.length} / {room.capacity} 人
            </span>
          </div>
          <fieldset className="bed-type-control" disabled={readOnlyRoom}>
            <legend>床型（保留床位与室友）</legend>
            <button
              type="button"
              aria-pressed={room.bedType === 'loft'}
              onClick={() => layout(room.id, 'loft')}
            >
              上床下桌
            </button>
            <button
              type="button"
              aria-pressed={room.bedType === 'bunk'}
              onClick={() => layout(room.id, 'bunk')}
            >
              双层床
            </button>
          </fieldset>
          <div
            className={`dorm-grid ${room.bedType}`}
            aria-label="寝室床位地图"
          >
            <div className="map-window" aria-hidden="true">
              🎀 今日份可爱 · ♡
            </div>
            {room.beds.map((bed) => {
              const character = game.characters.find(
                (candidate) => candidate.bedId === bed.id,
              );
              return (
                <button
                  key={bed.id}
                  style={
                    room.bedType === 'bunk'
                      ? {
                          gridColumn: ((bed.unit - 1) % 2) + 1,
                          gridRow:
                            2 +
                            Math.floor((bed.unit - 1) / 2) * 2 +
                            (bed.level === 'lower' ? 1 : 0),
                        }
                      : undefined
                  }
                  className={`bed-tile ${character?.id === selectedId ? 'selected' : ''}`}
                  data-testid={`bed-${bed.id}`}
                  disabled={readOnlyResidents || (!selected && !character)}
                  aria-label={`${bedLabel(game, bed.id)}：${character?.name ?? '空床'}，将所选室友移至此处`}
                  draggable={Boolean(character) && !readOnlyResidents}
                  onDragStart={(event) => {
                    if (character) {
                      event.dataTransfer.setData('text/plain', character.id);
                      event.dataTransfer.effectAllowed = 'move';
                      setSelectedId(character.id);
                    }
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    performMove(
                      bed.id,
                      event.dataTransfer.getData('text/plain'),
                    );
                  }}
                  onClick={() => {
                    if (!selectedId && character) setSelectedId(character.id);
                    else performMove(bed.id);
                  }}
                >
                  <span className="bed-number">{bedLabel(game, bed.id)}</span>
                  {character ? (
                    <>
                      <PixelAvatar character={character} />
                      <strong>{character.name}</strong>
                      <span className="bed-caption">
                        {character.id === selectedId
                          ? '✓ 已选室友'
                          : '点选交换床位'}
                      </span>
                    </>
                  ) : (
                    <span className="empty-bed">空床 · 可入住</span>
                  )}
                  {bed.level === 'loft' && (
                    <span className="mini-desk" aria-hidden="true">
                      ▣ ━ ▱
                    </span>
                  )}
                </button>
              );
            })}
            <div className="map-door" aria-hidden="true">
              入口 ━━ 休息区 ━━ 绿植 ♧
            </div>
          </div>
          <p className="map-caption">
            {FACILITIES[room.facilities.bathroom].label} ·{' '}
            {room.bedType === 'loft'
              ? `${room.capacity} 套上床下桌，${room.capacity} 个实际床位`
              : `${room.capacity / 2} 套双层床，上下铺分别可选`}{' '}
            · 拖到地图外不会移动
          </p>
        </section>
        <aside
          className="panel resident-panel"
          aria-labelledby="resident-title"
        >
          <p className="eyebrow">YOUR ROOMMATES</p>
          <h2 id="resident-title">室友手记</h2>
          <div className="resident-picker" aria-label="选择室友">
            {residents.map((character) => (
              <button
                key={character.id}
                aria-pressed={selectedId === character.id}
                disabled={blocked}
                onClick={() => {
                  setSelectedId(character.id);
                  setFeedback(
                    `已选择${character.name}，请点选目标床位或使用下方分配操作。`,
                  );
                }}
              >
                {character.name}
              </button>
            ))}
          </div>
          {!selected && (
            <div className="empty-room-note">
              <h3>这间寝室还没有室友 ♡</h3>
              <p>空床已准备好，可以添加新的室友，或让隔壁的室友搬过来。</p>
              {!readOnlyResidents && (
                <Link className="button" to={`${roomPath}&tab=characters`}>
                  添加本寝室室友
                </Link>
              )}
            </div>
          )}
          {selected && (
            <>
              <div className="resident-profile">
                <PixelAvatar character={selected} />
                <div>
                  <h3>{selected.name}</h3>
                  <p>
                    {selected.address !== selected.name
                      ? `称呼：${selected.address} · `
                      : ''}
                    大学生 · {selected.pronouns} · {majorLabel(selected)}
                  </p>
                  <p>{selected.personality}</p>
                  <p className="resident-tags">
                    {selected.tags.length
                      ? selected.tags.join(' · ')
                      : '风格由自己决定'}
                  </p>
                </div>
              </div>
              <dl className="stats-grid">
                {statKeys.map((key) => (
                  <div key={key}>
                    <dt>{statLabel(game, selected, key)}</dt>
                    <dd>
                      {selected.stats[key]}
                      <span> / 100</span>
                    </dd>
                    <meter
                      min={0}
                      max={100}
                      value={selected.stats[key]}
                      aria-label={statLabel(game, selected, key)}
                    />
                  </div>
                ))}
              </dl>
              {leaveMessage(selected, game.day) && (
                <p className="permission-note" role="note">
                  {leaveMessage(selected, game.day)}
                </p>
              )}
              <p className="growth-note">
                已完成 {selected.settledDays} 次日结算 ·{' '}
                {isComplete(selected)
                  ? '阶段养成已完成'
                  : '目标：进度 100 + 30 次日结算'}
                <br />
                当天进度正向额度：{selected.daily.progressGained} / 3
              </p>
              <form
                className="move-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (targetId) performMove(targetId);
                }}
              >
                <label htmlFor="target-bed">为{selected.name}分配床位</label>
                <select
                  id="target-bed"
                  value={targetId}
                  disabled={readOnlyResidents}
                  onChange={(event) => setTargetId(event.target.value)}
                >
                  <option value="">选择目标床位</option>
                  {room.beds.map((bed) => (
                    <option key={bed.id} value={bed.id}>
                      {bedLabel(game, bed.id)}
                    </option>
                  ))}
                </select>
                <button
                  className="button"
                  disabled={!targetId || readOnlyResidents}
                >
                  分配 / 交换
                </button>
              </form>
              <MigrationPanel
                key={`${selected.id}:${selected.roomId}:${selected.bedId}`}
                game={game}
                character={selected}
                blocked={readOnlyResidents}
                onMoved={(id, residentId) => {
                  chooseRoom(id, residentId);
                  setTargetId('');
                  setFeedback(
                    useGame.getState().status === 'ready'
                      ? '搬家已保存，六维、穿搭与成长记录全部保留。'
                      : '搬家仅保留在内存中，请先处理存档提示。',
                  );
                }}
              />
            </>
          )}
        </aside>
      </div>
      <IdentityPanel game={game} room={room} blocked={blocked} />
      <div className="activity-layout">
        {selected && (
          <InteractionPanel
            key={selected.id}
            game={game}
            character={selected}
            blocked={blocked}
          />
        )}
        <EventQueue game={game} blocked={blocked} />
      </div>
      <section className="panel daily-panel" aria-labelledby="daily-title">
        <p className="eyebrow">A DAY WELL SPENT</p>
        <h2 id="daily-title">今天，也在慢慢成长</h2>
        {latestResult ? (
          <div className="settlement-summary">
            <h3>
              {selected?.name} · 第 {latest!.day} 天结算
            </h3>
            <p>
              {statKeys
                .map(
                  (key) =>
                    `${statLabel(game, selected, key)} ${latestResult.delta[key] >= 0 ? '+' : ''}${latestResult.delta[key]}`,
                )
                .join(' · ')}
            </p>
            <p>
              来源：校园日常基础 × {MAJORS[latestResult.major].label}
              专业倍率（0.8–1.3）→ {FACILITIES[latestResult.bathroom].label}
              设施加成 → 自然变化 ±15 限制 → 当日进度 +3 额度 → 0–100 边界。
            </p>
            <p className="quiet-note">
              干湿分离：
              {latestResult.dryWet === null
                ? '旧档未记录'
                : latestResult.dryWet
                  ? '有'
                  : '无'}{' '}
              · 本次心意点补给 +{latest!.allowance}
            </p>
            <table className="delta-table">
              <caption>第 {latest!.day} 天实际增减来源</caption>
              <thead>
                <tr>
                  <th>属性</th>
                  <th>自然</th>
                  <th>互动</th>
                  <th>事件</th>
                  <th>合计</th>
                </tr>
              </thead>
              <tbody>
                {statKeys.map((key) => {
                  const natural = latestResult.delta[key];
                  const interaction = latestResult.activity.interaction[key];
                  const event = latestResult.activity.event[key];
                  return (
                    <tr key={key}>
                      <th>{statLabel(game, selected, key)}</th>
                      {[
                        natural,
                        interaction,
                        event,
                        natural + interaction + event,
                      ].map((value, index) => (
                        <td key={index}>
                          {value > 0 ? '+' : ''}
                          {value}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="quiet-note">
            进入下一天后，这里会解释所选室友的实际数值变化。手动跳天保留现实时间计时进度。
          </p>
        )}
        <ol className="game-logs">
          {game.logs
            .slice(-12)
            .reverse()
            .map((log) => (
              <li key={log.id}>
                <span>DAY {log.day}</span>
                {renderLog(game, log)}
              </li>
            ))}
        </ol>
        <p className="quiet-note">
          日志最多保留 300 条，本页显示最近 12 条。自动补结算最多 7
          天，超出部分舍弃并保留时间零头。
        </p>
      </section>
      <p className="local-data-note">
        数据仅保存在此浏览器。清理数据或使用无痕模式可能丢失进度；请在
        <Link to="/saves">回忆存档</Link>定期导出 JSON 备份。阶段目标与图鉴收在
        <Link to="/collection">星光纪念册</Link>。
      </p>
    </>
  );
}
