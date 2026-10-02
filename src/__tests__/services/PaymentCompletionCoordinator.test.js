import {createPaymentCompletionCoordinator} from '../../FunctionCall/services/PaymentCompletionCoordinator';

describe('PaymentCompletionCoordinator', () => {
  test('joins callback, polling and AppState recovery into one completion', async () => {
    const coordinator = createPaymentCompletionCoordinator();
    let release;
    const task = jest.fn(() => new Promise(resolve => {
      release = resolve;
    }));

    const callbackCompletion = coordinator.run('cashfree:order-1', task);
    const pollingCompletion = coordinator.run('cashfree:order-1', task);
    const recoveryCompletion = coordinator.run('cashfree:order-1', task);

    await Promise.resolve();
    expect(task).toHaveBeenCalledTimes(1);
    expect(coordinator.isRunning()).toBe(true);

    release('completed');
    await expect(Promise.all([
      callbackCompletion,
      pollingCompletion,
      recoveryCompletion,
    ])).resolves.toEqual(['completed', 'completed', 'completed']);
    expect(coordinator.isRunning()).toBe(false);
  });

  test('releases a failed completion so durable recovery can retry it', async () => {
    const coordinator = createPaymentCompletionCoordinator();
    const failedTask = jest.fn().mockRejectedValue(new Error('server unavailable'));

    await expect(coordinator.run('cashfree:order-2', failedTask)).rejects.toThrow(
      'server unavailable',
    );
    expect(coordinator.isRunning()).toBe(false);

    await expect(
      coordinator.run('cashfree:order-2', () => Promise.resolve('recovered')),
    ).resolves.toBe('recovered');
  });
});
