import { defineStore } from 'pinia';

const STORAGE_KEY = 'flow_templates_v1';
const MAX_TEMPLATES = 5;

export interface FlowTemplate {
  id: string;
  name: string;
  steps: Array<{ recipeId: string; repeat: number }>;
  savedAt: number;
}

function loadFromStorage(): FlowTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as FlowTemplate[];
  } catch {
    return [];
  }
}

function saveToStorage(templates: FlowTemplate[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export const useFlowTemplateStore = defineStore('flowTemplate', {
  state: () => ({
    templates: loadFromStorage() as FlowTemplate[],
  }),

  getters: {
    isFull(state): boolean {
      return state.templates.length >= MAX_TEMPLATES;
    },
    count(state): number {
      return state.templates.length;
    },
  },

  actions: {
    saveTemplate(name: string, steps: Array<{ recipeId: string; repeat: number }>): void {
      const trimmed = name.trim();
      if (!trimmed) return;
      if (this.templates.length >= MAX_TEMPLATES) return;

      const template: FlowTemplate = {
        id: `tpl_${Date.now()}`,
        name: trimmed,
        steps: steps.map((s) => ({ recipeId: s.recipeId, repeat: s.repeat })),
        savedAt: Date.now(),
      };
      this.templates.push(template);
      saveToStorage(this.templates);
    },

    deleteTemplate(id: string): void {
      this.templates = this.templates.filter((t) => t.id !== id);
      saveToStorage(this.templates);
    },

    getTemplate(id: string): FlowTemplate | undefined {
      return this.templates.find((t) => t.id === id);
    },
  },
});
