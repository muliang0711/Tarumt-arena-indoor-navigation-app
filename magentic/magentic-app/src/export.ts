import * as Sharing from 'expo-sharing';
import { FloorLabel } from './types';
import { getExportUri, datasetExists } from './storage';

/**
 * Export a dataset via the OS share sheet.
 * Returns true if the share was initiated, false if dataset doesn't exist.
 */
export async function shareDataset(label: FloorLabel): Promise<boolean> {
    const exists = datasetExists(label);
    if (!exists) return false;

    const uri = getExportUri(label);

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
        throw new Error('Sharing is not available on this device');
    }

    await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: `Export ${label} Data`,
        UTI: 'public.json', // iOS
    });

    return true;
}
