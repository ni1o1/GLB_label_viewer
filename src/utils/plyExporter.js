import JSZip from 'jszip';

// exportPLY, exportSinglePLY, exportAsZip functions remain unchanged
export function exportPLY(points, originalFileName, faces = null, materials = null, textureFile = null, labels = [], header = null) {
  // Build PLY file content (calling optimized function)
  const plyContent = generatePLYContentOptimized(points, faces, textureFile, labels, header);

  const baseName = originalFileName ? originalFileName.replace(/\.ply$/i, '') : 'pointcloud';
  const suffix = faces && faces.length > 0 ? '_mesh_annotated' : '_annotated';

  if (materials && Object.keys(materials).length > 0) {
    exportAsZip(plyContent, baseName, suffix, materials);
  } else {
    exportSinglePLY(plyContent, baseName, suffix);
  }
}

/**
 * Optimized PLY content generation function
 */
export function generatePLYContentOptimized(points, faces, textureFile, labels = [], originalHeader = null) {
  const headerLines = ['ply', 'format ascii 1.0'];

  // 1. Build comments section
  const finalLabels = [...labels];
  const existingLabelIds = new Set(labels.map(l => l.id));

  // Add default labels (if not present)
  if (!existingLabelIds.has(-1)) finalLabels.push({ id: -1, name: 'unclassified' });
  if (!existingLabelIds.has(0)) finalLabels.push({ id: 0, name: 'unlabeled' });

  if (originalHeader && originalHeader.comments) {
    originalHeader.comments.forEach(comment => {
      // Filter out old label definitions, add them uniformly later
      if (!comment.toLowerCase().startsWith('label ')) {
        headerLines.push(`comment ${comment}`);
      }
    });
  } else if (textureFile) {
    headerLines.push(`comment TextureFile ${textureFile}`);
  }

  finalLabels.sort((a, b) => a.id - b.id).forEach(label => {
    headerLines.push(`comment label ${label.id} ${label.name}`);
  });

  // 2. Prepare property definitions (core optimization: unified property handling logic)
  // -- 顶点属性 --
  let vertexProperties = [];
  const hasLabeledPoints = points.some(p => p.labelId !== null && p.labelId !== undefined);

  if (originalHeader && originalHeader.properties) {
    vertexProperties = [...originalHeader.properties];
    const hasLabelProp = vertexProperties.some(p => p.name === 'label');
    if (hasLabeledPoints && !hasLabelProp) {
      vertexProperties.push({ type: 'int', name: 'label' });
    }
  } else {
    vertexProperties = [
      { type: 'float', name: 'x' },
      { type: 'float', name: 'y' },
      { type: 'float', name: 'z' },
      { type: 'uchar', name: 'red' },
      { type: 'uchar', name: 'green' },
      { type: 'uchar', name: 'blue' },
      { type: 'int', name: 'label' },
    ];
  }

  // -- 面片属性 --
  let faceProperties = [];
  const hasFaces = faces && faces.length > 0;
  if (hasFaces) {
    const hasLabeledFaces = faces.some(f => f.labelId !== null && f.labelId !== undefined);
    if (originalHeader && originalHeader.faceProperties) {
      faceProperties = [...originalHeader.faceProperties];
      const hasLabelProp = faceProperties.some(p => p.name === 'label');
      if (hasLabeledFaces && !hasLabelProp) {
        faceProperties.push({ type: 'int', name: 'label' });
      }
    } else {
      faceProperties = [
        { type: 'list', countType: 'uchar', itemType: 'int', name: 'vertex_indices' },
        { type: 'int', name: 'label' },
      ];
    }
  }

  // 3. Build header string
  headerLines.push(`element vertex ${points.length}`);
  vertexProperties.forEach(prop => {
    if (prop.type === 'list') {
      headerLines.push(`property list ${prop.countType} ${prop.itemType} ${prop.name}`);
    } else {
      headerLines.push(`property ${prop.type} ${prop.name}`);
    }
  });

  if (hasFaces) {
    headerLines.push(`element face ${faces.length}`);
    faceProperties.forEach(prop => {
      if (prop.type === 'list') {
        headerLines.push(`property list ${prop.countType} ${prop.itemType} ${prop.name}`);
      } else {
        headerLines.push(`property ${prop.type} ${prop.name}`);
      }
    });
  }

  headerLines.push('end_header');

  // 4. Build data lines (core optimization: data-driven construction and efficient string generation)
  const dataLines = [];

  // -- 顶点数据 --
  for (const point of points) {
    const lineParts = [];
    for (const prop of vertexProperties) {
      switch (prop.name) {
        case 'x': lineParts.push(point.position[0]); break;
        case 'y': lineParts.push(point.position[1]); break;
        case 'z': lineParts.push(point.position[2]); break;
        case 'red': lineParts.push(Math.round(point.color[0] * 255)); break;
        case 'green': lineParts.push(Math.round(point.color[1] * 255)); break;
        case 'blue': lineParts.push(Math.round(point.color[2] * 255)); break;
        case 'label': lineParts.push(point.labelId ?? 0); break;
        case 's': lineParts.push(point.textureCoords ? point.textureCoords[0] : 0); break;
        case 't': lineParts.push(point.textureCoords ? point.textureCoords[1] : 0); break;
        default: lineParts.push('0'); // Provide default value for unknown properties
      }
    }
    dataLines.push(lineParts.join(' '));
  }

  // -- 面片数据 --
  if (hasFaces) {
    for (const face of faces) {
      const lineParts = [];
      for (const prop of faceProperties) {
        let valueAdded = false;
        // Prioritize using original properties saved on the face
        if (face.originalProperties && face.originalProperties[prop.name] !== undefined) {
          const value = face.originalProperties[prop.name];
          if (Array.isArray(value)) {
            lineParts.push(`${value.length} ${value.join(' ')}`);
          } else {
            lineParts.push(value);
          }
          valueAdded = true;
        } else {
          // Otherwise, generate based on property name
          switch (prop.name) {
            case 'vertex_indices': lineParts.push(`${face.indices.length} ${face.indices.join(' ')}`); valueAdded = true; break;
            case 'label': lineParts.push(face.labelId ?? -1); valueAdded = true; break;
            case 'red': lineParts.push(face.color ? Math.round(face.color[0] * 255) : 255); valueAdded = true; break;
            case 'green': lineParts.push(face.color ? Math.round(face.color[1] * 255) : 255); valueAdded = true; break;
            case 'blue': lineParts.push(face.color ? Math.round(face.color[2] * 255) : 255); valueAdded = true; break;
            case 'texcoord': 
                lineParts.push(face.textureCoords ? `${face.textureCoords.length} ${face.textureCoords.join(' ')}` : '0'); 
                valueAdded = true; 
                break;
          }
        }
        // If none of the above match, provide default value
        if (!valueAdded) {
            lineParts.push(prop.type === 'list' ? '0' : '0');
        }
      }
      dataLines.push(lineParts.join(' '));
    }
  }

  // 5. Final merge
  return headerLines.join('\n') + '\n' + dataLines.join('\n');
}


// 原始的下载和ZIP打包函数 (无需修改)
function exportSinglePLY(plyContent, baseName, suffix) {
  const blob = new Blob([plyContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `${baseName}${suffix}.ply`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  
  URL.revokeObjectURL(url);
}

async function exportAsZip(plyContent, baseName, suffix, materials) {
  const zip = new JSZip();
  
  zip.file(`${baseName}${suffix}.ply`, plyContent);
  
  for (const [fileName, fileData] of Object.entries(materials)) {
    if (fileData instanceof ArrayBuffer || fileData instanceof Blob) {
      zip.file(fileName, fileData);
    } else {
      console.warn(`无法处理材质文件 ${fileName}，数据类型不支持:`, typeof fileData);
    }
  }
  
  try {
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}${suffix}.zip`;
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('创建zip文件时出错:', error);
    exportSinglePLY(plyContent, baseName, suffix);
  }
}