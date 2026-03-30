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

const MP4_ENCODER_CANDIDATES = [
  { codec: 'avc1.42001f', avc: { format: 'avc' } },
  { codec: 'avc1.4d001f', avc: { format: 'avc' } },
];

const MP4_MEDIA_RECORDER_CANDIDATES = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs="avc1.42E01E"',
  'video/mp4;codecs="avc1"',
  'video/mp4',
];

const EXPORT_PRESETS = [
  { id: 'instagram-post', label: 'Post', presetId: 'square', duration: 5, fps: 30, rate: 1, loop: true },
  { id: 'instagram-story', label: 'Story', presetId: 'story', duration: 6, fps: 30, rate: 1, loop: true },
  { id: 'instagram-reel', label: 'Reel', presetId: 'story', duration: 8, fps: 30, rate: 1, loop: true },
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

const ToggleField = ({ label, checked, onChange }) => (
  <label className="toggle">
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
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

const getAepInfoLayout = (presetId) => {
  if (presetId === 'story') {
    return {
      dateX: 0.075,
      dateY: 0.042,
      titleX: 0.315,
      titleY: 0.042,
      metaX: 0.315,
      metaY: 0.155,
      emailX: 0.075,
      emailY: 0.925,
      logoX: 0.92,
      logoY: 0.94,
      dateSize: 52,
      titleSize: 62,
      metaSize: 28,
      emailSize: 32,
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
    dateY: 0.031,
    titleX: 0.254,
    titleY: 0.031,
    metaX: 0.254,
    metaY: 0.138,
    emailX: 0.032,
    emailY: 0.907,
    logoX: 0.92,
    logoY: 0.94,
    dateSize: 48,
    titleSize: 56,
    metaSize: 26,
    emailSize: 32,
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
        weight: 500,
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
  ];
};

const App = () => {
  const initialScene = useMemo(() => createInitialScene(), []);
  const [scene, setScene] = useState(initialScene);
  const [assetVersion, setAssetVersion] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(0.72);
  const [isRecording, setIsRecording] = useState(false);
  const [draggingTarget, setDraggingTarget] = useState(null);
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const imageCacheRef = useRef(new Map());
  const lastTickRef = useRef(0);
  const stageSize = useElementSize(stageRef);

  const preset = CANVAS_PRESETS.find((item) => item.id === scene.presetId) ?? CANVAS_PRESETS[0];
  const colorPreset = COLOR_PRESETS.find((item) => item.id === scene.colorPresetId) ?? COLOR_PRESETS[0];

  const getImage = (src) => {
    if (!src) {
      return null;
    }
    const cached = imageCacheRef.current.get(src);
    if (cached?.status === 'loaded') {
      return cached.image;
    }
    if (cached?.status === 'loading') {
      return null;
    }
    const image = new Image();
    image.onload = () => {
      imageCacheRef.current.set(src, { status: 'loaded', image });
      setAssetVersion((value) => value + 1);
    };
    image.onerror = () => imageCacheRef.current.set(src, { status: 'error', image: null });
    image.src = src;
    imageCacheRef.current.set(src, { status: 'loading', image: null });
    return null;
  };

  const previewScale = useMemo(() => {
    if (!stageSize.width || !stageSize.height) {
      return previewZoom;
    }
    return Math.min((stageSize.width - 80) / preset.width, (stageSize.height - 80) / preset.height, 1) * previewZoom;
  }, [preset.height, preset.width, previewZoom, stageSize.height, stageSize.width]);

  const updateScene = (path, value) => setScene((current) => deepSet(current, path, value));

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
    const presetEntry = MASK_PRESETS.find((item) => item.id === presetId);
    if (!presetEntry) {
      return;
    }
    setScene((current) => ({
      ...current,
      mask: {
        ...current.mask,
        ...presetEntry,
        presetId,
      },
      stage: {
        ...current.stage,
        width: presetEntry.width,
        height: presetEntry.height,
        y: presetEntry.stageY ?? current.stage.y,
      },
      presetId: presetEntry.format ?? current.presetId,
    }));
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
    const maskPreset = MASK_PRESETS.find((item) => item.id === combo.maskPresetId);
    const motionPreset = MOTION_PRESETS.find((item) => item.id === combo.motionPresetId);
    if (!maskPreset || !motionPreset) {
      return;
    }
    setScene((current) => ({
      ...current,
      presetId: maskPreset.format ?? current.presetId,
      motionPresetId: motionPreset.id,
      mask: {
        ...current.mask,
        ...maskPreset,
        ...motionPreset.mask,
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
    }));
  };

  const handleImageUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const src = URL.createObjectURL(file);
    setScene((current) => ({
      ...current,
      imageSrc: src,
      imageName: file.name,
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

  const applyAepInfoLayout = () => {
    const layout = getAepInfoLayout(scene.presetId);
    setScene((current) => ({
      ...current,
      infoLayoutPresetId: 'aep-auto',
      infoLayer: {
        ...current.infoLayer,
        dateX: layout.dateX,
        dateY: layout.dateY,
        titleX: layout.titleX,
        titleY: layout.titleY,
        metaX: layout.metaX,
        metaY: layout.metaY,
        emailX: layout.emailX,
        emailY: layout.emailY,
        dateSize: layout.dateSize,
        titleSize: layout.titleSize,
        metaSize: layout.metaSize,
        emailSize: layout.emailSize,
      },
      overlay: {
        ...current.overlay,
        logoX: layout.logoX,
        logoY: layout.logoY,
      },
    }));
  };

  const applyInfoLayoutPreset = (presetId) => {
    const layoutPreset = getInfoLayoutPresets(scene.presetId).find((item) => item.id === presetId);
    if (!layoutPreset) {
      return;
    }
    setScene((current) => ({
      ...current,
      infoLayoutPresetId: presetId,
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
    setScene((current) => ({
      ...current,
      presetId: presetEntry.presetId,
      playback: {
        ...current.playback,
        duration: presetEntry.duration,
        fps: presetEntry.fps,
        rate: presetEntry.rate,
        loop: presetEntry.loop,
        time: 0,
      },
    }));
  };

  const exportPng = () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = preset.width;
    exportCanvas.height = preset.height;
    const ctx = exportCanvas.getContext('2d');
    renderScene({ ctx, width: preset.width, height: preset.height, scene, colors: colorPreset, time: scene.playback.time, getImage });
    const link = document.createElement('a');
    link.download = `digilab-mask-frame-${preset.id}-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const renderFramesToCanvas = async (targetCtx) => {
    const totalFrames = Math.max(1, Math.round(scene.playback.duration * scene.playback.fps));
    for (let frame = 0; frame < totalFrames; frame += 1) {
      const time = (frame / totalFrames) * scene.playback.duration;
      renderScene({ ctx: targetCtx, width: preset.width, height: preset.height, scene, colors: colorPreset, time, getImage });
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
  };

  const exportWebm = async () => {
    const sourceCanvas = canvasRef.current;
    if (!sourceCanvas || isRecording) {
      return;
    }
    setIsRecording(true);
    const recorderCanvas = document.createElement('canvas');
    recorderCanvas.width = preset.width;
    recorderCanvas.height = preset.height;
    const recorderCtx = recorderCanvas.getContext('2d');
    const stream = recorderCanvas.captureStream(scene.playback.fps);
    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = [];
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };
    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `digilab-mask-motion-${preset.id}-${Date.now()}.webm`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
      setIsRecording(false);
    };
    mediaRecorder.start();
    await renderFramesToCanvas(recorderCtx);
    mediaRecorder.stop();
  };

  const exportMp4 = async () => {
    if (isRecording) {
      return;
    }

    if (typeof window.VideoEncoder === 'undefined' || typeof window.VideoFrame === 'undefined') {
      window.alert('MP4-Export wird in diesem Browser nicht unterstützt. Bitte nutze hier WEBM oder einen aktuellen Chrome/Edge.');
      return;
    }

    setIsRecording(true);
    try {
      const recorderCanvas = document.createElement('canvas');
      recorderCanvas.width = preset.width;
      recorderCanvas.height = preset.height;
      const recorderCtx = recorderCanvas.getContext('2d');
      const fps = Math.max(1, scene.playback.fps);

      if (typeof window.MediaRecorder !== 'undefined') {
        const supportedMimeType = MP4_MEDIA_RECORDER_CANDIDATES.find((candidate) => window.MediaRecorder.isTypeSupported(candidate));
        if (supportedMimeType) {
          const stream = recorderCanvas.captureStream(fps);
          const chunks = [];
          const mediaRecorder = new window.MediaRecorder(stream, { mimeType: supportedMimeType });

          const blob = await new Promise(async (resolve, reject) => {
            mediaRecorder.ondataavailable = (event) => {
              if (event.data.size > 0) {
                chunks.push(event.data);
              }
            };
            mediaRecorder.onerror = (event) => reject(event.error ?? new Error('MP4-Aufnahme fehlgeschlagen.'));
            mediaRecorder.onstop = () => resolve(new Blob(chunks, { type: 'video/mp4' }));

            mediaRecorder.start();
            await renderFramesToCanvas(recorderCtx);
            mediaRecorder.stop();
          });

          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = `digilab-mask-motion-${preset.id}-${Date.now()}.mp4`;
          link.href = url;
          link.click();
          URL.revokeObjectURL(url);
          return;
        }
      }

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
        window.alert('MP4-Export ist auf diesem Geraet leider nicht verfuegbar. Bitte nutze hier WEBM.');
        setIsRecording(false);
        return;
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

      encoder.configure(selectedConfig);

      const totalFrames = Math.max(1, Math.round(scene.playback.duration * fps));
      for (let frame = 0; frame < totalFrames; frame += 1) {
        const time = (frame / totalFrames) * scene.playback.duration;
        renderScene({ ctx: recorderCtx, width: preset.width, height: preset.height, scene, colors: colorPreset, time, getImage });

        const frameDuration = Math.round(1_000_000 / fps);
        const videoFrame = new window.VideoFrame(recorderCanvas, {
          timestamp: frame * frameDuration,
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
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
      }

      await encoder.flush();
      encoder.close();
      muxer.finalize();

      const blob = new Blob([target.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `digilab-mask-motion-${preset.id}-${Date.now()}.mp4`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      window.alert('MP4-Export konnte nicht erstellt werden. Bitte pruefe den Browser oder nutze alternativ WEBM.');
    } finally {
      setIsRecording(false);
    }
  };

  useEffect(() => {
    document.fonts?.ready.then(() => setAssetVersion((value) => value + 1));
  }, []);

  useEffect(() => {
    if (!scene.playback.playing) {
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
  }, [scene.playback.fps, scene.playback.loop, scene.playback.playing, scene.playback.rate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext('2d');
    renderScene({ ctx, width: preset.width, height: preset.height, scene, colors: colorPreset, time: scene.playback.time, getImage });
  }, [assetVersion, colorPreset, preset.height, preset.width, scene]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
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
            <SliderField label="Dauer" value={scene.playback.duration} min={2} max={12} step={0.5} format={(value) => `${value.toFixed(1)}s`} onChange={(value) => updateScene('playback.duration', value)} />
            <SliderField label="FPS" value={scene.playback.fps} min={12} max={60} step={1} format={(value) => `${value}`} onChange={(value) => updateScene('playback.fps', value)} />
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
            options={MOTION_PRESETS.map((item) => ({ value: item.id, label: item.label }))}
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
          <ToggleField label="Custom Hintergrund" checked={scene.useCustomBackground} onChange={(value) => updateScene('useCustomBackground', value)} />
          <ColorField label="Background" value={scene.backgroundColor} onChange={(value) => updateScene('backgroundColor', value)} />
          <div className="field-grid">
            <SliderField label="Stage X" value={scene.stage.x} min={0.2} max={0.8} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.x', value)} />
            <SliderField label="Stage Y" value={scene.stage.y} min={0.2} max={0.8} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.y', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Stage Breite" value={scene.stage.width} min={0.3} max={0.92} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.width', value)} />
            <SliderField label="Stage Höhe" value={scene.stage.height} min={0.2} max={0.86} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.height', value)} />
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
          <UploadButton label={scene.imageSrc ? 'Bild ersetzen' : 'Bild hochladen'} accept="image/*" onSelect={handleImageUpload} />
          <div className="asset-note">{scene.imageName || 'Noch kein Bild geladen'}</div>
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

        <Section title="Info Text" icon={Settings2} defaultOpen={false}>
          <ToggleField label="Infos anzeigen" checked={scene.infoLayer.show} onChange={(value) => updateScene('infoLayer.show', value)} />
          <SelectField
            label="Text Layout Preset"
            value={scene.infoLayoutPresetId ?? 'aep-auto'}
            options={getInfoLayoutPresets(scene.presetId).map((item) => ({ value: item.id, label: item.label }))}
            onChange={applyInfoLayoutPreset}
          />
          <div className="button-row">
            {getInfoLayoutPresets(scene.presetId).map((item) => (
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
            <label className="field">
              <div className="field__head">
                <span>Datum</span>
              </div>
              <input type="text" value={scene.infoLayer.date} onChange={(event) => updateScene('infoLayer.date', event.target.value)} />
            </label>
            <label className="field">
              <div className="field__head">
                <span>Mail</span>
              </div>
              <input type="text" value={scene.infoLayer.email} onChange={(event) => updateScene('infoLayer.email', event.target.value)} />
            </label>
          </div>
          <label className="field">
            <div className="field__head">
              <span>Titel Zeile 1</span>
            </div>
            <input type="text" value={scene.infoLayer.title1} onChange={(event) => updateScene('infoLayer.title1', event.target.value)} />
          </label>
          <label className="field">
            <div className="field__head">
              <span>Titel Zeile 2</span>
            </div>
            <input type="text" value={scene.infoLayer.title2} onChange={(event) => updateScene('infoLayer.title2', event.target.value)} />
          </label>
          <div className="field-grid">
            <label className="field">
              <div className="field__head">
                <span>Start</span>
              </div>
              <input type="text" value={scene.infoLayer.start} onChange={(event) => updateScene('infoLayer.start', event.target.value)} />
            </label>
            <label className="field">
              <div className="field__head">
                <span>Dauer</span>
              </div>
              <input type="text" value={scene.infoLayer.duration} onChange={(event) => updateScene('infoLayer.duration', event.target.value)} />
            </label>
          </div>
          <label className="field">
            <div className="field__head">
              <span>Ort</span>
            </div>
            <input type="text" value={scene.infoLayer.location} onChange={(event) => updateScene('infoLayer.location', event.target.value)} />
          </label>
          <ColorField label="Titel Farbe" value={scene.infoLayer.titleColor} onChange={(value) => updateScene('infoLayer.titleColor', value)} />
          <ColorField label="Meta Farbe" value={scene.infoLayer.metaColor} onChange={(value) => updateScene('infoLayer.metaColor', value)} />
          <ColorField label="Mail Farbe" value={scene.infoLayer.emailColor} onChange={(value) => updateScene('infoLayer.emailColor', value)} />
          <div className="swatch-row">
            {TEXT_SWATCHES.map((color) => (
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
          <div className="field-grid">
            <SliderField label="Datum Size" value={scene.infoLayer.dateSize} min={18} max={88} step={1} format={(value) => `${Math.round(value)}px`} onChange={(value) => updateScene('infoLayer.dateSize', value)} />
            <SliderField label="Titel Size" value={scene.infoLayer.titleSize} min={20} max={120} step={1} format={(value) => `${Math.round(value)}px`} onChange={(value) => updateScene('infoLayer.titleSize', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Meta Size" value={scene.infoLayer.metaSize} min={14} max={64} step={1} format={(value) => `${Math.round(value)}px`} onChange={(value) => updateScene('infoLayer.metaSize', value)} />
            <SliderField label="Mail Size" value={scene.infoLayer.emailSize} min={16} max={72} step={1} format={(value) => `${Math.round(value)}px`} onChange={(value) => updateScene('infoLayer.emailSize', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Datum X" value={scene.infoLayer.dateX ?? scene.infoLayer.eventX} min={0.01} max={0.9} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.dateX', value)} />
            <SliderField label="Datum Y" value={scene.infoLayer.dateY ?? scene.infoLayer.eventY} min={0.01} max={0.9} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.dateY', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Titel X" value={scene.infoLayer.titleX ?? getAepInfoLayout(scene.presetId).titleX} min={0.01} max={0.95} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.titleX', value)} />
            <SliderField label="Titel Y" value={scene.infoLayer.titleY ?? getAepInfoLayout(scene.presetId).titleY} min={0.01} max={0.9} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.titleY', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Meta X" value={scene.infoLayer.metaX ?? getAepInfoLayout(scene.presetId).metaX} min={0.01} max={0.95} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.metaX', value)} />
            <SliderField label="Meta Y" value={scene.infoLayer.metaY ?? getAepInfoLayout(scene.presetId).metaY} min={0.01} max={0.95} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.metaY', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Mail X" value={scene.infoLayer.emailX} min={0.01} max={0.9} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.emailX', value)} />
            <SliderField label="Mail Y" value={scene.infoLayer.emailY} min={0.01} max={0.98} step={0.001} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('infoLayer.emailY', value)} />
          </div>
          <SliderField label="Weight" value={scene.infoLayer.weight} min={300} max={700} step={100} format={(value) => `${Math.round(value)}`} onChange={(value) => updateScene('infoLayer.weight', value)} />
        </Section>

        <Section title="Export" icon={Film} defaultOpen={false}>
          <SliderField label="Preview Zoom" value={previewZoom} min={0.45} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={setPreviewZoom} />
          <div className="button-row">
            <button className="accent-button" type="button" onClick={exportPng}>
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
      </aside>

      <main className="workspace">
        <div className="workspace__header">
          <div>
            <div className="eyebrow">Preview</div>
            <h2>Bild hinter pixeliger Form mit turbulenter Wellenbewegung, für Story, Post und weitere Instagram-Formate.</h2>
          </div>
          <p>Die Form orientiert sich an deinen Referenzen und lässt sich als flexibles Mask-System weiter variieren.</p>
        </div>

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
            {scene.infoLayer.show && (
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

        <div className="reference-card">
          <div>
            <div className="eyebrow">Referenzen</div>
            <h3>Vier Form-Familien fuer Post und Story</h3>
            <p>Die Engine bildet jetzt alle vier Maskenfamilien aus deinem Instagram-Ordner nach. Die Presets synchronisieren Format und Grundverhalten direkt auf Post oder Story.</p>
          </div>
          <div className="reference-grid">
            <img src="/references/story-form-01.png" alt="Story Form Referenz" />
            <img src="/references/story-form-02.png" alt="Story Form 02 Referenz" />
            <img src="/references/story-form-03.png" alt="Story Form 03 Referenz" />
            <img src="/references/story-form-04.png" alt="Story Form 04 Referenz" />
            <img src="/references/post-form-01-template03.png" alt="Post Form 01 Referenz" />
            <img src="/references/post-form-02.png" alt="Post Form 02 Referenz" />
            <img src="/references/post-form-03.png" alt="Post Form 03 Referenz" />
            <img src="/references/post-form-04.png" alt="Post Form 04 Referenz" />
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
