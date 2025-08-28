import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * Creates the main mesh geometry for visualizing labeled faces.
 * @param {boolean} hasMesh - Flag indicating if a mesh exists.
 * @param {Array<Object>} faces - The array of face objects.
 * @param {Array<Object>} points - The array of point objects.
 * @param {[number, number, number]} centerOffset - The offset used to center the geometry.
 * @returns {THREE.BufferGeometry | null} The resulting mesh geometry.
 */
function createLabelMeshGeometry(hasMesh, faces, points, centerOffset) {
  if (!hasMesh || !faces || faces.length === 0 || !points || points.length === 0) {
    return null;
  }

  const [centerX, centerY, centerZ] = centerOffset;

  // We create separate vertices for each triangle to avoid color interpolation issues.
  const triangles = [];
  faces.forEach((face, faceIndex) => {
    const faceIndices = face.indices || face;
    if (faceIndices.length >= 3) {
      // Triangulate the face (assuming convex polygons)
      for (let i = 1; i < faceIndices.length - 1; i++) {
        triangles.push({
          vertices: [faceIndices[0], faceIndices[i], faceIndices[i + 1]],
          labelId: face.labelId || null,
          faceIndex: faceIndex,
          textureCoords: face.textureCoords || null,
          faceColor: face.color || null
        });
      }
    }
  });

  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(triangles.length * 9); // 3 vertices * 3 coords
  const colors = new Float32Array(triangles.length * 12);    // 3 vertices * 4 colors (RGBA)
  const uvs = new Float32Array(triangles.length * 6);        // 3 vertices * 2 UVs

  triangles.forEach((triangle, triangleIndex) => {
    triangle.vertices.forEach((vertexIndex, localIndex) => {
      const point = points[vertexIndex];
      const [x, y, z] = point.position;
      const posIndex = triangleIndex * 9 + localIndex * 3;
      positions[posIndex] = x - centerX;
      positions[posIndex + 1] = y - centerY;
      positions[posIndex + 2] = z - centerZ;

      const colorIndex = triangleIndex * 12 + localIndex * 4;
      const initialColor = (triangle.faceColor || point.color);
      colors[colorIndex] = initialColor[0];
      colors[colorIndex + 1] = initialColor[1];
      colors[colorIndex + 2] = initialColor[2];
      colors[colorIndex + 3] = 1.0; // Alpha

      const uvIndex = triangleIndex * 6 + localIndex * 2;
      const pointUV = point.textureCoords || [0, 0];
      const faceUVs = triangle.textureCoords;
      uvs[uvIndex] = (faceUVs && faceUVs.length > localIndex * 2) ? faceUVs[localIndex * 2] : pointUV[0];
      uvs[uvIndex + 1] = (faceUVs && faceUVs.length > localIndex * 2 + 1) ? faceUVs[localIndex * 2 + 1] : pointUV[1];
    });
  });

  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.BufferAttribute(colors, 4));
  geom.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geom.computeVertexNormals();

  // Store triangle metadata for dynamic color updates.
  geom.userData.triangles = triangles;

  return geom;
}

/**
 * Creates a geometry to highlight the currently selected faces.
 * @param {boolean} hasMesh - Flag indicating if a mesh exists.
 * @param {Array<Object>} faces - The array of face objects.
 * @param {Array<Object>} points - The array of point objects.
 * @param {[number, number, number]} centerOffset - The offset used to center the geometry.
 * @param {Set<number>} selectedFaces - A set of indices of the selected faces.
 * @param {Map<number, Object>} labelMap - A map of labels for visibility checks.
 * @returns {THREE.BufferGeometry | null} The resulting highlight geometry.
 */
function createHighlightGeometry(hasMesh, faces, points, centerOffset, selectedFaces, labelMap) {
  if (!hasMesh || !faces || faces.length === 0 || !points || points.length === 0 || selectedFaces.size === 0) {
    return null;
  }

  const [centerX, centerY, centerZ] = centerOffset;
  const positions = new Float32Array(points.length * 3);
  points.forEach((point, index) => {
    const [x, y, z] = point.position;
    positions[index * 3] = x - centerX;
    positions[index * 3 + 1] = y - centerY;
    positions[index * 3 + 2] = z - centerZ;
  });

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const indices = [];
  selectedFaces.forEach(faceIndex => {
    const face = faces[faceIndex];
    const label = face.labelId ? labelMap.get(face.labelId) : null;
    if (label && label.visible === false) {
      return; // Skip faces of hidden labels
    }

    const faceIndices = face.indices || face;
    if (faceIndices.length >= 3) {
      for (let i = 1; i < faceIndices.length - 1; i++) {
        indices.push(faceIndices[0], faceIndices[i], faceIndices[i + 1]);
      }
    }
  });

  if (indices.length === 0) return null;

  geom.setIndex(indices);
  geom.computeVertexNormals();

  return geom;
}

/**
 * A custom hook that creates and memoizes mesh-related geometries.
 * @returns {{labelMeshGeometry: THREE.BufferGeometry, highlightGeometry: THREE.BufferGeometry}}
 */
export function useMeshGeometries({ hasMesh, faces, points, centerOffset, selectedFaces, labelMap }) {
  const labelMeshGeometry = useMemo(() => 
    createLabelMeshGeometry(hasMesh, faces, points, centerOffset), 
    [hasMesh, faces, points, centerOffset]
  );

  const highlightGeometry = useMemo(() => 
    createHighlightGeometry(hasMesh, faces, points, centerOffset, selectedFaces, labelMap), 
    [hasMesh, faces, points, centerOffset, selectedFaces, labelMap]
  );

  return { labelMeshGeometry, highlightGeometry };
}
