import { render, screen } from '@testing-library/preact';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SearchBox } from '../src/index.ts';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const setup = () => {
  const onChange = vi.fn();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<SearchBox onChange={onChange} debounceMs={150} placeholder="q" />);
  return { onChange, user, input: screen.getByPlaceholderText('q') as HTMLInputElement };
};

describe('SearchBox', () => {
  test('debounces onChange calls', async () => {
    const { onChange, user, input } = setup();
    await user.type(input, 'home');
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(150);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith('home');
  });

  test('does not fire onChange while composing (IME)', async () => {
    const { onChange, input } = setup();
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    input.value = 'カ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(onChange).not.toHaveBeenCalled();
    input.dispatchEvent(new CompositionEvent('compositionend'));
    vi.advanceTimersByTime(150);
    expect(onChange).toHaveBeenCalledWith('カ');
  });

  test('respects initialValue on first render', () => {
    const onChange = vi.fn();
    render(<SearchBox initialValue="seed" onChange={onChange} placeholder="q" />);
    expect(screen.getByPlaceholderText<HTMLInputElement>('q').value).toBe('seed');
  });
});
