import * as fs from 'fs/promises';
import * as path from 'path';
import { SnapshotStore } from './snapshot-store';

export class FileSnapshotStore extends SnapshotStore {
  constructor(private readonly filePath: string) {
    super();
  }

  static async open(filePath: string): Promise<FileSnapshotStore> {
    const store = new FileSnapshotStore(filePath);
    await store.connect();
    return store;
  }

  protected async load(): Promise<void> {
    const resolved = path.resolve(this.filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    try {
      const raw = await fs.readFile(resolved, 'utf8');
      this.resetSnapshot(JSON.parse(raw));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.resetSnapshot({});
        await this.persist();
        return;
      }
      throw error;
    }
  }

  protected async persist(): Promise<void> {
    const resolved = path.resolve(this.filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, JSON.stringify(this.snapshot, null, 2), 'utf8');
  }
}
