import { Store } from './store.js';
import { AppUI } from './app.js';
import { loadProfile } from './profile.js';

export function loadDashboard(userId) {
    const profiles = Store.getProfiles(userId);
    renderProfiles(profiles);
    setupFilterModal(profiles);
    renderStats(profiles, 'all');

    // User Info (Populate edit form)
    const user = Store.getUser();
    if (user) {
        const headerName = document.getElementById('teacher-name');
        if (headerName) headerName.textContent = user.displayName || 'Teacher';

        const euName = document.getElementById('eu-name');
        if (euName) euName.value = user.displayName || '';

        const euEmail = document.getElementById('eu-email');
        if (euEmail) euEmail.value = user.email || '';

        const euPhone = document.getElementById('eu-phone');
        if (euPhone) euPhone.value = user.phone || '';
    }

    // Setup Edit Profile form
    const editForm = document.getElementById('form-edit-user-profile');
    const newEditForm = editForm.cloneNode(true);
    editForm.parentNode.replaceChild(newEditForm, editForm);

    newEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const displayName = document.getElementById('eu-name').value;
        const phone = document.getElementById('eu-phone').value;

        Store.updateUser({ displayName, phone });

        AppUI.closeModal('modal-edit-user-profile');
        AppUI.showToast('Profile updated successfully', 'success');

        // Update header navbar name as well
        const headerName = document.getElementById('teacher-name');
        if (headerName) headerName.textContent = displayName;

        loadDashboard(userId);
    });

    const headerUserInfo = document.getElementById('header-user-info');
    if (headerUserInfo) {
        headerUserInfo.onclick = () => {
            AppUI.openModal('modal-edit-user-profile');
        };
    }

    // Setup new profile form
    const form = document.getElementById('form-create-profile');

    // Remove old listeners to avoid duplicates
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const course = document.getElementById('cp-course').value;
        const title = document.getElementById('cp-title').value;
        const dept = document.getElementById('cp-dept').value;
        const semester = document.getElementById('cp-semester').value;
        const section = document.getElementById('cp-section').value;
        const batch = document.getElementById('cp-batch').value;

        const profile = {
            course, title, dept, semester, section, batch
        };

        const savedProfile = Store.saveProfile(userId, profile);
        AppUI.closeModal('modal-create-profile');
        AppUI.showToast('Class created successfully', 'success');

        newForm.reset();

        // Reload dashboard
        loadDashboard(userId);
    });

    // Setup Create Button
    document.getElementById('btn-new-profile').onclick = () => {
        AppUI.openModal('modal-create-profile');
    };
}

function setupFilterModal(profiles) {
    const select = document.getElementById('filter-class-select');
    if (!select) return;

    // Preserve current selection if possible
    const currentVal = select.value;

    let optionsHtml = '<option value="all">All Classes</option>';
    profiles.forEach(p => {
        optionsHtml += `<option value="${p.id}">${p.course} ${p.title ? `(${p.title})` : ''}</option>`;
    });
    select.innerHTML = optionsHtml;

    if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
        select.value = currentVal;
    }

    document.getElementById('btn-open-filter').onclick = () => {
        AppUI.openModal('modal-filter-class');
    };

    document.getElementById('btn-apply-filter').onclick = () => {
        const selectedId = select.value;
        let selectedText = 'All Classes';
        if (selectedId !== 'all') {
            const p = profiles.find(x => x.id === selectedId);
            if (p) selectedText = p.course;
        }

        AppUI.closeModal('modal-filter-class');

        document.getElementById('stat-filter-name').textContent = selectedText;
        renderStats(profiles, selectedId);
    };
}

function renderStats(profiles, filterId) {
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalLate = 0;

    let targetProfiles = profiles;
    if (filterId !== 'all') {
        targetProfiles = profiles.filter(p => p.id === filterId);
    }

    targetProfiles.forEach(p => {
        const attendanceArray = Store.getAttendance(p.id) || [];

        attendanceArray.forEach(session => {
            if (session.records) {
                Object.values(session.records).forEach(status => {
                    if (status === 'P') totalPresent++;
                    else if (status === 'A') totalAbsent++;
                    else if (status === 'L') totalLate++;
                });
            }
        });
    });

    const statPresent = document.getElementById('stat-present');
    const statAbsent = document.getElementById('stat-absent');
    const statLate = document.getElementById('stat-late');

    if (statPresent) statPresent.textContent = totalPresent;
    if (statAbsent) statAbsent.textContent = totalAbsent;
    if (statLate) statLate.textContent = totalLate;

    renderChart(targetProfiles);
}

let dashboardChartInstance = null;

function renderChart(targetProfiles) {
    const ctx = document.getElementById('dashboard-chart');
    if (!ctx) return;

    if (dashboardChartInstance) {
        dashboardChartInstance.destroy();
    }

    const labels = [];
    const presentData = [];
    const absentData = [];
    const lateData = [];

    targetProfiles.forEach(p => {
        labels.push(p.course);
        const attendanceArray = Store.getAttendance(p.id) || [];
        let pCount = 0, aCount = 0, lCount = 0;
        attendanceArray.forEach(session => {
            if (session.records) {
                Object.values(session.records).forEach(status => {
                    if (status === 'P') pCount++;
                    else if (status === 'A') aCount++;
                    else if (status === 'L') lCount++;
                });
            }
        });
        presentData.push(pCount);
        absentData.push(aCount);
        lateData.push(lCount);
    });

    dashboardChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Present',
                    data: presentData,
                    borderColor: '#10b981',
                    backgroundColor: '#10b981',
                    borderWidth: 2,
                    pointBackgroundColor: '#10b981',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0
                },
                {
                    label: 'Late',
                    data: lateData,
                    borderColor: '#f59e0b',
                    backgroundColor: '#f59e0b',
                    borderWidth: 2,
                    pointBackgroundColor: '#f59e0b',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0
                },
                {
                    label: 'Absent',
                    data: absentData,
                    borderColor: '#ef4444',
                    backgroundColor: '#ef4444',
                    borderWidth: 2,
                    pointBackgroundColor: '#ef4444',
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: false,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        font: {
                            family: "'Inter', sans-serif",
                            size: 13,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.9)',
                    titleFont: { family: "'Inter', sans-serif", size: 14 },
                    bodyFont: { family: "'Inter', sans-serif", size: 13 },
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                    ticks: { font: { family: "'Inter', sans-serif" } }
                },
                y: {
                    beginAtZero: true,
                    border: { display: false },
                    grid: { color: 'rgba(0, 0, 0, 0.04)', drawTicks: false },
                    ticks: { font: { family: "'Inter', sans-serif" }, padding: 10 }
                }
            }
        }
    });
}

function renderProfiles(profiles) {
    const list = document.getElementById('profile-list');
    const emptyState = document.getElementById('dashboard-empty');

    list.innerHTML = '';

    if (profiles.length === 0) {
        emptyState.classList.remove('hidden');
        list.style.display = 'none';
        return;
    }

    emptyState.classList.add('hidden');
    list.style.display = 'grid';

    // Sort descending by created at
    profiles.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    profiles.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <div class="card-title">${p.course} ${p.title ? `(${p.title})` : ''}</div>
            <div class="card-subtitle">${p.dept} • ${p.semester}</div>
            <div class="card-meta">
                <span><i class="ph ph-users"></i> Sec: ${p.section}</span>
                <span><i class="ph ph-graduation-cap"></i> Batch: ${p.batch}</span>
            </div>
        `;

        card.addEventListener('click', () => {
            loadProfile(p);
        });

        list.appendChild(card);
    });
}
