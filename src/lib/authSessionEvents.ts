type UnauthorizedSessionListener = () => void;

const unauthorizedSessionListeners = new Set<UnauthorizedSessionListener>();

export function subscribeToUnauthorizedSession(listener: UnauthorizedSessionListener): () => void {
  unauthorizedSessionListeners.add(listener);
  return () => {
    unauthorizedSessionListeners.delete(listener);
  };
}

export function publishUnauthorizedSession(): void {
  for (const listener of unauthorizedSessionListeners) {
    try {
      listener();
    } catch {
      // Session recovery must never change the result of the original request.
    }
  }
}
