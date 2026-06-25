import { type MutableRefObject, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { planets, type MajorMoon, type Planet, type PlanetId, type PlanetTextureKind } from '../data/planets';
import type { GestureCommand } from '../gesture/gestureTypes';
import {
  createCloudTexture,
  createPlanetBumpTexture,
  createPlanetTexture,
  createRingTexture
} from '../scene/proceduralTextures';

type SceneMetrics = {
  fps: number;
  simDay: number;
  renderMs: number;
};

type SolarSystemSceneProps = {
  selectedPlanetId: PlanetId;
  paused: boolean;
  timeScale: number;
  handEngaged: boolean;
  commandQueueRef: MutableRefObject<GestureCommand[]>;
  onSelectPlanet: (planetId: PlanetId) => void;
  onMetrics: (metrics: SceneMetrics) => void;
};

type MoonRuntime = {
  moon: MajorMoon;
  root: THREE.Object3D;
  mesh: THREE.Mesh;
  label: THREE.Sprite;
};

type PlanetRuntime = {
  planet: Planet;
  orbitPlane: THREE.Object3D;
  bodyGroup: THREE.Group;
  axisGroup: THREE.Group;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  cloudMesh?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  atmosphere?: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  surfaceDetails: THREE.Group;
  surfaceMicroDetails: THREE.Points;
  surfaceFeatureLabels: THREE.Group;
  referenceGuide: THREE.Group;
  fieldLines: THREE.Group;
  orbitMarkers: THREE.Group;
  orbitTicks: THREE.LineSegments;
  orbit: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  label: THREE.Sprite;
  selectionHalo: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  moons: MoonRuntime[];
  nightLights?: THREE.Points;
};

type SpaceGestureBase = {
  sessionId: number;
  cameraDirection: THREE.Vector3;
  cameraDistance: number;
  target: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
  systemRotation: THREE.Euler;
};

type SpaceGestureTarget = {
  sessionId: number;
  cameraPosition: THREE.Vector3;
  target: THREE.Vector3;
  rotationX: number;
  rotationY: number;
};

type PinchGestureBase = {
  sessionId: number;
  cameraDirection: THREE.Vector3;
  cameraDistance: number;
  target: THREE.Vector3;
  right: THREE.Vector3;
  up: THREE.Vector3;
};

type PinchGestureTarget = {
  sessionId: number;
  cameraPosition: THREE.Vector3;
  target: THREE.Vector3;
};

type PinchGestureSignal = {
  sessionId: number;
  timestamp: number;
  centerDeltaX: number;
  centerDeltaY: number;
  logScale: number;
  centerVelocityX: number;
  centerVelocityY: number;
  logScaleVelocity: number;
  predictedMs: number;
};

type PlanetFocusTarget = {
  planetId: PlanetId;
  cameraPosition: THREE.Vector3;
  target: THREE.Vector3;
};

type SpaceGestureSignal = {
  sessionId: number;
  timestamp: number;
  centerDeltaX: number;
  centerDeltaY: number;
  logScale: number;
  rotationDelta: number;
  centerVelocityX: number;
  centerVelocityY: number;
  logScaleVelocity: number;
  rotationVelocity: number;
  predictedMs: number;
};

type CommandStats = {
  raw: number;
  coalesced: number;
  droppedDirect: number;
};

declare global {
  interface Window {
    __orreryDebug?: {
      getPlanetScreenPosition: (planetId: PlanetId) => { x: number; y: number } | null;
      pushCommand: (command: GestureCommand) => void;
      getNavigationState: () => {
        cameraDistance: number;
        target: { x: number; y: number; z: number };
        systemRotation: { x: number; y: number; z: number };
      };
      getSpaceControlState: () => {
        active: boolean;
        cameraDistance: number;
        targetDistance: number | null;
        targetError: number | null;
        predictedMs: number;
      };
      getPinchControlState: () => {
        active: boolean;
        cameraDistance: number;
        targetDistance: number | null;
        targetError: number | null;
        predictedMs: number;
      };
      getCommandStats: () => CommandStats;
      getModelStats: () => {
        planets: number;
        majorMoons: number;
        surfaceDetailLayers: number;
        surfaceFeatureCount: number;
        surfaceMicroPoints: number;
        surfaceFeatureLabels: number;
        orbitMarkers: number;
        orbitTicks: number;
        fieldLines: number;
        nightLightPoints: number;
        namedMinorBodies: number;
        ringSystems: number;
      };
    };
  }
}

const dayStepAtScaleOne = 2.4;
const spaceControlFollowRate = 42;
const spaceControlPanScale = 1.05;
const spaceControlZoomExponent = 1.34;
const spaceControlTiltScale = 0.38;
const spaceControlRotationScale = 1.42;
const spaceControlPredictionWindowSeconds = 0.095;
const spaceControlPredictionHoldSeconds = 0.11;
const spaceControlPredictionFadeSeconds = 0.12;
const spaceControlMaxPredictedCenterDelta = 0.055;
const spaceControlMaxPredictedLogScale = 0.2;
const spaceControlMaxPredictedRotation = 0.11;
const pinchControlFollowRate = 34;
const pinchControlPanScale = 0.74;
const pinchControlZoomExponent = 1.18;
const pinchControlPredictionWindowSeconds = 0.08;
const pinchControlPredictionHoldSeconds = 0.1;
const pinchControlPredictionFadeSeconds = 0.12;
const pinchControlMaxPredictedCenterDelta = 0.045;
const pinchControlMaxPredictedLogScale = 0.16;
const planetFocusFollowRate = 7.5;

export function SolarSystemScene({
  selectedPlanetId,
  paused,
  timeScale,
  handEngaged,
  commandQueueRef,
  onSelectPlanet,
  onMetrics
}: SolarSystemSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef(selectedPlanetId);
  const pausedRef = useRef(paused);
  const timeScaleRef = useRef(timeScale);
  const handEngagedRef = useRef(handEngaged);
  const onSelectRef = useRef(onSelectPlanet);
  const onMetricsRef = useRef(onMetrics);

  useEffect(() => {
    selectedRef.current = selectedPlanetId;
  }, [selectedPlanetId]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    timeScaleRef.current = timeScale;
  }, [timeScale]);

  useEffect(() => {
    handEngagedRef.current = handEngaged;
  }, [handEngaged]);

  useEffect(() => {
    onSelectRef.current = onSelectPlanet;
  }, [onSelectPlanet]);

  useEffect(() => {
    onMetricsRef.current = onMetrics;
  }, [onMetrics]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#040507');
    scene.fog = new THREE.FogExp2('#040507', 0.0048);

    const camera = new THREE.PerspectiveCamera(49, host.clientWidth / host.clientHeight, 0.1, 180);
    camera.position.set(-6.5, 11.5, 24);
    let adaptiveInteractionQuality = 1.24;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: new URLSearchParams(window.location.search).has('capture')
    });
    renderer.setPixelRatio(getRenderPixelRatio(host, handEngagedRef.current, adaptiveInteractionQuality));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.22;
    renderer.domElement.dataset.testid = 'orrery-canvas';
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 4.4;
    controls.maxDistance = 62;
    controls.maxPolarAngle = Math.PI * 0.84;
    controls.target.set(0, 0, 0);

    const systemGroup = new THREE.Group();
    systemGroup.rotation.x = -0.12;
    scene.add(systemGroup);

    const ambient = new THREE.AmbientLight('#c1d2ff', 0.36);
    scene.add(ambient);

    const sunLight = new THREE.PointLight('#ffe0a6', 24, 132, 1.12);
    sunLight.position.set(0, 0, 0);
    systemGroup.add(sunLight);

    const rimLight = new THREE.DirectionalLight('#9bd0ff', 0.82);
    rimLight.position.set(-18, 18, 26);
    scene.add(rimLight);

    const starField = createStarField();
    scene.add(starField);

    const eclipticPlane = createEclipticPlane();
    systemGroup.add(eclipticPlane);

    const sun = createSun();
    systemGroup.add(sun);

    const spaceAnchorMarker = createSpaceAnchorMarker();
    spaceAnchorMarker.visible = false;
    scene.add(spaceAnchorMarker);

    const asteroidBelt = createDebrisBelt(11.9, 13.0, 1000, '#d8c3a0', 'asteroids');
    systemGroup.add(asteroidBelt);

    const namedMinorBodies = createNamedMinorBodies();
    systemGroup.add(namedMinorBodies);

    const kuiperBelt = createDebrisBelt(29.5, 34.8, 1200, '#a8c7df', 'kuiper');
    systemGroup.add(kuiperBelt);

    const runtimes = planets.map((planet) => {
      const orbitPlane = new THREE.Object3D();
      orbitPlane.rotation.x = THREE.MathUtils.degToRad(planet.orbitalInclinationDeg);
      systemGroup.add(orbitPlane);

      const orbit = createOrbit(planet);
      orbitPlane.add(orbit);

      const orbitMarkers = createOrbitMarkers(planet);
      orbitPlane.add(orbitMarkers);

      const orbitTicks = createOrbitTicks(planet);
      orbitPlane.add(orbitTicks);

      const bodyGroup = new THREE.Group();
      orbitPlane.add(bodyGroup);

      const axisGroup = new THREE.Group();
      axisGroup.rotation.z = THREE.MathUtils.degToRad(planet.axialTiltDeg);
      bodyGroup.add(axisGroup);

      const mesh = createPlanetMesh(planet);
      mesh.userData.planetId = planet.id;
      axisGroup.add(mesh);

      const atmosphere = createAtmosphere(planet);
      if (atmosphere) {
        axisGroup.add(atmosphere);
      }

      const cloudMesh = createCloudShell(planet);
      if (cloudMesh) {
        axisGroup.add(cloudMesh);
      }

      if (planet.ring) {
        axisGroup.add(createRingSystem(planet));
      }

      const surfaceDetails = createSurfaceDetailLayer(planet);
      axisGroup.add(surfaceDetails);

      const surfaceMicroDetails = createSurfaceMicroDetails(planet);
      axisGroup.add(surfaceMicroDetails);

      const surfaceFeatureLabels = createSurfaceFeatureLabels(planet);
      axisGroup.add(surfaceFeatureLabels);

      const nightLights = createNightLights(planet);
      if (nightLights) {
        axisGroup.add(nightLights);
      }

      const referenceGuide = createReferenceGuide(planet);
      bodyGroup.add(referenceGuide);

      const fieldLines = createPlanetFieldLines(planet);
      bodyGroup.add(fieldLines);

      const moons = createMoons(planet);
      for (const moon of moons) {
        bodyGroup.add(moon.root);
      }

      const label = createLabel(planet);
      label.position.set(0, planet.radius + 0.92, 0);
      bodyGroup.add(label);

      const selectionHalo = createSelectionHalo(planet);
      bodyGroup.add(selectionHalo);

      return {
        planet,
        orbitPlane,
        bodyGroup,
        axisGroup,
        mesh,
        cloudMesh,
        atmosphere,
        surfaceDetails,
        surfaceMicroDetails,
        surfaceFeatureLabels,
        referenceGuide,
        fieldLines,
        orbitMarkers,
        orbitTicks,
        orbit,
        label,
        selectionHalo,
        moons,
        nightLights
      };
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let simDay = 0;
    let frameCount = 0;
    let fps = 0;
    let lastFrame = performance.now();
    let lastMetrics = performance.now();
    const navigationVelocity = {
      rotateX: 0,
      rotateY: 0,
      zoom: 0,
      panX: 0,
      panY: 0
    };
    let spaceGestureBase: SpaceGestureBase | null = null;
    let spaceGestureTarget: SpaceGestureTarget | null = null;
    let spaceGestureSignal: SpaceGestureSignal | null = null;
    let pinchGestureBase: PinchGestureBase | null = null;
    let pinchGestureTarget: PinchGestureTarget | null = null;
    let pinchGestureSignal: PinchGestureSignal | null = null;
    let planetFocusTarget: PlanetFocusTarget | null = null;
    let lastSelectedFocusId: PlanetId = selectedRef.current;
    let lastCommandStats: CommandStats = { raw: 0, coalesced: 0, droppedDirect: 0 };
    let raf = 0;

    const resize = () => {
      if (!host.clientWidth || !host.clientHeight) return;
      camera.aspect = host.clientWidth / host.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(getRenderPixelRatio(host, handEngagedRef.current, adaptiveInteractionQuality));
      renderer.setSize(host.clientWidth, host.clientHeight);
    };

    const selectFromPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      raycaster.setFromCamera(pointer, camera);

      const planetMeshes = runtimes.map((runtime) => runtime.mesh);
      const intersections = raycaster.intersectObjects(planetMeshes, false);
      const hit = intersections[0]?.object.userData.planetId as PlanetId | undefined;
      if (hit) {
        onSelectRef.current(hit);
      }
    };

    const getPlanetScreenPosition = (planetId: PlanetId) => {
      const runtime = runtimes.find((item) => item.planet.id === planetId);
      if (!runtime) return null;

      const worldPosition = new THREE.Vector3();
      runtime.mesh.getWorldPosition(worldPosition);
      worldPosition.project(camera);

      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: rect.left + ((worldPosition.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - worldPosition.y) / 2) * rect.height
      };
    };

    const pushCommand = (command: GestureCommand) => {
      commandQueueRef.current.push(command);
    };

    const getNavigationState = () => ({
      cameraDistance: camera.position.distanceTo(controls.target),
      target: {
        x: controls.target.x,
        y: controls.target.y,
        z: controls.target.z
      },
      systemRotation: {
        x: systemGroup.rotation.x,
        y: systemGroup.rotation.y,
        z: systemGroup.rotation.z
      }
    });

    const getSpaceControlState = () => {
      if (!spaceGestureTarget) {
        return {
          active: false,
          cameraDistance: camera.position.distanceTo(controls.target),
          targetDistance: null,
          targetError: null,
          predictedMs: 0
        };
      }

      const cameraError = camera.position.distanceTo(spaceGestureTarget.cameraPosition);
      const targetError = controls.target.distanceTo(spaceGestureTarget.target);
      const rotationError =
        Math.abs(systemGroup.rotation.x - spaceGestureTarget.rotationX) +
        Math.abs(systemGroup.rotation.y - spaceGestureTarget.rotationY);

      return {
        active: true,
        cameraDistance: camera.position.distanceTo(controls.target),
        targetDistance: spaceGestureTarget.cameraPosition.distanceTo(spaceGestureTarget.target),
        targetError: cameraError + targetError + rotationError * 3,
        predictedMs: spaceGestureSignal?.predictedMs ?? 0
      };
    };

    const getPinchControlState = () => {
      if (!pinchGestureTarget) {
        return {
          active: false,
          cameraDistance: camera.position.distanceTo(controls.target),
          targetDistance: null,
          targetError: null,
          predictedMs: 0
        };
      }

      const cameraError = camera.position.distanceTo(pinchGestureTarget.cameraPosition);
      const targetError = controls.target.distanceTo(pinchGestureTarget.target);

      return {
        active: true,
        cameraDistance: camera.position.distanceTo(controls.target),
        targetDistance: pinchGestureTarget.cameraPosition.distanceTo(pinchGestureTarget.target),
        targetError: cameraError + targetError,
        predictedMs: pinchGestureSignal?.predictedMs ?? 0
      };
    };

    const queuePlanetFocus = (planetId: PlanetId) => {
      const runtime = runtimes.find((item) => item.planet.id === planetId);
      if (!runtime) return;

      const worldPosition = new THREE.Vector3();
      runtime.mesh.getWorldPosition(worldPosition);
      const viewingDirection = camera.position.clone().sub(controls.target).normalize();
      const focusDistance = THREE.MathUtils.clamp(runtime.planet.radius * 8.5 + 3.8, 5.2, 14);
      const liftedTarget = worldPosition.clone().add(new THREE.Vector3(0, runtime.planet.radius * 0.18, 0));
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize();
      const inspectorOffset = host.clientWidth >= 960 ? right.multiplyScalar(focusDistance * 0.22) : new THREE.Vector3();
      const framedTarget = liftedTarget.clone().add(inspectorOffset);
      planetFocusTarget = {
        planetId,
        target: framedTarget,
        cameraPosition: framedTarget.clone().add(viewingDirection.multiplyScalar(focusDistance))
      };
    };

    const updateSelectedPlanetFocus = () => {
      const nextSelected = selectedRef.current;
      if (nextSelected === lastSelectedFocusId) return;
      lastSelectedFocusId = nextSelected;
      if (pinchGestureTarget || spaceGestureTarget) return;
      queuePlanetFocus(nextSelected);
    };

    const updatePlanetFocus = (deltaSeconds: number) => {
      if (!planetFocusTarget) return;

      const alpha = 1 - Math.exp(-planetFocusFollowRate * deltaSeconds);
      camera.position.lerp(planetFocusTarget.cameraPosition, alpha);
      controls.target.lerp(planetFocusTarget.target, alpha);

      const cameraError = camera.position.distanceTo(planetFocusTarget.cameraPosition);
      const targetError = controls.target.distanceTo(planetFocusTarget.target);
      if (cameraError + targetError < 0.025) {
        planetFocusTarget = null;
      }
    };

    const getModelStats = () => ({
      planets: runtimes.length,
      majorMoons: runtimes.reduce((sum, runtime) => sum + runtime.moons.length, 0),
      surfaceDetailLayers: runtimes.filter((runtime) => runtime.surfaceDetails.children.length > 0).length,
      surfaceFeatureCount: runtimes.reduce((sum, runtime) => sum + runtime.surfaceDetails.children.length, 0),
      surfaceMicroPoints: runtimes.reduce((sum, runtime) => sum + Number(runtime.surfaceMicroDetails.userData.pointCount ?? 0), 0),
      surfaceFeatureLabels: runtimes.reduce((sum, runtime) => sum + runtime.surfaceFeatureLabels.children.length, 0),
      orbitMarkers: runtimes.reduce((sum, runtime) => sum + runtime.orbitMarkers.children.length, 0),
      orbitTicks: runtimes.reduce((sum, runtime) => sum + Number(runtime.orbitTicks.userData.tickCount ?? 0), 0),
      fieldLines: runtimes.reduce((sum, runtime) => sum + runtime.fieldLines.children.length, 0),
      nightLightPoints: runtimes.reduce((sum, runtime) => sum + Number(runtime.nightLights?.userData.pointCount ?? 0), 0),
      namedMinorBodies: Number(namedMinorBodies.userData.bodyCount ?? namedMinorBodies.children.length),
      ringSystems: runtimes.filter((runtime) => Boolean(runtime.planet.ring)).length
    });

    const getCommandStats = () => lastCommandStats;

    window.__orreryDebug = {
      getPlanetScreenPosition,
      pushCommand,
      getNavigationState,
      getSpaceControlState,
      getPinchControlState,
      getCommandStats,
      getModelStats
    };

    const stopNavigationInertia = () => {
      navigationVelocity.rotateX = 0;
      navigationVelocity.rotateY = 0;
      navigationVelocity.zoom = 0;
      navigationVelocity.panX = 0;
      navigationVelocity.panY = 0;
    };

    const beginSpaceControl = (sessionId: number) => {
      pinchGestureBase = null;
      pinchGestureTarget = null;
      pinchGestureSignal = null;
      const offset = camera.position.clone().sub(controls.target);
      spaceGestureBase = {
        sessionId,
        cameraDirection: offset.normalize(),
        cameraDistance: camera.position.distanceTo(controls.target),
        target: controls.target.clone(),
        right: new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize(),
        up: new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).normalize(),
        systemRotation: systemGroup.rotation.clone()
      };
      spaceGestureTarget = {
        sessionId,
        cameraPosition: camera.position.clone(),
        target: controls.target.clone(),
        rotationX: systemGroup.rotation.x,
        rotationY: systemGroup.rotation.y
      };
      spaceGestureSignal = null;
      spaceAnchorMarker.visible = true;
      spaceAnchorMarker.position.copy(controls.target);
      stopNavigationInertia();
    };

    const beginPinchControl = (sessionId: number) => {
      spaceGestureBase = null;
      spaceGestureTarget = null;
      spaceGestureSignal = null;
      const offset = camera.position.clone().sub(controls.target);
      pinchGestureBase = {
        sessionId,
        cameraDirection: offset.normalize(),
        cameraDistance: camera.position.distanceTo(controls.target),
        target: controls.target.clone(),
        right: new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize(),
        up: new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).normalize()
      };
      pinchGestureTarget = {
        sessionId,
        cameraPosition: camera.position.clone(),
        target: controls.target.clone()
      };
      pinchGestureSignal = null;
      spaceAnchorMarker.visible = true;
      spaceAnchorMarker.position.copy(controls.target);
      stopNavigationInertia();
    };

    const setPinchTargetFromSignal = (
      sessionId: number,
      centerDeltaX: number,
      centerDeltaY: number,
      scaleRatio: number
    ) => {
      if (!pinchGestureBase) return;

      const clampedScaleRatio = THREE.MathUtils.clamp(scaleRatio, 0.45, 2.35);
      const nextDistance = THREE.MathUtils.clamp(
        pinchGestureBase.cameraDistance / Math.pow(clampedScaleRatio, pinchControlZoomExponent),
        controls.minDistance,
        controls.maxDistance
      );
      const panScale = THREE.MathUtils.clamp(pinchGestureBase.cameraDistance * pinchControlPanScale, 3.6, 24);
      const panOffset = pinchGestureBase.right
        .clone()
        .multiplyScalar(-centerDeltaX * panScale)
        .add(pinchGestureBase.up.clone().multiplyScalar(centerDeltaY * panScale));
      const nextTarget = pinchGestureBase.target.clone().add(panOffset);

      pinchGestureTarget = {
        sessionId,
        cameraPosition: nextTarget.clone().add(pinchGestureBase.cameraDirection.clone().multiplyScalar(nextDistance)),
        target: nextTarget
      };
    };

    const rebasePinchControl = (sessionId: number) => {
      if (!pinchGestureTarget) return;

      const direction = pinchGestureTarget.cameraPosition.clone().sub(pinchGestureTarget.target).normalize();
      pinchGestureBase = {
        sessionId,
        cameraDirection: direction,
        cameraDistance: pinchGestureTarget.cameraPosition.distanceTo(pinchGestureTarget.target),
        target: pinchGestureTarget.target.clone(),
        right: new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize(),
        up: new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).normalize()
      };
      pinchGestureSignal = null;
    };

    const applyPinchControlMove = (
      command: Extract<GestureCommand, { type: 'pinchControl'; phase: 'move' | 'rebase' }>
    ) => {
      if (!pinchGestureBase || pinchGestureBase.sessionId !== command.sessionId) {
        beginPinchControl(command.sessionId);
      }

      if (!pinchGestureBase) return;

      const now = performance.now();
      const previousSignal = pinchGestureSignal?.sessionId === command.sessionId ? pinchGestureSignal : null;
      const deltaSeconds = previousSignal ? clampNumber((now - previousSignal.timestamp) / 1000, 0.016, 0.16) : 0;
      const logScale = Math.log(THREE.MathUtils.clamp(command.scaleRatio, 0.45, 2.35));
      const centerVelocityX = previousSignal ? (command.centerDeltaX - previousSignal.centerDeltaX) / deltaSeconds : 0;
      const centerVelocityY = previousSignal ? (command.centerDeltaY - previousSignal.centerDeltaY) / deltaSeconds : 0;
      const logScaleVelocity = previousSignal ? (logScale - previousSignal.logScale) / deltaSeconds : 0;

      pinchGestureSignal = {
        sessionId: command.sessionId,
        timestamp: now,
        centerDeltaX: command.centerDeltaX,
        centerDeltaY: command.centerDeltaY,
        logScale,
        centerVelocityX,
        centerVelocityY,
        logScaleVelocity,
        predictedMs: 0
      };
      setPinchTargetFromSignal(command.sessionId, command.centerDeltaX, command.centerDeltaY, command.scaleRatio);
      if (command.phase === 'rebase') {
        rebasePinchControl(command.sessionId);
      }
      stopNavigationInertia();
    };

    const updatePredictedPinchTarget = () => {
      if (!pinchGestureBase || !pinchGestureSignal || pinchGestureBase.sessionId !== pinchGestureSignal.sessionId) return;

      const elapsedSeconds = Math.max(0, (performance.now() - pinchGestureSignal.timestamp) / 1000);
      const lookAheadSeconds = Math.min(elapsedSeconds, pinchControlPredictionWindowSeconds);
      const fade =
        elapsedSeconds <= pinchControlPredictionHoldSeconds
          ? 1
          : clampNumber(
              1 - (elapsedSeconds - pinchControlPredictionHoldSeconds) / pinchControlPredictionFadeSeconds,
              0,
              1
            );

      const predictedCenterX =
        pinchGestureSignal.centerDeltaX +
        clampNumber(
          pinchGestureSignal.centerVelocityX * lookAheadSeconds * fade,
          -pinchControlMaxPredictedCenterDelta,
          pinchControlMaxPredictedCenterDelta
        );
      const predictedCenterY =
        pinchGestureSignal.centerDeltaY +
        clampNumber(
          pinchGestureSignal.centerVelocityY * lookAheadSeconds * fade,
          -pinchControlMaxPredictedCenterDelta,
          pinchControlMaxPredictedCenterDelta
        );
      const predictedScaleRatio = Math.exp(
        pinchGestureSignal.logScale +
          clampNumber(
            pinchGestureSignal.logScaleVelocity * lookAheadSeconds * fade,
            -pinchControlMaxPredictedLogScale,
            pinchControlMaxPredictedLogScale
          )
      );

      pinchGestureSignal.predictedMs = lookAheadSeconds * fade * 1000;
      setPinchTargetFromSignal(pinchGestureSignal.sessionId, predictedCenterX, predictedCenterY, predictedScaleRatio);
    };

    const updatePinchControl = (deltaSeconds: number) => {
      if (!pinchGestureTarget) return;
      updatePredictedPinchTarget();
      const cameraError = camera.position.distanceTo(pinchGestureTarget.cameraPosition);
      const targetError = controls.target.distanceTo(pinchGestureTarget.target);
      const alpha = getAdaptiveDirectControlAlpha(pinchControlFollowRate, deltaSeconds, cameraError + targetError);
      camera.position.lerp(pinchGestureTarget.cameraPosition, alpha);
      controls.target.lerp(pinchGestureTarget.target, alpha);
    };

    const setSpaceTargetFromSignal = (
      sessionId: number,
      centerDeltaX: number,
      centerDeltaY: number,
      scaleRatio: number,
      rotationDelta: number
    ) => {
      if (!spaceGestureBase) return;

      const clampedScaleRatio = THREE.MathUtils.clamp(scaleRatio, 0.34, 3.25);
      const nextDistance = THREE.MathUtils.clamp(
        spaceGestureBase.cameraDistance / Math.pow(clampedScaleRatio, spaceControlZoomExponent),
        controls.minDistance,
        controls.maxDistance
      );
      const panScale = THREE.MathUtils.clamp(spaceGestureBase.cameraDistance * spaceControlPanScale, 5.2, 34);
      const panOffset = spaceGestureBase.right
        .clone()
        .multiplyScalar(-centerDeltaX * panScale)
        .add(spaceGestureBase.up.clone().multiplyScalar(centerDeltaY * panScale));
      const nextTarget = spaceGestureBase.target.clone().add(panOffset);

      spaceGestureTarget = {
        sessionId,
        cameraPosition: nextTarget.clone().add(spaceGestureBase.cameraDirection.clone().multiplyScalar(nextDistance)),
        target: nextTarget,
        rotationX: THREE.MathUtils.clamp(
          spaceGestureBase.systemRotation.x + centerDeltaY * spaceControlTiltScale,
          -0.72,
          0.5
        ),
        rotationY: spaceGestureBase.systemRotation.y + rotationDelta * spaceControlRotationScale
      };
    };

    const rebaseSpaceControl = (sessionId: number) => {
      if (!spaceGestureTarget) return;

      const direction = spaceGestureTarget.cameraPosition.clone().sub(spaceGestureTarget.target).normalize();
      spaceGestureBase = {
        sessionId,
        cameraDirection: direction,
        cameraDistance: spaceGestureTarget.cameraPosition.distanceTo(spaceGestureTarget.target),
        target: spaceGestureTarget.target.clone(),
        right: new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize(),
        up: new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).normalize(),
        systemRotation: new THREE.Euler(spaceGestureTarget.rotationX, spaceGestureTarget.rotationY, systemGroup.rotation.z)
      };
      spaceGestureSignal = null;
    };

    const applySpaceControlMove = (
      command: Extract<GestureCommand, { type: 'spaceControl'; phase: 'move' | 'rebase' }>
    ) => {
      if (!spaceGestureBase || spaceGestureBase.sessionId !== command.sessionId) {
        beginSpaceControl(command.sessionId);
      }

      if (!spaceGestureBase) return;

      const now = performance.now();
      const previousSignal = spaceGestureSignal?.sessionId === command.sessionId ? spaceGestureSignal : null;
      const deltaSeconds = previousSignal ? clampNumber((now - previousSignal.timestamp) / 1000, 0.016, 0.16) : 0;
      const logScale = Math.log(THREE.MathUtils.clamp(command.scaleRatio, 0.34, 3.25));
      const centerVelocityX = previousSignal ? (command.centerDeltaX - previousSignal.centerDeltaX) / deltaSeconds : 0;
      const centerVelocityY = previousSignal ? (command.centerDeltaY - previousSignal.centerDeltaY) / deltaSeconds : 0;
      const logScaleVelocity = previousSignal ? (logScale - previousSignal.logScale) / deltaSeconds : 0;
      const rotationVelocity = previousSignal
        ? normalizeAngle(command.rotationDelta - previousSignal.rotationDelta) / deltaSeconds
        : 0;

      spaceGestureSignal = {
        sessionId: command.sessionId,
        timestamp: now,
        centerDeltaX: command.centerDeltaX,
        centerDeltaY: command.centerDeltaY,
        logScale,
        rotationDelta: command.rotationDelta,
        centerVelocityX,
        centerVelocityY,
        logScaleVelocity,
        rotationVelocity,
        predictedMs: 0
      };
      setSpaceTargetFromSignal(
        command.sessionId,
        command.centerDeltaX,
        command.centerDeltaY,
        command.scaleRatio,
        command.rotationDelta
      );
      if (command.phase === 'rebase') {
        rebaseSpaceControl(command.sessionId);
      }
      stopNavigationInertia();
    };

    const updatePredictedSpaceTarget = () => {
      if (!spaceGestureBase || !spaceGestureSignal || spaceGestureBase.sessionId !== spaceGestureSignal.sessionId) return;

      const elapsedSeconds = Math.max(0, (performance.now() - spaceGestureSignal.timestamp) / 1000);
      const lookAheadSeconds = Math.min(elapsedSeconds, spaceControlPredictionWindowSeconds);
      const fade =
        elapsedSeconds <= spaceControlPredictionHoldSeconds
          ? 1
          : clampNumber(
              1 - (elapsedSeconds - spaceControlPredictionHoldSeconds) / spaceControlPredictionFadeSeconds,
              0,
              1
            );

      const predictedCenterX =
        spaceGestureSignal.centerDeltaX +
        clampNumber(
          spaceGestureSignal.centerVelocityX * lookAheadSeconds * fade,
          -spaceControlMaxPredictedCenterDelta,
          spaceControlMaxPredictedCenterDelta
        );
      const predictedCenterY =
        spaceGestureSignal.centerDeltaY +
        clampNumber(
          spaceGestureSignal.centerVelocityY * lookAheadSeconds * fade,
          -spaceControlMaxPredictedCenterDelta,
          spaceControlMaxPredictedCenterDelta
        );
      const predictedScaleRatio = Math.exp(
        spaceGestureSignal.logScale +
          clampNumber(
            spaceGestureSignal.logScaleVelocity * lookAheadSeconds * fade,
            -spaceControlMaxPredictedLogScale,
            spaceControlMaxPredictedLogScale
          )
      );
      const predictedRotation =
        spaceGestureSignal.rotationDelta +
        clampNumber(
          spaceGestureSignal.rotationVelocity * lookAheadSeconds * fade,
          -spaceControlMaxPredictedRotation,
          spaceControlMaxPredictedRotation
        );

      spaceGestureSignal.predictedMs = lookAheadSeconds * fade * 1000;
      setSpaceTargetFromSignal(
        spaceGestureSignal.sessionId,
        predictedCenterX,
        predictedCenterY,
        predictedScaleRatio,
        predictedRotation
      );
    };

    const updateSpaceControl = (deltaSeconds: number) => {
      if (!spaceGestureTarget) return;
      updatePredictedSpaceTarget();
      const cameraError = camera.position.distanceTo(spaceGestureTarget.cameraPosition);
      const targetError = controls.target.distanceTo(spaceGestureTarget.target);
      const rotationError =
        Math.abs(systemGroup.rotation.x - spaceGestureTarget.rotationX) +
        Math.abs(systemGroup.rotation.y - spaceGestureTarget.rotationY);
      const alpha = getAdaptiveDirectControlAlpha(
        spaceControlFollowRate,
        deltaSeconds,
        cameraError + targetError + rotationError * 3
      );
      camera.position.lerp(spaceGestureTarget.cameraPosition, alpha);
      controls.target.lerp(spaceGestureTarget.target, alpha);
      systemGroup.rotation.x = THREE.MathUtils.lerp(systemGroup.rotation.x, spaceGestureTarget.rotationX, alpha);
      systemGroup.rotation.y = THREE.MathUtils.lerp(systemGroup.rotation.y, spaceGestureTarget.rotationY, alpha);
    };

    const consumeCommands = () => {
      const impulse = {
        rotateX: 0,
        rotateY: 0,
        zoom: 0,
        panX: 0,
        panY: 0
      };
      const rawCommands = commandQueueRef.current.splice(0);
      if (rawCommands.length > 0) {
        planetFocusTarget = null;
        const coalesced = coalesceDirectControlCommands(rawCommands);
        lastCommandStats = {
          raw: rawCommands.length,
          coalesced: coalesced.length,
          droppedDirect: rawCommands.length - coalesced.length
        };
        for (const command of coalesced) {
          if (command.type === 'pinchControl') {
            if (command.phase === 'start') {
              beginPinchControl(command.sessionId);
            } else if (command.phase === 'move' || command.phase === 'rebase') {
              applyPinchControlMove(command);
            } else if (pinchGestureBase?.sessionId === command.sessionId) {
              pinchGestureBase = null;
              pinchGestureTarget = null;
              pinchGestureSignal = null;
              if (!spaceGestureBase) {
                spaceAnchorMarker.visible = false;
              }
              stopNavigationInertia();
            }
            continue;
          }

          if (command.type === 'spaceControl') {
            if (command.phase === 'start') {
              beginSpaceControl(command.sessionId);
            } else if (command.phase === 'move' || command.phase === 'rebase') {
              applySpaceControlMove(command);
            } else if (spaceGestureBase?.sessionId === command.sessionId) {
              spaceGestureBase = null;
              spaceGestureTarget = null;
              spaceGestureSignal = null;
              spaceAnchorMarker.visible = false;
              stopNavigationInertia();
            }
            continue;
          }

          if (command.type === 'rotate') {
            impulse.rotateY += command.deltaX * 1.4;
            impulse.rotateX += command.deltaY * 0.9;
          }

          if (command.type === 'zoom') {
            impulse.zoom += command.delta * 7.5;
          }

          if (command.type === 'pan') {
            impulse.panX += command.deltaX;
            impulse.panY += command.deltaY;
          }
        }
      }
      return impulse;
    };

    const applyNavigation = (deltaSeconds: number) => {
      const impulse = consumeCommands();
      const distance = camera.position.distanceTo(controls.target);
      const damping = Math.pow(0.012, deltaSeconds);

      if (
        Math.abs(impulse.rotateX) > 0.0001 ||
        Math.abs(impulse.rotateY) > 0.0001 ||
        Math.abs(impulse.zoom) > 0.0001 ||
        Math.abs(impulse.panX) > 0.0001 ||
        Math.abs(impulse.panY) > 0.0001
      ) {
        systemGroup.rotation.y += impulse.rotateY;
        systemGroup.rotation.x = THREE.MathUtils.clamp(systemGroup.rotation.x + impulse.rotateX, -0.72, 0.5);
        applyZoomDelta(impulse.zoom);
        applyPanDelta(impulse.panX, impulse.panY, distance * 0.16);

        navigationVelocity.rotateX += impulse.rotateX * 3.2;
        navigationVelocity.rotateY += impulse.rotateY * 3.2;
        navigationVelocity.zoom += impulse.zoom * 4.8;
        navigationVelocity.panX += impulse.panX * 4.2;
        navigationVelocity.panY += impulse.panY * 4.2;
      }

      if (Math.abs(navigationVelocity.rotateX) > 0.0001 || Math.abs(navigationVelocity.rotateY) > 0.0001) {
        systemGroup.rotation.y += navigationVelocity.rotateY * deltaSeconds;
        systemGroup.rotation.x = THREE.MathUtils.clamp(
          systemGroup.rotation.x + navigationVelocity.rotateX * deltaSeconds,
          -0.72,
          0.5
        );
      }

      if (Math.abs(navigationVelocity.zoom) > 0.0001) {
        applyZoomDelta(navigationVelocity.zoom * deltaSeconds);
      }

      if (Math.abs(navigationVelocity.panX) > 0.0001 || Math.abs(navigationVelocity.panY) > 0.0001) {
        applyPanDelta(navigationVelocity.panX, navigationVelocity.panY, distance * 0.035 * deltaSeconds);
      }

      navigationVelocity.rotateX *= damping;
      navigationVelocity.rotateY *= damping;
      navigationVelocity.zoom *= damping;
      navigationVelocity.panX *= damping;
      navigationVelocity.panY *= damping;
    };

    const applyZoomDelta = (delta: number) => {
      const target = controls.target.clone();
      const direction = camera.position.clone().sub(target).normalize();
      const currentDistance = camera.position.distanceTo(target);
      const nextDistance = THREE.MathUtils.clamp(currentDistance + delta, controls.minDistance, controls.maxDistance);
      camera.position.copy(target).add(direction.multiplyScalar(nextDistance));
    };

    const applyPanDelta = (deltaX: number, deltaY: number, scale: number) => {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0).normalize();
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1).normalize();
      const offset = right.multiplyScalar(-deltaX * scale).add(up.multiplyScalar(deltaY * scale));
      camera.position.add(offset);
      controls.target.add(offset);
    };

    const updateSelection = () => {
      for (const runtime of runtimes) {
        const isSelected = runtime.planet.id === selectedRef.current;
        const interactionMode = handEngagedRef.current;
        runtime.mesh.scale.setScalar(isSelected ? 1.16 : 1);
        runtime.mesh.material.emissiveIntensity = isSelected ? 0.2 : 0.07;
        runtime.orbit.material.opacity = isSelected ? 0.92 : 0.3;
        runtime.orbitMarkers.visible = !interactionMode || isSelected;
        runtime.referenceGuide.visible = isSelected;
        runtime.surfaceDetails.visible = !interactionMode || isSelected;
        runtime.surfaceMicroDetails.visible = !interactionMode || isSelected;
        runtime.surfaceFeatureLabels.visible = isSelected && (!interactionMode || runtime.planet.radius >= 0.5);
        runtime.fieldLines.visible = isSelected && (!interactionMode || runtime.planet.radius >= 0.5);
        runtime.orbitTicks.visible = !interactionMode || isSelected;
        runtime.label.visible = !interactionMode || isSelected;
        runtime.label.material.opacity = isSelected ? 0.96 : interactionMode ? 0.28 : 0.68;
        if (runtime.cloudMesh) runtime.cloudMesh.visible = !interactionMode || isSelected;
        if (runtime.atmosphere) runtime.atmosphere.visible = !interactionMode || isSelected;
        if (runtime.nightLights) runtime.nightLights.visible = isSelected && !interactionMode;
        runtime.selectionHalo.visible = isSelected;
        runtime.selectionHalo.lookAt(camera.position);
        for (const moonRuntime of runtime.moons) {
          moonRuntime.label.visible = isSelected && (!interactionMode || runtime.planet.radius > 0.7);
          moonRuntime.label.lookAt(camera.position);
        }
      }
    };

    const updateSpaceAnchorMarker = () => {
      if (!spaceAnchorMarker.visible) return;
      const distance = camera.position.distanceTo(controls.target);
      spaceAnchorMarker.position.copy(controls.target);
      spaceAnchorMarker.scale.setScalar(THREE.MathUtils.clamp(distance * 0.045, 0.28, 1.5));
      spaceAnchorMarker.lookAt(camera.position);
    };

    const animate = (now: number) => {
      const frameStart = performance.now();
      const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.08);
      lastFrame = now;
      frameCount += 1;
      const interactionMode = handEngagedRef.current;

      const desiredPixelRatio = getRenderPixelRatio(host, interactionMode, adaptiveInteractionQuality);
      if (Math.abs(renderer.getPixelRatio() - desiredPixelRatio) > 0.01) {
        renderer.setPixelRatio(desiredPixelRatio);
        renderer.setSize(host.clientWidth, host.clientHeight);
      }

      asteroidBelt.visible = !interactionMode;
      namedMinorBodies.visible = !interactionMode;
      kuiperBelt.visible = !interactionMode;
      eclipticPlane.visible = !interactionMode;

      if (!pausedRef.current) {
        simDay += deltaSeconds * dayStepAtScaleOne * timeScaleRef.current;
      }

      for (const runtime of runtimes) {
        const position = getOrbitPosition(runtime.planet, simDay);
        runtime.bodyGroup.position.copy(position);

        if (!pausedRef.current) {
          runtime.axisGroup.rotation.y += getRotationStep(runtime.planet, deltaSeconds);
          runtime.cloudMesh?.rotateY(0.025 * deltaSeconds * Math.max(1, Math.abs(timeScaleRef.current) / 40));
        }

        for (const moonRuntime of runtime.moons) {
          const moonStep =
            ((Math.PI * 2) / Math.abs(moonRuntime.moon.orbitalPeriodDays)) *
            dayStepAtScaleOne *
            timeScaleRef.current *
            deltaSeconds;
          moonRuntime.root.rotation.y += pausedRef.current ? 0 : Math.sign(moonRuntime.moon.orbitalPeriodDays) * moonStep;
          moonRuntime.mesh.rotation.y += pausedRef.current ? 0 : 0.25 * deltaSeconds;
        }
      }

      updateSelectedPlanetFocus();
      applyNavigation(deltaSeconds);
      updatePinchControl(deltaSeconds);
      updateSpaceControl(deltaSeconds);
      updatePlanetFocus(deltaSeconds);
      updateSpaceAnchorMarker();
      sun.rotation.y += pausedRef.current ? 0 : 0.018 * deltaSeconds;
      starField.rotation.y += pausedRef.current ? 0 : 0.002 * deltaSeconds;
      asteroidBelt.rotation.y += pausedRef.current ? 0 : 0.0025 * deltaSeconds;
      namedMinorBodies.rotation.y += pausedRef.current ? 0 : 0.0014 * deltaSeconds;
      kuiperBelt.rotation.y += pausedRef.current ? 0 : 0.001 * deltaSeconds;
      controls.update();
      updateSelection();
      renderer.render(scene, camera);

      if (now - lastMetrics >= 500) {
        fps = Math.round((frameCount * 1000) / (now - lastMetrics));
        frameCount = 0;
        lastMetrics = now;
        adaptiveInteractionQuality = getNextAdaptiveInteractionQuality(
          adaptiveInteractionQuality,
          interactionMode,
          fps,
          performance.now() - frameStart
        );
        onMetricsRef.current({
          fps,
          simDay,
          renderMs: performance.now() - frameStart
        });
      }

      raf = requestAnimationFrame(animate);
    };

    renderer.domElement.addEventListener('pointerdown', selectFromPointer);
    window.addEventListener('resize', resize);
    resize();
    raf = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(raf);
      renderer.domElement.removeEventListener('pointerdown', selectFromPointer);
      window.removeEventListener('resize', resize);
      controls.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if ('geometry' in object && object.geometry instanceof THREE.BufferGeometry) {
          object.geometry.dispose();
        }
        if ('material' in object) {
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach(disposeMaterial);
          } else if (material instanceof THREE.Material) {
            disposeMaterial(material);
          }
        }
      });
      if (window.__orreryDebug?.getPlanetScreenPosition === getPlanetScreenPosition) {
        delete window.__orreryDebug;
      }
    };
  }, []);

  return <div className="scene-host" ref={hostRef} aria-label="3D solar system scene" />;
}

function createSun() {
  const group = new THREE.Group();

  const sunGeometry = new THREE.SphereGeometry(1.72, 64, 64);
  const sunMaterial = new THREE.MeshBasicMaterial({
    map: createSunTexture(),
    color: '#fff0b2'
  });
  const sun = new THREE.Mesh(sunGeometry, sunMaterial);
  group.add(sun);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: createGlowTexture('#ffc861'),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  glow.scale.set(7.8, 7.8, 1);
  group.add(glow);

  for (let index = 0; index < 3; index += 1) {
    const haloGeometry = new THREE.SphereGeometry(2 + index * 0.42, 48, 48);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: index % 2 === 0 ? '#ffb14f' : '#ff6d3c',
      transparent: true,
      opacity: 0.075 - index * 0.018,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    group.add(new THREE.Mesh(haloGeometry, haloMaterial));
  }

  const corona = new THREE.Points(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(makeCoronaPoints(), 3)),
    new THREE.PointsMaterial({
      color: '#ffd28a',
      size: 0.035,
      transparent: true,
      opacity: 0.48,
      blending: THREE.AdditiveBlending
    })
  );
  group.add(corona);

  for (let index = 0; index < 7; index += 1) {
    group.add(createSolarProminence(index));
  }

  return group;
}

function createSolarProminence(index: number) {
  const random = seededRandom(`solar-prominence:${index}`);
  const geometry = new THREE.TorusGeometry(
    0.24 + random() * 0.2,
    0.008 + random() * 0.009,
    8,
    54,
    Math.PI * (0.58 + random() * 0.52)
  );
  const material = new THREE.MeshBasicMaterial({
    color: random() > 0.42 ? '#ff9a3d' : '#ffd27a',
    transparent: true,
    opacity: 0.26 + random() * 0.18,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const prominence = new THREE.Mesh(geometry, material);
  const theta = random() * Math.PI * 2;
  const phi = Math.acos(2 * random() - 1);
  prominence.position.set(
    1.7 * Math.sin(phi) * Math.cos(theta),
    1.7 * Math.cos(phi),
    1.7 * Math.sin(phi) * Math.sin(theta)
  );
  prominence.lookAt(0, 0, 0);
  prominence.rotateX(Math.PI * 0.5);
  prominence.rotateZ(random() * Math.PI * 2);
  return prominence;
}

function createPlanetMesh(planet: Planet) {
  const isRocky = planet.type.includes('rocky');
  const segments = planet.radius >= 1 ? 112 : 96;
  const geometry = new THREE.SphereGeometry(planet.radius, segments, segments);
  const material = new THREE.MeshStandardMaterial({
    map: createPlanetTexture(planet),
    bumpScale: isRocky ? 0.06 : 0,
    color: '#ffffff',
    roughness: isRocky ? 0.82 : 0.58,
    metalness: 0.02,
    emissive: planet.color,
    emissiveIntensity: 0.07
  });
  if (isRocky) {
    material.bumpMap = createPlanetBumpTexture(planet);
  }
  return new THREE.Mesh(geometry, material);
}

function createCloudShell(planet: Planet) {
  const cloudKinds = ['earth', 'venus-cloud', 'jupiter', 'saturn', 'ice', 'storm-ice'];
  if (!planet.atmosphereColor && !cloudKinds.includes(planet.textureKind)) return null;
  const opacityByKind: Record<string, number> = {
    'venus-cloud': 0.58,
    earth: 0.42,
    jupiter: 0.22,
    saturn: 0.16,
    ice: 0.12,
    'storm-ice': 0.18
  };
  const geometry = new THREE.SphereGeometry(planet.radius * 1.032, 72, 72);
  const material = new THREE.MeshBasicMaterial({
    map: createCloudTexture(planet.textureKind),
    transparent: true,
    opacity: opacityByKind[planet.textureKind] ?? 0.14,
    blending: THREE.NormalBlending,
    depthWrite: false
  });
  return new THREE.Mesh(geometry, material);
}

function createAtmosphere(planet: Planet) {
  if (!planet.atmosphereColor) return null;
  const geometry = new THREE.SphereGeometry(planet.radius * 1.065, 72, 72);
  const material = new THREE.MeshBasicMaterial({
    color: planet.atmosphereColor,
    transparent: true,
    opacity: planet.textureKind === 'venus-cloud' ? 0.18 : 0.1,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  return new THREE.Mesh(geometry, material);
}

function createRingSystem(planet: Planet) {
  if (!planet.ring) {
    return new THREE.Group();
  }

  const group = new THREE.Group();
  group.rotation.z = THREE.MathUtils.degToRad(planet.ring.tiltDeg - planet.axialTiltDeg);
  const inner = planet.ring.innerRadius;
  const outer = planet.ring.outerRadius;
  const width = outer - inner;
  const bands = [
    { inner: inner, outer: inner + width * 0.26, opacity: planet.ring.opacity * 0.48 },
    { inner: inner + width * 0.3, outer: inner + width * 0.58, opacity: planet.ring.opacity * 0.84 },
    { inner: inner + width * 0.63, outer: inner + width * 0.82, opacity: planet.ring.opacity * 0.62 },
    { inner: inner + width * 0.85, outer, opacity: planet.ring.opacity * 0.42 }
  ];

  for (const band of bands) {
    const geometry = new THREE.RingGeometry(band.inner, band.outer, 144);
    const material = new THREE.MeshBasicMaterial({
      map: createRingTexture(planet.ring.color),
      color: '#ffffff',
      transparent: true,
      opacity: band.opacity,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const ring = new THREE.Mesh(geometry, material);
    ring.rotation.x = Math.PI * 0.5;
    group.add(ring);
  }

  const gapFractions = planet.id === 'saturn' ? [0.585, 0.79] : [0.54];
  for (const gap of gapFractions) {
    const gapRadius = inner + width * gap;
    const gapGeometry = new THREE.RingGeometry(gapRadius - width * 0.025, gapRadius + width * 0.02, 144);
    const gapMaterial = new THREE.MeshBasicMaterial({
      color: '#030405',
      transparent: true,
      opacity: planet.id === 'saturn' ? 0.64 : 0.38,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const gapMesh = new THREE.Mesh(gapGeometry, gapMaterial);
    gapMesh.rotation.x = Math.PI * 0.5;
    group.add(gapMesh);
  }

  if (planet.id === 'saturn') {
    group.add(createRingSpokes(inner, outer));
  }

  return group;
}

function createMoons(planet: Planet) {
  return planet.majorMoons.map((moon, index) => {
    const root = new THREE.Object3D();
    root.rotation.x = THREE.MathUtils.degToRad((index - 1) * 4);
    root.rotation.y = index * 1.7;

    const orbit = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(makeCircularPoints(moon.distance, 96)),
      new THREE.LineBasicMaterial({ color: '#dad5c0', transparent: true, opacity: 0.18 })
    );
    root.add(orbit);

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(moon.radius, 32, 32),
      new THREE.MeshStandardMaterial({
        map: createMoonTexture(moon),
        color: moon.color,
        roughness: 0.86,
        metalness: 0,
        emissive: moon.color,
        emissiveIntensity: 0.025
      })
    );
    mesh.position.x = moon.distance;
    root.add(mesh);

    const label = createMoonLabel(moon);
    label.position.set(moon.distance, moon.radius + 0.22, 0);
    label.visible = false;
    root.add(label);

    return { moon, root, mesh, label };
  });
}

function createRingSpokes(innerRadius: number, outerRadius: number) {
  const group = new THREE.Group();
  const random = seededRandom('saturn-ring-spokes');
  const material = new THREE.LineBasicMaterial({
    color: '#fff2bf',
    transparent: true,
    opacity: 0.16,
    depthWrite: false
  });

  for (let index = 0; index < 20; index += 1) {
    const angle = (index / 20) * Math.PI * 2 + random() * 0.08;
    const start = innerRadius + (outerRadius - innerRadius) * (0.18 + random() * 0.24);
    const end = innerRadius + (outerRadius - innerRadius) * (0.62 + random() * 0.3);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(Math.cos(angle) * start, 0, Math.sin(angle) * start),
      new THREE.Vector3(Math.cos(angle) * end, 0, Math.sin(angle) * end)
    ]);
    const spoke = new THREE.Line(geometry, material);
    group.add(spoke);
  }

  return group;
}

function createMoonTexture(moon: MajorMoon) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const random = seededRandom(`moon:${moon.name}`);
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, colorWithAlpha(moon.color, 1));
  gradient.addColorStop(0.5, moon.color);
  gradient.addColorStop(1, '#4b463f');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 84; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = (random() ** 2) * 11 + 1.2;
    const crater = context.createRadialGradient(x, y, radius * 0.2, x, y, radius);
    crater.addColorStop(0, 'rgba(238, 230, 209, 0.18)');
    crater.addColorStop(0.54, 'rgba(28, 25, 22, 0.22)');
    crater.addColorStop(1, 'rgba(0, 0, 0, 0)');
    context.fillStyle = crater;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createMoonLabel(moon: MajorMoon) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 82;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '700 24px Inter, system-ui, sans-serif';
    context.fillStyle = 'rgba(248, 247, 232, 0.92)';
    context.textAlign = 'center';
    context.fillText(moon.nameZh, canvas.width / 2, 34);
    context.font = '500 15px Inter, system-ui, sans-serif';
    context.fillStyle = 'rgba(210, 216, 220, 0.82)';
    context.fillText(moon.name, canvas.width / 2, 56);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.72,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.86, 0.28, 1);
  return sprite;
}

function createReferenceGuide(planet: Planet) {
  const group = new THREE.Group();
  group.visible = false;
  group.rotation.z = THREE.MathUtils.degToRad(planet.axialTiltDeg);

  const guideRadius = planet.radius * 1.33;
  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -guideRadius * 1.18, 0),
    new THREE.Vector3(0, guideRadius * 1.18, 0)
  ]);
  group.add(
    new THREE.Line(
      axisGeometry,
      new THREE.LineBasicMaterial({
        color: '#8ee5c2',
        transparent: true,
        opacity: 0.78,
        depthWrite: false
      })
    )
  );

  const equator = createSurfaceLatitude(guideRadius, 0, planet.accent, 0.5, 160);
  group.add(equator);

  const meridianA = createMeridianLine(guideRadius, '#dfffee', 0.25, 0);
  const meridianB = createMeridianLine(guideRadius, '#dfffee', 0.18, Math.PI * 0.5);
  group.add(meridianA, meridianB);

  const northPole = new THREE.Mesh(
    new THREE.SphereGeometry(planet.radius * 0.065, 12, 12),
    new THREE.MeshBasicMaterial({ color: '#8ee5c2', transparent: true, opacity: 0.85, depthWrite: false })
  );
  northPole.position.y = guideRadius * 1.18;
  group.add(northPole);

  return group;
}

function createPlanetFieldLines(planet: Planet) {
  const configs: Partial<
    Record<PlanetId, { count: number; radiusScale: number; verticalScale: number; color: string; opacity: number; tiltDeg: number }>
  > = {
    earth: { count: 10, radiusScale: 1.45, verticalScale: 2.2, color: '#8ee5c2', opacity: 0.24, tiltDeg: 11 },
    jupiter: { count: 14, radiusScale: 1.75, verticalScale: 2.55, color: '#ffd39a', opacity: 0.2, tiltDeg: 10 },
    saturn: { count: 10, radiusScale: 1.5, verticalScale: 2.15, color: '#f5e7ae', opacity: 0.18, tiltDeg: 27 },
    uranus: { count: 8, radiusScale: 1.38, verticalScale: 2.05, color: '#c2ffff', opacity: 0.18, tiltDeg: 58 },
    neptune: { count: 8, radiusScale: 1.42, verticalScale: 2.12, color: '#8ca8ff', opacity: 0.2, tiltDeg: 47 }
  };
  const config = configs[planet.id];
  const group = new THREE.Group();
  group.visible = false;
  if (!config) return group;

  group.rotation.z = THREE.MathUtils.degToRad(config.tiltDeg);
  const material = new THREE.LineBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: config.opacity,
    depthWrite: false
  });

  for (let index = 0; index < config.count; index += 1) {
    const longitude = (index / config.count) * Math.PI * 2;
    const shell = 1 + (index % 4) * 0.22;
    const lateralRadius = planet.radius * config.radiusScale * shell;
    const verticalRadius = planet.radius * config.verticalScale * (1 + (index % 3) * 0.16);
    const points: THREE.Vector3[] = [];

    for (let step = 0; step <= 128; step += 1) {
      const angle = (step / 128) * Math.PI * 2;
      const base = new THREE.Vector3(Math.sin(angle) * lateralRadius, Math.cos(angle) * verticalRadius, 0);
      base.applyAxisAngle(new THREE.Vector3(0, 1, 0), longitude);
      points.push(base);
    }

    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
  }

  return group;
}

function createSurfaceDetailLayer(planet: Planet) {
  const group = new THREE.Group();
  group.renderOrder = 3;

  if (planet.textureKind === 'jupiter' || planet.textureKind === 'saturn') {
    for (let latitude = -58; latitude <= 58; latitude += 14) {
      const opacity = latitude === 0 ? 0.32 : 0.18;
      group.add(createSurfaceLatitude(planet.radius * 1.012, latitude, '#fff2c9', opacity, 160));
    }
  } else if (planet.textureKind === 'ice' || planet.textureKind === 'storm-ice') {
    for (let latitude = -45; latitude <= 45; latitude += 18) {
      group.add(createSurfaceLatitude(planet.radius * 1.01, latitude, planet.accent, 0.16, 128));
    }
  } else {
    for (let latitude = -50; latitude <= 50; latitude += 25) {
      group.add(createSurfaceLatitude(planet.radius * 1.011, latitude, planet.accent, 0.13, 128));
    }
  }

  if (planet.id === 'earth') {
    group.add(createSurfaceLatitude(planet.radius * 1.018, 23.44, '#c8f2ff', 0.22, 160));
    group.add(createSurfaceLatitude(planet.radius * 1.018, -23.44, '#c8f2ff', 0.22, 160));
    group.add(createSurfaceArc(planet.radius * 1.02, -6, -76, -34, '#9ddf8a', 0.34));
    group.add(createSurfaceArc(planet.radius * 1.02, 7, -22, 38, '#d8c781', 0.28));
    group.add(createSurfaceArc(planet.radius * 1.022, 29, 60, 104, '#e1d089', 0.3));
    group.add(createSurfaceArc(planet.radius * 1.022, -23, -79, -66, '#eff2db', 0.28));
  }

  if (planet.id === 'mars') {
    group.add(createSurfaceArc(planet.radius * 1.025, -8, -65, 18, '#3b1b16', 0.52));
    group.add(createSurfaceEllipse(planet.radius * 1.024, 16, 112, planet.radius * 0.22, planet.radius * 0.11, '#f2c08b', 0.38));
    group.add(createSurfaceEllipse(planet.radius * 1.026, 18, -133, planet.radius * 0.12, planet.radius * 0.08, '#f1b27a', 0.42));
    group.add(createSurfaceEllipse(planet.radius * 1.026, 0, -112, planet.radius * 0.07, planet.radius * 0.05, '#f0a56d', 0.34));
    group.add(createSurfaceEllipse(planet.radius * 1.028, 73, 24, planet.radius * 0.28, planet.radius * 0.08, '#f5ead2', 0.46));
  }

  if (planet.id === 'mercury') {
    const random = seededRandom('mercury-surface-rims');
    group.add(createSurfaceEllipse(planet.radius * 1.028, 31, 162, planet.radius * 0.3, planet.radius * 0.2, '#f3d7a3', 0.34));
    for (let index = 0; index < 14; index += 1) {
      group.add(
        createSurfaceEllipse(
          planet.radius * 1.024,
          -48 + random() * 96,
          random() * 360,
          planet.radius * (0.08 + random() * 0.18),
          planet.radius * (0.05 + random() * 0.12),
          '#f0d9ad',
          0.2
        )
      );
    }
  }

  if (planet.id === 'venus') {
    group.add(createSurfaceArc(planet.radius * 1.02, 28, -170, 178, '#fff0b8', 0.22));
    group.add(createSurfaceArc(planet.radius * 1.02, -26, -150, 160, '#a86d35', 0.18));
    group.add(createSurfaceArc(planet.radius * 1.022, 48, -130, 40, '#fff5c8', 0.2));
    group.add(createSurfaceArc(planet.radius * 1.022, -46, 20, 168, '#99622f', 0.17));
  }

  if (planet.id === 'jupiter') {
    group.add(createSurfaceEllipse(planet.radius * 1.026, -21, 86, planet.radius * 0.28, planet.radius * 0.13, '#cf5d42', 0.76));
    group.add(createSurfaceEllipse(planet.radius * 1.028, -21, 86, planet.radius * 0.18, planet.radius * 0.07, '#ffe0ae', 0.42));
    group.add(createSurfaceEllipse(planet.radius * 1.024, 24, -64, planet.radius * 0.16, planet.radius * 0.05, '#fff0c4', 0.35));
    group.add(createSurfaceEllipse(planet.radius * 1.024, -38, 158, planet.radius * 0.12, planet.radius * 0.04, '#8c4b35', 0.34));
  }

  if (planet.id === 'saturn') {
    group.add(createSurfaceLatitude(planet.radius * 1.018, 74, '#fff4bd', 0.28, 6));
    group.add(createSurfaceEllipse(planet.radius * 1.02, 63, -34, planet.radius * 0.23, planet.radius * 0.06, '#f4df9f', 0.26));
  }

  if (planet.id === 'uranus') {
    group.add(createSurfaceEllipse(planet.radius * 1.022, 58, -18, planet.radius * 0.35, planet.radius * 0.1, '#d6ffff', 0.22));
    group.add(createSurfaceArc(planet.radius * 1.022, -24, -140, 142, '#78bdc4', 0.2));
  }

  if (planet.id === 'neptune') {
    group.add(createSurfaceEllipse(planet.radius * 1.025, -18, 74, planet.radius * 0.2, planet.radius * 0.08, '#162a82', 0.42));
    group.add(createSurfaceEllipse(planet.radius * 1.027, 28, -56, planet.radius * 0.18, planet.radius * 0.035, '#e9f7ff', 0.34));
    group.add(createSurfaceArc(planet.radius * 1.023, -42, -160, 166, '#9ab6ff', 0.22));
  }

  return group;
}

function createSurfaceMicroDetails(planet: Planet) {
  const countByKind: Record<PlanetTextureKind, number> = {
    cratered: 420,
    'venus-cloud': 260,
    earth: 240,
    martian: 380,
    jupiter: 360,
    saturn: 310,
    ice: 230,
    'storm-ice': 260
  };
  const count = countByKind[planet.textureKind];
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const random = seededRandom(`${planet.id}:surface-micro-detail`);
  const accent = new THREE.Color(planet.accent);
  const base = new THREE.Color(planet.color);
  const light = new THREE.Color('#fff6d8');
  const shadow = new THREE.Color('#1f1914');

  for (let index = 0; index < count; index += 1) {
    const longitude = random() * 360 - 180;
    const latitude =
      planet.textureKind === 'jupiter' || planet.textureKind === 'saturn'
        ? clampNumber((random() - 0.5) * 96 + Math.sin(index * 0.9) * 4, -62, 62)
        : clampNumber(Math.asin(random() * 2 - 1) * THREE.MathUtils.RAD2DEG, -78, 78);
    const point = sphericalSurfacePoint(planet.radius * (1.026 + random() * 0.012), latitude, longitude);
    positions[index * 3] = point.x;
    positions[index * 3 + 1] = point.y;
    positions[index * 3 + 2] = point.z;

    const color = base.clone().lerp(accent, 0.32 + random() * 0.44);
    if (planet.type.includes('rocky') && random() > 0.62) {
      color.lerp(shadow, 0.38);
    }
    if ((planet.textureKind === 'jupiter' || planet.textureKind === 'saturn') && random() > 0.54) {
      color.lerp(light, 0.38);
    }
    if ((planet.textureKind === 'ice' || planet.textureKind === 'storm-ice') && random() > 0.64) {
      color.lerp(light, 0.22);
    }

    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: clampNumber(planet.radius * 0.028, 0.011, 0.03),
    vertexColors: true,
    transparent: true,
    opacity: planet.type.includes('rocky') ? 0.68 : 0.5,
    sizeAttenuation: true,
    depthWrite: false
  });
  const points = new THREE.Points(geometry, material);
  points.userData.pointCount = count;
  return points;
}

function createNightLights(planet: Planet) {
  if (planet.id !== 'earth') return null;

  const clusters = [
    { latitude: 40, longitude: -74, count: 12, spread: 8 },
    { latitude: 34, longitude: -118, count: 7, spread: 7 },
    { latitude: 51, longitude: 0, count: 12, spread: 7 },
    { latitude: 48, longitude: 10, count: 13, spread: 8 },
    { latitude: 30, longitude: 31, count: 7, spread: 5 },
    { latitude: 22, longitude: 78, count: 13, spread: 9 },
    { latitude: 31, longitude: 121, count: 13, spread: 8 },
    { latitude: 36, longitude: 140, count: 8, spread: 5 },
    { latitude: -23, longitude: -46, count: 8, spread: 6 },
    { latitude: -34, longitude: 151, count: 6, spread: 5 }
  ];
  const count = clusters.reduce((sum, cluster) => sum + cluster.count, 0);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const random = seededRandom('earth:city-lights');
  let cursor = 0;

  for (const cluster of clusters) {
    for (let index = 0; index < cluster.count; index += 1) {
      const latitude = cluster.latitude + (random() - 0.5) * cluster.spread;
      const longitude = cluster.longitude + (random() - 0.5) * cluster.spread * 1.4;
      const point = sphericalSurfacePoint(planet.radius * (1.052 + random() * 0.01), latitude, longitude);
      positions[cursor * 3] = point.x;
      positions[cursor * 3 + 1] = point.y;
      positions[cursor * 3 + 2] = point.z;

      const color = new THREE.Color(random() > 0.72 ? '#fff2b0' : '#ffd27a');
      colors[cursor * 3] = color.r;
      colors[cursor * 3 + 1] = color.g;
      colors[cursor * 3 + 2] = color.b;
      cursor += 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.032,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    depthWrite: false
  });
  const points = new THREE.Points(geometry, material);
  points.userData.pointCount = count;
  return points;
}

function createSurfaceFeatureLabels(planet: Planet) {
  const group = new THREE.Group();
  group.renderOrder = 7;
  group.visible = false;

  const features = getPlanetSurfaceFeatures(planet);
  for (const feature of features) {
    const label = createSurfaceFeatureLabel(feature.nameZh, feature.name, feature.color ?? planet.accent);
    label.position.copy(sphericalSurfacePoint(planet.radius * 1.42, feature.latitude, feature.longitude));
    const scale = THREE.MathUtils.clamp(planet.radius * 0.74, 0.34, 0.96);
    label.scale.set(1.28 * scale, 0.42 * scale, 1);
    group.add(label);
  }

  return group;
}

function getPlanetSurfaceFeatures(planet: Planet) {
  const features: Record<
    PlanetId,
    Array<{ nameZh: string; name: string; latitude: number; longitude: number; color?: string }>
  > = {
    mercury: [
      { nameZh: '卡洛里盆地', name: 'Caloris', latitude: 31, longitude: 162, color: '#f3d7a3' },
      { nameZh: '辐射坑群', name: 'Ray craters', latitude: -18, longitude: -58, color: '#f0d9ad' }
    ],
    venus: [
      { nameZh: '高反照云带', name: 'Cloud bands', latitude: 48, longitude: -34, color: '#fff5c8' },
      { nameZh: '逆向自转', name: 'Retrograde spin', latitude: -42, longitude: 82, color: '#e9ac68' }
    ],
    earth: [
      { nameZh: '喜马拉雅', name: 'Himalaya', latitude: 29, longitude: 86, color: '#e1d089' },
      { nameZh: '安第斯', name: 'Andes', latitude: -23, longitude: -72, color: '#eff2db' },
      { nameZh: '太平洋', name: 'Pacific', latitude: 4, longitude: -150, color: '#8fe4ff' }
    ],
    mars: [
      { nameZh: '水手谷', name: 'Valles Marineris', latitude: -8, longitude: -38, color: '#3b1b16' },
      { nameZh: '奥林匹斯山', name: 'Olympus Mons', latitude: 18, longitude: -133, color: '#f1b27a' },
      { nameZh: '北极冠', name: 'Polar cap', latitude: 73, longitude: 24, color: '#f5ead2' }
    ],
    jupiter: [
      { nameZh: '大红斑', name: 'Great Red Spot', latitude: -21, longitude: 86, color: '#cf5d42' },
      { nameZh: '赤道云带', name: 'Equatorial belts', latitude: 0, longitude: -24, color: '#fff2c9' },
      { nameZh: '白色椭圆', name: 'White oval', latitude: 24, longitude: -64, color: '#fff0c4' }
    ],
    saturn: [
      { nameZh: '北极六边形', name: 'Hexagon', latitude: 74, longitude: 18, color: '#fff4bd' },
      { nameZh: '卡西尼缝', name: 'Cassini division', latitude: 0, longitude: 118, color: '#f5e7ae' }
    ],
    uranus: [
      { nameZh: '横躺自转轴', name: '98 deg tilt', latitude: 58, longitude: -18, color: '#d6ffff' },
      { nameZh: '暗淡环系', name: 'Faint rings', latitude: -24, longitude: 142, color: '#c3f1ef' }
    ],
    neptune: [
      { nameZh: '大暗斑', name: 'Dark spot', latitude: -18, longitude: 74, color: '#162a82' },
      { nameZh: '高速云', name: 'Fast clouds', latitude: 28, longitude: -56, color: '#e9f7ff' }
    ]
  };

  return features[planet.id];
}

function createSurfaceFeatureLabel(nameZh: string, name: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 340;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '700 24px Inter, system-ui, sans-serif';
    context.fillStyle = 'rgba(250, 249, 235, 0.96)';
    context.textAlign = 'center';
    context.fillText(nameZh, canvas.width / 2, 43);
    context.font = '500 14px Inter, system-ui, sans-serif';
    context.fillStyle = color;
    context.fillText(name, canvas.width / 2, 64);
    context.fillStyle = colorWithAlpha(color, 0.78);
    context.fillRect(canvas.width / 2 - 34, 76, 68, 3);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.78,
    depthTest: false
  });
  return new THREE.Sprite(material);
}

function createSurfaceLatitude(radius: number, latitudeDeg: number, color: string, opacity: number, segments: number) {
  const latitude = THREE.MathUtils.degToRad(latitudeDeg);
  const y = Math.sin(latitude) * radius;
  const ringRadius = Math.cos(latitude) * radius;
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * ringRadius, y, Math.sin(angle) * ringRadius));
  }
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false
  });
  return new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material);
}

function createMeridianLine(radius: number, color: string, opacity: number, longitudeOffset: number) {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 160; index += 1) {
    const angle = (index / 160) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        Math.cos(longitudeOffset) * Math.sin(angle) * radius,
        Math.cos(angle) * radius,
        Math.sin(longitudeOffset) * Math.sin(angle) * radius
      )
    );
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  );
}

function createSurfaceArc(
  radius: number,
  latitudeDeg: number,
  startLongitudeDeg: number,
  endLongitudeDeg: number,
  color: string,
  opacity: number
) {
  const points: THREE.Vector3[] = [];
  const steps = 76;
  for (let index = 0; index <= steps; index += 1) {
    const t = index / steps;
    const longitude = THREE.MathUtils.lerp(startLongitudeDeg, endLongitudeDeg, t);
    const latitude = latitudeDeg + Math.sin(t * Math.PI * 3) * 2.4;
    points.push(sphericalSurfacePoint(radius, latitude, longitude));
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  );
}

function createSurfaceEllipse(
  radius: number,
  latitudeDeg: number,
  longitudeDeg: number,
  radiusX: number,
  radiusY: number,
  color: string,
  opacity: number
) {
  const latitude = THREE.MathUtils.degToRad(latitudeDeg);
  const longitude = THREE.MathUtils.degToRad(longitudeDeg);
  const center = sphericalSurfacePoint(radius, latitudeDeg, longitudeDeg).normalize();
  const east = new THREE.Vector3(-Math.sin(longitude), 0, Math.cos(longitude)).normalize();
  const north = new THREE.Vector3(
    -Math.sin(latitude) * Math.cos(longitude),
    Math.cos(latitude),
    -Math.sin(latitude) * Math.sin(longitude)
  ).normalize();
  const points: THREE.Vector3[] = [];
  for (let index = 0; index < 96; index += 1) {
    const angle = (index / 96) * Math.PI * 2;
    const tangentPoint = center
      .clone()
      .multiplyScalar(radius)
      .add(east.clone().multiplyScalar(Math.cos(angle) * radiusX))
      .add(north.clone().multiplyScalar(Math.sin(angle) * radiusY));
    points.push(tangentPoint.normalize().multiplyScalar(radius));
  }
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false })
  );
}

function sphericalSurfacePoint(radius: number, latitudeDeg: number, longitudeDeg: number) {
  const latitude = THREE.MathUtils.degToRad(latitudeDeg);
  const longitude = THREE.MathUtils.degToRad(longitudeDeg);
  const cosLatitude = Math.cos(latitude);
  return new THREE.Vector3(
    Math.cos(longitude) * cosLatitude * radius,
    Math.sin(latitude) * radius,
    Math.sin(longitude) * cosLatitude * radius
  );
}

function createOrbit(planet: Planet) {
  const geometry = new THREE.BufferGeometry().setFromPoints(makeOrbitPoints(planet, 256));
  const material = new THREE.LineBasicMaterial({
    color: planet.accent,
    transparent: true,
    opacity: 0.3
  });
  return new THREE.Line(geometry, material);
}

function createOrbitTicks(planet: Planet) {
  const tickCount = 24;
  const semiMajor = planet.distance;
  const semiMinor = semiMajor * Math.sqrt(1 - planet.eccentricity * planet.eccentricity);
  const points: THREE.Vector3[] = [];

  for (let index = 0; index < tickCount; index += 1) {
    const eccentricAnomaly = (index / tickCount) * Math.PI * 2;
    const center = new THREE.Vector3(
      semiMajor * (Math.cos(eccentricAnomaly) - planet.eccentricity),
      0,
      semiMinor * Math.sin(eccentricAnomaly)
    );
    const tangent = new THREE.Vector3(-semiMajor * Math.sin(eccentricAnomaly), 0, semiMinor * Math.cos(eccentricAnomaly)).normalize();
    const normal = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize();
    const length = index % 6 === 0 ? 0.52 : index % 2 === 0 ? 0.34 : 0.22;
    points.push(center.clone().add(normal.clone().multiplyScalar(-length * 0.5)));
    points.push(center.clone().add(normal.clone().multiplyScalar(length * 0.5)));
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color: planet.accent,
    transparent: true,
    opacity: 0.24,
    depthWrite: false
  });
  const ticks = new THREE.LineSegments(geometry, material);
  ticks.userData.tickCount = tickCount;
  return ticks;
}

function createOrbitMarkers(planet: Planet) {
  const group = new THREE.Group();
  const markerGeometry = new THREE.SphereGeometry(0.055, 14, 14);
  const markerMaterial = new THREE.MeshBasicMaterial({
    color: planet.accent,
    transparent: true,
    opacity: 0.82,
    depthWrite: false
  });
  const semiMajor = planet.distance;
  const semiMinor = semiMajor * Math.sqrt(1 - planet.eccentricity * planet.eccentricity);
  const markerPositions = [
    {
      key: 'perihelion',
      label: 'q',
      position: new THREE.Vector3(semiMajor * (1 - planet.eccentricity), 0, 0)
    },
    {
      key: 'aphelion',
      label: 'Q',
      position: new THREE.Vector3(-semiMajor * (1 + planet.eccentricity), 0, 0)
    },
    {
      key: 'minor-north',
      label: '',
      position: new THREE.Vector3(-semiMajor * planet.eccentricity, 0, semiMinor)
    },
    {
      key: 'minor-south',
      label: '',
      position: new THREE.Vector3(-semiMajor * planet.eccentricity, 0, -semiMinor)
    }
  ];

  for (const marker of markerPositions) {
    const mesh = new THREE.Mesh(markerGeometry, markerMaterial);
    mesh.name = `${planet.id}-${marker.key}`;
    mesh.position.copy(marker.position);
    group.add(mesh);

    if (marker.label) {
      const label = createOrbitMarkerLabel(marker.label, planet.accent);
      label.position.copy(marker.position).add(new THREE.Vector3(0, 0.16, 0));
      group.add(label);
    }
  }

  return group;
}

function createOrbitMarkerLabel(text: string, color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 80;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '700 30px Inter, system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillStyle = color;
    context.fillText(text, canvas.width / 2, 45);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.68,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.34, 0.28, 1);
  return sprite;
}

function createSelectionHalo(planet: Planet) {
  const geometry = new THREE.RingGeometry(planet.radius * 1.55, planet.radius * 1.68, 72);
  const material = new THREE.MeshBasicMaterial({
    color: planet.accent,
    transparent: true,
    opacity: 0.8,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const halo = new THREE.Mesh(geometry, material);
  halo.visible = false;
  return halo;
}

function createSpaceAnchorMarker() {
  const group = new THREE.Group();
  group.renderOrder = 8;

  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.76, 0.82, 72),
    new THREE.MeshBasicMaterial({
      color: '#8ee5c2',
      transparent: true,
      opacity: 0.68,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  group.add(outerRing);

  const innerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.26, 0.29, 48),
    new THREE.MeshBasicMaterial({
      color: '#f0b64d',
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
  );
  group.add(innerRing);

  const guideGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.02, 0, 0),
    new THREE.Vector3(-0.52, 0, 0),
    new THREE.Vector3(0.52, 0, 0),
    new THREE.Vector3(1.02, 0, 0),
    new THREE.Vector3(0, -1.02, 0),
    new THREE.Vector3(0, -0.52, 0),
    new THREE.Vector3(0, 0.52, 0),
    new THREE.Vector3(0, 1.02, 0)
  ]);
  group.add(
    new THREE.LineSegments(
      guideGeometry,
      new THREE.LineBasicMaterial({
        color: '#dfffee',
        transparent: true,
        opacity: 0.46,
        depthWrite: false
      })
    )
  );

  return group;
}

function createLabel(planet: Planet) {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 112;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '700 31px Inter, system-ui, sans-serif';
    context.fillStyle = 'rgba(248, 247, 232, 0.95)';
    context.textAlign = 'center';
    context.fillText(planet.nameZh, canvas.width / 2, 46);
    context.font = '500 18px Inter, system-ui, sans-serif';
    context.fillStyle = planet.accent;
    context.fillText(planet.name, canvas.width / 2, 72);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.56,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2.35, 0.82, 1);
  return sprite;
}

function createEclipticPlane() {
  const grid = new THREE.GridHelper(70, 40, '#363632', '#151512');
  grid.position.y = -0.025;
  grid.material.opacity = 0.14;
  grid.material.transparent = true;
  return grid;
}

function createStarField() {
  const starCount = 1500;
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const random = seededRandom('stable-star-field');

  for (let index = 0; index < starCount; index += 1) {
    const inMilkyBand = index > starCount * 0.62;
    const radius = 50 + random() * 60;
    const theta = random() * Math.PI * 2;
    const phi = inMilkyBand
      ? Math.PI * 0.5 + (random() - 0.5) * 0.42
      : Math.acos(2 * random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi) + (inMilkyBand ? (random() - 0.5) * 8 : 0);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

    const warmth = random();
    colors[index * 3] = warmth > 0.86 ? 1 : 0.78;
    colors[index * 3 + 1] = warmth > 0.86 ? 0.78 : 0.86;
    colors[index * 3 + 2] = warmth > 0.86 ? 0.55 : 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.062,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    sizeAttenuation: true
  });

  return new THREE.Points(geometry, material);
}

function createNamedMinorBodies() {
  const root = new THREE.Group();
  const bodies = [
    {
      name: 'Ceres',
      nameZh: '谷神星',
      radius: 0.105,
      orbitRadius: 12.18,
      angle: 0.62,
      color: '#c8c0b0',
      eccentricity: 0.08,
      inclinationDeg: 10.6,
      scale: [1, 0.96, 1] as const
    },
    {
      name: 'Vesta',
      nameZh: '灶神星',
      radius: 0.078,
      orbitRadius: 12.44,
      angle: 2.18,
      color: '#d6c4a3',
      eccentricity: 0.09,
      inclinationDeg: 7.1,
      scale: [1.16, 0.82, 0.94] as const
    },
    {
      name: 'Pallas',
      nameZh: '智神星',
      radius: 0.07,
      orbitRadius: 12.78,
      angle: 3.76,
      color: '#aaa69d',
      eccentricity: 0.23,
      inclinationDeg: 34.8,
      scale: [1.08, 0.9, 1] as const
    },
    {
      name: 'Hygiea',
      nameZh: '健神星',
      radius: 0.066,
      orbitRadius: 12.92,
      angle: 5.12,
      color: '#8f8a82',
      eccentricity: 0.12,
      inclinationDeg: 3.8,
      scale: [1, 0.98, 1] as const
    },
    {
      name: 'Pluto',
      nameZh: '冥王星',
      radius: 0.118,
      orbitRadius: 31.2,
      angle: 1.18,
      color: '#c9a985',
      eccentricity: 0.25,
      inclinationDeg: 17.2,
      scale: [1, 0.95, 1] as const
    },
    {
      name: 'Haumea',
      nameZh: '妊神星',
      radius: 0.088,
      orbitRadius: 32.8,
      angle: 2.72,
      color: '#ddd5c9',
      eccentricity: 0.19,
      inclinationDeg: 28.2,
      scale: [1.62, 0.62, 0.86] as const
    },
    {
      name: 'Makemake',
      nameZh: '鸟神星',
      radius: 0.096,
      orbitRadius: 34.0,
      angle: 4.1,
      color: '#bc7f58',
      eccentricity: 0.16,
      inclinationDeg: 29.0,
      scale: [1.08, 0.92, 1] as const
    },
    {
      name: 'Eris',
      nameZh: '阋神星',
      radius: 0.108,
      orbitRadius: 36.3,
      angle: 5.42,
      color: '#d6d9dc',
      eccentricity: 0.44,
      inclinationDeg: 44.0,
      scale: [1.04, 0.94, 1] as const
    }
  ];

  for (const body of bodies) {
    const orbitPlane = new THREE.Group();
    orbitPlane.rotation.x = THREE.MathUtils.degToRad(body.inclinationDeg);
    orbitPlane.add(createSmallBodyOrbit(body.orbitRadius, body.eccentricity, body.color));

    const group = new THREE.Group();
    const semiMinor = body.orbitRadius * Math.sqrt(1 - body.eccentricity * body.eccentricity);
    group.position.set(
      body.orbitRadius * (Math.cos(body.angle) - body.eccentricity),
      0,
      Math.sin(body.angle) * semiMinor
    );

    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(body.radius, 24, 18),
      new THREE.MeshStandardMaterial({
        color: body.color,
        roughness: 0.92,
        metalness: 0.02,
        emissive: body.color,
        emissiveIntensity: 0.04
      })
    );
    mesh.scale.set(body.scale[0], body.scale[1], body.scale[2]);
    group.add(mesh);

    const label = createSmallBodyLabel(body.nameZh, body.name);
    label.position.set(0, body.radius + 0.32, 0);
    group.add(label);
    orbitPlane.add(group);
    root.add(orbitPlane);
  }

  root.userData.bodyCount = bodies.length;
  return root;
}

function createSmallBodyOrbit(radius: number, eccentricity: number, color: string) {
  const semiMinor = radius * Math.sqrt(1 - eccentricity * eccentricity);
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= 240; index += 1) {
    const angle = (index / 240) * Math.PI * 2;
    points.push(new THREE.Vector3(radius * (Math.cos(angle) - eccentricity), 0, semiMinor * Math.sin(angle)));
  }
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: radius > 20 ? 0.16 : 0.24,
      depthWrite: false
    })
  );
}

function createSmallBodyLabel(nameZh: string, name: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 86;
  const context = canvas.getContext('2d');
  if (context) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = '700 22px Inter, system-ui, sans-serif';
    context.fillStyle = 'rgba(232, 224, 204, 0.88)';
    context.textAlign = 'center';
    context.fillText(nameZh, canvas.width / 2, 34);
    context.font = '500 14px Inter, system-ui, sans-serif';
    context.fillStyle = 'rgba(214, 201, 174, 0.72)';
    context.fillText(name, canvas.width / 2, 56);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0.58,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(0.94, 0.32, 1);
  return sprite;
}

function createDebrisBelt(innerRadius: number, outerRadius: number, count: number, color: string, seed: string) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const random = seededRandom(seed);

  for (let index = 0; index < count; index += 1) {
    const lane = seed === 'asteroids' ? Math.floor(random() * 5) / 5 : random();
    const kirkwoodGap = seed === 'asteroids' && random() > 0.76 ? 0.08 : 0;
    const radius = innerRadius + (lane + random() * 0.18 + kirkwoodGap) * (outerRadius - innerRadius);
    const angle = random() * Math.PI * 2;
    const wobble = (random() - 0.5) * (seed === 'kuiper' ? 0.72 : 0.5);
    const clump = seed === 'asteroids' ? 1 + Math.sin(angle * 5.2) * 0.025 : 1;
    positions[index * 3] = Math.cos(angle) * radius;
    positions[index * 3 + 1] = wobble;
    positions[index * 3 + 2] = Math.sin(angle) * radius * (0.96 + random() * 0.08) * clump;
    sizes[index] = 0.03 + random() * 0.07;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  const material = new THREE.PointsMaterial({
    color,
    size: seed === 'kuiper' ? 0.035 : 0.052,
    transparent: true,
    opacity: seed === 'kuiper' ? 0.28 : 0.5,
    sizeAttenuation: true
  });

  return new THREE.Points(geometry, material);
}

function getOrbitPosition(planet: Planet, simDay: number) {
  const meanAnomaly = THREE.MathUtils.degToRad(planet.phaseDeg) + (simDay / planet.orbitalPeriodDays) * Math.PI * 2;
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, planet.eccentricity);
  const semiMajor = planet.distance;
  const semiMinor = semiMajor * Math.sqrt(1 - planet.eccentricity * planet.eccentricity);
  return new THREE.Vector3(
    semiMajor * (Math.cos(eccentricAnomaly) - planet.eccentricity),
    0,
    semiMinor * Math.sin(eccentricAnomaly)
  );
}

function makeOrbitPoints(planet: Planet, segments: number) {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const eccentricAnomaly = (index / segments) * Math.PI * 2;
    const semiMajor = planet.distance;
    const semiMinor = semiMajor * Math.sqrt(1 - planet.eccentricity * planet.eccentricity);
    points.push(
      new THREE.Vector3(
        semiMajor * (Math.cos(eccentricAnomaly) - planet.eccentricity),
        0,
        semiMinor * Math.sin(eccentricAnomaly)
      )
    );
  }
  return points;
}

function makeCircularPoints(radius: number, segments: number) {
  const points: THREE.Vector3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
  }
  return points;
}

function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number) {
  let eccentricAnomaly = meanAnomaly;
  for (let index = 0; index < 5; index += 1) {
    eccentricAnomaly =
      eccentricAnomaly -
      (eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly) - meanAnomaly) /
        (1 - eccentricity * Math.cos(eccentricAnomaly));
  }
  return eccentricAnomaly;
}

function getRotationStep(planet: Planet, deltaSeconds: number) {
  const normalizedHours = Math.max(4, Math.min(900, Math.abs(planet.rotationHours)));
  const direction = Math.sign(planet.rotationHours) || 1;
  return direction * (0.18 + 14 / normalizedHours) * deltaSeconds;
}

function createSunTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 384;
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const random = seededRandom('solar-surface');
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#fff4a8');
  gradient.addColorStop(0.48, '#ffb347');
  gradient.addColorStop(1, '#f06d2f');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = 0; row < 58; row += 1) {
    const y = (row / 58) * canvas.height;
    context.fillStyle = row % 2 === 0 ? 'rgba(255, 255, 204, 0.14)' : 'rgba(128, 46, 18, 0.1)';
    context.beginPath();
    for (let x = -20; x <= canvas.width + 20; x += 16) {
      const wave = Math.sin(x * 0.035 + row * 0.8) * 6 + Math.sin(x * 0.012) * 10;
      if (x === -20) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.lineTo(canvas.width + 20, y + 14 + random() * 10);
    context.lineTo(-20, y + 14 + random() * 10);
    context.closePath();
    context.fill();
  }

  for (let index = 0; index < 420; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 2 + random() * 10;
    const flare = context.createRadialGradient(x, y, 0, x, y, radius);
    flare.addColorStop(0, 'rgba(255, 255, 210, 0.34)');
    flare.addColorStop(1, 'rgba(255, 255, 210, 0)');
    context.fillStyle = flare;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  for (let index = 0; index < 34; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = 4 + random() * 14;
    const spot = context.createRadialGradient(x, y, 0, x, y, radius);
    spot.addColorStop(0, 'rgba(88, 34, 18, 0.32)');
    spot.addColorStop(0.5, 'rgba(140, 48, 20, 0.18)');
    spot.addColorStop(1, 'rgba(255, 180, 58, 0)');
    context.fillStyle = spot;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createGlowTexture(color: string) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) {
    return new THREE.CanvasTexture(canvas);
  }

  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, colorWithAlpha(color, 0.9));
  gradient.addColorStop(0.3, colorWithAlpha(color, 0.32));
  gradient.addColorStop(0.72, colorWithAlpha(color, 0.08));
  gradient.addColorStop(1, colorWithAlpha(color, 0));
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeCoronaPoints() {
  const count = 700;
  const positions = new Float32Array(count * 3);
  const random = seededRandom('sun-corona');
  for (let index = 0; index < count; index += 1) {
    const radius = 1.8 + random() * 1.7;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.cos(phi);
    positions[index * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  return positions;
}

function seededRandom(seed: string) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value ^= seed.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function colorWithAlpha(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const number = Number.parseInt(clean, 16);
  return `rgba(${number >> 16}, ${(number >> 8) & 0xff}, ${number & 0xff}, ${alpha})`;
}

function coalesceDirectControlCommands(commands: GestureCommand[]) {
  const keepIndexes = new Set<number>();
  const latestDirectIndexes = new Map<string, number>();

  const flushDirect = () => {
    for (const index of latestDirectIndexes.values()) {
      keepIndexes.add(index);
    }
    latestDirectIndexes.clear();
  };

  commands.forEach((command, index) => {
    const directKey = getDirectControlCoalesceKey(command);
    if (directKey) {
      latestDirectIndexes.set(directKey, index);
      return;
    }

    flushDirect();
    keepIndexes.add(index);
  });

  flushDirect();
  return commands.filter((_, index) => keepIndexes.has(index));
}

function getDirectControlCoalesceKey(command: GestureCommand) {
  if (command.type === 'pinchControl' && (command.phase === 'move' || command.phase === 'rebase')) {
    return `pinch:${command.sessionId}`;
  }

  if (command.type === 'spaceControl' && (command.phase === 'move' || command.phase === 'rebase')) {
    return `space:${command.sessionId}`;
  }

  return null;
}

function normalizeAngle(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getAdaptiveDirectControlAlpha(baseFollowRate: number, deltaSeconds: number, targetError: number) {
  const errorBoost = clampNumber(targetError / 5.5, 0, 1);
  const followRate = baseFollowRate + errorBoost * 28;
  return 1 - Math.exp(-followRate * deltaSeconds);
}

function disposeMaterial(material: THREE.Material) {
  const candidate = material as THREE.Material & {
    map?: THREE.Texture;
    bumpMap?: THREE.Texture;
    alphaMap?: THREE.Texture;
    emissiveMap?: THREE.Texture;
  };
  candidate.map?.dispose();
  candidate.bumpMap?.dispose();
  candidate.alphaMap?.dispose();
  candidate.emissiveMap?.dispose();
  material.dispose();
}

function getNextAdaptiveInteractionQuality(current: number, interactionMode: boolean, fps: number, renderMs: number) {
  if (!interactionMode) {
    return 1.24;
  }

  if (fps >= 28 && renderMs < 1.4) {
    return Math.min(1.42, current + 0.06);
  }

  if (fps < 23 || renderMs > 3.6) {
    return Math.max(0.94, current - 0.1);
  }

  return current;
}

function getRenderPixelRatio(host: HTMLElement, interactionMode = false, adaptiveQuality = 1) {
  const deviceRatio = Math.min(window.devicePixelRatio || 1, 1.5);
  const largeViewportScale = host.clientWidth >= 1200 ? 0.58 : host.clientWidth >= 900 ? 0.78 : 1;
  const interactionScale = interactionMode ? (host.clientWidth >= 900 ? 0.48 : 0.74) : 1;
  const minRatio = interactionMode ? (host.clientWidth >= 900 ? 0.38 : 0.5) : 0.52;
  const baseRatio = Math.max(minRatio, deviceRatio * largeViewportScale * interactionScale);
  const maxRatio = interactionMode ? (host.clientWidth >= 1200 ? 0.52 : 0.9) : 1.2;
  return Math.max(minRatio, Math.min(maxRatio, baseRatio * adaptiveQuality));
}
