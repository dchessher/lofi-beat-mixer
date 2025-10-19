import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const STEP_COUNT = 16

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

type Track = {
  id: string
  name: string
  color: string
  baseFrequency: number
  wave: OscillatorType
  enabled: boolean
  level: number
  density: number
  offset: number
  pattern: boolean[]
}

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

const defaultTracks: Track[] = [
  {
    id: 'kick',
    name: 'Kick',
    color: '#ff6b6b',
    baseFrequency: 90,
    wave: 'sine',
    enabled: true,
    level: 85,
    density: 4,
    offset: 0,
    pattern: createEvenPattern(4, 0),
  },
  {
    id: 'snare',
    name: 'Snare',
    color: '#ffd166',
    baseFrequency: 220,
    wave: 'triangle',
    enabled: true,
    level: 65,
    density: 4,
    offset: 2,
    pattern: createEvenPattern(4, 2),
  },
  {
    id: 'hat',
    name: 'Hi-Hat',
    color: '#06d6a0',
    baseFrequency: 640,
    wave: 'square',
    enabled: true,
    level: 50,
    density: 8,
    offset: 0,
    pattern: createEvenPattern(8, 0),
  },
  {
    id: 'chords',
    name: 'Chords',
    color: '#118ab2',
    baseFrequency: 330,
    wave: 'sawtooth',
    enabled: true,
    level: 45,
    density: 2,
    offset: 0,
    pattern: createEvenPattern(2, 0),
  },
]

function App() {
  const [tempo, setTempo] = useState(85)
  const [swing, setSwing] = useState(15)
  const [masterVolume, setMasterVolume] = useState(70)
  const [isPlaying, setIsPlaying] = useState(false)
  const [tracks, setTracks] = useState<Track[]>(defaultTracks)
  const [currentStep, setCurrentStep] = useState(0)

  const audioContextRef = useRef<AudioContext | null>(null)
  const masterGainRef = useRef<GainNode | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const stepRef = useRef(0)

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

  useEffect(() => {
    const context = audioContextRef.current
    const masterGain = masterGainRef.current

    if (context && masterGain) {
      masterGain.gain.setTargetAtTime(masterVolume / 100, context.currentTime, 0.05)
    }
  }, [masterVolume])

  const playTrackHit = (track: Track, context: AudioContext, when: number) => {
    const masterGain = masterGainRef.current
    if (!masterGain) return

    const osc = context.createOscillator()
    const gainNode = context.createGain()

    osc.type = track.wave
    osc.frequency.setValueAtTime(track.baseFrequency, when)

    const amplitude = clamp(track.level / 100, 0, 1) * 0.4
    gainNode.gain.setValueAtTime(amplitude, when)
    gainNode.gain.exponentialRampToValueAtTime(0.001, when + 0.5)

    osc.connect(gainNode)
    gainNode.connect(masterGain)

    osc.start(when)
    osc.stop(when + 0.6)
  }

  const playStep = (index: number, context: AudioContext) => {
    const startTime = context.currentTime

    tracks.forEach((track) => {
      if (!track.enabled || !track.pattern[index]) {
        return
      }

      const pitchBend = 1 + Math.random() * 0.02 - 0.01
      playTrackHit(
        {
          ...track,
          baseFrequency: track.baseFrequency * pitchBend,
        },
        context,
        startTime,
      )
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

  const updateTrack = (trackId: string, updater: (track: Track) => Track) => {
    setTracks((prev) => prev.map((track) => (track.id === trackId ? updater(track) : track)))
  }

  const handleStepToggle = (trackId: string, index: number) => {
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
    updateTrack(trackId, (track) => ({
      ...track,
      density,
      pattern: createEvenPattern(density, track.offset),
    }))
  }

  const handleOffsetChange = (trackId: string, offset: number) => {
    updateTrack(trackId, (track) => ({
      ...track,
      offset,
      pattern: createEvenPattern(track.density, offset),
    }))
  }

  const handleLevelChange = (trackId: string, level: number) => {
    updateTrack(trackId, (track) => ({
      ...track,
      level,
    }))
  }

  const handleToggleTrack = (trackId: string) => {
    updateTrack(trackId, (track) => ({
      ...track,
      enabled: !track.enabled,
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

      <section className="viewport" aria-label="Beat layout viewport">
        <div className="timeline" role="list" aria-label="Timeline markers">
          {Array.from({ length: STEP_COUNT }, (_, index) => (
            <div
              key={index}
              className={`timeline__bar ${currentStep === index ? 'timeline__bar--current' : ''}`}
              role="listitem"
            >
              <span>Bar {index + 1}</span>
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
              <div className="track-grid__steps">
                {track.pattern.map((active, index) => (
                  <button
                    key={index}
                    type="button"
                    className={`step ${active ? 'step--active' : ''} ${
                      currentStep === index ? 'step--current' : ''
                    }`}
                    onClick={() => handleStepToggle(track.id, index)}
                    aria-pressed={active}
                    aria-label={`${track.name} bar ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="control-panel">
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
