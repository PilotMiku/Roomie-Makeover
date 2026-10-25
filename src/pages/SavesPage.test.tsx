import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GAME } from '../data/constants';
import { createGame } from '../domain/initial';
import { exportArchive } from '../domain/saves';
import { loadGame, readSlots } from '../state/persistence';
import { useGame } from '../state/game';
import { SavesPage } from './SavesPage';

const locksDescriptor = Object.getOwnPropertyDescriptor(navigator, 'locks');
beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(GAME.storageKey, exportArchive(createGame(Date.now())));
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {} });
  useGame.setState({
    ...loadGame(localStorage, Date.now(), false),
    slots: readSlots(localStorage, Date.now(), false),
    generation: 0,
    notice: '',
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  if (locksDescriptor)
    Object.defineProperty(navigator, 'locks', locksDescriptor);
  else Reflect.deleteProperty(navigator, 'locks');
});
function renderSaves() {
  render(
    <MemoryRouter>
      <SavesPage />
    </MemoryRouter>,
  );
}
function jsonFile(raw: string) {
  const file = new File([raw], '回忆.json', { type: 'application/json' });
  // jsdom does not implement Blob.arrayBuffer; actual File reading is exercised in Chrome.
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => Uint8Array.from(new TextEncoder().encode(raw)).buffer,
  });
  return file;
}
it('shows five real slots and can create, rename and switch without sharing residents', async () => {
  const user = userEvent.setup();
  renderSaves();
  expect(screen.getAllByRole('region', { name: /^槽位/u })).toHaveLength(5);
  const second = within(screen.getByRole('region', { name: '槽位 2' }));
  await user.clear(second.getByLabelText('新故事名称'));
  await user.type(second.getByLabelText('新故事名称'), '樱桃小屋');
  await user.click(second.getByRole('button', { name: '创建新故事' }));
  expect(useGame.getState().activeSlot).toBe('slot-2');
  expect(useGame.getState().game.characters).toHaveLength(0);
  await user.clear(second.getByLabelText('存档名称'));
  await user.type(second.getByLabelText('存档名称'), '奶油小屋');
  await user.click(second.getByRole('button', { name: '保存名称' }));
  expect(second.getByRole('heading', { name: '奶油小屋' })).toBeVisible();
  await user.click(
    within(screen.getByRole('region', { name: '槽位 1' })).getByRole('button', {
      name: '进入该存档',
    }),
  );
  expect(useGame.getState().activeSlot).toBe('slot-1');
  expect(useGame.getState().game.characters).toHaveLength(4);
});
it('shows a validated import preview and does not overwrite or delete when confirmation is cancelled', async () => {
  const user = userEvent.setup();
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
  renderSaves();
  const before = localStorage.getItem(GAME.storageKey);
  const incoming = createGame(Date.now());
  incoming.name = '回来啦';
  await user.upload(
    screen.getByLabelText('选择 JSON 备份文件'),
    jsonFile(exportArchive(incoming)),
  );
  await waitFor(() =>
    expect(screen.getByRole('region', { name: '导入摘要' })).toBeVisible(),
  );
  await user.click(screen.getByRole('button', { name: '确认恢复到槽位 1' }));
  expect(confirm).toHaveBeenCalled();
  expect(localStorage.getItem(GAME.storageKey)).toBe(before);
  await user.click(
    within(screen.getByRole('region', { name: '槽位 1' })).getByRole('button', {
      name: '删除存档',
    }),
  );
  expect(localStorage.getItem(GAME.storageKey)).toBe(before);
  confirm.mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: '确认恢复到槽位 1' }));
  expect(useGame.getState().game.name).toBe('回来啦');
  expect(
    screen.queryByRole('region', { name: '导入摘要' }),
  ).not.toBeInTheDocument();
});
it('explains bad files and size errors while retaining the active archive', async () => {
  const user = userEvent.setup();
  renderSaves();
  const before = localStorage.getItem(GAME.storageKey);
  await user.upload(
    screen.getByLabelText('选择 JSON 备份文件'),
    jsonFile('{broken'),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('JSON 无法读取');
  expect(
    screen.queryByRole('region', { name: '导入摘要' }),
  ).not.toBeInTheDocument();
  const large = jsonFile(' '.repeat(2 * 1024 * 1024 + 1));
  await user.upload(screen.getByLabelText('选择 JSON 备份文件'), large);
  expect(await screen.findByRole('alert')).toHaveTextContent('2 MiB');
  expect(localStorage.getItem(GAME.storageKey)).toBe(before);
});
