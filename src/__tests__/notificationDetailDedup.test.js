const fs = require('fs');
const path = require('path');

const screen = fs.readFileSync(
  path.join(process.cwd(), 'src/screens/Home/PushNotificationScreen.js'),
  'utf8',
);
const presentation = fs.readFileSync(
  path.join(process.cwd(), 'designs/default/screens/PushNotificationScreen.js'),
  'utf8',
);
const context = fs.readFileSync(
  path.join(process.cwd(), 'src/screens/TradeContext.js'),
  'utf8',
);

describe('notification detail rendering', () => {
  test('deduplicates recommendation cards as well as symbol labels', () => {
    expect(presentation).toContain(
      'dedupeNotificationSymbols(selectedNotification.symbolPrice).map',
    );
    expect(presentation).not.toContain(
      '{selectedNotification.symbolPrice.map((stock, index) => {',
    );
  });

  test('opens immediately and keeps cached notifications visible while marking read', () => {
    const selectIndex = screen.indexOf('setSelectedNotification(notification);');
    const modalIndex = screen.indexOf('setModalVisible(true);', selectIndex);
    const markIndex = screen.indexOf('markNotificationAsReadById(', modalIndex);
    expect(selectIndex).toBeGreaterThan(-1);
    expect(modalIndex).toBeGreaterThan(selectIndex);
    expect(markIndex).toBeGreaterThan(modalIndex);
    expect(context).toContain('const shouldBlockScreen = !options.background && !allNotifications;');
  });
});
