import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useChipInsertion } from '../useChipInsertion';

function setup(initialValue: string) {
  const onChange = vi.fn();
  const textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  const inputRef = { current: textarea };
  const { result, rerender } = renderHook(
    ({ value }: { value: string }) => useChipInsertion({ value, onChange, inputRef }),
    { initialProps: { value: initialValue } },
  );
  return { result, rerender, onChange, textarea };
}

describe('useChipInsertion', () => {
  it('replaces the value when the input is empty', () => {
    const { result, onChange } = setup('');
    act(() => result.current.insertChipText('Buscar vuelo a Madrid'));
    expect(onChange).toHaveBeenCalledWith('Buscar vuelo a Madrid');
  });

  it('replaces the value when the input is only whitespace', () => {
    const { result, onChange } = setup('   ');
    act(() => result.current.insertChipText('Hola'));
    expect(onChange).toHaveBeenCalledWith('Hola');
  });

  it('appends with a single space separator when the input has text', () => {
    const { result, onChange } = setup('Quiero ir a Madrid');
    act(() => result.current.insertChipText('en julio'));
    expect(onChange).toHaveBeenCalledWith('Quiero ir a Madrid en julio');
  });

  it('trims trailing whitespace before appending', () => {
    const { result, onChange } = setup('Hola   ');
    act(() => result.current.insertChipText('mundo'));
    expect(onChange).toHaveBeenCalledWith('Hola mundo');
  });

  it('does not throw when inputRef.current is null', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() =>
      useChipInsertion({ value: '', onChange, inputRef: { current: null } }),
    );
    expect(() => act(() => result.current.insertChipText('x'))).not.toThrow();
    expect(onChange).toHaveBeenCalledWith('x');
  });
});
