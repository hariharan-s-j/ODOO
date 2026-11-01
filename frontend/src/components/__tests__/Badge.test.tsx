import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { Badge } from '../Badge';

describe('Badge Component', () => {
  it('renders status text correctly', () => {
    render(<Badge status="ACTIVE" />);
    expect(screen.getByText('ACTIVE')).toBeDefined();
  });

  it('renders overdue badge with overdue styling', () => {
    render(<Badge status="OVERDUE" />);
    const badge = screen.getByText('OVERDUE');
    expect(badge.className).toContain('text-red-800');
  });

  it('renders role badge for admin', () => {
    render(<Badge status="ADMIN" />);
    const badge = screen.getByText('ADMIN');
    expect(badge.className).toContain('text-indigo-800');
  });
});
