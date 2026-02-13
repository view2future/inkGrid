import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from './App';

describe('App Component', () => {
  it('renders correctly', () => {
    render(<App />);
    // Vite 默认模板通常有 "Vite + React" 标题
    expect(screen.getByText(/Vite \+ React/i)).toBeDefined();
  });
});
