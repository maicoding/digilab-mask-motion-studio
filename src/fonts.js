// Register only faces that actually loaded. A failed local face would shadow
// Adobe's web font and make FontFaceSet.load reject even when Adobe is available.
const localNames = { 100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular',
  500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Black', 900: 'Black' };
const attempts = new Map();
export const loadDegular = async (weight) => {
  const existing = [...document.fonts].filter(face =>
    face.family.replace(/['"]/g, '').toLowerCase() === 'degular' && face.status === 'loaded');
  if (existing.some(face => {
    const [min, max = min] = face.weight.split(' ').map(Number);
    return weight >= min && weight <= max;
  })) return true;
  if (!attempts.has(weight)) {
    attempts.set(weight, (async () => {
      const name = localNames[weight] ?? 'Regular';
      const face = new FontFace('Degular', `local("Degular ${name}"), local("Degular-${name}")`,
        { weight: String(weight), style: 'normal' });
      try {
        await face.load();
        document.fonts.add(face);
        return true;
      } catch {
        try {
          const faces = await document.fonts.load(`${weight} 32px "degular"`, 'ÄÖÜß DigiLab');
          return faces.length > 0;
        } catch { return false; }
      }
    })());
  }
  const result = await attempts.get(weight);
  if (!result) attempts.delete(weight);
  return result;
};

// SFNT metadata preserves the actual weight of TTF/OTF and variable fonts.
export const fontWeight = (bytes, name) => {
  try {
    const view = new DataView(bytes);
    const tag = offset => String.fromCharCode(...new Uint8Array(bytes, offset, 4));
    const count = view.getUint16(4);
    if (tag(0) === 'OTTO' || view.getUint32(0) === 0x00010000) {
      let weight = '400';
      for (let index = 0; index < count; index++) {
        const table = 12 + index * 16;
        const offset = view.getUint32(table + 8);
        if (tag(table) === 'OS/2') weight = String(view.getUint16(offset + 4));
        if (tag(table) === 'fvar') {
          const axes = offset + view.getUint16(offset + 4);
          const axisCount = view.getUint16(offset + 8);
          const axisSize = view.getUint16(offset + 10);
          for (let axis = 0; axis < axisCount; axis++) {
            const record = axes + axis * axisSize;
            if (tag(record) === 'wght') return `${view.getInt32(record + 4) / 65536} ${view.getInt32(record + 12) / 65536}`;
          }
        }
      }
      return weight;
    }
  } catch { /* Compressed web fonts use their filename below. */ }
  const token = name.toLowerCase();
  if (/semibold|semi-bold/.test(token)) return '600';
  if (/black|heavy|extrabold/.test(token)) return '800';
  if (/bold/.test(token)) return '700';
  if (/medium/.test(token)) return '500';
  if (/light/.test(token)) return '300';
  return '400';
};
