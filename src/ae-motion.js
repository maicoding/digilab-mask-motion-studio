const animations = new Map();
const pending = new Map();

export const getAeMotion = (id) => animations.get(id);

export const loadAeMotion = async (id) => {
  if (!id || animations.has(id)) return animations.get(id);
  if (pending.has(id)) return pending.get(id);
  const task = (async () => {
    const response = await fetch(`./ae-motion/${id}.bin.gz`);
    if (!response.ok) throw new Error('Die AE-Maskenanimation konnte nicht geladen werden.');
    if (typeof DecompressionStream === 'undefined') throw new Error('Bitte einen aktuellen Browser für die AE-Vorlagen verwenden.');
    const buffer = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    const view = new DataView(buffer);
    if (view.getUint32(0, false) !== 0x44574431) throw new Error('Die AE-Maskendatei ist beschädigt.');
    const width = view.getUint16(4, true);
    const height = view.getUint16(6, true);
    const fps = view.getUint16(8, true);
    const count = view.getUint16(10, true);
    const frames = [];
    let offset = 12;
    for (let frame = 0; frame < count; frame++) {
      const contours = [];
      const contourCount = view.getUint16(offset, true); offset += 2;
      for (let contour = 0; contour < contourCount; contour++) {
        const length = view.getUint16(offset, true); offset += 2;
        contours.push(new Uint16Array(buffer, offset, length * 2));
        offset += length * 4;
      }
      frames.push(contours);
    }
    if (offset !== buffer.byteLength || !width || !height || !fps || !count) throw new Error('Die AE-Maskendatei ist unvollständig.');
    const animation = { width, height, fps, duration: count / fps, frames };
    animations.set(id, animation);
    return animation;
  })();
  pending.set(id, task);
  try { return await task; } finally { pending.delete(id); }
};

export const drawAeMotion = (ctx, animation, time) => {
  const wrapped = ((time % animation.duration) + animation.duration) % animation.duration;
  const frame = Math.min(animation.frames.length - 1, Math.floor(wrapped * animation.fps + 0.00001));
  ctx.beginPath();
  for (const points of animation.frames[frame]) {
    if (points.length < 6) continue;
    ctx.moveTo(points[0] / 4, points[1] / 4);
    for (let index = 2; index < points.length; index += 2) ctx.lineTo(points[index] / 4, points[index + 1] / 4);
    ctx.closePath();
  }
  ctx.fillStyle = '#fff';
  ctx.fill('evenodd');
};
