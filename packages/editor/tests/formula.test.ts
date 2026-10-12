import { describe, expect, it } from 'vitest';
import { cellNumber, evaluateCell } from '../src/formula';

describe('table formulas', () => {
  const rows = [
    ['Item', 'Cost', 'Qty'],
    ['Tea', '2.50', '4'],
    ['Cake', '£1,000', '2'],
    ['', '', ''],
    ['Total', '=SUM(ABOVE)', '=SUM(C2:C3)'],
    ['Mean', '=AVERAGE(B2,B3)', '=B5/C5*2'],
    ['Bad', '=SUM(', '=B7'],
  ];
  it('add up, average and work with cells', () => {
    expect(cellNumber('12%')).toBe(0.12);
    expect(evaluateCell(rows, 4, 1)).toBe(1002.5);
    expect(evaluateCell(rows, 4, 2)).toBe(6);
    expect(evaluateCell(rows, 5, 1)).toBe(501.25);
    expect(evaluateCell(rows, 5, 2)).toBeCloseTo(334.1667, 3);
    expect(evaluateCell([['1', '2', '=SUM(LEFT)']], 0, 2)).toBe(3);
    expect(evaluateCell([['=MAX(B1:C1)', '7', '9']], 0, 0)).toBe(9);
    expect(evaluateCell([['=2^3+(1+1)*-2']], 0, 0)).toBe(4);
  });
  it("give null for what can't be worked out", () => {
    expect(evaluateCell(rows, 6, 1)).toBeNull();
    expect(evaluateCell(rows, 6, 2)).toBeNull();
    expect(evaluateCell([['=A1']], 0, 0)).toBeNull();
  });
});
