import * as THREE from 'three';
import type { Planet, PlanetTextureKind } from '../data/planets';

type DrawingContext = CanvasRenderingContext2D;

const textureSize = {
  width: 1536,
  height: 768
};

export function createPlanetTexture(planet: Planet) {
  const { canvas, context } = makeCanvas(textureSize.width, textureSize.height);
  paintBase(context, planet.color);

  switch (planet.textureKind) {
    case 'cratered':
      paintCratered(context, planet);
      break;
    case 'venus-cloud':
      paintVenusClouds(context, planet);
      break;
    case 'earth':
      paintEarth(context);
      break;
    case 'martian':
      paintMars(context);
      break;
    case 'jupiter':
      paintJupiter(context);
      break;
    case 'saturn':
      paintSaturn(context);
      break;
    case 'ice':
      paintIceGiant(context, planet.textureKind);
      break;
    case 'storm-ice':
      paintIceGiant(context, planet.textureKind);
      break;
  }

  addFineGrain(context, planet.name, 0.12);
  return finalizeTexture(canvas);
}

export function createPlanetBumpTexture(planet: Planet) {
  const { canvas, context } = makeCanvas(768, 384);
  context.fillStyle = '#777';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const random = seededRandom(`${planet.id}:bump`);
  const craterCount = planet.textureKind === 'cratered' ? 720 : planet.textureKind === 'martian' ? 390 : 160;
  const strength = planet.type.includes('rocky') ? 0.22 : 0.08;

  for (let index = 0; index < craterCount; index += 1) {
    const x = random() * canvas.width;
    const y = random() * canvas.height;
    const radius = (random() ** 2) * 16 + 1.2;
    const gradient = context.createRadialGradient(x, y, radius * 0.12, x, y, radius);
    gradient.addColorStop(0, `rgba(220, 220, 220, ${strength})`);
    gradient.addColorStop(0.48, `rgba(110, 110, 110, ${strength})`);
    gradient.addColorStop(1, 'rgba(128, 128, 128, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  addFineGrain(context, `${planet.id}:bump-grain`, 0.18);
  return finalizeTexture(canvas);
}

export function createCloudTexture(kind: PlanetTextureKind) {
  const { canvas, context } = makeCanvas(textureSize.width, textureSize.height);
  context.clearRect(0, 0, canvas.width, canvas.height);

  if (kind === 'earth') {
    paintEarthCloudLayer(context);
  } else if (kind === 'venus-cloud') {
    paintDenseAtmosphereLayer(context, '#fff1c9', 0.32);
  } else if (kind === 'jupiter') {
    paintGasGiantCloudLayer(context, '#fff0c8', '#6e3d29', 0.16);
  } else if (kind === 'saturn') {
    paintGasGiantCloudLayer(context, '#fff1bf', '#83663e', 0.1);
  } else if (kind === 'storm-ice') {
    paintDenseAtmosphereLayer(context, '#9eb8ff', 0.16);
  } else if (kind === 'ice') {
    paintDenseAtmosphereLayer(context, '#d4ffff', 0.1);
  }

  const texture = finalizeTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

export function createRingTexture(color: string) {
  const { canvas, context } = makeCanvas(1024, 96);
  context.clearRect(0, 0, canvas.width, canvas.height);
  const random = seededRandom(`${color}:rings`);

  for (let x = 0; x < canvas.width; x += 1) {
    const band = 0.25 + 0.65 * Math.abs(Math.sin(x * 0.018)) + random() * 0.12;
    const alpha = Math.min(0.9, band);
    context.fillStyle = withAlpha(color, alpha);
    context.fillRect(x, 0, 1, canvas.height);

    if (x % 79 === 0 || x % 131 === 0) {
      context.fillStyle = 'rgba(5, 5, 5, 0.5)';
      context.fillRect(x, 0, 2 + random() * 5, canvas.height);
    }
  }

  return finalizeTexture(canvas);
}

function paintBase(context: DrawingContext, color: string) {
  const gradient = context.createLinearGradient(0, 0, 0, textureSize.height);
  gradient.addColorStop(0, shade(color, 32));
  gradient.addColorStop(0.48, color);
  gradient.addColorStop(1, shade(color, -34));
  context.fillStyle = gradient;
  context.fillRect(0, 0, textureSize.width, textureSize.height);
}

function paintCratered(context: DrawingContext, planet: Planet) {
  const random = seededRandom(`${planet.id}:craters`);
  for (let index = 0; index < 860; index += 1) {
    const x = random() * textureSize.width;
    const y = random() * textureSize.height;
    const radius = (random() ** 2) * 30 + 1.5;
    const gradient = context.createRadialGradient(x, y, radius * 0.2, x, y, radius);
    gradient.addColorStop(0, 'rgba(255, 245, 220, 0.18)');
    gradient.addColorStop(0.52, 'rgba(30, 25, 22, 0.26)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    if (radius > 18 && random() > 0.48) {
      context.strokeStyle = 'rgba(245, 231, 202, 0.16)';
      context.lineWidth = 1 + random() * 1.4;
      context.beginPath();
      context.arc(x, y, radius * (0.68 + random() * 0.24), 0, Math.PI * 2);
      context.stroke();
    }
  }

  for (let index = 0; index < 24; index += 1) {
    const x = random() * textureSize.width;
    const y = random() * textureSize.height;
    const length = 42 + random() * 92;
    context.strokeStyle = 'rgba(255, 239, 202, 0.08)';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x - length * 0.5, y);
    context.lineTo(x + length * 0.5, y + (random() - 0.5) * 18);
    context.stroke();
  }

  paintRayCrater(context, textureSize.width * 0.66, textureSize.height * 0.32, 110, 'rgba(255, 236, 188, 0.13)');
  paintRayCrater(context, textureSize.width * 0.22, textureSize.height * 0.64, 74, 'rgba(255, 244, 218, 0.1)');
}

function paintVenusClouds(context: DrawingContext, planet: Planet) {
  const random = seededRandom(`${planet.id}:venus`);
  for (let row = 0; row < 58; row += 1) {
    const y = (row / 58) * textureSize.height;
    const height = 10 + random() * 28;
    const offset = random() * 80;
    context.fillStyle = row % 2 === 0 ? 'rgba(255, 235, 174, 0.28)' : 'rgba(170, 116, 52, 0.14)';
    context.beginPath();
    for (let x = -40; x <= textureSize.width + 40; x += 24) {
      const wave = Math.sin((x + offset) * 0.014 + row) * 13 + Math.sin(x * 0.033) * 6;
      if (x === -40) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.lineTo(textureSize.width + 40, y + height);
    context.lineTo(-40, y + height);
    context.closePath();
    context.fill();
  }

  for (let index = 0; index < 18; index += 1) {
    paintSoftEllipse(
      context,
      random() * textureSize.width,
      random() * textureSize.height,
      30 + random() * 88,
      8 + random() * 20,
      random() * Math.PI,
      index % 2 === 0 ? 'rgba(255, 248, 207, 0.18)' : 'rgba(122, 84, 45, 0.12)'
    );
  }
}

function paintEarth(context: DrawingContext) {
  const ocean = context.createLinearGradient(0, 0, textureSize.width, textureSize.height);
  ocean.addColorStop(0, '#123b6d');
  ocean.addColorStop(0.52, '#1e75a9');
  ocean.addColorStop(1, '#092a4e');
  context.fillStyle = ocean;
  context.fillRect(0, 0, textureSize.width, textureSize.height);

  const continents = [
    { seed: 'north-america', x: 0.2, y: 0.34, rx: 120, ry: 72, color: '#4f7b45', rotation: -0.24 },
    { seed: 'south-america', x: 0.32, y: 0.59, rx: 62, ry: 112, color: '#52783f', rotation: 0.38 },
    { seed: 'eurasia', x: 0.58, y: 0.32, rx: 178, ry: 64, color: '#6e8647', rotation: 0.06 },
    { seed: 'africa', x: 0.55, y: 0.53, rx: 78, ry: 104, color: '#8d844d', rotation: -0.08 },
    { seed: 'australia', x: 0.77, y: 0.65, rx: 62, ry: 34, color: '#9b7d45', rotation: -0.08 },
    { seed: 'greenland', x: 0.35, y: 0.2, rx: 42, ry: 24, color: '#dde2d4', rotation: -0.22 }
  ];

  for (const continent of continents) {
    paintJaggedBlob(
      context,
      continent.seed,
      continent.x * textureSize.width,
      continent.y * textureSize.height,
      continent.rx,
      continent.ry,
      continent.color,
      continent.rotation
    );
  }

  context.strokeStyle = 'rgba(164, 214, 184, 0.24)';
  context.lineWidth = 2;
  for (const continent of continents.slice(0, 5)) {
    context.beginPath();
    context.ellipse(
      continent.x * textureSize.width,
      continent.y * textureSize.height,
      continent.rx * 1.03,
      continent.ry * 1.03,
      continent.rotation,
      0,
      Math.PI * 2
    );
    context.stroke();
  }

  context.fillStyle = 'rgba(248, 250, 244, 0.9)';
  context.fillRect(0, 0, textureSize.width, 34);
  context.fillRect(0, textureSize.height - 36, textureSize.width, 36);

  context.strokeStyle = 'rgba(130, 205, 255, 0.1)';
  context.lineWidth = 1;
  for (let row = 0; row < 12; row += 1) {
    const y = textureSize.height * (0.18 + row * 0.055);
    context.beginPath();
    for (let x = 0; x <= textureSize.width; x += 28) {
      const wave = Math.sin(x * 0.014 + row * 0.9) * 5;
      if (x === 0) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.stroke();
  }
}

function paintEarthCloudLayer(context: DrawingContext) {
  const random = seededRandom('earth-clouds');
  for (let index = 0; index < 132; index += 1) {
    const x = random() * textureSize.width;
    const y = random() * textureSize.height;
    const rx = 20 + random() * 80;
    const ry = 5 + random() * 18;
    const gradient = context.createRadialGradient(x, y, 2, x, y, rx);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.34)');
    gradient.addColorStop(0.48, 'rgba(255, 255, 255, 0.18)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    context.fillStyle = gradient;
    context.save();
    context.translate(x, y);
    context.rotate((random() - 0.5) * 0.7);
    context.scale(1, ry / rx);
    context.beginPath();
    context.arc(0, 0, rx, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  for (let index = 0; index < 9; index += 1) {
    const x = random() * textureSize.width;
    const y = textureSize.height * (0.22 + random() * 0.58);
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.lineWidth = 2 + random() * 2;
    context.beginPath();
    for (let turn = 0; turn < 44; turn += 1) {
      const angle = turn * 0.42;
      const radius = turn * 1.8;
      const px = x + Math.cos(angle) * radius;
      const py = y + Math.sin(angle) * radius * 0.55;
      if (turn === 0) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.stroke();
  }
}

function paintMars(context: DrawingContext) {
  const random = seededRandom('mars-surface');
  for (let index = 0; index < 390; index += 1) {
    const x = random() * textureSize.width;
    const y = random() * textureSize.height;
    const rx = 10 + random() * 78;
    const ry = 4 + random() * 22;
    context.fillStyle = random() > 0.52 ? 'rgba(91, 43, 31, 0.22)' : 'rgba(235, 147, 89, 0.18)';
    context.save();
    context.translate(x, y);
    context.rotate(random() * Math.PI);
    context.beginPath();
    context.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  context.strokeStyle = 'rgba(71, 31, 24, 0.55)';
  context.lineWidth = 9;
  context.beginPath();
  for (let x = textureSize.width * 0.08; x <= textureSize.width * 0.48; x += 24) {
    const y = textureSize.height * 0.43 + Math.sin(x * 0.018) * 11;
    if (x === textureSize.width * 0.08) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  paintSoftEllipse(
    context,
    textureSize.width * 0.64,
    textureSize.height * 0.32,
    42,
    24,
    -0.2,
    'rgba(96, 47, 34, 0.44)'
  );
  context.strokeStyle = 'rgba(240, 151, 91, 0.24)';
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(textureSize.width * 0.64, textureSize.height * 0.32, 58, 34, -0.2, 0, Math.PI * 2);
  context.stroke();

  const volcanoes = [
    [0.36, 0.37, 26],
    [0.4, 0.42, 18],
    [0.44, 0.45, 16],
    [0.33, 0.48, 14]
  ];
  for (const [xRatio, yRatio, size] of volcanoes) {
    paintSoftEllipse(
      context,
      textureSize.width * xRatio,
      textureSize.height * yRatio,
      size,
      size * 0.72,
      -0.18,
      'rgba(86, 38, 29, 0.34)'
    );
    context.strokeStyle = 'rgba(245, 172, 112, 0.22)';
    context.lineWidth = 2;
    context.beginPath();
    context.ellipse(textureSize.width * xRatio, textureSize.height * yRatio, size * 1.35, size, -0.18, 0, Math.PI * 2);
    context.stroke();
  }

  context.fillStyle = 'rgba(245, 230, 205, 0.76)';
  context.fillRect(0, 0, textureSize.width, 24);
  context.fillRect(0, textureSize.height - 28, textureSize.width, 28);
}

function paintJupiter(context: DrawingContext) {
  const bands = ['#c89157', '#e1c08d', '#8e6043', '#f0d7aa', '#b3764c', '#f4e0bd', '#7f5039'];
  let y = 0;
  const random = seededRandom('jupiter-storms');
  for (let row = 0; y < textureSize.height; row += 1) {
    const height = 16 + ((row * 17) % 34);
    context.fillStyle = bands[row % bands.length];
    context.fillRect(0, y, textureSize.width, height);
    context.fillStyle = row % 2 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(65,32,21,0.1)';
    context.fillRect(0, y + height * 0.62, textureSize.width, height * 0.2);

    context.strokeStyle = row % 2 === 0 ? 'rgba(255, 238, 196, 0.18)' : 'rgba(67, 35, 25, 0.14)';
    context.lineWidth = 1.4;
    context.beginPath();
    for (let x = 0; x <= textureSize.width; x += 24) {
      const wave = Math.sin(x * 0.019 + row * 0.7) * (2 + random() * 3);
      if (x === 0) context.moveTo(x, y + height * 0.5 + wave);
      else context.lineTo(x, y + height * 0.5 + wave);
    }
    context.stroke();
    y += height;
  }

  for (let index = 0; index < 190; index += 1) {
    const x = random() * textureSize.width;
    const cy = 120 + random() * 280;
    context.fillStyle = random() > 0.5 ? 'rgba(255, 239, 207, 0.18)' : 'rgba(89, 46, 32, 0.16)';
    context.beginPath();
    context.ellipse(x, cy, 18 + random() * 60, 3 + random() * 10, 0, 0, Math.PI * 2);
    context.fill();
  }

  const spotX = textureSize.width * 0.72;
  const spotY = textureSize.height * 0.61;
  paintSoftEllipse(context, spotX, spotY, 86, 39, -0.08, '#b94f3b');
  paintSoftEllipse(context, spotX + 4, spotY - 1, 56, 21, -0.08, 'rgba(255, 219, 172, 0.34)');
  context.strokeStyle = 'rgba(88, 38, 31, 0.42)';
  context.lineWidth = 2;
  for (let index = 0; index < 4; index += 1) {
    context.beginPath();
    context.ellipse(spotX, spotY, 96 - index * 12, 44 - index * 6, -0.08, 0, Math.PI * 2);
    context.stroke();
  }

  for (let index = 0; index < 12; index += 1) {
    const stormX = random() * textureSize.width;
    const stormY = textureSize.height * (0.22 + random() * 0.56);
    paintSoftEllipse(
      context,
      stormX,
      stormY,
      18 + random() * 42,
      5 + random() * 12,
      (random() - 0.5) * 0.3,
      random() > 0.55 ? 'rgba(255, 232, 188, 0.24)' : 'rgba(119, 58, 42, 0.2)'
    );
  }
}

function paintSaturn(context: DrawingContext) {
  const bands = ['#d8c58a', '#bca268', '#ead9a6', '#c5ad72', '#f1e2b3'];
  let y = 0;
  for (let row = 0; y < textureSize.height; row += 1) {
    const height = 13 + ((row * 11) % 26);
    context.fillStyle = bands[row % bands.length];
    context.fillRect(0, y, textureSize.width, height);
    context.fillStyle = row % 2 === 0 ? 'rgba(255, 246, 205, 0.12)' : 'rgba(84, 62, 34, 0.09)';
    context.fillRect(0, y + height * 0.58, textureSize.width, 2 + (row % 3));
    y += height;
  }

  context.strokeStyle = 'rgba(226, 211, 156, 0.3)';
  context.lineWidth = 4;
  context.beginPath();
  for (let side = 0; side <= 6; side += 1) {
    const angle = (side / 6) * Math.PI * 2 - Math.PI * 0.5;
    const x = textureSize.width * 0.5 + Math.cos(angle) * 44;
    const yPoint = textureSize.height * 0.14 + Math.sin(angle) * 21;
    if (side === 0) context.moveTo(x, yPoint);
    else context.lineTo(x, yPoint);
  }
  context.stroke();

  context.strokeStyle = 'rgba(94, 69, 38, 0.2)';
  context.lineWidth = 2;
  for (let row = 0; row < 18; row += 1) {
    const y = textureSize.height * (0.22 + row * 0.031);
    context.beginPath();
    for (let x = 0; x <= textureSize.width; x += 26) {
      const wave = Math.sin(x * 0.018 + row) * 3;
      if (x === 0) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.stroke();
  }
}

function paintIceGiant(context: DrawingContext, kind: PlanetTextureKind) {
  const random = seededRandom(`${kind}:ice`);
  const bandColor = kind === 'storm-ice' ? 'rgba(165, 190, 255, 0.16)' : 'rgba(226, 255, 255, 0.12)';
  for (let row = 0; row < 42; row += 1) {
    const y = (row / 42) * textureSize.height;
    context.fillStyle = bandColor;
    context.beginPath();
    for (let x = 0; x <= textureSize.width; x += 28) {
      const wave = Math.sin(x * 0.016 + row * 0.8) * (5 + random() * 8);
      if (x === 0) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.lineTo(textureSize.width, y + 12);
    context.lineTo(0, y + 12);
    context.closePath();
    context.fill();
  }

  if (kind === 'storm-ice') {
    paintSoftEllipse(
      context,
      textureSize.width * 0.64,
      textureSize.height * 0.56,
      64,
      24,
      -0.18,
      'rgba(12, 24, 82, 0.34)'
    );
    paintSoftEllipse(
      context,
      textureSize.width * 0.48,
      textureSize.height * 0.35,
      48,
      8,
      0.2,
      'rgba(240, 250, 255, 0.18)'
    );
    paintSoftEllipse(
      context,
      textureSize.width * 0.72,
      textureSize.height * 0.42,
      34,
      7,
      -0.28,
      'rgba(245, 252, 255, 0.16)'
    );
  } else {
    paintSoftEllipse(
      context,
      textureSize.width * 0.58,
      textureSize.height * 0.46,
      80,
      12,
      -0.12,
      'rgba(236, 255, 255, 0.1)'
    );
    paintSoftEllipse(
      context,
      textureSize.width * 0.42,
      textureSize.height * 0.32,
      96,
      18,
      0.08,
      'rgba(171, 235, 235, 0.1)'
    );
  }
}

function paintRayCrater(context: DrawingContext, x: number, y: number, radius: number, color: string) {
  context.save();
  context.translate(x, y);
  context.strokeStyle = color;
  context.lineWidth = 1.3;
  for (let index = 0; index < 28; index += 1) {
    const angle = (index / 28) * Math.PI * 2;
    const inner = radius * (0.28 + (index % 3) * 0.04);
    const outer = radius * (0.72 + (index % 5) * 0.12);
    context.beginPath();
    context.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner * 0.62);
    context.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer * 0.62);
    context.stroke();
  }
  paintSoftEllipse(context, 0, 0, radius * 0.28, radius * 0.18, 0, 'rgba(22, 18, 16, 0.2)');
  context.restore();
}

function paintDenseAtmosphereLayer(context: DrawingContext, color: string, opacity: number) {
  const random = seededRandom(`${color}:atmosphere`);
  for (let index = 0; index < 80; index += 1) {
    const y = random() * textureSize.height;
    const height = 8 + random() * 28;
    context.fillStyle = withAlpha(color, opacity * (0.4 + random() * 0.6));
    context.beginPath();
    for (let x = -30; x <= textureSize.width + 30; x += 20) {
      const wave = Math.sin(x * 0.018 + index) * 10;
      if (x === -30) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.lineTo(textureSize.width + 30, y + height);
    context.lineTo(-30, y + height);
    context.closePath();
    context.fill();
  }
}

function paintGasGiantCloudLayer(context: DrawingContext, lightColor: string, shadowColor: string, opacity: number) {
  const random = seededRandom(`${lightColor}:gas-clouds`);
  for (let row = 0; row < 72; row += 1) {
    const y = (row / 72) * textureSize.height;
    context.strokeStyle = row % 2 === 0 ? withAlpha(lightColor, opacity) : withAlpha(shadowColor, opacity * 0.84);
    context.lineWidth = 3 + random() * 7;
    context.beginPath();
    for (let x = -20; x <= textureSize.width + 20; x += 18) {
      const wave = Math.sin(x * 0.02 + row * 0.55) * (3 + random() * 5);
      if (x === -20) context.moveTo(x, y + wave);
      else context.lineTo(x, y + wave);
    }
    context.stroke();
  }

  for (let index = 0; index < 46; index += 1) {
    paintSoftEllipse(
      context,
      random() * textureSize.width,
      random() * textureSize.height,
      24 + random() * 76,
      3 + random() * 13,
      (random() - 0.5) * 0.22,
      random() > 0.5 ? withAlpha(lightColor, opacity * 1.4) : withAlpha(shadowColor, opacity)
    );
  }
}

function paintSoftEllipse(
  context: DrawingContext,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  color: string
) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.fillStyle = color;
  context.beginPath();
  context.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function paintJaggedBlob(
  context: DrawingContext,
  seed: string,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: string,
  rotation: number
) {
  const random = seededRandom(`blob:${seed}`);
  const pointCount = 22;

  context.save();
  context.translate(centerX, centerY);
  context.rotate(rotation);
  context.fillStyle = color;
  context.beginPath();
  for (let index = 0; index <= pointCount; index += 1) {
    const angle = (index / pointCount) * Math.PI * 2;
    const wobble = 0.72 + random() * 0.55 + Math.sin(angle * 3 + random() * 2) * 0.08;
    const x = Math.cos(angle) * radiusX * wobble;
    const y = Math.sin(angle) * radiusY * wobble;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fill();

  for (let index = 0; index < 11; index += 1) {
    context.fillStyle = index % 2 === 0 ? 'rgba(48, 84, 42, 0.2)' : 'rgba(202, 176, 106, 0.18)';
    context.beginPath();
    context.ellipse(
      (random() - 0.5) * radiusX * 1.3,
      (random() - 0.5) * radiusY * 1.3,
      radiusX * (0.1 + random() * 0.22),
      radiusY * (0.04 + random() * 0.12),
      random() * Math.PI,
      0,
      Math.PI * 2
    );
    context.fill();
  }
  context.restore();
}

function addFineGrain(context: DrawingContext, seed: string, opacity: number) {
  const random = seededRandom(`${seed}:grain`);
  const image = context.getImageData(0, 0, context.canvas.width, context.canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const noise = (random() - 0.5) * 255 * opacity;
    image.data[index] = clampByte(image.data[index] + noise);
    image.data[index + 1] = clampByte(image.data[index + 1] + noise);
    image.data[index + 2] = clampByte(image.data[index + 2] + noise);
  }
  context.putImageData(image, 0, 0);
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) {
    throw new Error('Canvas 2D context is unavailable');
  }
  return { canvas, context };
}

function finalizeTexture(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
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

function shade(hex: string, amount: number) {
  const clean = hex.replace('#', '');
  const number = Number.parseInt(clean, 16);
  const r = clampByte((number >> 16) + amount);
  const g = clampByte(((number >> 8) & 0xff) + amount);
  const b = clampByte((number & 0xff) + amount);
  return `rgb(${r}, ${g}, ${b})`;
}

function withAlpha(hex: string, alpha: number) {
  const clean = hex.replace('#', '');
  const number = Number.parseInt(clean, 16);
  const r = number >> 16;
  const g = (number >> 8) & 0xff;
  const b = number & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function clampByte(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
