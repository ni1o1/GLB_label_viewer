import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Creates the BufferGeometry for the point cloud.
 * @param {Array<Object>} points - The original points array, used for initial color data.
 * @param {Float32Array} centeredPositions - The vertex positions, already centered.
 * @returns {THREE.BufferGeometry | null} The resulting point cloud geometry.
 */
export function usePointCloudGeometry(points, centeredPositions) {
  return useMemo(() => {
    if (!points || points.length === 0) {
      return null;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(centeredPositions, 3));

    // Create an RGBA color buffer. The actual colors will be set dynamically in the useDynamicColors hook,
    // but we initialize it here with the original vertex colors.
    const colors = new Float32Array(points.length * 4);
    points.forEach((point, index) => {
        const colorIndex = index * 4;
        colors[colorIndex] = point.color[0];
        colors[colorIndex + 1] = point.color[1];
        colors[colorIndex + 2] = point.color[2];
        colors[colorIndex + 3] = 1.0; // Alpha
    });

    geom.setAttribute('color', new THREE.BufferAttribute(colors, 4));
    geom.computeBoundingSphere();

    return geom;
  }, [points, centeredPositions]);
}
