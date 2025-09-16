/**
 * GLB解析器 - 优化版本
 * 支持直接解析GLB二进制格式并输出JSON tree结构
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { getDefaultColorForLabel, getSemanticColorForLabel } from '../constants/colors.js';

/**
 * 直接解析GLB二进制文件并输出JSON tree结构
 * @param {ArrayBuffer} buffer - GLB文件的二进制数据
 * @returns {Object} 解析后的JSON tree结构
 */
function parseGLBBinary(buffer) {
  const view = new DataView(buffer);

  // 检查GLB魔数 (0x46546C67 = "glTF")
  const magic = view.getUint32(0, true);
  if (magic !== 0x46546C67) {
    throw new Error('不是有效的GLB文件格式');
  }

  // 读取版本号
  const version = view.getUint32(4, true);
  console.log('GLB版本:', version);

  // 读取文件总长度
  const length = view.getUint32(8, true);
  console.log('GLB文件总长度:', length);

  let offset = 12; // GLB头部长度
  const chunks = [];

  // 解析所有chunk
  while (offset < length) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);

    const chunk = {
      length: chunkLength,
      type: chunkType,
      typeString: String.fromCharCode(
        (chunkType >> 0) & 0xFF,
        (chunkType >> 8) & 0xFF,
        (chunkType >> 16) & 0xFF,
        (chunkType >> 24) & 0xFF
      ),
      offset: offset + 8,
      data: null
    };

    // 读取chunk数据
    if (chunk.typeString === 'JSON') {
      // JSON chunk - 包含GLTF JSON数据
      const jsonBytes = new Uint8Array(buffer, offset + 8, chunkLength);
      const jsonString = new TextDecoder().decode(jsonBytes);
      chunk.data = JSON.parse(jsonString);
      console.log('GLB JSON Chunk 解析完成:');
      // console.log('JSON Tree 结构:', JSON.stringify(chunk.data, null, 2)); // 默认关闭，信息量太大
    } else if (chunk.typeString === 'BIN\0') {
      // Binary chunk - 包含二进制数据
      chunk.data = new Uint8Array(buffer, offset + 8, chunkLength);
      console.log('GLB Binary Chunk 解析完成, 大小:', chunkLength, '字节');
    }

    chunks.push(chunk);
    offset += 8 + chunkLength;
  }

  const result = {
    version,
    length,
    chunks,
    jsonData: chunks.find(c => c.typeString === 'JSON')?.data || null,
    binaryData: chunks.find(c => c.typeString === 'BIN\0')?.data || null
  };

  console.log('GLB解析完成，总体结构:');
  console.log('- 版本:', result.version);
  console.log('- 文件大小:', result.length);
  console.log('- Chunk数量:', result.chunks.length);
  console.log('- JSON数据:', result.jsonData ? '存在' : '不存在');
  console.log('- 二进制数据:', result.binaryData ? `存在 (${result.binaryData.length} 字节)` : '不存在');

  return result;
}

// ... standardizeUserDataStructure, extractVerticesFromGeometry, extractFacesFromGeometry, processSingleMaterial functions remain the same ...
function standardizeUserDataStructure(node) {
  if (!node.isMesh) {
    return;
  }
  const customKeys = ['faceLabels', 'labelDefinitions', 'originalHeader', 'units', 'pointLabels', 'meshLabels', 'annotationData', 'metadata'];
  let sourceObject = null;
  if (node.userData && node.userData.extras) {
    return;
  }
  if (node.userData && customKeys.some(key => node.userData[key] !== undefined)) {
    sourceObject = node.userData;
  } else if (node.geometry && node.geometry.userData && customKeys.some(key => node.geometry.userData[key] !== undefined)) {
    sourceObject = node.geometry.userData;
  }
  if (sourceObject) {
    if (!node.userData) {
      node.userData = {};
    }
    if (!node.userData.extras) {
      node.userData.extras = {};
    }
    for (const key of customKeys) {
      if (sourceObject[key] !== undefined) {
        node.userData.extras[key] = sourceObject[key];
        delete sourceObject[key];
      }
    }
  }
}
function extractVerticesFromGeometry(geometry, matrixWorld) {
  const points = [];
  const positions = geometry.attributes.position;
  if (!positions) return points;
  const colors = geometry.attributes.color;
  const uvs = geometry.attributes.uv;
  const normals = geometry.attributes.normal;
  const labelIds = geometry.attributes._label_id;
  const vertexCount = positions.count;
  const tempVertex = new THREE.Vector3();
  for (let i = 0; i < vertexCount; i++) {
    tempVertex.fromBufferAttribute(positions, i);
    if (matrixWorld) tempVertex.applyMatrix4(matrixWorld);
    const point = { position: [tempVertex.x, tempVertex.y, tempVertex.z], color: [1, 1, 1] };
    if (colors) point.color = [colors.getX(i), colors.getY(i), colors.getZ(i)];
    if (uvs) point.textureCoords = [uvs.getX(i), uvs.getY(i)];
    if (normals) point.normal = [normals.getX(i), normals.getY(i), normals.getZ(i)];
    if (labelIds) {
      const labelId = labelIds.getX(i);
      if (labelId && labelId > 0) point.labelId = labelId;
    }
    points.push(point);
  }
  return points;
}
function extractFacesFromGeometry(geometry) {
  const faces = [];
  const indices = geometry.index;
  const uvs = geometry.attributes.uv;
  if (!indices) {
    const vertexCount = geometry.attributes.position.count;
    for (let i = 0; i < vertexCount; i += 3) {
      const face = { indices: [i, i + 1, i + 2], labelId: null, textureCoords: null, color: null };
      if (uvs) face.textureCoords = [uvs.getX(i), uvs.getY(i), uvs.getX(i + 1), uvs.getY(i + 1), uvs.getX(i + 2), uvs.getY(i + 2)];
      faces.push(face);
    }
  } else {
    const indexCount = indices.count;
    for (let i = 0; i < indexCount; i += 3) {
      const v0 = indices.getX(i), v1 = indices.getX(i + 1), v2 = indices.getX(i + 2);
      const face = { indices: [v0, v1, v2], labelId: null, textureCoords: null, color: null };
      if (uvs) face.textureCoords = [uvs.getX(v0), uvs.getY(v0), uvs.getX(v1), uvs.getY(v1), uvs.getX(v2), uvs.getY(v2)];
      faces.push(face);
    }
  }
  return faces;
}
function processSingleMaterial(material, materialIndex) {
    const standardizedName = `material_${materialIndex}`;
    const materialInfo = { name: standardizedName, originalName: material.name || null, type: material.type, index: materialIndex, threeMaterial: material, hasTexture: !!material.map };
    if (material.color) materialInfo.color = [material.color.r, material.color.g, material.color.b];
    if (material.metalness !== undefined) materialInfo.metalness = material.metalness;
    if (material.roughness !== undefined) materialInfo.roughness = material.roughness;
    if (material.transparent !== undefined) materialInfo.transparent = material.transparent;
    if (material.opacity !== undefined) materialInfo.opacity = material.opacity;
    if (material.map) materialInfo.diffuseTexture = material.map;
    return materialInfo;
}

/**
 * 解析GLB文件的主函数
 * 首先直接解析GLB二进制格式输出JSON tree，然后使用GLTFLoader处理
 */
export function parseGLB(buffer, fileName = 'model.glb') {
  return new Promise((resolve, reject) => {
    let glbBinaryData = null;
    try {
      // 第一时间直接解析GLB二进制文件并输出JSON tree结构
      console.log('=== 开始直接解析GLB二进制文件 ===');
      glbBinaryData = parseGLBBinary(buffer);
      console.log('=== GLB二进制解析完成 ===');
    } catch (error) {
      console.error('GLB二进制解析失败:', error);
      // 继续使用GLTFLoader作为备选方案
    }

    // 继续使用GLTFLoader进行完整的3D模型解析
    const manager = new THREE.LoadingManager();
    const loader = new GLTFLoader(manager);
    const dracoLoader = new DRACOLoader(manager);
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    loader.setDRACOLoader(dracoLoader);
    const ktx2Loader = new KTX2Loader(manager);
    ktx2Loader.setTranscoderPath('https://cdn.jsdelivr.net/npm/three@0.168.0/examples/jsm/libs/basis/');
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (gl) {
      const renderer = new THREE.WebGLRenderer({ canvas, context: gl });
      ktx2Loader.detectSupport(renderer);
      renderer.dispose();
    }
    loader.setKTX2Loader(ktx2Loader);
    loader.setMeshoptDecoder(MeshoptDecoder);

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

        scene.updateMatrixWorld(true);
        scene.traverse(standardizeUserDataStructure);

        const materialMap = new Map();
        let materialIndexCounter = 0;

        scene.traverse((node) => {
          if (node.isMesh && node.material) {
            const materials = Array.isArray(node.material) ? node.material : [node.material];
            materials.forEach((material) => {
              if (!materialMap.has(material.uuid)) {
                materialMap.set(material.uuid, processSingleMaterial(material, materialIndexCounter++));
              }
            });
          }
        });

        // --- 核心修复：将两个循环合并为一个，确保数据一致性 ---
        const interactionMapping = { meshToFaceRange: new Map(), meshToPointRange: new Map(), faceToMesh: new Map(), meshUuidToNode: new Map() };

        scene.traverse((node) => {
          if (node.isMesh) {
            const geometry = node.geometry;
            const vertices = extractVerticesFromGeometry(geometry, node.matrixWorld);
            const localFaces = extractFacesFromGeometry(geometry);

            let faceLabelIds = null;
            if (node.userData && node.userData.extras && node.userData.extras.faceLabels) {
              faceLabelIds = node.userData.extras.faceLabels;
            }

            const materials = Array.isArray(node.material) ? node.material : [node.material];
            if (materials.length === 1) {
              const materialInfo = materialMap.get(materials[0].uuid);
              const currentMaterialIndex = materialInfo ? materialInfo.index : -1;
              localFaces.forEach(face => { face.materialIndex = currentMaterialIndex; });
            } else if (geometry.groups && geometry.groups.length > 0) {
              geometry.groups.forEach(group => {
                const material = materials[group.materialIndex];
                if (!material) return;
                const materialInfo = materialMap.get(material.uuid);
                const groupMaterialIndex = materialInfo ? materialInfo.index : -1;
                const faceStart = group.start / 3;
                const faceEnd = faceStart + group.count / 3;
                for (let i = faceStart; i < faceEnd; i++) {
                  if (localFaces[i]) localFaces[i].materialIndex = groupMaterialIndex;
                }
              });
            }

            if (faceLabelIds && faceLabelIds.length > 0) {
              localFaces.forEach((face, localFaceIndex) => {
                if (localFaceIndex < faceLabelIds.length) {
                  const labelId = faceLabelIds[localFaceIndex];
                  if (labelId && labelId > 0) {
                    face.labelId = labelId;
                  }
                }
              });
            }

            // 在将面片添加到全局数组之前，记录当前的偏移量
            const faceOffset = allFaces.length;
            const vertexOffset = allPoints.length;
            const faceCount = localFaces.length;
            const vertexCount = vertices.length;

            // 将面片的局部顶点索引更新为全局索引
            localFaces.forEach(face => {
              face.indices = face.indices.map(index => index + totalVertices);
              allFaces.push(face);
            });

            // 添加点
            allPoints.push(...vertices);

            // --- 在这里立即创建并存储映射，保证100%准确 ---
            const faceRange = { start: faceOffset, end: faceOffset + faceCount, node: node, meshName: node.name || `mesh_${node.uuid}` };
            const pointRange = { start: vertexOffset, end: vertexOffset + vertexCount, node: node, meshName: node.name || `mesh_${node.uuid}` };

            interactionMapping.meshToFaceRange.set(node.uuid, faceRange);
            interactionMapping.meshToPointRange.set(node.uuid, pointRange);
            interactionMapping.meshUuidToNode.set(node.uuid, node);

            for (let i = 0; i < faceCount; i++) {
                const globalFaceIndex = faceOffset + i;
                interactionMapping.faceToMesh.set(globalFaceIndex, { meshUuid: node.uuid, localFaceIndex: i, node: node });
            }

            // 更新全局顶点总数
            totalVertices += vertices.length;
          }
        });
        // --- 修复结束 ---

        const finalMaterials = {};
        for (const materialInfo of materialMap.values()) {
          finalMaterials[materialInfo.name] = materialInfo;
        }

        let labelDefinitions = [];
        let originalHeader = null;
        
        // --- 【改进】读取标签定义的逻辑 ---
        // 1. 优先从顶层 asset.extras 读取，这是更规范的位置
        if (glbBinaryData && glbBinaryData.jsonData && glbBinaryData.jsonData.asset && glbBinaryData.jsonData.asset.extras && glbBinaryData.jsonData.asset.extras.labelDefinitions) {
            labelDefinitions = JSON.parse(JSON.stringify(glbBinaryData.jsonData.asset.extras.labelDefinitions));
        }

        // 2. 如果顶层没有，则遍历网格进行查找，以实现向后兼容
        if (labelDefinitions.length === 0) {
            scene.traverse((node) => {
              if (node.isMesh && node.userData && node.userData.extras) {
                const extras = node.userData.extras;
                if (!labelDefinitions.length && extras.labelDefinitions && Array.isArray(extras.labelDefinitions)) {
                  labelDefinitions = JSON.parse(JSON.stringify(extras.labelDefinitions));
                }
                if (!originalHeader && extras.originalHeader) {
                  originalHeader = extras.originalHeader;
                }
              }
            });
        }
        // --- 改进结束 ---

        if (labelDefinitions.length > 0) {
            const labelMap = new Map();
            labelDefinitions.forEach((label, index) => {
                label.faceCount = 0;
                label.pointCount = 0;
                if (!label.color) {
                    // 优先使用语义颜色，如果没有匹配的语义颜色则使用默认颜色
                    label.color = getSemanticColorForLabel(label.name, index);
                }
                labelMap.set(label.id, label);
            });
            allFaces.forEach(face => {
                if (face.labelId && face.labelId > 0) {
                    const label = labelMap.get(face.labelId);
                    if (label) label.faceCount++;
                }
            });
            allPoints.forEach(point => {
                if (point.labelId && point.labelId > 0) {
                    const label = labelMap.get(point.labelId);
                    if (label) label.pointCount++;
                }
            });
        }

        const result = {
          points: allPoints, faces: allFaces.length > 0 ? allFaces : null, materials: Object.keys(finalMaterials).length > 0 ? finalMaterials : null, textureFile: null,
          originalScene: scene, interactionMapping: interactionMapping, labels: labelDefinitions,
          header: originalHeader || { format: 'glb', vertexCount: totalVertices, faceCount: allFaces.length, comments: [`Converted from GLB file: ${fileName}`] },
        };

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

// 导出GLB二进制解析函数
export { parseGLBBinary };

// 文件类型检查函数
export function isGLBFile(fileName) { return fileName.toLowerCase().endsWith('.glb'); }
export function isGLTFFile(fileName) { return fileName.toLowerCase().endsWith('.gltf'); }
export function isSupported3DFile(fileName) { return isGLBFile(fileName) || isGLTFFile(fileName); }
