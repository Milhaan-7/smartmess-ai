import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { createSeedState } from '../data/mockData';
import { getTodaySummary } from '../services/planningService';
import { DEMO_TODAY } from '../lib/constants';

const go = async (hash: string) => {
  window.location.hash = hash;
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};
const card = (label: string) =>
  screen.getAllByText(label).map((el) => el.closest('div.rounded-xl.p-4')).find((el): el is HTMLElement => el !== null)!;

beforeEach(() => {
  window.location.hash = '#/';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('Waste Analytics', () => {
  it('lists meals within a day in service order, latest first (dinner, lunch, breakfast)', async () => {
    render(<App />);
    await go('#/waste-analytics');
    const table = await screen.findByRole('table', { name: /Past meal records/ });
    const rows = within(table).getAllByRole('row').slice(1, 7);
    const cells = rows.map((r) => within(r).getAllByRole('cell').slice(0, 2).map((c) => c.textContent));
    expect(cells.slice(0, 3).map((c) => c[1])).toEqual(['Dinner', 'Lunch', 'Breakfast']);
    expect(cells[0][0]).toBe(cells[2][0]); // same date
    expect(cells[3][0]).not.toBe(cells[0][0]); // then the previous day
  });

  it('keeps keyboard focus on a sort button after sorting', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/waste-analytics');
    const before = await screen.findAllByText('Sort by Waste rate', { selector: 'button' }).catch(() => []);
    void before;
    const button = await screen.findByRole('button', { name: 'Sort by Waste rate' });
    button.focus();
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(button);
    expect(document.body.contains(button)).toBe(true); // same element, not remounted
    await user.keyboard('{Enter}');
    expect(document.activeElement).toBe(button);
  });
});

describe('Menus calendar', () => {
  it('moves to the saved menu’s month and shows the selected day', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/menus');
    expect(screen.getByRole('heading', { level: 3, name: 'October 2026' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add Menu/ }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Date'));
    await user.type(within(dialog).getByLabelText('Date'), '2026-12-01');
    await user.selectOptions(within(dialog).getByLabelText('Meal'), 'dinner');
    await user.type(within(dialog).getByLabelText('Food item 1 name'), 'Test Pulao');
    await user.type(within(dialog).getByLabelText('Food item 1 kilograms per portion'), '0.3');
    await user.click(within(dialog).getByRole('button', { name: 'Add menu' }));
    expect(await screen.findByRole('heading', { level: 3, name: 'December 2026' })).toBeInTheDocument();
    const selected = document.querySelector('button[aria-pressed="true"]') as HTMLElement;
    expect(selected.getAttribute('aria-label')).toMatch(/^2026-12-01,/);
  });

  it('still lets the user browse months without changing the selection', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/menus');
    await user.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.getByRole('heading', { level: 3, name: 'November 2026' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /14 October 2026/ })).toBeInTheDocument();
  });
});

describe('wording', () => {
  it('Forecasts page says “completed lunch meals”, not “lunchs”', async () => {
    render(<App />);
    await go('#/forecasts?date=2026-10-15&meal=lunch');
    expect(await screen.findByText('completed lunch meals')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/lunchs/);
    expect(document.body.textContent).toMatch(/lunches ran/); // factor descriptions use the same plural
  });

  it('Dashboard states how many diners are recorded vs forecast', () => {
    const s = createSeedState();
    const t = getTodaySummary(s, DEMO_TODAY);
    const breakfast = s.records.find((r) => r.date === DEMO_TODAY && r.meal === 'breakfast')!;
    expect(t.recordedDiners).toBe(breakfast.actualDiners);
    expect(t.forecastDiners).toBe(
      s.records.filter((r) => r.date === DEMO_TODAY && r.meal !== 'breakfast').reduce((a, r) => a + r.predictedDiners, 0),
    );
    render(<App />);
    expect(screen.queryByText('Expected diners today')).not.toBeInTheDocument();
    const c = card('Diners today').textContent ?? '';
    const fmt = (n: number) => n.toLocaleString('en-IN');
    expect(c).toContain(fmt(t.recordedDiners + t.forecastDiners));
    expect(c).toContain(`${fmt(t.recordedDiners)} recorded + ${fmt(t.forecastDiners)} forecast`);
  });
});
