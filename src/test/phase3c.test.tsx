import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import App from '../App';
import { api, setAuthToken } from '../services/apiClient';
import { createSeedState } from '../data/mockData';
import { DEMO_TODAY } from '../lib/constants';

const go = async (hash: string) => {
  window.location.hash = hash;
  await act(async () => {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
};

beforeEach(() => {
  window.location.hash = '#/';
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

describe('Phase 3C Role-Aware Kitchen Staff & Student Behavior', () => {
  it('renders recommended draft plans as read-only for kitchen staff', async () => {
    setAuthToken('demo-token-kitchen_staff');
    render(<App />);
    await go('#/kitchen-operations?date=2026-10-18&meal=dinner');
    
    expect(await screen.findByText('Awaiting Manager Approval — do not begin preparation from this draft.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm final plan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Accept all recommendations/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/final approved quantity/i)).not.toBeInTheDocument();
  });

  it('allows kitchen staff to log actual servings on approved plans', async () => {
    setAuthToken('demo-token-kitchen_staff');
    render(<App />);
    await go('#/kitchen-operations?date=2026-10-14&meal=lunch'); // seeded as approved
    
    expect(await screen.findByText('Plan Approved — Log Servings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fill prepared = approved/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save results/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revise plan/i })).not.toBeInTheDocument();
  });

  it('renders completed plans as read-only for kitchen staff', async () => {
    setAuthToken('demo-token-kitchen_staff');
    render(<App />);
    await go('#/kitchen-operations?date=2026-10-10&meal=lunch'); // seeded as completed
    
    expect(await screen.findByText('Service Logged — Read Only')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update results/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/quantity prepared/i)).not.toBeInTheDocument();
  });

  it('restricts students from seeing operational input controls', async () => {
    setAuthToken('demo-token-student');
    render(<App />);
    await go('#/menus');
    expect(await screen.findByRole('heading', { level: 1, name: 'Weekly Menus' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Menu/i })).not.toBeInTheDocument();
  });

  it('loads persisted menus for student after refresh without requesting manager/kitchen settings or records', async () => {
    setAuthToken('demo-token-student');
    vi.spyOn(api, 'getMe').mockResolvedValue({
      user: {
        uid: 'demo-student',
        email: 'student@smartmess.ai',
        name: 'Aarav Patel',
        role: 'student',
      },
      role: 'student',
    });
    const getSettingsSpy = vi.spyOn(api, 'getSettings');
    const getRecordsSpy = vi.spyOn(api, 'getRecords');
    const getMenusSpy = vi.spyOn(api, 'getMenus').mockResolvedValue([
      {
        id: 'persisted-student-menu-1',
        date: DEMO_TODAY,
        meal: 'lunch',
        items: [
          {
            id: 'persisted-item-1',
            name: 'Persisted Shahi Paneer',
            kgPerPortion: 0.18,
          },
        ],
      },
    ]);

    render(<App />);

    expect(await screen.findByText('Persisted Shahi Paneer')).toBeInTheDocument();
    expect(getMenusSpy).toHaveBeenCalledTimes(1);
    expect(getSettingsSpy).not.toHaveBeenCalled();
    expect(getRecordsSpy).not.toHaveBeenCalled();

    await go('#/menus');
    expect(await screen.findByText('Persisted Shahi Paneer')).toBeInTheDocument();
  });

  it('initializes student menu data cleanly when persisted menus are empty instead of keeping stale seed data', async () => {
    setAuthToken('demo-token-student');
    vi.spyOn(api, 'getMe').mockResolvedValue({
      user: {
        uid: 'demo-student',
        email: 'student@smartmess.ai',
        name: 'Aarav Patel',
        role: 'student',
      },
      role: 'student',
    });
    const getSettingsSpy = vi.spyOn(api, 'getSettings');
    const getRecordsSpy = vi.spyOn(api, 'getRecords');
    vi.spyOn(api, 'getMenus').mockResolvedValue([]);

    render(<App />);

    expect(await screen.findAllByText(/No menu published/i)).toHaveLength(3);
    expect(screen.queryByText('Paneer Butter Masala')).not.toBeInTheDocument();
    expect(getSettingsSpy).not.toHaveBeenCalled();
    expect(getRecordsSpy).not.toHaveBeenCalled();
  });

  it('preserves manager and kitchen_staff loading of settings, menus, and records', async () => {
    const seed = createSeedState();
    setAuthToken('demo-token-manager');
    vi.spyOn(api, 'getMe').mockResolvedValue({
      user: {
        uid: 'demo-manager',
        email: 'manager@smartmess.ai',
        name: 'Meera Krishnan',
        role: 'manager',
      },
      role: 'manager',
    });
    const getSettingsSpy = vi.spyOn(api, 'getSettings').mockResolvedValue(seed.settings);
    const getMenusSpy = vi.spyOn(api, 'getMenus').mockResolvedValue(seed.menus);
    const getRecordsSpy = vi.spyOn(api, 'getRecords').mockResolvedValue(seed.records);

    render(<App />);

    expect(await screen.findByRole('heading', { level: 1, name: /Welcome back, Meera/i })).toBeInTheDocument();
    expect(getSettingsSpy).toHaveBeenCalledTimes(1);
    expect(getMenusSpy).toHaveBeenCalledTimes(1);
    expect(getRecordsSpy).toHaveBeenCalledTimes(1);
  });
});


