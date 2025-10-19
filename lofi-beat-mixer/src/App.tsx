import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const BARS = 16
const BEATS_PER_BAR = 4
const STEP_COUNT = BARS * BEATS_PER_BAR

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

type FilterSettings = {
  type: BiquadFilterType
  frequency: number
  Q?: number
  gain?: number
}

type Envelope = {
  attack?: number
  decay?: number
  sustain?: number
  hold?: number
  release?: number
}

type ToneComponent = {
  kind: 'tone'
  wave: OscillatorType
  ratio?: number
  detuneCents?: number
  gain?: number
}

type NoiseComponent = {
  kind: 'noise'
  color: 'white' | 'pink'
  gain?: number
  filter?: FilterSettings
}

type TrackComponent = ToneComponent | NoiseComponent

type Track = {
  id: string
  name: string
  color: string
  baseFrequency?: number
  enabled: boolean
  level: number
  density: number
  offset: number
  pattern: boolean[]
  components: TrackComponent[]
  envelope?: Envelope
  filter?: FilterSettings
}

const getStepIndex = (bar: number, beat: number) => bar * BEATS_PER_BAR + beat

const createEvenPattern = (count: number, offset = 0) => {
  const pattern = Array.from({ length: STEP_COUNT }, () => false)
  if (count <= 0) {
    return pattern
  }

  for (let i = 0; i < count; i += 1) {
    const index = (Math.floor((i * STEP_COUNT) / count) + offset) % STEP_COUNT
    pattern[index] = true
  }

  return pattern
}

const createEmptyPattern = () => Array.from({ length: STEP_COUNT }, () => false)

const createPatternFromSteps = (steps: number[]) => {
  const pattern = createEmptyPattern()
  steps.forEach((step) => {
    if (step >= 0 && step < STEP_COUNT) {
      pattern[step] = true
    }
  })
  return pattern
}

const createBarPattern = (beatGroups: number[][]) => {
  const pattern = createEmptyPattern()
  for (let bar = 0; bar < BARS; bar += 1) {
    const beats = beatGroups[bar % beatGroups.length] ?? []
    beats.forEach((beat) => {
      if (beat >= 0 && beat < BEATS_PER_BAR) {
        const step = bar * BEATS_PER_BAR + beat
        pattern[step] = true
      }
    })
  }
  return pattern
}

const MAJOR_THIRD_RATIO = 2 ** (4 / 12)
const PERFECT_FIFTH_RATIO = 2 ** (7 / 12)

const defaultTracks: Track[] = [
  {
    id: 'kick',
    name: 'Kick',
    color: '#ff6b6b',
    baseFrequency: 60,
    enabled: true,
    level: 85,
    density: 32,
    offset: 0,
    pattern: createEvenPattern(32, 0),
    components: [
      { kind: 'tone', wave: 'sine', ratio: 1, gain: 1 },
      { kind: 'tone', wave: 'sine', ratio: 2, gain: 0.3 },
    ],
    envelope: { attack: 0.002, decay: 0.28, sustain: 0, hold: 0, release: 0.4 },
    filter: { type: 'lowpass', frequency: 1400, Q: 0.7 },
  },
  {
    id: 'snare',
    name: 'Snare',
    color: '#ffd166',
    baseFrequency: 180,
    enabled: true,
    level: 70,
    density: 16,
    offset: 2,
    pattern: createEvenPattern(16, 2),
    components: [
      { kind: 'tone', wave: 'triangle', ratio: 1, gain: 0.5 },
      {
        kind: 'noise',
        color: 'white',
        gain: 0.8,
        filter: { type: 'bandpass', frequency: 1800, Q: 1.1 },
      },
    ],
    envelope: { attack: 0.001, decay: 0.22, sustain: 0, hold: 0, release: 0.25 },
  },
  {
    id: 'hat',
    name: 'Hi-Hat',
    color: '#06d6a0',
    baseFrequency: 8000,
    enabled: true,
    level: 50,
    density: STEP_COUNT,
    offset: 0,
    pattern: createEvenPattern(STEP_COUNT, 0),
    components: [
      {
        kind: 'noise',
        color: 'white',
        gain: 0.7,
        filter: { type: 'highpass', frequency: 6000, Q: 0.7 },
      },
      { kind: 'tone', wave: 'square', ratio: 2, gain: 0.15 },
    ],
    envelope: { attack: 0.001, decay: 0.08, sustain: 0, hold: 0, release: 0.1 },
    filter: { type: 'highpass', frequency: 4000, Q: 0.8 },
  },
  {
    id: 'clap',
    name: 'Clap',
    color: '#f78c6b',
    enabled: true,
    level: 55,
    density: 16,
    offset: 1,
    pattern: createEvenPattern(16, 1),
    components: [
      {
        kind: 'noise',
        color: 'white',
        gain: 0.9,
        filter: { type: 'bandpass', frequency: 1500, Q: 1.6 },
      },
      {
        kind: 'noise',
        color: 'white',
        gain: 0.6,
        filter: { type: 'bandpass', frequency: 800, Q: 0.9 },
      },
    ],
    envelope: { attack: 0.001, decay: 0.24, sustain: 0, hold: 0, release: 0.2 },
  },
  {
    id: 'perc-fx',
    name: 'Perc FX',
    color: '#8338ec',
    baseFrequency: 420,
    enabled: true,
    level: 50,
    density: 12,
    offset: 0,
    pattern: createEvenPattern(12, 0),
    components: [
      { kind: 'tone', wave: 'sawtooth', ratio: 1, gain: 0.6 },
      { kind: 'tone', wave: 'sawtooth', ratio: 1.5, gain: 0.3 },
      {
        kind: 'noise',
        color: 'pink',
        gain: 0.4,
        filter: { type: 'bandpass', frequency: 1200, Q: 1.5 },
      },
    ],
    envelope: { attack: 0.01, decay: 0.35, sustain: 0.15, hold: 0.1, release: 0.45 },
    filter: { type: 'bandpass', frequency: 1500, Q: 1.2 },
  },
  {
    id: 'bass',
    name: 'Bass',
    color: '#073b4c',
    baseFrequency: 55,
    enabled: true,
    level: 65,
    density: 16,
    offset: 0,
    pattern: createEvenPattern(16, 0),
    components: [
      { kind: 'tone', wave: 'square', ratio: 1, gain: 0.9 },
      { kind: 'tone', wave: 'sawtooth', ratio: 0.5, gain: 0.4 },
      { kind: 'tone', wave: 'square', ratio: 2, gain: 0.25 },
    ],
    envelope: { attack: 0.02, decay: 0.25, sustain: 0.45, hold: 0.15, release: 0.5 },
    filter: { type: 'lowpass', frequency: 900, Q: 0.7 },
  },
  {
    id: 'pad',
    name: 'Pad',
    color: '#118ab2',
    baseFrequency: 220,
    enabled: true,
    level: 45,
    density: 8,
    offset: 0,
    pattern: createEvenPattern(8, 0),
    components: [
      { kind: 'tone', wave: 'sawtooth', ratio: 1, gain: 0.5 },
      { kind: 'tone', wave: 'sawtooth', ratio: MAJOR_THIRD_RATIO, gain: 0.35 },
      { kind: 'tone', wave: 'sawtooth', ratio: PERFECT_FIFTH_RATIO, gain: 0.3 },
      { kind: 'noise', color: 'pink', gain: 0.2 },
    ],
    envelope: { attack: 0.18, decay: 0.6, sustain: 0.6, hold: 0.4, release: 1.2 },
    filter: { type: 'lowpass', frequency: 2400, Q: 0.6 },
  },
  {
    id: 'trumpet-hi',
    name: 'Hi Trumpet',
    color: '#ff9f1c',
    baseFrequency: 784,
    enabled: true,
    level: 55,
    density: 8,
    offset: 0,
    pattern: createEvenPattern(8, 0),
    components: [
      { kind: 'tone', wave: 'sawtooth', ratio: 1, gain: 0.6 },
      { kind: 'tone', wave: 'square', ratio: MAJOR_THIRD_RATIO, gain: 0.3 },
      { kind: 'tone', wave: 'triangle', ratio: PERFECT_FIFTH_RATIO, gain: 0.25 },
      { kind: 'noise', color: 'pink', gain: 0.18 },
    ],
    envelope: { attack: 0.015, decay: 0.35, sustain: 0.5, hold: 0.18, release: 0.7 },
    filter: { type: 'lowpass', frequency: 4200, Q: 0.9 },
  },
  {
    id: 'trumpet-low',
    name: 'Low Trumpet',
    color: '#ffbf69',
    baseFrequency: 392,
    enabled: true,
    level: 55,
    density: 8,
    offset: 2,
    pattern: createEvenPattern(8, 2),
    components: [
      { kind: 'tone', wave: 'sawtooth', ratio: 1, gain: 0.65 },
      { kind: 'tone', wave: 'square', ratio: PERFECT_FIFTH_RATIO, gain: 0.28 },
      { kind: 'tone', wave: 'triangle', ratio: 0.5, gain: 0.22 },
      { kind: 'noise', color: 'pink', gain: 0.12 },
    ],
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.55, hold: 0.22, release: 0.8 },
    filter: { type: 'lowpass', frequency: 3200, Q: 0.75 },
  },
  {
    id: 'sax-hi',
    name: 'Hi Saxophone',
    color: '#cdb4db',
    baseFrequency: 660,
    enabled: true,
    level: 50,
    density: 6,
    offset: 1,
    pattern: createEvenPattern(6, 1),
    components: [
      { kind: 'tone', wave: 'sawtooth', ratio: 1, gain: 0.55 },
      { kind: 'tone', wave: 'triangle', ratio: MAJOR_THIRD_RATIO, gain: 0.35 },
      { kind: 'noise', color: 'white', gain: 0.2, filter: { type: 'bandpass', frequency: 2800, Q: 1.3 } },
    ],
    envelope: { attack: 0.03, decay: 0.45, sustain: 0.6, hold: 0.25, release: 0.9 },
    filter: { type: 'bandpass', frequency: 2600, Q: 1 },
  },
  {
    id: 'sax-low',
    name: 'Low Saxophone',
    color: '#a2d2ff',
    baseFrequency: 330,
    enabled: true,
    level: 50,
    density: 6,
    offset: 3,
    pattern: createEvenPattern(6, 3),
    components: [
      { kind: 'tone', wave: 'sawtooth', ratio: 1, gain: 0.6 },
      { kind: 'tone', wave: 'triangle', ratio: PERFECT_FIFTH_RATIO, gain: 0.32 },
      { kind: 'noise', color: 'white', gain: 0.18, filter: { type: 'bandpass', frequency: 1800, Q: 1.1 } },
    ],
    envelope: { attack: 0.035, decay: 0.5, sustain: 0.65, hold: 0.28, release: 1 },
    filter: { type: 'bandpass', frequency: 2000, Q: 0.95 },
  },
  {
    id: 'violin-hi',
    name: 'Hi Violin',
    color: '#b9fbc0',
    baseFrequency: 880,
    enabled: true,
    level: 45,
    density: 4,
    offset: 0,
    pattern: createEvenPattern(4, 0),
    components: [
      { kind: 'tone', wave: 'sawtooth', ratio: 1, gain: 0.5 },
      { kind: 'tone', wave: 'sawtooth', ratio: MAJOR_THIRD_RATIO, gain: 0.35 },
      { kind: 'tone', wave: 'sawtooth', ratio: PERFECT_FIFTH_RATIO, gain: 0.3 },
      { kind: 'noise', color: 'pink', gain: 0.1 },
    ],
    envelope: { attack: 0.12, decay: 0.7, sustain: 0.7, hold: 0.5, release: 1.6 },
    filter: { type: 'lowpass', frequency: 3400, Q: 0.7 },
  },
  {
    id: 'violin-low',
    name: 'Low Violin',
    color: '#ffd6ff',
    baseFrequency: 440,
    enabled: true,
    level: 45,
    density: 4,
    offset: 2,
    pattern: createEvenPattern(4, 2),
    components: [
      { kind: 'tone', wave: 'sawtooth', ratio: 1, gain: 0.5 },
      { kind: 'tone', wave: 'sawtooth', ratio: MAJOR_THIRD_RATIO, gain: 0.35 },
      { kind: 'tone', wave: 'sawtooth', ratio: PERFECT_FIFTH_RATIO, gain: 0.3 },
      { kind: 'noise', color: 'pink', gain: 0.1 },
    ],
    envelope: { attack: 0.14, decay: 0.75, sustain: 0.7, hold: 0.55, release: 1.8 },
    filter: { type: 'lowpass', frequency: 2800, Q: 0.7 },
  },
]

type PresetTrackSettings = {
  pattern: boolean[]
  enabled?: boolean
  level?: number
}

type Preset = {
  id: string
  name: string
  description: string
  tracks: Record<string, PresetTrackSettings>
}

const PRESET_CUSTOM_ID = 'custom'

const presets: Preset[] = [
  {
    id: 'midnight-ride',
    name: 'Midnight Ride',
    description:
      'Steady downtempo pulse with warm pads, layered bass, and mellow brass accents.',
    tracks: {
      kick: { pattern: createBarPattern([[0, 2], [0, 3]]) },
      snare: { pattern: createBarPattern([[1, 3]]) },
      hat: { pattern: createBarPattern([[0, 1, 2, 3]]) },
      clap: { pattern: createBarPattern([[3], []]) },
      'perc-fx': { pattern: createBarPattern([[], [2], [], [1]]) },
      bass: { pattern: createBarPattern([[0, 2], [0, 3]]) },
      pad: { pattern: createBarPattern([[0], [2]]) },
      'trumpet-hi': { pattern: createBarPattern([[], [], [1], []]) },
      'trumpet-low': { pattern: createBarPattern([[2], [], [], [1]]) },
      'sax-hi': { pattern: createBarPattern([[1], [], [], [2]]) },
      'sax-low': { pattern: createBarPattern([[0], [], [2], []]) },
      'violin-hi': { pattern: createBarPattern([[0], [], [], [3]]) },
      'violin-low': { pattern: createBarPattern([[2], [], [], [0]]) },
    },
  },
  {
    id: 'sunrise-bounce',
    name: 'Sunrise Bounce',
    description: 'Bright shuffle full of syncopated drums and lively horn stabs.',
    tracks: {
      kick: { pattern: createBarPattern([[0, 1, 3], [0, 2, 3]]) },
      snare: { pattern: createBarPattern([[1, 3], [1], [3], [1, 3]]) },
      hat: { pattern: createBarPattern([[0, 2, 3], [0, 1, 2, 3]]) },
      clap: { pattern: createBarPattern([[3], [2, 3], [3], [2]]) },
      'perc-fx': { pattern: createBarPattern([[2], [], [1, 3], []]) },
      bass: { pattern: createBarPattern([[0, 1, 3], [0, 2, 3]]) },
      pad: { pattern: createBarPattern([[0, 3], [1, 2]]) },
      'trumpet-hi': { pattern: createBarPattern([[2], [], [1], []]) },
      'trumpet-low': { pattern: createBarPattern([[0, 2], [], [0], []]) },
      'sax-hi': { pattern: createBarPattern([[3], [], [], [1, 2]]) },
      'sax-low': { pattern: createBarPattern([[1], [], [3], []]) },
      'violin-hi': { pattern: createBarPattern([[0], [2], [], [1]]) },
      'violin-low': { pattern: createBarPattern([[2], [], [], [2]]) },
    },
  },
  {
    id: 'rainy-drift',
    name: 'Rainy Drift',
    description: 'Laid-back half-time groove with sparse percussion and gentle strings.',
    tracks: {
      kick: {
        pattern: createPatternFromSteps([
          getStepIndex(0, 0),
          getStepIndex(1, 0),
          getStepIndex(2, 0),
          getStepIndex(3, 2),
          getStepIndex(6, 0),
          getStepIndex(7, 2),
          getStepIndex(10, 0),
          getStepIndex(14, 2),
        ]),
      },
      snare: { pattern: createBarPattern([[2], [], [2], []]) },
      hat: { pattern: createBarPattern([[0, 2], [0], [2], [0]]) },
      clap: { pattern: createBarPattern([[], [], [], [3]]) },
      'perc-fx': {
        pattern: createPatternFromSteps([
          getStepIndex(1, 3),
          getStepIndex(5, 2),
          getStepIndex(9, 1),
          getStepIndex(13, 2),
        ]),
      },
      bass: { pattern: createBarPattern([[0], [], [0, 2], []]) },
      pad: { pattern: createBarPattern([[0], [], [2], []]) },
      'trumpet-hi': { pattern: createEmptyPattern(), enabled: false },
      'trumpet-low': { pattern: createBarPattern([[3], [], [], []]), enabled: false },
      'sax-hi': { pattern: createBarPattern([[], [], [3], []]) },
      'sax-low': { pattern: createBarPattern([[2], [], [], [2]]) },
      'violin-hi': { pattern: createBarPattern([[0], [], [], []]) },
      'violin-low': { pattern: createBarPattern([[2], [], [], []]) },
    },
  },
]

const createNoiseBuffer = (context: AudioContext, color: 'white' | 'pink') => {
  const durationSeconds = 1
  const frameCount = Math.max(1, Math.floor(context.sampleRate * durationSeconds))
  const buffer = context.createBuffer(1, frameCount, context.sampleRate)
  const channelData = buffer.getChannelData(0)

  if (color === 'white') {
    for (let i = 0; i < channelData.length; i += 1) {
      channelData[i] = Math.random() * 2 - 1
    }
    return buffer
  }

  let b0 = 0
  let b1 = 0
  let b2 = 0

  for (let i = 0; i < channelData.length; i += 1) {
    const white = Math.random() * 2 - 1
    b0 = 0.99765 * b0 + white * 0.0990460
    b1 = 0.96300 * b1 + white * 0.2965164
    b2 = 0.57000 * b2 + white * 1.0526913
    const pink = b0 + b1 + b2 + white * 0.1848
    channelData[i] = pink * 0.11
  }

  return buffer
}

function App() {
  const [tempo, setTempo] = useState(85)
  const [swing, setSwing] = useState(15)
  const [masterVolume, setMasterVolume] = useState(70)
  const [isPlaying, setIsPlaying] = useState(false)
  const [tracks, setTracks] = useState<Track[]>(defaultTracks)
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_CUSTOM_ID)
  const [currentStep, setCurrentStep] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const noiseBuffersRef = useRef<Partial<Record<'white' | 'pink', AudioBuffer>>>({})
  const timeoutRef = useRef<number | null>(null)
  const stepRef = useRef(0)

  const activePreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId),
    [selectedPresetId],
  )
  const customPresetDescription =
    'Start with an empty canvas or tweak any preset to craft your own groove.'
  const presetDescription = activePreset?.description ?? customPresetDescription

  const ensureAudio = () => {
    if (!audioContextRef.current) {
      const context = new AudioContext()
      const masterGain = context.createGain()
      masterGain.gain.value = masterVolume / 100
      masterGain.connect(context.destination)
      audioContextRef.current = context
      masterGainRef.current = masterGain
    }

    return audioContextRef.current
  }

  const getNoiseBuffer = (context: AudioContext, color: 'white' | 'pink') => {
    if (!noiseBuffersRef.current[color]) {
      noiseBuffersRef.current[color] = createNoiseBuffer(context, color)
    }

    return noiseBuffersRef.current[color]!
  }

  useEffect(() => {
    const context = audioContextRef.current
    const masterGain = masterGainRef.current

    if (context && masterGain) {
      masterGain.gain.setTargetAtTime(masterVolume / 100, context.currentTime, 0.05)
    }
  }, [masterVolume])

  const playTrackHit = (track: Track, context: AudioContext, when: number) => {
    const masterGain = masterGainRef.current
    if (!masterGain || track.components.length === 0) return

    const amplitude = clamp(track.level / 100, 0, 1) * 0.45

    const voiceGain = context.createGain()

    const envelope = track.envelope ?? {}
    const attack = envelope.attack ?? 0.01
    const decay = envelope.decay ?? 0.2
    const sustain = envelope.sustain ?? 0
    const hold = envelope.hold ?? 0
    const release = Math.max(0.01, envelope.release ?? 0.3)
    const sustainLevel = amplitude * sustain
    const sustainTime = when + attack + decay + hold

    voiceGain.gain.cancelScheduledValues(when)
    voiceGain.gain.setValueAtTime(0.0001, when)
    voiceGain.gain.linearRampToValueAtTime(amplitude, when + attack)
    voiceGain.gain.linearRampToValueAtTime(sustainLevel, when + attack + decay)
    voiceGain.gain.setValueAtTime(sustainLevel, sustainTime)
    voiceGain.gain.setTargetAtTime(0.0001, sustainTime, release)

    let trackOutput: AudioNode = voiceGain

    if (track.filter) {
      const filterNode = context.createBiquadFilter()
      filterNode.type = track.filter.type
      filterNode.frequency.setValueAtTime(track.filter.frequency, when)
      if (track.filter.Q !== undefined) {
        filterNode.Q.setValueAtTime(track.filter.Q, when)
      }
      if (track.filter.gain !== undefined) {
        filterNode.gain.setValueAtTime(track.filter.gain, when)
      }
      voiceGain.connect(filterNode)
      trackOutput = filterNode
    }

    trackOutput.connect(masterGain)

    const stopTime = when + attack + decay + hold + release * 4 + 0.4
    const pitchBend = 1 + Math.random() * 0.02 - 0.01

    track.components.forEach((component) => {
      if (component.kind === 'tone') {
        if (!track.baseFrequency) {
          return
        }

        const osc = context.createOscillator()
        osc.type = component.wave
        const ratio = component.ratio ?? 1
        const frequency = track.baseFrequency * ratio * pitchBend
        osc.frequency.setValueAtTime(frequency, when)
        if (component.detuneCents !== undefined) {
          osc.detune.setValueAtTime(component.detuneCents, when)
        }

        const componentGain = context.createGain()
        componentGain.gain.setValueAtTime(component.gain ?? 1, when)
        osc.connect(componentGain)
        componentGain.connect(voiceGain)

        osc.start(when)
        osc.stop(stopTime)
      } else {
        const source = context.createBufferSource()
        source.buffer = getNoiseBuffer(context, component.color)
        source.loop = false

        const noiseGain = context.createGain()
        noiseGain.gain.setValueAtTime(component.gain ?? 1, when)
        source.connect(noiseGain)

        let destination: AudioNode = noiseGain
        if (component.filter) {
          const noiseFilter = context.createBiquadFilter()
          noiseFilter.type = component.filter.type
          noiseFilter.frequency.setValueAtTime(component.filter.frequency, when)
          if (component.filter.Q !== undefined) {
            noiseFilter.Q.setValueAtTime(component.filter.Q, when)
          }
          if (component.filter.gain !== undefined) {
            noiseFilter.gain.setValueAtTime(component.filter.gain, when)
          }
          noiseGain.connect(noiseFilter)
          destination = noiseFilter
        }

        destination.connect(voiceGain)
        source.start(when)
        source.stop(stopTime)
      }
    })
  }

  const playStep = (index: number, context: AudioContext) => {
    const startTime = context.currentTime

    tracks.forEach((track) => {
      if (!track.enabled || !track.pattern[index]) {
        return
      }

      playTrackHit(track, context, startTime)
    })
  }

  useEffect(() => {
    if (!isPlaying) {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    const context = ensureAudio()
    if (!context) {
      return
    }

    void context.resume()

    let cancelled = false

    const loop = () => {
      if (cancelled) {
        return
      }

      const step = stepRef.current
      playStep(step, context)
      setCurrentStep(step)
      stepRef.current = (step + 1) % STEP_COUNT

      const baseBeatSeconds = 60 / tempo
      const swingRatio = swing / 100
      const swingAmount = swingRatio * 0.4
      const isEvenStep = step % 2 === 0
      const durationSeconds = baseBeatSeconds * (1 + (isEvenStep ? -swingAmount : swingAmount))

      timeoutRef.current = window.setTimeout(() => {
        loop()
      }, Math.max(0.1, durationSeconds) * 1000)
    }

    loop()

    return () => {
      cancelled = true
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isPlaying, tempo, swing, tracks])

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false)
      return
    }

    stepRef.current = 0
    setCurrentStep(0)
    setIsPlaying(true)
  }

  const markCustom = () => {
    if (selectedPresetId !== PRESET_CUSTOM_ID) {
      setSelectedPresetId(PRESET_CUSTOM_ID)
    }
  }

  const handleSelectPreset = (presetId: string) => {
    if (presetId === PRESET_CUSTOM_ID) {
      setSelectedPresetId(PRESET_CUSTOM_ID)
      return
    }

    const preset = presets.find((item) => item.id === presetId)
    if (!preset) {
      setSelectedPresetId(PRESET_CUSTOM_ID)
      return
    }

    setTracks((prev) =>
      prev.map((track) => {
        const presetTrack = preset.tracks[track.id]
        if (!presetTrack) {
          return track
        }

        const pattern = presetTrack.pattern.slice()
        const density = pattern.filter(Boolean).length
        const firstActive = pattern.findIndex((step) => step)

        return {
          ...track,
          pattern,
          density,
          offset: firstActive >= 0 ? firstActive : 0,
          enabled:
            typeof presetTrack.enabled === 'boolean' ? presetTrack.enabled : track.enabled,
          level:
            typeof presetTrack.level === 'number' ? presetTrack.level : track.level,
        }
      }),
    )

    setSelectedPresetId(presetId)
  }

  const updateTrack = (trackId: string, updater: (track: Track) => Track) => {
    setTracks((prev) => prev.map((track) => (track.id === trackId ? updater(track) : track)))
  }

  const handleStepToggle = (trackId: string, index: number) => {
    markCustom()
    updateTrack(trackId, (track) => {
      const pattern = track.pattern.map((value, stepIndex) =>
        stepIndex === index ? !value : value,
      )
      const density = pattern.filter(Boolean).length
      return {
        ...track,
        density,
        pattern,
      }
    })
  }

  const handleDensityChange = (trackId: string, density: number) => {
    markCustom()
    updateTrack(trackId, (track) => ({
      ...track,
      density,
      pattern: createEvenPattern(density, track.offset),
    }))
  }

  const handleOffsetChange = (trackId: string, offset: number) => {
    markCustom()
    updateTrack(trackId, (track) => ({
      ...track,
      offset,
      pattern: createEvenPattern(track.density, offset),
    }))
  }

  const handleLevelChange = (trackId: string, level: number) => {
    markCustom()
    updateTrack(trackId, (track) => ({
      ...track,
      level,
    }))
  }

  const handleToggleTrack = (trackId: string) => {
    markCustom()
    updateTrack(trackId, (track) => ({
      ...track,
      enabled: !track.enabled,
    }))
  }

  const handleClearTrack = (trackId: string) => {
    markCustom()
    updateTrack(trackId, (track) => ({
      ...track,
      density: 0,
      pattern: Array.from({ length: STEP_COUNT }, () => false),
    }))
  }

  const trackSummaries = useMemo(
    () =>
      tracks.map((track) => ({
        ...track,
        activeSteps: track.pattern.reduce((total, step) => total + (step ? 1 : 0), 0),
      })),
    [tracks],
  )

  const currentBar = Math.floor(currentStep / BEATS_PER_BAR)

  return (
    <div className="app">
      <header className="app__header">
        <div>
          <h1>Lo-Fi Beat Mixer</h1>
          <p>Create a cozy 16-bar groove and sculpt every texture to your taste.</p>
        </div>
        <button
          type="button"
          className={`play-button ${isPlaying ? 'play-button--active' : ''}`}
          onClick={togglePlay}
        >
          {isPlaying ? 'Stop Beat' : 'Play Beat'}
        </button>
      </header>

      <section
        className="viewport"
        aria-label="Beat layout viewport"
        style={{
          '--step-count': STEP_COUNT,
          '--beats-per-bar': BEATS_PER_BAR,
          '--label-column-width': '120px',
          '--beat-column-width': '36px',
        } as CSSProperties}
      >
        <div className="timeline" aria-label="Timeline markers">
          <div className="timeline__spacer" aria-hidden="true" />
          {Array.from({ length: BARS }, (_, barIndex) => (
            <div
              key={barIndex}
              className={`timeline__bar ${
                currentBar === barIndex ? 'timeline__bar--current' : ''
              }`}
              style={{ gridColumn: `span ${BEATS_PER_BAR}` }}
            >
              <span>Bar {barIndex + 1}</span>
            </div>
          ))}
          <div className="timeline__beats-label">Beats</div>
          {Array.from({ length: STEP_COUNT }, (_, beatIndex) => (
            <div
              key={beatIndex}
              className={`timeline__beat ${
                currentStep === beatIndex ? 'timeline__beat--current' : ''
              }`}
            >
              {(beatIndex % BEATS_PER_BAR) + 1}
            </div>
          ))}
        </div>

        <div className="track-grid">
          {trackSummaries.map((track) => (
            <div
              key={track.id}
              className="track-grid__row"
              style={{
                '--track-color': track.color,
              } as CSSProperties}
            >
              <div className="track-grid__label">
                <span className="track-grid__name">{track.name}</span>
                <span className="track-grid__meta">{track.activeSteps} hits</span>
              </div>
              <div className="track-grid__editor">
                <div className="track-grid__steps">
                  {track.pattern.map((active, index) => (
                    <button
                      key={index}
                      type="button"
                      className={`step ${active ? 'step--active' : ''} ${
                        currentStep === index ? 'step--current' : ''
                      } ${index % BEATS_PER_BAR === 0 ? 'step--bar-start' : ''}`}
                      onClick={() => handleStepToggle(track.id, index)}
                      aria-pressed={active}
                      aria-label={`${track.name} bar ${
                        Math.floor(index / BEATS_PER_BAR) + 1
                      } beat ${(index % BEATS_PER_BAR) + 1}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="track-grid__clear"
                  onClick={() => handleClearTrack(track.id)}
                >
                  Clear
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="control-panel">
        <div className="control-panel__group">
          <h2>Preset Beats</h2>
          <div className="preset-controls">
            <label className="preset-controls__label" htmlFor="preset-select">
              Choose a vibe
            </label>
            <div className="preset-controls__inputs">
              <select
                id="preset-select"
                value={selectedPresetId}
                onChange={(event) => handleSelectPreset(event.target.value)}
              >
                <option value={PRESET_CUSTOM_ID}>Custom mix</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
              {selectedPresetId !== PRESET_CUSTOM_ID ? (
                <span className="preset-controls__badge">Preset applied</span>
              ) : null}
            </div>
            <p className="preset-controls__description">{presetDescription}</p>
          </div>
        </div>

        <div className="control-panel__group">
          <h2>Master Controls</h2>
          <div className="control-grid">
            <div className="control">
              <label htmlFor="tempo-range">Tempo (BPM)</label>
              <div className="control__inputs">
                <input
                  id="tempo-range"
                  type="range"
                  min={50}
                  max={160}
                  value={tempo}
                  onChange={(event) => setTempo(Number(event.target.value))}
                />
                <input
                  type="number"
                  min={50}
                  max={160}
                  value={tempo}
                  onChange={(event) => setTempo(clamp(Number(event.target.value), 50, 160))}
                />
              </div>
            </div>
            <div className="control">
              <label htmlFor="swing-range">Swing</label>
              <div className="control__inputs">
                <input
                  id="swing-range"
                  type="range"
                  min={0}
                  max={100}
                  value={swing}
                  onChange={(event) => setSwing(Number(event.target.value))}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={swing}
                  onChange={(event) => setSwing(clamp(Number(event.target.value), 0, 100))}
                />
              </div>
            </div>
            <div className="control">
              <label htmlFor="volume-range">Master Volume</label>
              <div className="control__inputs">
                <input
                  id="volume-range"
                  type="range"
                  min={0}
                  max={100}
                  value={masterVolume}
                  onChange={(event) => setMasterVolume(Number(event.target.value))}
                />
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={masterVolume}
                  onChange={(event) =>
                    setMasterVolume(clamp(Number(event.target.value), 0, 100))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <div className="control-panel__group">
          <h2>Track Settings</h2>
          <div className="track-controls">
            {tracks.map((track) => (
              <article
                key={track.id}
                className="track-control"
                style={{
                  '--track-color': track.color,
                } as CSSProperties}
              >
                <header className="track-control__header">
                  <label className="track-control__toggle">
                    <input
                      type="checkbox"
                      checked={track.enabled}
                      onChange={() => handleToggleTrack(track.id)}
                    />
                    <span>{track.name}</span>
                  </label>
                  <span className="track-control__status">
                    {track.enabled ? 'Active' : 'Muted'}
                  </span>
                </header>
                <div className="track-control__inputs">
                  <div className="control control--inline">
                    <label htmlFor={`${track.id}-level`}>Level</label>
                    <div className="control__inputs">
                      <input
                        id={`${track.id}-level`}
                        type="range"
                        min={0}
                        max={100}
                        value={track.level}
                        onChange={(event) =>
                          handleLevelChange(track.id, Number(event.target.value))
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={track.level}
                        onChange={(event) =>
                          handleLevelChange(track.id, clamp(Number(event.target.value), 0, 100))
                        }
                      />
                    </div>
                  </div>
                  <div className="control control--inline">
                    <label htmlFor={`${track.id}-density`}>Density</label>
                    <div className="control__inputs">
                      <input
                        id={`${track.id}-density`}
                        type="range"
                        min={0}
                        max={STEP_COUNT}
                        value={track.density}
                        onChange={(event) =>
                          handleDensityChange(track.id, Number(event.target.value))
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={STEP_COUNT}
                        value={track.density}
                        onChange={(event) =>
                          handleDensityChange(
                            track.id,
                            clamp(Number(event.target.value), 0, STEP_COUNT),
                          )
                        }
                      />
                    </div>
                  </div>
                  <div className="control control--inline">
                    <label htmlFor={`${track.id}-offset`}>Offset</label>
                    <div className="control__inputs">
                      <input
                        id={`${track.id}-offset`}
                        type="range"
                        min={0}
                        max={STEP_COUNT - 1}
                        value={track.offset}
                        onChange={(event) =>
                          handleOffsetChange(track.id, Number(event.target.value))
                        }
                      />
                      <input
                        type="number"
                        min={0}
                        max={STEP_COUNT - 1}
                        value={track.offset}
                        onChange={(event) =>
                          handleOffsetChange(
                            track.id,
                            clamp(Number(event.target.value), 0, STEP_COUNT - 1),
                          )
                        }
                      />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

export default App
