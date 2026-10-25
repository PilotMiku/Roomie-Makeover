import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CharacterPreview } from '../components/CharacterPreview';
import { PixelAvatar } from '../components/PixelAvatar';
import { SaveNotice } from '../components/SaveNotice';
import {
  CLOTHES,
  OPEN_SLOTS,
  RESERVED_SLOTS,
  SLOT_LABELS,
  STYLE_LABELS,
  WARDROBE,
  findClothing,
  type ClothingStyle,
  type OpenSlot,
} from '../data/clothes';
import { canManage } from '../domain/presentation';
import { unlockDescription } from '../domain/unlocks';
import {
  clothingProgressError,
  type WardrobeCommand,
} from '../domain/wardrobe';
import type { Character, GameState } from '../domain/model';
import { useGame } from '../state/game';

function LookEditor({
  character,
  game,
  blocked,
}: {
  character: Character;
  game: GameState;
  blocked: boolean;
}) {
  const { dress, status } = useGame();
  const [slot, setSlot] = useState<OpenSlot>('hair');
  const [style, setStyle] = useState<ClothingStyle | 'all'>('all');
  const [colors, setColors] = useState({
    hairColor: character.appearance.hairColor,
    topColor: character.appearance.topColor,
    bottomColor: character.appearance.bottomColor,
  });
  const [presetName, setPresetName] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const dirty =
    colors.hairColor !== character.appearance.hairColor ||
    colors.topColor !== character.appearance.topColor ||
    colors.bottomColor !== character.appearance.bottomColor;
  const disabled = blocked || busy;
  const mutationDisabled = disabled || dirty;
  const preview = {
    ...character,
    appearance: { ...character.appearance, ...colors },
  };
  const perform = async (command: WardrobeCommand, message: string) => {
    if (disabled) return;
    setBusy(true);
    setError('');
    const result = await dress(command);
    setBusy(false);
    if (result.error) setError(result.error);
    else {
      const applied = useGame
        .getState()
        .game.characters.find((resident) => resident.id === character.id);
      if (applied)
        setColors({
          hairColor: applied.appearance.hairColor,
          topColor: applied.appearance.topColor,
          bottomColor: applied.appearance.bottomColor,
        });
      setFeedback(
        useGame.getState().status === 'ready'
          ? message
          : `${message}当前仅在本次会话生效，请处理存档提示。`,
      );
    }
  };
  const items = CLOTHES.filter(
    (item) => item.slot === slot && (style === 'all' || item.style === style),
  );
  return (
    <>
      {blocked && (
        <p className="permission-note">
          当前身份或存档状态只允许查看衣柜；可切换身份或处理存档提示后换装。
        </p>
      )}
      <div className="wardrobe-layout">
        <section
          className="panel outfit-preview-panel"
          aria-labelledby="outfit-preview-title"
        >
          <p className="eyebrow">TODAY'S LITTLE MAKEOVER</p>
          <h2 id="outfit-preview-title">{character.name}的试衣镜</h2>
          <figure className="dressing-stage">
            <span className="stage-heart stage-heart-left" aria-hidden="true">
              ♡
            </span>
            <CharacterPreview character={preview} />
            <span className="stage-heart stage-heart-right" aria-hidden="true">
              ✧
            </span>
            <figcaption>
              大学生 · {dirty ? '正在预览配色' : '当前已应用造型'}
            </figcaption>
          </figure>
          <ul className="equipped-list" aria-label="当前已穿服装">
            {OPEN_SLOTS.map((key) => (
              <li key={key}>
                <span>{SLOT_LABELS[key]}</span>
                <strong>
                  {findClothing(character.outfit[key])?.name ?? '未使用'}
                </strong>
              </li>
            ))}
          </ul>
          <p className="progress-gates">
            男娘进度 {character.stats.progress} / 100 · 50 解锁裙装与妆造 · 100
            解锁女仆套装
          </p>
          <button
            className="button button-primary"
            disabled={mutationDisabled || character.stats.progress < 100}
            onClick={() =>
              void perform(
                { type: 'maid-set', characterId: character.id },
                '黑白女仆套装已应用 ♡',
              )
            }
          >
            一键穿上女仆装
          </button>
          <div className="map-avatar-preview">
            <PixelAvatar character={character} />
            <p>
              地图头像同步发型与上衣
              <br />
              <small>下装细节请看全身预览</small>
            </p>
          </div>
          <form
            className="outfit-colors"
            onSubmit={(event) => {
              event.preventDefault();
              void perform(
                { type: 'color', characterId: character.id, colors },
                '配色已应用，地图头像同步更新 ♡',
              );
            }}
          >
            <fieldset className="color-fields" disabled={disabled}>
              <legend>基础单色配色</legend>
              {(
                [
                  ['hairColor', '发色'],
                  ['topColor', '上衣颜色'],
                  ['bottomColor', '下装颜色'],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    type="color"
                    value={colors[key]}
                    onChange={(event) =>
                      setColors((old) => ({
                        ...old,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </fieldset>
            <div className="outfit-color-actions">
              <button
                className="button button-primary"
                disabled={disabled || !dirty}
              >
                应用配色
              </button>
              <button
                type="button"
                className="button"
                disabled={disabled || !dirty}
                onClick={() =>
                  setColors({
                    hairColor: character.appearance.hairColor,
                    topColor: character.appearance.topColor,
                    bottomColor: character.appearance.bottomColor,
                  })
                }
              >
                还原预览
              </button>
            </div>
          </form>
          <p className="quiet-note">
            配色预览需点“应用配色”后保存。换装不消耗体力，也不增加六维。
          </p>
        </section>
        <section className="panel closet-panel" aria-labelledby="closet-title">
          <div className="closet-title">
            <div>
              <p className="eyebrow">A CLOSET FULL OF POSSIBILITIES</p>
              <h2 id="closet-title">挑选今天的可爱</h2>
            </div>
            <span className="stage-badge">
              {game.wardrobe.unlockedIds.length} / {CLOTHES.length} 已解锁
            </span>
          </div>
          <div className="slot-picker" aria-label="开放的服装槽位">
            {OPEN_SLOTS.map((key) => (
              <button
                key={key}
                aria-pressed={slot === key}
                onClick={() => setSlot(key)}
              >
                {SLOT_LABELS[key]}
              </button>
            ))}
          </div>
          {!['hair', 'top', 'bottom'].includes(slot) && (
            <button
              className="button"
              disabled={mutationDisabled || character.outfit[slot] === null}
              onClick={() =>
                void perform(
                  {
                    type: 'unequip',
                    characterId: character.id,
                    slot: slot as 'skirt' | 'accessory' | 'makeup',
                  },
                  '已收起这件妆造单品',
                )
              }
            >
              收起当前{SLOT_LABELS[slot]}
            </button>
          )}
          <div className="reserved-slots" aria-label="尚未开放的槽位">
            {RESERVED_SLOTS.map((label) => (
              <button key={label} disabled title="后续阶段开放">
                {label} · 未开放
              </button>
            ))}
          </div>
          <div className="closet-filter">
            <label htmlFor="clothing-style">服装风格</label>
            <select
              id="clothing-style"
              value={style}
              onChange={(event) =>
                setStyle(event.target.value as ClothingStyle | 'all')
              }
            >
              <option value="all">全部风格</option>
              {Object.entries(STYLE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className="button"
              disabled={mutationDisabled}
              onClick={() =>
                void perform(
                  { type: 'random', characterId: character.id },
                  '已从解锁服装中随机搭配 ♡',
                )
              }
            >
              🎲 随机搭配
            </button>
          </div>
          {dirty && (
            <p className="permission-note">
              正在预览配色，请先应用或还原，再进行换装或套装操作。
            </p>
          )}
          <div
            className="clothing-grid"
            aria-label={`${SLOT_LABELS[slot]}服装列表`}
          >
            {items.map((item) => {
              const unlocked = game.wardrobe.unlockedIds.includes(item.id);
              const progressError = clothingProgressError(character, item.id);
              const available = unlocked && !progressError;
              const equipped = character.outfit[slot] === item.id;
              const sample = {
                ...preview,
                outfit: { ...character.outfit, [slot]: item.id },
              };
              return (
                <button
                  key={item.id}
                  className={`clothing-card ${available ? '' : 'locked'}`}
                  aria-pressed={equipped}
                  disabled={mutationDisabled || !available}
                  onClick={() =>
                    void perform(
                      {
                        type: 'equip',
                        characterId: character.id,
                        slot,
                        itemId: item.id,
                      },
                      `${item.name}已穿上 ♡`,
                    )
                  }
                  aria-label={`${item.name}，${equipped ? '已穿上' : available ? '可穿戴' : '未解锁'}`}
                >
                  <span className="clothing-picture">
                    <CharacterPreview character={sample} focusSlot={slot} />
                  </span>
                  <strong>{item.name}</strong>
                  <span className="clothing-style-tag">
                    {STYLE_LABELS[item.style]}
                  </span>
                  <small>
                    {equipped
                      ? '✓ 已穿上'
                      : progressError
                        ? `🔒 ${progressError}`
                        : unlocked
                          ? '点击穿上'
                          : `🔒 ${unlockDescription(item.unlock)}`}
                  </small>
                  <span className="clothing-description">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="quiet-note">
            所有室友都可自由选择服装，风格不绑定专业、性别或标签。已解锁服装会永久留在当前存档衣柜中。
          </p>
        </section>
      </div>
      <p className="wardrobe-feedback" role="status" aria-live="polite">
        {feedback ||
          (status === 'ready'
            ? '点击服装即可穿上并自动保存。六种槽位可选，裙装、配饰和妆容有进度门槛，尚未解锁的物品会显示条件。'
            : '当前进度未能可靠保存，请先处理上方存档提示。')}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <section className="panel presets-panel" aria-labelledby="presets-title">
        <p className="eyebrow">SAVE A LITTLE INSPIRATION</p>
        <h2 id="presets-title">我的搭配收藏</h2>
        <form
          className="preset-save-form"
          onSubmit={(event) => {
            event.preventDefault();
            void perform(
              {
                type: 'save-preset',
                characterId: character.id,
                name: presetName,
              },
              '套装已收藏，发型、服装与配色一起保存 ♡',
            );
          }}
        >
          <label htmlFor="preset-name">
            套装名称
            <input
              id="preset-name"
              required
              maxLength={WARDROBE.nameLimit}
              value={presetName}
              disabled={disabled}
              onChange={(event) => setPresetName(event.target.value)}
              placeholder="例如：樱桃奶油周末"
            />
          </label>
          <button
            className="button button-primary"
            disabled={
              mutationDisabled ||
              game.wardrobe.presets.length >= WARDROBE.maxPresets
            }
          >
            收藏当前搭配 ♡
          </button>
        </form>
        <p className="quiet-note">
          最多收藏 {WARDROBE.maxPresets}{' '}
          套；保存第一套会触发「第一套造型」纪念事件，解锁奶油双丸子和小鸭条纹裤。套装保存外观，不改变肤色或成长。
        </p>
        <div className="preset-list">
          {game.wardrobe.presets.map((preset) => (
            <article className="preset-card" key={preset.id}>
              <CharacterPreview
                character={{
                  ...character,
                  outfit: preset.outfit,
                  appearance: { ...character.appearance, ...preset.colors },
                }}
                label={`套装${preset.name}预览`}
              />
              <div>
                <h3>{preset.name}</h3>
                <p>
                  {OPEN_SLOTS.map(
                    (key) => findClothing(preset.outfit[key])?.name,
                  ).join(' · ')}
                </p>
                <div className="preset-actions">
                  <button
                    className="button"
                    disabled={mutationDisabled}
                    onClick={() =>
                      void perform(
                        {
                          type: 'apply-preset',
                          characterId: character.id,
                          presetId: preset.id,
                        },
                        `已应用套装「${preset.name}」♡`,
                      )
                    }
                  >
                    应用「{preset.name}」
                  </button>
                  <button
                    className="button button-danger"
                    disabled={mutationDisabled}
                    onClick={() => {
                      if (
                        window.confirm(
                          `确认删除套装「${preset.name}」？角色当前穿搭不会改变。`,
                        )
                      )
                        void perform(
                          { type: 'delete-preset', presetId: preset.id },
                          '套装已删除，角色当前造型保留。',
                        );
                    }}
                  >
                    删除「{preset.name}」
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
        {!game.wardrobe.presets.length && (
          <p className="empty-closet">♡ 还没有收藏，从今天喜欢的造型开始吧。</p>
        )}
      </section>
    </>
  );
}

export function WardrobePage() {
  const { game, status } = useGame();
  const [params] = useSearchParams();
  const [roomFilter, setRoomFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(
    params.get('resident') ?? game.characters[0]?.id ?? '',
  );
  const residents = game.characters.filter(
    (candidate) => roomFilter === 'all' || candidate.roomId === roomFilter,
  );
  const character =
    residents.find((candidate) => candidate.id === selectedId) ?? residents[0];
  const blocked =
    status === 'invalid' ||
    status === 'conflict' ||
    !canManage(game, 'residents');
  return (
    <>
      <section className="wardrobe-heading">
        <div>
          <p className="eyebrow">DRESS UP · BE YOURSELF</p>
          <h1 tabIndex={-1}>今天穿什么？🎀</h1>
          <p>一点缎带、一点幻想，把喜欢的样子穿进日常。</p>
        </div>
        <Link
          className="text-link"
          to={
            character
              ? `/room?room=${encodeURIComponent(character.roomId)}&resident=${encodeURIComponent(character.id)}`
              : '/room'
          }
        >
          ← 回到寝室
        </Link>
      </section>
      <SaveNotice />
      {game.setup !== 'done' || !game.characters.length ? (
        <section className="panel empty-wardrobe">
          <h2>先认识一位室友吧</h2>
          <p>完成入住小档案后，就可以为室友选择发型、上衣和下装。</p>
          <Link className="button button-primary" to="/customize">
            去自定义工坊 →
          </Link>
        </section>
      ) : (
        <>
          <div className="wardrobe-resident-picker">
            {game.rooms.length > 1 && (
              <>
                <label htmlFor="wardrobe-room">衣柜按寝室筛选</label>
                <select
                  id="wardrobe-room"
                  value={roomFilter}
                  onChange={(event) => {
                    setRoomFilter(event.target.value);
                    setSelectedId('');
                  }}
                >
                  <option value="all">全部寝室</option>
                  {game.rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            <label htmlFor="wardrobe-resident">为谁挑选穿搭</label>
            <select
              id="wardrobe-resident"
              value={character?.id ?? ''}
              disabled={!residents.length}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {!residents.length && <option value="">本寝室暂无室友</option>}
              {residents.map((resident) => (
                <option key={resident.id} value={resident.id}>
                  {resident.name}
                  {game.rooms.length > 1
                    ? ` · ${game.rooms.find((room) => room.id === resident.roomId)?.name}`
                    : ''}
                </option>
              ))}
            </select>
            <span>共用衣柜 · 独立造型 · 当前第 {game.day} 天</span>
          </div>
          {character ? (
            <LookEditor
              key={character.id}
              character={character}
              game={game}
              blocked={blocked}
            />
          ) : (
            <section className="panel empty-wardrobe">
              <h2>这间寝室的衣架还空着 ♡</h2>
              <p>选择其他寝室的室友，或先添加新的室友。</p>
              <Link
                className="button"
                to={`/customize?room=${encodeURIComponent(roomFilter)}&tab=characters`}
              >
                去添加本寝室室友 →
              </Link>
            </section>
          )}
        </>
      )}
    </>
  );
}
