import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
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
});
