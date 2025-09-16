/**
 * 共享的标签颜色常量
 * 用于确保在整个应用中标签颜色的一致性
 */

// 预定义的标签颜色数组
export const DEFAULT_LABEL_COLORS = [
  '#ff6b6b','#54a0ff', '#96ceb4','#4ecdc4', '#45b7d1',  '#feca57', 
  '#ff9ff3',  '#5f27cd', '#00d2d3', '#ff9f43',
  '#ee5a24', '#0abde3', '#10ac84', '#f9ca24', '#f0932b',
  '#eb4d4b', '#6c5ce7', '#a29bfe', '#fd79a8', '#e17055'
];

// 语义标签颜色映射 - 使用 [R, G, B] 格式
export const SEMANTIC_LABEL_COLORS = {
  // 水体相关
  "water": [65, 105, 225],
  "swimming pool": [0, 191, 255],
  "sea": [70, 130, 180],
  "river": [135, 206, 250],
  "waterfall": [173, 216, 230],
  "lake": [95, 158, 160],
  
  // 地形相关
  "earth": [139, 69, 19],
  "mountain": [105, 105, 105],
  "field": [124, 252, 0],
  "rock": [128, 128, 128],
  "sand": [244, 164, 96],
  "land": [160, 82, 45],
  
  // 植被相关
  "tree": [0, 100, 0],
  "grass": [34, 139, 34],
  
  // 建筑结构
  "building": [210, 180, 140],
  "bridge": [119, 136, 153],
  "stairs": [192, 192, 192],
  "facility": [255, 140, 0],
  
  // 交通设施
  "road": [50, 50, 50],
  "vehicle": [220, 20, 60],
  "boat": [0, 128, 128],
  
  // 其他
  "unknown": [255, 0, 255]
};

/**
 * 根据标签ID获取默认颜色
 * @param {number} labelId - 标签ID
 * @returns {string} 十六进制颜色值
 */
export function getDefaultColorForLabel(labelId) {
  if (labelId <= 0) {
    return '#cccccc'; // 灰色用于无效或特殊标签
  }
  return DEFAULT_LABEL_COLORS[(labelId - 1) % DEFAULT_LABEL_COLORS.length];
}

/**
 * 根据索引获取默认颜色（用于新建标签）
 * @param {number} index - 颜色索引
 * @returns {string} 十六进制颜色值
 */
export function getDefaultColorByIndex(index) {
  return DEFAULT_LABEL_COLORS[index % DEFAULT_LABEL_COLORS.length];
}

/**
 * 将RGB数组转换为十六进制颜色值
 * @param {number[]} rgb - RGB颜色数组 [R, G, B]
 * @returns {string} 十六进制颜色值
 */
function rgbToHex(rgb) {
  return '#' + rgb.map(c => c.toString(16).padStart(2, '0')).join('');
}

/**
 * 根据标签名称获取语义颜色
 * @param {string} labelName - 标签名称
 * @param {number} fallbackIndex - 如果没有找到语义颜色时使用的默认颜色索引
 * @returns {string} 十六进制颜色值
 */
export function getSemanticColorForLabel(labelName, fallbackIndex = 0) {
  const normalizedName = labelName?.toLowerCase().trim();
  
  if (normalizedName && SEMANTIC_LABEL_COLORS[normalizedName]) {
    return rgbToHex(SEMANTIC_LABEL_COLORS[normalizedName]);
  }
  
  // 如果没有找到语义颜色，使用默认颜色
  return getDefaultColorByIndex(fallbackIndex);
}

/**
 * 获取所有可用的语义标签名称
 * @returns {string[]} 语义标签名称数组
 */
export function getAvailableSemanticLabels() {
  return Object.keys(SEMANTIC_LABEL_COLORS);
}