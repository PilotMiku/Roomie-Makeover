import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { createGame } from '../domain/initial';
import { useGame } from '../state/game';
import { RoomPage } from './RoomPage';
import { queuedEvent } from '../test/eventGame';
import { multiRoomGame } from '../test/multiRoom';
import { customizeGame } from '../domain/customize';

// Canvas compositing is verified in the real browser flow; this tests controls.
vi.mock('../components/PixelAvatar', () => ({
  PixelAvatar: () => <span>头像</span>,
}));
beforeEach(() => {
  localStorage.clear();
  useGame.setState({
    game: createGame(Date.now()),
    raw: null,
    revision: 0,
    status: 'ready',
    activeSlot: 'slot-1',
    sourceRaw: null,
    dirty: false,
    empty: false,
    generation: 0,
    notice: '',
  });
});
function renderRoom() {
  render(
    <MemoryRouter>
      <RoomPage />
    </MemoryRouter>,
  );
}

it('selects a resident, swaps through a keyboard-compatible form, and advances a day', async () => {
  const user = userEvent.setup();
  renderRoom();
  await user.click(screen.getByRole('button', { name: '许知夏' }));
  await user.selectOptions(
    screen.getByLabelText('为许知夏分配床位'),
    'room-101-bed-1',
  );
  await user.click(screen.getByRole('button', { name: '分配 / 交换' }));
  expect(useGame.getState().game.characters[1]!.bedId).toBe('room-101-bed-1');
  await user.click(screen.getByRole('button', { name: /进入下一天/ }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    '第 2 天',
  );
  expect(screen.getByText(/许知夏 · 第 1 天结算/)).toBeVisible();
  expect(
    within(screen.getByRole('complementary', { name: '室友手记' })).getByText(
      '默契值',
    ),
  ).toBeVisible();
  expect(screen.queryByText('听话值')).not.toBeInTheDocument();
});
it('exposes separate upper/lower targets and allows click-to-swap', async () => {
  const user = userEvent.setup();
  renderRoom();
  await user.click(screen.getByRole('button', { name: '双层床' }));
  const target = screen.getByRole('button', { name: /1 号下铺：许知夏/ });
  expect(target).toBeVisible();
  await user.click(target);
  expect(useGame.getState().game.characters[0]!.bedId).toBe('room-101-bed-2');
});
it('locks destructive writes and offers raw recovery for unrecognized data', () => {
  useGame.setState({ status: 'invalid', raw: '{bad-original' });
  renderRoom();
  expect(screen.getByRole('alert')).toHaveTextContent('原始数据已保留');
  expect(screen.getByRole('button', { name: /进入下一天/ })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: '下载未修改的原始备份' }),
  ).toBeEnabled();
});

it('offers memory backup before refreshing a conflicting tab with unsaved progress', () => {
  useGame.setState({ status: 'conflict', dirty: true });
  renderRoom();
  expect(screen.getByRole('alert')).toHaveTextContent('本页还有未保存的进度');
  expect(
    screen.getByRole('button', { name: '下载当前进度备份' }),
  ).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: '重试保存当前进度' }),
  ).not.toBeInTheDocument();
});

it('filters across rooms, locates a roommate and migrates to an empty bed without advancing the day', async () => {
  const user = userEvent.setup();
  const game = customizeGame(
    multiRoomGame(Date.now(), [4, 6]),
    {
      type: 'room-create',
      input: {
        name: '粉色新房',
        capacity: 4,
        bedType: 'bunk',
        facilities: { bathroom: 'shared', dryWet: false },
      },
    },
    Date.now(),
  ).game;
  useGame.setState({ game });
  renderRoom();
  await user.click(screen.getByText(/全体室友 · 10/u));
  await user.selectOptions(
    screen.getByLabelText('按寝室筛选'),
    game.rooms[1]!.id,
  );
  const actor = game.characters[4]!;
  await user.click(
    screen.getByRole('button', {
      name: `查看${actor.name}的档案 · ${game.rooms[1]!.name}`,
    }),
  );
  expect(
    screen.getByRole('heading', { name: game.rooms[1]!.name }),
  ).toBeVisible();
  await user.selectOptions(
    screen.getByLabelText(`${actor.name}的目标寝室`),
    game.rooms[2]!.id,
  );
  await user.selectOptions(
    screen.getByLabelText('目标空床'),
    game.rooms[2]!.beds[0]!.id,
  );
  await user.click(screen.getByRole('button', { name: '确认搬家' }));
  expect(
    await screen.findByRole('heading', { name: '粉色新房' }),
  ).toBeVisible();
  expect(
    useGame
      .getState()
      .game.characters.find((resident) => resident.id === actor.id),
  ).toEqual({
    ...actor,
    roomId: game.rooms[2]!.id,
    bedId: game.rooms[2]!.beds[0]!.id,
  });
  expect(useGame.getState().game.day).toBe(game.day);
});

it('gives real interaction feedback, enforces per-character caps and resets after settlement', async () => {
  const user = userEvent.setup();
  renderRoom();
  const panel = screen.getByRole('region', { name: '和林小满的日常' });
  for (let index = 0; index < 3; index++)
    await user.click(within(panel).getByRole('button', { name: '聊聊今天' }));
  expect(
    within(panel).getByRole('button', { name: '聊聊今天' }),
  ).toBeDisabled();
  expect(panel).toHaveTextContent('普通互动 3 / 3');
  await user.click(within(panel).getByRole('button', { name: '送出礼物 ♡' }));
  expect(
    within(panel).getByRole('button', { name: '送出礼物 ♡' }),
  ).toBeDisabled();
  expect(panel).toHaveTextContent('心意点 16');
  expect(panel).toHaveTextContent('实际变化');
  await user.click(screen.getByRole('button', { name: /进入下一天/ }));
  expect(panel).toHaveTextContent('普通互动 0 / 3');
  expect(
    screen.getByRole('table', { name: '第 1 天实际增减来源' }),
  ).toHaveTextContent('互动');
});

it('keeps branch rewards pending when closing and only applies a chosen outcome once', async () => {
  const user = userEvent.setup();
  const game = queuedEvent('ribbon-studio', Date.now());
  useGame.setState({ game });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
  renderRoom();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '查看「缎带小舞台」' }));
  await user.click(screen.getByRole('button', { name: '稍后再说（不结算）' }));
  expect(useGame.getState().game.wallet).toEqual(game.wallet);
  expect(useGame.getState().game.pendingEvents).toEqual(game.pendingEvents);
  await user.click(screen.getByRole('button', { name: '查看「缎带小舞台」' }));
  await user.click(
    screen.getByRole('button', { name: '选择：自愿尝试新造型' }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(useGame.getState().game.wallet.tokens).toBe(game.wallet.tokens - 2);
  expect(useGame.getState().game.wardrobe.unlockedIds).toContain('lace-shirt');
  expect(
    screen.queryByRole('button', { name: '查看「缎带小舞台」' }),
  ).not.toBeInTheDocument();
  vi.restoreAllMocks();
});
