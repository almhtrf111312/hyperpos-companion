// Custom Fields Configuration - User-defined fields for products

import { emitEvent, EVENTS } from './events';

export type CustomFieldType = 'text' | 'number' | 'select';

export interface CustomField {
  id: string;
  name: string;           // Field name (e.g., Brand)
  type: CustomFieldType;  // Field type
  placeholder?: string;   // Placeholder text
  required: boolean;      // Required or optional
  enabled: boolean;       // Enabled or disabled
  options?: string[];     // Options (for select type only)
  showInTable: boolean;   // Show in products table
  showInDetails: boolean; // Show in product details
}

const CUSTOM_FIELDS_STORAGE_KEY = 'hyperpos_custom_fields_v1';

// Load custom fields from storage
export const loadCustomFields = (): CustomField[] => {
  try {
    const stored = localStorage.getItem(CUSTOM_FIELDS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : parsed.fields || [];
    }
  } catch (error) {
    console.error('Failed to load custom fields:', error);
  }
  return [];
};

// Save custom fields to storage
export const saveCustomFields = (fields: CustomField[]): boolean => {
  try {
    localStorage.setItem(CUSTOM_FIELDS_STORAGE_KEY, JSON.stringify(fields));
    emitEvent(EVENTS.CUSTOM_FIELDS_UPDATED, fields);
    return true;
  } catch (error) {
    console.error('Failed to save custom fields:', error);
    return false;
  }
};

// Add a new custom field
export const addCustomField = (field: Omit<CustomField, 'id'>): CustomField => {
  const fields = loadCustomFields();
  const newField: CustomField = {
    ...field,
    id: `custom_${Date.now()}`,
  };
  fields.push(newField);
  saveCustomFields(fields);
  return newField;
};

// Update an existing custom field
export const updateCustomField = (id: string, data: Partial<CustomField>): boolean => {
  const fields = loadCustomFields();
  const index = fields.findIndex(f => f.id === id);
  if (index === -1) return false;
  fields[index] = { ...fields[index], ...data };
  saveCustomFields(fields);
  return true;
};

// Delete a custom field
export const deleteCustomField = (id: string): boolean => {
  const fields = loadCustomFields();
  const filtered = fields.filter(f => f.id !== id);
  if (filtered.length === fields.length) return false;
  saveCustomFields(filtered);
  return true;
};

// Get only enabled custom fields
export const getEnabledCustomFields = (): CustomField[] => {
  return loadCustomFields().filter(f => f.enabled);
};
