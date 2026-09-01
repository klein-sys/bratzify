---
name: spherical-fisheye
description: >-
  Cheatsheet for implementing authentic 1990s spherical fisheye text distortion in React and Remotion.
---

# Spherical Fisheye Text Distortion

When building a true 1990s spherical fisheye aesthetic (often seen in brutalist music videos or VHS edits), do not use CSS `rotateX` or standard CSS 3D transforms. CSS transforms only create cylindrical (flat baseline) distortion. A true fisheye requires the baseline of the text to physically curve.

## Implementation Guide

Follow these strict rules when building this aesthetic in React/Remotion:

1.  **Use SVG `<textPath>`:** Map the text onto an SVG quadratic bezier curve (`<path d="M ... Q ...">`). 
    *   Top words should have a control point that pulls the path upwards (a frown).
    *   Bottom words should have a control point that pulls the path downwards (a smile).
    *   The center word should have a perfectly horizontal control point.

2.  **Avoid `textLength` on Short Lines:** DO NOT use SVG `textLength="100%"` with `lengthAdjust="spacingAndGlyphs"` unless you are guaranteeing long strings of text. If a line only contains 1 or 2 characters (e.g., "I", "a"), it will stretch the individual glyphs into massive, unrecognizable blobs that overlap everything.
    *   **Fix:** Use `<textPath startOffset="50%" textAnchor="middle">` to natively center the text on the path without stretching glyphs.
    *   Then, use CSS `transform="scale(X, Y)"` on the parent `<text>` element to physically widen the center words for the extreme wide-angle lens look.

3.  **Strict Layout Math to Prevent Overlap:** When packing words tightly vertically, the font size *must* be mathematically bound to the line spacing.
    *   Calculate `ySpacing = availableHeight / numberOfLines`.
    *   **CRITICAL:** Set `fontSize = ySpacing * 0.9` (or similar). Never allow `fontSize` to exceed `ySpacing` (e.g., `ySpacing * 1.5`), or the lines will physically overlap into an illegible mess.

## Code Example

```tsx
const ySpacing = Math.min(180, 1000 / Math.max(1, words.length));
const y = centerY + offsetFromCenter * ySpacing; 

const wrapAmount = offsetFromCenter * 60; 
const endY = y - wrapAmount;
const controlY = 2 * y - endY; 

const pathD = `M ${startX} ${endY} Q ${centerX} ${controlY} ${endX} ${endY}`;

// Crucial: fontSize must be <= ySpacing
const fontSize = Math.min(220, ySpacing * 0.9);

<text 
  style={{
    fontSize: `${fontSize}px`,
    transformOrigin: `${centerX}px ${y}px`,
    transform: `scale(${scaleX}, ${scaleY})`
  }}
>
  <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
    {word}
  </textPath>
</text>
```
