import React, { createContext, useContext, useReducer } from 'react';

const AnnotationContext = createContext();

const initialState = {
  points: [],
  labels: [],
  activeLabel: null,
  pointSize: 3,
  viewMode: 'default', // 'default' or 'labels'
  shadingMode: 'flat', // 'flat', 'smooth', 'wireframe', 'points'
  annotationBox: null,
  selectedPoints: [],
  selectedPointsHistory: [], // 选择历史记录
  history: [],
  fileName: null,
  originalFileName: null,
  backgroundColor: '#fcfcfc',
  colorAdjustment: {
    brightness: 1.0,    // 亮度调整 (0.1 - 2.0)
    contrast: 1.0,      // 对比度调整 (0.1 - 2.0)
    saturation: 1.0,    // 饱和度调整 (0.0 - 2.0)
    gamma: 1.0          // 伽马校正 (0.1 - 3.0)
  }, // 默认黑色背景
  fileHeader: null,     // PLY文件头信息
  fileFields: [],       // PLY文件字段列表
  labelInfo: null,      // 已有标签信息
  orientationMode: false, // 点云朝向调整模式
  transformMode: 'rotate', // 变换模式：'rotate' 或 'translate'
  pointCloudRotation: [0, 0, 0, 1], // 点云旋转状态（四元数）
  pointCloudPosition: [0, 0, 0], // 点云位置状态
  editorMode: 'LASSO_SELECT', // 'BOX_SELECT', 'LASSO_SELECT', or 'RECTANGLE_SELECT'
  centerOffset: [0, 0, 0], // 存储点云的中心点坐标 [x, y, z]
  // Mesh相关状态
  hasMesh: false, // 是否包含Mesh数据
  faces: [], // 面片数据：Array<{indices: number[], labelId: number | null}>
  isPointCloudVisible: true, // 点云是否可见
  isMeshVisible: true, // 面片是否可见
  meshSelectionMode: 'TOUCHING', // 'TOUCHING' | 'ENCLOSED'
  selectedFaces: new Set(), // 选中的面片索引
  isManualFaceSelection: false, // 标志是否为手动设置的面片选择（如反选操作）
  materials: null, // 材质信息
  textureFile: null, // 纹理文件信息
  meshOpacity: 1.0, // 面片透明度 (0.0 - 1.0)
  // 混合渲染架构新增字段
  originalScene: null, // GLB/GLTF原始场景对象，用于默认视图的高保真渲染
  interactionMapping: null, // 交互映射元数据，用于射线检测结果的映射
  originalFileBuffer: null, // 原始文件的ArrayBuffer数据，用于导出时重新生成GLB文件
  // Modal状态管理
  isModalOpen: false, // 标签管理Modal是否打开，用于控制快捷键响应
  // 坐标轴显示控制
  showGridAndAxes: false, // 是否显示网格和坐标轴
  // Wireframe显示控制
  showWireframe: false, // 是否显示mesh的wireframe边框
  // 摄像头控制
  isNewFileLoaded: false, // 标识是否加载了新文件，用于控制摄像头重置
};

function annotationReducer(state, action) {
  switch (action.type) {
    case 'SET_POINTS':
      return {
        ...state,
        points: action.payload,
        history: [...state.history, state.points],
      };
    case 'SET_PLY_DATA':
      return {
        ...state,
        points: action.payload.points,
        fileHeader: action.payload.header,
        fileFields: action.payload.fields,
        labelInfo: action.payload.labelInfo,
        history: [...state.history, state.points],
      };
    case 'LOAD_FILE_DATA':
      const { 
        points, 
        faces, 
        materials, 
        textureFile, 
        header, 
        fields, 
        labelInfo,
        originalScene,
        interactionMapping,
        originalFileBuffer, // 新增：原始文件的ArrayBuffer数据
        labels // 关键修复：从 glbParser.js 解析结果中提取标签定义
      } = action.payload;
      const hasMesh = faces !== null && faces.length > 0;
      const facesData = hasMesh ? faces.map(face => {
        // 支持新的面数据结构和旧的数组格式
        if (face.indices) {
          // 新格式：完整的面对象
          return {
            indices: face.indices,
            labelId: face.labelId || null,
            textureCoords: face.textureCoords || null,
            color: face.color || null
          };
        } else {
          // 旧格式：只有索引数组
          return {
            indices: face,
            labelId: null,
            textureCoords: null,
            color: null
          };
        }
      }) : [];
      
      // **修正**: 如果labels包含精确的faceCount和pointCount信息，使用它来初始化labelInfo
      let finalLabelInfo = labelInfo;
      if (labels && labels.length > 0 && labels.some(label => label.faceCount !== undefined || label.pointCount !== undefined)) {

        
        // 从labels中的精确计数信息构建labelStats和faceLabelStats
        const labelStats = {};
        const faceLabelStats = {};
        let totalLabeledPoints = 0;
        let totalLabeledFaces = 0;
        
        labels.forEach(label => {
          // 使用pointCount来构建点标注统计
          if (label.pointCount && label.pointCount > 0) {
            labelStats[label.id.toString()] = label.pointCount;
            totalLabeledPoints += label.pointCount;
          }
          
          // 使用faceCount来构建面标注统计
          if (label.faceCount && label.faceCount > 0) {
            faceLabelStats[label.id.toString()] = label.faceCount;
            totalLabeledFaces += label.faceCount;
          }
        });
        
        finalLabelInfo = {
          labelStats: labelStats,
          faceLabelStats: faceLabelStats,
          labeledCount: totalLabeledPoints,
          unlabeledCount: Math.max(0, (points?.length || 0) - totalLabeledPoints),
          faceLabeledCount: totalLabeledFaces,
          faceUnlabeledCount: Math.max(0, (facesData?.length || 0) - totalLabeledFaces)
        };
        

      }

      return {
        ...state,
        points: points,
        faces: facesData,
        hasMesh: hasMesh,
        materials: materials,
        textureFile: textureFile,
        originalScene: originalScene || null, // 新增：原始场景对象
        interactionMapping: interactionMapping || null, // 新增：交互映射
        originalFileBuffer: originalFileBuffer || null, // 新增：原始文件ArrayBuffer
        // --- 关键修复：确保用解析结果中的labels来更新状态 ---
        labels: labels || [], // 使用从GLB文件中解析出的标签定义
        isPointCloudVisible: !hasMesh, // 如果有Mesh，默认隐藏点云
        selectedFaces: new Set(),
        fileHeader: header,
        fileFields: fields,
        labelInfo: finalLabelInfo,
        history: [...state.history, state.points],
        isNewFileLoaded: true, // 标记为新文件加载
      };
    case 'ADD_LABEL':
      return {
        ...state,
        labels: [...state.labels, action.payload],
      };
    case 'UPDATE_LABEL':
      return {
        ...state,
        labels: state.labels.map(label =>
          label.id === action.payload.id ? action.payload : label
        ),
      };
    case 'DELETE_LABEL':
      return {
        ...state,
        labels: state.labels.filter(label => label.id !== action.payload),
      };
    case 'SET_ACTIVE_LABEL':
      return {
        ...state,
        activeLabel: action.payload,
      };
    case 'SET_POINT_SIZE':
      return {
        ...state,
        pointSize: action.payload,
      };
    case 'SET_VIEW_MODE':
      return {
        ...state,
        viewMode: action.payload,
      };
    case 'SET_ANNOTATION_BOX':
      return {
        ...state,
        annotationBox: action.payload,
      };
    case 'SET_SELECTED_POINTS':
      // 只有当新选择与当前选择不同时才保存历史
      const newSelection = action.payload;
      const currentSelection = state.selectedPoints;
      
      // 比较数组是否相同
      const isSameSelection = newSelection.length === currentSelection.length && 
        newSelection.every((val, index) => val === currentSelection[index]);
      
      if (isSameSelection) {
        return state;
      }
      
      return {
        ...state,
        selectedPoints: newSelection,
        selectedFaces: new Set(), // 清空选中的面片
        isManualFaceSelection: false, // 重置手动选择标志
        selectedPointsHistory: [...state.selectedPointsHistory, currentSelection].slice(-10), // 最多保存10个历史记录
      };
    case 'APPLY_LABELS':
      const { pointIndices, labelId } = action.payload;
      
      // 使用Set提高查找性能
      const pointIndicesSet = new Set(pointIndices);
      
      const newPoints = state.points.map((point, index) => {
        if (pointIndicesSet.has(index)) {
          return { ...point, labelId: labelId };
        }
        return point;
      });
      
      // 防御性编程：安全地获取或初始化 labelInfo 和 labelStats
      const currentLabelInfo = state.labelInfo || { 
        labelStats: {}, 
        faceLabelStats: {}, 
        labeledCount: 0, 
        unlabeledCount: state.points.length,
        faceLabeledCount: 0,
        faceUnlabeledCount: 0
      };
      const currentLabelStats = currentLabelInfo.labelStats || {};
      
      // 增量更新标签统计信息而不是重新计算所有
      const labelStats = { ...currentLabelStats };
      let labeledCountDelta = 0;
      
      // 处理被修改的点
      pointIndices.forEach(index => {
        const oldPoint = state.points[index];
        const newPoint = newPoints[index];
        
        // 移除旧标签统计
        if (oldPoint.labelId && oldPoint.labelId !== 0) {
          const oldLabelKey = oldPoint.labelId.toString();
          labelStats[oldLabelKey] = (labelStats[oldLabelKey] || 1) - 1;
          if (labelStats[oldLabelKey] <= 0) {
            delete labelStats[oldLabelKey];
          }
          labeledCountDelta--;
        }
        
        // 添加新标签统计
        if (newPoint.labelId && newPoint.labelId !== 0) {
          const newLabelKey = newPoint.labelId.toString();
          labelStats[newLabelKey] = (labelStats[newLabelKey] || 0) + 1;
          labeledCountDelta++;
        }
      });
      
      const updatedLabelInfo = {
        ...currentLabelInfo,
        labeledCount: currentLabelInfo.labeledCount + labeledCountDelta,
        unlabeledCount: currentLabelInfo.unlabeledCount - labeledCountDelta,
        labelStats: labelStats
      };
      
      return {
        ...state,
        points: newPoints,
        labelInfo: updatedLabelInfo,
        history: [...state.history, state.points],
      };
    case 'UNDO':
      if (state.history.length > 0) {
        const previousState = state.history[state.history.length - 1];
        return {
          ...state,
          points: previousState,
          history: state.history.slice(0, -1),
        };
      }
      return state;
    case 'SET_FILE_NAME':
      return {
        ...state,
        fileName: action.payload,
        originalFileName: action.payload,
      };
    case 'TOGGLE_LABEL_VISIBILITY':
      return {
        ...state,
        labels: state.labels.map(label =>
          label.id === action.payload
            ? { ...label, visible: !label.visible }
            : label
        ),
      };
    case 'SET_BACKGROUND_COLOR':
      return {
        ...state,
        backgroundColor: action.payload
      };
    
    case 'SET_COLOR_ADJUSTMENT':
      return {
        ...state,
        colorAdjustment: {
          ...state.colorAdjustment,
          ...action.payload
        }
      };
    case 'SET_SHADING_MODE':
      return {
        ...state,
        shadingMode: action.payload
      };
    case 'SET_ORIENTATION_MODE':
      return {
        ...state,
        orientationMode: action.payload
      };
    case 'SET_TRANSFORM_MODE':
      return {
        ...state,
        transformMode: action.payload
      };
    case 'SET_POINT_CLOUD_ROTATION':
      return {
        ...state,
        pointCloudRotation: action.payload
      };
    case 'SET_POINT_CLOUD_POSITION':
      return {
        ...state,
        pointCloudPosition: action.payload
      };
    case 'SET_EDITOR_MODE':
      return {
        ...state,
        editorMode: action.payload
      };
    
    case 'SET_CENTER_OFFSET':
      return {
        ...state,
        centerOffset: action.payload
      };
    
    case 'UNDO_SELECTION':
      if (state.selectedPointsHistory.length > 0) {
        const previousSelection = state.selectedPointsHistory[state.selectedPointsHistory.length - 1];
        return {
          ...state,
          selectedPoints: previousSelection,
          selectedPointsHistory: state.selectedPointsHistory.slice(0, -1),
        };
      }
      return state;
      
    case 'CLEAR_SELECTION':
      return {
        ...state,
        selectedPoints: []
      };
    case 'INVERT_SELECTION':
      const totalPoints = state.points.length;
      const currentSelectionSet = new Set(state.selectedPoints);
      const invertedSelection = [];
      
      for (let i = 0; i < totalPoints; i++) {
        if (!currentSelectionSet.has(i)) {
          invertedSelection.push(i);
        }
      }
      
      let newState = {
        ...state,
        selectedPoints: invertedSelection
      };
      
      // 如果有mesh，也反选面片
      if (state.hasMesh && state.faces && state.faces.length > 0) {
        const totalFaces = state.faces.length;
        const currentFaceSelectionSet = new Set(state.selectedFaces);
        const invertedFaceSelection = [];
        
        for (let i = 0; i < totalFaces; i++) {
          if (!currentFaceSelectionSet.has(i)) {
            invertedFaceSelection.push(i);
          }
        }
        
        newState.selectedFaces = new Set(invertedFaceSelection);
      }
      
      return newState;
    
    // Mesh相关的actions
    case 'TOGGLE_POINT_CLOUD_VISIBILITY':
      return {
        ...state,
        isPointCloudVisible: !state.isPointCloudVisible
      };
    
    case 'TOGGLE_MESH_VISIBILITY':
      return {
        ...state,
        isMeshVisible: !state.isMeshVisible
      };
    
    case 'SET_MESH_SELECTION_MODE':
      return {
        ...state,
        meshSelectionMode: action.payload
      };
    
    case 'UPDATE_SELECTED_FACES':
      // 支持两种payload格式：直接数组或包含isManual标志的对象
      const isManual = action.payload.isManual || false;
      const selectedFacesData = action.payload.faces || action.payload;
      return {
        ...state,
        selectedFaces: new Set(selectedFacesData),
        isManualFaceSelection: isManual
      };
    
    case 'APPLY_LABEL_TO_FACES':
      if (!state.hasMesh) return state;
      
      const { faceIndices, labelId: faceLabelId } = action.payload;
      const faceIndicesSet = new Set(faceIndices);
      
      const updatedFaces = state.faces.map((face, index) => {
        if (faceIndicesSet.has(index)) {
          if (face.indices) {
            return { ...face, labelId: faceLabelId };
          } else {
            return { indices: face, labelId: faceLabelId };
          }
        }
        return face;
      });

      // 防御性编程：安全地获取或初始化面标注的 labelInfo
      const currentFaceLabelInfo = state.labelInfo || { 
        labelStats: {}, 
        faceLabelStats: {}, 
        labeledCount: 0, 
        unlabeledCount: state.points?.length || 0,
        faceLabeledCount: 0,
        faceUnlabeledCount: state.faces?.length || 0
      };
      
      // —— 同步更新面的标签统计 ——
      const faceLabelStats = { ...(currentFaceLabelInfo.faceLabelStats || {}) };
      let labeledFaceCountDelta = 0;

      faceIndices.forEach(index => {
        const oldFace = state.faces[index];
        const newFace = updatedFaces[index];

        // 移除旧标签统计
        if (oldFace && oldFace.labelId && oldFace.labelId !== 0 && oldFace.labelId !== -1) {
          const oldKey = oldFace.labelId.toString();
          faceLabelStats[oldKey] = (faceLabelStats[oldKey] || 1) - 1;
          if (faceLabelStats[oldKey] <= 0) {
            delete faceLabelStats[oldKey];
          }
          labeledFaceCountDelta--;
        }

        // 添加新标签统计
        if (newFace && newFace.labelId && newFace.labelId !== 0 && newFace.labelId !== -1) {
          const newKey = newFace.labelId.toString();
          faceLabelStats[newKey] = (faceLabelStats[newKey] || 0) + 1;
          labeledFaceCountDelta++;
        }
      });

      const updatedFaceLabelInfo = {
        ...currentFaceLabelInfo,
        faceLabelStats: faceLabelStats,
        faceLabeledCount: (currentFaceLabelInfo.faceLabeledCount || 0) + labeledFaceCountDelta,
        faceUnlabeledCount: (currentFaceLabelInfo.faceUnlabeledCount || 0) - labeledFaceCountDelta
      };

      return {
        ...state,
        faces: updatedFaces,
        labelInfo: updatedFaceLabelInfo
      };
    
    case 'SET_MESH_OPACITY':
      return {
        ...state,
        meshOpacity: action.payload
      };
    
    case 'SET_MODAL_OPEN':
      return {
        ...state,
        isModalOpen: action.payload
      };
    
    case 'TOGGLE_GRID_AND_AXES_VISIBILITY':
      return {
        ...state,
        showGridAndAxes: !state.showGridAndAxes
      };
    
    case 'TOGGLE_WIREFRAME':
      return {
        ...state,
        showWireframe: !state.showWireframe
      };
    
    case 'RESET_NEW_FILE_FLAG':
      return {
        ...state,
        isNewFileLoaded: false
      };
    
    default:
      return state;
  }
}

export function AnnotationProvider({ children }) {
  const [state, dispatch] = useReducer(annotationReducer, initialState);

  return (
    <AnnotationContext.Provider value={{ state, dispatch }}>
      {children}
    </AnnotationContext.Provider>
  );
}

export function useAnnotation() {
  const context = useContext(AnnotationContext);
  if (!context) {
    throw new Error('useAnnotation must be used within an AnnotationProvider');
  }
  return context;
}