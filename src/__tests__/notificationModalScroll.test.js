const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/screens/Home/PushNotificationScreen.js'),
  'utf8',
);
const presentation = fs.readFileSync(
  path.join(process.cwd(), 'designs/default/screens/PushNotificationScreen.js'),
  'utf8',
);

describe('notification detail modal scrolling', () => {
  test('uses a live bounded viewport instead of frozen module dimensions', () => {
    expect(source).toContain('useWindowDimensions()');
    expect(source).not.toContain("Dimensions.get('window')");
    expect(presentation).toContain('Math.min(screenHeight * 0.88, screenHeight - 32)');
  });

  test('has one finite content scroller above a non-shrinking footer', () => {
    expect(presentation).toContain('contentContainerStyle={styles.modalContentContainer}');
    expect(presentation).toContain('bounces={false}');
    expect(presentation).toContain('overScrollMode="never"');
    expect(presentation).toContain('modalFooter: {\n    flexShrink: 0,');
  });
});
