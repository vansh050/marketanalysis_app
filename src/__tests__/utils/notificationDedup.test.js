import dedupeNotificationFeed, {
  countUnreadNotifications,
  dedupeNotificationSymbols,
  formatNotificationSymbol,
} from '../../utils/notificationDedup';

const makeNotification = (id, date, message = 'GLAND Recommendation - BUY range 2405-2411') => ({
  _id: id,
  insertedAt: date,
  inAppNotifications: [
    {
      title: 'We have pushed GLAND recommendation',
      message,
      notificationType: 'news_alert',
      date,
    },
  ],
});

describe('dedupeNotificationSymbols', () => {
  it('collapses repeated recipient rows for the same recommendation instrument', () => {
    const repeated = {
      symbol: 'SUNPHARMA29SEP26',
      searchSymbol: 'SUNPHARMA29SEP26',
      exchange: 'NFO',
      strike: '1840.0',
      optionType: 'PE',
      price: 12.5,
      orderType: 'LIMIT',
    };
    expect(dedupeNotificationSymbols(Array(160).fill(repeated))).toEqual([repeated]);
  });

  it('retains genuinely different instruments', () => {
    const rows = [
      {symbol: 'A', exchange: 'NSE', price: 10},
      {symbol: 'B', exchange: 'NSE', price: 20},
    ];
    expect(dedupeNotificationSymbols(rows)).toEqual(rows);
  });
});

describe('formatNotificationSymbol', () => {
  it('hides the legacy Order sentinel on futures', () => {
    expect(formatNotificationSymbol({
      searchSymbol: 'SUNPHARMA29SEP26FUT',
      exchange: 'NFO',
      strike: 'Order',
      optionType: 'FUT',
    })).toBe('SUNPHARMA29SEP26FUT');
  });

  it('keeps option strike and type details', () => {
    expect(formatNotificationSymbol({
      searchSymbol: 'SUNPHARMA29SEP26',
      exchange: 'NFO',
      strike: '1840.0',
      optionType: 'PE',
    })).toBe('SUNPHARMA29SEP26 | 1840.0 | PE');
  });
});

describe('dedupeNotificationFeed', () => {
  it('keeps only the newest notification from a rapid duplicate burst', () => {
    const rows = [
      makeNotification('1', '2026-07-27T04:30:11.658Z'),
      makeNotification('2', '2026-07-27T04:30:14.839Z'),
      makeNotification('3', '2026-07-27T04:30:38.525Z'),
    ];

    const result = dedupeNotificationFeed(rows);

    expect(result).toHaveLength(1);
    expect(result[0]._id).toBe('3');
  });

  it('retains the same notification when it is intentionally sent later', () => {
    const rows = [
      makeNotification('1', '2026-07-27T04:30:00.000Z'),
      makeNotification('2', '2026-07-27T06:30:00.000Z'),
    ];

    expect(dedupeNotificationFeed(rows)).toHaveLength(2);
  });

  it('retains notifications with different content inside the dedupe window', () => {
    const rows = [
      makeNotification('1', '2026-07-27T04:30:00.000Z'),
      makeNotification(
        '2',
        '2026-07-27T04:30:10.000Z',
        'GLAND Recommendation - BUY range 2410-2420',
      ),
    ];

    expect(dedupeNotificationFeed(rows)).toHaveLength(2);
  });

  it('does not keep the badge active for hidden older duplicates', () => {
    const olderUnread = makeNotification(
      '1',
      '2026-07-27T04:30:00.000Z',
    );
    const newestRead = {
      ...makeNotification('2', '2026-07-27T04:30:20.000Z'),
      isRead: true,
    };

    expect(countUnreadNotifications([olderUnread, newestRead])).toBe(0);
  });

  it('clears the bell badge when every visible notification is read', () => {
    const firstRead = {
      ...makeNotification('1', '2026-07-27T04:30:00.000Z'),
      isRead: true,
    };
    const secondRead = {
      ...makeNotification('2', '2026-07-27T06:30:00.000Z', 'Portfolio updated'),
      isRead: true,
    };

    expect(countUnreadNotifications([firstRead, secondRead])).toBe(0);
  });
});
