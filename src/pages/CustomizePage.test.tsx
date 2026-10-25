import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { createGame, createNewGame } from '../domain/initial';
import { useGame } from '../state/game';
import { CustomizePage } from './CustomizePage';

vi.mock('../components/PixelAvatar', () => ({
  PixelAvatar: () => <span>头像</span>,
}));
beforeEach(() => {
  localStorage.clear();
  useGame.setState({
    game: createNewGame(Date.now()),
    activeSlot: 'slot-1',
    raw: null,
    sourceRaw: null,
    revision: 0,
    status: 'ready',
    dirty: false,
    empty: true,
    generation: 0,
    notice: '',
  });
});
it('creates the university setup without age inputs or age confirmation controls', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter>
      <CustomizePage />
    </MemoryRouter>,
  );
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(screen.queryByText(/成年|18 岁/u)).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: '保存身份，布置寝室 →' }),
  );
  expect(useGame.getState().game.player.age).toBe(20);
  await user.click(
    screen.getByRole('button', { name: '保存寝室，认识室友 →' }),
  );
  await user.type(screen.getByLabelText('室友姓名'), '大学桃桃');
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('checkbox', { name: /18 岁/u }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '添加这位室友 ♡' }));
  expect(useGame.getState().game.characters[0]!.age).toBe(20);
  expect(useGame.getState().game.characters[0]!.name).toBe('大学桃桃');
});
it('preserves ages from an existing archive when editing a profile with no age setting', async () => {
  const user = userEvent.setup();
  const game = createGame(Date.now());
  game.player.age = 46;
  game.characters[0]!.age = 38;
  useGame.setState({ game, empty: false });
  render(
    <MemoryRouter>
      <CustomizePage />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole('button', { name: '保存玩家身份' }));
  expect(useGame.getState().game.player.age).toBe(46);
  await user.click(screen.getByRole('button', { name: /^03\s*室友档案$/u }));
  await user.click(screen.getByRole('button', { name: '林小满' }));
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  await user.clear(screen.getByLabelText('日常称呼'));
  await user.type(screen.getByLabelText('日常称呼'), '小满');
  await user.click(screen.getByRole('button', { name: '保存室友档案' }));
  expect(useGame.getState().game.characters[0]!.age).toBe(38);
  expect(useGame.getState().game.characters[0]!.address).toBe('小满');
});
