import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrayBufferTarget, Muxer } from 'mp4-muxer';
import {
  Download,
  Film,
  ImagePlus,
  Palette,
  Play,
  RotateCcw,
  Settings2,
  SquareDashedMousePointer,
  Type,
  Upload,
} from 'lucide-react';
import {
  CANVAS_PRESETS,
  COLOR_PRESETS,
  FORM_MOTION_PRESETS,
  LOGO_PRESETS,
  MASK_PRESETS,
  MOTION_PRESETS,
  createInitialScene,
} from './presets.js';
import { renderScene } from './engine.js';
import { loadDegular, fontWeight } from './fonts.js';
import { AE_TEMPLATES, applyAeTemplate } from './ae-templates.js';
import { loadAeMotion } from './ae-motion.js';

const MP4_ENCODER_CANDIDATES = [
  { codec: 'avc1.420033', avc: { format: 'avc' } },
  { codec: 'avc1.4d0033', avc: { format: 'avc' } },
];

const MP4_MEDIA_RECORDER_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs="avc1.42E01E"',
  'video/mp4;codecs="avc1"',
  'video/mp4',
];

const EXPORT_PRESETS = [
  { id: 'instagram-post', label: 'Post 1080x1080', presetId: 'square', duration: 15, fps: 30, rate: 1, loop: true },
  { id: 'instagram-story', label: 'Story 1080x1920', presetId: 'story', duration: 15, fps: 30, rate: 1, loop: true },
  { id: 'instagram-reel', label: 'Reel 1080x1920', presetId: 'story', duration: 15, fps: 30, rate: 1, loop: true },
];

const deepSet = (source, path, value) => {
  const keys = path.split('.');
  const clone = Array.isArray(source) ? [...source] : { ...source };
  let cursor = clone;
  let original = source;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    cursor[key] = Array.isArray(original[key]) ? [...original[key]] : { ...original[key] };
    cursor = cursor[key];
    original = original[key];
  });
  return clone;
};

const clampVideoTime = (duration, time) => {
  if (!Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, time);
  }
  const wrapped = ((time % duration) + duration) % duration;
  return Math.min(wrapped, Math.max(0, duration - 0.001));
};

const syncVideoFrame = async (video, time, fps) => {
  if (!video || video.readyState < 2) {
    return;
  }
  const targetTime = clampVideoTime(video.duration, time);
  const tolerance = 1 / Math.max(12, fps * 2);
  if (!video.seeking && Math.abs(video.currentTime - targetTime) <= tolerance) {
    return;
  }

  await new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timeoutId);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
    };
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error('Videobild konnte nicht geladen werden.')); };
    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error('Das Video reagiert nicht. Bitte Datei erneut laden.'));
    }, 10000);
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    try { video.currentTime = targetTime; } catch (error) { cleanup(); reject(error); }
  });
};

const useElementSize = (ref) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return size;
};

const Section = ({ title, icon: Icon, children, defaultOpen = true }) => (
  <details className="panel" open={defaultOpen}>
    <summary className="panel__title">
      <span className="panel__title-copy">
        <Icon size={15} />
        <span>{title}</span>
      </span>
    </summary>
    <div className="panel__body">{children}</div>
  </details>
);

const SelectField = ({ label, value, options, onChange }) => (
  <label className="field">
    <div className="field__head">
      <span>{label}</span>
    </div>
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value ?? option} value={option.value ?? option}>
          {option.label ?? option}
        </option>
      ))}
    </select>
  </label>
);

const SliderField = ({ label, value, min, max, step = 0.01, onChange, format }) => (
  <label className="field">
    <div className="field__head">
      <span>{label}</span>
      <span>{format ? format(value) : value}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
  </label>
);

const ALIGN_OPTIONS = [
  { value: 'left', label: 'Links' },
  { value: 'center', label: 'Mitte' },
  { value: 'right', label: 'Rechts' },
];

const FONT_WEIGHT_OPTIONS = [
  { value: '300', label: 'Light 300' },
  { value: '400', label: 'Regular 400' },
  { value: '500', label: 'Medium 500' },
  { value: '600', label: 'Semibold 600' },
  { value: '700', label: 'Bold 700' },
  { value: '800', label: 'Heavy 800' },
];

const ToggleField = ({ label, checked, onChange }) => (
  <label className="toggle">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
  </label>
);

const TextAreaField = ({ label, value, onChange, rows = 2 }) => (
  <label className="field">
    <div className="field__head">
      <span>{label}</span>
    </div>
    <textarea rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const ColorField = ({ label, value, onChange }) => (
  <label className="field">
    <div className="field__head">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
  </label>
);

const UploadButton = ({ label, accept, onSelect }) => {
  const inputRef = useRef(null);
  return (
    <div className="upload-tile">
      <button className="ghost-button upload-button" type="button" onClick={() => inputRef.current?.click()}>
        <Upload size={16} />
        {label}
      </button>
      <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={onSelect} />
    </div>
  );
};

const TEXT_SWATCHES = [
  '#FFFFFF',
  '#000000',
  '#FFF500',
  '#9933FF',
  '#00FDFF',
  '#00FF0A',
  '#FF6E00',
  '#3355FF',
  '#FF66FF',
];

const DWD_TEXT_SWATCHES = ['#FFFFFF', '#000000', '#3355FF', '#FFF500'];

const getAepInfoLayout = (presetId) => {
  if (presetId === 'story') {
    return {
      dateX: 0.048,
      dateY: 0.026,
      titleX: 0.5,
      titleY: 0.13,
      title2Y: 0.665,
      titleMaxWidth: 0.82,
      titleLineHeight: 0.9,
      metaX: 0.952,
      metaY: 0.026,
      emailX: 0.048,
      emailY: 0.93,
      locationX: 0.952,
      locationY: 0.952,
      logoX: 0.92,
      logoY: 0.94,
      dateSize: 54,
      titleSize: 148,
      metaSize: 48,
      emailSize: 43,
      locationSize: 43,
    };
  }

  if (presetId === 'landscape') {
    return {
      dateX: 0.05,
      dateY: 0.06,
      titleX: 0.22,
      titleY: 0.06,
      metaX: 0.22,
      metaY: 0.19,
      emailX: 0.05,
      emailY: 0.9,
      logoX: 0.94,
      logoY: 0.9,
      dateSize: 36,
      titleSize: 48,
      metaSize: 20,
      emailSize: 22,
    };
  }

  return {
    dateX: 0.032,
    dateY: 0.026,
    titleX: 0.5,
    titleY: 0.13,
    title2Y: 0.665,
    titleMaxWidth: 0.82,
    titleLineHeight: 0.9,
    metaX: 0.944,
    metaY: 0.03,
    emailX: 0.032,
    emailY: 0.915,
    locationX: 0.944,
    locationY: 0.952,
    logoX: 0.92,
    logoY: 0.94,
    dateSize: 44,
    titleSize: 128,
    metaSize: 40,
    emailSize: 38,
    locationSize: 38,
  };
};

const getInfoLayoutPresets = (presetId) => {
  const aep = getAepInfoLayout(presetId);

  return [
    {
      id: 'aep-auto',
      label: 'AEP Auto',
      values: {
        ...aep,
        weight: 600,
      },
    },
    {
      id: 'event',
      label: 'Event',
      values: {
        ...aep,
        titleSize: Math.round(aep.titleSize * 1.04),
        metaSize: Math.round(aep.metaSize * 1.02),
        weight: 500,
      },
    },
    {
      id: 'news',
      label: 'News',
      values: {
        ...aep,
        titleX: Math.max(0.14, aep.titleX - 0.05),
        titleY: aep.titleY + (presetId === 'story' ? 0.08 : 0.06),
        metaX: Math.max(0.14, aep.metaX - 0.05),
        metaY: aep.metaY + (presetId === 'story' ? 0.1 : 0.08),
        titleSize: Math.round(aep.titleSize * 0.94),
        metaSize: Math.round(aep.metaSize * 1.06),
        weight: 500,
      },
    },
    {
      id: 'cta',
      label: 'CTA',
      values: {
        ...aep,
        titleX: presetId === 'story' ? 0.18 : 0.14,
        titleY: presetId === 'story' ? 0.32 : 0.28,
        metaX: presetId === 'story' ? 0.18 : 0.14,
        metaY: presetId === 'story' ? 0.72 : 0.68,
        dateX: aep.dateX,
        dateY: aep.dateY,
        emailX: aep.emailX,
        emailY: aep.emailY,
        titleSize: Math.round(aep.titleSize * 1.12),
        metaSize: Math.round(aep.metaSize * 0.98),
        weight: 600,
      },
    },
    {
      id: 'minimal',
      label: 'Minimal',
      values: {
        ...aep,
        titleX: aep.dateX,
        titleY: presetId === 'story' ? 0.1 : 0.11,
        metaX: aep.dateX,
        metaY: presetId === 'story' ? 0.82 : 0.8,
        titleSize: Math.round(aep.titleSize * 0.82),
        metaSize: Math.round(aep.metaSize * 0.9),
        dateSize: Math.round(aep.dateSize * 0.9),
        emailSize: Math.round(aep.emailSize * 0.9),
        weight: 500,
      },
    },
    {
      id: 'editorial-content',
      label: 'Original Content',
      values: {
        ...aep,
        dateX: presetId === 'story' ? 0.07 : 0.055,
        dateY: presetId === 'story' ? 0.04 : 0.04,
        titleX: presetId === 'story' ? 0.07 : 0.055,
        titleY: presetId === 'story' ? 0.095 : 0.085,
        metaX: presetId === 'story' ? 0.07 : 0.055,
        metaY: presetId === 'story' ? 0.79 : 0.81,
        emailX: presetId === 'story' ? 0.07 : 0.055,
        emailY: presetId === 'story' ? 0.94 : 0.93,
        logoX: 0.92,
        logoY: 0.94,
        titleSize: Math.round(aep.titleSize * 0.92),
        metaSize: Math.round(aep.metaSize * 0.96),
        dateSize: Math.round(aep.dateSize * 0.88),
        emailSize: Math.round(aep.emailSize * 0.9),
        weight: 500,
      },
    },
  ];
};

const getMaskVariantFormat = (canvasPresetId) => {
  if (canvasPresetId === 'portrait') {
    return 'story';
  }
  if (canvasPresetId === 'square' || canvasPresetId === 'story' || canvasPresetId === 'landscape') {
    return canvasPresetId;
  }
  return null;
};

const resolveMaskPresetForCanvas = (maskPresetId, canvasPresetId) => {
  const selected = MASK_PRESETS.find((item) => item.id === maskPresetId);
  if (!selected) {
    return null;
  }

  const targetFormat = getMaskVariantFormat(canvasPresetId);
  if (!targetFormat) {
    return selected;
  }

  const sameFamilyVariant = MASK_PRESETS.find((item) => item.family === selected.family && item.format === targetFormat);
  return sameFamilyVariant ?? selected;
};

const App = () => {
  const initialScene = useMemo(() => applyAeTemplate(createInitialScene(), 'post-01', true), []);
  const [scene, setScene] = useState(initialScene);
  const [assetVersion, setAssetVersion] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(0.72);
  const [isRecording, setIsRecording] = useState(false);
  const [hasDegular, setHasDegular] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const exportBusyRef = useRef(false);
  const [typoAdvanced, setTypoAdvanced] = useState(false);
  const fontInputRef = useRef(null);
  const [draggingTarget, setDraggingTarget] = useState(null);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const assetCacheRef = useRef(new Map());
  const lastTickRef = useRef(0);
  const stageSize = useElementSize(stageRef);

  const preset = CANVAS_PRESETS.find((item) => item.id === scene.presetId) ?? CANVAS_PRESETS[0];
  const colorPreset = COLOR_PRESETS.find((item) => item.id === scene.colorPresetId) ?? COLOR_PRESETS[0];

  const getMedia = (src, kind = scene.mediaKind ?? 'image') => {
    if (!src) {
      return null;
    }
    const cached = assetCacheRef.current.get(src);
    if (cached?.status === 'loaded') {
      return cached;
    }
    if (cached?.status === 'error' || cached?.status === 'loading') {
      return null;
    }

    if (kind === 'video') {
      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.onloadeddata = () => {
        assetCacheRef.current.set(src, { status: 'loaded', kind: 'video', element: video });
        setAssetVersion((value) => value + 1);
      };
      video.onerror = () => assetCacheRef.current.set(src, { status: 'error', kind: 'video', element: null });
      video.src = src;
      video.load();
      assetCacheRef.current.set(src, { status: 'loading', kind: 'video', element: video });
      return null;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      assetCacheRef.current.set(src, { status: 'loaded', kind: 'image', element: image });
      setAssetVersion((value) => value + 1);
    };
    image.onerror = () => assetCacheRef.current.set(src, { status: 'error', kind: 'image', element: null });
    image.src = src;
    assetCacheRef.current.set(src, { status: 'loading', kind: 'image', element: image });
    return null;
  };

  const syncMediaToTime = async (time) => {
    const asset = getMedia(scene.mediaSrc, scene.mediaKind);
    if (!asset || asset.kind !== 'video') {
      return;
    }
    await syncVideoFrame(asset.element, time, scene.playback.fps);
  };

  const previewScale = useMemo(() => {
    if (!stageSize.width || !stageSize.height) {
      return previewZoom;
    }
    return Math.max(0.05, Math.min((stageSize.width - 80) / preset.width, (stageSize.height - 80) / preset.height, 1) * previewZoom);
  }, [preset.height, preset.width, previewZoom, stageSize.height, stageSize.width]);

  const updateScene = (path, value) => setScene((current) => {
    if (path === 'presetId' && current.aeTemplateId) {
      if (value === 'square' || value === 'story') return applyAeTemplate(current, `${value === 'square' ? 'post' : 'story'}-${current.aeTemplateId.slice(-2)}`);
      return { ...deepSet(current, path, value), aeTemplateId: null, mask: { ...current.mask, aeMotionId: null } };
    }
    const next = deepSet(current, path, value);
    if (['mask.turbulence', 'mask.complexity', 'mask.evolutionSpeed', 'mask.wobble', 'mask.asymmetry', 'mask.seed', 'mask.points', 'mask.pixelSize', 'mask.breath'].includes(path)) next.mask = { ...next.mask, aeMotionId: null };
    return next;
  });

  const prepareExport = async () => {
    if (scene.mask.aeMotionId) await loadAeMotion(scene.mask.aeMotionId);
    if (scene.infoLayer.show) {
      const weights = [...new Set([scene.infoLayer.weight ?? 600, scene.infoLayer.titleWeight ?? 700])];
      for (const weight of weights) {
        const loaded = await loadDegular(weight);
        if (!loaded) throw new Error(`Degular ${weight === 600 ? 'Semibold' : weight === 400 ? 'Regular' : weight} fehlt. Bitte den passenden Schriftschnitt unter Info Text laden.`);
      }
      await document.fonts.ready;
      setHasDegular(true);
    }
    const assets = [[scene.mediaSrc, scene.mediaKind], [scene.mask.maskSrc, 'image'],
      [scene.overlay.showLogo ? scene.overlay.logoSrc : null, 'image']];
    for (const [src, kind] of assets) {
      if (!src) continue;
      getMedia(src, kind);
      const started = performance.now();
      while (assetCacheRef.current.get(src)?.status === 'loading') {
        if (performance.now() - started > 15000) throw new Error('Bild oder Video konnte nicht rechtzeitig geladen werden.');
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      if (assetCacheRef.current.get(src)?.status !== 'loaded') throw new Error('Bild, Maske oder Logo konnte nicht geladen werden. Bitte Datei erneut wählen.');
    }
  };

  const runExport = async (operation) => {
    if (exportBusyRef.current) return;
    exportBusyRef.current = true;
    setIsRecording(true);
    setExportStatus('Export wird vorbereitet …');
    try {
      await prepareExport();
      await operation();
      setExportStatus('Export fertig.');
    } catch (error) {
      console.error(error);
      setExportStatus(error.message || 'Export fehlgeschlagen.');
    } finally {
      exportBusyRef.current = false;
      setIsRecording(false);
    }
  };

  const downloadBlob = (blob, extension) => {
    if (!blob?.size) throw new Error('Die Exportdatei ist leer.');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `digilab-mask-${preset.id}-${Date.now()}.${extension}`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const applyColorPreset = (presetId) => {
    const scheme = COLOR_PRESETS.find((item) => item.id === presetId);
    if (!scheme) {
      return;
    }
    setScene((current) => ({
      ...current,
      colorPresetId: scheme.id,
      backgroundColor: scheme.background,
      useCustomBackground: false,
      overlay: {
        ...current.overlay,
        logoTint: scheme.accent,
      },
      infoLayer: {
        ...current.infoLayer,
        titleColor: scheme.accent,
        metaColor: scheme.accent,
        emailColor: scheme.accent,
        dateColor: scheme.accent,
      },
    }));
  };

  const applyMaskPreset = (presetId) => {
    setScene((current) => {
      const presetEntry = resolveMaskPresetForCanvas(presetId, current.presetId);
      if (!presetEntry) {
        return current;
      }
      return {
        ...current,
        mask: {
          ...current.mask,
          ...presetEntry,
          aeMotionId: null,
          presetId: presetEntry.id,
        },
        stage: {
          ...current.stage,
          width: presetEntry.width,
          height: presetEntry.height,
          y: presetEntry.stageY ?? current.stage.y,
        },
      };
    });
  };

  const applyMotionPreset = (presetId) => {
    const presetEntry = MOTION_PRESETS.find((item) => item.id === presetId);
    if (!presetEntry) {
      return;
    }
    setScene((current) => ({
      ...current,
      motionPresetId: presetId,
      mask: {
        ...current.mask,
        ...presetEntry.mask,
        aeMotionId: null,
      },
      imageMotion: {
        ...current.imageMotion,
        ...presetEntry.imageMotion,
      },
    }));
  };

  const applyFormMotionPreset = (presetId) => {
    const combo = FORM_MOTION_PRESETS.find((item) => item.id === presetId);
    if (!combo) {
      return;
    }
    const motionPreset = MOTION_PRESETS.find((item) => item.id === combo.motionPresetId);
    if (!motionPreset) {
      return;
    }
    setScene((current) => {
      const maskPreset = resolveMaskPresetForCanvas(combo.maskPresetId, current.presetId);
      if (!maskPreset) {
        return current;
      }
      const infoLayoutValues = combo.infoLayoutPresetId
        ? getInfoLayoutPresets(current.presetId).find((item) => item.id === combo.infoLayoutPresetId)?.values
        : null;
      return {
        ...current,
        motionPresetId: motionPreset.id,
        infoLayoutPresetId: combo.infoLayoutPresetId ?? current.infoLayoutPresetId,
        mask: {
          ...current.mask,
          ...maskPreset,
          ...motionPreset.mask,
          aeMotionId: null,
          presetId: maskPreset.id,
        },
        imageMotion: {
          ...current.imageMotion,
          ...motionPreset.imageMotion,
        },
        stage: {
          ...current.stage,
          width: maskPreset.width,
          height: maskPreset.height,
          y: maskPreset.stageY ?? current.stage.y,
        },
        ...(infoLayoutValues
          ? {
              infoLayer: {
                ...current.infoLayer,
                ...infoLayoutValues,
              },
            }
          : {}),
      };
    });
  };

  const handleMediaUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const src = URL.createObjectURL(file);
    const mediaKind = file.type.startsWith('video/') ? 'video' : 'image';
    setScene((current) => ({
      ...current,
      mediaSrc: src,
      mediaName: file.name,
      mediaKind,
      playback: {
        ...current.playback,
        time: 0,
      },
    }));
    event.target.value = '';
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const src = URL.createObjectURL(file);
    setScene((current) => ({
      ...current,
      overlay: {
        ...current.overlay,
        logoSrc: src,
        logoName: file.name,
        preserveColor: true,
      },
    }));
    event.target.value = '';
  };

  const handleFontUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const src = URL.createObjectURL(file);
    try {
      const bytes = await file.arrayBuffer();
      const face = new FontFace('Degular', bytes, {
        style: 'normal',
        weight: fontWeight(bytes, file.name),
      });
      await face.load();
      document.fonts.add(face);
      setHasDegular(true);
      setAssetVersion((value) => value + 1);
    } catch (error) {
      console.error(error);
      window.alert('Degular-Datei nicht geladen.');
    } finally {
      URL.revokeObjectURL(src);
    }
    event.target.value = '';
  };

  const setLogoPreset = (entry) => {
    setScene((current) => ({
      ...current,
      overlay: {
        ...current.overlay,
        logoSrc: entry.src,
        logoName: entry.name,
        logoTint: entry.defaults?.tint ?? current.overlay.logoTint,
        preserveColor: entry.defaults?.preserveColor ?? current.overlay.preserveColor,
        removeWhite: entry.defaults?.removeWhite ?? current.overlay.removeWhite,
        whiteThreshold: entry.defaults?.whiteThreshold ?? current.overlay.whiteThreshold,
      },
    }));
  };

  const applyAepInfoLayout = () => setScene(current => applyAeTemplate(current,
    current.aeTemplateId ?? (current.presetId === 'story' ? 'story-01' : 'post-01')));

  const applyInfoLayoutPreset = (presetId) => {
    if (presetId === 'ae-original' || presetId === 'aep-auto') { applyAepInfoLayout(); return; }
    const layoutPreset = getInfoLayoutPresets(scene.presetId).find((item) => item.id === presetId);
    if (!layoutPreset) {
      return;
    }
    setScene((current) => ({
      ...current,
      infoLayoutPresetId: presetId,
      aeTemplateId: null,
      infoLayer: {
        ...current.infoLayer,
        ...layoutPreset.values,
      },
      overlay: {
        ...current.overlay,
        logoX: layoutPreset.values.logoX,
        logoY: layoutPreset.values.logoY,
      },
    }));
  };

  const applyExportPreset = (presetId) => {
    const presetEntry = EXPORT_PRESETS.find((item) => item.id === presetId);
    if (!presetEntry) {
      return;
    }
    setScene((current) => current.aeTemplateId ? applyAeTemplate(current, `${presetEntry.presetId === 'story' ? 'story' : 'post'}-${current.aeTemplateId.slice(-2)}`) : ({
      ...current,
      presetId: presetEntry.presetId,
      infoLayoutPresetId: 'aep-auto',
      infoLayer: {
        ...current.infoLayer,
        ...getAepInfoLayout(presetEntry.presetId),
      },
      overlay: {
        ...current.overlay,
        ...getAepInfoLayout(presetEntry.presetId),
      },
      playback: {
        ...current.playback,
        duration: presetEntry.duration,
        fps: presetEntry.fps,
        rate: presetEntry.rate,
        loop: presetEntry.loop,
        time: 0,
      },
      ...(() => {
        const maskPreset = resolveMaskPresetForCanvas(current.mask.presetId, presetEntry.presetId);
        if (!maskPreset) {
          return {};
        }
        return {
          mask: {
            ...current.mask,
            ...maskPreset,
            presetId: maskPreset.id,
          },
          stage: {
            ...current.stage,
            width: maskPreset.width,
            height: maskPreset.height,
            y: maskPreset.stageY ?? current.stage.y,
          },
        };
      })(),
    }));
  };

  const exportPng = () => runExport(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = preset.width;
    canvas.height = preset.height;
    await syncMediaToTime(scene.playback.time);
    renderScene({ ctx: canvas.getContext('2d'), width: preset.width, height: preset.height,
      scene, colors: colorPreset, time: scene.playback.time, getAsset: getMedia });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    downloadBlob(blob, 'png');
  });

  const recordVideo = async (mimeType, extension) => {
    const canvas = document.createElement('canvas');
    canvas.width = preset.width;
    canvas.height = preset.height;
    const ctx = canvas.getContext('2d');
    const fps = scene.playback.fps;
    await syncMediaToTime(0);
    renderScene({ ctx, width: preset.width, height: preset.height, scene, colors: colorPreset, time: 0, getAsset: getMedia });
    const stream = canvas.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12000000 });
    const chunks = [];
    const completed = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = event => reject(event.error ?? new Error('Videoaufnahme fehlgeschlagen.'));
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });
    // Keep a rejection handled even if rendering fails first.
    completed.catch(() => {});
    try {
      recorder.start();
      const start = performance.now();
      const durationMs = scene.playback.duration * 1000;
      while (performance.now() - start < durationMs) {
        const elapsed = performance.now() - start;
        const time = elapsed / 1000 * scene.playback.rate;
        await syncMediaToTime(time);
        renderScene({ ctx, width: preset.width, height: preset.height, scene, colors: colorPreset, time, getAsset: getMedia });
        setExportStatus(`Video: ${Math.min(99, Math.round(elapsed / durationMs * 100))}%`);
        await new Promise(resolve => setTimeout(resolve, Math.max(0, 1000 / fps - (performance.now() - start - elapsed))));
      }
      recorder.stop();
      downloadBlob(await completed, extension);
    } finally {
      if (recorder.state !== 'inactive') recorder.stop();
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const exportWebm = () => runExport(async () => {
    if (typeof MediaRecorder === 'undefined') throw new Error('Videoexport wird in diesem Browser nicht unterstützt.');
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error('WEBM wird in diesem Browser nicht unterstützt. Bitte MP4 wählen.');
    await recordVideo(mime, 'webm');
  });

  const exportMp4 = () => runExport(async () => {
    if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
      const mime = typeof MediaRecorder !== 'undefined' && MP4_MEDIA_RECORDER_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type));
      if (!mime) throw new Error('MP4 wird in diesem Browser nicht unterstützt. Bitte WEBM wählen.');
      await recordVideo(mime, 'mp4');
      return;
    }
    const recorderCanvas = document.createElement('canvas');
    recorderCanvas.width = preset.width;
    recorderCanvas.height = preset.height;
    const recorderCtx = recorderCanvas.getContext('2d');
    const fps = Math.max(1, scene.playback.fps);
      let selectedConfig = null;
      for (const candidate of MP4_ENCODER_CANDIDATES) {
        const support = await window.VideoEncoder.isConfigSupported({
          codec: candidate.codec,
          width: preset.width,
          height: preset.height,
          bitrate: Math.round(preset.width * preset.height * fps * 0.18),
          framerate: fps,
          ...candidate,
        });
        if (support.supported) {
          selectedConfig = {
            codec: candidate.codec,
            width: preset.width,
            height: preset.height,
            bitrate: Math.round(preset.width * preset.height * fps * 0.18),
            framerate: fps,
            ...candidate,
          };
          break;
        }
      }

      if (!selectedConfig) {
        const mime = typeof MediaRecorder !== 'undefined' && MP4_MEDIA_RECORDER_CANDIDATES.find(type => MediaRecorder.isTypeSupported(type));
        if (mime) return recordVideo(mime, 'mp4');
        throw new Error('MP4 ist auf diesem Gerät nicht verfügbar. Bitte WEBM wählen.');
      }

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
        video: {
          codec: 'avc',
          width: preset.width,
          height: preset.height,
          frameRate: fps,
        },
      });

      let encoderError = null;
      const encoder = new window.VideoEncoder({
        output: (chunk, meta) => {
          muxer.addVideoChunk(chunk, meta);
        },
        error: (error) => {
          encoderError = error;
        },
      });

      try {
      encoder.configure(selectedConfig);

      const totalFrames = Math.max(1, Math.round(scene.playback.duration * fps));
      for (let frame = 0; frame < totalFrames; frame += 1) {
        const time = frame / fps * scene.playback.rate;
        await syncMediaToTime(time);
        renderScene({ ctx: recorderCtx, width: preset.width, height: preset.height, scene, colors: colorPreset, time, getAsset: getMedia });

        const frameDuration = Math.round(1_000_000 / fps);
        const videoFrame = new window.VideoFrame(recorderCanvas, {
          timestamp: Math.round(frame * 1_000_000 / fps),
          duration: frameDuration,
        });
        encoder.encode(videoFrame, { keyFrame: frame === 0 || frame % fps === 0 });
        videoFrame.close();

        if (encoder.encodeQueueSize > 8) {
          await encoder.flush();
        }
        if (encoderError) {
          throw encoderError;
        }
        setExportStatus(`MP4: ${Math.round((frame + 1) / totalFrames * 100)}%`);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      await encoder.flush();
      if (encoderError) throw encoderError;
      } finally {
        if (encoder.state !== 'closed') encoder.close();
      }
      muxer.finalize();

      downloadBlob(new Blob([target.buffer], { type: 'video/mp4' }), 'mp4');
  });

  useEffect(() => {
    const active = new Set([scene.mediaSrc, scene.mask.maskSrc, scene.overlay.logoSrc]);
    for (const [src, asset] of assetCacheRef.current) {
      if (src.startsWith('blob:') && !active.has(src)) {
        if (asset.kind === 'video') { asset.element.pause(); asset.element.removeAttribute('src'); asset.element.load(); }
        URL.revokeObjectURL(src);
        assetCacheRef.current.delete(src);
      }
    }
  }, [scene.mediaSrc, scene.mask.maskSrc, scene.overlay.logoSrc]);

  useEffect(() => {
    Promise.all([loadDegular(scene.infoLayer.weight ?? 400), loadDegular(scene.infoLayer.titleWeight ?? 600)]).then(results => {
      const loaded = results.every(Boolean);
      setHasDegular(loaded);
      setAssetVersion((value) => value + 1);
    }).catch(() => setHasDegular(false));
  }, [scene.infoLayer.weight, scene.infoLayer.titleWeight]);

  useEffect(() => {
    if (!scene.mask.aeMotionId) return;
    let active = true;
    loadAeMotion(scene.mask.aeMotionId).then(() => { if (active) setAssetVersion(value => value + 1); })
      .catch(error => { if (active) setExportStatus(error.message); });
    return () => { active = false; };
  }, [scene.mask.aeMotionId]);

  useEffect(() => {
    let cancelled = false;
    if (isRecording || !scene.mediaSrc || scene.mediaKind !== 'video') {
      return undefined;
    }
    const syncPreview = async () => {
      await syncMediaToTime(scene.playback.time);
      if (!cancelled) {
        setAssetVersion((value) => value + 1);
      }
    };
    syncPreview().catch(error => { if (!cancelled) setExportStatus(error.message); });
    return () => {
      cancelled = true;
    };
  }, [isRecording, scene.mediaKind, scene.mediaSrc, scene.playback.fps, scene.playback.time]);

  useEffect(() => {
    if (isRecording || !scene.playback.playing) {
      lastTickRef.current = 0;
      return undefined;
    }
    let frameId = 0;
    const frameDuration = 1000 / Math.max(1, scene.playback.fps);
    const tick = (timestamp) => {
      if (!lastTickRef.current) {
        lastTickRef.current = timestamp;
      }
      const delta = timestamp - lastTickRef.current;
      if (delta >= frameDuration) {
        setScene((current) => {
          const nextTime = current.playback.time + (delta / 1000) * current.playback.rate;
          const duration = current.playback.duration;
          const wrapped = current.playback.loop ? nextTime % duration : Math.min(duration, nextTime);
          const shouldStop = !current.playback.loop && nextTime >= duration;
          return {
            ...current,
            playback: {
              ...current.playback,
              time: wrapped,
              playing: shouldStop ? false : current.playback.playing,
            },
          };
        });
        lastTickRef.current = timestamp;
      }
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isRecording, scene.playback.fps, scene.playback.loop, scene.playback.playing, scene.playback.rate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    renderScene({ ctx, width: preset.width, height: preset.height, scene, colors: colorPreset, time: scene.playback.time, getAsset: getMedia });
  }, [assetVersion, colorPreset, preset.height, preset.width, scene]);

  return (
    <div className="app-shell">
      <input ref={fontInputRef} type="file" accept=".otf,.ttf,.woff,.woff2,font/*" className="sr-only" onChange={handleFontUpload} />
      <aside className="sidebar">
        <fieldset disabled={isRecording} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div className="sidebar__header">
          <div>
            <div className="eyebrow">Flexible Image Warp System</div>
            <h1>digilab.ai Mask Motion</h1>
          </div>
          <button
            className="ghost-button"
            onClick={() => {
              const freshScene = createInitialScene();
              setScene(freshScene);
            }}
          >
            <RotateCcw size={16} />
            Reset
          </button>
        </div>

        <Section title="Format & Playback" icon={Play}>
          <SelectField
            label="Instagram Export Preset"
            value=""
            options={[{ value: '', label: 'Preset wählen' }, ...EXPORT_PRESETS.map((item) => ({ value: item.id, label: item.label }))]}
            onChange={(value) => {
              if (value) {
                applyExportPreset(value);
              }
            }}
          />
          <div className="button-row">
            {EXPORT_PRESETS.map((item) => (
              <button key={item.id} type="button" className="ghost-button small-chip" onClick={() => applyExportPreset(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <SelectField
            label="Instagram Format"
            value={scene.presetId}
            options={CANVAS_PRESETS.map((item) => ({ value: item.id, label: `${item.label} (${item.width}x${item.height})` }))}
            onChange={(value) => updateScene('presetId', value)}
          />
          <div className="field-grid">
            <SliderField label="Dauer" value={scene.playback.duration} min={15} max={15} step={1} format={(value) => `${value.toFixed(0)}s`} onChange={(value) => updateScene('playback.duration', value)} />
            <SliderField label="FPS" value={scene.playback.fps} min={30} max={30} step={1} format={(value) => `${value}`} onChange={(value) => updateScene('playback.fps', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Tempo" value={scene.playback.rate} min={0.2} max={2.2} step={0.05} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateScene('playback.rate', value)} />
            <ToggleField label="Loop" checked={scene.playback.loop} onChange={(value) => updateScene('playback.loop', value)} />
          </div>
          <SliderField label="Playhead" value={scene.playback.time} min={0} max={scene.playback.duration} step={0.01} format={(value) => `${value.toFixed(2)}s`} onChange={(value) => updateScene('playback.time', value)} />
          <div className="button-row">
            <button className="ghost-button" type="button" onClick={() => updateScene('playback.playing', !scene.playback.playing)}>
              <Play size={15} />
              {scene.playback.playing ? 'Pause' : 'Play'}
            </button>
            <button className="ghost-button" type="button" onClick={() => updateScene('playback.time', 0)}>
              <RotateCcw size={15} />
              Anfang
            </button>
          </div>
        </Section>

        <Section title="AE-Vorlagen" icon={Film}>
          <SelectField label="Originalvorlage" value={scene.aeTemplateId ?? ''}
            options={[{ value: '', label: 'Eigene Gestaltung' }, ...AE_TEMPLATES.map(item => ({ value: item.id, label: item.label }))]}
            onChange={id => setScene(current => id ? applyAeTemplate(current, id) : { ...current, aeTemplateId: null, mask: { ...current.mask, aeMotionId: null } })} />
          <div className="asset-note">{scene.mask.aeMotionId ? (scene.mask.aeStatic ? 'Originale Maske · statisch' : 'Originale Maskenbewegung · 15 Sekunden · 30 Bilder/s') : 'Eigene Maskenbewegung'}</div>
          {scene.aeTemplateId && <button className="ghost-button" type="button"
            onClick={() => setScene(current => applyAeTemplate(current, current.aeTemplateId, true))}>Originaltexte und Einstellungen einsetzen</button>}
        </Section>

        <Section title="Motion Modes" icon={Film}>
          <SelectField
            label="Scene Preset"
            value=""
            options={[{ value: '', label: 'Form + Motion wählen' }, ...FORM_MOTION_PRESETS.map((item) => ({ value: item.id, label: item.label }))]}
            onChange={(value) => {
              if (value) {
                applyFormMotionPreset(value);
              }
            }}
          />
          <div className="button-row">
            {FORM_MOTION_PRESETS.map((item) => (
              <button key={item.id} type="button" className="ghost-button small-chip" onClick={() => applyFormMotionPreset(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <SelectField
            label="Motion Preset"
            value={scene.motionPresetId}
            options={[...(scene.mask.aeMotionId ? [{ value: 'ae-original', label: 'AE Original' }] : []), ...MOTION_PRESETS.map((item) => ({ value: item.id, label: item.label }))]}
            onChange={applyMotionPreset}
          />
          <div className="button-row">
            {MOTION_PRESETS.map((item) => (
              <button key={item.id} type="button" className="ghost-button small-chip" onClick={() => applyMotionPreset(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Colors & Stage" icon={Palette}>
          <SelectField
            label="CI Preset"
            value={scene.colorPresetId}
            options={COLOR_PRESETS.map((item) => ({ value: item.id, label: item.label }))}
            onChange={applyColorPreset}
          />
          <div className="button-row">
            {COLOR_PRESETS.map((item) => (
              <button key={item.id} type="button" className="ghost-button" onClick={() => applyColorPreset(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <ToggleField label="Freie Hintergrundfarbe" checked={scene.useCustomBackground} onChange={(value) => updateScene('useCustomBackground', value)} />
          <ColorField label="Freie Farbe" value={scene.backgroundColor} onChange={(value) => {
            updateScene('backgroundColor', value);
            updateScene('useCustomBackground', true);
          }} />
          <div className="field-grid">
            <SliderField label="Stage X" value={scene.stage.x} min={-0.5} max={1.5} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.x', value)} />
            <SliderField label="Stage Y" value={scene.stage.y} min={-0.5} max={1.5} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.y', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Stage Breite" value={scene.stage.width} min={0.1} max={1.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.width', value)} />
            <SliderField label="Stage Höhe" value={scene.stage.height} min={0.1} max={1.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.height', value)} />
          </div>
          <SliderField label="Mask Size" value={scene.stage.scale ?? 1} min={0.6} max={1.5} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateScene('stage.scale', value)} />
          <ToggleField label="Backdrop Box" checked={scene.stage.showBackdrop ?? false} onChange={(value) => updateScene('stage.showBackdrop', value)} />
          <div className="field-grid">
            <SliderField label="Shadow" value={scene.stage.shadow} min={0} max={0.5} step={0.01} onChange={(value) => updateScene('stage.shadow', value)} />
            <SliderField label="Radius" value={scene.stage.radius} min={0} max={0.2} step={0.01} onChange={(value) => updateScene('stage.radius', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Backdrop Alpha" value={scene.stage.backdropOpacity ?? 1} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.backdropOpacity', value)} />
            <div />
          </div>
          <div className="field-grid">
            <ToggleField label="Raster anzeigen" checked={scene.guides.showGrid} onChange={(value) => updateScene('guides.showGrid', value)} />
            <SliderField label="Raster Deckkraft" value={scene.guides.opacity} min={0.05} max={0.6} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('guides.opacity', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Raster Spalten" value={scene.guides.columns} min={2} max={24} step={1} format={(value) => `${Math.round(value)}`} onChange={(value) => updateScene('guides.columns', value)} />
            <SliderField label="Raster Reihen" value={scene.guides.rows} min={2} max={24} step={1} format={(value) => `${Math.round(value)}`} onChange={(value) => updateScene('guides.rows', value)} />
          </div>
        </Section>

        <Section title="Media" icon={ImagePlus}>
          <UploadButton
            label={scene.mediaSrc ? 'Medium ersetzen' : 'Bild oder MP4 hochladen'}
            accept="image/*,video/mp4,video/webm,video/quicktime,video/x-m4v"
            onSelect={handleMediaUpload}
          />
          <div className="asset-note">
            {scene.mediaName ? `${scene.mediaName} · ${scene.mediaKind === 'video' ? 'Video' : 'Bild'}` : 'Noch kein Bild oder Video geladen'}
          </div>
          {scene.mediaKind === 'video' && scene.mediaSrc && (
            <div className="asset-note">Videos werden mit dem Playhead gesynct und zusammen mit der Mask-Animation exportiert.</div>
          )}
          <div className="field-grid">
            <SliderField label="Image Scale" value={scene.imageMotion.scale} min={0.7} max={1.8} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateScene('imageMotion.scale', value)} />
            <SliderField label="Zoom Pulse" value={scene.imageMotion.zoom} min={0} max={0.35} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('imageMotion.zoom', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Drift X" value={scene.imageMotion.driftX} min={0} max={0.2} step={0.005} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('imageMotion.driftX', value)} />
            <SliderField label="Drift Y" value={scene.imageMotion.driftY} min={0} max={0.2} step={0.005} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('imageMotion.driftY', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Rotate" value={scene.imageMotion.rotate} min={0} max={15} step={0.5} format={(value) => `${value.toFixed(1)}°`} onChange={(value) => updateScene('imageMotion.rotate', value)} />
            <SliderField label="Rotate Loops" value={scene.imageMotion.rotateSpeed} min={1} max={8} step={1} format={(value) => `${Math.round(value)}x`} onChange={(value) => updateScene('imageMotion.rotateSpeed', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Orbit" value={scene.imageMotion.orbit ?? 0} min={0} max={0.12} step={0.005} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('imageMotion.orbit', value)} />
            <SliderField label="Orbit Loops" value={scene.imageMotion.orbitCycles ?? 1} min={1} max={8} step={1} format={(value) => `${Math.round(value)}x`} onChange={(value) => updateScene('imageMotion.orbitCycles', value)} />
          </div>
        </Section>

        <Section title="Mask & Turbulence" icon={SquareDashedMousePointer}>
          <SelectField
            label="Mask Preset"
            value={scene.mask.presetId}
            options={MASK_PRESETS.map((item) => ({ value: item.id, label: item.label }))}
            onChange={applyMaskPreset}
          />
          <div className="button-row">
            {MASK_PRESETS.filter((item) => item.id !== 'wide-form').map((item) => (
              <button key={item.id} type="button" className="ghost-button small-chip" onClick={() => applyMaskPreset(item.id)}>
                {item.family} {item.format === 'story' ? 'Story' : item.format === 'square' ? 'Post' : item.format}
              </button>
            ))}
          </div>
          <div className="field-grid">
            <SliderField label="Shape Scale" value={scene.mask.shapeScale} min={0.4} max={1.2} step={0.01} format={(value) => `${value.toFixed(2)}`} onChange={(value) => updateScene('mask.shapeScale', value)} />
            <SliderField label="Pixel Size" value={scene.mask.pixelSize} min={18} max={60} step={1} format={(value) => `${Math.round(value)}`} onChange={(value) => updateScene('mask.pixelSize', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Turbulence" value={scene.mask.turbulence} min={0} max={0.5} step={0.01} onChange={(value) => updateScene('mask.turbulence', value)} />
            <SliderField label="Complexity" value={scene.mask.complexity} min={0} max={0.8} step={0.01} onChange={(value) => updateScene('mask.complexity', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Evolution Loops" value={scene.mask.evolutionSpeed} min={1} max={8} step={1} format={(value) => `${Math.round(value)}x`} onChange={(value) => updateScene('mask.evolutionSpeed', value)} />
            <SliderField label="Wobble" value={scene.mask.wobble} min={0} max={0.3} step={0.01} onChange={(value) => updateScene('mask.wobble', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Asymmetry" value={scene.mask.asymmetry} min={0} max={0.4} step={0.01} onChange={(value) => updateScene('mask.asymmetry', value)} />
            <SliderField label="Breath" value={scene.mask.breath ?? 0} min={0} max={0.18} step={0.01} onChange={(value) => updateScene('mask.breath', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Points" value={scene.mask.points} min={8} max={30} step={1} format={(value) => `${Math.round(value)}`} onChange={(value) => updateScene('mask.points', value)} />
            <div />
          </div>
          <div className="field-grid">
            <SliderField label="Stretch X" value={scene.mask.squishX} min={0.7} max={1.4} step={0.01} onChange={(value) => updateScene('mask.squishX', value)} />
            <SliderField label="Stretch Y" value={scene.mask.squishY} min={0.7} max={1.4} step={0.01} onChange={(value) => updateScene('mask.squishY', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Offset X" value={scene.mask.xOffset} min={-1} max={1} step={0.01} onChange={(value) => updateScene('mask.xOffset', value)} />
            <SliderField label="Offset Y" value={scene.mask.yOffset} min={-1} max={1} step={0.01} onChange={(value) => updateScene('mask.yOffset', value)} />
          </div>
          <div className="button-row">
            <button
              className="ghost-button"
              type="button"
              onClick={() => updateScene('mask.seed', Math.floor(Math.random() * 100000))}
            >
              <RotateCcw size={15} />
              Neue Form
            </button>
          </div>
        </Section>

        <Section title="Overlay" icon={Settings2} defaultOpen={false}>
          <ToggleField label="Logo anzeigen" checked={scene.overlay.showLogo} onChange={(value) => updateScene('overlay.showLogo', value)} />
          <div className="library-grid">
            {LOGO_PRESETS.map((entry) => (
              <button key={entry.id} type="button" className={`library-card ${scene.overlay.logoSrc === entry.src ? 'is-active' : ''}`} onClick={() => setLogoPreset(entry)}>
                <img src={entry.src} alt={entry.name} />
                <span>{entry.name}</span>
              </button>
            ))}
          </div>
          <UploadButton label="Eigenes Logo" accept="image/*,.svg" onSelect={handleLogoUpload} />
          <ColorField label="Logo Tint" value={scene.overlay.logoTint} onChange={(value) => updateScene('overlay.logoTint', value)} />
          <div className="field-grid">
            <SliderField label="Logo Scale" value={scene.overlay.logoScale} min={0.4} max={1.8} step={0.01} format={(value) => `${value.toFixed(2)}x`} onChange={(value) => updateScene('overlay.logoScale', value)} />
            <ToggleField label="Originalfarben" checked={scene.overlay.preserveColor} onChange={(value) => updateScene('overlay.preserveColor', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Logo X" value={scene.overlay.logoX} min={0.05} max={0.95} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('overlay.logoX', value)} />
            <SliderField label="Logo Y" value={scene.overlay.logoY} min={0.05} max={0.95} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('overlay.logoY', value)} />
          </div>
        </Section>

        <Section title="Info Text" icon={Type} defaultOpen={false}>
          <ToggleField label="Infos anzeigen" checked={scene.infoLayer.show} onChange={(value) => updateScene('infoLayer.show', value)} />
          <SelectField
            label="Text Layout Preset"
            value={scene.infoLayoutPresetId ?? 'aep-auto'}
            options={[{ value: 'ae-original', label: 'AE Original' }, ...getInfoLayoutPresets(scene.presetId).filter((item) => item.id === 'aep-auto').map((item) => ({ value: item.id, label: item.label }))]}
            onChange={applyInfoLayoutPreset}
          />
          <UploadButton label="Degular laden" accept=".otf,.ttf,.woff,.woff2,font/*" onSelect={handleFontUpload} />

          <div className="asset-note">{hasDegular ? 'Degular geladen' : 'Degular fehlt. Bitte Schriftdatei laden.'}</div>
          <div className="button-row">
            {getInfoLayoutPresets(scene.presetId).filter((item) => item.id === 'aep-auto').map((item) => (
              <button key={item.id} className="ghost-button small-chip" type="button" onClick={() => applyInfoLayoutPreset(item.id)}>
                {item.label}
              </button>
            ))}
            <button className="ghost-button" type="button" onClick={applyAepInfoLayout}>
              <RotateCcw size={15} />
              AEP Layout
            </button>
          </div>
          <div className="field-grid">
            <TextAreaField label="Datum" value={scene.infoLayer.date} onChange={(value) => updateScene('infoLayer.date', value)} rows={2} />
            <TextAreaField label="Anmeldung" value={scene.infoLayer.email} onChange={(value) => updateScene('infoLayer.email', value)} rows={2} />
          </div>
          {scene.aeTemplateId ? <TextAreaField label="Titelzeilen (bis zu 6)" value={scene.infoLayer.aeHeaderText ?? ''}
            onChange={value => updateScene('infoLayer.aeHeaderText', value)} rows={6} /> : <>
          <label className="field">
            <div className="field__head">
              <span>Titel Zeile 1</span>
            </div>
            <textarea rows={2} value={scene.infoLayer.title1} onChange={(event) => updateScene('infoLayer.title1', event.target.value)} />
          </label>
          <label className="field">
            <div className="field__head">
              <span>Titel Zeile 2</span>
            </div>
            <textarea rows={2} value={scene.infoLayer.title2} onChange={(event) => updateScene('infoLayer.title2', event.target.value)} />
          </label>
          </>}
          <div className="field-grid">
            <TextAreaField label="Start" value={scene.infoLayer.start} onChange={(value) => updateScene('infoLayer.start', value)} rows={2} />
            <TextAreaField label="Dauer" value={scene.infoLayer.duration} onChange={(value) => updateScene('infoLayer.duration', value)} rows={2} />
          </div>
          <TextAreaField label="Ort" value={scene.infoLayer.location} onChange={(value) => updateScene('infoLayer.location', value)} rows={2} />
          <div className="swatch-row">
            {DWD_TEXT_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch"
                style={{ background: color }}
                onClick={() => {
                  updateScene('infoLayer.titleColor', color);
                  updateScene('infoLayer.metaColor', color);
                  updateScene('infoLayer.emailColor', color);
                  updateScene('infoLayer.dateColor', color);
                }}
                aria-label={color}
              />
            ))}
          </div>
          <ToggleField label="Typo Advanced" checked={typoAdvanced} onChange={setTypoAdvanced} />
          {typoAdvanced && (
            <>
              <div className="field-grid">
                <SliderField label="Datum Size" value={scene.infoLayer.dateSize} min={18} max={88} step={1} format={(value) => `${Math.round(value)}px`} onChange={(value) => updateScene('infoLayer.dateSize', value)} />
                <SliderField label="Titel Size" value={scene.infoLayer.titleSize} min={42} max={180} step={1} format={(value) => `${Math.round(value)}px`} onChange={(value) => updateScene('infoLayer.titleSize', value)} />
              </div>
              <div className="field-grid">
                <SliderField label="Meta Size" value={scene.infoLayer.metaSize} min={14} max={72} step={1} format={(value) => `${Math.round(value)}px`} onChange={(value) => updateScene('infoLayer.metaSize', value)} />
                <SliderField label="Mail Size" value={scene.infoLayer.emailSize} min={16} max={72} step={1} format={(value) => `${Math.round(value)}px`} onChange={(value) => updateScene('infoLayer.emailSize', value)} />
              </div>
              <div className="field-grid">
                <SelectField label="Titel Schriftschnitt" value={String(scene.infoLayer.titleWeight ?? 700)} options={FONT_WEIGHT_OPTIONS} onChange={(value) => updateScene('infoLayer.titleWeight', Number(value))} />
                <SelectField label="Text Schriftschnitt" value={String(scene.infoLayer.weight ?? 600)} options={FONT_WEIGHT_OPTIONS} onChange={(value) => updateScene('infoLayer.weight', Number(value))} />
              </div>
              <div className="field-grid">
                <SliderField label="Titel X" value={scene.infoLayer.titleX ?? getAepInfoLayout(scene.presetId).titleX} min={0.01} max={0.98} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.titleX', value)} />
                <SliderField label="Titel Y" value={scene.infoLayer.titleY ?? getAepInfoLayout(scene.presetId).titleY} min={0.02} max={0.9} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.titleY', value)} />
              </div>
              <div className="field-grid">
                <SliderField label="Titel 2 Y" value={scene.infoLayer.title2Y ?? getAepInfoLayout(scene.presetId).title2Y} min={0.02} max={0.96} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.title2Y', value)} />
                <SelectField label="Titel Ausrichtung" value={scene.infoLayer.titleAlign ?? 'center'} options={ALIGN_OPTIONS} onChange={(value) => updateScene('infoLayer.titleAlign', value)} />
              </div>
              <div className="field-grid">
                <SliderField label="Titel Breite" value={scene.infoLayer.titleMaxWidth ?? 0.82} min={0.3} max={0.96} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.titleMaxWidth', value)} />
                <SliderField label="Zeilenabstand" value={scene.infoLayer.titleLineHeight ?? 0.9} min={0.72} max={1.35} step={0.01} onChange={(value) => updateScene('infoLayer.titleLineHeight', value)} />
              </div>
              <div className="field-grid">
                <SliderField label="Datum X" value={scene.infoLayer.dateX ?? scene.infoLayer.eventX} min={0.01} max={0.9} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.dateX', value)} />
                <SliderField label="Datum Y" value={scene.infoLayer.dateY ?? scene.infoLayer.eventY} min={0.01} max={0.9} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.dateY', value)} />
              </div>
              <SelectField label="Datum Ausrichtung" value={scene.infoLayer.dateAlign ?? 'left'} options={ALIGN_OPTIONS} onChange={(value) => updateScene('infoLayer.dateAlign', value)} />
              <div className="field-grid">
                <SliderField label="Meta X" value={scene.infoLayer.metaX ?? getAepInfoLayout(scene.presetId).metaX} min={0.01} max={0.98} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.metaX', value)} />
                <SliderField label="Meta Y" value={scene.infoLayer.metaY ?? getAepInfoLayout(scene.presetId).metaY} min={0.01} max={0.95} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.metaY', value)} />
              </div>
              <SelectField label="Meta Ausrichtung" value={scene.infoLayer.metaAlign ?? 'right'} options={ALIGN_OPTIONS} onChange={(value) => updateScene('infoLayer.metaAlign', value)} />
              <div className="field-grid">
                <SliderField label="Mail X" value={scene.infoLayer.emailX} min={0.01} max={0.9} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.emailX', value)} />
                <SliderField label="Mail Y" value={scene.infoLayer.emailY} min={0.01} max={0.98} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.emailY', value)} />
              </div>
              <SelectField label="Mail Ausrichtung" value={scene.infoLayer.emailAlign ?? 'left'} options={ALIGN_OPTIONS} onChange={(value) => updateScene('infoLayer.emailAlign', value)} />
            </>
          )}
        </Section>

        <Section title="Export" icon={Film} defaultOpen={false}>
          <p role="status" aria-live="polite">{exportStatus}</p>
          <SliderField label="Zoom" value={previewZoom} min={0.45} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={setPreviewZoom} />
          <div className="button-row">
            <button className="accent-button" type="button" onClick={exportPng} disabled={isRecording}>
              <Download size={16} />
              PNG
            </button>
            <button className="ghost-button" type="button" onClick={exportMp4} disabled={isRecording}>
              <Film size={16} />
              {isRecording ? 'RENDERING...' : 'MP4'}
            </button>
            <button className="ghost-button" type="button" onClick={exportWebm} disabled={isRecording}>
              <Film size={16} />
              {isRecording ? 'RENDERING...' : 'WEBM'}
            </button>
          </div>
        </Section>
        </fieldset>
      </aside>

      <main className="workspace">
        <div className="stage-shell" ref={stageRef}>
          <div
            className="stage"
            style={{
              width: preset.width * previewScale,
              height: preset.height * previewScale,
            }}
            onPointerMove={(event) => {
              if (!draggingTarget) {
                return;
              }
              const rect = event.currentTarget.getBoundingClientRect();
              const x = Math.min(0.98, Math.max(0.01, (event.clientX - rect.left) / rect.width));
              const y = Math.min(0.98, Math.max(0.01, (event.clientY - rect.top) / rect.height));
              if (draggingTarget === 'date') {
                updateScene('infoLayer.dateX', x);
                updateScene('infoLayer.dateY', y);
              } else if (draggingTarget === 'title') {
                updateScene('infoLayer.titleX', x);
                updateScene('infoLayer.titleY', y);
              } else if (draggingTarget === 'meta') {
                updateScene('infoLayer.metaX', x);
                updateScene('infoLayer.metaY', y);
              } else if (draggingTarget === 'email') {
                updateScene('infoLayer.emailX', x);
                updateScene('infoLayer.emailY', y);
              } else if (draggingTarget === 'logo') {
                updateScene('overlay.logoX', x);
                updateScene('overlay.logoY', y);
              }
            }}
            onPointerUp={() => setDraggingTarget(null)}
            onPointerLeave={() => setDraggingTarget(null)}
          >
            <canvas
              ref={canvasRef}
              width={preset.width}
              height={preset.height}
              className="stage__canvas"
              style={{
                width: preset.width * previewScale,
                height: preset.height * previewScale,
              }}
            />
            {scene.guides.showGrid && (
              <div
                className="stage__grid"
                style={{
                  '--grid-columns': scene.guides.columns,
                  '--grid-rows': scene.guides.rows,
                  '--grid-opacity': scene.guides.opacity,
                }}
              />
            )}
            {(scene.guides.showGrid || typoAdvanced) && scene.infoLayer.show && (
              <>
                <button
                  type="button"
                  className={`drag-handle ${draggingTarget === 'date' ? 'is-dragging' : ''}`}
                  style={{
                    left: `${(scene.infoLayer.dateX ?? scene.infoLayer.eventX) * 100}%`,
                    top: `${(scene.infoLayer.dateY ?? scene.infoLayer.eventY) * 100}%`,
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDraggingTarget('date');
                  }}
                >
                  DATE
                </button>
                <button
                  type="button"
                  className={`drag-handle ${draggingTarget === 'title' ? 'is-dragging' : ''}`}
                  style={{
                    left: `${(scene.infoLayer.titleX ?? getAepInfoLayout(scene.presetId).titleX) * 100}%`,
                    top: `${(scene.infoLayer.titleY ?? getAepInfoLayout(scene.presetId).titleY) * 100}%`,
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDraggingTarget('title');
                  }}
                >
                  TITLE
                </button>
                <button
                  type="button"
                  className={`drag-handle ${draggingTarget === 'meta' ? 'is-dragging' : ''}`}
                  style={{
                    left: `${(scene.infoLayer.metaX ?? getAepInfoLayout(scene.presetId).metaX) * 100}%`,
                    top: `${(scene.infoLayer.metaY ?? getAepInfoLayout(scene.presetId).metaY) * 100}%`,
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDraggingTarget('meta');
                  }}
                >
                  META
                </button>
                <button
                  type="button"
                  className={`drag-handle ${draggingTarget === 'email' ? 'is-dragging' : ''}`}
                  style={{
                    left: `${scene.infoLayer.emailX * 100}%`,
                    top: `${scene.infoLayer.emailY * 100}%`,
                  }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDraggingTarget('email');
                  }}
                >
                  MAIL
                </button>
              </>
            )}
            {scene.overlay.showLogo && (
              <button
                type="button"
                className={`drag-handle ${draggingTarget === 'logo' ? 'is-dragging' : ''}`}
                style={{
                  left: `${scene.overlay.logoX * 100}%`,
                  top: `${scene.overlay.logoY * 100}%`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDraggingTarget('logo');
                }}
              >
                LOGO
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
