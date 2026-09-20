import type { Campaign } from "../map/levelFormat"
import type { Selection } from "./types"

export type EditorSnapshot = {
  campaign: Campaign
  levelIndex: number
  selection: Selection
}

export function createHistory(limit = 50) {
  const past: EditorSnapshot[] = []
  const future: EditorSnapshot[] = []

  const clone = (campaign: Campaign, levelIndex: number, selection: Selection): EditorSnapshot => ({
    campaign: structuredClone(campaign),
    levelIndex,
    selection: structuredClone(selection),
  })

  return {
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() {
      past.length = 0
      future.length = 0
    },
    push(campaign: Campaign, levelIndex: number, selection: Selection) {
      past.push(clone(campaign, levelIndex, selection))
      if (past.length > limit) {
        past.shift()
      }

      future.length = 0
    },
    undo(current: EditorSnapshot): EditorSnapshot | null {
      if (!past.length) {
        return null
      }

      future.push(clone(current.campaign, current.levelIndex, current.selection))
      return past.pop()!
    },
    redo(current: EditorSnapshot): EditorSnapshot | null {
      if (!future.length) {
        return null
      }
      
      past.push(clone(current.campaign, current.levelIndex, current.selection))
      return future.pop()!
    },
  }
}
