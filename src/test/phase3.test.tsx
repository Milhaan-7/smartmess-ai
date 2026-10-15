import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const go = async (hash: string) => {
  window.location.hash = hash;
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};
// MetricCard root only (Card sections and table headers can repeat the same words).
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

// Layout overflow itself cannot be measured in jsdom; scripts/check-overflow.py does that in a real browser.
describe('InfoTip', () => {
  it('is not in the DOM until used, then is fixed-position and clamped inside the viewport', async () => {
    const user = userEvent.setup();
    render(<App />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.tab(); // reach some control first
    const tip = within(card('Meals planned')).getByRole('button', { name: /^Definition:/ });
    await act(async () => tip.focus());
    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip.style.position).toBe('fixed');
    expect(parseFloat(tooltip.style.left)).toBeGreaterThanOrEqual(8);
    expect(parseFloat(tooltip.style.left) + parseFloat(tooltip.style.width)).toBeLessThanOrEqual(window.innerWidth);
    await act(async () => tip.blur());
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('Kitchen Operations units and totals', () => {
  it('labels every quantity column in portions and shows a kg totals row at one decimal', async () => {
    render(<App />);
    await go('#/kitchen-operations?date=2026-10-14&meal=dinner');
    const table = await screen.findByRole('table', { name: /Preparation plan/ });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent ?? '');
    for (const h of ['Predicted demand', 'Suggested prep', 'Final approved prep', 'Actually prepared', 'Consumed', 'Left over']) {
      expect(headers.find((x) => x.startsWith(h))).toMatch(/portions$/);
    }
    expect(within(table).getByRole('rowheader', { name: 'Total (kg)' })).toBeInTheDocument();
    expect(card('Suggested prep').textContent).toMatch(/\d+\.\d kg/);
  });

  it('shows the plan as incomplete, never as a partial total, when a quantity is blank', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/kitchen-operations?date=2026-10-14&meal=dinner');
    await user.click(await screen.findByRole('button', { name: /Accept all recommendations/ }));
    const before = card('Plan as currently entered').textContent ?? '';
    expect(before).toMatch(/\d+\.\d kg/);

    await user.clear(screen.getAllByLabelText(/final approved quantity/)[0]);
    const after = card('Plan as currently entered').textContent ?? '';
    expect(after).toContain('Incomplete');
    expect(after).toMatch(/2 of 3 quantities valid/);
    expect(after).not.toMatch(/\d+\.\d kg/);
    expect(screen.getByText('Plan incomplete')).toBeInTheDocument();
    const confirm = screen.getByRole('button', { name: /Fix 1 quantity to confirm/ });
    expect(confirm).toBeDisabled();
    expect(within(screen.getByRole('table', { name: /Preparation plan/ })).getAllByText('Incomplete').length).toBeGreaterThan(0);

    await user.type(screen.getAllByLabelText(/final approved quantity/)[0], '10');
    expect(card('Plan as currently entered').textContent).toMatch(/\d+\.\d kg/);
    expect(screen.queryByText('Plan incomplete')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm final plan/ })).toBeEnabled();
  });

  it('shows recorded leftover as incomplete until every prepared and consumed value is entered', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/kitchen-operations?date=2026-10-14&meal=lunch'); // approved
    expect(card('Recorded leftover').textContent).toContain('Incomplete');
    await user.click(await screen.findByRole('button', { name: /Fill prepared = approved/ }));
    const consumed = screen.getAllByLabelText(/quantity consumed/);
    for (const c of consumed.slice(0, -1)) await user.type(c, '1');
    expect(card('Recorded leftover').textContent).toContain('Incomplete');
    expect(card('Recorded leftover').textContent).toMatch(/\d+ of \d+ items entered/);
    await user.type(consumed[consumed.length - 1], '1');
    expect(card('Recorded leftover').textContent).toMatch(/\d+\.\d kg/);
  });
});

describe('kg precision is consistent', () => {
  it('uses one decimal on the Dashboard and Waste Analytics cards', async () => {
    render(<App />);
    expect(card('Estimated leftover today').textContent).toMatch(/\d+\.\d kg/);
    await go('#/waste-analytics');
    await screen.findByText('Total recorded leftover');
    expect(card('Total recorded leftover').textContent).toMatch(/\d+\.\d kg/);
  });
});
