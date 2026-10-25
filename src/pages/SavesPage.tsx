import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { GAME, SAVES } from '../data/constants';
import {
  importError,
  readImportFile,
  type ImportPreview,
  type SlotId,
} from '../domain/saves';
import { useGame } from '../state/game';
import type { SlotCommand } from '../state/slotCommands';
import { SaveNotice } from '../components/SaveNotice';
import { downloadJson } from '../components/download';

export function SavesPage() {
  const state = useGame();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [fileName, setFileName] = useState('');
  const [targetId, setTargetId] = useState<SlotId>(state.activeSlot);
  const fileRequest = useRef(0);
  const run = async (command: SlotCommand) => {
    setBusy(true);
    setError('');
    setFeedback('');
    const result = await state.manageSlot(command);
    if (result.error) setError(result.error);
    else {
      setFeedback(
        command.type === 'import'
          ? '备份已恢复 ♡ 可以进入目标槽继续故事。'
          : command.type === 'delete'
            ? '该槽已删除，其他故事保持不变。'
            : command.type === 'create'
              ? '新故事已创建，去选择你的身份吧 ♡'
              : command.type === 'rename'
                ? '存档名称已保存 ♡'
                : '已切换存档 ♡',
      );
      if (command.type === 'import') setPreview(null);
    }
    setBusy(false);
  };
  const exportSlot = async (id: SlotId, original = false) => {
    setBusy(true);
    setError('');
    const result = await state.exportSlot(id, original);
    if (result.error) setError(result.error);
    else if (result.raw !== undefined && result.filename) {
      downloadJson(result.raw, result.filename);
      setFeedback(
        original
          ? '原始文件已交给浏览器下载，请妥善保管。'
          : 'JSON 备份已交给浏览器下载，请妥善保管。',
      );
    }
    setBusy(false);
  };
  const target = state.slots.find((slot) => slot.slotId === targetId)!;
  return (
    <>
      <section className="room-heading">
        <div>
          <p className="eyebrow">KEEP YOUR LITTLE STORIES</p>
          <h1 tabIndex={-1}>把回忆收好 ♡</h1>
          <p className="quiet-note">5 本独立的寝室日记，随时备份，安心继续。</p>
        </div>
        <button
          className="button"
          disabled={busy}
          onClick={() => {
            state.detectConflict();
            setFeedback('存档列表已刷新。');
          }}
        >
          刷新存档列表
        </button>
      </section>
      <SaveNotice />
      <p className="game-notice" role="status">
        {feedback ||
          state.notice ||
          '当前槽位会自动保存。切换前先保存进度；每个标签页可以选择自己的故事。'}
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="saves-grid">
        {state.slots.map((slot, index) => {
          const active = slot.slotId === state.activeSlot;
          const valid = slot.status === 'ready' && !slot.empty;
          const current = active ? state : slot;
          return (
            <section
              className={`panel save-card ${active ? 'save-card-active' : ''}`}
              aria-label={`槽位 ${index + 1}`}
              key={slot.slotId}
            >
              <div className="activity-title">
                <p className="eyebrow">DIARY 0{index + 1}</p>
                <span className="token-badge">
                  {active ? '♡ 当前故事 · ' : ''}
                  {slot.status === 'invalid'
                    ? '原档待恢复'
                    : slot.status === 'unavailable'
                      ? '无法读取'
                      : slot.empty
                        ? '空白日记'
                        : '已保存'}
                </span>
              </div>
              <h2>
                {valid
                  ? slot.game.name
                  : slot.status === 'invalid'
                    ? '这本回忆需要修复'
                    : slot.status === 'unavailable'
                      ? '暂时无法打开'
                      : '新的一页，等你来写'}
              </h2>
              {valid ? (
                <p className="save-summary">
                  第 {slot.game.day} 天 · {slot.game.characters.length} 位室友 ·{' '}
                  {slot.game.rooms.length} 间寝室
                  <br />
                  {slot.game.setup === 'done'
                    ? '已经入住'
                    : '入住档案填写中'} · {slot.game.wardrobe.presets.length}{' '}
                  套收藏 · {slot.game.pendingEvents.length} 个待选故事
                </p>
              ) : (
                <p className="quiet-note">
                  {slot.status === 'invalid'
                    ? slot.error ||
                      '原始文件已保留，请先下载备份，再导入有效存档恢复。'
                    : slot.status === 'unavailable'
                      ? '请检查站点存储权限或释放空间后刷新。'
                      : '从玩家身份、寝室与室友自定义开始，其他故事不受影响。'}
                </p>
              )}
              {active && state.dirty && (
                <p className="activity-limit">
                  本页有尚未写入的进度，请先重试保存或导出当前进度。
                </p>
              )}
              {slot.status === 'ready' && (
                <form
                  className="save-name-form"
                  key={`${slot.slotId}:${slot.game.name}:${slot.empty}`}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    void run({
                      type: slot.empty ? 'create' : 'rename',
                      slotId: slot.slotId,
                      expectedRaw: slot.raw,
                      name: String(data.get('name') ?? ''),
                    });
                  }}
                >
                  <label htmlFor={`save-name-${slot.slotId}`}>
                    {slot.empty ? '新故事名称' : '存档名称'}
                  </label>
                  <input
                    id={`save-name-${slot.slotId}`}
                    name="name"
                    maxLength={40}
                    required
                    defaultValue={
                      slot.empty ? `第 ${index + 1} 本回忆` : slot.game.name
                    }
                    disabled={busy}
                  />
                  <button className="button" disabled={busy}>
                    {slot.empty ? '创建新故事' : '保存名称'}
                  </button>
                </form>
              )}
              <div className="save-actions">
                {valid && (
                  <button
                    className="button button-primary"
                    disabled={busy || active}
                    onClick={() =>
                      void run({ type: 'switch', slotId: slot.slotId })
                    }
                  >
                    {active ? '正在游玩' : '进入该存档'}
                  </button>
                )}
                {active && valid && (
                  <Link
                    className="button"
                    to={state.game.setup === 'done' ? '/room' : '/customize'}
                  >
                    继续当前故事 →
                  </Link>
                )}
                {!slot.empty &&
                  slot.status !== 'invalid' &&
                  slot.status !== 'unavailable' && (
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => void exportSlot(slot.slotId)}
                    >
                      {active ? '导出当前进度' : '导出 JSON'}
                    </button>
                  )}
                {(current.sourceRaw ||
                  (slot.status === 'invalid' && slot.raw)) && (
                  <button
                    className="button"
                    disabled={busy}
                    onClick={() => void exportSlot(slot.slotId, true)}
                  >
                    {slot.status === 'invalid'
                      ? '下载原始文件'
                      : '导出原始旧档'}
                  </button>
                )}
                {!slot.empty && slot.status !== 'unavailable' && (
                  <button
                    className="button button-danger"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `确认删除槽位 ${index + 1} 的「${valid ? slot.game.name : '无法识别的存档'}」吗？本槽的寝室、角色、成长、衣柜与原始旧档备份都会删除，无法撤销。其他槽位不受影响。建议先导出备份。${active && state.dirty ? '本页未保存的进度也会删除。' : ''}`,
                        )
                      )
                        void run({
                          type: 'delete',
                          slotId: slot.slotId,
                          expectedRaw: slot.raw,
                          confirmed: true,
                        });
                    }}
                  >
                    删除存档
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <section
        className="panel save-import-panel"
        aria-labelledby="import-title"
      >
        <p className="eyebrow">WELCOME YOUR MEMORIES HOME</p>
        <h2 id="import-title">从 JSON 备份恢复</h2>
        <p>
          一次恢复一本日记，最大 2
          MiB。文件会先经过格式、版本、校园设定、数量、属性和床位引用校验，通过后再确认目标槽。
        </p>
        <label className="save-file-label" htmlFor="save-file">
          选择 JSON 备份文件
        </label>
        <input
          id="save-file"
          type="file"
          accept=".json,application/json"
          disabled={busy}
          onChange={async (event) => {
            const request = ++fileRequest.current;
            const file = event.target.files?.[0];
            setPreview(null);
            setError('');
            setFileName('');
            if (!file) return;
            if (file.size > SAVES.maxImportBytes) {
              setError('文件超过 2 MiB，当前有效存档未修改。');
              event.target.value = '';
              return;
            }
            setBusy(true);
            try {
              const incoming = await readImportFile(file);
              if (request === fileRequest.current) {
                setPreview(incoming);
                setFileName(file.name);
              }
            } catch (problem) {
              if (request === fileRequest.current)
                setError(importError(problem));
            } finally {
              if (request === fileRequest.current) setBusy(false);
            }
            event.target.value = '';
          }}
        />
        {preview && (
          <section className="import-preview" aria-label="导入摘要">
            <h3>备份「{preview.game.name}」</h3>
            <p className="quiet-note">
              文件：{fileName} · 版本 {preview.fromVersion}
              {preview.migrated ? ` → ${GAME.version}，按序升级` : ''}
            </p>
            <dl>
              <div>
                <dt>游戏日</dt>
                <dd>第 {preview.game.day} 天</dd>
              </div>
              <div>
                <dt>室友</dt>
                <dd>
                  {preview.game.characters.length} 人 /{' '}
                  {preview.game.rooms.length} 间寝室
                </dd>
              </div>
              <div>
                <dt>衣柜收藏</dt>
                <dd>
                  {preview.game.wardrobe.presets.length} 套 ·{' '}
                  {preview.game.wardrobe.unlockedIds.length} 件已解锁
                </dd>
              </div>
              <div>
                <dt>待选故事</dt>
                <dd>{preview.game.pendingEvents.length} 个，保持待处理</dd>
              </div>
            </dl>
            <label htmlFor="import-target">恢复到哪个槽位</label>
            <select
              id="import-target"
              value={targetId}
              disabled={busy}
              onChange={(event) => setTargetId(event.target.value as SlotId)}
            >
              {state.slots.map((slot, index) => (
                <option key={slot.slotId} value={slot.slotId}>
                  槽位 {index + 1} ·{' '}
                  {slot.status === 'invalid'
                    ? '原档待恢复'
                    : slot.empty
                      ? '空白日记'
                      : slot.game.name}
                </option>
              ))}
            </select>
            <p>
              {target.empty
                ? '目标是空槽，不影响其他故事。'
                : `将覆盖目标槽「${target.status === 'invalid' ? '无法识别的存档' : target.game.name}」的全部内容，请先导出需要保留的备份。`}{' '}
              导入后自动计时从现在重新开始，不追溯补天。
            </p>
            <button
              className="button button-primary"
              disabled={busy || target.status === 'unavailable'}
              onClick={() => {
                const index = SAVES.slots.indexOf(targetId) + 1;
                if (
                  window.confirm(
                    `确认把「${preview.game.name}」（第 ${preview.game.day} 天、${preview.game.characters.length} 位室友）恢复到槽位 ${index} 吗？${target.empty ? '目标为空白日记。' : `目标「${target.status === 'invalid' ? '无法识别的存档' : target.game.name}」及其原始旧档备份将被替换，无法撤销。`}${targetId === state.activeSlot && state.dirty ? '本页未保存进度也会替换。' : ''}其他槽不受影响，自动计时从现在开始。`,
                  )
                )
                  void run({
                    type: 'import',
                    slotId: targetId,
                    expectedRaw: target.raw,
                    raw: preview.raw,
                    confirmed: true,
                  });
              }}
            >
              确认恢复到槽位 {SAVES.slots.indexOf(targetId) + 1}
            </button>
            <button
              className="button"
              disabled={busy}
              onClick={() => {
                fileRequest.current++;
                setPreview(null);
              }}
            >
              取消本次导入
            </button>
          </section>
        )}
      </section>
      <p className="local-data-note">
        数据只留在此浏览器，不提供云同步。清理浏览器数据、换浏览器或使用无痕模式可能造成丢失，请定期导出
        JSON。每槽保留最近 300
        条日志；遇到存储异常会保留原档和内存进度，不自动删档腾空间。
      </p>
    </>
  );
}
