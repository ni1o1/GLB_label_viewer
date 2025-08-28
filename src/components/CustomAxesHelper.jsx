import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useThree, extend } from '@react-three/fiber';
import { Text } from '@react-three/drei';

// Custom coordinate axis component
const CustomAxesHelper = ({ size = 100 }) => {
  const { scene } = useThree();
  const groupRef = useRef();

  useEffect(() => {
    if (!groupRef.current) return;

    const group = groupRef.current;
    
    // Remove previous child objects
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    // Create materials
    const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 }); // Red X-axis
    const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00 }); // Green Y-axis  
    const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff }); // Blue Z-axis

    // Create axis geometries
    const createAxis = (direction, material) => {
      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([
        0, 0, 0,
        direction[0] * size, direction[1] * size, direction[2] * size
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      return new THREE.Line(geometry, material);
    };

    // Create arrow head geometries
    const createArrowHead = (direction, material, position) => {
      const arrowGeometry = new THREE.ConeGeometry(size * 0.02, size * 0.1, 8);
      const arrow = new THREE.Mesh(arrowGeometry, new THREE.MeshBasicMaterial({ color: material.color }));
      
      // Set arrow position
      arrow.position.copy(position);
      
      // Set arrow direction
      const up = new THREE.Vector3(0, 1, 0);
      const targetDirection = new THREE.Vector3(...direction);
      arrow.quaternion.setFromUnitVectors(up, targetDirection);
      
      return arrow;
    };

    // Adjusted coordinate system: Z-axis down, Y-axis forward, X-axis right
    // X-axis: red, pointing right (1, 0, 0)
    const xAxis = createAxis([1, 0, 0], xMaterial);
    const xArrow = createArrowHead([1, 0, 0], xMaterial, new THREE.Vector3(size, 0, 0));
    
    // Y-axis: green, pointing forward (0, 0, -1) - note that in Three.js negative Z is forward
    const yAxis = createAxis([0, 0, -1], yMaterial);
    const yArrow = createArrowHead([0, 0, -1], yMaterial, new THREE.Vector3(0, 0, -size));
    
    // Z-axis: blue, pointing down (0, -1, 0)
    const zAxis = createAxis([0, -1, 0], zMaterial);
    const zArrow = createArrowHead([0, -1, 0], zMaterial, new THREE.Vector3(0, -size, 0));

    // Add to group
    group.add(xAxis);
    group.add(xArrow);
    group.add(yAxis);
    group.add(yArrow);
    group.add(zAxis);
    group.add(zArrow);

  }, [size]);

  return (
    <group ref={groupRef}>
      {/* X-axis label - red */}
      <Text
        position={[size * 1.15, 0, 0]}
        fontSize={size * 0.06}
        color="#ff0000"
        anchorX="center"
        anchorY="middle"
      >
        X
      </Text>
      
      {/* Y-axis label - green, position adjusted to forward direction */}
      <Text
        position={[0, 0, -size * 1.15]}
        fontSize={size * 0.06}
        color="#00ff00"
        anchorX="center"
        anchorY="middle"
      >
        Y
      </Text>
      
      {/* Z-axis label - blue, now pointing down */}
      <Text
        position={[0, -size * 1.15, 0]}
        fontSize={size * 0.06}
        color="#0000ff"
        anchorX="center"
        anchorY="middle"
      >
        Z
      </Text>
    </group>
  );
};

export default CustomAxesHelper;