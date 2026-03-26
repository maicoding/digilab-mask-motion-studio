import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  LOGO_PRESETS,
  MASK_PRESETS,
  MOTION_PRESETS,
  createInitialScene,
} from './presets.js';
import { renderScene } from './engine.js';

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

const App = () => {
  const initialScene = useMemo(() => createInitialScene(), []);
  const [scene, setScene] = useState(initialScene);
  const [assetVersion, setAssetVersion] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(0.72);
  const [isRecording, setIsRecording] = useState(false);
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

    const totalFrames = Math.max(1, Math.round(scene.playback.duration * scene.playback.fps));
    for (let frame = 0; frame < totalFrames; frame += 1) {
      const time = (frame / totalFrames) * scene.playback.duration;
      renderScene({ ctx: recorderCtx, width: preset.width, height: preset.height, scene, colors: colorPreset, time, getImage });
      await new Promise((resolve) => window.requestAnimationFrame(resolve));
    }
    mediaRecorder.stop();
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
          <ToggleField label="Backdrop Box" checked={scene.stage.showBackdrop ?? false} onChange={(value) => updateScene('stage.showBackdrop', value)} />
          <div className="field-grid">
            <SliderField label="Shadow" value={scene.stage.shadow} min={0} max={0.5} step={0.01} onChange={(value) => updateScene('stage.shadow', value)} />
            <SliderField label="Radius" value={scene.stage.radius} min={0} max={0.2} step={0.01} onChange={(value) => updateScene('stage.radius', value)} />
          </div>
          <div className="field-grid">
            <SliderField label="Backdrop Alpha" value={scene.stage.backdropOpacity ?? 1} min={0} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => updateScene('stage.backdropOpacity', value)} />
            <div />
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
          <label className="field">
            <div className="field__head">
              <span>Caption</span>
            </div>
            <input type="text" value={scene.overlay.caption} onChange={(event) => updateScene('overlay.caption', event.target.value)} placeholder="z. B. digilab.ai" />
          </label>
        </Section>

        <Section title="Export" icon={Film} defaultOpen={false}>
          <SliderField label="Preview Zoom" value={previewZoom} min={0.45} max={1} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={setPreviewZoom} />
          <div className="button-row">
            <button className="accent-button" type="button" onClick={exportPng}>
              <Download size={16} />
              PNG
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
