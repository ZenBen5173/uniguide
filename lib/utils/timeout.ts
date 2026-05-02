/**
 * Race a promise against a timeout. If the timer wins, the returned
 * promise rejects with a clear error tagged with `label`. The original
 * promise is NOT cancelled (JavaScript can't cancel a fetch in flight on
 * every runtime), but the caller stops waiting on it.
 *
 * Use this on individual GLM calls so a single slow call degrades into
 * a graceful fallback instead of consuming the whole route's `maxDuration`.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`[timeout] ${label} exceeded ${ms}ms`)),
      ms
    );
  });
  return Promise.race([
    promise.then((v) => {
      clearTimeout(timer);
      return v;
    }),
    timeout,
  ]);
}
