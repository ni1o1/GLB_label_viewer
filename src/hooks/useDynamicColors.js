import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

// This utility function was previously inside the main hook.
// It's a pure function, so it can be defined outside the hook for clarity.
const adjustColor = (color, adjustment) => {
  const { brightness, contrast, saturation, gamma } = adjustment;
  
  const hsl = color.getHSL({});
  hsl.s = Math.max(0, Math.min(1, hsl.s * saturation));
  color.setHSL(hsl.h, hsl.s, hsl.l);
  
  let r = color.r, g = color.g, b = color.b;
  
  r = Math.max(0, Math.min(1, (r - 0.5) * contrast + 0.5));
  g = Math.max(0, Math.min(1, (g - 0.5) * contrast + 0.5));
  b = Math.max(0, Math.min(1, (b - 0.5) * contrast + 0.5));
  
  r = Math.max(0, Math.min(1, r * brightness));
  g = Math.max(0, Math.min(1, g * brightness));
  b = Math.max(0, Math.min(1, b * brightness));
  
  r = Math.pow(r, 1.0 / gamma);
  g = Math.pow(g, 1.0 / gamma);
  b = Math.pow(b, 1.0 / gamma);
  
  color.setRGB(r, g, b);
  return color;
};

/**
 * A custom hook to dynamically update the colors of point cloud and mesh geometries.
 */
export function useDynamicColors({
  pointCloudGeometry,
  labelMeshGeometry,
  points,
  viewMode,
  labels,
  selectedPoints,
  selectedFaces,
  activeLabel,
  colorAdjustment
}) {
  const labelMap = useMemo(() => {
    const map = new Map();
    labels.forEach(label => map.set(label.id, label));
    return map;
  }, [labels]);

  const selectedPointsSet = useMemo(() => new Set(selectedPoints), [selectedPoints]);

  // Effect for updating point cloud colors
  useEffect(() => {
    if (!pointCloudGeometry || !points || points.length === 0) return;

    const colors = pointCloudGeometry.attributes.color.array;
    const tempColor = new THREE.Color();

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      let alpha = 1.0;
      const label = point.labelId ? labelMap.get(point.labelId) : null;

      if (label && label.visible === false) {
        alpha = 0.0;
      }

      if (viewMode === 'labels') {
        tempColor.set(label ? label.color : 0x808080); // Default to gray
      } else {
        tempColor.fromArray(point.color).convertSRGBToLinear();
      }

      if (alpha > 0 && !selectedPointsSet.has(i)) {
        adjustColor(tempColor, colorAdjustment);
      }

      if (selectedPointsSet.has(i)) {
        const activeLabelObj = activeLabel ? labelMap.get(activeLabel) : null;
        tempColor.set(activeLabelObj ? activeLabelObj.color : 0xff0000).multiplyScalar(0.7);
        alpha = 1.0;
      }

      tempColor.toArray(colors, i * 4);
      colors[i * 4 + 3] = alpha;
    }

    pointCloudGeometry.attributes.color.needsUpdate = true;
  }, [pointCloudGeometry, points, viewMode, labelMap, selectedPointsSet, colorAdjustment, activeLabel]);

  // Effect for updating mesh colors
  useEffect(() => {
    if (!labelMeshGeometry || !labelMeshGeometry.userData.triangles) return;

    const colors = labelMeshGeometry.attributes.color.array;
    const triangles = labelMeshGeometry.userData.triangles;
    const tempColor = new THREE.Color();

    triangles.forEach((triangle, triIndex) => {
      let alpha = 1.0;
      const label = triangle.labelId ? labelMap.get(triangle.labelId) : null;

      if (label && label.visible === false) {
        alpha = 0.0;
      }

      if (viewMode === 'labels') {
        tempColor.set(label ? label.color : 0xB0B0B0).multiplyScalar(3);
      } else {
        const firstVertex = points[triangle.vertices[0]];
        tempColor.fromArray(firstVertex.color).convertSRGBToLinear();
        if (!selectedPointsSet.has(triangle.vertices[0])) {
            adjustColor(tempColor, colorAdjustment);
        }
      }

      if (selectedFaces.has(triangle.faceIndex)) {
        const activeLabelObj = activeLabel ? labelMap.get(activeLabel) : null;
        tempColor.set(activeLabelObj ? activeLabelObj.color : 0xff0000).multiplyScalar(0.7);
        if (alpha > 0) alpha = 1.0;
      }

      for (let i = 0; i < 3; i++) {
        const colorIndex = (triIndex * 3 + i) * 4;
        tempColor.toArray(colors, colorIndex);
        colors[colorIndex + 3] = alpha;
      }
    });

    labelMeshGeometry.attributes.color.needsUpdate = true;
  }, [labelMeshGeometry, points, viewMode, labelMap, selectedPointsSet, selectedFaces, colorAdjustment, activeLabel]);
}
