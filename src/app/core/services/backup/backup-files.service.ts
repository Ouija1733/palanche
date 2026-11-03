import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

/** Folder, inside the app's private storage, for automatic safety backups. */
const SAFETY_FOLDER = 'backups';
/** How many safety backups to keep: older ones are deleted. */
const SAFETY_COPIES = 5;

/**
 * File I/O for backups, kept apart from the export/import logic so that the
 * logic can be tested without a device. Nothing here goes to the network:
 * sharing hands the file to the Android share sheet, chosen by the user.
 */
@Injectable({ providedIn: 'root' })
export class BackupFilesService {
  /** Writes the file to the cache and opens the share sheet; in the browser, downloads it. */
  async share(fileName: string, content: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.download(fileName, content);
      return;
    }
    const { uri } = await Filesystem.writeFile({
      path: fileName,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: 'Backup Palanche', files: [uri], dialogTitle: 'Salva o invia il backup' });
  }

  /**
   * Saves a copy of the current data before a "replace everything" import,
   * keeping only the last SAFETY_COPIES files.
   */
  async writeSafetyBackup(fileName: string, content: string): Promise<void> {
    await Filesystem.writeFile({
      path: `${SAFETY_FOLDER}/${fileName}`,
      data: content,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    const { files } = await Filesystem.readdir({ path: SAFETY_FOLDER, directory: Directory.Data });
    // Names contain the date and time, so alphabetical order is chronological.
    const old = files
      .map((file) => file.name)
      .sort()
      .slice(0, -SAFETY_COPIES);
    for (const name of old) {
      await Filesystem.deleteFile({ path: `${SAFETY_FOLDER}/${name}`, directory: Directory.Data });
    }
  }

  private download(fileName: string, content: string): void {
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }
}
