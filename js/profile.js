import { Store } from './store.js';
import { AppUI } from './app.js';

let currentProfile = null;
let lastSpacePress = 0;

export function loadProfile(profile) {
    currentProfile = profile;
    AppUI.switchView('profile-view');

    // Update Header
    document.getElementById('pv-course-name').textContent = `${profile.course} ${profile.title ? `(${profile.title})` : ''}`;
    document.getElementById('pv-course-details').textContent = `Batch ${profile.batch} • Section ${profile.section} • ${profile.semester} • ${profile.dept}`;

    // Default to today's date in the date picker, max is today
    const dateInput = document.getElementById('attendance-date');
    const todayStr = new Date().toISOString().split('T')[0];
    dateInput.value = todayStr;

    // Initialize flatpickr
    flatpickr(dateInput, {
        maxDate: "today",
        defaultDate: "today",
        dateFormat: "Y-m-d",
        disableMobile: true
    });

    // Setup Back Button
    document.getElementById('btn-back-dashboard').onclick = () => {
        AppUI.switchView(AppUI.previousViewId && AppUI.previousViewId !== 'profile-view' ? AppUI.previousViewId : 'dashboard-view');
        currentProfile = null;
    };

    // Class Delete logic
    document.getElementById('btn-delete-class').onclick = () => {
        AppUI.showConfirm('Delete Class', 'Are you sure you want to delete this class? All students and attendance data will be permanently removed. This cannot be undone.', 'Delete', 'btn-danger-solid', () => {
            const user = Store.getUser();
            Store.deleteProfile(user.uid, currentProfile.id);
            AppUI.switchView('dashboard-view');
            AppUI.showToast('Class deleted', 'success');
            import('./dashboard.js').then(({ loadDashboard }) => loadDashboard(user.uid));
        });
    };

    renderStudents();
    renderAttendanceGrid();

    setupStudentForm();
    setupAttendanceActions();
    setupExports();
}

function setupStudentForm() {
    const form = document.getElementById('form-add-student');
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentProfile) return;

        const studentId = document.getElementById('as-id').value;
        const name = document.getElementById('as-name').value;

        Store.saveStudent(currentProfile.id, { studentId, name });
        AppUI.closeModal('modal-add-student');
        AppUI.showToast('Student added successfully', 'success');

        newForm.reset();

        renderStudents();
        renderAttendanceGrid();
    });

    document.getElementById('btn-add-student').onclick = () => {
        AppUI.openModal('modal-add-student');
        setTimeout(() => { const el = document.getElementById('as-id'); if (el) el.focus(); }, 200);
    };

    // Edit Student Modal Form
    const editForm = document.getElementById('form-edit-student');
    const newEditForm = editForm.cloneNode(true);
    editForm.parentNode.replaceChild(newEditForm, editForm);

    newEditForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!currentProfile) return;

        const sid = document.getElementById('es-uid').value;
        const studentId = document.getElementById('es-id').value;
        const name = document.getElementById('es-name').value;

        Store.saveStudent(currentProfile.id, { id: sid, studentId, name });
        AppUI.closeModal('modal-edit-student');
        AppUI.showToast('Student updated successfully', 'success');

        renderStudents();
        renderAttendanceGrid();
    });
}

function renderStudents() {
    if (!currentProfile) return;
    const students = Store.getStudents(currentProfile.id);
    const tbody = document.getElementById('student-list-body');
    const emptyState = document.getElementById('students-empty');

    tbody.innerHTML = '';

    if (students.length === 0) {
        emptyState.classList.remove('hidden');
        tbody.parentElement.style.display = 'none';
        return;
    }

    emptyState.classList.add('hidden');
    tbody.parentElement.style.display = 'table';

    // Sort by Student ID
    students.sort((a, b) => a.studentId.localeCompare(b.studentId));

    students.forEach((s, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${index + 1}</td>
            <td class="font-mono">${s.studentId}</td>
            <td>${s.name}</td>
            <td style="text-align: right;">
                <button class="btn btn-icon btn-ghost btn-edit-student" data-id="${s.id}" title="Edit Student">
                    <i class="ph ph-pencil-simple"></i>
                </button>
                <button class="btn btn-icon btn-ghost btn-danger btn-delete-student" data-id="${s.id}" title="Delete Student">
                    <i class="ph ph-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Attach student action events
    document.querySelectorAll('.btn-edit-student').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sid = e.currentTarget.dataset.id;
            const student = Store.getStudents(currentProfile.id).find(st => st.id === sid);
            if (student) {
                document.getElementById('es-uid').value = student.id;
                document.getElementById('es-id').value = student.studentId;
                document.getElementById('es-name').value = student.name;
                AppUI.openModal('modal-edit-student');
            }
        });
    });

    document.querySelectorAll('.btn-delete-student').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sid = e.currentTarget.dataset.id;
            AppUI.showConfirm('Delete Student', 'Are you sure you want to delete this student? Their attendance records will also be removed.', 'Delete', 'btn-danger-solid', () => {
                Store.deleteStudent(currentProfile.id, sid);
                AppUI.showToast('Student deleted', 'success');
                renderStudents();
                renderAttendanceGrid();
            });
        });
    });
}

function setupAttendanceActions() {
    const btnAddDate = document.getElementById('btn-add-date');
    const newBtn = btnAddDate.cloneNode(true);
    btnAddDate.parentNode.replaceChild(newBtn, btnAddDate);

    newBtn.addEventListener('click', () => {
        if (!currentProfile) return;

        // Guard: check if students exist
        const students = Store.getStudents(currentProfile.id);
        if (students.length === 0) {
            AppUI.showToast('Please add students first before creating a session.', 'error');
            return;
        }

        const dateVal = document.getElementById('attendance-date').value;
        if (!dateVal) {
            AppUI.showToast('Please select a date', 'error');
            return;
        }

        const attendance = Store.getAttendance(currentProfile.id);
        const exists = attendance.find(a => a.date === dateVal);
        if (exists) {
            AppUI.showToast('Session for this date already exists', 'error');
            return;
        }

        Store.saveAttendanceSession(currentProfile.id, dateVal, {});
        AppUI.showToast('Session added', 'success');
        renderAttendanceGrid();

        // Focus first cell of this session
        const currentAttendance = Store.getAttendance(currentProfile.id);
        const colIndex = currentAttendance.findIndex(a => a.date === dateVal);
        if (colIndex >= 0) {
            moveFocus(0, colIndex);
        }
    });
}

function renderAttendanceGrid() {
    if (!currentProfile) return;

    const students = Store.getStudents(currentProfile.id);
    const attendance = Store.getAttendance(currentProfile.id);

    const headerRow = document.getElementById('at-header-row');
    const tbody = document.getElementById('at-body');
    const emptyState = document.getElementById('attendance-empty');
    const table = document.getElementById('attendance-table');

    if (students.length === 0) {
        emptyState.classList.remove('hidden');
        table.style.display = 'none';
        return;
    }

    emptyState.classList.add('hidden');
    table.style.display = 'table';

    // Sort students by ID
    students.sort((a, b) => a.studentId.localeCompare(b.studentId));

    // Keep first 3 columns, remove the rest
    while (headerRow.children.length > 3) {
        headerRow.removeChild(headerRow.lastChild);
    }

    // Add Date columns with full dd/mm/yyyy format + delete button
    attendance.forEach(session => {
        const th = document.createElement('th');
        const d = new Date(session.date);
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();

        th.style.minWidth = '100px';
        th.style.textAlign = 'center';
        th.style.position = 'relative';
        th.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; gap:4px;">
                <span>${dd}/${mm}/${yyyy}</span>
                <button class="btn-del-date" data-date="${session.date}" title="Delete this session" style="background:none;border:none;cursor:pointer;color:#ef4444;font-size:0.85rem;padding:2px;line-height:1;opacity:0.6;">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        `;
        th.title = session.date;
        headerRow.appendChild(th);
    });

    // Attach delete-date handlers
    headerRow.querySelectorAll('.btn-del-date').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dateToDelete = e.currentTarget.dataset.date;
            AppUI.showConfirm('Delete Session', `Are you sure you want to delete the attendance session for ${dateToDelete}? This cannot be undone.`, 'Delete', 'btn-danger-solid', () => {
                const att = Store.getAttendance(currentProfile.id);
                const filtered = att.filter(a => a.date !== dateToDelete);
                localStorage.setItem('vu_attendance_' + currentProfile.id, JSON.stringify(filtered));
                // Also queue delete from Firebase
                const user = Store.getUser();
                if (user) {
                    Store.queueDelete(`users/${user.uid}/course-history/${currentProfile.id}/attendance/${dateToDelete}`);
                }
                AppUI.showToast('Session deleted', 'success');
                renderAttendanceGrid();
            });
        });
    });

    tbody.innerHTML = '';

    students.forEach((s, rIndex) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="sticky-col sl-col">${rIndex + 1}</td>
            <td class="sticky-col id-col font-mono">${s.studentId}</td>
            <td class="sticky-col name-col">${s.name}</td>
        `;

        attendance.forEach((session, cIndex) => {
            const status = session.records[s.id] || '';
            const td = document.createElement('td');
            td.className = 'cell-attend';
            if (status) td.classList.add(`status-${status}`);
            td.textContent = status || '-';
            td.tabIndex = 0; // Make focusable

            td.dataset.studentId = s.id;
            td.dataset.date = session.date;
            td.dataset.row = rIndex;
            td.dataset.col = cIndex;

            td.addEventListener('keydown', handleCellKeydown);
            td.addEventListener('click', function () { this.focus(); });

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function handleCellKeydown(e) {
    if (e.repeat) return;

    if (['Enter', ' ', 'Shift', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
    }

    const cell = e.target;
    const studentId = cell.dataset.studentId;
    const date = cell.dataset.date;
    const row = parseInt(cell.dataset.row);
    const col = parseInt(cell.dataset.col);

    // Navigation
    if (e.key === 'ArrowDown') return moveFocus(row + 1, col);
    if (e.key === 'ArrowUp') return moveFocus(row - 1, col);
    if (e.key === 'ArrowLeft') return moveFocus(row, col - 1);
    if (e.key === 'ArrowRight') return moveFocus(row, col + 1);

    let newStatus = null;

    if (e.key === 'Enter') {
        newStatus = 'P';
    } else if (e.key === 'Shift') {
        newStatus = 'L';
    } else if (e.key === ' ') {
        newStatus = 'A';
    }

    if (newStatus) {
        Store.updateAttendanceRecord(currentProfile.id, date, studentId, newStatus);

        cell.className = 'cell-attend';
        cell.classList.add(`status-${newStatus}`);
        cell.textContent = newStatus;

        moveFocus(row + 1, col);
    }
}

function moveFocus(row, col) {
    const nextCell = document.querySelector(`.cell-attend[data-row="${row}"][data-col="${col}"]`);
    if (nextCell) nextCell.focus();
}

function setupExports() {
    const btnExcel = document.getElementById('btn-export-excel');
    const btnPdf = document.getElementById('btn-export-pdf');

    const newBtnExcel = btnExcel.cloneNode(true);
    btnExcel.parentNode.replaceChild(newBtnExcel, btnExcel);
    newBtnExcel.addEventListener('click', () => {
        AppUI.showConfirm('Export to Excel', 'This will download the attendance data as an Excel (.xlsx) file.', 'Export Excel', 'btn-primary', exportToExcel);
    });
    newBtnPdf.addEventListener('click', () => {
        AppUI.showConfirm('Export to PDF', 'This will download the attendance data as a PDF file.', 'Export PDF', 'btn-primary', exportToPdf);
    });
}

export function getExportData(overrideProfileId, filterMaxPct = null) {
    const user = Store.getUser();
    if (!user) return null;

    let pId = null;
    if (typeof overrideProfileId === 'string') {
        pId = overrideProfileId;
    } else if (currentProfile) {
        pId = currentProfile.id;
    }

    if (!pId) return null;

    const profile = Store.getProfiles(user.uid).find(p => p.id === pId);
    if (!profile) return null;

    let students = Store.getStudents(pId);
    const attendance = Store.getAttendance(pId);

    if (filterMaxPct !== null && filterMaxPct >= 0) {
        students = students.filter(student => {
            let pCount = 0;
            attendance.forEach(a => {
                const status = a.records[student.id] || '';
                if (status === 'P' || status === 'L') pCount++;
            });
            const pct = attendance.length > 0 ? Math.round((pCount / attendance.length) * 100) : 0;
            return pct < filterMaxPct;
        });
    }

    students.sort((a, b) => a.studentId.localeCompare(b.studentId));

    // Format date headers as dd/mm/yy
    const dateHeaders = attendance.map(a => {
        const d = new Date(a.date);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)}`;
    });

    const headers = ['SL', 'Student ID', 'Name', ...dateHeaders, '% Present'];

    const rows = students.map((s, index) => {
        const row = [index + 1, s.studentId, s.name];
        let presentCount = 0;
        let totalCount = attendance.length;

        attendance.forEach(a => {
            const status = a.records[s.id] || '';
            row.push(status);
            // Treat Present and Late as "present" for calculation
            if (status === 'P' || status === 'L') presentCount++;
        });

        const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;
        row.push(`${percentage}%`);
        return row;
    });

    return { headers, rows, title: `${profile.course}_Attendance`, profile };
}

export function exportToExcel(profileId, filterMaxPct = null) {
    const data = getExportData(profileId, filterMaxPct);
    if (!data || data.rows.length === 0) {
        AppUI.showToast('No data to export', 'error');
        return;
    }

    const user = Store.getUser();
    const settings = Store.getSettings(user ? user.uid : null);
    const minAtt = settings.minAttendancePercent || 60;

    try {
        const wsData = [data.headers, ...data.rows];
        const worksheet = XLSX.utils.aoa_to_sheet(wsData);

        // Apply styles to all cells
        const range = XLSX.utils.decode_range(worksheet['!ref']);

        // Define exact colors matching PDF
        const colors = {
            headerBg: '4F46E5', // indigo-600
            pBg: 'D1FAE5',      // emerald-100
            pText: '059669',    // emerald-600
            aBg: 'FEE2E2',      // red-100
            aText: 'DC2626',    // red-600
            lBg: 'FEF3C7',      // amber-100
            lText: 'D97706',    // amber-600
        };

        for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
                if (!worksheet[cellRef]) continue;

                const val = worksheet[cellRef].v;

                let cellStyle = {
                    font: { name: 'Arial', sz: 9, color: { rgb: '1F2937' } },
                    alignment: { vertical: 'center', horizontal: 'center' },
                    border: {
                        top: { style: 'thin', color: { rgb: 'E5E7EB' } },
                        bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
                        left: { style: 'thin', color: { rgb: 'E5E7EB' } },
                        right: { style: 'thin', color: { rgb: 'E5E7EB' } }
                    }
                };

                // ID and Name left align
                if (C === 1 || C === 2) cellStyle.alignment.horizontal = 'left';

                if (R === 0) {
                    // Header row
                    cellStyle.font = { bold: true, color: { rgb: 'FFFFFF' }, sz: 9 };
                    cellStyle.fill = { fgColor: { rgb: colors.headerBg } };
                } else if (C >= 3 && C < data.headers.length - 1) {
                    // Status cells
                    if (val === 'P') {
                        cellStyle.fill = { fgColor: { rgb: colors.pBg } };
                        cellStyle.font.color = { rgb: colors.pText };
                        cellStyle.font.bold = true;
                    } else if (val === 'A') {
                        cellStyle.fill = { fgColor: { rgb: colors.aBg } };
                        cellStyle.font.color = { rgb: colors.aText };
                        cellStyle.font.bold = true;
                    } else if (val === 'L') {
                        cellStyle.fill = { fgColor: { rgb: colors.lBg } };
                        cellStyle.font.color = { rgb: colors.lText };
                        cellStyle.font.bold = true;
                    }
                } else if (C === data.headers.length - 1) {
                    // % Present
                    cellStyle.font.bold = true;
                    if (val && typeof val === 'string' && val.includes('%')) {
                        const numVal = parseInt(val.replace('%', ''));
                        if (!isNaN(numVal)) {
                            if (numVal >= minAtt) cellStyle.font.color = { rgb: colors.pText };
                            else cellStyle.font.color = { rgb: colors.aText };
                        }
                    }
                }

                worksheet[cellRef].s = cellStyle;
            }
        }

        // Set column widths
        const colWidths = [{ wch: 5 }, { wch: 15 }, { wch: 25 }]; // SL, ID, Name
        for (let i = 3; i < data.headers.length; i++) {
            colWidths.push({ wch: Math.max(10, String(data.headers[i]).length + 2) });
        }
        worksheet['!cols'] = colWidths;

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
        XLSX.writeFile(workbook, `${data.title}.xlsx`);
        AppUI.showToast('Exported to Excel successfully', 'success');
    } catch (e) {
        console.error(e);
        AppUI.showToast('Excel export failed', 'error');
    }
}

export function exportToPdf(profileId, filterMaxPct = null) {
    const data = getExportData(profileId, filterMaxPct);
    if (!data || data.rows.length === 0) {
        AppUI.showToast('No data to export', 'error');
        return;
    }

    const user = Store.getUser();
    const settings = Store.getSettings(user ? user.uid : null);
    const minAtt = settings.minAttendancePercent || 60;

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });

        doc.setFontSize(14);
        doc.text(`Attendance Sheet: ${data.profile.course}`, 14, 12);
        doc.setFontSize(9);
        doc.text(`Batch: ${data.profile.batch} | Section: ${data.profile.section} | Dept: ${data.profile.dept}`, 14, 18);

        const headers = data.headers;
        const rows = data.rows;

        // Column styles: auto widths for ID and Name to minimize blank space
        const columnStyles = {
            0: { cellWidth: 'auto', halign: 'center' },  // SL
            1: { cellWidth: 'auto', halign: 'left' },     // Student ID
            2: { cellWidth: 'auto', halign: 'left' },     // Name
        };
        // Date columns + % Present - narrow and centered
        for (let i = 3; i < headers.length; i++) {
            columnStyles[i] = { cellWidth: 'auto', halign: 'center' };
        }

        // Ensure the last column (% Present) has a bit more space and bold text
        columnStyles[headers.length - 1] = { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' };

        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 22,
            theme: 'grid',
            styles: {
                fontSize: 7,
                cellPadding: 1.5,
                overflow: 'linebreak',
                valign: 'middle'
            },
            headStyles: {
                fillColor: [79, 70, 229],
                halign: 'center',
                valign: 'middle',
                fontSize: 6,
                cellPadding: 1.5
            },
            columnStyles: columnStyles,
            didParseCell: function (data) {
                // Color the P/A/L cells (all columns after Name, except last % column)
                if (data.section === 'body' && data.column.index >= 3 && data.column.index < headers.length - 1) {
                    const val = data.cell.raw;
                    if (val === 'P') {
                        data.cell.styles.fillColor = [209, 250, 229]; // green bg
                        data.cell.styles.textColor = [5, 150, 105];   // green text
                        data.cell.styles.fontStyle = 'bold';
                    } else if (val === 'A') {
                        data.cell.styles.fillColor = [254, 226, 226]; // red bg
                        data.cell.styles.textColor = [220, 38, 38];   // red text
                        data.cell.styles.fontStyle = 'bold';
                    } else if (val === 'L') {
                        data.cell.styles.fillColor = [254, 243, 199]; // yellow bg
                        data.cell.styles.textColor = [217, 119, 6];   // yellow text
                        data.cell.styles.fontStyle = 'bold';
                    }
                }

                // Color for the % Present column
                if (data.section === 'body' && data.column.index === headers.length - 1) {
                    const valStr = data.cell.raw.replace('%', '');
                    const val = parseInt(valStr);
                    if (!isNaN(val)) {
                        if (val >= minAtt) {
                            data.cell.styles.textColor = [5, 150, 105]; // green
                        } else {
                            data.cell.styles.textColor = [220, 38, 38]; // red
                        }
                    }
                }
            }
        });

        doc.save(`${data.title}.pdf`);
        AppUI.showToast('Exported to PDF successfully', 'success');
    } catch (e) {
        console.error(e);
        AppUI.showToast('PDF export failed', 'error');
    }
}
