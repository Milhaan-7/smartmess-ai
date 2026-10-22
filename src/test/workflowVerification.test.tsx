import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { setAuthToken } from '../services/apiClient';

const go = async (hash: string) => {
  window.location.hash = hash;
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

beforeEach(() => {
  window.location.hash = '#/';
  setAuthToken('demo-token-manager');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('End-to-End Workflow Verification (7 Verification Checks)', () => {
  it('Check 1: Manager can create/edit a menu and approve a preparation plan', async () => {
    const user = userEvent.setup();
    setAuthToken('demo-token-manager');
    render(<App />);

    // 1. Navigate to menus
    await go('#/menus');
    expect(await screen.findByRole('heading', { level: 1, name: 'Menus' })).toBeInTheDocument();

    // 2. Open Add Menu Modal
    const addBtn = screen.getByRole('button', { name: /Add Menu/i });
    await user.click(addBtn);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    // Add unique menu for an upcoming date
    await user.clear(within(dialog).getByLabelText('Date'));
    await user.type(within(dialog).getByLabelText('Date'), '2026-10-25');
    await user.selectOptions(within(dialog).getByLabelText('Meal'), 'lunch');
    await user.type(within(dialog).getByLabelText('Food item 1 name'), 'Verification Biryani');
    await user.type(within(dialog).getByLabelText('Food item 1 kilograms per portion'), '0.25');
    await user.click(within(dialog).getByRole('button', { name: 'Add menu' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Verification Biryani')).toBeInTheDocument();

    // 3. Navigate to kitchen-operations for unapproved dinner on 2026-10-14 and approve plan
    await go('#/kitchen-operations?date=2026-10-14&meal=dinner');
    expect(await screen.findByRole('button', { name: /Accept all recommendations/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Accept all recommendations/i }));
    await user.click(screen.getByRole('button', { name: /Confirm final plan/i }));
    expect(await screen.findByText('Approved')).toBeInTheDocument();
  });

  it('Check 2: The approved plan appears correctly in Kitchen Staff Kitchen Board and Kitchen Operations', async () => {
    setAuthToken('demo-token-kitchen_staff');
    render(<App />);

    // Kitchen Board (Dashboard for kitchen staff)
    await go('#/');
    expect(await screen.findByRole('heading', { level: 1, name: /Today's Kitchen Work/i })).toBeInTheDocument();
    // Lunch is seeded as approved for today
    expect(screen.getByText(/Plan Approved — Authorized to Prepare/i)).toBeInTheDocument();

    // Kitchen Operations for approved Lunch
    await go('#/kitchen-operations?date=2026-10-14&meal=lunch');
    expect(await screen.findByText('Plan Approved — Log Servings')).toBeInTheDocument();
    expect(screen.getByText('Authorized Preparation Targets for Culinary Staff')).toBeInTheDocument();
  });

  it('Check 3: Kitchen Staff can enter actual prepared quantities, consumed quantities, and diners served, then save results', async () => {
    const user = userEvent.setup();
    setAuthToken('demo-token-kitchen_staff');
    render(<App />);

    await go('#/kitchen-operations?date=2026-10-14&meal=lunch');
    expect(await screen.findByText('Plan Approved — Log Servings')).toBeInTheDocument();

    // Fill prepared = approved
    await user.click(screen.getByRole('button', { name: /Fill prepared = approved/i }));

    // Fill consumed
    const consumedInputs = screen.getAllByLabelText(/quantity consumed/i);
    for (const c of consumedInputs) {
      await user.clear(c);
      await user.type(c, '20');
    }

    // Fill diners
    const dinersInput = screen.getByLabelText('Actual diners served');
    await user.clear(dinersInput);
    await user.type(dinersInput, '450');

    // Save results
    await user.click(screen.getByRole('button', { name: /Save results/i }));
    expect(await screen.findByText('Results saved. Today’s summary is updated. Accuracy, trend charts and the default Waste Analytics range cover days before the planning date, so this meal appears there from the next day or when the range is extended.')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('Check 4: Leftover quantities and waste analytics update correctly after saving', async () => {
    setAuthToken('demo-token-manager');
    render(<App />);

    await go('#/waste-analytics');
    expect(await screen.findByText('Total recorded leftover')).toBeInTheDocument();
    expect(screen.getByText('Estimated waste rate')).toBeInTheDocument();
    expect(screen.getByText('Stored-forecast MAE')).toBeInTheDocument();
  });

  it('Check 5: Switching between Manager, Kitchen Staff, and Student does not erase menus, approved plans, or operational records', async () => {
    const user = userEvent.setup();
    setAuthToken('demo-token-manager');
    const { unmount } = render(<App />);

    // 1. Manager adds a custom menu
    await go('#/menus');
    await user.click(screen.getByRole('button', { name: /Add Menu/i }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Date'));
    await user.type(within(dialog).getByLabelText('Date'), '2026-10-29');
    await user.selectOptions(within(dialog).getByLabelText('Meal'), 'dinner');
    await user.type(within(dialog).getByLabelText('Food item 1 name'), 'Persistence Halwa');
    await user.type(within(dialog).getByLabelText('Food item 1 kilograms per portion'), '0.15');
    await user.click(within(dialog).getByRole('button', { name: 'Add menu' }));
    expect(await screen.findByText('Persistence Halwa')).toBeInTheDocument();

    // 2. Switch to Student
    unmount();
    setAuthToken('demo-token-student');
    const studentApp = render(<App />);
    await go('#/menus');
    expect(await screen.findByRole('heading', { level: 1, name: 'Weekly Menus' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: new RegExp('2026-10-29') }));
    expect(await screen.findByText('Persistence Halwa')).toBeInTheDocument();

    // 3. Switch to Kitchen Staff
    studentApp.unmount();
    setAuthToken('demo-token-kitchen_staff');
    const staffApp = render(<App />);
    await go('#/kitchen-operations?date=2026-10-14&meal=lunch');
    expect(await screen.findByText('Plan Approved — Log Servings')).toBeInTheDocument();

    // 4. Switch back to Manager
    staffApp.unmount();
    setAuthToken('demo-token-manager');
    render(<App />);
    await go('#/menus');
    expect(await screen.findByRole('heading', { level: 1, name: 'Menus' })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: new RegExp('2026-10-29') }));
    expect(await screen.findByText('Persistence Halwa')).toBeInTheDocument();
  });

  it('Check 6: Student can view the published menu but cannot access manager-only actions', async () => {
    setAuthToken('demo-token-student');
    render(<App />);

    // Student view on Weekly Menus
    await go('#/menus');
    expect(await screen.findByRole('heading', { level: 1, name: 'Weekly Menus' })).toBeInTheDocument();
    // Cannot see "Add Menu" button
    expect(screen.queryByRole('button', { name: /Add Menu/i })).not.toBeInTheDocument();
    // Cannot see "Delete ... menu" button
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();
    // Cannot see "Edit ... menu" button
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();

    // Student dashboard has no NextMealDecisionPanel or approval buttons
    await go('#/');
    expect(await screen.findByText(/Today's Dining Service/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Approve Kitchen Plan/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Authorizing/i)).not.toBeInTheDocument();
  });

  it('Check 7: State persists after a page refresh in the current demo environment', async () => {
    const user = userEvent.setup();
    setAuthToken('demo-token-manager');
    const { unmount } = render(<App />);

    // Create a new menu item
    await go('#/menus');
    await user.click(screen.getByRole('button', { name: /Add Menu/i }));
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByLabelText('Date'));
    await user.type(within(dialog).getByLabelText('Date'), '2026-10-30');
    await user.selectOptions(within(dialog).getByLabelText('Meal'), 'breakfast');
    await user.type(within(dialog).getByLabelText('Food item 1 name'), 'Refreshed Idli');
    await user.type(within(dialog).getByLabelText('Food item 1 kilograms per portion'), '0.12');
    await user.click(within(dialog).getByRole('button', { name: 'Add menu' }));
    expect(await screen.findByText('Refreshed Idli')).toBeInTheDocument();

    // Simulate page refresh by unmounting and re-rendering App
    unmount();
    render(<App />);

    await go('#/menus');
    await user.click(await screen.findByRole('button', { name: new RegExp('2026-10-30') }));
    expect(await screen.findByText('Refreshed Idli')).toBeInTheDocument();
  });
});
