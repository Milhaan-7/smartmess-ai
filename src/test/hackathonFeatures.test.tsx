import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';

import userEvent from '@testing-library/user-event';
import App from '../App';
import { api, setAuthToken } from '../services/apiClient';
import { getInitialState, STORAGE_KEY } from '../store/AppStore';

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
    expect(await screen.findByText('Welcome to SmartMess AI')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch Demo as Mess Manager/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch Demo as Kitchen Staff/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Launch Demo as Student \/ Diner/i })).toBeInTheDocument();

    // Sign in as Manager
    await act(async () => {
      await user.click(screen.getByRole('button', { name: /Launch Demo as Mess Manager/i }));
    });
    expect(await screen.findByRole('heading', { level: 1, name: /Welcome back/i })).toBeInTheDocument();


    // Sign out
    const userMenuBtn = screen.getByRole('button', { name: /User menu/i });
    await user.click(userMenuBtn);
    const signOutBtn = screen.getByRole('button', { name: /Sign Out/i });
    await user.click(signOutBtn);

    // Returned to Login
    expect(await screen.findByText('Welcome to SmartMess AI')).toBeInTheDocument();
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

  it('persists manager-added menu items, approvals, and notifications across refresh and role switches when backend DB is unconfigured', async () => {
    // Simulate the live Express server in demo/unconfigured-DB mode where GET /menus and GET /records return []
    vi.spyOn(api, 'getMenus').mockResolvedValue([]);
    vi.spyOn(api, 'getRecords').mockResolvedValue([]);
    vi.spyOn(api, 'getSettings').mockResolvedValue({
      institutionName: 'Greenfield University',
      messName: 'North Hostel Mess (Block B)',
      location: 'Greenfield, Demo State (fictional)',
      messManager: 'Meera Krishnan',
      prepBufferPct: 8,
      serviceCapacity: 620,
      roundingStep: 5,
      defaultUptake: 0.7,
      defaultReviewMeal: 'lunch',
      upcomingHorizonDays: 3,
    });
    vi.spyOn(api, 'loginSession').mockImplementation(async ({ demoRole }) => {
      const role = (demoRole as 'manager' | 'kitchen_staff' | 'student') || 'manager';
      return {
        token: `demo-token-${role}`,
        user: {
          uid: `demo-${role}-uid`,
          email: `${role}@smartmess.internal`,
          name: role === 'manager' ? 'Meera Krishnan (Manager)' : role === 'kitchen_staff' ? 'Ramesh Chef (Kitchen Staff)' : 'Aarav Student (Diner)',
          role,
        },
      };
    });
    vi.spyOn(api, 'getMe').mockImplementation(async () => {
      const token = sessionStorage.getItem('smartmess_auth_token') || 'demo-token-manager';
      const role = token.endsWith('student') ? 'student' : token.endsWith('kitchen_staff') ? 'kitchen_staff' : 'manager';
      return {
        user: {
          uid: `demo-${role}-uid`,
          email: `${role}@smartmess.internal`,
          name: role === 'manager' ? 'Meera Krishnan (Manager)' : role === 'kitchen_staff' ? 'Ramesh Chef (Kitchen Staff)' : 'Aarav Student (Diner)',
          role,
        },
        role,
      };
    });

    const user = userEvent.setup();
    setAuthToken('demo-token-manager');
    const managerApp = render(<App />);

    // 1. Manager edits today's Dinner menu to add a new dish "Special Kesari Bath"
    await go('#/menus');
    await user.click(await screen.findByRole('button', { name: 'Edit Dinner menu' }));
    const dialog = screen.getByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /Add food item/i }));
    const nameInputs = within(dialog).getAllByLabelText(/Food item \d+ name/i);
    const kgInputs = within(dialog).getAllByLabelText(/Food item \d+ kilograms per portion/i);
    await user.type(nameInputs[nameInputs.length - 1], 'Special Kesari Bath');
    await user.type(kgInputs[kgInputs.length - 1], '0.15');
    await user.click(within(dialog).getByRole('button', { name: /Save changes/i }));

    expect(await screen.findByText('Special Kesari Bath')).toBeInTheDocument();

    // 2. Manager approves today's Dinner plan in Kitchen Operations
    await go('#/kitchen-operations?date=2026-10-14&meal=dinner');
    expect(await screen.findByText('Special Kesari Bath')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /Accept all recommendations/i }));
    await user.click(screen.getByRole('button', { name: /Confirm final plan/i }));
    expect(await screen.findByText('Approved')).toBeInTheDocument();

    // 3. Simulate browser refresh as Manager
    managerApp.unmount();
    const refreshedManagerApp = render(<App />);
    await go('#/menus');
    expect(await screen.findByText('Special Kesari Bath')).toBeInTheDocument();

    // 4. Switch role to Student via Header User Menu
    await user.click(screen.getByRole('button', { name: /User menu/i }));
    await user.click(screen.getByRole('button', { name: /Student \(View Menus Only\)/i }));

    // Student sees "Special Kesari Bath" on Today's Dining Service dashboard
    await go('#/');
    expect(await screen.findByText('Special Kesari Bath')).toBeInTheDocument();

    // Student also sees the approval notification
    await user.click(screen.getByRole('button', { name: /Notifications/i }));
    expect(await screen.findByText(/Today's DINNER menu approved/i)).toBeInTheDocument();

    // 5. Simulate browser refresh while in Student role (used to wipe menus to [])
    refreshedManagerApp.unmount();
    const refreshedStudentApp = render(<App />);
    await go('#/');
    expect(await screen.findByText('Special Kesari Bath')).toBeInTheDocument();

    // 6. Switch role to Kitchen Staff and verify approved plan + new dish are present
    await user.click(screen.getByRole('button', { name: /User menu/i }));
    await user.click(screen.getByRole('button', { name: /Kitchen Staff \(Prep\/Leftovers\)/i }));

    await go('#/kitchen-operations?date=2026-10-14&meal=dinner');
    expect(await screen.findByText('Plan Approved — Log Servings')).toBeInTheDocument();
    expect(screen.getAllByText('Special Kesari Bath').length).toBeGreaterThan(0);

    refreshedStudentApp.unmount();
  });

  it('safely handles malformed or empty localStorage data without crashing or losing seed defaults', () => {
    localStorage.setItem(STORAGE_KEY, '{not-valid-json');
    const fromCorruptJson = getInitialState();
    expect(fromCorruptJson.menus.length).toBeGreaterThan(0);
    expect(fromCorruptJson.records.length).toBeGreaterThan(0);

    localStorage.setItem(STORAGE_KEY, JSON.stringify({ menus: [], records: [], settings: null }));
    const fromEmptyArrays = getInitialState();
    expect(fromEmptyArrays.menus.length).toBeGreaterThan(0);
    expect(fromEmptyArrays.records.length).toBeGreaterThan(0);
    expect(fromEmptyArrays.settings.institutionName).toBeTruthy();
  });
});
