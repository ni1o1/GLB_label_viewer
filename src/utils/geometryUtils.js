export function isPointInBox(point, box) {
  const [x, y, z] = point;
  const [centerX, centerY, centerZ] = box.position;
  const [width, height, depth] = box.size;

  const minX = centerX - width / 2;
  const maxX = centerX + width / 2;
  const minY = centerY - height / 2;
  const maxY = centerY + height / 2;
  const minZ = centerZ - depth / 2;
  const maxZ = centerZ + depth / 2;

  return x >= minX && x <= maxX &&
         y >= minY && y <= maxY &&
         z >= minZ && z <= maxZ;
}

export function calculateBoundingBox(points) {
  if (points.length === 0) {
    return {
      min: [0, 0, 0],
      max: [1, 1, 1],
      center: [0.5, 0.5, 0.5]
    };
  }

  // Optimization: calculate bounds in single traversal
  const firstPos = points[0].position;
  let minX = firstPos[0], maxX = firstPos[0];
  let minY = firstPos[1], maxY = firstPos[1];
  let minZ = firstPos[2], maxZ = firstPos[2];

  for (let i = 1; i < points.length; i++) {
    const pos = points[i].position;
    const x = pos[0], y = pos[1], z = pos[2];
    
    if (x < minX) minX = x;
    else if (x > maxX) maxX = x;
    
    if (y < minY) minY = y;
    else if (y > maxY) maxY = y;
    
    if (z < minZ) minZ = z;
    else if (z > maxZ) maxZ = z;
  }

  const min = [minX, minY, minZ];
  const max = [maxX, maxY, maxZ];
  const center = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2
  ];

  return { min, max, center };
}