import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Export GLB file with annotation information
 * Final architecture: Using Parallel Traversal to solve UUID mapping issues
 * 
 * Core principles:
 * 1. Deep copy original scene to avoid modifying objects being rendered
 * 2. Collect meshes from original and cloned scenes into ordered arrays separately
 * 3. Traverse both arrays in parallel by index, establishing correspondence between original and cloned meshes
 * 4. Use original mesh UUID to query interactionMapping, attach data to corresponding cloned mesh
 * 5. Export modified cloned scene, ensuring annotation data is correctly written to GLB file
 * 
 * @param {THREE.Object3D} originalScene - original scene object (from GLTFLoader etc.)
 * @param {Object} interactionMapping - interaction mapping object, contains meshToPointRange and meshToFaceRange
 * @param {Array} points - point cloud data array, each point contains position, color, labelId etc.
 * @param {string} fileName - export filename (without extension)
 * @param {Array} faces - face data array, each face contains indices, labelId etc.
 * @param {Array} labels - label definitions array
 * @param {Object} originalHeader - original file header information (optional)
 */
export const exportGLB = async (originalScene, interactionMapping, points, fileName, faces = null, labels = [], originalHeader = null) => {
  try {


    // [Key Step 1] Validate original scene object and mapping object
    if (!originalScene) {
      throw new Error('Missing original scene object (originalScene). Please ensure GLB/GLTF file has been loaded.');
    }
    if (!interactionMapping || !interactionMapping.meshToPointRange || !interactionMapping.meshToFaceRange) {
      throw new Error('Missing interaction mapping object (interactionMapping). Please ensure correct parser is used.');
    }

    // [Key Step 2] Deep copy original scene, absolutely cannot modify original object being rendered

    const sceneToExport = originalScene.clone(true);


    // [Key Step 3] Prepare annotation data mapping
    // 创建点标注ID映射（基于点的索引）
    const pointLabelMap = new Map();
    points.forEach((point, index) => {
      if (point.labelId !== undefined && point.labelId !== null && point.labelId !== 0) {
        pointLabelMap.set(index, point.labelId);
      }
    });


    // 创建面标注ID数组（如果有面数据）
    let faceLabelIds = [];
    if (faces && faces.length > 0) {
      faceLabelIds = faces.map(face => face.labelId || 0);
    }

    // [Key Step 4] Implement Parallel Traversal to solve UUID mapping issues

    
    // 4a. Collect all meshes from original and cloned scenes separately
    const originalMeshes = [];
    const clonedMeshes = [];
    
    // 收集原始场景的网格（保持原始UUID）
    originalScene.traverse((node) => {
      if (node.isMesh) {
        originalMeshes.push(node);
      }
    });
    
    // 收集克隆场景的网格（新UUID）
    sceneToExport.traverse((node) => {
      if (node.isMesh) {
        clonedMeshes.push(node);
      }
    });
    
    // 4b. Verify both arrays have same length (critical integrity check)
    if (originalMeshes.length !== clonedMeshes.length) {
      throw new Error(`Parallel traversal failed: original mesh count(${originalMeshes.length}) does not match cloned mesh count(${clonedMeshes.length})`);
    }
    

    
    // 4c. Implement new data attachment loop: use original UUID to query, attach data to cloned mesh
    for (let i = 0; i < originalMeshes.length; i++) {
      const originalMesh = originalMeshes[i];
      const clonedMesh = clonedMeshes[i];
      

      
      const geometry = clonedMesh.geometry;
      if (!geometry) {

        continue;
      }
      
      // 4d. Use original mesh UUID to query range information from interactionMapping
      const pointRange = interactionMapping.meshToPointRange.get(originalMesh.uuid);
      const faceRange = interactionMapping.meshToFaceRange.get(originalMesh.uuid);
      
      if (!pointRange || !faceRange) {

        continue;
      }
      

      
      // 4e. Precisely attach point annotation attributes to cloned mesh geometry
      if (pointLabelMap.size > 0) {
        const positionAttribute = geometry.getAttribute('position');
        if (positionAttribute) {
          const vertexCount = positionAttribute.count;
          const labelIds = new Int32Array(vertexCount);
          
          // 根据pointRange精确映射点标注
          for (let localIndex = 0; localIndex < vertexCount; localIndex++) {
            const globalIndex = pointRange.start + localIndex;
            if (globalIndex < points.length) {
              labelIds[localIndex] = pointLabelMap.get(globalIndex) || 0;
            }
          }
          
          geometry.setAttribute('_label_id', new THREE.Int32BufferAttribute(labelIds, 1));
          const labeledCount = Array.from(labelIds).filter(id => id > 0).length;
        }
      }
      
      // 4f. Precisely attach face annotation data to cloned mesh userData (fix: write directly to top level)
      if (faceLabelIds.length > 0 && faceRange) {
        // 根据faceRange精确切片面标注数据
        const meshFaceLabels = faceLabelIds.slice(faceRange.start, faceRange.end);
        clonedMesh.userData.faceLabels = meshFaceLabels;
        
        const labeledFaceCount = meshFaceLabels.filter(id => id > 0).length;
      }
      
      // 4g. Attach global metadata (only first mesh) (fix: write directly to top level)
      if (i === 0) {
        // 附加标签定义
        if (labels.length > 0) {
          clonedMesh.userData.labelDefinitions = labels.map(label => ({
            id: label.id,
            name: label.name,
            color: label.color,
            visible: label.visible
          }));

        }
        
        // 附加原始文件头信息
        if (originalHeader) {
          clonedMesh.userData.originalHeader = originalHeader;

        }
      }
    }
    

    
    // [Key Step 5] Configure and execute GLTFExporter
    const exporter = new GLTFExporter();
    
    // 实例化并配置 DRACOLoader
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    // 配置导出选项（包含 Draco 压缩）
    const options = {
      binary: true, // 导出为GLB格式
      includeCustomExtensions: true,
      dracoOptions: {
        dracoLoader: dracoLoader,
        compressionLevel: 6, // 网格压缩级别
        quantizePositionBits: 14, // 位置量化精度
        quantizeNormalBits: 10, // 法线量化精度
        quantizeTexcoordBits: 12, // 纹理坐标量化精度
        quantizeColorBits: 10, // 颜色量化精度
        quantizeGenericBits: 12, // 通用属性量化精度
      }
    };
    

    
    // [Key Step 6] Execute export - note that sceneToExport is passed instead of manually created mesh
    return new Promise((resolve, reject) => {
      exporter.parse(
        sceneToExport, // 传入修改后的完整场景对象
        (result) => {
          try {

            
            // 创建下载链接
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            const url = URL.createObjectURL(blob);
            
            // 触发下载
            const link = document.createElement('a');
            link.href = url;
            link.download = `${fileName || 'annotated_model'}.glb`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // 清理URL
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            

            resolve(result);
          } catch (error) {
  
            reject(error);
          }
        },
        (error) => {
  
          reject(error);
        },
        options
      );
    });
    
  } catch (error) {

    throw error;
  }
};

/**
 * 验证导出数据的完整性
 * @param {Array} points - 点云数据
 * @param {Array} faces - 面片数据
 * @param {Array} labels - 标签数据
 * @returns {Object} 验证结果
 */
export const validateExportData = (points, faces, labels) => {
  const result = {
    valid: true,
    warnings: [],
    errors: []
  };
  
  // 检查点云数据
  if (!points || points.length === 0) {
    result.errors.push('点云数据为空');
    result.valid = false;
  }
  
  // 检查标注数据
  const labeledPoints = points.filter(p => p.labelId && p.labelId > 0).length;
  const labeledFaces = faces ? faces.filter(f => f.labelId && f.labelId > 0).length : 0;
  
  if (labeledPoints === 0 && labeledFaces === 0) {
    result.warnings.push('没有发现任何标注数据');
  }
  
  // 检查标签定义
  if (labels.length === 0) {
    result.warnings.push('没有定义任何标签');
  }
  

  return result;
};