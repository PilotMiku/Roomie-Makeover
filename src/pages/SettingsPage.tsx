import { useState } from 'react';
import { usePreferences } from '../state/preferences';
import { useGame } from '../state/game';
import { identityRules } from '../domain/presentation';
import { SaveNotice } from '../components/SaveNotice';
import { Link } from 'react-router-dom';
import { playChime, stopSound, useSound } from '../audio/sound';

export function SettingsPage() {
  const { preferences, storageStatus, setPreference } = usePreferences();
  const { game, customize, status } = useGame();
  const roleplayAllowed = identityRules(game).roleplay;
  const [pendingRoleplay, setPendingRoleplay] = useState<boolean | null>(null);
  const [roleplayError, setRoleplayError] = useState('');
  const [pendingSound, setPendingSound] = useState<boolean | null>(null);
  const [soundError, setSoundError] = useState('');
  const playbackError = useSound((state) => state.error);
  return (
    <section className="page-panel panel">
      <p className="eyebrow">MAKE YOURSELF COMFORTABLE</p>
      <h1 tabIndex={-1}>舒服一点，刚刚好</h1>
      <p className="page-lead">调整阅读与显示偏好，让这间小屋更适合你。</p>
      <SaveNotice />
      <fieldset
        className="settings-group"
        disabled={
          status === 'invalid' || status === 'conflict' || pendingSound !== null
        }
      >
        <legend>小屋的声音</legend>
        <label className="setting-row">
          <span>
            <strong>开启本地音效</strong>
            <small>
              默认关闭。互动、换装与日结算后播放轻柔提示音，每个存档单独保存。
            </small>
          </span>
          <input
            type="checkbox"
            checked={pendingSound ?? game.settings.sound}
            onChange={(event) => {
              const enabled = event.target.checked;
              if (!enabled) stopSound();
              setPendingSound(enabled);
              void customize({ type: 'sound', enabled }).then((result) => {
                setPendingSound(null);
                setSoundError(result.error ?? '');
              });
            }}
          />
        </label>
        <button
          className="button"
          disabled={!game.settings.sound}
          onClick={() => void playChime()}
        >
          试听音效
        </button>
        {(soundError || playbackError) && (
          <p className="form-error" role="alert">
            {soundError || playbackError}
          </p>
        )}
      </fieldset>
      <fieldset className="settings-group">
        <legend>显示偏好</legend>
        <label className="setting-row">
          <span>
            <strong>减少动态效果</strong>
            <small>关闭装饰动画；系统的减少动态偏好也会自动生效。</small>
          </span>
          <input
            type="checkbox"
            checked={preferences.reduceMotion}
            onChange={(event) =>
              setPreference('reduceMotion', event.target.checked)
            }
          />
        </label>
        <label className="setting-row">
          <span>
            <strong>增强对比度</strong>
            <small>加深文字与边框，让内容更清晰。</small>
          </span>
          <input
            type="checkbox"
            checked={preferences.highContrast}
            onChange={(event) =>
              setPreference('highContrast', event.target.checked)
            }
          />
        </label>
      </fieldset>
      <fieldset
        className="settings-group"
        disabled={status === 'invalid' || status === 'conflict'}
      >
        <legend>自愿的相处方式</legend>
        <label className="setting-row">
          <span>
            <strong>全局关系扮演许可</strong>
            <small>
              {roleplayAllowed
                ? '默认关闭。仅当该室友也单独同意时显示扮演文案；关闭立即恢复为平等室友文案，默契数值与历史记录保留。'
                : '家长、宿管、楼管、辅导员等具有现实管理关系的身份不参与扮演。'}
            </small>
          </span>
          <input
            type="checkbox"
            checked={
              pendingRoleplay ?? (game.settings.roleplay && roleplayAllowed)
            }
            disabled={!roleplayAllowed || pendingRoleplay !== null}
            onChange={(event) => {
              const value = event.target.checked;
              setPendingRoleplay(value);
              void customize({ type: 'settings', roleplay: value }).then(
                (result) => {
                  setPendingRoleplay(null);
                  setRoleplayError(result.error ?? '');
                },
              );
            }}
          />
        </label>
      </fieldset>
      {roleplayError && (
        <p className="form-error" role="alert">
          {roleplayError}
        </p>
      )}
      <p className="storage-message" role="status">
        {storageStatus === 'ready'
          ? '显示偏好会自动保存在当前浏览器。'
          : storageStatus === 'invalid'
            ? '已有偏好数据格式无法识别，原始数据已保留。调整仅对本次打开有效；可在浏览器站点存储中备份原始偏好后修复。'
            : '浏览器暂时无法保存偏好。调整仅对本次打开有效；请检查站点存储权限或退出无痕模式。'}
      </p>
      <div className="about-box">
        <h2>关于这段寝室日常</h2>
        <p>
          在大学寝室里，服装与风格由室友自由选择。轻量关系扮演以双方自愿为前提，可随时退出，全局与角色两层许可均默认关闭。
        </p>
        <h2>你的数据，留在本地</h2>
        <p>
          当前自动保存寝室、室友、床位、天数及显示偏好。回忆存档支持五槽管理与
          JSON
          导入导出；存储异常时可下载应急备份并重试保存。清理浏览器数据或使用无痕模式可能造成数据丢失；本项目不提供云同步，不收集遥测数据。
        </p>
        <Link className="button" to="/saves">
          ✉ 管理回忆与备份
        </Link>
        <p className="quiet-note">
          首次联网打开生产版本后，等待“已准备好离线使用”即可断网继续。开发预览不启用离线缓存；应用更新前会先检查存档。
        </p>
      </div>
    </section>
  );
}
