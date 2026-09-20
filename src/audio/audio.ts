import { range, reshape, sum, transpose } from "../math/helpers"
import { angleBetween, newVector, type Vector } from "../math/vector"
import { loadProgress } from "../dom"
import { ctx } from "../state"
import { jsfxr } from "./jsfxr"

type StartGameFn = () => void
let startGame: StartGameFn = () => {}

export function setStartGame(fn: StartGameFn): void {
  startGame = fn
}

export const context = new AudioContext()

export const play = (which: number[], location?: Vector) => {
  const m = context.createBuffer(1, which.length, 48e3)
  m.copyToChannel(new Float32Array(which), 0, 0)
  const src = context.createBufferSource()
  const panner = context.createStereoPanner()
  src.buffer = m
  src.connect(panner)
  panner.pan.value = location
    ? Math.cos(angleBetween(location, ctx.camera.position) + ctx.camera.theta + Math.PI / 2)
    : 0
  panner.connect(context.destination)
  src.start()
  return src
}

export function playMusic(): void {
  if (ctx.musicTimeouts.length < 2 && !ctx.goingBack && ctx.canPlayMusic) {
    ctx.musicNotes!.forEach((note, i) =>
      note.forEach((n) =>
        ctx.musicTimeouts.push(
          setTimeout(
            () => {
              ctx.musicTimeouts.shift()
              play(n, newVector(20, -40, 0))
              if (ctx.musicTimeouts.length == 1) {
                playMusic()
              }
            },
            i * 200 + 400,
          ),
        ),
      ),
    )
  }
}

const mixAudio = (x: number[][]) => transpose(x).map(sum)

function load(): void {
  const melody = [null,19,17,19,15,19,14,19,12,19,11,19,12,19,14,19,15,19,7,19,9,19,11,19,12,19,11,19,12,19,14,19]
  const harmony_2 = [15, 16, 17, 10, 8, 7, 8, 10, 12, 4, 5, 7, 8, 7, 8, 4]
  const melody_4 = [20, 24, 20, 24, 25, 17, 25, 17, 22, 19, 22, 19, 24, 15, 24, 15, 20, 17, 20, 17, 23, 14, 23, 14, 19, 15, 19, 15, 17, 11, 17, 11, 15, 12, 15, 12, 14, 8, 14, 8]
  const harmony_4 = [5, 17, 5, 17, 12, 17, 12, 17, 10, 13, 10, 13, 10, 13, 10, 13, 10, 15, 10, 15, 10, 15, 10, 15, 8, 12, 8, 12, 8, 12, 8, 12, 8, 14, 8, 14, 8, 14, 8, 14, 7, 11, 7, 11, 7, 11, 7, 11, 3, 12, 3, 12, 3, 12, 3, 12, 2, 8, 2, 8, 2, 8, 2, 8, 0, 19, 0, 19, 0, 19, 0, 19, 2, 5, 2, 5, 2, 5, 2, 5]
  const harmony_9 = [3, 2, 0, 5, 3, 2, 3, -1, 0, -1, 0, 2, 3, 2, 3, -1]
  const melody_11 = [15, 19, 14, 19, 12, 19, 10, 19, 8, 19, 10, 19, 12, 17, 20, 17, 14, 17, 12, 17, 10, 17, 20, 17, 7, 17, 8, 17, 10, 15, 7, 15, 12, 15, 10, 15, 8, 15, 7, 15, 5, 15, 19, 15, 8, 14, 5, 14, 11, 14, 8, 14, 7, 14, 5, 14, 3, 14, 5, 14]
  const harmony_11_up = [7, 12, 12, null, 10, 10, 10, null, 9, 9, 9, null, 7, 7, 7]
  const harmony_11_down = [0, 3, 5, null, -2, 2, 3, null, -4, 0, 2, null, -5, -1, 12]
  const final_melody = [19, 24, 15, 24, 14, 26, 14, 26, 15, 24, 15, 24, 20, 23, 20, 23, 19, 24, 15, 24, 14, 26, 14, 26, 15, 24, 15, 24]
  const final_harmony_up = [null, 12, 11, 11, 12, 12, 14, null, null, 12, 11, 11, 12, 12, 14]
  const final_harmony_down = [null, 3, 8, 8, 7, 7, 17, null, null, 7, 8, 8, 7, 7, 6]

  const sections: [number, number, number, ...(number | null)[][]][] = [
    [0, 1, 1, melody],
    [5, 1, 2, melody, harmony_2],
    [0, 2, 1, melody_4, harmony_4],
    [12, 1, 2, melody, harmony_9],
    [12, 1, 4, melody_11, harmony_11_up, harmony_11_down],
    [0, 1, 2, final_melody, final_harmony_up, final_harmony_down],
  ]

  ctx.musicNotes = range(300).map(() => [])
  let offset = 0

  const addnote = (kind: boolean, note: number | null, where: number, length: number) => {
    if (note == null) return
    const time = length * 0.11 + 0.13
    ctx.musicNotes![where + offset].push(
      mixAudio([note / 12, note / 12 - 1].map((f) => {
        f = 2 ** (f / 2) * 0.25
        return kind
          ? jsfxr([3, 0.1, time, 0.1, 0.3, f, , , , , , , , 0.5, , , -1, , 0.2, , , , , 0.1])
          : jsfxr([3, 0.1, time + 0.07, 0.3, 0.5, f, , , , , , , , , , , , , 0.15, , , , , 0.1])
      })),
    )
  }

  const donext = () => {
    const [offset_melody, duration_melody, duration_harmony, ...music] = sections.shift()!
    music.forEach((notes, j) => notes.forEach((note, i) => addnote(
      !j && sections.length < 5,
      note == null ? null : note + offset_melody * +!j,
      i * (j ? duration_harmony : duration_melody),
      j ? duration_harmony : duration_melody,
    )))
    offset += duration_melody * music[0].length
    const total = 6
    const done = total - sections.length
    loadProgress.textContent = `${Math.round((done / total) * 100)}%`
    setTimeout(sections.length ? donext : startGame, 1)
  }
  setTimeout(donext, 1)
}

export function setupAudio(): void {
  load()
  let raw: (number | undefined)[] = [100,7,55,25,35,20,,15,,,4,,,,2,33,-8,-23,20,,23,4,-48,30,100,,5,100,55,20,,,-10,,,,,,,,-40,-5,15,,,,,30,,,5,100,55,20,,,-10,,,,,,,,-40,-5,15,,,,,30,300,10,25,5,20,25,10,,,50,,,,50,,,,,10,,50,50,,60,300,5,15,5,20,25,10,,,50,,,,50,,,,,10,,50,50,,60,300,45,55,,55,15,,-10,,,,,,,,,,,25,,,,,30,0,5,5,,45,5,,-10,,,,,,,,,-25,,5,,,,,300]
  const arr = reshape(raw.map((x) => (x ?? 0) / 100), 24)

  ctx.sounds.boom = mixAudio([jsfxr(arr[0])])
  ctx.sounds.gun = mixAudio([jsfxr(arr[1]), jsfxr(arr[2])])
  ctx.sounds.collect = mixAudio([jsfxr(arr[3])])
  ctx.sounds.collect2 = mixAudio([jsfxr(arr[4])])
  ctx.sounds.clock = mixAudio([jsfxr(arr[5]), jsfxr(arr[5]).slice(2000)])
  ctx.sounds.hit = mixAudio([jsfxr(arr[6]), jsfxr(arr[1])])
}
