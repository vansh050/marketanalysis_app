/**
 * Serialize post-gateway payment completion.
 *
 * Cashfree can report the same success through its native callback, the
 * background poller and AppState recovery almost simultaneously. All callers
 * join the active completion so the server-side subscription finalizer runs
 * exactly once in this process. A failed attempt is released for later retry.
 */
export const createPaymentCompletionCoordinator = () => {
  let activeCompletion = null;

  const coordinator = {
    isRunning: () => activeCompletion !== null,
    run: (key, task) => {
      if (activeCompletion) {
        if (activeCompletion.key === key) {
          return activeCompletion.promise;
        }
        // A stale callback for a different checkout must not inherit the
        // active checkout's result. Queue it after the current completion.
        return activeCompletion.promise.then(
          () => coordinator.run(key, task),
          () => coordinator.run(key, task),
        );
      }

      const completion = {key};
      completion.promise = Promise.resolve()
        .then(task)
        .finally(() => {
          if (activeCompletion === completion) {
            activeCompletion = null;
          }
        });
      activeCompletion = completion;
      return completion.promise;
    },
  };

  return coordinator;
};
