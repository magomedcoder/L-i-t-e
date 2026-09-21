import { t } from "../i18n"
import { pairs, range, transpose } from "../math/helpers"
import { angleBetween, newVector, type Vector, Z_DIR, ZERO } from "../math/vector"
import { makeOutputFromFaces } from "../mesh/lathe"
import { mergeSprites, Sprite } from "../mesh/sprite"
import { Light } from "../gfx/graphics"
import { ctx } from "../state"
import { playMusic } from "../audio/audio"
import { Enemy, objectByType, Wall } from "../entities"
import { Goal } from "../entities/collectables"
import { LockedDoor } from "../entities/hitbox"
import type { GameObject } from "../entities/types"
import { type Campaign, type LevelData, type LevelObject, objectPairId } from "./levelFormat"
import { defaultRegionTexture } from "./textures"
import { getActiveCampaign } from "./catalog"
import { edgeKey, pointInPolygonPoint } from "./geometry"

export class MapPolygon {
  vertices: Vector[]
  verts2d: [number, number][]
  floorHeight: number
  ceilHeight: number
  texture?: number
  lines: [Vector, Vector][]

  constructor(vertices: Vector[], floorHeight: number, ceilHeight: number, texture?: number) {
    this.vertices = vertices
    this.verts2d = vertices.map((v) => [v.x, v.y] as [number, number])
    this.floorHeight = floorHeight
    this.ceilHeight = ceilHeight
    this.texture = texture
    this.lines = pairs([...vertices, vertices[0]], (a, b) => [a, b])
  }
}

function levelToRegions(level: LevelData): MapPolygon[] {
  return level.regions.map((r) => new MapPolygon(
    r.vertices.map(([x, y]) => newVector(x, y, 0)),
    r.floor,
    r.ceil,
    r.texture,
  ))
}

export function regionsFromLevel(level: LevelData): MapPolygon[] {
  return levelToRegions(level)
}

type SpawnObjectConstructor = new (
  position: Vector,
  thetaOrCount: number,
  offset?: number,
  active?: boolean,
) => GameObject

export class GameMap {
  levels: LevelData[]
  allLevels: LevelData[]
  regions: MapPolygon[] = []
  remake: LevelObject[] = []
  current: LevelData | null = null

  constructor(campaign?: Campaign) {
    const source = campaign || getActiveCampaign()
    if (!source) {
      throw new Error(t("error.mapNotSelected"))
    }
    this.levels = source.levels.map((l) => structuredClone(l))
    this.allLevels = this.levels.map((l) => structuredClone(l))
  }

  spawnObjects(objects: LevelObject[], where: GameObject[] = ctx.objects): void {
    objects.forEach((obj) => {
      const base = newVector(obj.x, obj.y, obj.z || 0)
      const floorZ = this.getFloorHeight(base.add(newVector(2, 2, 0)))
      const pos = base.add(newVector(0, 0, floorZ))
      if (obj.type === "many") {
        where.push(objectByType.many(pos, obj.count || 1))
      } else if (obj.type === "goal") {
        where.push(new Goal(pos, objectPairId(obj), obj.theta))
      } else if (obj.type === "door") {
        where.push(new LockedDoor(pos, objectPairId(obj), obj.theta))
      } else {
        const Ctor = objectByType[obj.type] as SpawnObjectConstructor
        where.push(new Ctor(pos, obj.theta || 0, 0, true))
      }
    })
  }

  loadLevel(): void {
    ctx.lightId = 0
    ctx.objects = []
    ctx.walls = []
    ctx.lights = range(4).map(() => new Light(newVector(0, 0, 1e3), 0, 0))
    ctx.lights[0].shadow = ctx.lights[0].dynamic_shadow = true
    const level = this.levels[0]
    this.buildRegions(level)
    this.spawnLevelObjects(level)
    this.bakeLevelMeshes(this.regions, this.collectWallEdges(this.regions))
    this.setupLevelLightsAndAudio()
  }

  getFloorHeight(
    position: Vector,
    cache?: { o?: MapPolygon | {
      floorHeight: number
      ceilHeight: number
    } },
  ): number {
    const c = cache || {}
    if (c.o && "lines" in c.o && this.isInRegion(c.o, position)) {
      return c.o.floorHeight
    }

    c.o = this.getRegionAt(position)
    return c.o ? c.o.floorHeight : -100
  }

  isInRegion(region: MapPolygon, position: Vector): boolean {
    return pointInPolygonPoint(position, region.verts2d)
  }

  getRegionAt(position: Vector): MapPolygon | undefined {
    for (const region of this.regions) {
      if (this.isInRegion(region, position)) {
        return region
      }
    }
  }

  private buildRegions(level: LevelData): void {
    this.current = level
    this.regions = levelToRegions(level)
    this.remake = level.objects.map((object) => ({...object}))
  }

  private collectWallEdges(regions: MapPolygon[]): Record<string, number[][]> {
    const wallEdges: Record<string, number[][]> = {}
    regions.forEach((region) =>
      region.lines.forEach(([a, b]) => {
        const key = edgeKey(a, b)
        ;(wallEdges[key] ||= []).push([region.floorHeight, region.ceilHeight])
      }),
    )
    return wallEdges
  }

  private bakeLevelMeshes(regions: MapPolygon[], wallEdges: Record<string, number[][]>): void {
    const toRender: [number[][][], Vector[][]][] = range(32).map(() => [[], []])
    let angle = 0
    const addAndReverse = (texture: number, coords: Vector[]) => {
      toRender[texture][0].push(range(6 * (coords.length - 2)).map(() => [angle, 0, 0]))
      toRender[texture][1].push(coords, [...coords].reverse())
    }

    regions.forEach((region) => {
      addAndReverse(
        region.texture ?? defaultRegionTexture(region.floorHeight),
        region.vertices.map((p) => newVector(p.x, p.y, region.floorHeight)),
      )
      addAndReverse(21, region.vertices.map((p) => newVector(p.x, p.y, region.ceilHeight)))
    })

    Object.entries(wallEdges).forEach(([coord, edgeHeights]) => {
      const [a, b, c, d] = coord.split(",").map(Number)
      transpose(edgeHeights).forEach((delta) => {
        const coords = [
          newVector(a, b, delta[0]),
          newVector(c, d, delta[0]),
          newVector(c, d, delta[1] || 0),
          newVector(a, b, delta[1] || 0),
        ]
        const mid = coords[0].lerp(coords[1], 0.5)
        angle = -angleBetween(coords[0], mid)
        ctx.objects.push(new Wall(mid, angle, coords[0].distanceTo(mid), coords[2].z - coords[0].z))
        addAndReverse(21, coords)
      })
    })

    toRender.forEach(([angles, faces], i) => {
      if (!angles.length) return
      const tint = i === 20 ? [0.75, 1.15, 0.55] : i === 22 ? [0.7, 0.9, 1.05] : [0.85, 0.95, 1.15]
      const wallSprite = new Sprite(
        makeOutputFromFaces(faces),
        ZERO,
        null,
        null,
        tint,
        [i, +(21 == i) + 1],
        true,
      )
      wallSprite.isWall = true
      wallSprite.angles = new Float32Array(angles.flat(2))
      wallSprite.rebuffer(true)
      ctx.objects.unshift(wallSprite)
    })
  }

  private spawnLevelObjects(level: LevelData): void {
    this.spawnObjects(this.remake)
    if (level.player && ctx.camera) {
      ctx.camera.position = newVector(level.player.x, level.player.y, level.player.z ?? 10)
    }
    
    ctx.objects.push(ctx.chaingun)
    ctx.objects.push(
      (ctx.myBody = mergeSprites(
        new Enemy(newVector(-1e6, 0, 0)).sprites.map((x, i) => {
          x.position = x.position.add(Z_DIR.scalarMultiply(5 * +(i == 3 || i == 4)))
          return x
        }),
      )),
    )
  }

  private setupLevelLightsAndAudio(): void {
    ctx.lights.forEach((light) => {
      if (light.shadow) {
        light.compute_shadowmap()
      }
    })

    ctx.musicTimeouts.forEach(clearTimeout)
    ctx.musicTimeouts = []
    playMusic()
  }
}

export function setupMap(): void {
  ctx.map = new GameMap()
  ctx.map.loadLevel()
}
