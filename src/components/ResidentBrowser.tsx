import { useState } from 'react';
import type { GameState } from '../domain/model';
import { majorLabel } from '../domain/presentation';
import { bedLabel } from '../domain/rules';

export function ResidentBrowser({
  game,
  selectedId,
  onChoose,
}: {
  game: GameState;
  selectedId: string;
  onChoose: (id: string) => void;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const residents = game.characters.filter(
    (character) =>
      (filter === 'all' || character.roomId === filter) &&
      `${character.name} ${character.address} ${majorLabel(character)} ${character.tags.join(' ')}`
        .toLocaleLowerCase()
        .includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <details className="panel resident-browser">
      <summary>
        ♡ 全体室友 · {game.characters.length} / 24 人 · 展开查找与定位
      </summary>
      <div className="browser-filters">
        <label>
          按寝室筛选
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">全部寝室</option>
            {game.rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          搜索室友
          <input
            type="search"
            maxLength={40}
            placeholder="姓名、称呼、专业或标签"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
      </div>
      <p className="quiet-note">
        找到 {residents.length} 位室友。点击可定位到 TA 的寝室与档案。
      </p>
      <div className="browser-results">
        {residents.map((character) => {
          const room = game.rooms.find(
            (candidate) => candidate.id === character.roomId,
          )!;
          return (
            <button
              className="button"
              key={character.id}
              aria-pressed={selectedId === character.id}
              aria-label={`查看${character.name}的档案 · ${room.name}`}
              onClick={() => onChoose(character.id)}
            >
              <strong>{character.name}</strong>
              <span>
                {room.name} · {bedLabel(game, character.bedId)} ·{' '}
                {majorLabel(character)}
              </span>
            </button>
          );
        })}
      </div>
      {!residents.length && (
        <p className="quiet-note">没有匹配的室友，试试其他寝室或关键词。</p>
      )}
    </details>
  );
}
