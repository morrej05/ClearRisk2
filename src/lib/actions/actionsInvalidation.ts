export type ActionsListener = () => void;

let version = 0;
const listeners = new Set<ActionsListener>();

export function bumpActionsVersion() {
  version += 1;
  for (const cb of Array.from(listeners)) cb();
}

export function getActionsVersion() {
  return version;
}

export function subscribeActionsVersion(cb: ActionsListener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
