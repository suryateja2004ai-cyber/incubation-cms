// src/pages/Components.jsx
// Inventory Management with Low-Stock Alerts, Damaged/Lost Tracking (NO Under-Maintenance),
// Individual Physical IDs, Threshold settings, and Advanced Search & Filtering.

import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Cpu,
  Edit2,
  Trash2,
  PlusCircle,
  Hash,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Layers,
  MapPin,
  X,
  Sliders,
  ShieldAlert,
  Flame,
  HelpCircle,
  FolderTree,
  List,
  Camera,
  Image as ImageIcon,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  Upload,
} from 'lucide-react';
import {
  getComponents,
  addComponent,
  updateComponent,
  addComponentQuantity,
  deleteComponent,
  setComponentThreshold,
  markComponentStatus,
  getUsableStock,
  isComponentLowStock,
  getComponentUsageStats,
  getCategories,
  getCategoryById,
  getCategoryPath,
  getCategoryTree,
  getCategoryDescendantIds,
  addCategory,
  updateCategory,
  deleteCategory,
  subscribeToDb,
  generateUniqueComponentTag,
  APPROVED_MAIN_CATEGORIES,
} from '../../db/database';
import CategoryBreadcrumb from '../../utils/categoryHelper.jsx';
import {
  checkCloudStorageAvailability,
  compressLocationPhoto,
  uploadLocationPhotoToCloud,
  getLocationPhotoUrl,
} from '../../services/storage/componentPhotoStorageService';

export const COMPONENT_CATEGORIES = [
  'All',
  ...(APPROVED_MAIN_CATEGORIES || [
    'Sensors & Electronic Modules',
    'Development Boards',
    'ICs & Electronic Components',
    'Displays & Indicators',
    'Motors & Drivers',
    'Power & Protection',
    'Lab Equipment & Accessories',
  ]),
];

export default function Components({ currentUser, onToast, isReadOnly = false }) {
  const isStaff = currentUser?.role === 'staff' || isReadOnly;
  const [componentsList, setComponentsList] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedCategoryId, setSelectedCategoryId] = useState('all');
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'low_stock' | 'damaged' | 'lost'
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  const [activeComponent, setActiveComponent] = useState(null);
  const [activeTagId, setActiveTagId] = useState(null);
  const [activePhotoUrl, setActivePhotoUrl] = useState('');
  const [activePhotoTitle, setActivePhotoTitle] = useState('');

  // Category Hierarchy States
  const [categories, setCategories] = useState([]);
  const [categoryTree, setCategoryTree] = useState([]);
  const [categoryLevels, setCategoryLevels] = useState([]); // Array of IDs selected at each level [rootId, child1Id, child2Id...]
  const [newCategoryForm, setNewCategoryForm] = useState({ name: '', parentId: null, description: '' });
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);

  // Storage Location Photo States
  const [locationPhotoFile, setLocationPhotoFile] = useState(null);
  const [locationPhotoPreview, setLocationPhotoPreview] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [cloudStorageStatus, setCloudStorageStatus] = useState({
    isConfigured: false,
    provider: null,
    message: '',
  });

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    category: 'Sensors & Electronic Modules',
    parentCategory: '',
    categoryId: null,
    categoryPath: '',
    componentNumber: '',
    description: '',
    trackingMode: 'aggregate',
    totalQuantity: 10,
    lowStockThreshold: 3,
    defaultOverdueDays: 7,
    location: '',
    locationPhotoUrl: '',
    locationPhotoRef: '',
    idPrefix: '',
  });

  const [restockQty, setRestockQty] = useState(5);
  const [thresholdInput, setThresholdInput] = useState(3);
  const [statusInput, setStatusInput] = useState('damaged'); // 'damaged' | 'lost' | 'available'
  const [statusNotes, setStatusNotes] = useState('');
  const [modalError, setModalError] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'tree'

  useEffect(() => {
    loadData();
    checkCloudStorageAvailability().then((status) => {
      setCloudStorageStatus(status);
    });
    const unsubscribe = subscribeToDb(() => loadData());
    return () => unsubscribe();
  }, [selectedCategory, selectedCategoryId, selectedSubcategoryId, searchQuery, statusFilter]);

  const isAnyModalOpen =
    isAddModalOpen ||
    isEditModalOpen ||
    isRestockModalOpen ||
    isInspectModalOpen ||
    isThresholdModalOpen ||
    isStatusModalOpen ||
    isCategoryModalOpen ||
    isPhotoModalOpen;

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isAnyModalOpen]);

  const autoTagPreview = isAddModalOpen
    ? generateUniqueComponentTag(formData.name, formData.categoryId)
    : '';

  function loadData() {
    const effectiveCatId =
      selectedSubcategoryId && selectedSubcategoryId !== 'all'
        ? selectedSubcategoryId
        : selectedCategoryId;
    const list = getComponents(selectedCategory, searchQuery, statusFilter, effectiveCatId);
    setComponentsList(list);
    setCategories(getCategories());
    setCategoryTree(getCategoryTree());
  }

  function getPathCategoryIds(leafCategoryId) {
    if (!leafCategoryId) return [];
    const all = getCategories();
    const ids = [];
    let cur = leafCategoryId;
    const visited = new Set();
    while (cur && !visited.has(cur)) {
      visited.add(cur);
      const cat = all.find((c) => c.id === cur);
      if (!cat) break;
      ids.unshift(cat.id);
      cur = cat.parentId;
    }
    return ids;
  }

  function openAddModal() {
    const roots = getCategories().filter((c) => !c.parentId);
    const defaultRoot = roots.find((r) => r.name === 'Sensors & Electronic Modules') || roots[0] || null;
    const defaultRootId = defaultRoot ? defaultRoot.id : null;
    const defaultRootName = defaultRoot ? defaultRoot.name : 'Sensors & Electronic Modules';

    setFormData({
      name: '',
      category: defaultRootName,
      parentCategory: '',
      categoryId: defaultRootId,
      categoryPath: defaultRootName,
      componentNumber: '',
      description: '',
      trackingMode: 'aggregate',
      totalQuantity: 10,
      lowStockThreshold: 3,
      defaultOverdueDays: 7,
      location: '',
      locationPhotoUrl: '',
      locationPhotoRef: '',
      idPrefix: '',
    });
    setCategoryLevels(defaultRootId ? [defaultRootId] : []);
    setLocationPhotoFile(null);
    setLocationPhotoPreview('');
    setModalError('');
    setIsAddModalOpen(true);
  }

  function openEditModal(comp) {
    setActiveComponent(comp);
    const pathIds = getPathCategoryIds(comp.categoryId);

    setFormData({
      name: comp.name,
      category: comp.category,
      parentCategory: comp.parentCategory || '',
      categoryId: comp.categoryId || null,
      categoryPath: comp.categoryPath || '',
      componentNumber: comp.componentNumber || '',
      description: comp.description || '',
      trackingMode: comp.trackingMode,
      totalQuantity: comp.totalQuantity,
      lowStockThreshold: comp.lowStockThreshold || 3,
      defaultOverdueDays: comp.defaultOverdueDays || 7,
      location: comp.location || comp.locationDetails || '',
      locationPhotoUrl: comp.locationPhotoUrl || '',
      locationPhotoRef: comp.locationPhotoRef || '',
      idPrefix: '',
    });
    setCategoryLevels(pathIds.length > 0 ? pathIds : (comp.categoryId ? [comp.categoryId] : []));
    setLocationPhotoFile(null);
    setLocationPhotoPreview(comp.locationPhotoUrl || '');
    setModalError('');
    setIsEditModalOpen(true);
  }

  function openPhotoModal(comp) {
    const resolvedUrl = getLocationPhotoUrl(comp.locationPhotoUrl || comp.locationPhotoRef, currentUser);
    setActivePhotoUrl(resolvedUrl || comp.locationPhotoUrl || '');
    setActivePhotoTitle(`${comp.name} — Storage Location: ${comp.location || 'Lab Shelf'}`);
    setActiveComponent(comp);
    setIsPhotoModalOpen(true);
  }

  async function handleLocationPhotoSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCompressingPhoto(true);
    setModalError('');
    try {
      const compressed = await compressLocationPhoto(file);
      setLocationPhotoFile(compressed.file);
      setLocationPhotoPreview(compressed.previewUrl);
    } catch (err) {
      setModalError(`Photo processing failed: ${err.message}`);
    } finally {
      setIsCompressingPhoto(false);
    }
  }

  function handleRemoveLocationPhoto() {
    setLocationPhotoFile(null);
    setLocationPhotoPreview('');
    setFormData((prev) => ({
      ...prev,
      locationPhotoUrl: '',
      locationPhotoRef: '',
    }));
  }

  // Update deepest selected category ID when level dropdown changes
  function handleCategoryLevelChange(levelIndex, selectedId) {
    const newLevels = categoryLevels.slice(0, levelIndex);
    if (selectedId) {
      newLevels.push(selectedId);
    }
    setCategoryLevels(newLevels);

    const deepestId = newLevels.length > 0 ? newLevels[newLevels.length - 1] : null;
    const fullPath = deepestId ? getCategoryPath(deepestId) : [];
    const rootName = fullPath[0] || 'Sensors & Electronic Modules';
    const subName = fullPath.length > 1 ? fullPath[1] : '';

    setFormData((prev) => ({
      ...prev,
      categoryId: deepestId,
      categoryPath: fullPath.join(' / '),
      category: rootName,
      parentCategory: subName,
    }));
  }

  async function handleCreateCategory(e) {
    e.preventDefault();
    setModalError('');
    try {
      if (!newCategoryForm.name.trim()) throw new Error('Category name cannot be empty.');
      if (!newCategoryForm.parentId) {
        throw new Error('Please select an existing parent category. Adding arbitrary new root categories outside the 7 approved main categories is not permitted.');
      }
      await addCategory(newCategoryForm, currentUser);
      setNewCategoryForm({ name: '', parentId: newCategoryForm.parentId, description: '' });
      if (onToast) onToast(`Category "${newCategoryForm.name.trim()}" created successfully!`);
      loadData();
    } catch (err) {
      setModalError(err.message);
    }
  }

  async function handleSaveCategoryEdit(e) {
    e.preventDefault();
    if (!editingCategory) return;
    setModalError('');
    try {
      await updateCategory(editingCategory.id, {
        name: editingCategory.name,
        description: editingCategory.description,
        parentId: editingCategory.parentId,
      }, currentUser);
      setEditingCategory(null);
      if (onToast) onToast('Category updated successfully.');
      loadData();
    } catch (err) {
      setModalError(err.message);
    }
  }

  async function handleDeleteCategory(catId) {
    const cat = getCategoryById(catId);
    const directComponents = componentsList.filter((c) => c.categoryId === catId);
    if (directComponents.length > 0) {
      alert(`Cannot delete category "${cat?.name || catId}": ${directComponents.length} component(s) are currently assigned to it. Please reassign these components first.`);
      return;
    }
    const descendants = getCategoryDescendantIds(catId);
    descendants.delete(catId);
    if (descendants.size > 0) {
      alert(`Cannot delete category "${cat?.name || catId}": child subcategories exist. Delete or reassign child subcategories first.`);
      return;
    }
    if (!confirm(`Are you sure you want to delete subcategory "${cat?.name || catId}"?`)) return;
    try {
      await deleteCategory(catId, currentUser);
      if (onToast) onToast('Category deleted.');
      loadData();
    } catch (err) {
      alert(err.message);
    }
  }

  function renderCategoryTreeNode(node, depth = 0) {
    const hasChildren = node.children && node.children.length > 0;
    const directComponents = componentsList.filter((c) => c.categoryId === node.id);
    const isRoot = depth === 0;

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            marginLeft: `${depth * 20}px`,
            background: isRoot ? '#f1f5f9' : '#ffffff',
            border: isRoot ? '1px solid var(--neutral-300)' : '1px solid var(--neutral-200)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '0.35rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--primary)', fontSize: isRoot ? '1rem' : '0.85rem' }}>
              {isRoot ? '📁' : '↳'}
            </span>
            <span style={{ fontWeight: isRoot ? 800 : 600, fontSize: isRoot ? '0.92rem' : '0.85rem', color: isRoot ? 'var(--neutral-900)' : 'var(--neutral-800)' }}>
              {node.name}
            </span>
            {isRoot && (
              <span className="badge badge-primary text-xs" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                Main Category
              </span>
            )}
            {directComponents.length > 0 && (
              <span className="badge badge-neutral text-xs" title="Components directly assigned to this category">
                {directComponents.length} {directComponents.length === 1 ? 'component' : 'components'}
              </span>
            )}
            {node.description && (
              <span className="text-muted text-xs">({node.description})</span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <button
              type="button"
              className="btn-icon"
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.45rem', color: 'var(--primary)', fontWeight: 600 }}
              onClick={() => {
                setEditingCategory(null);
                setNewCategoryForm({ name: '', parentId: node.id, description: '' });
              }}
              title={`Add child subcategory under ${node.name}`}
            >
              + Subcategory
            </button>
            {!isRoot && (
              <>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ color: 'var(--neutral-700)', padding: '0.25rem' }}
                  onClick={() => {
                    setEditingCategory({
                      id: node.id,
                      name: node.name,
                      description: node.description || '',
                      parentId: node.parentId,
                    });
                  }}
                  title="Edit Subcategory"
                >
                  <Edit2 size={13} />
                </button>
                <button
                  type="button"
                  className="btn-icon"
                  style={{ color: 'var(--danger)', padding: '0.25rem' }}
                  onClick={() => handleDeleteCategory(node.id)}
                  title="Delete Subcategory"
                >
                  <Trash2 size={13} />
                </button>
              </>
            )}
          </div>
        </div>

        {hasChildren && node.children.map((child) => renderCategoryTreeNode(child, depth + 1))}
      </div>
    );
  }

  function openThresholdModal(comp) {
    setActiveComponent(comp);
    setThresholdInput(comp.lowStockThreshold || 0);
    setModalError('');
    setIsThresholdModalOpen(true);
  }

  function openStatusModal(comp, tagId = null) {
    setActiveComponent(comp);
    setActiveTagId(tagId);
    setStatusInput('damaged');
    setStatusNotes('');
    setModalError('');
    setIsStatusModalOpen(true);
  }

  async function handleSaveAdd(e) {
    e.preventDefault();
    if (isStaff) {
      if (onToast) onToast('Access Denied: Staff accounts have read-only access to component inventory.');
      return;
    }
    setModalError('');
    try {
      if (!formData.name.trim()) throw new Error('Component Name is required.');

      let finalPhotoUrl = formData.locationPhotoUrl;
      let finalPhotoRef = formData.locationPhotoRef;

      if (locationPhotoFile) {
        if (!cloudStorageStatus.isConfigured) {
          throw new Error(
            `Location photo cannot be uploaded: ${cloudStorageStatus.message}`
          );
        }
        setIsUploadingPhoto(true);
        const uploadRes = await uploadLocationPhotoToCloud(locationPhotoFile, formData.componentNumber || 'new_comp', currentUser);
        finalPhotoUrl = uploadRes.url;
        finalPhotoRef = uploadRes.ref;
      }

      await addComponent({
        ...formData,
        locationPhotoUrl: finalPhotoUrl,
        locationPhotoRef: finalPhotoRef,
      }, currentUser);

      setIsAddModalOpen(false);
      if (onToast) onToast(`Component "${formData.name}" added successfully!`);
      loadData();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    if (isStaff) {
      if (onToast) onToast('Access Denied: Staff accounts have read-only access to component inventory.');
      return;
    }
    setModalError('');
    try {
      let finalPhotoUrl = formData.locationPhotoUrl;
      let finalPhotoRef = formData.locationPhotoRef;

      if (locationPhotoFile) {
        if (!cloudStorageStatus.isConfigured) {
          throw new Error(
            `Location photo cannot be uploaded: ${cloudStorageStatus.message}`
          );
        }
        setIsUploadingPhoto(true);
        const uploadRes = await uploadLocationPhotoToCloud(locationPhotoFile, activeComponent.id, currentUser);
        finalPhotoUrl = uploadRes.url;
        finalPhotoRef = uploadRes.ref;
      }

      await updateComponent(activeComponent.id, {
        ...formData,
        locationPhotoUrl: finalPhotoUrl,
        locationPhotoRef: finalPhotoRef,
      }, currentUser);

      setIsEditModalOpen(false);
      if (onToast) onToast(`Component "${formData.name}" updated.`);
      loadData();
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function handleSaveThreshold(e) {
    e.preventDefault();
    try {
      setComponentThreshold(activeComponent.id, thresholdInput, currentUser);
      setIsThresholdModalOpen(false);
      if (onToast) onToast(`Low-stock threshold set to ${thresholdInput} for ${activeComponent.name}.`);
    } catch (err) {
      setModalError(err.message);
    }
  }

  function handleSaveStatus(e) {
    e.preventDefault();
    try {
      markComponentStatus({
        componentId: activeComponent.id,
        status: statusInput,
        individualTagId: activeTagId,
        notes: statusNotes,
        actor: currentUser,
      });
      setIsStatusModalOpen(false);
      if (onToast) onToast(`Marked ${activeComponent.name} as ${statusInput}.`);
    } catch (err) {
      setModalError(err.message);
    }
  }

  function handleDelete(comp) {
    if (isStaff) {
      if (onToast) onToast('Access Denied: Staff accounts have read-only access to component inventory.');
      return;
    }
    if (comp.issuedQuantity > 0) {
      alert(`Cannot delete "${comp.name}" because ${comp.issuedQuantity} unit(s) are currently issued.`);
      return;
    }
    if (confirm(`Delete component "${comp.name}"?`)) {
      try {
        deleteComponent(comp.id, currentUser);
        if (onToast) onToast(`Component "${comp.name}" deleted.`);
      } catch (err) {
        alert(err.message);
      }
    }
  }

  return (
    <div>
      {/* Header & Actions */}
      <div className="flex-between" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--neutral-900)' }}>
            Component & Lab Inventory
          </h2>
          <p className="text-muted" style={{ fontSize: '0.88rem' }}>
            Dual-mode stock management with low-stock alerts, Damaged/Lost tracking, and individual physical tags
          </p>
        </div>
        {!isStaff && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setModalError('');
                setIsCategoryModalOpen(true);
              }}
            >
              <FolderTree size={16} /> Manage Categories
            </button>
            <button type="button" className="btn btn-primary" onClick={openAddModal}>
              <Plus size={18} /> Add New Component
            </button>
          </div>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div className="card-body" style={{ padding: '0.85rem 1rem' }}>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '1rem' }}>
            <div className="search-wrapper" style={{ maxWidth: '360px' }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="input-field search-input"
                data-tour="components-search-input"
                placeholder="Search by name, category, or physical tag ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Status Filter Tabs (Low Stock, Damaged, Lost) */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {[
                { id: 'all', label: 'All Inventory' },
                { id: 'low_stock', label: 'Low-Stock Alerts', badgeColor: 'var(--danger)' },
                { id: 'damaged', label: 'Damaged' },
                { id: 'lost', label: 'Lost Items' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`btn-badge ${statusFilter === tab.id ? 'active' : ''}`}
                  style={{
                    background: statusFilter === tab.id ? 'var(--neutral-900)' : '#f1f5f9',
                    color: statusFilter === tab.id ? '#fff' : '#475569',
                    padding: '0.4rem 0.85rem',
                  }}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                </button>
              ))}

              {/* View Mode Toggle: List vs Hierarchy Tree */}
              <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem', borderLeft: '1px solid var(--neutral-300)', paddingLeft: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: viewMode === 'list' ? 'var(--primary)' : '#f1f5f9',
                    color: viewMode === 'list' ? '#fff' : 'var(--neutral-700)',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  onClick={() => setViewMode('list')}
                  title="Table List View"
                >
                  <List size={14} /> List
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    background: viewMode === 'tree' ? 'var(--primary)' : '#f1f5f9',
                    color: viewMode === 'tree' ? '#fff' : 'var(--neutral-700)',
                    padding: '0.35rem 0.65rem',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                  onClick={() => setViewMode('tree')}
                  title="Category Hierarchy View"
                >
                  <FolderTree size={14} /> Hierarchy
                </button>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div data-tour="components-category-filter" style={{ display: 'flex', gap: '0.35rem', overflowX: 'auto', paddingBottom: '0.25rem', marginTop: '0.75rem', alignItems: 'center' }}>
            <button
              type="button"
              className={`btn-badge ${selectedCategoryId === 'all' && selectedCategory === 'All' ? 'active' : ''}`}
              style={{
                background: selectedCategoryId === 'all' && selectedCategory === 'All' ? 'var(--neutral-800)' : '#f1f5f9',
                color: selectedCategoryId === 'all' && selectedCategory === 'All' ? '#fff' : '#475569',
                padding: '0.25rem 0.65rem',
                fontSize: '0.75rem',
                borderRadius: '999px',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
              onClick={() => {
                setSelectedCategory('All');
                setSelectedCategoryId('all');
                setSelectedSubcategoryId('all');
              }}
            >
              All
            </button>
            {categoryTree && categoryTree.length > 0
              ? categoryTree.map((rootCat) => (
                  <button
                    key={rootCat.id}
                    type="button"
                    className={`btn-badge ${selectedCategoryId === rootCat.id ? 'active' : ''}`}
                    style={{
                      background: selectedCategoryId === rootCat.id ? 'var(--neutral-800)' : '#f1f5f9',
                      color: selectedCategoryId === rootCat.id ? '#fff' : '#475569',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.75rem',
                      borderRadius: '999px',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      setSelectedCategory(rootCat.name);
                      setSelectedCategoryId(rootCat.id);
                      setSelectedSubcategoryId('all');
                    }}
                  >
                    {rootCat.name}
                  </button>
                ))
              : COMPONENT_CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`btn-badge ${selectedCategory === cat ? 'active' : ''}`}
                    style={{
                      background: selectedCategory === cat ? 'var(--neutral-800)' : '#f1f5f9',
                      color: selectedCategory === cat ? '#fff' : '#475569',
                      padding: '0.25rem 0.65rem',
                      fontSize: '0.75rem',
                      borderRadius: '999px',
                      border: 'none',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setSelectedCategoryId('all');
                      setSelectedSubcategoryId('all');
                    }}
                  >
                    {cat}
                  </button>
                ))}
          </div>

          {/* Subcategory Filter Pills (Shown when a main category is selected) */}
          {selectedCategoryId !== 'all' && (
            <div
              style={{
                display: 'flex',
                gap: '0.35rem',
                overflowX: 'auto',
                padding: '0.35rem 0.6rem',
                marginTop: '0.5rem',
                alignItems: 'center',
                background: '#f8fafc',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--neutral-200)',
              }}
            >
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--neutral-500)', whiteSpace: 'nowrap', marginRight: '0.25rem' }}>
                Subcategories:
              </span>
              <button
                type="button"
                className={`btn-badge ${selectedSubcategoryId === 'all' ? 'active' : ''}`}
                style={{
                  background: selectedSubcategoryId === 'all' ? 'var(--primary)' : '#ffffff',
                  color: selectedSubcategoryId === 'all' ? '#fff' : 'var(--neutral-700)',
                  border: '1px solid var(--neutral-300)',
                  padding: '0.2rem 0.55rem',
                  fontSize: '0.72rem',
                  borderRadius: '999px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onClick={() => setSelectedSubcategoryId('all')}
              >
                All Subcategories
              </button>
              {categories
                .filter((c) => c.parentId === selectedCategoryId)
                .map((subCat) => (
                  <button
                    key={subCat.id}
                    type="button"
                    className={`btn-badge ${selectedSubcategoryId === subCat.id ? 'active' : ''}`}
                    style={{
                      background: selectedSubcategoryId === subCat.id ? 'var(--primary)' : '#ffffff',
                      color: selectedSubcategoryId === subCat.id ? '#fff' : 'var(--neutral-700)',
                      border: '1px solid var(--neutral-300)',
                      padding: '0.2rem 0.55rem',
                      fontSize: '0.72rem',
                      borderRadius: '999px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => setSelectedSubcategoryId(subCat.id)}
                  >
                    {subCat.name}
                  </button>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Main View: Hierarchy Tree or Table */}
      {viewMode === 'tree' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {(() => {
            const approvedOrder = APPROVED_MAIN_CATEGORIES || [];
            const orderedCategories = approvedOrder.filter((mainCat) =>
              componentsList.some((c) => c.category === mainCat)
            );
            const extraCategories = Array.from(
              new Set(
                componentsList
                  .map((c) => c.category)
                  .filter((cat) => cat && !approvedOrder.includes(cat))
              )
            );
            const categoriesInList = [...orderedCategories, ...extraCategories];

            if (categoriesInList.length === 0) {
              return (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--neutral-500)' }}>
                  No components match your search or filter.
                </div>
              );
            }
            return categoriesInList.map((cat) => {
              const catItems = componentsList.filter((c) => c.category === cat);
              const parentMap = {};
              catItems.forEach((c) => {
                const p = c.parentCategory && c.parentCategory.trim()
                  ? c.parentCategory.trim()
                  : (c.categoryPath && c.categoryPath.includes('/') ? c.categoryPath.split('/')[1].trim() : 'General / Direct Items');
                if (!parentMap[p]) parentMap[p] = [];
                parentMap[p].push(c);
              });

              return (
                <div key={cat} className="card" style={{ overflow: 'hidden' }}>
                  <div
                    className="card-header flex-between"
                    style={{ background: '#f8fafc', borderBottom: '1px solid var(--neutral-200)', padding: '0.85rem 1.25rem' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FolderTree size={18} className="text-primary" />
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>{cat}</h3>
                      <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                        {catItems.length} items
                      </span>
                    </div>
                    <span className="text-xs text-muted" style={{ fontStyle: 'italic' }}>
                      Main Category → Subcategory → Components
                    </span>
                  </div>

                  <div className="card-body" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {Object.entries(parentMap).map(([parentGroup, items]) => (
                      <div key={parentGroup} style={{ borderLeft: '3px solid var(--primary-light)', paddingLeft: '1rem', marginLeft: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.6rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--neutral-700)' }}>
                            📂 {parentGroup}
                          </span>
                          <span className="badge badge-neutral text-xs">{items.length}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem' }}>
                          {items.map((comp) => {
                            const usable = getUsableStock(comp);
                            const isLow = isComponentLowStock(comp);
                            return (
                              <div
                                key={comp.id}
                                style={{
                                  border: '1px solid var(--neutral-200)',
                                  borderRadius: 'var(--radius-md)',
                                  padding: '0.85rem',
                                  background: isLow ? '#fffbeb' : '#fff',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: '0.5rem',
                                }}
                              >
                                <div className="flex-between" style={{ alignItems: 'flex-start' }}>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--neutral-900)' }}>
                                      {comp.name}
                                    </div>
                                    <div className="font-mono text-xs text-muted">
                                      {comp.componentNumber ? `Tag: ${comp.componentNumber}` : `ID: ${comp.id}`}
                                    </div>
                                  </div>
                                  {isLow && (
                                    <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>
                                      Low Stock
                                    </span>
                                  )}
                                </div>

                                <div style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between', color: 'var(--neutral-600)' }}>
                                  <span>Usable: <strong style={{ color: isLow ? 'var(--danger-text)' : 'var(--neutral-900)' }}>{usable}</strong></span>
                                  <span>Avail: <strong style={{ color: 'var(--success-text)' }}>{comp.availableQuantity}</strong></span>
                                  <span>Issued: <strong>{comp.issuedQuantity}</strong></span>
                                </div>

                                {(comp.location || comp.locationPhotoUrl || comp.locationPhotoRef) && (
                                  <div className="text-xs text-muted flex-between" style={{ alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                      <MapPin size={12} /> {comp.location || 'Lab Shelf'}
                                    </span>
                                    {(comp.locationPhotoUrl || comp.locationPhotoRef) && (
                                      <button
                                        type="button"
                                        className="btn-link text-xs"
                                        style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--primary)', cursor: 'pointer' }}
                                        onClick={() => openPhotoModal(comp)}
                                        title="View Storage Location Photo"
                                      >
                                        <Camera size={12} /> Photo
                                      </button>
                                    )}
                                  </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem', marginTop: '0.25rem', borderTop: '1px solid var(--neutral-100)', paddingTop: '0.5rem' }}>
                                  <button
                                    type="button"
                                    className="btn-icon"
                                    onClick={() => openStatusModal(comp)}
                                    title="Mark Condition"
                                  >
                                    <ShieldAlert size={14} style={{ color: '#d97706' }} />
                                  </button>
                                  {!isStaff && (
                                    <>
                                      <button
                                        type="button"
                                        className="btn-icon"
                                        onClick={() => openEditModal(comp)}
                                        title="Edit"
                                      >
                                        <Edit2 size={14} style={{ color: 'var(--primary)' }} />
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-icon"
                                        onClick={() => handleDelete(comp)}
                                        title="Delete"
                                        disabled={comp.issuedQuantity > 0}
                                      >
                                        <Trash2 size={14} style={{ color: comp.issuedQuantity > 0 ? 'var(--neutral-300)' : 'var(--danger)' }} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            });
          })()}
        </div>
      ) : (
        /* Inventory Table */
        <div className="card" data-tour="components-table">
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Component</th>
                  <th>Category</th>
                  <th>Usable vs Threshold</th>
                  <th>Stock Breakdown</th>
                  <th>Physical ID Tags</th>
                  <th>Location</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {componentsList.length > 0 ? (
                  componentsList.map((comp) => {
                    const usableStock = getUsableStock(comp);
                    const threshold = comp.lowStockThreshold || 0;
                    const isLow = isComponentLowStock(comp);

                    return (
                      <tr key={comp.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: 'var(--neutral-900)', fontSize: '0.95rem' }}>
                              {comp.name}
                            </span>
                            {comp.componentNumber && (
                              <span className="badge badge-primary font-mono text-xs">
                                {comp.componentNumber}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-xs text-muted">
                            ID: {comp.id} • Loan: {comp.defaultOverdueDays || 7}d
                          </div>
                        </td>

                        <td>
                          <CategoryBreadcrumb component={comp} categories={categories} fontSize="0.78rem" />
                        </td>

                        {/* LOW-STOCK THRESHOLD & USABLE STOCK CALCULATION */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <strong style={{ fontSize: '1rem', color: isLow ? 'var(--danger-text)' : 'var(--neutral-900)' }}>
                              {usableStock}
                            </strong>
                            <span className="text-muted text-xs">/ threshold {threshold}</span>
                            <button
                              type="button"
                              className="btn-icon"
                              style={{ padding: '0.2rem' }}
                              onClick={() => openThresholdModal(comp)}
                              title="Edit Minimum Low-Stock Threshold"
                            >
                              <Sliders size={13} />
                            </button>
                          </div>

                          {usableStock === 0 ? (
                            <span className="badge badge-danger" style={{ marginTop: '0.25rem', background: '#7f1d1d', color: '#fff' }}>
                              <AlertCircle size={11} /> Unavailable (0 Stock)
                            </span>
                          ) : isLow ? (
                            <span className="badge badge-danger" style={{ marginTop: '0.25rem' }}>
                              <AlertTriangle size={11} /> Low Stock Alert
                            </span>
                          ) : (
                            <span className="badge badge-success" style={{ marginTop: '0.25rem' }}>
                              Adequate Stock
                            </span>
                          )}
                        </td>

                        {/* DETAILED STOCK BREAKDOWN (Available, Issued, Damaged, Lost) */}
                        <td>
                          <div className="text-xs" style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span>Avail: <strong style={{ color: 'var(--success-text)' }}>{comp.availableQuantity}</strong></span>
                            <span>Issued: <strong>{comp.issuedQuantity}</strong></span>
                            {comp.damagedQuantity > 0 && (
                              <span style={{ color: '#d97706' }}>Damaged: <strong>{comp.damagedQuantity}</strong></span>
                            )}
                            {comp.lostQuantity > 0 && (
                              <span style={{ color: 'var(--danger-text)' }}>Lost: <strong>{comp.lostQuantity}</strong></span>
                            )}
                          </div>
                        </td>

                        {/* INDIVIDUAL PHYSICAL TAGS */}
                        <td>
                          {comp.trackingMode === 'individual' ? (
                            <div>
                              <button
                                type="button"
                                className="btn-link text-xs font-mono"
                                onClick={() => {
                                  setActiveComponent(comp);
                                  setIsInspectModalOpen(true);
                                }}
                              >
                                <Hash size={12} /> {comp.individualIds?.length || 0} Physical Tags
                              </button>
                            </div>
                          ) : (
                            <span className="badge badge-neutral text-xs">
                              <Layers size={11} /> Bulk
                            </span>
                          )}
                        </td>

                        <td className="text-sm">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span>{comp.location || <span className="text-muted">—</span>}</span>
                            {(comp.locationPhotoUrl || comp.locationPhotoRef) && (
                              <button
                                type="button"
                                className="btn-icon"
                                style={{ padding: '0.2rem', color: 'var(--primary)' }}
                                onClick={() => openPhotoModal(comp)}
                                title="View Storage Location Photo"
                              >
                                <Camera size={14} />
                              </button>
                            )}
                          </div>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => openStatusModal(comp)}
                              title="Mark Damaged or Lost"
                            >
                              <ShieldAlert size={16} style={{ color: '#d97706' }} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon"
                              onClick={() => {
                                setActiveComponent(comp);
                                setIsInspectModalOpen(true);
                              }}
                              title="Inspect physical tags & student borrowing usage statistics"
                            >
                              <FolderTree size={16} style={{ color: '#0ea5e9' }} />
                            </button>
                            {!isStaff && (
                              <>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => openEditModal(comp)}
                                  title="Edit component"
                                >
                                  <Edit2 size={16} style={{ color: 'var(--primary)' }} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon"
                                  onClick={() => handleDelete(comp)}
                                  title="Delete"
                                  disabled={comp.issuedQuantity > 0}
                                >
                                  <Trash2 size={16} style={{ color: comp.issuedQuantity > 0 ? 'var(--neutral-300)' : 'var(--danger)' }} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }} className="text-muted">
                      No components found matching your filter or search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ==================== THRESHOLD CONFIGURATION MODAL ==================== */}
      {isThresholdModalOpen && activeComponent && (
        <div className="modal-overlay" onClick={() => setIsThresholdModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveThreshold}>
              <div className="modal-header">
                <div className="modal-title-group">
                  <Sliders className="icon-primary" size={22} />
                  <div>
                    <h3 className="modal-title">Low-Stock Alert Threshold</h3>
                    <p className="modal-subtitle">{activeComponent.name}</p>
                  </div>
                </div>
                <button type="button" className="btn-icon" onClick={() => setIsThresholdModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="input-label">Minimum Usable Stock Threshold</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={thresholdInput}
                    onChange={(e) => setThresholdInput(e.target.value)}
                    required
                    autoFocus
                  />
                  <span className="input-hint">
                    Alert triggers when Usable Stock (Available + Issued) drops below this number.
                    <br />
                    <strong>Note:</strong> Lost components do not count towards usable stock.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsThresholdModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Threshold
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MARK DAMAGED / LOST MODAL ==================== */}
      {isStatusModalOpen && activeComponent && (
        <div className="modal-overlay" onClick={() => setIsStatusModalOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveStatus}>
              <div className="modal-header">
                <div className="modal-title-group">
                  <ShieldAlert className="icon-primary" size={22} style={{ color: 'var(--danger)' }} />
                  <div>
                    <h3 className="modal-title">Mark Component Condition</h3>
                    <p className="modal-subtitle">{activeComponent.name} {activeTagId ? `(${activeTagId})` : ''}</p>
                  </div>
                </div>
                <button type="button" className="btn-icon" onClick={() => setIsStatusModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                <div className="form-group">
                  <label className="input-label">Condition Status</label>
                  <select
                    className="select-field"
                    value={statusInput}
                    onChange={(e) => setStatusInput(e.target.value)}
                  >
                    <option value="damaged">Damaged (Physical unit exists but cannot be issued)</option>
                    <option value="lost">Lost (Unit missing / unaccounted for)</option>
                    <option value="available">Restored to Available</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="input-label">Reason / Condition Details</label>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Broken header pins / Missing after mini-project exhibition"
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsStatusModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Status Change
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== PHYSICAL TAGS & USAGE INSPECTOR MODAL ==================== */}
      {isInspectModalOpen && activeComponent && (() => {
        const usage = getComponentUsageStats(activeComponent.id);
        return (
          <div className="modal-overlay" onClick={() => setIsInspectModalOpen(false)}>
            <div className="modal-card modal-lg" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <div className="modal-title-group">
                  <Hash className="icon-primary" size={22} />
                  <div>
                    <h3 className="modal-title">{activeComponent.name}</h3>
                    <div className="modal-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                      {activeComponent.componentNumber && (
                        <span className="badge badge-primary font-mono text-xs">
                          Tag: {activeComponent.componentNumber}
                        </span>
                      )}
                      <CategoryBreadcrumb component={activeComponent} categories={categories} fontSize="0.82rem" />
                    </div>
                  </div>
                </div>
                <button type="button" className="btn-icon" onClick={() => setIsInspectModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                {/* 1. Student Usage Statistics Section */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Cpu size={16} className="text-primary" />
                    <span>Student Borrowing & Usage Statistics</span>
                  </h4>

                  {usage && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.65rem', marginBottom: '1rem' }}>
                      <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                        <span className="text-xs text-muted" style={{ display: 'block' }}>Times Borrowed</span>
                        <strong style={{ fontSize: '1.15rem', color: 'var(--primary)' }}>{usage.totalTimesBorrowed}</strong>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                        <span className="text-xs text-muted" style={{ display: 'block' }}>Total Taken</span>
                        <strong style={{ fontSize: '1.15rem', color: '#0ea5e9' }}>{usage.totalQuantityIssued}</strong>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                        <span className="text-xs text-muted" style={{ display: 'block' }}>Borrowers</span>
                        <strong style={{ fontSize: '1.15rem', color: '#10b981' }}>{usage.distinctBorrowersCount}</strong>
                      </div>
                      <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-200)' }}>
                        <span className="text-xs text-muted" style={{ display: 'block' }}>Usable Stock</span>
                        <strong style={{ fontSize: '1.15rem', color: usage.usableStock === 0 ? 'var(--danger)' : '#059669' }}>
                          {usage.usableStock}
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Top Frequent Student Borrowers */}
                  {usage && usage.topBorrowers && usage.topBorrowers.length > 0 && (
                    <div style={{ marginBottom: '1rem' }}>
                      <span className="text-xs text-muted" style={{ fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: '0.35rem' }}>
                        Frequent Student Borrowers
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {usage.topBorrowers.map((b, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: '#e0e7ff',
                              color: '#3730a3',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.55rem',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            {b.name} ({b.roll}) — {b.count} unit{b.count !== 1 ? 's' : ''}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Individual Physical Serial ID Tags (if individual mode) */}
                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 800, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Hash size={16} className="text-primary" />
                    <span>Individual Physical ID Tags</span>
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                    {activeComponent.individualIds && activeComponent.individualIds.length > 0 ? (
                      activeComponent.individualIds.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            border: '1px solid var(--neutral-200)',
                            borderRadius: 'var(--radius-md)',
                            padding: '0.75rem',
                            background:
                              item.status === 'damaged'
                                ? '#fef3c7'
                                : item.status === 'lost'
                                ? '#fee2e2'
                                : item.status === 'issued'
                                ? 'var(--warning-light)'
                                : 'var(--success-light)',
                          }}
                        >
                          <div className="flex-between">
                            <span className="font-mono" style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                              {item.id}
                            </span>
                            <span
                              className={`badge ${
                                item.status === 'damaged'
                                  ? 'badge-warning'
                                  : item.status === 'lost'
                                  ? 'badge-danger'
                                  : item.status === 'issued'
                                  ? 'badge-info'
                                  : 'badge-success'
                              }`}
                            >
                              {item.status.toUpperCase()}
                            </span>
                          </div>

                          {item.notes && (
                            <div className="text-xs text-muted" style={{ marginTop: '0.35rem' }}>
                              {item.notes}
                            </div>
                          )}

                          <div style={{ marginTop: '0.5rem', textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn-link text-xs"
                              onClick={() => {
                                setIsInspectModalOpen(false);
                                openStatusModal(activeComponent, item.id);
                              }}
                            >
                              Change Status
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-muted" style={{ padding: '1.25rem', textAlign: 'center', gridColumn: '1/-1', background: '#f8fafc', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                        This is an aggregate bulk component (counted by quantity). No individual physical serial barcode tags needed.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsInspectModalOpen(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== ADD COMPONENT MODAL ==================== */}
      {isAddModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAddModalOpen(false)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveAdd}>
              <div className="modal-header">
                <h3 className="modal-title">Add Electronic Component</h3>
                <button type="button" className="btn-icon" onClick={() => setIsAddModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                {modalError && (
                  <div
                    style={{
                      background: '#fee2e2',
                      border: '1px solid #f87171',
                      color: '#991b1b',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '1rem',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="review-grid">
                  <div className="form-group">
                    <label className="input-label">Component Name *</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. ESP32-WROOM-32"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <div className="flex-between" style={{ marginBottom: '0.25rem' }}>
                      <label className="input-label" style={{ margin: 0 }}>Unique Component Tag</label>
                      <span className="badge badge-primary font-mono" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                        Auto-Generated
                      </span>
                    </div>
                    <input
                      type="text"
                      className="input-field font-mono"
                      value={formData.name.trim() ? autoTagPreview : 'Automatically generated upon saving'}
                      readOnly
                      disabled
                      style={{ background: '#f8fafc', color: '#334155', fontWeight: 600, cursor: 'not-allowed' }}
                    />
                    <span className="input-hint">
                      Collision-free tag auto-assigned across full inventory (e.g. {formData.name.trim() ? autoTagPreview : 'ESP32-001'})
                    </span>
                  </div>
                </div>

                {/* Multi-Level Cascading Category Hierarchy */}
                <div className="form-group">
                  <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
                    <label className="input-label" style={{ margin: 0 }}>Category Hierarchy (Multi-Level) *</label>
                    <button
                      type="button"
                      className="btn-link text-xs"
                      onClick={() => setIsCategoryModalOpen(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <FolderTree size={13} /> Manage Category Tree
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                    {Array.from({ length: categoryLevels.length + 1 }).map((_, idx) => {
                      const parentId = idx === 0 ? null : categoryLevels[idx - 1];
                      if (idx > 0 && !parentId) return null;
                      let options = categories.filter((c) => (idx === 0 ? !c.parentId : c.parentId === parentId));
                      if (idx === 0) {
                        options = [...options].sort((a, b) => {
                          const ia = APPROVED_MAIN_CATEGORIES.indexOf(a.name);
                          const ib = APPROVED_MAIN_CATEGORIES.indexOf(b.name);
                          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                        });
                      }
                      if (options.length === 0) return null;
                      const currentSelected = categoryLevels[idx] || '';

                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {idx > 0 && <span className="text-muted" style={{ fontSize: '0.8rem' }}>›</span>}
                          <select
                            className="select-field"
                            style={{ width: 'auto', minWidth: '160px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            value={currentSelected}
                            onChange={(e) => handleCategoryLevelChange(idx, e.target.value)}
                          >
                            <option value="">{idx === 0 ? '-- Select Main Category * --' : '-- Select Subcategory (Optional) --'}</option>
                            {options.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {formData.categoryPath && (
                    <div className="text-xs" style={{ background: '#f8fafc', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span className="text-muted">Selected Taxonomy:</span>
                      <strong style={{ color: 'var(--primary)' }}>{formData.categoryPath}</strong>
                    </div>
                  )}
                </div>

                <div className="review-grid">
                  <div className="form-group">
                    <label className="input-label">Total Quantity *</label>
                    <input
                      type="number"
                      min={1}
                      className="input-field"
                      value={formData.totalQuantity}
                      onChange={(e) => setFormData({ ...formData, totalQuantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="input-label">Minimum Low-Stock Threshold</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field"
                      value={formData.lowStockThreshold}
                      onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                    />
                  </div>
                </div>

                <div className="review-grid">
                  <div className="form-group">
                    <label className="input-label">Physical Storage Location</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Shelf A-3, Cabinet 2, Box 5"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="input-label">Default Loan Period (Days)</label>
                    <input
                      type="number"
                      min={1}
                      className="input-field"
                      value={formData.defaultOverdueDays}
                      onChange={(e) => setFormData({ ...formData, defaultOverdueDays: Number(e.target.value) || 7 })}
                    />
                  </div>
                </div>

                {/* Storage Location Photo Upload */}
                <div className="form-group">
                  <label className="input-label">Storage Location Photo (Shelf / Cabinet / Box)</label>
                  {!cloudStorageStatus.isConfigured && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#92400e', marginBottom: '0.5rem' }}>
                      <strong>Cloud Storage Notice:</strong> {cloudStorageStatus.message}
                      <br />
                      <em>To store photos online, configure Supabase Storage bucket <code>component-locations</code> or Cloudflare Pages <code>/api/upload</code>.</em>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {locationPhotoPreview ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={locationPhotoPreview}
                          alt="Location preview"
                          style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-300)', cursor: 'pointer' }}
                          onClick={() => {
                            setActivePhotoUrl(locationPhotoPreview);
                            setActivePhotoTitle(`Location Photo Preview`);
                            setIsPhotoModalOpen(true);
                          }}
                          title="Click to enlarge"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLocationPhoto}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            background: 'var(--danger)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                          }}
                          title="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ) : null}

                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <label
                        className="btn btn-secondary btn-sm"
                        style={{ cursor: isCompressingPhoto ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Upload size={14} />
                        {isCompressingPhoto ? 'Compressing (≤1MB)...' : locationPhotoPreview ? 'Change Photo' : 'Upload Location Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleLocationPhotoSelected}
                          disabled={isCompressingPhoto}
                        />
                      </label>
                      <div className="text-muted text-xs" style={{ marginTop: '0.25rem' }}>
                        PNG, JPG, WebP. Compressed client-side to ≤1MB.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="input-label">Description / Technical Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Pinout information, voltage rating, special handling instructions..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== EDIT COMPONENT MODAL ==================== */}
      {isEditModalOpen && activeComponent && (
        <div className="modal-overlay" onClick={() => setIsEditModalOpen(false)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSaveEdit}>
              <div className="modal-header">
                <h3 className="modal-title">Edit: {activeComponent.name}</h3>
                <button type="button" className="btn-icon" onClick={() => setIsEditModalOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body">
                {modalError && (
                  <div
                    style={{
                      background: '#fee2e2',
                      border: '1px solid #f87171',
                      color: '#991b1b',
                      padding: '0.75rem 1rem',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '1rem',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <AlertCircle size={16} />
                    <span>{modalError}</span>
                  </div>
                )}

                <div className="review-grid">
                  <div className="form-group">
                    <label className="input-label">Component Name *</label>
                    <input
                      type="text"
                      className="input-field"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <div className="flex-between" style={{ marginBottom: '0.25rem' }}>
                      <label className="input-label" style={{ margin: 0 }}>Unique Component Tag</label>
                      <span className="badge badge-neutral font-mono" style={{ fontSize: '0.68rem', padding: '2px 6px' }}>
                        Locked (Permanent)
                      </span>
                    </div>
                    <input
                      type="text"
                      className="input-field font-mono"
                      value={formData.componentNumber || activeComponent.componentNumber || activeComponent.id}
                      readOnly
                      disabled
                      style={{ background: '#f8fafc', color: '#334155', fontWeight: 600, cursor: 'not-allowed' }}
                    />
                    <span className="input-hint">
                      Permanent tag assigned to this component and physical tracking records
                    </span>
                  </div>
                </div>

                {/* Multi-Level Cascading Category Hierarchy */}
                <div className="form-group">
                  <div className="flex-between" style={{ marginBottom: '0.35rem' }}>
                    <label className="input-label" style={{ margin: 0 }}>Category Hierarchy (Multi-Level) *</label>
                    <button
                      type="button"
                      className="btn-link text-xs"
                      onClick={() => setIsCategoryModalOpen(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                    >
                      <FolderTree size={13} /> Manage Category Tree
                    </button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                    {Array.from({ length: categoryLevels.length + 1 }).map((_, idx) => {
                      const parentId = idx === 0 ? null : categoryLevels[idx - 1];
                      if (idx > 0 && !parentId) return null;
                      let options = categories.filter((c) => (idx === 0 ? !c.parentId : c.parentId === parentId));
                      if (idx === 0) {
                        options = [...options].sort((a, b) => {
                          const ia = APPROVED_MAIN_CATEGORIES.indexOf(a.name);
                          const ib = APPROVED_MAIN_CATEGORIES.indexOf(b.name);
                          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
                        });
                      }
                      if (options.length === 0) return null;
                      const currentSelected = categoryLevels[idx] || '';

                      return (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {idx > 0 && <span className="text-muted" style={{ fontSize: '0.8rem' }}>›</span>}
                          <select
                            className="select-field"
                            style={{ width: 'auto', minWidth: '160px', padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                            value={currentSelected}
                            onChange={(e) => handleCategoryLevelChange(idx, e.target.value)}
                          >
                            <option value="">{idx === 0 ? '-- Select Main Category * --' : '-- Select Subcategory (Optional) --'}</option>
                            {options.map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  {formData.categoryPath && (
                    <div className="text-xs" style={{ background: '#f8fafc', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--neutral-200)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span className="text-muted">Selected Taxonomy:</span>
                      <strong style={{ color: 'var(--primary)' }}>{formData.categoryPath}</strong>
                    </div>
                  )}
                </div>

                <div className="review-grid">
                  <div className="form-group">
                    <label className="input-label">Total Quantity *</label>
                    <input
                      type="number"
                      min={activeComponent.issuedQuantity}
                      className="input-field"
                      value={formData.totalQuantity}
                      onChange={(e) => setFormData({ ...formData, totalQuantity: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="input-label">Low-Stock Alert Threshold</label>
                    <input
                      type="number"
                      min={0}
                      className="input-field"
                      value={formData.lowStockThreshold}
                      onChange={(e) => setFormData({ ...formData, lowStockThreshold: e.target.value })}
                    />
                  </div>
                </div>

                <div className="review-grid">
                  <div className="form-group">
                    <label className="input-label">Physical Storage Location</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Shelf A-3, Cabinet 2, Box 5"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label className="input-label">Default Loan Period (Days)</label>
                    <input
                      type="number"
                      min={1}
                      className="input-field"
                      value={formData.defaultOverdueDays}
                      onChange={(e) => setFormData({ ...formData, defaultOverdueDays: Number(e.target.value) || 7 })}
                    />
                  </div>
                </div>

                {/* Storage Location Photo Upload */}
                <div className="form-group">
                  <label className="input-label">Storage Location Photo (Shelf / Cabinet / Box)</label>
                  {!cloudStorageStatus.isConfigured && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: '#92400e', marginBottom: '0.5rem' }}>
                      <strong>Cloud Storage Notice:</strong> {cloudStorageStatus.message}
                      <br />
                      <em>To store photos online, configure Supabase Storage bucket <code>component-locations</code> or Cloudflare Pages <code>/api/upload</code>.</em>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {locationPhotoPreview ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img
                          src={locationPhotoPreview}
                          alt="Location preview"
                          style={{ width: '120px', height: '90px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--neutral-300)', cursor: 'pointer' }}
                          onClick={() => {
                            setActivePhotoUrl(locationPhotoPreview);
                            setActivePhotoTitle(formData.name ? `${formData.name} Location Photo` : 'Location Photo Preview');
                            setIsPhotoModalOpen(true);
                          }}
                          title="Click to enlarge"
                        />
                        <button
                          type="button"
                          onClick={handleRemoveLocationPhoto}
                          style={{
                            position: 'absolute',
                            top: '-6px',
                            right: '-6px',
                            background: 'var(--danger)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '50%',
                            width: '20px',
                            height: '20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                          }}
                          title="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ) : null}

                    <div style={{ flex: 1, minWidth: '220px' }}>
                      <label
                        className="btn btn-secondary btn-sm"
                        style={{ cursor: isCompressingPhoto ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                      >
                        <Upload size={14} />
                        {isCompressingPhoto ? 'Compressing (≤1MB)...' : locationPhotoPreview ? 'Change Photo' : 'Upload Location Photo'}
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={handleLocationPhotoSelected}
                          disabled={isCompressingPhoto}
                        />
                      </label>
                      <div className="text-muted text-xs" style={{ marginTop: '0.25rem' }}>
                        PNG, JPG, WebP. Compressed client-side to ≤1MB.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="input-label">Description / Technical Notes</label>
                  <textarea
                    className="input-field"
                    rows={2}
                    placeholder="Pinout information, voltage rating, special handling instructions..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Update Component
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== ENLARGED PHOTO MODAL ==================== */}
      {isPhotoModalOpen && activePhotoUrl && (
        <div className="modal-overlay" onClick={() => setIsPhotoModalOpen(false)}>
          <div className="modal-card" style={{ maxWidth: '640px', padding: '1rem' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '0.75rem' }}>
              <h3 className="modal-title" style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Camera size={16} /> {activePhotoTitle || 'Component Storage Location'}
              </h3>
              <button type="button" className="btn-icon" onClick={() => setIsPhotoModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div style={{ textAlign: 'center', background: '#0f172a', borderRadius: 'var(--radius-md)', padding: '0.5rem', overflow: 'hidden' }}>
              <img
                src={activePhotoUrl}
                alt="Storage Location"
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: '4px' }}
              />
            </div>
            {activeComponent?.location && (
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--neutral-600)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <MapPin size={14} className="text-primary" />
                <span>Physical Location: <strong>{activeComponent.location}</strong></span>
              </div>
            )}
            <div className="modal-footer" style={{ marginTop: '0.75rem', padding: '0.5rem 0 0' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setIsPhotoModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== CATEGORY HIERARCHY MANAGER MODAL ==================== */}
      {isCategoryModalOpen && (
        <div className="modal-overlay" onClick={() => setIsCategoryModalOpen(false)}>
          <div className="modal-card modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FolderTree size={20} className="text-primary" />
                Component Category Hierarchy Manager
              </h3>
              <button type="button" className="btn-icon" onClick={() => setIsCategoryModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
              <p className="text-muted text-sm" style={{ marginBottom: '1rem' }}>
                Organize lab components into a multi-level taxonomy (e.g., Electronics → Microcontrollers → ESP32).
                Changes are synchronized with Supabase PostgreSQL and cached locally.
              </p>

              {modalError && (
                <div
                  style={{
                    background: '#fee2e2',
                    border: '1px solid #f87171',
                    color: '#991b1b',
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    fontSize: '0.88rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{modalError}</span>
                </div>
              )}

              {/* Category Edit or Create Form */}
              {editingCategory ? (
                <div className="card" style={{ background: '#f0fdf4', padding: '1rem', marginBottom: '1.25rem', border: '1px solid #86efac' }}>
                  <div className="flex-between" style={{ marginBottom: '0.75rem' }}>
                    <h4 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: '#166534', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <Edit2 size={15} /> Edit Category / Subcategory: {editingCategory.name}
                    </h4>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => setEditingCategory(null)}
                      title="Cancel Edit"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <form onSubmit={handleSaveCategoryEdit}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label className="input-label" style={{ fontSize: '0.8rem' }}>Category Name *</label>
                        <input
                          type="text"
                          className="input-field"
                          value={editingCategory.name}
                          onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                          required
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>
                      <div>
                        <label className="input-label" style={{ fontSize: '0.8rem' }}>Description</label>
                        <input
                          type="text"
                          className="input-field"
                          value={editingCategory.description || ''}
                          onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                          placeholder="Optional details or specifications"
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingCategory(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn btn-primary btn-sm">
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="card" style={{ background: '#f8fafc', padding: '1rem', marginBottom: '1.25rem', border: '1px solid var(--neutral-200)' }}>
                  <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                    Create New Subcategory
                  </h4>
                  <form onSubmit={handleCreateCategory}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label className="input-label" style={{ fontSize: '0.8rem' }}>Parent Category *</label>
                        <select
                          className="select-field"
                          style={{ fontSize: '0.85rem' }}
                          value={newCategoryForm.parentId || ''}
                          onChange={(e) => setNewCategoryForm({ ...newCategoryForm, parentId: e.target.value || null })}
                          required
                        >
                          <option value="">-- Select Parent Category (Required) --</option>
                          {categories.map((c) => {
                            const path = getCategoryPath(c.id).join(' → ');
                            return (
                              <option key={c.id} value={c.id}>
                                {path}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="input-label" style={{ fontSize: '0.8rem' }}>Subcategory Name *</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. Current Sensors, Motor Drivers"
                          value={newCategoryForm.name}
                          onChange={(e) => setNewCategoryForm({ ...newCategoryForm, name: e.target.value })}
                          required
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>

                      <div>
                        <label className="input-label" style={{ fontSize: '0.8rem' }}>Description</label>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Optional details or specifications"
                          value={newCategoryForm.description}
                          onChange={(e) => setNewCategoryForm({ ...newCategoryForm, description: e.target.value })}
                          style={{ fontSize: '0.85rem' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <button type="submit" className="btn btn-primary btn-sm">
                        <Plus size={14} /> Add Subcategory
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Category Tree Representation */}
              <h4 style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                Existing Categories ({categories.length})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {categoryTree.length === 0 ? (
                  <div className="text-muted text-sm" style={{ padding: '1rem', textAlign: 'center' }}>
                    No categories defined.
                  </div>
                ) : (
                  categoryTree.map((rootNode) => renderCategoryTreeNode(rootNode, 0))
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setIsCategoryModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
