import { useMemo } from 'react';

/**
 * A custom hook that calculates the center of a point cloud and returns the centered positions and the offset.
 * @param {Array<Object>} points - The array of point objects, each with a `position` array.
 * @param {Function} dispatch - The dispatch function from the annotation store.
 * @returns {{centeredPositions: Float32Array, centerOffset: [number, number, number]}}
 */
export function useCenteredPoints(points, dispatch) {
  return useMemo(() => {
    if (!points || points.length === 0) {
      return { centeredPositions: new Float32Array(0), centerOffset: [0, 0, 0] };
    }

    let centerX = 0, centerY = 0, centerZ = 0;
    points.forEach(point => {
      const [x, y, z] = point.position;
      centerX += x;
      centerY += y;
      centerZ += z;
    });

    centerX /= points.length;
    centerY /= points.length;
    centerZ /= points.length;

    // Dispatch the authoritative center offset to the store for other components to use.
    dispatch({ type: 'SET_CENTER_OFFSET', payload: [centerX, centerY, centerZ] });

    const centeredPositions = new Float32Array(points.length * 3);
    points.forEach((point, index) => {
      const [x, y, z] = point.position;
      centeredPositions[index * 3] = x - centerX;
      centeredPositions[index * 3 + 1] = y - centerY;
      centeredPositions[index * 3 + 2] = z - centerZ;
    });

    return { centeredPositions, centerOffset: [centerX, centerY, centerZ] };
  }, [points, dispatch]);
}
