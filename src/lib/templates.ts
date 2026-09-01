export interface TemplateOption {
  id: string;
  label: string;
  type: "color" | "select";
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
    }
  },
  fisheye: {
    id: "fisheye",
    name: "VHS Fisheye",
    description: "Gritty retro VHS look with a spherical fisheye distortion.",
    theme: {
      background: "#050505",
      foreground: "#FF7A00",
      accent: "#FF7A00",
      accentForeground: "#050505",
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
      }
    ]
  },
  minimalist: {
    id: "minimalist",
    name: "Minimalist Editorial",
    description: "Quiet sophistication. Clean editorial typography, massive negative space, and slow ambient depth.",
    theme: {
      background: "#F7F6F3",
      foreground: "#111111",
      accent: "#FBF3DB",
      accentForeground: "#956400",
      fontFamily: "'Playfair Display', serif",
    },
    customOptions: [
      { id: "ambientColor", label: "Ambient Glow", type: "color", defaultValue: "#EAEAEA" }
    ]
  }
};

export const DEFAULT_TEMPLATE = "bratz";
