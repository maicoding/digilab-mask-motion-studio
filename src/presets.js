export const CANVAS_PRESETS = [
  { id: 'square', label: 'Instagram Quadrat', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Instagram Portrait', width: 1080, height: 1350 },
  { id: 'story', label: 'Story / Reel', width: 1080, height: 1920 },
  { id: 'landscape', label: 'Landscape Feed', width: 1080, height: 566 },
];

export const COLOR_PRESETS = [
  { id: 'pink-lila', label: 'Pink / Lila', background: '#D562EB', frame: '#000000', placeholder: '#1E1E1A', accent: '#FFFFFF' },
  { id: 'tuerkis-lila', label: 'Türkis / Lila', background: '#00FDFF', frame: '#000000', placeholder: '#22221F', accent: '#9933FF' },
  { id: 'gelb-schwarz', label: 'Gelb / Schwarz', background: '#FFF500', frame: '#000000', placeholder: '#1E1E1A', accent: '#000000' },
  { id: 'blau-weiss', label: 'Blau / Weiß', background: '#3355FF', frame: '#FFFFFF', placeholder: '#111111', accent: '#FFFFFF' },
  { id: 'orange-weiss', label: 'Orange / Weiß', background: '#FF6E00', frame: '#FFFFFF', placeholder: '#1C1711', accent: '#FFFFFF' },
  { id: 'gruen-schwarz', label: 'Grün / Schwarz', background: '#00FF0A', frame: '#000000', placeholder: '#141A14', accent: '#000000' },
  { id: 'schwarz-weiss', label: 'Schwarz / Weiß', background: '#000000', frame: '#FFFFFF', placeholder: '#202020', accent: '#FFFFFF' },
  { id: 'weiss-blau', label: 'Weiß / Blau', background: '#FFFFFF', frame: '#3355FF', placeholder: '#202020', accent: '#3355FF' },
];

export const LOGO_PRESETS = [
  {
    id: 'digilab-kombi',
    name: 'DigiLab.ai Kombi',
    src: '/logos/digilab-ai-kombi-black.png',
    defaults: {
      tint: '#FFFFFF',
      preserveColor: false,
      removeWhite: true,
      whiteThreshold: 240,
    },
  },
  {
    id: 'digilab-gelb',
    name: 'digilab.ai Gelb',
    src: '/logos/dwd-digilab-ai-gelb.svg',
    defaults: {
      tint: '#FFF500',
      preserveColor: true,
      removeWhite: false,
      whiteThreshold: 240,
    },
  },
  {
    id: 'bildmarke',
    name: 'DWD Bildmarke',
    src: '/logos/dwd-bildmarke-blau.png',
    defaults: {
      tint: '#3355FF',
      preserveColor: false,
      removeWhite: true,
      whiteThreshold: 240,
    },
  },
];

export const MASK_PRESETS = [
  { id: 'post-form', label: 'Post Form', width: 0.78, height: 0.78, shapeScale: 0.92, squishX: 1.02, squishY: 1.08, pixelSize: 34, points: 18, turbulence: 0.2, complexity: 0.45 },
  { id: 'story-form', label: 'Story Form', width: 0.78, height: 0.56, shapeScale: 0.88, squishX: 1.06, squishY: 1.12, pixelSize: 30, points: 18, turbulence: 0.22, complexity: 0.48 },
  { id: 'wide-form', label: 'Wide Form', width: 0.82, height: 0.54, shapeScale: 0.94, squishX: 1.12, squishY: 0.94, pixelSize: 28, points: 16, turbulence: 0.16, complexity: 0.4 },
];

export const createInitialScene = () => ({
  presetId: 'story',
  colorPresetId: 'pink-lila',
  backgroundColor: '#D562EB',
  useCustomBackground: false,
  imageSrc: '',
  imageName: '',
  playback: {
    playing: true,
    duration: 6,
    fps: 30,
    rate: 1,
    time: 0,
    loop: true,
  },
  stage: {
    x: 0.5,
    y: 0.52,
    width: 0.78,
    height: 0.56,
    rotation: 0,
    fill: '#000000',
    shadow: 0.22,
    radius: 0,
  },
  mask: {
    presetId: 'story-form',
    shapeScale: 0.88,
    squishX: 1.06,
    squishY: 1.12,
    pixelSize: 30,
    points: 18,
    turbulence: 0.22,
    complexity: 0.48,
    evolutionSpeed: 0.22,
    wobble: 0.13,
    asymmetry: 0.17,
    seed: 4201,
    xOffset: 0,
    yOffset: 0,
  },
  imageMotion: {
    scale: 1.05,
    driftX: 0.08,
    driftY: 0.05,
    zoom: 0.12,
    zoomSpeed: 0.18,
    rotate: 3,
    rotateSpeed: 0.08,
  },
  overlay: {
    showLogo: true,
    logoSrc: '/logos/digilab-ai-kombi-black.png',
    logoName: 'DigiLab.ai Kombi',
    logoTint: '#FFFFFF',
    preserveColor: false,
    removeWhite: true,
    whiteThreshold: 240,
    logoScale: 0.9,
    logoX: 0.92,
    logoY: 0.94,
    caption: '',
  },
});
