import { Store } from './store.js';
import { AppUI } from './app.js';

let currentUserId = null;

export function loadSettings(uid) {
    currentUserId = uid;
    
    const settings = Store.getSettings(uid);
    
    // Bind inputs
    const minAttInput = document.getElementById('settings-min-attendance');
    const saveBtn = document.getElementById('btn-save-settings');

    if (minAttInput) {
        minAttInput.value = settings.minAttendancePercent || 60;
    }

    if (saveBtn) {
        saveBtn.onclick = () => {
            const newSettings = {
                ...settings,
                minAttendancePercent: parseInt(minAttInput.value, 10) || 60
            };
            Store.saveSettings(uid, newSettings);
            AppUI.showToast('Settings saved successfully', 'success');
        };
    }
}
