export interface TemplateOption {
  id: string;
  label: string;
  type: "color" | "select" | "media";
  options?: { value: string; label: string }[]; // For "select" type
  defaultValue: string;
}

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  theme: {
    background: string;
    foreground: string;
    accent: string;
    accentForeground: string;
    fontFamily: string;
  };
  customOptions?: TemplateOption[];
}

export const TEMPLATES: Record<string, TemplateConfig> = {
  bratz: {
    id: "bratz",
    name: "Bratz",
    description: "The classic Y2K brutalist green and black aesthetic.",
    theme: {
      background: "#ffffff",
      foreground: "#000000",
      accent: "#8ACE00",
      accentForeground: "#000000",
      fontFamily: "Arial, Helvetica, sans-serif",
    },
    customOptions: [
      { id: "textColor", label: "Text Color", type: "color", defaultValue: "#000000" },
      { id: "bgColor", label: "Background Color", type: "color", defaultValue: "#ffffff" },
      { 
        id: "fontFamily", 
        label: "Font Family", 
        type: "select", 
        defaultValue: "Arial, Helvetica, sans-serif", 
        options: [
          { value: "Arial, Helvetica, sans-serif", label: "Arial (Brat)" },
          { value: "Impact, sans-serif", label: "Impact (Bold)" },
          { value: "'Times New Roman', Times, serif", label: "Times New Roman" },
          { value: "'Courier New', Courier, monospace", label: "Courier (Typewriter)" },
          { value: "'Comic Sans MS', 'Comic Sans', cursive", label: "Comic Sans (Y2k)" }
        ]
      },
      { 
        id: "textTransform", 
        label: "Text Casing", 
        type: "select", 
        defaultValue: "lowercase", 
        options: [
          { value: "lowercase", label: "lowercase" },
          { value: "uppercase", label: "UPPERCASE" },
          { value: "none", label: "Original" }
        ]
      },
      { id: "backgroundMedia", label: "Background Media URL", type: "media", defaultValue: "" },
    ]
  },
  fisheye: {
    id: "fisheye",
    name: "VHS Fisheye",
    description: "Gritty retro VHS look with a spherical fisheye distortion.",
    theme: {
      background: "#ffffff",
      foreground: "#000000",
      accent: "#8ACE00",
      accentForeground: "#000000",
      fontFamily: "Impact, sans-serif",
    },
    customOptions: [
      { id: "textColor", label: "Text Color", type: "color", defaultValue: "#FF7A00" },
      { id: "bgColor", label: "Background Color", type: "color", defaultValue: "#050505" },
      { 
        id: "effect", 
        label: "Overlay Effect", 
        type: "select", 
        defaultValue: "none",
        options: [
          { value: "none", label: "None" },
          { value: "rain", label: "Rain" },
          { value: "vhs", label: "VHS Glitch" }
        ]
      },
      { id: "backgroundMedia", label: "Background Media", type: "media", defaultValue: "" },
    ]
  }
};

export const DEFAULT_TEMPLATE = "bratz";
