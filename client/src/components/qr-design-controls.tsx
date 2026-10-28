import { QR_PRESETS, type ModuleStyle, type EyeStyle } from "@/lib/qr-design";

type Preset = typeof QR_PRESETS[number];
interface Props {
  moduleStyle: ModuleStyle;
  eyeStyle: EyeStyle;
  eyeColor: string;
  foregroundColor: string;
  backgroundColor: string;
  onModuleStyle: (value: ModuleStyle) => void;
  onEyeStyle: (value: EyeStyle) => void;
  onEyeColor: (value: string) => void;
  onBackgroundColor: (value: string) => void;
  onPreset: (preset: Preset) => void;
}
function luminance(hex: string) {
  const values = hex.slice(1).match(/.{2}/g)?.map(v => {
    const n = parseInt(v, 16) / 255;
    return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
  }) ?? [0, 0, 0];
  return values[0] * .2126 + values[1] * .7152 + values[2] * .0722;
}
export function QRDesignControls(props: Props) {
  const transparent = props.backgroundColor === "transparent";
  const bg = luminance(transparent ? "#FFFFFF" : props.backgroundColor);
  const contrast = Math.min(...[props.foregroundColor, props.eyeColor].map(color => {
    const fg = luminance(color);
    return (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05);
  }));
  return <section className="space-y-5 rounded-2xl border bg-muted/20 p-4" aria-label="QR design studio">
    <div><h3 className="text-sm font-semibold">Start with a signature look</h3>
      <p className="mt-1 text-xs text-muted-foreground">Six considered palettes. Make any of them your own.</p></div>
    <div className="grid grid-cols-3 gap-2">
      {QR_PRESETS.map(preset => <button key={preset.name} type="button" aria-pressed={props.foregroundColor.toLowerCase() === preset.foreground.toLowerCase() && props.backgroundColor.toLowerCase() === preset.background.toLowerCase() && props.moduleStyle === preset.moduleStyle && props.eyeStyle === preset.eyeStyle && props.eyeColor.toLowerCase() === preset.accent.toLowerCase()} onClick={() => props.onPreset(preset)}
        className="group rounded-xl border p-2 text-left transition hover:border-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        <svg aria-hidden="true" viewBox="0 0 60 42" className="mb-2 w-full rounded-lg" style={{ background: preset.background }}>
          {[ [8, 7], [37, 7], [8, 23] ].map(([x, y]) => <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="14" height="14" rx={preset.eyeStyle === "circle" ? 7 : preset.eyeStyle === "rounded" ? 4 : 0} fill={preset.accent}/>
            <rect x={x+3} y={y+3} width="8" height="8" rx="2" fill={preset.background}/>
            <rect x={x+5} y={y+5} width="4" height="4" rx="1" fill={preset.accent}/></g>)}
          {[ [27,8], [27,15], [27,23], [27,31], [37,26], [45,26], [37,33], [48,34] ].map(([x,y]) => <rect key={`${x}-${y}`} x={x} y={y} width="5" height="5" rx={preset.moduleStyle === "dots" ? 2.5 : preset.moduleStyle === "rounded" ? 1.5 : 0} fill={preset.foreground}/>)}
        </svg>
        <span className="text-xs font-medium">{preset.name}</span>
      </button>)}
    </div>
    <fieldset className="space-y-2"><legend className="mb-2 text-xs font-medium">Pattern</legend>
      <div className="flex gap-2">{(["square", "rounded", "dots"] as const).map(style => <button type="button" key={style}
        aria-pressed={props.moduleStyle === style} onClick={() => props.onModuleStyle(style)}
        className={`flex-1 rounded-lg border px-2 py-2 text-xs capitalize ${props.moduleStyle === style ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}>{style}</button>)}</div>
    </fieldset>
    <fieldset><legend className="mb-2 text-xs font-medium">Corner eyes</legend>
      <div className="flex gap-2">{(["square", "rounded", "circle"] as const).map(style => <button type="button" key={style}
        aria-pressed={props.eyeStyle === style} onClick={() => props.onEyeStyle(style)}
        className={`flex-1 rounded-lg border px-2 py-2 text-xs capitalize ${props.eyeStyle === style ? "border-primary bg-primary/10 text-primary" : "bg-background"}`}>{style}</button>)}</div>
    </fieldset>
    <label className="flex items-center justify-between text-xs font-medium">Corner color
      <input type="color" aria-label="Corner color" value={props.eyeColor} onChange={event => props.onEyeColor(event.target.value)} className="h-8 w-12 cursor-pointer rounded border bg-background"/>
    </label>
    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium">
      <input type="checkbox" checked={transparent} onChange={event => props.onBackgroundColor(event.target.checked ? "transparent" : "#FFFFFF")} />
      Transparent QR background
    </label>
    <p className={`text-xs ${contrast < 4.5 ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`} role="status">
      {transparent ? "Your image will show through the QR background and corner openings. Contrast depends on the image underneath." : contrast < 4.5 ? "Low contrast: choose darker pattern and corner colors on a light background." : "High contrast palette · generous scan margin · high-resolution PNG"}
      {" "}Test your final design with a phone before sharing.
    </p>
  </section>;
}
