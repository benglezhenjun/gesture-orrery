export type PlanetId =
  | 'mercury'
  | 'venus'
  | 'earth'
  | 'mars'
  | 'jupiter'
  | 'saturn'
  | 'uranus'
  | 'neptune';

export type PlanetTextureKind =
  | 'cratered'
  | 'venus-cloud'
  | 'earth'
  | 'martian'
  | 'jupiter'
  | 'saturn'
  | 'ice'
  | 'storm-ice';

export type MajorMoon = {
  name: string;
  nameZh: string;
  radius: number;
  distance: number;
  orbitalPeriodDays: number;
  color: string;
};

export type RingSystem = {
  innerRadius: number;
  outerRadius: number;
  color: string;
  opacity: number;
  tiltDeg: number;
};

export type Planet = {
  id: PlanetId;
  name: string;
  nameZh: string;
  type: string;
  radius: number;
  distance: number;
  realDiameterKm: number;
  realDistanceAu: number;
  orbitalPeriodDays: number;
  rotationHours: number;
  axialTiltDeg: number;
  orbitalInclinationDeg: number;
  eccentricity: number;
  phaseDeg: number;
  color: string;
  accent: string;
  textureKind: PlanetTextureKind;
  atmosphereColor?: string;
  ring?: RingSystem;
  majorMoons: MajorMoon[];
  knownMoons: number;
  summary: string;
};

export const planets: Planet[] = [
  {
    id: 'mercury',
    name: 'Mercury',
    nameZh: '水星',
    type: 'rocky planet',
    radius: 0.3,
    distance: 4.2,
    realDiameterKm: 4879,
    realDistanceAu: 0.39,
    orbitalPeriodDays: 88,
    rotationHours: 1407.6,
    axialTiltDeg: 0.03,
    orbitalInclinationDeg: 7.0,
    eccentricity: 0.2056,
    phaseDeg: 15,
    color: '#a99a86',
    accent: '#e4c9a6',
    textureKind: 'cratered',
    majorMoons: [],
    knownMoons: 0,
    summary: '太阳系最内侧的岩石行星，表面布满撞击坑，轨道偏心率明显。'
  },
  {
    id: 'venus',
    name: 'Venus',
    nameZh: '金星',
    type: 'rocky planet',
    radius: 0.48,
    distance: 6.1,
    realDiameterKm: 12104,
    realDistanceAu: 0.72,
    orbitalPeriodDays: 225,
    rotationHours: -5832.5,
    axialTiltDeg: 177.4,
    orbitalInclinationDeg: 3.39,
    eccentricity: 0.0068,
    phaseDeg: 72,
    color: '#d9b36a',
    accent: '#ffe0a3',
    textureKind: 'venus-cloud',
    atmosphereColor: '#f4d48c',
    majorMoons: [],
    knownMoons: 0,
    summary: '厚重大气和硫酸云层包裹整颗行星，是太阳系最热的行星表面。'
  },
  {
    id: 'earth',
    name: 'Earth',
    nameZh: '地球',
    type: 'rocky planet',
    radius: 0.52,
    distance: 8.3,
    realDiameterKm: 12742,
    realDistanceAu: 1,
    orbitalPeriodDays: 365.25,
    rotationHours: 23.93,
    axialTiltDeg: 23.44,
    orbitalInclinationDeg: 0,
    eccentricity: 0.0167,
    phaseDeg: 140,
    color: '#2d76b9',
    accent: '#8fe4ff',
    textureKind: 'earth',
    atmosphereColor: '#77ccff',
    majorMoons: [
      {
        name: 'Moon',
        nameZh: '月球',
        radius: 0.14,
        distance: 1.18,
        orbitalPeriodDays: 27.3,
        color: '#c8c3b8'
      }
    ],
    knownMoons: 1,
    summary: '拥有液态水、云层和稳定生物圈的蓝色行星，也是本项目的观测基准。'
  },
  {
    id: 'mars',
    name: 'Mars',
    nameZh: '火星',
    type: 'rocky planet',
    radius: 0.39,
    distance: 10.6,
    realDiameterKm: 6779,
    realDistanceAu: 1.52,
    orbitalPeriodDays: 687,
    rotationHours: 24.62,
    axialTiltDeg: 25.19,
    orbitalInclinationDeg: 1.85,
    eccentricity: 0.0934,
    phaseDeg: 215,
    color: '#bf6143',
    accent: '#ff9b72',
    textureKind: 'martian',
    majorMoons: [
      {
        name: 'Phobos',
        nameZh: '火卫一',
        radius: 0.06,
        distance: 0.76,
        orbitalPeriodDays: 0.32,
        color: '#9c8172'
      },
      {
        name: 'Deimos',
        nameZh: '火卫二',
        radius: 0.045,
        distance: 1.0,
        orbitalPeriodDays: 1.26,
        color: '#b09483'
      }
    ],
    knownMoons: 2,
    summary: '红色岩石行星，拥有极冠、峡谷和太阳系最高的火山地貌。'
  },
  {
    id: 'jupiter',
    name: 'Jupiter',
    nameZh: '木星',
    type: 'gas giant',
    radius: 1.18,
    distance: 14.6,
    realDiameterKm: 139820,
    realDistanceAu: 5.2,
    orbitalPeriodDays: 4332.6,
    rotationHours: 9.93,
    axialTiltDeg: 3.13,
    orbitalInclinationDeg: 1.31,
    eccentricity: 0.0489,
    phaseDeg: 302,
    color: '#d0a06b',
    accent: '#ffd39a',
    textureKind: 'jupiter',
    majorMoons: [
      { name: 'Io', nameZh: '木卫一', radius: 0.12, distance: 1.62, orbitalPeriodDays: 1.77, color: '#d8bc78' },
      { name: 'Europa', nameZh: '木卫二', radius: 0.11, distance: 1.98, orbitalPeriodDays: 3.55, color: '#d7d4c8' },
      { name: 'Ganymede', nameZh: '木卫三', radius: 0.15, distance: 2.38, orbitalPeriodDays: 7.15, color: '#9f8b75' },
      { name: 'Callisto', nameZh: '木卫四', radius: 0.14, distance: 2.84, orbitalPeriodDays: 16.69, color: '#746a63' }
    ],
    knownMoons: 95,
    summary: '太阳系最大行星，条带云层和大红斑让它成为最有辨识度的气态巨行星。'
  },
  {
    id: 'saturn',
    name: 'Saturn',
    nameZh: '土星',
    type: 'gas giant',
    radius: 1.04,
    distance: 18.8,
    realDiameterKm: 116460,
    realDistanceAu: 9.58,
    orbitalPeriodDays: 10759,
    rotationHours: 10.7,
    axialTiltDeg: 26.73,
    orbitalInclinationDeg: 2.49,
    eccentricity: 0.0565,
    phaseDeg: 38,
    color: '#cdb77d',
    accent: '#f5e7ae',
    textureKind: 'saturn',
    ring: {
      innerRadius: 1.26,
      outerRadius: 2.15,
      color: '#e9d99c',
      opacity: 0.62,
      tiltDeg: 26.7
    },
    majorMoons: [
      { name: 'Titan', nameZh: '土卫六', radius: 0.14, distance: 2.64, orbitalPeriodDays: 15.95, color: '#c79a52' },
      { name: 'Rhea', nameZh: '土卫五', radius: 0.08, distance: 2.08, orbitalPeriodDays: 4.52, color: '#beb7a5' }
    ],
    knownMoons: 146,
    summary: '拥有宽阔环系统和大量卫星的气态巨行星，环面倾角是重要视觉特征。'
  },
  {
    id: 'uranus',
    name: 'Uranus',
    nameZh: '天王星',
    type: 'ice giant',
    radius: 0.76,
    distance: 22.6,
    realDiameterKm: 50724,
    realDistanceAu: 19.2,
    orbitalPeriodDays: 30687,
    rotationHours: -17.24,
    axialTiltDeg: 97.77,
    orbitalInclinationDeg: 0.77,
    eccentricity: 0.0472,
    phaseDeg: 178,
    color: '#80d4d6',
    accent: '#c2ffff',
    textureKind: 'ice',
    atmosphereColor: '#9be7e8',
    ring: {
      innerRadius: 1.08,
      outerRadius: 1.32,
      color: '#c3f1ef',
      opacity: 0.25,
      tiltDeg: 97.8
    },
    majorMoons: [
      { name: 'Titania', nameZh: '天卫三', radius: 0.08, distance: 1.46, orbitalPeriodDays: 8.71, color: '#b7c9c9' },
      { name: 'Oberon', nameZh: '天卫四', radius: 0.08, distance: 1.78, orbitalPeriodDays: 13.46, color: '#aeb8b6' }
    ],
    knownMoons: 28,
    summary: '冰巨行星，自转轴几乎横躺，淡蓝绿色大气由甲烷吸收红光形成。'
  },
  {
    id: 'neptune',
    name: 'Neptune',
    nameZh: '海王星',
    type: 'ice giant',
    radius: 0.74,
    distance: 26.6,
    realDiameterKm: 49244,
    realDistanceAu: 30.05,
    orbitalPeriodDays: 60190,
    rotationHours: 16.11,
    axialTiltDeg: 28.32,
    orbitalInclinationDeg: 1.77,
    eccentricity: 0.0086,
    phaseDeg: 246,
    color: '#496fc7',
    accent: '#8ca8ff',
    textureKind: 'storm-ice',
    atmosphereColor: '#5b87ff',
    majorMoons: [
      { name: 'Triton', nameZh: '海卫一', radius: 0.12, distance: 1.36, orbitalPeriodDays: -5.88, color: '#bfc9d4' }
    ],
    knownMoons: 16,
    summary: '最外侧的已知大行星，深蓝大气中有高速风暴和暗斑结构。'
  }
];
