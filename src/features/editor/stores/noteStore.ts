// 笔记状态管理

import { create } from 'zustand';
import { safeInvoke } from '../../../utils/tauri';
import type { Note, OutputType, SaveStatus } from '../../../types';

interface NoteState {
  note: Note | null;
  content: string;
  isDirty: boolean;
  saveStatus: SaveStatus;
  lastSaved: string | null;
  error: string | null;
  notes: Note[];

  loadNote: (id: string) => Promise<void>;
  loadNotes: (projectId: string) => Promise<void>;
  updateContent: (content: string) => void;
  saveNote: (id: string, content: string) => Promise<void>;
  renameNote: (id: string, title: string) => Promise<void>;
  createNote: (projectId: string, title?: string, outputType?: OutputType) => Promise<Note>;
  deleteNote: (id: string) => Promise<void>;
  clearNote: () => void;
}

export const useNoteStore = create<NoteState>((set, get) => ({
  note: null,
  content: '',
  isDirty: false,
  saveStatus: 'saved',
  lastSaved: null,
  error: null,
  notes: [],

  loadNotes: async (projectId: string) => {
    try {
      const notes = await safeInvoke<Note[]>('note_list', { projectId });
      set({ notes, error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  loadNote: async (id: string) => {
    try {
      const note = await safeInvoke<Note>('note_get', { id });
      const content = await safeInvoke<string>('note_get_content', { id });
      set({ note, content, isDirty: false, saveStatus: 'saved', error: null });
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateContent: (content: string) => {
    set({ content, isDirty: true, saveStatus: 'unsaved' });
  },

  saveNote: async (id: string, content: string) => {
    set({ saveStatus: 'saving' });
    try {
      await safeInvoke('note_save', { id, content });
      set({
        isDirty: false,
        saveStatus: 'saved',
        lastSaved: new Date().toISOString(),
      });
      // 重新加载笔记以获取更新后的标题
      const note = await safeInvoke<Note>('note_get', { id });
      set({ note });
    } catch (e) {
      set({ saveStatus: 'error', error: String(e) });
    }
  },

  createNote: async (projectId: string, title?: string, outputType?: OutputType) => {
    const note = await safeInvoke<Note>('note_create', {
      projectId,
      title,
      outputType: outputType || 'note',
    });
    set((state) => ({
      note,
      content: '',
      isDirty: false,
      saveStatus: 'saved',
      notes: [note, ...state.notes],
    }));
    return note;
  },

  renameNote: async (id: string, title: string) => {
    try {
      const note = await safeInvoke<Note>('note_rename', { id, title });
      set((state) => ({
        note: state.note?.id === id ? note : state.note,
        notes: state.notes.map((n) => (n.id === id ? note : n)),
      }));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  deleteNote: async (id: string) => {
    await safeInvoke('note_delete', { id });
    const { notes, note } = get();
    set({
      notes: notes.filter((n) => n.id !== id),
      note: note?.id === id ? null : note,
      content: note?.id === id ? '' : get().content,
    });
  },

  clearNote: () => {
    set({
      note: null,
      content: '',
      isDirty: false,
      saveStatus: 'saved',
      error: null,
    });
  },
}));
