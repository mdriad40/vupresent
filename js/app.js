import { setupAuth, checkAuthState } from './auth.js';
import { Store } from './store.js';

export const AppUI = {
    previousViewId: null,
    currentViewId: null,

    switchView(viewId) {
        if (this.currentViewId && this.currentViewId !== 'profile-view') {
            this.previousViewId = this.currentViewId;
        }
        this.currentViewId = viewId;

        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        document.getElementById(viewId).classList.add('active');

        // Toggle sidebar based on auth view
        const sidebar = document.getElementById('main-sidebar');
        if (sidebar) {
            if (viewId === 'auth-view') {
                sidebar.classList.add('hidden');
            } else {
                sidebar.classList.remove('hidden');
            }
        }

        // Update active state in sidebar menu if applicable
        if (viewId !== 'profile-view') {
            document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
                if (item.getAttribute('data-target') === viewId) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        }

        // Trigger dynamic refresh of Dashboard data
        if (viewId === 'dashboard-view' || viewId === 'classes-view') {
            const user = Store.getUser();
            if (user) {
                import('./dashboard.js').then(module => {
                    module.loadDashboard(user.uid);
                });
            }
        }
        if (viewId === 'reports-view') {
            const user = Store.getUser();
            if (user) {
                import('./reports.js').then(module => {
                    module.loadReports(user.uid);
                });
            }
        }
        if (viewId === 'settings-view') {
            const user = Store.getUser();
            if (user) {
                import('./settings.js').then(module => {
                    module.loadSettings(user.uid);
                });
            }
        }
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        let icon = 'info';
        if (type === 'success') icon = 'check-circle';
        if (type === 'error') icon = 'warning-circle';

        toast.innerHTML = `<i class="ph-fill ph-${icon}"></i> <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    },

    updateSyncStatus() {
        const indicator = document.getElementById('sync-indicator');
        if (navigator.onLine) {
            indicator.className = 'sync-indicator online';
            indicator.innerHTML = '<i class="ph ph-wifi-high"></i> Online';
        } else {
            indicator.className = 'sync-indicator offline';
            indicator.innerHTML = '<i class="ph ph-wifi-slash"></i> Offline';
        }
    },

    showConfirm(title, message, actionText, actionClass, onConfirm) {
        // Remove any existing confirm modal
        const existing = document.getElementById('modal-confirm-action');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'modal-confirm-action';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content modal-sm confirm-modal">
                <div class="modal-header">
                    <h2>${title}</h2>
                    <button class="btn btn-icon btn-close-modal"><i class="ph ph-x"></i></button>
                </div>
                <div class="modal-body">
                    <p style="color: var(--text-muted); font-size: 0.9rem; line-height: 1.6;">${message}</p>
                    <div class="confirm-actions" style="display: flex; gap: 0.75rem; margin-top: 1.5rem; justify-content: flex-end;">
                        <button class="btn btn-outline" id="confirm-cancel-btn">Cancel</button>
                        <button class="btn ${actionClass}" id="confirm-action-btn">${actionText}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();

        modal.querySelector('#confirm-cancel-btn').onclick = close;
        modal.querySelector('.btn-close-modal').onclick = close;
        modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
        modal.querySelector('#confirm-action-btn').onclick = () => {
            close();
            onConfirm();
        };
    }
};

function setupGlobalListeners() {
    // Close modals on clicking background or close button
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.closest('.btn-close-modal')) {
                modal.classList.remove('active');
            }
        });
    });

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');

            // Update buttons
            e.target.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Update content
            const container = e.target.closest('.content-wrapper');
            container.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Sidebar navigation
    document.querySelectorAll('.sidebar-menu .menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetView = e.currentTarget.getAttribute('data-target');
            if (targetView) {
                AppUI.switchView(targetView);
            }
        });
    });

    // Network status
    window.addEventListener('online', AppUI.updateSyncStatus);
    window.addEventListener('offline', AppUI.updateSyncStatus);

    // Sidebar toggle
    const toggleBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('main-sidebar');
            if (sidebar) sidebar.classList.toggle('collapsed');
        });
    }
}

// App Initialization
document.addEventListener('DOMContentLoaded', () => {
    AppUI.updateSyncStatus();
    setupGlobalListeners();
    setupAuth();
    checkAuthState();
});
