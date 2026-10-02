import fs from 'fs';
import path from 'path';

const read = relativePath =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');

describe('open position broker label', () => {
  test('passes the execution broker from the recommendation to the card', () => {
    const content = read(
      'src/components/AdviceScreenComponents/StockAdviceContent.js',
    );
    expect(content).toContain('positionBroker={item?.user_broker}');
  });

  test('identifies the broker in collapsed and expanded open-position text', () => {
    const card = read('designs/default/composites/StockCard.js');
    expect(card).toContain("positionBroker ? ` in ${positionBroker}` : ''");
    expect(card.match(/positionBroker \? ` in \$\{positionBroker\}` : ''/g)).toHaveLength(2);
  });
});
