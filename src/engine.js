const scratch = new Map();
const tintCache = new Map();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const fract = (value) => value - Math.floor(value);

const getScratchCanvas = (key, width, height) => {
  let canvas = scratch.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    scratch.set(key, canvas);
  }
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  return canvas;
};

const hash = (seed) => fract(Math.sin(seed * 12.9898) * 43758.5453);

const clampByte = (value) => Math.max(0, Math.min(255, Math.round(value)));

const hexToRgb = (hex) => {
  const safe = hex.replace('#', '');
  const value = safe.length === 3 ? safe.split('').map((part) => part + part).join('') : safe;
  const parsed = Number.parseInt(value, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
};

const getProcessedAsset = (image, settings) => {
  const key = [
    image.src || image.width,
    settings.tint,
    settings.preserveColor,
    settings.removeWhite,
    settings.whiteThreshold,
  ].join(':');
  const cached = tintCache.get(key);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  if (settings.removeWhite) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const threshold = settings.whiteThreshold ?? 240;
    for (let index = 0; index < imageData.data.length; index += 4) {
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      if ((r + g + b) / 3 >= threshold) {
        imageData.data[index + 3] = 0;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }

  if (!settings.preserveColor) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = settings.tint;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  tintCache.set(key, canvas);
  return canvas;
};

const makeMaskPolygon = (mask, time) => {
  const points = [];
  const total = Math.max(8, mask.points);
  for (let index = 0; index < total; index += 1) {
    const angle = (index / total) * Math.PI * 2;
    const waveA = Math.sin(angle * 2 + time * mask.evolutionSpeed * 6 + mask.seed * 0.0021) * mask.asymmetry;
    const waveB = Math.sin(angle * (2 + mask.complexity * 10) - time * mask.evolutionSpeed * 4 + index * 0.27) * mask.wobble;
    const waveC = (hash(mask.seed + index * 8.3) - 0.5) * mask.turbulence * 0.8;
    const radius = mask.shapeScale * clamp(0.78 + waveA + waveB + waveC, 0.36, 1.18);
    points.push({
      x: Math.cos(angle) * radius * mask.squishX,
      y: Math.sin(angle) * radius * mask.squishY,
    });
  }
  return points;
};

const drawPixelMask = (maskCanvas, mask, time, fill) => {
  const ctx = maskCanvas.getContext('2d');
  const resolution = maskCanvas.width;
  const center = resolution / 2;
  const polygon = makeMaskPolygon(mask, time);
  ctx.save();
  ctx.translate(center + mask.xOffset * resolution * 0.08, center + mask.yOffset * resolution * 0.08);
  ctx.scale(center, center);
  ctx.fillStyle = fill;
  ctx.beginPath();
  polygon.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.closePath();
  ctx.fill();
  ctx.restore();
};

const drawStage = (ctx, width, height, stage) => {
  const stageWidth = width * stage.width;
  const stageHeight = height * stage.height;
  const x = width * stage.x - stageWidth / 2;
  const y = height * stage.y - stageHeight / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = stage.shadow * 140;
  ctx.fillStyle = stage.fill;
  if (stage.radius > 0) {
    const radius = Math.min(stage.radius * Math.min(stageWidth, stageHeight), Math.min(stageWidth, stageHeight) / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, stageWidth, stageHeight, radius);
    ctx.fill();
  } else {
    ctx.fillRect(x, y, stageWidth, stageHeight);
  }
  ctx.restore();
  return { x, y, width: stageWidth, height: stageHeight };
};

const drawMaskedImage = (ctx, bounds, scene, time, image, colors) => {
  const maskSize = Math.round(Math.max(36, scene.mask.pixelSize));
  const maskCanvas = getScratchCanvas(`mask:${scene.mask.presetId}:${maskSize}`, maskSize, maskSize);
  drawPixelMask(maskCanvas, scene.mask, time, '#ffffff');

  const contentCanvas = getScratchCanvas(`content:${bounds.width}:${bounds.height}`, Math.ceil(bounds.width), Math.ceil(bounds.height));
  const contentCtx = contentCanvas.getContext('2d');
  contentCtx.clearRect(0, 0, contentCanvas.width, contentCanvas.height);
  contentCtx.fillStyle = colors.placeholder;
  contentCtx.fillRect(0, 0, contentCanvas.width, contentCanvas.height);

  if (image) {
    const driftX = Math.sin(time * 1.3) * scene.imageMotion.driftX;
    const driftY = Math.cos(time * 1.17) * scene.imageMotion.driftY;
    const zoom = 1 + Math.sin(time * scene.imageMotion.zoomSpeed * 6) * scene.imageMotion.zoom;
    const rotation = Math.sin(time * scene.imageMotion.rotateSpeed * 6) * scene.imageMotion.rotate;
    const fitScale = Math.max(contentCanvas.width / image.width, contentCanvas.height / image.height) * scene.imageMotion.scale * zoom;
    const drawWidth = image.width * fitScale;
    const drawHeight = image.height * fitScale;
    contentCtx.save();
    contentCtx.translate(contentCanvas.width / 2 + driftX * contentCanvas.width, contentCanvas.height / 2 + driftY * contentCanvas.height);
    contentCtx.rotate((rotation * Math.PI) / 180);
    contentCtx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
    contentCtx.restore();
  }

  const finalMaskCanvas = getScratchCanvas(`mask-final:${bounds.width}:${bounds.height}`, Math.ceil(bounds.width), Math.ceil(bounds.height));
  const finalMaskCtx = finalMaskCanvas.getContext('2d');
  finalMaskCtx.clearRect(0, 0, finalMaskCanvas.width, finalMaskCanvas.height);
  finalMaskCtx.imageSmoothingEnabled = false;
  finalMaskCtx.drawImage(maskCanvas, 0, 0, finalMaskCanvas.width, finalMaskCanvas.height);

  contentCtx.globalCompositeOperation = 'destination-in';
  contentCtx.drawImage(finalMaskCanvas, 0, 0, contentCanvas.width, contentCanvas.height);
  contentCtx.globalCompositeOperation = 'source-over';

  ctx.drawImage(contentCanvas, bounds.x, bounds.y, bounds.width, bounds.height);
};

const drawLogo = (ctx, width, height, overlay, logoImage) => {
  if (!overlay.showLogo || !logoImage) {
    return;
  }
  const renderTarget = getProcessedAsset(logoImage, {
    tint: overlay.logoTint,
    preserveColor: overlay.preserveColor,
    removeWhite: overlay.removeWhite,
    whiteThreshold: overlay.whiteThreshold,
  });
  const logoWidth = Math.min(width, height) * 0.13 * overlay.logoScale;
  const ratio = renderTarget.width / renderTarget.height || 1;
  const logoHeight = logoWidth / ratio;
  const x = width * overlay.logoX - logoWidth / 2;
  const y = height * overlay.logoY - logoHeight / 2;
  ctx.drawImage(renderTarget, x, y, logoWidth, logoHeight);
};

export const renderScene = ({ ctx, width, height, scene, colors, time, getImage }) => {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = scene.useCustomBackground ? scene.backgroundColor : colors.background;
  ctx.fillRect(0, 0, width, height);

  const bounds = drawStage(ctx, width, height, {
    ...scene.stage,
    fill: colors.frame,
  });

  const image = getImage(scene.imageSrc);
  drawMaskedImage(ctx, bounds, scene, time, image, colors);

  const logoImage = getImage(scene.overlay.logoSrc);
  drawLogo(ctx, width, height, scene.overlay, logoImage);

  if (scene.overlay.caption) {
    ctx.fillStyle = colors.accent;
    ctx.font = `${Math.max(16, Math.round(width * 0.024))}px "Montserrat", sans-serif`;
    ctx.textBaseline = 'top';
    ctx.fillText(scene.overlay.caption, Math.min(width, height) * 0.04, height - Math.min(width, height) * 0.08);
  }
};
