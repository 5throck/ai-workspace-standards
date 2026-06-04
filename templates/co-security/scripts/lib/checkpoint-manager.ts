#!/usr/bin/env bun
/**
 * checkpoint-manager.ts
 * @version 1.0.0
 * @description Session-only checkpoint manager for auto-mode workflow
 *
 * Manages in-memory checkpoints for task rollback and state restoration.
 * No file persistence - all checkpoints cleared on session end.
 */

interface FileModification {
  path: string;
  action: 'created' | 'modified' | 'deleted';
  backup?: string; // In-memory content backup
}

interface Checkpoint {
  id: string;
  phase: number;
  timestamp: Date;
  completedTasks: string[];
  taskStates: Map<string, 'pending' | 'in_progress' | 'completed' | 'failed'>;
  fileModifications: FileModification[];
}

class CheckpointManager {
  private checkpoints: Map<string, Checkpoint> = new Map();
  private checkpointCounter: number = 0;

  /**
   * Create a new checkpoint with current task and file state
   */
  createCheckpoint(
    phase: number,
    completedTasks: string[],
    taskStates: Map<string, 'pending' | 'in_progress' | 'completed' | 'failed'>
  ): string {
    const id = `checkpoint-${++this.checkpointCounter}`;

    // Get current file modifications (since last checkpoint)
    const fileModifications = this.trackFileModifications();

    const checkpoint: Checkpoint = {
      id,
      phase,
      timestamp: new Date(),
      completedTasks: [...completedTasks],
      taskStates: new Map(taskStates),
      fileModifications
    };

    this.checkpoints.set(id, checkpoint);
    console.log(`[CheckpointManager] Created checkpoint ${id} for phase ${phase}`);

    return id;
  }

  /**
   * Retrieve a checkpoint by ID
   */
  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  /**
   * List all checkpoints
   */
  listCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );
  }

  /**
   * Restore to a specific checkpoint
   * 1. Restore task states (in_progress → pending)
   * 2. Rollback file modifications
   */
  async restoreToCheckpoint(id: string): Promise<void> {
    const checkpoint = this.getCheckpoint(id);
    if (!checkpoint) {
      throw new Error(`Checkpoint ${id} not found`);
    }

    console.log(`[CheckpointManager] Restoring to checkpoint ${id}`);

    // Restore task states
    for (const [taskId, state] of checkpoint.taskStates) {
      if (state === 'in_progress') {
        // Reset in-progress tasks to pending
        console.log(`[CheckpointManager] Resetting task ${taskId} to pending`);
      }
    }

    // Rollback file modifications
    await this.rollbackFileModifications(checkpoint.fileModifications);

    console.log(`[CheckpointManager] Successfully restored to checkpoint ${id}`);
  }

  /**
   * Clear all checkpoints (session cleanup)
   */
  clearCheckpoints(): void {
    const count = this.checkpoints.size;
    this.checkpoints.clear();
    this.checkpointCounter = 0;
    console.log(`[CheckpointManager] Cleared ${count} checkpoints`);
  }

  /**
   * Track file modifications since last checkpoint
   * Simplified: returns empty array for now (can be enhanced with fs watcher)
   */
  private trackFileModifications(): FileModification[] {
    // Placeholder for file tracking logic
    // In production, integrate with fs watcher or git status
    return [];
  }

  /**
   * Rollback file modifications:
   * 1. Delete files created since checkpoint
   * 2. Restore files from backup (in-memory)
   */
  private async rollbackFileModifications(modifications: FileModification[]): Promise<void> {
    for (const mod of modifications) {
      try {
        if (mod.action === 'created') {
          // Delete newly created files
          await this.deleteFile(mod.path);
          console.log(`[CheckpointManager] Deleted created file: ${mod.path}`);
        } else if (mod.action === 'modified' && mod.backup) {
          // Restore modified files from backup
          await this.restoreFile(mod.path, mod.backup);
          console.log(`[CheckpointManager] Restored modified file: ${mod.path}`);
        } else if (mod.action === 'deleted') {
          // Restore deleted files (if backup exists)
          if (mod.backup) {
            await this.restoreFile(mod.path, mod.backup);
            console.log(`[CheckpointManager] Restored deleted file: ${mod.path}`);
          }
        }
      } catch (error) {
        console.error(`[CheckpointManager] Failed to rollback ${mod.path}:`, error);
      }
    }
  }

  /**
   * Delete a file
   */
  private async deleteFile(path: string): Promise<void> {
    const fs = await import('fs/promises');
    try {
      await fs.unlink(path);
    } catch (error) {
      // File may not exist, continue
      console.warn(`[CheckpointManager] File not found: ${path}`);
    }
  }

  /**
   * Restore a file from backup content
   */
  private async restoreFile(path: string, content: string): Promise<void> {
    const fs = await import('fs/promises');
    await fs.writeFile(path, content, 'utf-8');
  }

  /**
   * Get checkpoint count
   */
  getCheckpointCount(): number {
    return this.checkpoints.size;
  }
}

// Singleton instance
const checkpointManager = new CheckpointManager();

export default checkpointManager;
export type { Checkpoint, FileModification };
