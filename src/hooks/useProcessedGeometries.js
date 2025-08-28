import { useMemo } from 'react';
import { useCenteredPoints } from './useCenteredPoints';
import { usePointCloudGeometry } from './usePointCloudGeometry';
import { useMeshGeometries } from './useMeshGeometries';
import { useDynamicColors } from './useDynamicColors';

/**
 * A custom hook that orchestrates the entire geometry processing pipeline.
 * It composes several smaller, single-responsibility hooks to achieve this.
 */
export const useProcessedGeometries = ({
  points,
  faces,
  labels,
  viewMode,
  selectedPoints,
  selectedFaces,
  colorAdjustment,
  activeLabel,
  hasMesh,
  dispatch
}) => {
  // Step 1: Center the points and get the offset.
  const { centeredPositions, centerOffset } = useCenteredPoints(points, dispatch);

  // Step 2: Create the basic point cloud geometry.
  const pointCloudGeometry = usePointCloudGeometry(points, centeredPositions);

  // Step 3: Memoize the label map for efficiency.
  const labelMap = useMemo(() => {
    const map = new Map();
    labels.forEach(label => map.set(label.id, label));
    return map;
  }, [labels]);

  // Step 4: Create mesh-based geometries (for labels and highlights).
  const { labelMeshGeometry, highlightGeometry } = useMeshGeometries({
    hasMesh,
    faces,
    points,
    centerOffset,
    selectedFaces,
    labelMap
  });

  // Step 5: Apply dynamic color updates to the geometries based on state.
  // This hook does not return anything; it mutates the geometry attributes.
  useDynamicColors({
    pointCloudGeometry,
    labelMeshGeometry,
    points,
    viewMode,
    labels,
    selectedPoints,
    selectedFaces,
    activeLabel,
    colorAdjustment
  });

  // Step 6: Return all the processed data.
  return {
    pointCloudGeometry,
    labelMeshGeometry,
    highlightGeometry,
    centerOffset,
  };
};
