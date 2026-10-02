import {normalizeFundsResponse} from '../../utils/normalizeFundsResponse';

describe('normalizeFundsResponse', () => {
  test('normalizes the live DefinEdge availableCash response', () => {
    const response = {
      availableCash: 10000,
      message: 'success',
      raw: {
        cash: '10000.00',
        marginUsed: '618.54',
      },
      status: 0,
      usedMargin: 618.54,
    };

    expect(normalizeFundsResponse(response)).toEqual({
      ...response,
      data: {
        ...response,
        availablecash: 10000,
      },
    });
  });

  test('preserves a valid zero balance', () => {
    expect(normalizeFundsResponse({availableCash: 0})).toEqual({
      availableCash: 0,
      data: {
        availableCash: 0,
        availablecash: 0,
      },
    });
  });

  test('falls back to raw cash when no normalized field is present', () => {
    expect(normalizeFundsResponse({status: 0, raw: {cash: '250.50'}})).toEqual({
      status: 0,
      raw: {cash: '250.50'},
      data: {
        status: 0,
        raw: {cash: '250.50'},
        availablecash: '250.50',
      },
    });
  });

  test.each([
    [{availablecash: '100.00'}, '100.00'],
    [{available_cash: 200}, 200],
    [{availableBalance: 300}, 300],
    [{cashAvailable: 400}, 400],
    [{equity: {available_margin: 500}}, 500],
  ])('normalizes known broker cash aliases', (payload, expected) => {
    expect(normalizeFundsResponse(payload)?.data?.availablecash).toBe(expected);
  });

  test('leaves the standard funds envelope unchanged', () => {
    const response = {status: 0, data: {availablecash: 1250}};

    expect(normalizeFundsResponse(response)).toBe(response);
  });

  test('normalizes a nested Dhan-style availableCash alias', () => {
    const response = {status: 0, data: {availableCash: '3400.75'}};

    expect(normalizeFundsResponse(response)).toEqual({
      status: 0,
      data: {availableCash: '3400.75', availablecash: '3400.75'},
    });
  });

  test('uses a top-level cash value when an adapter also returns metadata in data', () => {
    const response = {
      status: 0,
      availableCash: 975.5,
      data: {currency: 'INR'},
    };

    expect(normalizeFundsResponse(response)).toEqual({
      ...response,
      data: {currency: 'INR', availablecash: 975.5},
    });
  });

  test('leaves responses without a cash field unchanged', () => {
    const response = {status: 1, message: 'Session expired'};

    expect(normalizeFundsResponse(response)).toBe(response);
  });
});
