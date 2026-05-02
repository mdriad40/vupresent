import { Store } from './store.js';
import { AppUI } from './app.js';
import { exportToPdf, exportToExcel } from './profile.js';

let currentUserId = null;
let currentRcProfileId = null; // Report Class
let currentRsProfileId = null; // Report Student Class
let selectedStudentId = null;  // Current selected student ID

export function loadReports(uid) {
    currentUserId = uid;

    // Elements
    const tabClassBtn = document.getElementById('tab-btn-class-report');
    const tabDefaultersBtn = document.getElementById('tab-btn-defaulters-report');
    const tabStudentBtn = document.getElementById('tab-btn-student-report');
    
    const flowClass = document.getElementById('flow-class-report');
    const flowDefaulters = document.getElementById('flow-defaulters-report');
    const flowStudent = document.getElementById('flow-student-report');

    const rcSelect = document.getElementById('rc-class-select');
    const btnRcPdf = document.getElementById('btn-rc-pdf');
    const btnRcExcel = document.getElementById('btn-rc-excel');

    const rdSelect = document.getElementById('rd-class-select');
    const rdFilterInput = document.getElementById('rd-filter-pct');

    const rsSelect = document.getElementById('rs-class-select');
    const rsSearchContainer = document.getElementById('rs-student-search-container');
    const rsSearchInput = document.getElementById('rs-student-search');
    const rsStudentList = document.getElementById('rs-student-list');
    const rsDetails = document.getElementById('rs-student-details');

    const btnSinglePdf = document.getElementById('btn-single-student-pdf');

    // Tab Switching Logic
    tabClassBtn.onclick = () => {
        tabClassBtn.classList.add('active');
        if(tabDefaultersBtn) tabDefaultersBtn.classList.remove('active');
        tabStudentBtn.classList.remove('active');
        flowClass.classList.add('active');
        if(flowDefaulters) flowDefaulters.classList.remove('active');
        flowStudent.classList.remove('active');
    };
    if (tabDefaultersBtn) {
        tabDefaultersBtn.onclick = () => {
            tabDefaultersBtn.classList.add('active');
            tabClassBtn.classList.remove('active');
            tabStudentBtn.classList.remove('active');
            flowDefaulters.classList.add('active');
            flowClass.classList.remove('active');
            flowStudent.classList.remove('active');
        };
    }
    tabStudentBtn.onclick = () => {
        tabStudentBtn.classList.add('active');
        tabClassBtn.classList.remove('active');
        if(tabDefaultersBtn) tabDefaultersBtn.classList.remove('active');
        flowStudent.classList.add('active');
        flowClass.classList.remove('active');
        if(flowDefaulters) flowDefaulters.classList.remove('active');
    };

    // Load Classes into both dropdowns
    const profiles = Store.getProfiles(uid);
    const buildOption = (p) => `<option value="${p.id}">${p.course} - ${p.dept} - ${p.semester} - ${p.section}</option>`;

    rcSelect.innerHTML = '<option value="">-- Choose a Class --</option>' + profiles.map(buildOption).join('');
    if (rdSelect) rdSelect.innerHTML = '<option value="">-- Choose a Class --</option>' + profiles.map(buildOption).join('');
    rsSelect.innerHTML = '<option value="">-- Choose a Class --</option>' + profiles.map(buildOption).join('');

    // --- FLOW 1: Class Reports ---
    rcSelect.onchange = (e) => {
        currentRcProfileId = e.target.value;
        const pdfBtn = document.getElementById('btn-rc-pdf');
        const xlBtn = document.getElementById('btn-rc-excel');

        if (pdfBtn) pdfBtn.disabled = !currentRcProfileId;
        if (xlBtn) xlBtn.disabled = !currentRcProfileId;

        renderClassPreview(currentRcProfileId);
    };

    let downloadAction = null;
    const btnConfirmDownload = document.getElementById('btn-confirm-download');
    if (btnConfirmDownload) {
        btnConfirmDownload.onclick = () => {
            if (downloadAction) downloadAction();
            AppUI.closeModal('modal-download-confirm');
        };
    }

    function showDownloadConfirm(msg, action) {
        const msgEl = document.getElementById('download-confirm-msg');
        if (msgEl) msgEl.textContent = msg;
        downloadAction = action;
        AppUI.openModal('modal-download-confirm');
    }

    document.getElementById('btn-rc-pdf').onclick = () => {
        if (currentRcProfileId) {
            showDownloadConfirm('Are you sure you want to download the Class Attendance PDF report?', () => exportToPdf(currentRcProfileId, null));
        }
    };

    document.getElementById('btn-rc-excel').onclick = () => {
        if (currentRcProfileId) {
            showDownloadConfirm('Are you sure you want to download the Class Attendance Excel report?', () => exportToExcel(currentRcProfileId, null));
        }
    };

    // --- FLOW 1.5: Defaulters Reports ---
    let currentRdProfileId = null;
    if (rdSelect) {
        rdSelect.onchange = (e) => {
            currentRdProfileId = e.target.value;
            renderDefaultersPreview(currentRdProfileId);
        };
    }
    if (rdFilterInput) {
        rdFilterInput.oninput = () => {
            if (currentRdProfileId) renderDefaultersPreview(currentRdProfileId);
        };
    }


    // --- FLOW 2: Student Reports ---
    rsSelect.onchange = (e) => {
        currentRsProfileId = e.target.value;
        selectedStudentId = null;
        rsSearchInput.value = '';
        rsStudentList.style.display = 'none';
        rsDetails.style.display = 'none';

        if (currentRsProfileId) {
            rsSearchContainer.style.display = 'block';
        } else {
            rsSearchContainer.style.display = 'none';
        }
    };

    rsSearchInput.oninput = (e) => {
        if (!currentRsProfileId) return;
        const query = e.target.value.toLowerCase().trim();
        const students = Store.getStudents(currentRsProfileId);

        if (!query) {
            rsStudentList.style.display = 'none';
            return;
        }

        const filtered = students.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.studentId.toLowerCase().includes(query)
        );

        if (filtered.length > 0) {
            rsStudentList.innerHTML = filtered.map(s => `
                <div class="search-result-item" data-id="${s.id}">
                    <span class="s-id">${s.studentId}</span>
                    <span class="s-name">${s.name}</span>
                </div>
            `).join('');
            rsStudentList.style.display = 'block';

            // Attach clicks
            rsStudentList.querySelectorAll('.search-result-item').forEach(item => {
                item.onclick = () => {
                    selectedStudentId = item.dataset.id;
                    const st = students.find(x => x.id === selectedStudentId);
                    rsSearchInput.value = `${st.studentId} - ${st.name}`;
                    rsStudentList.style.display = 'none';
                    renderStudentReport(currentRsProfileId, selectedStudentId);
                    rsDetails.style.display = 'block';
                };
            });
        } else {
            rsStudentList.innerHTML = '<div style="padding: 1rem; color: #6b7280; text-align: center;">No students found.</div>';
            rsStudentList.style.display = 'block';
        }
    };

    // Hide dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!rsSearchInput.contains(e.target) && !rsStudentList.contains(e.target)) {
            if (rsStudentList) rsStudentList.style.display = 'none';
        }
    });

    // Single student PDF export
    const newSinglePdf = btnSinglePdf.cloneNode(true);
    btnSinglePdf.parentNode.replaceChild(newSinglePdf, btnSinglePdf);
    newSinglePdf.onclick = () => {
        showDownloadConfirm('Are you sure you want to download this Student Report as PDF?', () => exportSingleStudentPdf(currentRsProfileId, selectedStudentId));
    };
}

function renderClassPreview(profileId) {
    const container = document.getElementById('rc-preview-container');
    if (!profileId) {
        container.style.display = 'none';
        return;
    }

    const settings = Store.getSettings(currentUserId);
    const minAtt = settings.minAttendancePercent || 60;

    let students = Store.getStudents(profileId);
    const attendance = Store.getAttendance(profileId);

    students.sort((a, b) => a.studentId.localeCompare(b.studentId));

    const thead = document.querySelector('#rc-preview-table thead');
    const tbody = document.querySelector('#rc-preview-table tbody');

    // Headers
    let theadHtml = `<tr id="at-header-row">
        <th class="sticky-col sl-col" style="z-index: 3; background: var(--bg-main);">SL</th>
        <th class="sticky-col id-col" style="z-index: 3; background: var(--bg-main);">Student ID</th>
        <th class="sticky-col name-col" style="z-index: 3; background: var(--bg-main);">Name</th>`;

    attendance.forEach(a => {
        const d = new Date(a.date);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        theadHtml += `<th style="min-width: 90px; text-align: center;">${dd}/${mm}/${yyyy}</th>`;
    });
    theadHtml += `<th style="min-width: 90px; text-align: center;">% Present</th></tr>`;
    thead.innerHTML = theadHtml;

    if (students.length === 0) {
        let msg = 'No students in this class.';
        tbody.innerHTML = `<tr><td colspan="${3 + attendance.length + 1}" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">${msg}</td></tr>`;
        container.style.display = 'block';
        return;
    }

    // Rows
    tbody.innerHTML = students.map((student, idx) => {
        let pCount = 0;
        let total = attendance.length;

        let rowHtml = `<tr>
            <td class="sticky-col sl-col" style="text-align: center;">${idx + 1}</td>
            <td class="sticky-col id-col">${student.studentId}</td>
            <td class="sticky-col name-col">${student.name}</td>`;

        attendance.forEach(session => {
            const status = session.records[student.id] || '-';
            if (status === 'P' || status === 'L') pCount++;

            let statusClass = '';
            if (status === 'P') statusClass = 'status-P';
            else if (status === 'A') statusClass = 'status-A';
            else if (status === 'L') statusClass = 'status-L';

            rowHtml += `<td class="cell-attend ${statusClass}">${status}</td>`;
        });

        const pct = total > 0 ? Math.round((pCount / total) * 100) : 0;
        let pctColor = 'var(--text-main)';
        if (pct >= minAtt) pctColor = '#059669'; // Green if >= threshold
        else pctColor = '#dc2626'; // Red if below threshold

        rowHtml += `<td style="text-align: center; font-weight: 700; color: ${pctColor}; border-bottom: 1px solid #d1d5db; border-right: 1px solid #d1d5db;">${pct}%</td></tr>`;
        return rowHtml;
    }).join('');

    container.style.display = 'block';
}

function renderDefaultersPreview(profileId) {
    const container = document.getElementById('rd-preview-container');
    if (!profileId) {
        container.style.display = 'none';
        return;
    }

    const settings = Store.getSettings(currentUserId);
    const minAtt = settings.minAttendancePercent || 60;

    let students = Store.getStudents(profileId);
    const attendance = Store.getAttendance(profileId);

    const filterInput = document.getElementById('rd-filter-pct');
    const maxPct = filterInput && filterInput.value !== '' ? parseInt(filterInput.value, 10) : minAtt;

    let defaulters = students.filter(student => {
        let pCount = 0;
        attendance.forEach(session => {
            const status = session.records[student.id] || '-';
            if (status === 'P' || status === 'L') pCount++;
        });
        const pct = attendance.length > 0 ? Math.round((pCount / attendance.length) * 100) : 0;
        student._tmp_pct = pct;
        student._tmp_pCount = pCount;
        return pct < maxPct;
    });

    defaulters.sort((a, b) => a.studentId.localeCompare(b.studentId));

    const tbody = document.querySelector('#rd-preview-table tbody');
    if (defaulters.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No students found below ${maxPct}% attendance.</td></tr>`;
        container.style.display = 'block';
        return;
    }

    tbody.innerHTML = defaulters.map((student, idx) => {
        let pctColor = '#dc2626'; // Red
        return `<tr>
            <td style="text-align: center;">${idx + 1}</td>
            <td>${student.studentId}</td>
            <td>${student.name}</td>
            <td style="text-align: center;">${attendance.length}</td>
            <td style="text-align: center;">${student._tmp_pCount}</td>
            <td style="text-align: center; font-weight: 700; color: ${pctColor};">${student._tmp_pct}%</td>
        </tr>`;
    }).join('');

    container.style.display = 'block';
}

function renderStudentReport(profileId, internalStudentId) {
    const students = Store.getStudents(profileId);
    const attendance = Store.getAttendance(profileId);
    const student = students.find(s => s.id === internalStudentId);
    if (!student) return;

    document.getElementById('sr-name').textContent = student.name;
    document.getElementById('sr-id').textContent = `ID: ${student.studentId}`;

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let totalCount = attendance.length;

    const tbody = document.getElementById('sr-body');
    tbody.innerHTML = '';

    if (attendance.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="padding: 1.5rem; text-align: center; color: var(--text-muted);">No attendance records found.</td></tr>';
    } else {
        attendance.forEach((session, idx) => {
            const status = session.records[student.id] || '-';
            if (status === 'P') presentCount++;
            else if (status === 'L') { lateCount++; presentCount++; } // Late is considered present for total
            else if (status === 'A') absentCount++;

            const tr = document.createElement('tr');
            const d = new Date(session.date);
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

            let badgeStyle = 'background: #f3f4f6; color: #374151;';
            let statusText = 'Not Marked';

            if (status === 'P') { badgeStyle = 'background: #d1fae5; color: #059669;'; statusText = 'Present'; }
            else if (status === 'A') { badgeStyle = 'background: #fee2e2; color: #dc2626;'; statusText = 'Absent'; }
            else if (status === 'L') { badgeStyle = 'background: #fef3c7; color: #d97706;'; statusText = 'Late'; }

            tr.innerHTML = `
                <td style="padding: 1rem; border-bottom: 1px solid var(--border);">${idx + 1}</td>
                <td style="padding: 1rem; border-bottom: 1px solid var(--border);">${dateStr}</td>
                <td style="padding: 1rem; border-bottom: 1px solid var(--border); text-align: right;">
                    <span style="display:inline-block; padding: 0.375rem 1rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; ${badgeStyle}">
                        ${statusText}
                    </span>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

    document.getElementById('sr-stat-total').textContent = totalCount;
    document.getElementById('sr-stat-present').textContent = presentCount;
    document.getElementById('sr-stat-absent').textContent = absentCount;
    const statLateEl = document.getElementById('sr-stat-late');
    if (statLateEl) statLateEl.textContent = lateCount;

    const pctEl = document.getElementById('sr-chart-pct');
    pctEl.textContent = `${percentage}%`;

    const settings = Store.getSettings(currentUserId);
    const minAtt = settings.minAttendancePercent || 60;

    // Update donut chart
    let color = '#f59e0b'; // default warning / undefined
    if (percentage >= minAtt) color = '#10b981'; // Green
    else color = '#ef4444'; // Red

    pctEl.style.color = color;
    document.getElementById('sr-chart').style.background = `conic-gradient(${color} ${percentage}%, #e5e7eb ${percentage}%)`;
}


function exportSingleStudentPdf(profileId, studentId) {
    if (!profileId || !studentId) return;

    const user = Store.getUser();
    if (!user) return;

    const profile = Store.getProfiles(user.uid).find(p => p.id === profileId);
    const student = Store.getStudents(profileId).find(s => s.id === studentId);
    const attendance = Store.getAttendance(profileId);

    if (!profile || !student) return;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.setTextColor(79, 70, 229);
        doc.text(`Student Attendance Report`, 14, 20);

        doc.setFontSize(11);
        doc.setTextColor(31, 41, 55);
        doc.text(`Name: ${student.name}`, 14, 30);
        doc.text(`Student ID: ${student.studentId}`, 14, 36);

        doc.text(`Course: ${profile.course}`, 120, 30);
        doc.text(`Dept: ${profile.dept} | Batch: ${profile.batch} | Sec: ${profile.section}`, 120, 36);

        // Calculate Stats
        let p = 0, a = 0, l = 0;
        const rows = [];
        attendance.forEach((session, i) => {
            const status = session.records[student.id] || '-';
            if (status === 'P') p++;
            if (status === 'A') a++;
            if (status === 'L') l++;

            let statusText = 'Not Marked';
            if (status === 'P') statusText = 'Present';
            if (status === 'A') statusText = 'Absent';
            if (status === 'L') statusText = 'Late';

            const d = new Date(session.date);
            const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;

            rows.push([i + 1, dateStr, statusText]);
        });

        const total = attendance.length;
        const presentCount = p + l; // Late counts as present
        const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;

        // Draw Stats Box
        doc.setDrawColor(229, 231, 235);
        doc.setFillColor(249, 250, 251);
        doc.roundedRect(14, 42, 182, 25, 3, 3, 'FD');

        doc.setFontSize(10);
        doc.text(`Total Classes: ${total}`, 20, 52);
        doc.text(`Present: ${p}`, 65, 52);
        doc.text(`Late: ${l}`, 105, 52);
        doc.text(`Absent: ${a}`, 145, 52);

        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        if (pct >= 80) doc.setTextColor(5, 150, 105);
        else if (pct < 60) doc.setTextColor(220, 38, 38);
        else doc.setTextColor(217, 119, 6);
        doc.text(`Attendance Rate: ${pct}%`, 20, 60);

        // Table
        doc.autoTable({
            head: [['SL', 'Date', 'Status']],
            body: rows,
            startY: 75,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229] },
            didParseCell: function (data) {
                if (data.section === 'body' && data.column.index === 2) {
                    const val = data.cell.raw;
                    data.cell.styles.fontStyle = 'bold';
                    if (val === 'Present') { data.cell.styles.textColor = [5, 150, 105]; }
                    else if (val === 'Absent') { data.cell.styles.textColor = [220, 38, 38]; }
                    else if (val === 'Late') { data.cell.styles.textColor = [217, 119, 6]; }
                }
            }
        });

        doc.save(`${student.studentId}_Report.pdf`);
        AppUI.showToast('Student report downloaded', 'success');
    } catch (e) {
        console.error(e);
        AppUI.showToast('Export failed', 'error');
    }
}
