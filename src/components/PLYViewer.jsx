import React, { useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { useAnnotation } from '../store/annotationStore';

// Import subcomponents (assuming paths remain unchanged)
import ModelViewer from './ModelViewer';
import FileUploadOverlay from './FileUploadOverlay';
import CustomAxesHelper from './CustomAxesHelper';
import { calculateSelectedFaces } from '../utils/selectionUtils';

// --- Optimization 1: Component function comments ---
/**
 * Camera controller, automatically adjusts the camera to the best viewing position when point cloud data is loaded or changed.
 * @param {object} props
 * @param {Array} props.points - Point cloud data
 * @param {React.RefObject} props.controlsRef - OrbitControls reference
 * @param {Function} props.onCameraReady - Callback to signal when the camera is set.
 */
const CameraController = ({ points, controlsRef, onCameraReady, shouldResetCamera }) => {
  const { camera } = useThree();

  useEffect(() => {
    // Only execute when point cloud data is valid and camera reset is needed
    if (!points || points.length === 0 || !shouldResetCamera) return;

    // --- Optimization 2: Simplify camera target calculation ---
    // Assume ModelViewer has already translated the point cloud's geometric center to world origin (0, 0, 0).
    // Therefore, we only need to calculate the bounding box range without recalculating the center.
    const boundingBox = new THREE.Box3();
    const pointVector = new THREE.Vector3();

    points.forEach(p => {
      pointVector.set(p.position[0], p.position[1], p.position[2]);
      boundingBox.expandByPoint(pointVector);
    });
    
    const size = boundingBox.getSize(new THREE.Vector3());
    const maxRange = Math.max(size.x, size.y, size.z);
    
    // Set camera focus target to world origin
    const target = new THREE.Vector3(0, 0, 0);

    // --- Preserved core logic: camera distance and position ---
    // This distance calculation and camera position setting are retained as they're satisfactory.
    const distance = Math.max(maxRange * 2, 150);
    
    // Set appropriate viewing angle: slightly right, up, and back
    camera.position.set(
      target.x + distance * 0.8,  // X-axis: slightly right
      target.y + distance * 1.2,  // Y-axis: up
      target.z - distance * 0.6   // Z-axis: slightly back
    );

    // Always look at target point
    camera.lookAt(target);

    // Dynamically adjust camera far clipping plane to prevent large models from being clipped
    camera.near = 0.1;
    camera.far = distance * 10;
    camera.updateProjectionMatrix();

    // Update orbit controller target to ensure correct rotation and zoom center
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }

    // Signal that the camera is ready
    if (onCameraReady) {
      onCameraReady();
    }

  }, [points, camera, controlsRef, onCameraReady, shouldResetCamera]); // Add shouldResetCamera dependency

  return null;
};

/**
 * Coordinate system transformer, converts three.js default Y-up coordinate system to Z-down.
 * More intuitive for certain engineering or robotics point cloud data.
 */
const CoordinateSystemWrapper = ({ children }) => {
  // Rotate -90 degrees around X-axis, making Y-axis forward and Z-axis downward
  return <group rotation-x={-Math.PI / 2}>{children}</group>;
};

/**
 * Transformable point cloud component, encapsulates point cloud scene and transform controls.
 * Allows users to translate and rotate point cloud via Gizmo or keyboard shortcuts.
 * @param {object} props
 * @param {React.RefObject} props.orbitControlsRef - OrbitControls reference for disabling/enabling camera control during transformation
 */
const TransformablePointCloud = React.forwardRef(({ points, pointSize, viewMode, labels, orientationMode, orbitControlsRef }, ref) => {
  const { state, dispatch } = useAnnotation();
  const { pointCloudRotation, transformMode, pointCloudPosition } = state;
  const groupRef = useRef();

  // Sync point cloud pose (position and rotation) from store
  useEffect(() => {
    if (groupRef.current) {
      if (pointCloudPosition) groupRef.current.position.fromArray(pointCloudPosition);
      if (pointCloudRotation) groupRef.current.quaternion.fromArray(pointCloudRotation);
    }
  }, [pointCloudPosition, pointCloudRotation]);

  // --- Optimization 5: Add comments explaining shortcut keys ---
  useEffect(() => {
    if (!orientationMode) return;
    const handleKeyDown = (event) => {
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
      
      // 'W' key switches to translate mode
      if (event.key.toLowerCase() === 'w') {
        dispatch({ type: 'SET_TRANSFORM_MODE', payload: 'translate' });
      // 'E' key switches to rotate mode
      } else if (event.key.toLowerCase() === 'e') {
        dispatch({ type: 'SET_TRANSFORM_MODE', payload: 'rotate' });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [orientationMode, dispatch]);

  // Use useImperativeHandle to expose groupRef to parent component
  React.useImperativeHandle(ref, () => groupRef.current, []);

  return (
    <>
      <group ref={groupRef}>
        <ModelViewer
          points={points}
          pointSize={pointSize}
          viewMode={viewMode}
          labels={labels}
        />
      </group>
    </>
  );
});


/**
 * Main viewport component that integrates all 3D scene elements and UI overlays.
 */
const PLYViewer = () => {
  const { state, dispatch } = useAnnotation();
  // Destructure all required states from state management
  const { 
    points, pointSize, viewMode, labels, annotationBox, backgroundColor, 
    orientationMode, editorMode, hasMesh, faces, selectedPoints, 
    meshSelectionMode, selectedFaces, isManualFaceSelection, transformMode, showGridAndAxes,
    isNewFileLoaded 
  } = state;
  const controlsRef = useRef();
  const pointCloudRef = useRef();
  const [isCameraReady, setCameraReady] = React.useState(false);
  const [shouldResetCamera, setShouldResetCamera] = React.useState(false);

  // --- TransformControls handling logic ---
  const transformHandlers = useMemo(() => ({
    // Continuously triggered when transform controller is being dragged
    onObjectChange: () => {
      if (!pointCloudRef.current) return;
      if (transformMode === 'rotate') {
        dispatch({ type: 'SET_POINT_CLOUD_ROTATION', payload: pointCloudRef.current.quaternion.toArray() });
      } else if (transformMode === 'translate') {
        dispatch({ type: 'SET_POINT_CLOUD_POSITION', payload: pointCloudRef.current.position.toArray() });
      }
    },
    // Disable camera controls when mouse is pressed on transform controller to prevent conflicts
    onMouseDown: () => {
      if (controlsRef.current) controlsRef.current.enabled = false;
    },
    // Re-enable camera controls when mouse is released
    onMouseUp: () => {
      if (controlsRef.current) controlsRef.current.enabled = true;
    },
  }), [transformMode, dispatch]);

  // --- Core annotation logic: convert selected points to selected faces ---
  // When selected points or selection mode changes, recalculate selected faces
  useEffect(() => {
    // Skip automatic calculation if manually selecting faces (e.g. inverse selection)
    if (isManualFaceSelection) return;

    // Ensure face selection is empty if no mesh data is available
    if (!hasMesh || !faces || faces.length === 0) {
      if (selectedFaces.size > 0) {
        dispatch({ type: 'UPDATE_SELECTED_FACES', payload: new Set() });
      }
      return;
    }

    // Use utility function to calculate new selected faces
    const newSelectedFaces = calculateSelectedFaces(faces, labels, selectedPoints, meshSelectionMode);

    // 仅在计算出的新面片集合与旧集合不同时，才派发更新动作，避免不必要的重渲染。
    if (newSelectedFaces.size !== selectedFaces.size || ![...newSelectedFaces].every(faceIndex => selectedFaces.has(faceIndex))) {
      dispatch({ type: 'UPDATE_SELECTED_FACES', payload: newSelectedFaces });
    }
  }, [hasMesh, faces, labels, selectedPoints, meshSelectionMode, dispatch, selectedFaces, isManualFaceSelection]);

  // 只有在真正加载新文件时才重置摄像头
  useEffect(() => {
    if (isNewFileLoaded && points && points.length > 0) {
      setCameraReady(false);
      setShouldResetCamera(true);
    }
  }, [isNewFileLoaded, points]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        // Camera position is now managed by CameraController, removing the hardcoded position to prevent the "jump".
        camera={{ fov: 60, near: 0.1, far: 100000 }}
        gl={{ outputColorSpace: 'srgb', toneMapping: THREE.NoToneMapping }}
        style={{ background: backgroundColor, width: '100%', height: '100%' }}
      >
        {/* 光照设置保持不变 */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 5]} intensity={0.5} />
        <directionalLight position={[-10, -20, -5]} intensity={0.3} />

        {/* 应用Z轴向下的坐标系变换 */}
        <CoordinateSystemWrapper>
          {points.length > 0 && (
            <>
              {/* CameraController now signals when it's ready */}
              <CameraController 
                points={points} 
                controlsRef={controlsRef} 
                onCameraReady={() => {
                  setCameraReady(true);
                  setShouldResetCamera(false); // 重置完成后，关闭重置标志
                  dispatch({ type: 'RESET_NEW_FILE_FLAG' }); // 重置新文件标志
                }} 
                shouldResetCamera={shouldResetCamera}
              />
              
              {/* Render the main scene only when the camera is positioned */}
              {isCameraReady && (
                <>
                  <TransformablePointCloud 
                    ref={pointCloudRef}
                    points={points} 
                    pointSize={pointSize} 
                    viewMode={viewMode}
                    labels={labels}
                    orientationMode={orientationMode}
                    orbitControlsRef={controlsRef}
                  />
                </>
              )}
            </>
          )}
          {/* 将地面网格也放入坐标系转换器中，使其与点云的 "地面" 对齐 */}
          {showGridAndAxes && <gridHelper args={[50, 50]} />}
        </CoordinateSystemWrapper>
        
        <OrbitControls 
          ref={controlsRef}
          makeDefault // 将此控件设为默认，可以响应输入事件
          // --- 优化点 8: 简化并明确相机目标 ---
          // 由于点云已被中心化到 (0,0,0)，目标也应设为 (0,0,0)
          target={[0, 0, 0]}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE, // 左键旋转
            MIDDLE: THREE.MOUSE.DOLLY, // 中键缩放
            RIGHT: null, // 禁用右键旋转，为其他功能保留
          }}
        />
        
        {/* TransformControls 放在外部，与坐标轴保持一致 */}
        {orientationMode && pointCloudRef.current && (
          <TransformControls
            object={pointCloudRef.current}
            mode={transformMode}
            size={0.8}
            onObjectChange={transformHandlers.onObjectChange}
            onMouseDown={transformHandlers.onMouseDown}
            onMouseUp={transformHandlers.onMouseUp}
          />
        )}
        
        {/* 自定义坐标轴助手，放在外部，不受坐标系变换影响，始终显示世界坐标 */}
        {showGridAndAxes && <CustomAxesHelper size={100} />}
      </Canvas>
 
      {/* UI 覆盖层 */}
      {points.length > 0 ? (
        <>
        </>
      ) : (
        <FileUploadOverlay />
      )}
    </div>
  );
};

export default PLYViewer;