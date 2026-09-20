import { clamp, range, sum, urandom } from "../math/helpers"

export type SfxrParams = {
  waveType: number
  attackTime: number
  sustainTime: number
  sustainPunch: number
  decayTime: number
  startFrequency: number
  minFrequency: number
  slide: number
  deltaSlide: number
  vibratoDepth: number
  vibratoSpeed: number
  changeAmount: number
  changeSpeed: number
  squareDuty: number
  dutySweep: number
  repeatSpeed: number
  phaserOffset: number
  phaserSweep: number
  lpFilterCutoff: number
  lpFilterCutoffSweep: number
  lpFilterResonance: number
  hpFilterCutoff: number
  hpFilterCutoffSweep: number
  masterVolume: number
}

const PARAM_KEYS: (keyof SfxrParams)[] = [
  "waveType",
  "attackTime",
  "sustainTime",
  "sustainPunch",
  "decayTime",
  "startFrequency",
  "minFrequency",
  "slide",
  "deltaSlide",
  "vibratoDepth",
  "vibratoSpeed",
  "changeAmount",
  "changeSpeed",
  "squareDuty",
  "dutySweep",
  "repeatSpeed",
  "phaserOffset",
  "phaserSweep",
  "lpFilterCutoff",
  "lpFilterCutoffSweep",
  "lpFilterResonance",
  "hpFilterCutoff",
  "hpFilterCutoffSweep",
  "masterVolume",
]

export function paramsFromSettings(settings: number[]): SfxrParams {
  const p = {} as SfxrParams
  PARAM_KEYS.forEach((key, i) => {
    p[key] = settings[i] || 0
  })
  p.sustainTime = Math.max(p.sustainTime, 0.01)
  return p
}

export class SfxrSynth {
  params: SfxrParams = paramsFromSettings([])

  private envelopeLengths!: number[]
  private period = 0
  private maxPeriod = 0
  private slide = 0
  private deltaSlide = 0
  private changeAmount = 0
  private changeTime = 0
  private changeLimit = 0
  private squareDuty = 0
  private dutySweep = 0

  reset = (): void => {
    const p = this.params
    this.period = 100 / (p.startFrequency ** 2 + 0.001)
    this.maxPeriod = 100 / (p.minFrequency ** 2 + 0.001)
    this.slide = 1 - p.slide ** 3 * 0.01
    this.deltaSlide = -(p.deltaSlide ** 3) * 0.000001
    if (p.waveType == 3) {
      this.squareDuty = 0.5 - p.squareDuty / 2
      this.dutySweep = -p.dutySweep * 0.00005
    }
    this.changeAmount = 1 + p.changeAmount ** 2 * (p.changeAmount > 0 ? -0.9 : 10)
    this.changeTime = 0
    this.changeLimit = p.changeSpeed == 1 ? 0 : (1 - p.changeSpeed) ** 2 * 20000 + 32
  }

  totalReset = (): number => {
    this.reset()
    const p = this.params
    this.envelopeLengths = [
      p.attackTime ** 2 * 100000,
      p.sustainTime ** 2 * 100000,
      p.decayTime ** 2 * 100000,
      1,
    ]
    return sum(this.envelopeLengths)
  }

  synthWave = (buffer: number[], length: number): number => {
    const p = this.params
    const filters = p.lpFilterCutoff != 1 || p.hpFilterCutoff
    let hpFilterCutoff = p.hpFilterCutoff ** 2 * 0.1
    const hpFilterDeltaCutoff = 1 + p.hpFilterCutoffSweep * 0.0003
    let lpFilterCutoff = p.lpFilterCutoff ** 3 * 0.1
    const masterVolume = p.masterVolume ** 2
    const phaser = p.phaserOffset || p.phaserSweep
    let phaserOffset = p.phaserOffset ** 2 * (p.phaserOffset < 0 ? -1020 : 1020)
    const repeatLimit = p.repeatSpeed ? (((1 - p.repeatSpeed) ** 2 * 20000) | 0) + 32 : 0
    const vibratoAmplitude = p.vibratoDepth / 2
    const waveType = p.waveType
    let envelopeLength = this.envelopeLengths[0]
    let lpFilterDamping = (5 / (1 + p.lpFilterResonance ** 2 * 20)) * (0.01 + lpFilterCutoff)
    lpFilterDamping = 1 - clamp(lpFilterDamping, 0, 0.8)

    let finished = false
    let envelopeStage = 0
    let envelopeTime = 0
    let envelopeVolume = 0
    let hpFilterPos = 0
    let lpFilterDeltaPos = 0
    let lpFilterOldPos = 0
    let lpFilterPos = 0
    let periodTemp = 0
    let phase = 0
    let phaserInt = 0
    let phaserPos = 0
    let repeatTime = 0
    let sample = 0
    let lastOut = 0
    let vibratoPhase = 0
    const phaserBuffer = new Array(1024).fill(0)
    const noiseBuffer = range(32).map(() => urandom())

    for (let i = 0; i < length; i++) {
      if (finished) return i

      if (repeatLimit) {
        if (++repeatTime >= repeatLimit) {
          repeatTime = 0
          this.reset()
        }
      }

      if (this.changeLimit) {
        if (++this.changeTime >= this.changeLimit) {
          this.changeLimit = 0
          this.period *= this.changeAmount
        }
      }

      this.slide += this.deltaSlide
      this.period *= this.slide

      if (this.period > this.maxPeriod) {
        this.period = this.maxPeriod
        finished = p.minFrequency > 0
      }

      periodTemp = this.period
      if (vibratoAmplitude > 0) {
        vibratoPhase += p.vibratoSpeed ** 2 * 0.01
        periodTemp *= 1 + Math.sin(vibratoPhase) * vibratoAmplitude
      }
      periodTemp = clamp(periodTemp, 8, 1e9) | 0

      if (waveType == 3) {
        this.squareDuty = clamp(this.squareDuty + this.dutySweep, 0, 0.5)
      }

      if (++envelopeTime > envelopeLength) {
        envelopeTime = 0
        envelopeLength = this.envelopeLengths[++envelopeStage]
      }

      const r = envelopeTime / this.envelopeLengths[envelopeStage]
      envelopeVolume = [r, 1 + (1 - r) * 2 * p.sustainPunch, 1 - r, 0][envelopeStage]
      finished = finished || envelopeStage == 3

      if (phaser) {
        phaserOffset += p.phaserSweep ** 3 * 0.2
        phaserInt = phaserOffset | 0
        if (phaserInt < 0) phaserInt = -phaserInt
        else if (phaserInt > 1023) phaserInt = 1023
      }

      if (filters && hpFilterDeltaCutoff) {
        hpFilterCutoff = clamp(hpFilterCutoff * hpFilterDeltaCutoff, 0.00001, 0.1)
      }

      buffer[i] = sum(range(8).map(() => {
        phase++
        if (phase >= periodTemp) {
          phase %= periodTemp
          if (waveType <= 1) {
            range(noiseBuffer.length).forEach((n) => {
              if (waveType == 1) {
                noiseBuffer[n] = lastOut = (lastOut + 0.02 * urandom()) / 1.02
                noiseBuffer[n] *= 3.5
              } else {
                noiseBuffer[n] = urandom()
              }
            })
          }
        }

        sample = [
          noiseBuffer[Math.abs(((phase * 32) / periodTemp) | 0)],
          noiseBuffer[Math.abs(((phase * 32) / periodTemp) | 0)],
          NaN,
          phase / periodTemp < this.squareDuty ? 0.5 : -0.5,
          (sample = 1 - (phase / periodTemp) * 2),
        ][waveType]

        if (filters) {
          lpFilterOldPos = lpFilterPos
          lpFilterCutoff = clamp(lpFilterCutoff * (1 + p.lpFilterCutoffSweep * 0.0001), 0, 0.1)
          if (p.lpFilterCutoff != 1) {
            lpFilterDeltaPos += (sample - lpFilterPos) * lpFilterCutoff
            lpFilterDeltaPos *= lpFilterDamping
          } else {
            lpFilterPos = sample
            lpFilterDeltaPos = 0
          }
          lpFilterPos += lpFilterDeltaPos
          hpFilterPos += lpFilterPos - lpFilterOldPos
          hpFilterPos *= 1 - hpFilterCutoff
          sample = hpFilterPos
        }

        if (phaser) {
          phaserBuffer[phaserPos % 1024] = sample
          sample += phaserBuffer[(phaserPos - phaserInt + 1024) % 1024]
          phaserPos++
        }

        return sample
      })) * envelopeVolume * masterVolume * (0.5 + 1.5 * +(waveType == 1))
    }

    return length
  }
}

const cache = new Map<string, number[]>()

export function jsfxr(settings: number[]): number[] {
  const key = settings.join(",")
  const cached = cache.get(key)
  if (cached) {
    return cached
  }

  const synth = new SfxrSynth()
  synth.params = paramsFromSettings(settings)
  const envelopeFullLength = synth.totalReset()
  const arr = range(envelopeFullLength | 0)
  synth.synthWave(arr, envelopeFullLength)
  cache.set(key, arr)
  return arr
}
