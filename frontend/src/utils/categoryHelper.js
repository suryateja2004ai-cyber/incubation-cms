// src/utils/categoryHelper.js
// Pure JS Category Taxonomy & Hierarchy Resolution Helpers

/**
 * Resolves full hierarchical category breadcrumb path from a component or category ID.
 * @param {object | string} componentOrId 
 * @param {Array} categories 
 * @returns {Array<string>} Array of category names from Root to deepest Child
 */
export function resolveCategoryPath(componentOrId, categories = []) {
  if (!componentOrId) return ['Sensors & Electronic Modules'];

  // If passed an object with precomputed categoryPath
  if (typeof componentOrId === 'object' && componentOrId.categoryPath) {
    return componentOrId.categoryPath.split(' / ').map((s) => s.trim()).filter(Boolean);
  }

  const categoryId = typeof componentOrId === 'object' ? componentOrId.categoryId : componentOrId;

  if (categoryId && Array.isArray(categories) && categories.length > 0) {
    const path = [];
    let currentId = categoryId;
    const visited = new Set();
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const cat = categories.find((c) => c.id === currentId);
      if (!cat) break;
      path.unshift(cat.name);
      currentId = cat.parentId;
    }
    if (path.length > 0) return path;
  }

  // Fallback to parentCategory / category properties if available
  if (typeof componentOrId === 'object') {
    const parts = [];
    if (componentOrId.parentCategory) parts.push(componentOrId.parentCategory);
    if (componentOrId.category && componentOrId.category !== componentOrId.parentCategory) {
      parts.push(componentOrId.category);
    }
    if (parts.length > 0) return parts;
  }

  return [typeof componentOrId === 'string' ? componentOrId : 'Sensors & Electronic Modules'];
}

/**
 * Formats full hierarchy path string (e.g. "Development Boards / ESP Development Boards / ESP32").
 * @param {object | string} componentOrId 
 * @param {Array} categories 
 * @returns {string}
 */
export function formatCategoryPathString(componentOrId, categories = []) {
  const path = resolveCategoryPath(componentOrId, categories);
  return path.join(' / ');
}
