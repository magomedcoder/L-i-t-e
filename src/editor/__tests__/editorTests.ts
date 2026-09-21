import { snapCoord } from "../types"
import { extrudeRegion, mergeRegions, polygonArea, snapVertexToNearest, splitEdgeInsert } from "../tools/geometryOps"
import { makeBoxRoom, makeCorridor, makeRamp } from "../tools/primitives"
import { createHistory } from "../history"
import { createMeasureState, formatMeasure, measureAddPoint, measureRegion } from "../tools/measure"
import { screenRay, raycastTris, snapVec } from "../preview/raycast"
import { createCamera3D } from "../preview/camera3d"
import { buildPreviewMesh } from "../preview/meshBuild"
import type { LevelData } from "../../map/levelFormat"
import { analyzeLevel } from "../validate"
import { extendValidation } from "../validateExtra"

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(msg)
  }
}

function sampleLevel(): LevelData {
  return {
    name: "test",
    player: { x: 0, y: 0, z: 10 },
    regions: [
      {
        vertices: [[-32, -32], [32, -32], [32, 32], [-32, 32]],
        floor: 4,
        ceil: 40,
      },
      {
        vertices: [[32, -32], [64, -32], [64, 32], [32, 32]],
        floor: 4,
        ceil: 40,
      },
    ],
    objects: [
      { type: "goal", x: 0, y: 0, pairId: 0 },
      { type: "door", x: 40, y: 0, pairId: 0, theta: 0 },
    ],
  }
}

export function runEditorUnitTests(): string[] {
  const logs: string[] = []
  const ok = (name: string) => logs.push(`ok ${name}`)

  assert(snapCoord(5, 4) === 4, "snap down")
  assert(snapCoord(6, 4) === 8, "snap up")
  ok("snapCoord")

  const level = sampleLevel()
  const area = polygonArea(level.regions[0].vertices)
  assert(Math.abs(area - 64 * 64) < 0.01, `area ${area}`)
  ok("polygonArea")

  const box = makeBoxRoom(0, 0, 32, 4, 40, 4)
  assert(box.vertices.length === 4, "box verts")
  const corridor = makeCorridor(0, 0, 40, 0, 16, 4, 40, 4)
  assert(corridor.vertices.length === 4, "corridor")
  const ramp = makeRamp(0, 0, 64, 32, 4, 20, 44, 4, 4)
  assert(ramp.length === 4, "ramp steps")
  ok("primitives")

  const ni = extrudeRegion(level, 0, 16)
  assert(ni === 2, "extrude index")
  assert(level.regions[ni].floor === 40, "extrude floor")
  ok("extrudeRegion")

  const vi = splitEdgeInsert(level, 0, 0, 4)
  assert(vi === 1, "split edge")
  ok("splitEdgeInsert")

  level.regions[0].vertices[0] = [32.5, -32]
  assert(snapVertexToNearest(level, 0, 0, 8), "snap vertex")
  ok("snapVertexToNearest")

  const mergedLevel = sampleLevel()
  const merged = mergeRegions(mergedLevel, 0, 1)
  assert(merged, "merge shared")
  ok("mergeRegions")

  const hist = createHistory()
  hist.push(structuredClone({ name: "a", levels: [sampleLevel()] }), 0, { kind: "none" }, [])
  const snap = hist.undo({
    campaign: { name: "b", levels: [sampleLevel()] },
    levelIndex: 0,
    selection: { kind: "none" },
    selectedObjects: [],
  })
  assert(snap && snap.campaign.name === "a", "undo")
  ok("history")

  const ms = createMeasureState()
  measureAddPoint(ms, [0, 0, 0])
  const dist = measureAddPoint(ms, [3, 4, 0])
  assert(dist.kind === "distance" && Math.abs(dist.length - 5) < 1e-6, "measure dist")
  assert(formatMeasure(dist).includes("5"), "format")
  const mr = measureRegion(sampleLevel(), 0)
  assert(mr.kind === "region" && mr.area > 0, "measure region")
  ok("measure")

  const cam = createCamera3D()
  const ray = screenRay(cam, 100, 100, 200, 200)
  assert(Math.abs(Math.hypot(ray.dir.x, ray.dir.y, ray.dir.z) - 1) < 1e-5, "ray norm")
  const mesh = buildPreviewMesh(sampleLevel(), {
    layers: { regions: true, objects: true, player: true },
    objectFilter: "",
    showLinks: true,
  })
  assert(mesh.tris.length > 0, "mesh tris")
  const hit = raycastTris(ray, mesh.tris)
  void hit
  assert(snapVec({ x: 5, y: 5, z: 5 }, 4).x === 4, "snapVec")
  ok("raycast/mesh")

  const base = analyzeLevel(sampleLevel(), "L")
  const ext = extendValidation(sampleLevel(), base.issues, base.markers)
  assert(Array.isArray(ext.issues), "validate extra")
  ok("validateExtra")

  return logs
}

const logs = runEditorUnitTests()
console.log(logs.join("\n"))
console.log(`\n${logs.length} tests passed`)
