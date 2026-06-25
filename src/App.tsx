import { useMemo, useRef, useState } from 'react';
import { Activity, Gauge, Pause, Play, RotateCcw, Satellite, TimerReset } from 'lucide-react';
import { HandTrackingPanel } from './components/HandTrackingPanel';
import { SolarSystemScene } from './components/SolarSystemScene';
import { planets, type PlanetId } from './data/planets';
import { type GestureCommand, initialHandTrackingState } from './gesture/gestureTypes';

type Metrics = {
  fps: number;
  simDay: number;
  renderMs: number;
};

const defaultMetrics: Metrics = {
  fps: 0,
  simDay: 0,
  renderMs: 0
};

export function App() {
  const [selectedPlanetId, setSelectedPlanetId] = useState<PlanetId>('earth');
  const [paused, setPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(80);
  const [metrics, setMetrics] = useState(defaultMetrics);
  const [handState, setHandState] = useState(initialHandTrackingState);
  const sceneCommandQueueRef = useRef<GestureCommand[]>([]);

  const selectedPlanet = useMemo(
    () => planets.find((planet) => planet.id === selectedPlanetId) ?? planets[2],
    [selectedPlanetId]
  );

  const handEngaged = handState.status === 'tracking' || handState.status === 'lost';
  const lowFpsHandMode = handEngaged && metrics.fps > 0 && metrics.fps < 24;

  const resetBaseline = () => {
    setSelectedPlanetId('earth');
    setPaused(false);
    setTimeScale(80);
  };

  const handleGestureCommand = (command: GestureCommand) => {
    if (command.type === 'togglePause') {
      setPaused((value) => !value);
      return;
    }

    if (command.type === 'setTimeScale') {
      setTimeScale(command.value);
      return;
    }

    if (command.type === 'selectPlanet') {
      setSelectedPlanetId(command.planetId);
      return;
    }

    sceneCommandQueueRef.current.push(command);
    if (sceneCommandQueueRef.current.length > 28) {
      sceneCommandQueueRef.current.splice(0, sceneCommandQueueRef.current.length - 28);
    }
  };

  return (
    <main
      className={['app-shell', handEngaged ? 'hand-engaged' : '', lowFpsHandMode ? 'low-fps' : '']
        .filter(Boolean)
        .join(' ')}
    >
      <SolarSystemScene
        selectedPlanetId={selectedPlanetId}
        paused={paused}
        timeScale={timeScale}
        handEngaged={handEngaged}
        commandQueueRef={sceneCommandQueueRef}
        onSelectPlanet={setSelectedPlanetId}
        onMetrics={setMetrics}
      />

      <HandTrackingPanel
        state={handState}
        renderFps={metrics.fps}
        onStateChange={setHandState}
        onCommand={handleGestureCommand}
      />

      <header className="top-bar" aria-label="Mission status">
        <div className="brand-block">
          <span className="brand-kicker">Gesture Orrery</span>
          <h1>手势太阳系仪</h1>
        </div>

        <div className="status-strip">
          <div className="metric" data-testid="fps-metric">
            <Activity size={16} aria-hidden="true" />
            <span>{metrics.fps} FPS</span>
          </div>
          <div className="metric" data-testid="sim-day-metric">
            <TimerReset size={16} aria-hidden="true" />
            <span>Day {metrics.simDay.toFixed(1)}</span>
          </div>
          <div className="metric">
            <Gauge size={16} aria-hidden="true" />
            <span>{timeScale}x</span>
          </div>
          <div className="metric" data-testid="render-metric">
            <span>{metrics.renderMs.toFixed(1)} ms</span>
          </div>
        </div>
      </header>

      <aside className="inspector" aria-label="Selected planet inspector">
        <section className="planet-focus">
          <span className="section-label">Selected body</span>
          <h2 data-testid="selected-planet">{selectedPlanet.nameZh}</h2>
          <p>{selectedPlanet.summary}</p>
        </section>

        <section className="data-table" aria-label="Planet data">
          <div>
            <span>Class</span>
            <strong>{selectedPlanet.type}</strong>
          </div>
          <div>
            <span>Diameter</span>
            <strong>{selectedPlanet.realDiameterKm.toLocaleString()} km</strong>
          </div>
          <div>
            <span>Distance</span>
            <strong>{selectedPlanet.realDistanceAu.toFixed(2)} AU</strong>
          </div>
          <div>
            <span>Orbit period</span>
            <strong>{selectedPlanet.orbitalPeriodDays.toLocaleString()} days</strong>
          </div>
          <div>
            <span>Inclination</span>
            <strong>{selectedPlanet.orbitalInclinationDeg.toFixed(2)} deg</strong>
          </div>
          <div>
            <span>Moons</span>
            <strong>{selectedPlanet.knownMoons}</strong>
          </div>
        </section>

        <section className="control-panel" aria-label="Simulation controls">
          <div className="control-row">
            <button
              className="icon-button primary"
              type="button"
              aria-label={paused ? 'Resume simulation' : 'Pause simulation'}
              onClick={() => setPaused((value) => !value)}
            >
              {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
            </button>
            <button className="icon-button" type="button" aria-label="Reset baseline" onClick={resetBaseline}>
              <RotateCcw size={18} aria-hidden="true" />
            </button>
            <span className="state-pill" data-testid="playback-state">
              {paused ? 'Paused' : 'Running'}
            </span>
          </div>

          <label className="slider-row">
            <span>Time scale</span>
            <input
              aria-label="Time scale"
              type="range"
              min="0"
              max="240"
              step="10"
              value={timeScale}
              onChange={(event) => setTimeScale(Number(event.target.value))}
            />
          </label>
        </section>

        <section className="planet-list" aria-label="Planet selector">
          {planets.map((planet) => (
            <button
              key={planet.id}
              type="button"
              className={planet.id === selectedPlanetId ? 'planet-row active' : 'planet-row'}
              onClick={() => setSelectedPlanetId(planet.id)}
              data-testid={`planet-row-${planet.id}`}
            >
              <span className="planet-swatch" style={{ backgroundColor: planet.accent }} />
              <span>{planet.nameZh}</span>
              <small>{planet.name}</small>
            </button>
          ))}
        </section>
      </aside>

      <footer className="input-bar" aria-label="Input status">
        <div className="input-mode">
          <Satellite size={18} aria-hidden="true" />
          <div>
            <span>Control source</span>
            <strong>{handState.status === 'tracking' ? 'Camera hand' : 'Mouse baseline'}</strong>
          </div>
        </div>
        <div className="gesture-state" data-testid="gesture-state">
          <span>{handState.message}</span>
          <strong data-testid="hand-tracking-status">{handState.status}</strong>
        </div>
        <div className="gesture-state" data-testid="hand-metrics">
          <span>{handState.hands} hand</span>
          <strong>{Math.round(handState.confidence * 100)}% / {handState.latencyMs.toFixed(1)}ms</strong>
        </div>
        <div className="cycle-state">
          <span>Cycle</span>
          <strong>Cycle 17</strong>
        </div>
      </footer>
    </main>
  );
}
