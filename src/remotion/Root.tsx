import React from "react";
import { Composition } from "remotion";
import { TEMPLATES } from "../lib/templates";
import { BratzTemplate } from "./templates/BratzTemplate";
import { FisheyeTemplate } from "./templates/FisheyeTemplate";
import { MinimalistTemplate } from "./templates/MinimalistTemplate";

const TemplateComponents: Record<string, React.FC<any>> = {
  bratz: BratzTemplate,
  fisheye: FisheyeTemplate,
  minimalist: MinimalistTemplate,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {Object.values(TEMPLATES).map((tpl) => {
        const Component = TemplateComponents[tpl.id];
        if (!Component) return null;
        
        const defaultProps: any = {
          lyrics: [],
          audioUrl: null,
          startFrameOffset: 0
        };
        
        if (tpl.customOptions) {
          tpl.customOptions.forEach(opt => {
            defaultProps[opt.id] = opt.defaultValue;
          });
        }
        
        return (
          <Composition
            key={tpl.id}
            id={tpl.id}
            component={Component}
            durationInFrames={900}
            fps={30}
            width={1080}
            height={1920}
            defaultProps={defaultProps}
          />
        );
      })}
    </>
  );
};
