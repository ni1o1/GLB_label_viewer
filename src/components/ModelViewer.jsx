// ModelViewer.jsx

import React, { useMemo, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useAnnotation } from '../store/annotationStore';
import { useProcessedGeometries } from '../hooks/useProcessedGeometries';

/**
 * Label View Component - Dedicated to rendering content in label mode
 */
const LabelView = React.memo(({ 
  pointCloudGeometry, 
  labelMeshGeometry, 
  highlightGeometry,
}) => {
  // Fetch required state directly from the store
  const { state } = useAnnotation();
  const { 
    pointSize, 
    meshOpacity, 
    isPointCloudVisible, 
    isMeshVisible, 
    hasMesh,
    activeLabel,
    showWireframe,
    labels // for labelMap
  } = state;

  const labelMap = useMemo(() => {
    const map = new Map();
    labels.forEach(label => map.set(label.id, label));
    return map;
  }, [labels]);

  const highlightColor = useMemo(() => {
    if (activeLabel && activeLabel > 0) {
      const label = labelMap.get(activeLabel);
      if (label) {
        const color = new THREE.Color(label.color);
        color.multiplyScalar(0.7);
        return color;
      }
    }
    return 0xff4444;
  }, [activeLabel, labelMap]);

  return (
    <>
      {isPointCloudVisible && pointCloudGeometry && (
        <points geometry={pointCloudGeometry}>
          <pointsMaterial
            size={pointSize}
            vertexColors
            sizeAttenuation={false}
            transparent
            opacity={1.0}
            alphaTest={0.5}
          />
        </points>
      )}

      {hasMesh && isMeshVisible && labelMeshGeometry && (
        <>
          <mesh geometry={labelMeshGeometry}>
            <meshStandardMaterial
              vertexColors
              side={THREE.DoubleSide}
              transparent
              opacity={meshOpacity}
              roughness={0.6}
              metalness={0.0}
              alphaTest={0.01}
            />
          </mesh>
          {showWireframe && (
            <mesh geometry={labelMeshGeometry}>
              <meshBasicMaterial
                color={0x000000}
                wireframe
                transparent
                opacity={0.3}
              />
            </mesh>
          )}
        </>
      )}

      {hasMesh && isMeshVisible && highlightGeometry && (
        <mesh geometry={highlightGeometry}>
          <meshBasicMaterial
            color={highlightColor}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </>
  );
});

/**
 * Default View Component - Dedicated to rendering content in default/texture mode
 */
const DefaultView = React.memo(({ 
  centerOffset, 
  pointCloudGeometry, 
  fallbackMeshGeometry, 
  highlightGeometry,
}) => {
  // Fetch required state directly from the store
  const { state } = useAnnotation();
  const { 
    pointSize, 
    meshOpacity, 
    isPointCloudVisible, 
    isMeshVisible, 
    hasMesh,
    activeLabel,
    showWireframe,
    originalScene,
    labels, // for labelMap
    materials,
    fileHeader
  } = state;

  const labelMap = useMemo(() => {
    const map = new Map();
    labels.forEach(label => map.set(label.id, label));
    return map;
  }, [labels]);

  const scenePosition = useMemo(() => [-centerOffset[0], -centerOffset[1], -centerOffset[2]], [centerOffset]);

  const highlightColor = useMemo(() => {
    if (activeLabel && activeLabel > 0) {
      const label = labelMap.get(activeLabel);
      if (label) {
        return new THREE.Color(label.color).multiplyScalar(0.7);
      }
    }
    return 0xff4444;
  }, [activeLabel, labelMap]);

  const createMaterialFromMTL = useMemo(() => {
    if (!materials && !fileHeader?.textureFile) return null;
    return new Map();
  }, [materials, fileHeader]);

  const defaultMaterial = useMemo(() => 
    createMaterialFromMTL?.get('default'), [createMaterialFromMTL]);

  return (
    <>
      {isMeshVisible && (
        originalScene ? (
          <group position={scenePosition}>
            <primitive object={originalScene} />
          </group>
        ) : (
          hasMesh && fallbackMeshGeometry && (
            <>
              <mesh geometry={fallbackMeshGeometry}>
                <meshStandardMaterial
                  map={defaultMaterial?.map || null}
                  vertexColors={!defaultMaterial?.map}
                  side={THREE.DoubleSide}
                  transparent={meshOpacity < 1.0}
                  opacity={meshOpacity}
                  roughness={0.6}
                  metalness={0.0}
                />
              </mesh>
              {showWireframe && (
                <mesh geometry={fallbackMeshGeometry}>
                  <meshBasicMaterial
                    color={0x000000}
                    wireframe
                    transparent
                    opacity={0.3}
                  />
                </mesh>
              )}
            </>
          )
        )
      )}

      {isPointCloudVisible && pointCloudGeometry && (
        <points geometry={pointCloudGeometry}>
          <pointsMaterial
            size={pointSize * 0.3}
            vertexColors
            sizeAttenuation={false}
            transparent
            opacity={0.5}
            alphaTest={0.5}
          />
        </points>
      )}

      {hasMesh && isMeshVisible && highlightGeometry && (
        <mesh geometry={highlightGeometry}>
          <meshBasicMaterial
            color={highlightColor}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
            polygonOffset
            polygonOffsetFactor={-1.0}
            polygonOffsetUnits={-1.0}
          />
        </mesh>
      )}
    </>
  );
});

/**
 * ModelViewer - Unified 3D model renderer
 * Supports rendering of point clouds, PLY meshes, GLB scenes and other formats
 * Intelligently switches rendering strategies based on viewMode
 */
const ModelViewer = React.memo(({ points, viewMode, labels }) => {
  const { state, dispatch } = useAnnotation();
  
  const { 
    pointCloudRotation, 
    originalScene,
    faces,
    interactionMapping,
  } = state;

  const {
    pointCloudGeometry,
    labelMeshGeometry,
    highlightGeometry,
    centerOffset,
  } = useProcessedGeometries({
    points,
    faces: state.faces,
    labels,
    viewMode,
    selectedPoints: state.selectedPoints,
    selectedFaces: state.selectedFaces,
    colorAdjustment: state.colorAdjustment,
    activeLabel: state.activeLabel,
    hasMesh: state.hasMesh,
    dispatch
  });

  // Control original scene transparency
  useEffect(() => {
    if (originalScene && viewMode !== 'labels') {
      originalScene.traverse((child) => {
        if (child.isMesh && child.material) {
          const materials = Array.isArray(child.material) ? child.material : [child.material];
          materials.forEach(material => {
            material.transparent = state.meshOpacity < 1.0;
            material.opacity = state.meshOpacity;
            material.needsUpdate = true;
          });
        }
      });
    }
  }, [state.meshOpacity, originalScene, viewMode]);

  // --- Optimized Wireframe Control Logic ---
  const WIREFRAME_NAME = 'wireframe'; // Use constant to avoid magic strings

  // Effect 1: Responsible for creating wireframe when model loads, and destroying when unloading.
  // This effect only runs once when `originalScene` changes.
  useEffect(() => {
    if (!originalScene) return;

    // Create a shared material for all wireframes to improve efficiency
    const wireframeMaterial = new THREE.LineBasicMaterial({ 
      color: 0x000000, 
      transparent: true, 
      opacity: 0.5 
    });

    originalScene.traverse((child) => {
      // Only create wireframe for objects that are isMesh and don't have wireframe child objects
      if (child.isMesh && !child.getObjectByName(WIREFRAME_NAME)) {
        const edges = new THREE.EdgesGeometry(child.geometry);
        const wireframe = new THREE.LineSegments(edges, wireframeMaterial);
        wireframe.name = WIREFRAME_NAME;
        child.add(wireframe);
      }
    });

    // Cleanup function: Only executes when originalScene changes or component unmounts
    return () => {
      if (originalScene) {
        originalScene.traverse((child) => {
          if (child.isMesh) {
            const wireframe = child.getObjectByName(WIREFRAME_NAME);
            if (wireframe) {
              child.remove(wireframe);
              wireframe.geometry.dispose();
            }
          }
        });
      }
      // Dispose shared material
      wireframeMaterial.dispose();
    };
  }, [originalScene]); // Dependency is only originalScene

  // Effect 2: Responsible for quickly toggling visibility based on showWireframe state.
  // This effect has very low execution cost.
  useEffect(() => {
    if (!originalScene) return;

    originalScene.traverse((child) => {
      if (child.isMesh) {
        const wireframe = child.getObjectByName(WIREFRAME_NAME);
        if (wireframe) {
          wireframe.visible = state.showWireframe;
        }
      }
    });
  }, [originalScene, state.showWireframe]); // Depends on showWireframe

  // Control label visibility in original scene
  const updateLabelVisibility = useCallback(() => {
    if (!originalScene || !faces || !interactionMapping) return;

    const labelVisibilityMap = new Map();
    labels.forEach(label => {
      labelVisibilityMap.set(label.id, label.visible !== false);
    });

    originalScene.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      
      const faceRange = interactionMapping.meshToFaceRange.get(child.uuid);
      if (!faceRange) return;

      const geometry = child.geometry;
      if (!geometry.attributes.position) return;

      if (!geometry.userData.originalIndex && geometry.index?.array) {
        geometry.userData.originalIndex = geometry.index.array.slice();
      }

      const visibleIndices = [];
      
      if (geometry.index) {
        let originalIndices = geometry.userData.originalIndex || geometry.index.array;
        if (!originalIndices?.length) return;
        
        for (let i = 0; i < originalIndices.length; i += 3) {
          const faceIndex = Math.floor(i / 3) + faceRange.start;
          const face = faces[faceIndex];
          
          if (face?.labelId) {
            if (labelVisibilityMap.get(face.labelId) !== false) {
              visibleIndices.push(originalIndices[i], originalIndices[i + 1], originalIndices[i + 2]);
            }
          } else {
            visibleIndices.push(originalIndices[i], originalIndices[i + 1], originalIndices[i + 2]);
          }
        }
      } else {
        const vertexCount = geometry.attributes.position.count;
        for (let i = 0; i < vertexCount; i += 3) {
          const faceIndex = Math.floor(i / 3) + faceRange.start;
          const face = faces[faceIndex];
          
          if (face?.labelId) {
            if (labelVisibilityMap.get(face.labelId) !== false) {
              visibleIndices.push(i, i + 1, i + 2);
            }
          } else {
            visibleIndices.push(i, i + 1, i + 2);
          }
        }
      }

      if (visibleIndices.length > 0) {
        geometry.setIndex(visibleIndices);
        child.visible = true;
      } else {
        child.visible = false;
      }
      
      geometry.computeVertexNormals();
    });
  }, [originalScene, labels, interactionMapping, faces]);

  useEffect(() => {
    updateLabelVisibility();
  }, [updateLabelVisibility]);

  return (
    <group rotation={pointCloudRotation}>
      {viewMode === 'labels' ? (
        <LabelView
          pointCloudGeometry={pointCloudGeometry}
          labelMeshGeometry={labelMeshGeometry}
          highlightGeometry={highlightGeometry}
        />
      ) : (
        <DefaultView
          centerOffset={centerOffset}
          pointCloudGeometry={pointCloudGeometry}
          fallbackMeshGeometry={labelMeshGeometry}
          highlightGeometry={highlightGeometry}
        />
      )}
    </group>
  );
});

export default ModelViewer;