import fs from 'fs';
import path from 'path';

describe('broker reconnect reconciliation parity', () => {
  const dispatchSource = fs.readFileSync(
    path.join(
      process.cwd(),
      'src/components/BrokerConnectionModal/BrokerConnectModalDispatch.js',
    ),
    'utf8',
  );
  const serviceSource = fs.readFileSync(
    path.join(process.cwd(), 'src/services/ModelPortfolioService.js'),
    'utf8',
  );
  const switchSource = fs.readFileSync(
    path.join(process.cwd(), 'src/screens/Home/ManageConnectionsModal.js'),
    'utf8',
  );

  test('every dispatched SDK or legacy success callback uses the wrapper', () => {
    expect(dispatchSource).toContain('fetchBrokerStatusModal: refreshAndReconcile');
    expect(dispatchSource).toContain('startAccountReconciliation(');
    expect(dispatchSource).toContain('getAccountEmailAsync()');
  });

  test('the beacon is credential-free and does not weaken Calculate safety', () => {
    const start = serviceSource.indexOf('export async function startAccountReconciliation');
    const segment = serviceSource.slice(start, start + 900);

    expect(segment).toContain('rebalance/reconcile-account');
    expect(segment).toContain("trigger = 'app_broker_connected'");
    expect(segment).toContain('trigger,');
    expect(segment).toContain('userEmail');
    expect(segment).toContain('userBroker');
    expect(segment).not.toContain('jwtToken');
    expect(segment).not.toContain('accessToken');
  });

  test('switching to an already-connected primary broker enqueues reconciliation', () => {
    expect(switchSource).toContain('startAccountReconciliation(');
    expect(switchSource).toContain("'app_primary_broker_switch'");
    expect(switchSource).toContain('brokerName,');
  });
});
