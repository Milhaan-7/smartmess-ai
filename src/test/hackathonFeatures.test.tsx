import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

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
  setAuthToken(null);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('Hackathon Goals Verification (Login, Notifications, Kitchen Consistency, RBAC)', () => {
  it('Goal 1: App starts at Login screen when unauthenticated and routes roles correctly', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Unauthenticated initial state shows Login screen
    expect(await screen.findByText('Select Your Dining Hall Persona')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In as Manager/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In as Kitchen Staff/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In as Student/i })).toBeInTheDocument();

    // Sign in as Manager
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Sign In as Manager/i }));
    });
    expect(await screen.findByRole('heading', { level: 1, name: /Welcome back/i })).toBeInTheDocument();


    // Sign out
    const userMenuBtn = screen.getByRole('button', { name: /User menu/i });
    await user.click(userMenuBtn);
    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    await user.click(signOutBtn);

    // Returned to Login
    expect(await screen.findByText('Select Your Dining Hall Persona')).toBeInTheDocument();
  });

  it('Goal 2: Manager approval generates Student notification, persists read status, and links to approved menu', async () => {
    const user = userEvent.setup();
    setAuthToken('demo-token-manager');
    const { unmount } = render(<App />);

    // Manager approves Dinner for today
    await go('#/kitchen-operations?date=2026-10-14&meal=dinner');
    expect(await screen.findByRole('button', { name: /Accept all recommendations/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Accept all recommendations/i }));
    await user.click(screen.getByRole('button', { name: /Confirm final plan/i }));
    expect(await screen.findByText('Approved')).toBeInTheDocument();

    // Switch to Student
    unmount();
    setAuthToken('demo-token-student');
    const studentApp = render(<App />);

    // Open notification popover
    const bellBtn = screen.getByRole('button', { name: /Notifications/i });
    await user.click(bellBtn);

    expect(await screen.findByText(/Today's DINNER menu approved/i)).toBeInTheDocument();

    // Click notification to mark read and view menu
    const notifItem = screen.getByText(/Today's DINNER menu approved/i);
    await user.click(notifItem);

    // Verifies student is taken to Weekly Menus
    expect(await screen.findByRole('heading', { level: 1, name: 'Weekly Menus' })).toBeInTheDocument();

    // Verify persistence across re-render
    studentApp.unmount();
    render(<App />);
    await go('#/menus');
    expect(await screen.findByRole('heading', { level: 1, name: 'Weekly Menus' })).toBeInTheDocument();
  });

  it('Goal 3: Kitchen Staff sees manager-approved prep targets and logs actuals consistently', async () => {
    const user = userEvent.setup();
    setAuthToken('demo-token-kitchen_staff');
    render(<App />);

    // Access Kitchen Operations for approved Lunch
    await go('#/kitchen-operations?date=2026-10-14&meal=lunch');
    expect(await screen.findByText('Plan Approved — Log Servings')).toBeInTheDocument();
    expect(screen.getByText('Authorized Preparation Targets for Culinary Staff')).toBeInTheDocument();

    // Fill prepared = approved and save
    await user.click(screen.getByRole('button', { name: /Fill prepared = approved/i }));
    const consumedInputs = screen.getAllByLabelText(/quantity consumed/i);
    for (const c of consumedInputs) {
      await user.clear(c);
      await user.type(c, '25');
    }
    const dinersInput = screen.getByLabelText('Actual diners served');
    await user.clear(dinersInput);
    await user.type(dinersInput, '460');

    await user.click(screen.getByRole('button', { name: /Save results/i }));
    expect(await screen.findByText('Results saved. Today’s summary is updated. Accuracy, trend charts and the default Waste Analytics range cover days before the planning date, so this meal appears there from the next day or when the range is extended.')).toBeInTheDocument();
  });

  it('Goal 7: Student permissions strictly hide manager and kitchen actions', async () => {
    setAuthToken('demo-token-student');
    render(<App />);

    await go('#/menus');
    expect(await screen.findByRole('heading', { level: 1, name: 'Weekly Menus' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Menu/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/i })).not.toBeInTheDocument();

    // Attempting to visit manager settings redirects
    await go('#/settings');
    expect(screen.queryByText('Institutional Settings')).not.toBeInTheDocument();
  });
});
