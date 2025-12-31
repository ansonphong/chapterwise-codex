/**
 * Writer View - Backward compatibility re-export
 * 
 * The WriterView functionality has been refactored into modular files
 * in the writerView/ folder for better maintainability.
 * 
 * This file now simply re-exports from the new module structure
 * to maintain backward compatibility with existing code.
 */

export { WriterViewManager } from './writerView/index';
export type { WriterPanelStats } from './writerView/index';
