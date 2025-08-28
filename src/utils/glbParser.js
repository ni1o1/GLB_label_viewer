/**
 * GLB Parser - Optimized Version
 * 
 * Main optimizations:
 * 1. Custom data structure standardization: Reorganizes flattened userData properties from GLTFLoader into nested extras structure
 * 2. Unified data access path: All custom properties are accessed through mesh.userData.extras
 * 3. Improved code robustness: Avoids parsing errors due to inconsistent data structures
 * 
 * Data structure standardization explanation:
 * - GLTFLoader will "flatten" extras content from GLB file mesh objects directly to THREE.Mesh.userData top level
 * - This parser automatically detects and reorganizes this data, creating a standard nested structure
 * - Standardized structure: mesh.userData.extras.{customProperty}
 * 
 * Supported custom properties:
 * - faceLabels: face annotation data
 * - labelDefinitions: label definitions
 * - originalHeader: original file header information
 * - units: unit information
 * - pointLabels: point annotation data
 * - meshLabels: mesh annotation data
 * - annotationData: generic annotation data
 * - metadata: metadata
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { getDefaultColorForLabel } from '../constants/colors.js';

/**
 * Standardizes mesh node userData structure
 * Reorganizes flattened custom properties from GLTFLoader into nested extras structure
 * @param {THREE.Mesh} node - Three.js mesh node
 * @returns {boolean} whether custom data was found and processed
 */
function standardizeUserDataStructure(node) {
  if (!node.isMesh || !node.userData) {
    return false;
  }

  // Define all known custom fields
  const customKeys = [
    'faceLabels',        // face annotation data
    'labelDefinitions',  // label definitions
    'originalHeader',    // original file header information
    'units',            // unit information
    'pointLabels',      // point annotation data
    'meshLabels',       // mesh annotation data
    'annotationData',   // generic annotation data
    'metadata'          // metadata
  ];
  
  const extras = {};
  let hasCustomData = false;

  // 检查并移动自定义属性到extras对象中
  for (const key of customKeys) {
    if (node.userData[key] !== undefined) {
      extras[key] = node.userData[key];
      delete node.userData[key]; // 从顶层删除，保持userData整洁
      hasCustomData = true;

    }
  }

  // 如果发现自定义数据，创建标准的嵌套结构
  if (hasCustomData) {
    node.userData.extras = extras;

  }

  return hasCustomData;
}

/**
 * Extracts vertex data from Three.js geometry
 * @param {THREE.BufferGeometry} geometry - Three.js geometry
 * @param {THREE.Matrix4} matrixWorld - world transformation matrix
 * @returns {Array} vertex array
 */
function extractVerticesFromGeometry(geometry, matrixWorld) {
  const points = [];
  const positions = geometry.attributes.position;
  if (!positions) {

    return points;
  }

  const colors = geometry.attributes.color;
  const uvs = geometry.attributes.uv;
  const normals = geometry.attributes.normal;
  // **New**: Check custom annotation attributes
  const labelIds = geometry.attributes._label_id;

  const vertexCount = positions.count;
  const tempVertex = new THREE.Vector3();

  // If annotation attributes are found, log them
  if (labelIds) {

  }

  for (let i = 0; i < vertexCount; i++) {
    tempVertex.fromBufferAttribute(positions, i);
     if (matrixWorld) {
      tempVertex.applyMatrix4(matrixWorld);
    } 

    const point = {
      position: [tempVertex.x, tempVertex.y, tempVertex.z],
      color: [1, 1, 1], // 默认白色
    };

    if (colors) {
      point.color = [colors.getX(i), colors.getY(i), colors.getZ(i)];
    }
    if (uvs) {
      point.textureCoords = [uvs.getX(i), uvs.getY(i)];
    }
    if (normals) {
      point.normal = [normals.getX(i), normals.getY(i), normals.getZ(i)];
    }

    // **New**: Parse point annotation ID
    if (labelIds) {
      const labelId = labelIds.getX(i);
      if (labelId && labelId > 0) {
        point.labelId = labelId;
      }
    }

    points.push(point);
  }
  
  // Count the number of parsed annotation points
  if (labelIds) {
    const labeledPointsCount = points.filter(p => p.labelId && p.labelId > 0).length;

  }
  
  return points;
}

/**
 * Extracts face data from Three.js geometry
 * @param {THREE.BufferGeometry} geometry - Three.js geometry
 * @returns {Array} face array
 */
function extractFacesFromGeometry(geometry) {
    const faces = [];
    const indices = geometry.index;
    const uvs = geometry.attributes.uv;

    if (!indices) {
        // 非索引几何体，每三个顶点构成一个面
        const vertexCount = geometry.attributes.position.count;
        for (let i = 0; i < vertexCount; i += 3) {
            const face = {
                indices: [i, i + 1, i + 2],
                labelId: null,
                textureCoords: null,
                color: null,
            };
            if (uvs) {
                face.textureCoords = [
                    uvs.getX(i), uvs.getY(i),
                    uvs.getX(i + 1), uvs.getY(i + 1),
                    uvs.getX(i + 2), uvs.getY(i + 2),
                ];
            }
            faces.push(face);
        }
    } else {
        // 索引几何体
        const indexCount = indices.count;
        for (let i = 0; i < indexCount; i += 3) {
            const v0 = indices.getX(i);
            const v1 = indices.getX(i + 1);
            const v2 = indices.getX(i + 2);
            const face = {
                indices: [v0, v1, v2],
                labelId: null,
                textureCoords: null,
                color: null,
            };
            if (uvs) {
                face.textureCoords = [
                    uvs.getX(v0), uvs.getY(v0),
                    uvs.getX(v1), uvs.getY(v1),
                    uvs.getX(v2), uvs.getY(v2),
                ];
            }
            faces.push(face);
        }
    }
    return faces;
}


/**
 * 处理单个材质，确保名称的标准化
 * @param {THREE.Material} material - Three.js材质
 * @param {number} materialIndex - 材质的唯一索引
 * @returns {Object} 包含标准化名称和完整材质引用的信息对象
 */
function processSingleMaterial(material, materialIndex) {
    // **核心修复**: 强制使用`material_`前缀和索引作为唯一名称
    const standardizedName = `material_${materialIndex}`;

    const materialInfo = {
        name: standardizedName,
        originalName: material.name || null,
        type: material.type,
        index: materialIndex,
        // **关键**: 直接保存Three.js材质对象的引用，保留所有纹理和属性
        threeMaterial: material,
        hasTexture: !!material.map,
    };

    // 为方便调试和可能的备用逻辑，也提取一些属性
    if (material.color) materialInfo.color = [material.color.r, material.color.g, material.color.b];
    if (material.metalness !== undefined) materialInfo.metalness = material.metalness;
    if (material.roughness !== undefined) materialInfo.roughness = material.roughness;
    if (material.transparent !== undefined) materialInfo.transparent = material.transparent;
    if (material.opacity !== undefined) materialInfo.opacity = material.opacity;

    // 提取纹理引用
    if (material.map) materialInfo.diffuseTexture = material.map;
    if (material.normalMap) materialInfo.normalTexture = material.normalMap;
    if (material.metalnessMap) materialInfo.metalnessTexture = material.metalnessMap;
    if (material.roughnessMap) materialInfo.roughnessTexture = material.roughnessMap;
    if (material.aoMap) materialInfo.aoTexture = material.aoMap;
    if (material.emissiveMap) materialInfo.emissiveTexture = material.emissiveMap;
    
    return materialInfo;
}


/**
 * 解析GLB文件的主函数
 * @param {ArrayBuffer} buffer - GLB文件的二进制内容
 * @param {string} fileName - 文件名
 * @returns {Promise<Object>} 解析结果
 */
export function parseGLB(buffer, fileName = 'model.glb') {
  return new Promise((resolve, reject) => {
    const manager = new THREE.LoadingManager();
    const loader = new GLTFLoader(manager);

    // --- 配置加载器 (参考 three-gltf-viewer) ---
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);

    const ktx2Loader = new KTX2Loader(manager);
    ktx2Loader.setTranscoderPath('https://unpkg.com/three@0.168.0/examples/jsm/libs/basis/');
    // 动态检测渲染器支持来配置KTX2
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
      ktx2Loader.detectSupport(renderer);
      renderer.dispose();
    }
    loader.setKTX2Loader(ktx2Loader);
    
    loader.setMeshoptDecoder(MeshoptDecoder);
    // --- 配置加载器结束 ---

    loader.parse(buffer, '', (gltf) => {
      try {
        const scene = gltf.scene;
        if (!scene) {
            reject(new Error('GLB 文件不包含任何场景 (scene)。'));
            return;
        }
        
        const allPoints = [];
        const allFaces = [];
        let totalVertices = 0;
        let totalFaces = 0;

        scene.updateMatrixWorld(true);
        
        // **新增**: 标准化自定义数据结构 - 将扁平的userData属性重构为嵌套的extras结构
        let standardizedMeshCount = 0;
        scene.traverse((node) => {
          if (standardizeUserDataStructure(node)) {
            standardizedMeshCount++;
          }
        });
        

        
        // 1. 首先收集并处理所有唯一的材质
        const materialMap = new Map(); // 使用UUID作为键来确保唯一性
        let materialIndexCounter = 0;
        let totalMeshCount = 0;
        
        scene.traverse((node) => {
          if (node.isMesh && node.material) {
            totalMeshCount++;
            
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            
            materials.forEach((material, matIndex) => {
              if (!materialMap.has(material.uuid)) {
                const materialInfo = processSingleMaterial(material, materialIndexCounter);
                materialMap.set(material.uuid, materialInfo);
                materialIndexCounter++;
              }
            });
          }
        });

        // 2. 遍历场景中的所有网格，提取顶点和面，并分配正确的材质索引
        scene.traverse((node) => {
          if (node.isMesh) {

            
            const geometry = node.geometry;
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            
            const vertices = extractVerticesFromGeometry(geometry, node.matrixWorld);
            const localFaces = extractFacesFromGeometry(geometry);
            
            // **修改**: 检查并解析面标注数据 - 只从标准化的extras路径读取
            let faceLabelIds = null;
            if (node.userData && node.userData.extras && node.userData.extras.faceLabels) {
              faceLabelIds = node.userData.extras.faceLabels;
            }
            
            // 为当前网格的面分配材质索引
            if (materials.length === 1) {
              // 单材质情况
              const material = materials[0];
              const materialInfo = materialMap.get(material.uuid);
              const currentMaterialIndex = materialInfo ? materialInfo.index : -1;
              localFaces.forEach(face => {
                face.materialIndex = currentMaterialIndex;
              });
            } else if (geometry.groups && geometry.groups.length > 0) {
              // 多材质情况，使用 geometry groups
              geometry.groups.forEach(group => {
                const material = materials[group.materialIndex];
                if (!material) return;

                const materialInfo = materialMap.get(material.uuid);
                const groupMaterialIndex = materialInfo ? materialInfo.index : -1;
                
                const faceStart = group.start / 3;
                const faceEnd = faceStart + group.count / 3;
                for (let i = faceStart; i < faceEnd; i++) {
                  if (localFaces[i]) {
                    localFaces[i].materialIndex = groupMaterialIndex;
                  }
                }
              });
            }

            // **新增**: 应用面标注数据
            if (faceLabelIds && faceLabelIds.length > 0) {
              localFaces.forEach((face, localFaceIndex) => {
                if (localFaceIndex < faceLabelIds.length) {
                  const labelId = faceLabelIds[localFaceIndex];
                  if (labelId && labelId > 0) {
                    face.labelId = labelId;
                  }
                }
              });
              
              const labeledFacesCount = localFaces.filter(f => f.labelId && f.labelId > 0).length;
            }

            // 调整面索引为全局索引并合并
            localFaces.forEach(face => {
              face.indices = face.indices.map(index => index + totalVertices);
              allFaces.push(face);
            });

            allPoints.push(...vertices);
            
            totalVertices += vertices.length;
            totalFaces += localFaces.length;


          }
        });
        
        // 3. 构建最终的材质对象，使用标准化的名称作为key
        const finalMaterials = {};
        for (const materialInfo of materialMap.values()) {
          finalMaterials[materialInfo.name] = materialInfo;
        }

        // 4. 生成交互映射元数据 - 用于将原始场景的射线检测结果映射到扁平化数据
        const interactionMapping = {
          meshToFaceRange: new Map(), // 存储每个原始网格对应的面片范围
          meshToPointRange: new Map(), // **新增**: 存储每个原始网格对应的顶点范围
          faceToMesh: new Map(),      // 存储每个面片对应的原始网格
          meshUuidToNode: new Map()   // 存储UUID到原始节点的映射
        };

        let faceOffset = 0;
        let vertexOffset = 0; // **新增**: 顶点偏移量追踪
        scene.traverse((node) => {
          if (node.isMesh) {
            const geometry = node.geometry;
            const faceCount = geometry.index 
              ? geometry.index.count / 3 
              : geometry.attributes.position.count / 3;
            const vertexCount = geometry.attributes.position.count; // **新增**: 获取顶点数量
            
            // 记录这个网格对应的面片范围
            const faceRange = {
              start: faceOffset,
              end: faceOffset + faceCount,
              node: node,
              meshName: node.name || `mesh_${node.uuid}`,
              materialIndices: []
            };

            // **新增**: 记录这个网格对应的顶点范围
            const pointRange = {
              start: vertexOffset,
              end: vertexOffset + vertexCount,
              node: node,
              meshName: node.name || `mesh_${node.uuid}`,
              vertexCount: vertexCount
            };

            // 记录材质索引信息
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            if (materials.length === 1) {
              const materialInfo = materialMap.get(materials[0].uuid);
              faceRange.materialIndices = Array(faceCount).fill(materialInfo ? materialInfo.index : -1);
            } else if (geometry.groups && geometry.groups.length > 0) {
              faceRange.materialIndices = new Array(faceCount).fill(-1);
              geometry.groups.forEach(group => {
                const material = materials[group.materialIndex];
                if (material) {
                  const materialInfo = materialMap.get(material.uuid);
                  const groupMaterialIndex = materialInfo ? materialInfo.index : -1;
                  const groupFaceStart = group.start / 3;
                  const groupFaceEnd = groupFaceStart + group.count / 3;
                  for (let i = groupFaceStart; i < groupFaceEnd; i++) {
                    if (i < faceCount) {
                      faceRange.materialIndices[i] = groupMaterialIndex;
                    }
                  }
                }
              });
            }

            interactionMapping.meshToFaceRange.set(node.uuid, faceRange);
            interactionMapping.meshToPointRange.set(node.uuid, pointRange); // **新增**: 存储顶点范围映射
            interactionMapping.meshUuidToNode.set(node.uuid, node);

            // 为每个面片记录对应的网格
            for (let i = faceOffset; i < faceOffset + faceCount; i++) {
              interactionMapping.faceToMesh.set(i, {
                meshUuid: node.uuid,
                localFaceIndex: i - faceOffset,
                node: node
              });
            }

            faceOffset += faceCount;
            vertexOffset += vertexCount; // **新增**: 更新顶点偏移量
          }
        });

        // **修改**: 解析标签定义和原始文件信息 - 只从标准化的extras路径读取
        let labelDefinitions = [];
        let originalHeader = null;
        // 从场景中的网格的标准化userData.extras中提取全局信息
        scene.traverse((node) => {
          if (node.isMesh && node.userData && node.userData.extras) {
            const extras = node.userData.extras;
            
            // 解析标签定义（只在第一次发现时设置，避免重复）
            if (!labelDefinitions.length && extras.labelDefinitions && Array.isArray(extras.labelDefinitions)) {
              // **修改**: 深拷贝一份标签定义，以避免修改原始GLTF数据
              labelDefinitions = JSON.parse(JSON.stringify(extras.labelDefinitions));

            }
            
            // 解析原始文件头信息（只在第一次发现时设置，避免重复）
            if (!originalHeader && extras.originalHeader) {
              originalHeader = extras.originalHeader;

            }
          }
        });

        // **核心修正**: 对标签进行统计，为标签管理UI提供计数
        if (labelDefinitions.length > 0) {

          
          // 1. 创建一个 labelId -> labelObject 的映射，方便快速查找和更新
          const labelMap = new Map();
          labelDefinitions.forEach((label, index) => {
            label.faceCount = 0; // 初始化面计数字段
            label.pointCount = 0; // 初始化点计数字段
            // 如果标签没有颜色，则根据其ID或索引生成一个默认颜色
            if (!label.color) {
              label.color = getDefaultColorForLabel(label.id || (index + 1));
            }
            labelMap.set(label.id, label);
          });

          // 2. 遍历所有面（Face）进行统计
          allFaces.forEach(face => {
            if (face.labelId && face.labelId > 0) {
              const label = labelMap.get(face.labelId);
              if (label) {
                label.faceCount++; // 只增加面计数
              }
            }
          });

          // 3. 遍历所有点（Point）进行统计
          allPoints.forEach(point => {
            if (point.labelId && point.labelId > 0) {
              const label = labelMap.get(point.labelId);
              if (label) {
                label.pointCount++; // 只增加点计数
              }
            }
          });
          
          // 4. 统计结果已经更新到 labelDefinitions 数组中的每个对象上

        }

        // 构建最终结果

        const result = {
          points: allPoints,
          faces: allFaces.length > 0 ? allFaces : null,
          materials: Object.keys(finalMaterials).length > 0 ? finalMaterials : null,
          textureFile: null, // GLB纹理是内联的，不通过此字段处理
          // **核心新增**: 原始场景对象，用于默认视图的高保真渲染
          originalScene: scene,
          // **核心新增**: 交互映射元数据，用于射线检测结果的映射
          interactionMapping: interactionMapping,
          // **修改**: 解析到的标签定义，现在包含每个类别的计数信息
          labels: labelDefinitions,
          header: originalHeader || {
            format: 'glb',
            vertexCount: totalVertices,
            faceCount: totalFaces,
            comments: [`Converted from GLB file: ${fileName}`]
          },
          // ... 其他元数据
        };
        
        // 清理资源
        dracoLoader.dispose();
        ktx2Loader.dispose();
        
        resolve(result);

      } catch (error) {

        reject(new Error(`GLTF数据处理失败: ${error.message}`));
      }
    }, (error) => {

      reject(new Error(`GLB文件解析失败: ${error.message || '未知错误'}`));
    });
  });
}

/**
 * 检查文件是否为GLB格式
 * @param {string} fileName - 文件名
 * @returns {boolean} 是否为GLB文件
 */
export function isGLBFile(fileName) {
  return fileName.toLowerCase().endsWith('.glb');
}

/**
 * 检查文件是否为GLTF格式
 * @param {string} fileName - 文件名
 * @returns {boolean} 是否为GLTF文件
 */
export function isGLTFFile(fileName) {
  return fileName.toLowerCase().endsWith('.gltf');
}

/**
 * 检查文件是否为支持的3D格式
 * @param {string} fileName - 文件名
 * @returns {boolean} 是否为支持的3D文件
 */
export function isSupported3DFile(fileName) {
  return isGLBFile(fileName) || isGLTFFile(fileName);
}
