/**
 * @file selectionUtils.js
 * This file contains utility functions related to selection logic, such as converting selected points to selected faces.
 */

/**
 * Calculates the set of selected faces based on the currently selected points and the selection mode.
 *
 * @param {Array<Object>} faces - The array of face objects, where each face has an `indices` array of point indices.
 * @param {Array<Object>} labels - The array of label objects, used to check for visibility.
 * @param {Set<number>} selectedPoints - A set of indices of the selected points.
 * @param {string} meshSelectionMode - The selection mode, either 'TOUCHING' or 'ENCLOSED'.
 * @returns {Set<number>} A new set containing the indices of the selected faces.
 */
export function calculateSelectedFaces(faces, labels, selectedPoints, meshSelectionMode) {
  if (!faces || faces.length === 0 || !selectedPoints || selectedPoints.size === 0) {
    return new Set();
  }

  const selectedPointsSet = new Set(selectedPoints);
  const newSelectedFaces = new Set();

  // Create a map for quick lookup of label visibility.
  const labelVisibilityMap = new Map();
  labels.forEach(label => {
    labelVisibilityMap.set(label.id, label.visible);
  });

  faces.forEach((face, faceIndex) => {
    // If the face belongs to a label, check if that label is visible.
    // If the label is explicitly set to not visible, skip this face.
    if (face.labelId && labelVisibilityMap.get(face.labelId) === false) {
      return;
    }

    // Check if the face's vertices intersect with the selected points.
    if (meshSelectionMode === 'TOUCHING') {
      // If any vertex is selected, the face is selected.
      if (face.indices.some(idx => selectedPointsSet.has(idx))) {
        newSelectedFaces.add(faceIndex);
      }
    } else if (meshSelectionMode === 'ENCLOSED') {
      // Only if all vertices are selected, the face is selected.
      if (face.indices.every(idx => selectedPointsSet.has(idx))) {
        newSelectedFaces.add(faceIndex);
      }
    }
  });

  return newSelectedFaces;
}
