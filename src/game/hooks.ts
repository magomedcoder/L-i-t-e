type GameHooks = {
  setResolution: (j: number) => void
  reset: () => void
  gameStep: (now: number) => void
}

let hooks: GameHooks = {
  setResolution: () => {},
  reset: () => {},
  gameStep: () => {},
}

export function setGameHooks(next: GameHooks): void {
  hooks = next
}

export function getGameHooks(): GameHooks {
  return hooks
}
