import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IDENTITIES } from '../data/identities';
import { MAJORS } from '../data/rules';
import { PixelAvatar } from '../components/PixelAvatar';
import { SaveNotice } from '../components/SaveNotice';
import { createGame } from '../domain/initial';
import {
  canManage,
  identityLabel,
  identityRules,
} from '../domain/presentation';
import { bedLabel } from '../domain/rules';
import type { Character, GameState, Room } from '../domain/model';
import type { CharacterInput, CustomizeCommand } from '../domain/customize';
import { useGame } from '../state/game';
import { GAME } from '../data/constants';
import { useRoomView } from '../state/useRoomView';
import { RoomNavigation } from '../components/RoomNavigation';
import { FACES } from '../data/faces';

type Tab = 'identity' | 'room' | 'characters';
type FormResult = { error?: string; entityId?: string };
type Submit = (command: CustomizeCommand) => Promise<FormResult>;

function PlayerEditor({
  game,
  submit,
  afterSave,
  blocked,
}: {
  game: GameState;
  submit: Submit;
  afterSave: () => void;
  blocked: boolean;
}) {
  const [identity, setIdentity] = useState(game.player.identity);
  const [customTitle, setCustomTitle] = useState(game.player.customTitle);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const result = await submit({
      type: 'player',
      input: {
        identity,
        customTitle,
        age: game.player.age,
        adultConfirmed: true,
      },
    });
    setBusy(false);
    setError(result.error ?? '');
    if (!result.error) afterSave();
  };
  return (
    <form onSubmit={(event) => void save(event)} className="custom-form">
      <div className="form-intro">
        <span className="sticker-bow" aria-hidden="true">
          🎀
        </span>
        <div>
          <p className="eyebrow">STEP 01 · YOUR POINT OF VIEW</p>
          <h2>今天，想以谁的视角入住？</h2>
          <p>身份是观察与相处的方式。玩家不会自动变成占床室友。</p>
        </div>
      </div>
      <fieldset disabled={blocked || busy} className="identity-grid">
        <legend className="sr-only">选择玩家身份</legend>
        {Object.entries(IDENTITIES).map(([id, item]) => (
          <label
            key={id}
            className={`identity-card ${identity === id ? 'chosen' : ''}`}
          >
            <input
              type="radio"
              name="identity"
              value={id}
              checked={identity === id}
              onChange={() =>
                setIdentity(id as GameState['player']['identity'])
              }
            />
            <span aria-hidden="true">{item.icon}</span>
            <strong>{item.name}</strong>
            <small>{item.description}</small>
          </label>
        ))}
      </fieldset>
      <fieldset disabled={blocked || busy} className="form-fields">
        {identity === 'custom' && (
          <label>
            自定义身份名称
            <input
              required
              maxLength={40}
              value={customTitle}
              onChange={(event) => setCustomTitle(event.target.value)}
              placeholder="例如：周末来串门的朋友"
            />
          </label>
        )}
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="button button-primary" disabled={blocked || busy}>
          {game.setup === 'identity' ? '保存身份，布置寝室 →' : '保存玩家身份'}
        </button>
        <p className="quiet-note">具有现实管理关系的身份只使用平等室友文案。</p>
      </div>
    </form>
  );
}

function RoomEditor({
  room,
  game,
  submit,
  afterSave,
  blocked,
  creating = false,
}: {
  room: Room;
  game: GameState;
  submit: Submit;
  afterSave: (id?: string) => void;
  blocked: boolean;
  creating?: boolean;
}) {
  const [name, setName] = useState(room.name);
  const [capacity, setCapacity] = useState<Room['capacity']>(room.capacity);
  const [bedType, setBedType] = useState(room.bedType);
  const [bathroom, setBathroom] = useState(room.facilities.bathroom);
  const [dryWet, setDryWet] = useState(room.facilities.dryWet);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const readonly = blocked || !canManage(game, 'room');
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const input = { name, capacity, bedType, facilities: { bathroom, dryWet } };
    const result = await submit(
      creating
        ? { type: 'room-create', input }
        : { type: 'room', roomId: room.id, input },
    );
    setBusy(false);
    setError(result.error ?? '');
    if (!result.error) afterSave(result.entityId);
  };
  return (
    <form className="custom-form" onSubmit={(event) => void save(event)}>
      <div className="form-intro">
        <span className="sticker-bow" aria-hidden="true">
          🏡
        </span>
        <div>
          <p className="eyebrow">STEP 02 · HOME SWEET HOME</p>
          <h2>
            {creating ? '布置一间新的隔壁寝室' : '给寝室一点你的可爱想法'}
          </h2>
          <p>
            床位按实际可住人数生成。缩容时会保留室友，人数超出容量则拒绝修改。
          </p>
        </div>
      </div>
      {readonly && (
        <p className="permission-note">
          当前身份只可查看寝室配置；在“玩家身份”页可切换视角。
        </p>
      )}
      <fieldset className="form-fields" disabled={readonly || busy}>
        <label>
          寝室名称
          <input
            required
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <div className="form-columns">
          <label>
            寝室容量
            <select
              value={capacity}
              onChange={(event) =>
                setCapacity(Number(event.target.value) as Room['capacity'])
              }
            >
              <option value={4}>4 人寝</option>
              <option value={6}>6 人寝</option>
              <option value={8}>8 人寝</option>
            </select>
          </label>
          <label>
            床型
            <select
              value={bedType}
              onChange={(event) =>
                setBedType(event.target.value as Room['bedType'])
              }
            >
              <option value="loft">上床下桌</option>
              <option value="bunk">双层床（上下铺分别可选）</option>
            </select>
          </label>
        </div>
        <label>
          卫浴主类型
          <select
            value={bathroom}
            onChange={(event) => {
              const value = event.target
                .value as Room['facilities']['bathroom'];
              setBathroom(value);
              if (value !== 'private') setDryWet(false);
            }}
          >
            <option value="private">独卫</option>
            <option value="shared">公共卫浴（无独卫）</option>
            <option value="none">无洗手间</option>
          </select>
        </label>
        <label
          className={`check-field ${bathroom !== 'private' ? 'muted' : ''}`}
        >
          <input
            type="checkbox"
            checked={dryWet}
            disabled={bathroom !== 'private'}
            onChange={(event) => setDryWet(event.target.checked)}
          />
          干湿分离（仅独卫可选）
        </label>
      </fieldset>
      <aside className="room-plan">
        <span aria-hidden="true">♡</span>
        <div>
          <strong>{name || '未命名寝室'}</strong>
          <p>
            {capacity} 个实际床位 ·{' '}
            {bedType === 'loft'
              ? `${capacity} 套上床下桌`
              : `${capacity / 2} 套双层床，独立上下铺`}
          </p>
          <p>
            {bathroom === 'private'
              ? `独卫${dryWet ? ' · 干湿分离' : ''}`
              : bathroom === 'shared'
                ? '公共卫浴'
                : '无洗手间'}
          </p>
        </div>
      </aside>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="button button-primary" disabled={readonly || busy}>
        {creating
          ? '创建这间寝室 ♡'
          : game.setup === 'room'
            ? '保存寝室，认识室友 →'
            : '保存寝室配置'}
      </button>
    </form>
  );
}

function CharacterEditor({
  character,
  game,
  submit,
  afterSave,
  blocked,
  room,
}: {
  character?: Character;
  game: GameState;
  submit: Submit;
  afterSave: (id?: string) => void;
  blocked: boolean;
  room: Room;
}) {
  const freeBed = room.beds.find(
    (bed) => !game.characters.some((resident) => resident.bedId === bed.id),
  );
  const starter = createGame(0).characters[0]!;
  const [draft, setDraft] = useState<
    Omit<CharacterInput, 'adultConfirmed' | 'age'>
  >({
    name: character?.name ?? '',
    address: character?.address ?? '',
    pronouns: character?.pronouns ?? '他',
    personality: character?.personality ?? '温柔又有一点奇思妙想',
    major: character?.major ?? 'random',
    customMajor: character?.customMajor ?? '',
    tags: character?.tags ?? [],
    roleplay: character?.roleplay ?? false,
    appearance: character?.appearance ?? {
      hairColor: '#755267',
      topColor: '#ed9fc0',
      skinColor: '#f1d3b3',
      bottomColor: '#9b78b6',
      face: 'gentle',
    },
    roomId: room.id,
    bedId: character?.bedId ?? freeBed?.id ?? '',
  });
  const [tagsText, setTagsText] = useState(draft.tags.join('，'));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const readonly = blocked || !canManage(game, 'residents');
  const update = <K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) => setDraft((old) => ({ ...old, [key]: value }));
  const preview = {
    ...(character ?? starter),
    ...draft,
    name: draft.name || '新室友',
    major:
      !draft.major || draft.major === 'random'
        ? ('daily' as const)
        : draft.major,
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    const tags = tagsText
      .split(/[，,]/u)
      .map((tag) => tag.trim())
      .filter(Boolean);
    const result = await submit({
      type: 'character',
      characterId: character?.id,
      input: {
        ...draft,
        age: character?.age ?? GAME.defaultAge,
        adultConfirmed: true,
        address: draft.address || draft.name,
        tags: [...new Set(tags)],
      },
    });
    setBusy(false);
    setError(result.error ?? '');
    if (!result.error) afterSave(result.entityId);
  };
  const remove = async () => {
    if (
      !character ||
      !window.confirm(
        `确认让${character.name}离开寝室？其当前成长档案将被移除，床位会释放。`,
      )
    )
      return;
    setBusy(true);
    const result = await submit({ type: 'delete', characterId: character.id });
    setBusy(false);
    setError(result.error ?? '');
    if (!result.error) afterSave();
  };
  return (
    <form
      className="character-editor custom-form"
      onSubmit={(event) => void save(event)}
    >
      <div className="character-preview">
        <PixelAvatar character={preview} />
        <div>
          <span className="eyebrow">ROOMMATE PROFILE</span>
          <h3>{draft.name || '还没认识的新室友'}</h3>
          <p>大学生 · {draft.pronouns} · 配色会同步到地图头像</p>
        </div>
        <span className="profile-heart" aria-hidden="true">
          ♡
        </span>
      </div>
      {readonly && (
        <p className="permission-note">
          当前身份只可查看室友档案；可切换身份后编辑。
        </p>
      )}
      {!character &&
        (!freeBed || game.characters.length >= GAME.maxCharacters) && (
          <p className="permission-note">
            {game.characters.length >= GAME.maxCharacters
              ? '当前存档已有 24 位常住室友。可以搬家或编辑现有室友，不能继续新增。'
              : '寝室已住满。可在“寝室配置”扩为 6 / 8 人寝，或选择其他有空床的寝室。'}
          </p>
        )}
      <fieldset
        className="form-fields"
        disabled={
          readonly ||
          busy ||
          (!character &&
            (!freeBed || game.characters.length >= GAME.maxCharacters))
        }
      >
        <div className="form-columns">
          <label>
            室友姓名
            <input
              required
              maxLength={40}
              value={draft.name}
              onChange={(event) => update('name', event.target.value)}
              placeholder="可以重名，档案 ID 始终唯一"
            />
          </label>
          <label>
            日常称呼
            <input
              maxLength={40}
              value={draft.address}
              onChange={(event) => update('address', event.target.value)}
              placeholder="留空则使用姓名"
            />
          </label>
        </div>
        <div className="form-columns">
          <label>
            代词
            <input
              required
              maxLength={40}
              value={draft.pronouns}
              onChange={(event) => update('pronouns', event.target.value)}
            />
          </label>
        </div>
        <label>
          性格
          <input
            required
            maxLength={40}
            value={draft.personality}
            onChange={(event) => update('personality', event.target.value)}
          />
        </label>
        <div className="form-columns">
          <label>
            专业
            <select
              value={draft.major}
              onChange={(event) =>
                update(
                  'major',
                  event.target.value as NonNullable<CharacterInput['major']>,
                )
              }
            >
              <option value="random">随机分配专业（未指定）</option>
              {Object.entries(MAJORS).map(([id, major]) => (
                <option key={id} value={id}>
                  {major.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            床位
            <select
              required
              value={draft.bedId}
              onChange={(event) => update('bedId', event.target.value)}
            >
              <option value="">选择空床</option>
              {room.beds.map((bed) => {
                const occupant = game.characters.find(
                  (resident) =>
                    resident.bedId === bed.id && resident.id !== character?.id,
                );
                return (
                  <option
                    key={bed.id}
                    value={bed.id}
                    disabled={!character && Boolean(occupant)}
                  >
                    {bedLabel(game, bed.id)}
                    {occupant ? ` · ${occupant.name}（保存后交换）` : ' · 可用'}
                  </option>
                );
              })}
            </select>
          </label>
        </div>
        <fieldset className="face-picker">
          <legend>面容模板</legend>
          {FACES.map((face) => (
            <label
              key={face.id}
              className={draft.appearance.face === face.id ? 'chosen' : ''}
            >
              <input
                type="radio"
                name="face-template"
                value={face.id}
                checked={draft.appearance.face === face.id}
                onChange={() =>
                  update('appearance', { ...draft.appearance, face: face.id })
                }
              />
              <span aria-hidden="true">
                <PixelAvatar
                  character={{
                    ...preview,
                    appearance: { ...preview.appearance, face: face.id },
                  }}
                />
              </span>
              <strong>{face.name}</strong>
              <small>{face.description}</small>
            </label>
          ))}
        </fieldset>
        {draft.major === 'custom' && (
          <label>
            自定义专业名称
            <input
              required
              maxLength={40}
              value={draft.customMajor}
              onChange={(event) => update('customMajor', event.target.value)}
              placeholder="使用日常基准倍率 1.0"
            />
          </label>
        )}
        <label>
          风格标签（逗号分隔，最多 12 个）
          <input
            maxLength={490}
            value={tagsText}
            onChange={(event) => setTagsText(event.target.value)}
            placeholder="例如：甜酷，元气，男娘，自由穿搭"
          />
        </label>
        <div className="tag-suggestions" aria-label="添加风格标签">
          {['可爱', '甜酷', '男娘', '元气', '文静'].map((tag) => (
            <button
              type="button"
              key={tag}
              onClick={() =>
                setTagsText((old) =>
                  [
                    ...new Set([...old.split(/[，,]/u).filter(Boolean), tag]),
                  ].join('，'),
                )
              }
            >
              ＋{tag}
            </button>
          ))}
        </div>
        <p className="quiet-note">
          首次选择“男娘”标签，起步男娘进度为
          50；只发放一次，删除再添加标签不会补领，后续成长与状态后果照常结算。
        </p>
        <fieldset className="color-fields">
          <legend>头像配色</legend>
          {(
            [
              ['hairColor', '发色'],
              ['topColor', '上衣颜色'],
              ['skinColor', '肤色'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="color"
                value={draft.appearance[key]}
                onChange={(event) =>
                  update('appearance', {
                    ...draft.appearance,
                    [key]: event.target.value,
                  })
                }
              />
            </label>
          ))}
        </fieldset>
        <label className="check-field">
          <input
            type="checkbox"
            checked={draft.roleplay}
            disabled={!identityRules(game).roleplay}
            onChange={(event) => update('roleplay', event.target.checked)}
          />
          此室友自愿参与轻量关系扮演，可随时关闭
        </label>
        <p className="quiet-note">
          还需在偏好设置中开启全局许可才会使用扮演文案；标签、专业和服装不决定是否参与。
        </p>
      </fieldset>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button
          className="button button-primary"
          disabled={
            readonly ||
            busy ||
            (!character &&
              (!freeBed || game.characters.length >= GAME.maxCharacters))
          }
        >
          {character ? '保存室友档案' : '添加这位室友 ♡'}
        </button>
        {character && (
          <button
            className="button button-danger"
            type="button"
            disabled={readonly || busy}
            onClick={() => void remove()}
          >
            移除这位室友
          </button>
        )}
      </div>
    </form>
  );
}

export function CustomizePage() {
  const { game, status, customize } = useGame();
  const navigate = useNavigate();
  const { room, params, chooseRoom } = useRoomView(game);
  const [chosenTab, setChosenTab] = useState<Tab | null>(null);
  const tab: Tab =
    chosenTab ??
    (game.setup === 'done'
      ? params.get('tab') === 'characters'
        ? 'characters'
        : params.get('tab') === 'room'
          ? 'room'
          : 'identity'
      : game.setup);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [formGeneration, setFormGeneration] = useState(0);
  const blocked = status === 'invalid' || status === 'conflict';
  const [creatingRoom, setCreatingRoom] = useState(false);
  const residents = game.characters.filter(
    (character) => character.roomId === room.id,
  );
  const draftRoom = {
    ...createGame(0).rooms[0]!,
    name: `第 ${game.rooms.length + 1} 间小屋`,
  };
  const onboarding = game.setup !== 'done';
  const advance = (next: Tab, message: string) => {
    setFeedback(message);
    if (onboarding) setChosenTab(next);
  };
  const finish = async () => {
    const result = await customize({ type: 'finish' });
    setError(result.error ?? '');
    if (!result.error) navigate('/room');
  };
  return (
    <>
      <section className="customize-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS · WITH A LITTLE PINK</p>
          <h1 tabIndex={-1}>
            {onboarding ? '写下你的入住小档案' : '我的自定义工坊'}
          </h1>
          <p>选择你的身份，布置喜欢的寝室，遇见独一无二的室友。</p>
        </div>
        <span className="large-bow" aria-hidden="true">
          🎀
        </span>
      </section>
      <SaveNotice />
      {!onboarding && (
        <>
          <RoomNavigation
            game={game}
            roomId={room.id}
            onChoose={(id) => {
              chooseRoom(id);
              setCreatingRoom(false);
              setEditingId(undefined);
              setFeedback('');
            }}
          />
          <div className="new-room-actions">
            <button
              className="button"
              disabled={
                blocked ||
                !canManage(game, 'room') ||
                game.rooms.length >= GAME.maxRooms
              }
              onClick={() => {
                setCreatingRoom(true);
                setChosenTab('room');
                setFeedback('填写新寝室的容量、床型和卫浴配置。');
              }}
            >
              ＋ 新建隔壁寝室
            </button>
            <span className="quiet-note">
              最多 6 间寝室、24 位常住室友；空床可保留。
            </span>
            {creatingRoom && (
              <button
                className="button"
                onClick={() => {
                  setCreatingRoom(false);
                  setFeedback('');
                }}
              >
                取消新建
              </button>
            )}
          </div>
        </>
      )}
      <nav className="setup-tabs" aria-label="自定义步骤">
        {(
          [
            ['identity', '01', '玩家身份'],
            ['room', '02', '寝室配置'],
            ['characters', '03', '室友档案'],
          ] as const
        ).map(([id, number, title], index) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? 'step' : undefined}
            disabled={
              onboarding &&
              index > ['identity', 'room', 'characters'].indexOf(game.setup)
            }
            onClick={() => {
              setChosenTab(id);
              setFeedback('');
            }}
          >
            <span>{number}</span>
            {title}
          </button>
        ))}
      </nav>
      <p className="workshop-status" role="status">
        {feedback ||
          (onboarding
            ? '从一间空寝室开始，所有步骤都会保存在当前浏览器。'
            : `当前：${identityLabel(game)}视角 · 编辑档案保留六维与成长进度。`)}
      </p>
      <section className="panel workshop-panel">
        {tab === 'identity' && (
          <PlayerEditor
            key={`player-${game.player.identity}`}
            game={game}
            blocked={blocked}
            submit={customize}
            afterSave={() => advance('room', '身份已保存 ♡')}
          />
        )}
        {tab === 'room' && (
          <RoomEditor
            key={creatingRoom ? 'new-room' : room.id}
            room={creatingRoom ? draftRoom : room}
            game={game}
            blocked={blocked}
            submit={customize}
            creating={creatingRoom}
            afterSave={(id) => {
              if (creatingRoom && id) {
                chooseRoom(id);
                setCreatingRoom(false);
                setChosenTab('characters');
                setEditingId(undefined);
              }
              advance('characters', '寝室配置已保存 ♡');
            }}
          />
        )}
        {tab === 'characters' && (
          <>
            <div className="form-intro">
              <span className="sticker-bow" aria-hidden="true">
                ♡
              </span>
              <div>
                <p className="eyebrow">STEP 03 · EVERYONE IS ONE OF A KIND</p>
                <h2>认识你想认识的室友</h2>
                <p>
                  姓名可以相同，每位室友都有独立档案。{room.name} ·{' '}
                  {residents.length} / {room.capacity} 个床位已使用。全存档{' '}
                  {game.characters.length} / 24 人。
                </p>
              </div>
            </div>
            <div className="workshop-roster" aria-label="选择要编辑的室友">
              <button
                className={!editingId ? 'active' : ''}
                onClick={() => {
                  setEditingId(undefined);
                  setFormGeneration((old) => old + 1);
                }}
              >
                ＋ 新室友
              </button>
              {residents.map((character) => (
                <button
                  key={character.id}
                  className={editingId === character.id ? 'active' : ''}
                  onClick={() => setEditingId(character.id)}
                >
                  {character.name}
                </button>
              ))}
            </div>
            <CharacterEditor
              key={`${room.id}-${editingId ?? 'new'}-${formGeneration}`}
              character={game.characters.find(
                (character) => character.id === editingId,
              )}
              game={game}
              room={room}
              blocked={blocked}
              submit={customize}
              afterSave={(id) => {
                setEditingId(id);
                setFormGeneration((old) => old + 1);
                setFeedback(
                  id
                    ? '室友档案已保存，头像配色也会同步到地图 ♡'
                    : '室友已移除，床位已释放。',
                );
              }}
            />
          </>
        )}
      </section>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="workshop-bottom">
        {onboarding ? (
          <>
            <p>
              {game.characters.length
                ? `已准备好 ${game.characters.length} 位室友，空床可以留给未来的朋友。`
                : '至少创建一位室友后就可以入住。'}
            </p>
            <button
              className="button button-primary"
              disabled={
                blocked ||
                game.setup !== 'characters' ||
                !game.characters.length
              }
              onClick={() => void finish()}
            >
              完成自定义，开始入住 ♡
            </button>
          </>
        ) : (
          <Link
            className="button button-primary"
            to={`/room?room=${encodeURIComponent(room.id)}`}
          >
            返回我的寝室 →
          </Link>
        )}
      </div>
    </>
  );
}
