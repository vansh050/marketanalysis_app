const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(process.cwd(), 'src/screens/Home/ManageConnectionsModal.js'),
  'utf8',
);
const parentSource = fs.readFileSync(
  path.join(process.cwd(), 'src/screens/Home/SubscriptionScreen.js'),
  'utf8',
);

describe('Manage Connections rendering contract', () => {
  test('does not retain a scheduled VirtualizedList inside the hidden modal', () => {
    expect(source).toContain('<ScrollView style={styles.list}');
    expect(source).toContain('{connections.map(renderConnection)}');
    expect(source).not.toContain('<FlatList');
    expect(source).not.toContain('FlatList,');
  });

  test('unmounts the broker list when Manage Connections closes', () => {
    expect(parentSource).toContain(
      '{showManageConnections && <ManageConnectionsModal',
    );
    expect(parentSource).toContain('visible\n');
  });
});
