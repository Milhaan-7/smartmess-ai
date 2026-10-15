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

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  window.location.hash = '#/';
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  const calls = errorSpy.mock.calls.map((c) => String(c[0]));
  errorSpy.mockRestore();
  cleanup();
  // Surface real React runtime problems (ignore the recharts zero-size warning in jsdom).
  expect(calls.filter((m) => !/width\(0\) and height\(0\)|ResponsiveContainer/.test(m))).toEqual([]);
});

describe('navigation', () => {
  it.each([
    ['#/', 'Welcome back, Meera'],
    ['#/forecasts', 'Forecasts'],
    ['#/menus', 'Menus'],
    ['#/kitchen-operations', 'Kitchen Operations'],
    ['#/waste-analytics', 'Waste Analytics'],
    ['#/settings', 'Settings'],
  ])('renders %s', async (hash, heading) => {
    render(<App />);
    await go(hash);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getAllByText(/synthetic/i).length).toBeGreaterThan(0);
  });

  it('switches pages from the sidebar', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(within(screen.getByRole('navigation', { name: 'Primary' })).getByRole('link', { name: 'Menus' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Menus' })).toBeInTheDocument();
  });
});

describe('dashboard', () => {
  it('shows metric cards, upcoming meals and the review button', async () => {
    render(<App />);
    expect(screen.getByText('Diners today')).toBeInTheDocument();
    expect(screen.getByText('Stored-forecast accuracy')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: /Upcoming meals/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Review next forecast/ })).toHaveAttribute('href', expect.stringContaining('forecasts'));
  });
});

describe('metric consistency across pages', () => {
  it('Dashboard accuracy card and default Waste Analytics MAE card use the same meals and numbers', async () => {
    render(<App />);
    const dash = screen.getByText('Stored-forecast accuracy').closest('div.rounded-xl')!.textContent ?? '';
    const d = { mae: dash.match(/MAE ([\d.]+) ·/)?.[1], baseline: dash.match(/baseline MAE ([\d.]+)/)?.[1], n: dash.match(/(\d+) meals/)?.[1] };
    await go('#/waste-analytics');
    const card = (await screen.findByText('Stored-forecast MAE')).closest('div.rounded-xl')!.textContent ?? '';
    const w = { mae: card.match(/(\d+\.\d+) diners/)?.[1], baseline: card.match(/Baseline MAE ([\d.]+)/)?.[1], n: card.match(/(\d+) meals/)?.[1] };
    expect(d.mae).toBeDefined();
    expect(w).toEqual(d);
    expect(Number(d.n)).toBe(42); // 14 days × 3 meals, all with a baseline
  });
});

describe('forecasts', () => {
  it('runs a deterministic forecast and marks inputs stale until re-run', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/forecasts?date=2026-10-15&meal=lunch');
    expect(await screen.findByText('Expected diners')).toBeInTheDocument();
    const first = screen.getByText('Expected diners').parentElement!.textContent;
    await user.selectOptions(screen.getByLabelText(/Planning context/), 'festival_holiday');
    expect(screen.getByText('Inputs changed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Run Forecast/ }));
    expect(screen.queryByText('Inputs changed')).not.toBeInTheDocument();
    expect(screen.getByText('Expected diners').parentElement!.textContent).not.toBe(first);
    await user.selectOptions(screen.getByLabelText(/Planning context/), 'normal');
    await user.click(screen.getByRole('button', { name: /Run Forecast/ }));
    expect(screen.getByText('Expected diners').parentElement!.textContent).toBe(first);
  });

  it('shows an empty state when there is no menu', async () => {
    render(<App />);
    await go('#/forecasts?date=2030-01-01&meal=lunch');
    expect(await screen.findByText('No menu for this meal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Forecast/ })).toBeDisabled();
  });
});

describe('menus', () => {
  it('validates, then creates a menu', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/menus');
    await user.click(screen.getByRole('button', { name: /Add Menu/ }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add menu' }));
    expect(within(dialog).getByText('Choose a meal')).toBeInTheDocument();
    expect(within(dialog).getByText('Enter a name')).toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText('Meal'), 'dinner');
    await user.type(within(dialog).getByLabelText('Food item 1 name'), 'Test Pulao');
    await user.type(within(dialog).getByLabelText('Food item 1 kilograms per portion'), '0.3');
    await user.click(within(dialog).getByRole('button', { name: 'Add menu' }));
    // today's dinner already exists in the seed data
    expect(within(dialog).getByText(/menu already exists/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Date'));
    await user.type(within(dialog).getByLabelText('Date'), '2026-12-01');
    await user.click(within(dialog).getByRole('button', { name: 'Add menu' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Test Pulao')).toBeInTheDocument();
  });

  it('blocks deleting a menu whose plan is approved or completed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/menus');
    await user.click(screen.getByRole('button', { name: 'Delete Breakfast menu' })); // completed
    expect(screen.getByRole('heading', { name: "This menu can't be deleted" })).toBeInTheDocument();
    expect(within(screen.getByRole('dialog')).queryByRole('button', { name: /Delete menu/ })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('button', { name: 'Delete Breakfast menu' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete Lunch menu' })); // approved
    expect(within(screen.getByRole('dialog')).getByText('approved')).toBeInTheDocument();
  });

  it('warns, then deletes a menu together with its unapproved forecast', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/menus');
    await user.click(screen.getByRole('button', { name: 'Delete Dinner menu' })); // recommended
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/awaiting approval\. It will be removed too/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete menu and forecast' }));
    expect(screen.queryByRole('button', { name: 'Delete Dinner menu' })).not.toBeInTheDocument();
    await go('#/kitchen-operations?date=2026-10-14&meal=dinner');
    expect(await screen.findByText('No menu for this meal')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: /Preparation plan/ })).not.toBeInTheDocument();
  });

  it('deletes a menu that has no plan after confirmation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/menus');
    await user.click(screen.getByRole('button', { name: /^2026-10-15,/ }));
    await user.click(screen.getByRole('button', { name: 'Delete Breakfast menu' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete menu' }));
    expect(screen.queryByRole('button', { name: 'Delete Breakfast menu' })).not.toBeInTheDocument();
  });

  it('locks date and meal when editing a menu that has a plan', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/menus');
    await user.click(screen.getByRole('button', { name: 'Edit Lunch menu' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Date')).toBeDisabled();
    expect(within(dialog).getByLabelText('Meal')).toBeDisabled();
  });
});

describe('kitchen operations', () => {
  it('requires review, confirms the plan, then records and saves results', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/kitchen-operations?date=2026-10-14&meal=dinner');
    const confirm = await screen.findByRole('button', { name: /Review \d+ more to confirm/ });
    expect(confirm).toBeDisabled();
    expect(screen.getByText('Awaiting approval')).toBeInTheDocument();

    // negative quantity is rejected
    const first = screen.getAllByLabelText(/final approved quantity/)[0];
    await user.clear(first);
    await user.type(first, '-4');
    expect(screen.getByText('Cannot be negative')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Accept all recommendations/ }));
    await user.click(screen.getByRole('button', { name: /Confirm final plan/ }));
    expect(await screen.findByText('Approved')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Fill prepared = approved/ }));
    const consumed = screen.getAllByLabelText(/quantity consumed/);
    for (const c of consumed) await user.type(c, '1');
    await user.type(screen.getByLabelText('Actual diners served'), '480');
    await user.click(screen.getByRole('button', { name: /Save results/ }));
    expect(await screen.findByText('Completed')).toBeInTheDocument();
    const toast = screen.getAllByRole('status').map((t) => t.textContent).find((t) => /Results saved/.test(t ?? '')) ?? '';
    expect(toast).toMatch(/Results saved/);
    expect(toast).not.toMatch(/Dashboard and Waste Analytics now include/);
  });

  it('does not allow results for a meal dated after the planning date', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/kitchen-operations?date=2026-10-16&meal=lunch');
    await user.click(await screen.findByRole('button', { name: 'Generate forecast' }));
    await user.click(await screen.findByRole('button', { name: /Accept all recommendations/ }));
    await user.click(screen.getByRole('button', { name: /Confirm final plan/ }));
    expect(await screen.findByText('Results can’t be recorded yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save results/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Actual diners served')).not.toBeInTheDocument();
    expect(screen.queryAllByLabelText(/quantity consumed/)).toHaveLength(0);
  });

  it('blocks consumed greater than prepared', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/kitchen-operations?date=2026-10-14&meal=lunch'); // seeded as approved
    const prepared = (await screen.findAllByLabelText(/quantity prepared/))[0];
    const consumed = screen.getAllByLabelText(/quantity consumed/)[0];
    await user.type(prepared, '10');
    await user.type(consumed, '20');
    expect(screen.getByText('More than prepared')).toBeInTheDocument();
  });
});

describe('waste analytics', () => {
  it('filters by meal and flags an invalid range', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/waste-analytics');
    expect(await screen.findByText('Total recorded leftover')).toBeInTheDocument();
    const before = screen.getByText(/completed meals in view/).textContent;
    await user.click(screen.getByRole('radio', { name: 'Lunch' }));
    expect(screen.getByText(/completed meals in view/).textContent).not.toBe(before);
    fireInputDate(screen.getByLabelText('From'), '2026-12-01');
    expect(await screen.findByText(/No completed meals match/)).toBeInTheDocument();
  });
});

describe('settings', () => {
  it('validates and saves preferences', async () => {
    const user = userEvent.setup();
    render(<App />);
    await go('#/settings');
    const buffer = await screen.findByLabelText(/Default preparation buffer/);
    await user.clear(buffer);
    await user.type(buffer, '99');
    await user.click(screen.getByRole('button', { name: /Save preferences/ }));
    expect(screen.getByText('Enter 0 to 50')).toBeInTheDocument();
    await user.clear(buffer);
    await user.type(buffer, '12');
    await user.click(screen.getByRole('button', { name: /Save preferences/ }));
    expect(await screen.findByText(/Preferences saved for this session/)).toBeInTheDocument();
  });
});

function fireInputDate(el: HTMLElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
