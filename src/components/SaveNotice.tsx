import { useGame } from '../state/game';
import { Link } from 'react-router-dom';
import { downloadJson } from './download';

function download(raw: string) {
  downloadJson(raw, 'Roomie-Makeover-original-backup.json');
}
export function SaveNotice() {
  const { game, status, raw, sourceRaw, dirty, retrySave } = useGame();
  if (status === 'ready') return null;
  return (
    <aside className="save-alert" role="alert">
      {!navigator.locks && (
        <p>
          当前环境无法安全保存存档，本次进度仅保留在内存中。请使用 HTTPS 或
          localhost 地址的现代浏览器；关闭前可下载当前进度备份。
        </p>
      )}
      <p>
        {status === 'invalid'
          ? '存档损坏或版本不受支持，原始数据已保留，操作已锁定。请下载原始备份，在支持此版本的应用恢复。'
          : status === 'conflict'
            ? '其他标签页已修改此存档，已阻止本页覆盖。请刷新载入最新存档后继续。'
            : '存储写入失败，当前进度仅在内存中。请检查站点存储权限或释放空间，勿关闭页面；可下载当前进度备份。'}
      </p>
      {(sourceRaw || raw) && (
        <button className="button" onClick={() => download(sourceRaw ?? raw!)}>
          下载未修改的原始备份
        </button>
      )}
      {status === 'conflict' && dirty && (
        <p>本页还有未保存的进度，刷新前请先下载当前进度备份。</p>
      )}
      {(status === 'unavailable' || (status === 'conflict' && dirty)) && (
        <>
          {status === 'unavailable' && (
            <button className="button" onClick={() => void retrySave()}>
              重试保存当前进度
            </button>
          )}
          <button
            className="button"
            onClick={() =>
              download(
                JSON.stringify({
                  revision: useGame.getState().revision,
                  commitId: 'recovery',
                  game,
                }),
              )
            }
          >
            下载当前进度备份
          </button>
        </>
      )}
      {status === 'conflict' && (
        <button className="button" onClick={() => window.location.reload()}>
          刷新载入最新存档
        </button>
      )}
      <Link className="button" to="/saves">
        前往回忆存档恢复
      </Link>
    </aside>
  );
}
