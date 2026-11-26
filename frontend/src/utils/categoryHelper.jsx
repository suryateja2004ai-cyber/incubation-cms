// src/utils/categoryHelper.jsx
// UI Component for Complete Category Hierarchy Breadcrumbs

import React from 'react';
import { ChevronRight, Folder } from 'lucide-react';
import { resolveCategoryPath, formatCategoryPathString } from './categoryHelper.js';

export { resolveCategoryPath, formatCategoryPathString };

/**
 * Clean React Component that renders a stylized, readable category hierarchy breadcrumb.
 */
export default function CategoryBreadcrumb({ component, categoryId, categories = [], fontSize = '0.75rem', maxLevels = 4 }) {
  const path = resolveCategoryPath(component || categoryId, categories).slice(0, maxLevels);

  if (!path || path.length === 0) return null;

  return (
    <span
      className="category-breadcrumb-trail"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.25rem',
        fontSize,
        color: 'var(--neutral-600, #475569)',
        fontWeight: 500,
      }}
    >
      <Folder size={12} style={{ color: 'var(--primary, #4f46e5)', marginRight: '2px', flexShrink: 0 }} />
      {path.map((segment, index) => {
        const isLast = index === path.length - 1;
        return (
          <React.Fragment key={index}>
            <span
              style={{
                color: isLast ? 'var(--neutral-900, #0f172a)' : 'var(--neutral-500, #64748b)',
                fontWeight: isLast ? 700 : 500,
                background: isLast ? '#f1f5f9' : 'transparent',
                padding: isLast ? '1px 5px' : '0',
                borderRadius: isLast ? '4px' : '0',
              }}
            >
              {segment}
            </span>
            {!isLast && (
              <ChevronRight size={10} style={{ color: 'var(--neutral-400, #94a3b8)', flexShrink: 0 }} />
            )}
          </React.Fragment>
        );
      })}
    </span>
  );
}
