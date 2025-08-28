/**
 * Shared label color constants
 * Used to ensure consistency of label colors throughout the application
 */

// Predefined label color array
export const DEFAULT_LABEL_COLORS = [
  '#ff6b6b','#54a0ff', '#96ceb4','#4ecdc4', '#45b7d1',  '#feca57', 
  '#ff9ff3',  '#5f27cd', '#00d2d3', '#ff9f43',
  '#ee5a24', '#0abde3', '#10ac84', '#f9ca24', '#f0932b',
  '#eb4d4b', '#6c5ce7', '#a29bfe', '#fd79a8', '#e17055'
];

/**
 * Get default color based on label ID
 * @param {number} labelId - label ID
 * @returns {string} hexadecimal color value
 */
export function getDefaultColorForLabel(labelId) {
  if (labelId <= 0) {
    return '#cccccc'; // gray for invalid or special labels
  }
  return DEFAULT_LABEL_COLORS[(labelId - 1) % DEFAULT_LABEL_COLORS.length];
}

/**
 * Get default color based on index (for new labels)
 * @param {number} index - color index
 * @returns {string} hexadecimal color value
 */
export function getDefaultColorByIndex(index) {
  return DEFAULT_LABEL_COLORS[index % DEFAULT_LABEL_COLORS.length];
}