import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it } from 'vitest';
import { App } from './App';
import { defaultPreferences, usePreferences } from './state/preferences';

beforeEach(() => {
  localStorage.clear();
  usePreferences.setState({
    preferences: { ...defaultPreferences },
    storageStatus: 'ready',
  });
});

it('navigates from the home page to the roadmap and settings', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/home']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    '室友大改造',
  );
  await user.click(screen.getByRole('link', { name: /看看入住计划/ }));
  expect(
    screen.getByRole('heading', { level: 1, name: '入住计划' }),
  ).toHaveFocus();
  expect(screen.getByText('单寝室、床位移动、六维与日结算')).toBeVisible();
  await user.click(screen.getByRole('link', { name: /偏好设置/ }));
  await user.click(screen.getByRole('checkbox', { name: /增强对比度/ }));
  expect(document.querySelector('.app-shell')).toHaveAttribute(
    'data-high-contrast',
    'true',
  );
});

it('provides an actionable storage failure message', () => {
  usePreferences.setState({ storageStatus: 'unavailable' });
  render(
    <MemoryRouter initialEntries={['/settings']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('status')).toHaveTextContent('检查站点存储权限');
});

it('recovers from an unknown hash route', async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/does-not-exist']}>
      <App />
    </MemoryRouter>,
  );
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    '这扇门后还没有房间',
  );
  await user.click(screen.getByRole('link', { name: /回到首页/ }));
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    '室友大改造',
  );
});
