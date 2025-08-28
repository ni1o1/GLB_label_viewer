/**
 * Normalize color values from 0-255 range or 0-1 float range to [0, 1].
 * @param {number} value - Input color channel value.
 * @returns {number} - Normalized value.
 */
const normalizeColorValue = (value) => {
  const normalized = value > 1 ? value * 0.00392156862745098 : value; // 1/255 = 0.00392156862745098
  return normalized < 0 ? 0 : normalized > 1 ? 1 : normalized;
};

// Data type lookup table to avoid repeated string comparisons
const DATA_TYPE_MAP = {
  'char': { reader: 'getInt8', size: 1 },
  'uchar': { reader: 'getUint8', size: 1 },
  'short': { reader: 'getInt16', size: 2 },
  'ushort': { reader: 'getUint16', size: 2 },
  'int': { reader: 'getInt32', size: 4 },
  'uint': { reader: 'getUint32', size: 4 },
  'float': { reader: 'getFloat32', size: 4 },
  'float32': { reader: 'getFloat32', size: 4 },
  'double': { reader: 'getFloat64', size: 8 },
  'float64': { reader: 'getFloat64', size: 8 }
};

/**
 * Read a value from DataView by specified type.
 * @param {DataView} dataView - Data view.
 * @param {string} type - Data type.
 * @param {number} offset - Current byte offset.
 * @param {boolean} littleEndian - Whether little-endian.
 * @returns {{value: number, newOffset: number}} - Object containing the read value and new offset.
 */
const readDataValue = (dataView, type, offset, littleEndian = true) => {
  const typeInfo = DATA_TYPE_MAP[type.toLowerCase()];
  if (!typeInfo) {
    return { value: 0, newOffset: offset };
  }
  
  const { reader, size } = typeInfo;
  const value = size === 1 ? dataView[reader](offset) : dataView[reader](offset, littleEndian);
  return { value, newOffset: offset + size };
};


/**
 * Main function to parse PLY files.
 * @param {ArrayBuffer} buffer - Binary content of PLY file.
 * @param {Map<string, any>} materialMap - Preloaded material or texture data mapping.
 * @returns {object | null} Parsed result object containing vertices, faces, materials, etc.
 */
export function parsePLY(buffer, materialMap = new Map()) {
  const decoder = new TextDecoder();
  const headerChunk = buffer.slice(0, 4096); 
  const headerText = decoder.decode(headerChunk);
  const lines = headerText.split('\n');
  
  let isBinary = false;
  let vertexCount = 0;
  let faceCount = 0;
  let headerEndIndex = -1;
  const properties = [];
  const faceProperties = [];
  let format = '';
  let version = '';
  const comments = [];
  let currentElement = null;
  
  // 1. Parse the PLY file header
  for (let i = 0, len = lines.length; i < len; i++) {
    const line = lines[i].trim();
    if (line === 'end_header') {
      headerEndIndex = i + 1;
      break;
    }
    
    const parts = line.split(/\s+/);
    const command = parts[0];
    
    switch (command) {
      case 'format':
        format = parts[1];
        version = parts[2];
        isBinary = format.startsWith('binary');
        break;
      case 'element':
        currentElement = parts[1];
        const count = parseInt(parts[2]);
        if (currentElement === 'vertex') {
          vertexCount = count;
        } else if (currentElement === 'face') {
          faceCount = count;
        }
        break;
      case 'property':
        const property = { name: parts[parts.length - 1], type: parts[1] };
        if (property.type === 'list') {
          property.countType = parts[2];
          property.itemType = parts[3];
        }
        (currentElement === 'vertex' ? properties : faceProperties).push(property);
        break;
      case 'comment':
        comments.push(line.substring(8).trim());
        break;
    }
  }

  if (headerEndIndex === -1) {
    throw new Error('PLY header parsing failed: "end_header" not found');
  }

  // 2. Choose appropriate parser based on format (binary or ASCII)
  let result;
  if (isBinary) {
    const fullHeaderText = lines.slice(0, headerEndIndex).join('\n') + '\n';
    const dataOffset = new TextEncoder().encode(fullHeaderText).byteLength;
    result = parseBinaryPLY(buffer, vertexCount, faceCount, properties, faceProperties, dataOffset);
  } else {
    const fullText = decoder.decode(buffer);
    const allLines = fullText.split('\n');
    result = parseAsciiPLY(allLines, vertexCount, faceCount, properties, faceProperties, headerEndIndex);
  }

  // 3. Extract texture and label metadata from comments
  let textureFile = null;
  const labelDefinitions = {};
  
  for (const comment of comments) {
    const lowerComment = comment.toLowerCase();
    if (lowerComment.includes('texturefile')) {
      const parts = comment.split(/\s+/);
      const tfIndex = parts.findIndex(p => p.toLowerCase() === 'texturefile');
      if (tfIndex !== -1 && tfIndex + 1 < parts.length) {
        textureFile = parts[tfIndex + 1];
      }
    } else if (lowerComment.startsWith('label')) {
      const parts = comment.split(/\s+/);
      if (parts.length >= 3) {
        const labelId = parseInt(parts[1]);
        if (!isNaN(labelId)) {
          labelDefinitions[labelId] = parts.slice(2).join(' ');
        }
      }
    }
  }

  if (textureFile && materialMap.has(textureFile)) {
    materialMap.set('default', {
      name: 'default',
      textureFile,
      data: materialMap.get(textureFile)
    });
  }

  // 4. Generate label statistics and counts
  const labelStats = {};
  let labeledCount = 0;
  const { points, faces } = result;
  
  for (const point of points) {
    if (point.labelId !== undefined && point.labelId !== null) {
      labeledCount++;
      labelStats[point.labelId] = (labelStats[point.labelId] || 0) + 1;
    }
  }

  const faceLabelStats = {};
  let labeledFaceCount = 0;
  if (faces) {
    for (const face of faces) {
      if (face.labelId !== undefined && face.labelId !== null && face.labelId !== -1) {
        labeledFaceCount++;
        faceLabelStats[face.labelId] = (faceLabelStats[face.labelId] || 0) + 1;
      }
    }
  }

  // 5. Construct and return the parsed result object
  return {
    points,
    faces,
    materials: materialMap.size > 0 ? Object.fromEntries(materialMap) : null,
    textureFile,
    labelDefinitions,
    header: {
      format,
      version,
      vertexCount,
      faceCount,
      properties,
      faceProperties,
      comments
    },
    fields: properties.map(p => p.name),
    labelInfo: {
      labeledCount,
      unlabeledCount: points.length - labeledCount,
      labelStats,
      faceLabeledCount: labeledFaceCount,
      faceUnlabeledCount: faces ? faces.length - labeledFaceCount : 0,
      faceLabelStats
    }
  };
}

/**
 * Parse ASCII format PLY data.
 * @param {string[]} lines - Array containing all lines.
 * @param {number} vertexCount - Total vertex count.
 * @param {number} faceCount - Total face count.
 * @param {object[]} properties - Vertex property definitions.
 * @param {object[]} faceProperties - Face property definitions.
 * @param {number} startLine - Line number where data starts.
 * @returns {{points: object[], faces: object[] | null}}
 */
const parseAsciiPLY = (lines, vertexCount, faceCount, properties, faceProperties, startLine) => {
  // 预分配数组大小以提高性能
  const points = new Array(vertexCount);
  
  // 创建属性索引映射
  const propMap = {};
  for (let i = 0; i < properties.length; i++) {
    propMap[properties[i].name.toLowerCase()] = i;
  }
  
  // 解析顶点数据
  for (let i = 0; i < vertexCount; i++) {
    const line = lines[startLine + i]?.trim();
    if (!line) continue;
    
    const values = line.split(/\s+/);
    const point = { position: [0, 0, 0], color: [1, 1, 1] };
    
    // 位置坐标
    const xIdx = propMap.x;
    const yIdx = propMap.y;
    const zIdx = propMap.z;
    if (xIdx !== undefined) point.position[0] = parseFloat(values[xIdx]);
    if (yIdx !== undefined) point.position[1] = parseFloat(values[yIdx]);
    if (zIdx !== undefined) point.position[2] = parseFloat(values[zIdx]);
    
    // 颜色
    const rIdx = propMap.red ?? propMap.r;
    const gIdx = propMap.green ?? propMap.g;
    const bIdx = propMap.blue ?? propMap.b;
    if (rIdx !== undefined) point.color[0] = normalizeColorValue(parseFloat(values[rIdx]));
    if (gIdx !== undefined) point.color[1] = normalizeColorValue(parseFloat(values[gIdx]));
    if (bIdx !== undefined) point.color[2] = normalizeColorValue(parseFloat(values[bIdx]));
    
    // 标签
    const labelIdx = propMap.label;
    if (labelIdx !== undefined) point.labelId = parseInt(values[labelIdx]);
    
    // 纹理坐标
    const sIdx = propMap.s;
    const tIdx = propMap.t;
    if (sIdx !== undefined || tIdx !== undefined) {
      point.textureCoords = [
        sIdx !== undefined ? parseFloat(values[sIdx]) : 0,
        tIdx !== undefined ? parseFloat(values[tIdx]) : 0
      ];
    }
    
    points[i] = point;
  }
  
  // 解析面数据
  let faces = null;
  if (faceCount > 0) {
    faces = new Array(faceCount);
    const faceStartLine = startLine + vertexCount;
    
    for (let i = 0; i < faceCount && (faceStartLine + i) < lines.length; i++) {
      const line = lines[faceStartLine + i]?.trim();
      if (!line) continue;
      
      const values = line.split(/\s+/);
      let valueIndex = 0;
      const face = { indices: [], labelId: null, textureCoords: null, color: null };
      
      for (const prop of faceProperties) {
        if (valueIndex >= values.length) break;
        
        if (prop.type === 'list') {
          const count = parseInt(values[valueIndex++]);
          const list = new Array(count);
          for (let k = 0; k < count; k++) {
            list[k] = parseInt(values[valueIndex++]);
          }
          
          if (prop.name === 'vertex_indices') {
            face.indices = list;
          } else if (prop.name === 'texcoord') {
            face.textureCoords = list;
          }
        } else {
          const value = values[valueIndex++];
          switch (prop.name) {
            case 'label':
              face.labelId = parseInt(value);
              break;
            case 'red':
              if (!face.color) face.color = [1, 1, 1];
              face.color[0] = normalizeColorValue(parseFloat(value));
              break;
            case 'green':
              if (!face.color) face.color = [1, 1, 1];
              face.color[1] = normalizeColorValue(parseFloat(value));
              break;
            case 'blue':
              if (!face.color) face.color = [1, 1, 1];
              face.color[2] = normalizeColorValue(parseFloat(value));
              break;
          }
        }
      }
      faces[i] = face;
    }
  }
  
  return { points, faces };
};

/**
 * Parse binary format PLY data.
 * @param {ArrayBuffer} buffer - Complete file buffer.
 * @param {number} vertexCount - Total vertex count.
 * @param {number} faceCount - Total face count.
 * @param {object[]} properties - Vertex property definitions.
 * @param {object[]} faceProperties - Face property definitions.
 * @param {number} dataOffset - Byte offset where data section starts.
 * @returns {{points: object[], faces: object[] | null}}
 */
const parseBinaryPLY = (buffer, vertexCount, faceCount, properties, faceProperties, dataOffset) => {
  const dataView = new DataView(buffer);
  let offset = dataOffset;
  const points = new Array(vertexCount);
  
  // 解析顶点数据
  for (let i = 0; i < vertexCount; i++) {
    const point = { position: [0, 0, 0], color: [1, 1, 1] };
    
    for (const prop of properties) {
      const result = readDataValue(dataView, prop.type, offset);
      const value = result.value;
      offset = result.newOffset;
      
      const propName = prop.name.toLowerCase();
      switch (propName) {
        case 'x': 
          point.position[0] = value; 
          break;
        case 'y': 
          point.position[1] = value; 
          break;
        case 'z': 
          point.position[2] = value; 
          break;
        case 'red': 
        case 'r': 
          point.color[0] = normalizeColorValue(value); 
          break;
        case 'green': 
        case 'g': 
          point.color[1] = normalizeColorValue(value); 
          break;
        case 'blue': 
        case 'b': 
          point.color[2] = normalizeColorValue(value); 
          break;
        case 'label': 
          point.labelId = value; 
          break;
        case 's':
          if (!point.textureCoords) point.textureCoords = [0, 0];
          point.textureCoords[0] = value;
          break;
        case 't':
          if (!point.textureCoords) point.textureCoords = [0, 0];
          point.textureCoords[1] = value;
          break;
      }
    }
    points[i] = point;
  }
  
  // 解析面数据
  let faces = null;
  if (faceCount > 0) {
    faces = new Array(faceCount);
    for (let i = 0; i < faceCount; i++) {
      const face = { indices: [], labelId: null, textureCoords: null, color: null };
      
      for (const prop of faceProperties) {
        if (prop.type === 'list') {
          const countResult = readDataValue(dataView, prop.countType, offset);
          const count = countResult.value;
          offset = countResult.newOffset;
          
          const list = new Array(count);
          for (let k = 0; k < count; k++) {
            const itemResult = readDataValue(dataView, prop.itemType, offset);
            list[k] = itemResult.value;
            offset = itemResult.newOffset;
          }
          
          if (prop.name === 'vertex_indices') {
            face.indices = list;
          } else if (prop.name === 'texcoord') {
            face.textureCoords = list;
          }
        } else {
          const result = readDataValue(dataView, prop.type, offset);
          const value = result.value;
          offset = result.newOffset;

          switch (prop.name) {
            case 'label': 
              face.labelId = value; 
              break;
            case 'red':
              if (!face.color) face.color = [1, 1, 1];
              face.color[0] = normalizeColorValue(value);
              break;
            case 'green':
              if (!face.color) face.color = [1, 1, 1];
              face.color[1] = normalizeColorValue(value);
              break;
            case 'blue':
              if (!face.color) face.color = [1, 1, 1];
              face.color[2] = normalizeColorValue(value);
              break;
          }
        }
      }
      faces[i] = face;
    }
  }
  
  return { points, faces };
};