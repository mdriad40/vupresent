import { db, ref, set, get, child, update, isFirebaseInitialized } from './firebase-config.js';

const PREFIX = 'vu_';

export const Store = {
    // Generates unique ID
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },

    // User Data
    setUser(user) {
        localStorage.setItem(PREFIX + 'user', JSON.stringify(user));
    },
    getUser() {
        const u = localStorage.getItem(PREFIX + 'user');
        return u ? JSON.parse(u) : null;
    },
    clearUser() {
        localStorage.removeItem(PREFIX + 'user');
    },
    updateUser(updates) {
        let user = this.getUser();
        if (user) {
            user = { ...user, ...updates };
            this.setUser(user);
            this.triggerSync();

            // Also update Firebase profile info if possible
            if (navigator.onLine && isFirebaseInitialized) {
                import('./firebase-config.js').then(({ auth, updateProfile }) => {
                    if (auth.currentUser) {
                        updateProfile(auth.currentUser, { displayName: user.displayName });
                    }
                }).catch(e => console.error("Firebase updateProfile failed:", e));
            }
        }
        return user;
    },

    // Settings
    getSettings(userId) {
        const s = localStorage.getItem(PREFIX + 'settings_' + userId);
        const defaults = {
            minAttendancePercent: 60, // Default red threshold
            dangerColor: '#ef4444',
            warningColor: '#f59e0b',
            successColor: '#10b981'
        };
        return s ? { ...defaults, ...JSON.parse(s) } : defaults;
    },
    saveSettings(userId, settings) {
        localStorage.setItem(PREFIX + 'settings_' + userId, JSON.stringify(settings));
        // We can optionally sync this to Firebase too, but local is fine for now
    },

    // Profiles (Classes)
    getProfiles(userId) {
        const p = localStorage.getItem(PREFIX + 'profiles_' + userId);
        return p ? JSON.parse(p) : [];
    },
    saveProfile(userId, profile) {
        if (!profile.id) profile.id = this.uuid();
        profile.createdAt = profile.createdAt || new Date().toISOString();
        profile.synced = false;

        const profiles = this.getProfiles(userId);
        const idx = profiles.findIndex(p => p.id === profile.id);
        if (idx >= 0) {
            profiles[idx] = profile;
        } else {
            profiles.push(profile);
        }
        localStorage.setItem(PREFIX + 'profiles_' + userId, JSON.stringify(profiles));
        this.triggerSync();
        return profile;
    },
    queueDelete(path) {
        const queue = JSON.parse(localStorage.getItem(PREFIX + 'delete_queue') || '[]');
        if (!queue.includes(path)) {
            queue.push(path);
            localStorage.setItem(PREFIX + 'delete_queue', JSON.stringify(queue));
        }
        this.triggerSync();
    },

    deleteProfile(userId, profileId) {
        let profiles = this.getProfiles(userId);
        profiles = profiles.filter(p => p.id !== profileId);
        localStorage.setItem(PREFIX + 'profiles_' + userId, JSON.stringify(profiles));

        // Remove locally related students and attendance
        localStorage.removeItem(PREFIX + 'students_' + profileId);
        localStorage.removeItem(PREFIX + 'attendance_' + profileId);

        // Queue delete to Firebase
        this.queueDelete(`users/${userId}/course/${profileId}`);
        this.queueDelete(`users/${userId}/course-history/${profileId}`);
    },

    // Students
    getStudents(profileId) {
        const s = localStorage.getItem(PREFIX + 'students_' + profileId);
        return s ? JSON.parse(s) : [];
    },
    saveStudent(profileId, student) {
        if (!student.id) student.id = this.uuid();
        student.synced = false;

        const students = this.getStudents(profileId);
        const idx = students.findIndex(s => s.id === student.id);
        if (idx >= 0) {
            students[idx] = student;
        } else {
            students.push(student);
        }
        localStorage.setItem(PREFIX + 'students_' + profileId, JSON.stringify(students));
        this.triggerSync();
        return student;
    },
    deleteStudent(profileId, studentId) {
        let students = this.getStudents(profileId);
        students = students.filter(s => s.id !== studentId);
        localStorage.setItem(PREFIX + 'students_' + profileId, JSON.stringify(students));

        const user = this.getUser();
        if (user) {
            this.queueDelete(`users/${user.uid}/course-history/${profileId}/students/${studentId}`);
        }
    },

    // Attendance Data
    getAttendance(profileId) {
        const a = localStorage.getItem(PREFIX + 'attendance_' + profileId);
        return a ? JSON.parse(a) : [];
    },
    saveAttendanceSession(profileId, date, records) {
        const attendance = this.getAttendance(profileId);
        const existingIdx = attendance.findIndex(a => a.date === date);

        const session = { date, records, synced: false, updatedAt: new Date().toISOString() };

        if (existingIdx >= 0) {
            attendance[existingIdx] = session;
        } else {
            attendance.push(session);
            attendance.sort((a, b) => new Date(a.date) - new Date(b.date));
        }

        localStorage.setItem(PREFIX + 'attendance_' + profileId, JSON.stringify(attendance));
        this.triggerSync();
        return session;
    },
    updateAttendanceRecord(profileId, date, studentId, status) {
        const attendance = this.getAttendance(profileId);
        let session = attendance.find(a => a.date === date);
        if (!session) {
            session = { date, records: {}, synced: false, updatedAt: new Date().toISOString() };
            attendance.push(session);
            attendance.sort((a, b) => new Date(a.date) - new Date(b.date));
        }
        session.records[studentId] = status;
        session.synced = false;
        session.updatedAt = new Date().toISOString();

        localStorage.setItem(PREFIX + 'attendance_' + profileId, JSON.stringify(attendance));
        this.triggerSync();
    },

    // Sync Logic
    async syncFromFirebase(userId) {
        if (!navigator.onLine || !isFirebaseInitialized) return;
        try {
            const snapshot = await get(child(ref(db), `users/${userId}`));
            if (snapshot.exists()) {
                const data = snapshot.val();
                
                // Restore User Info
                if (data.user_info) {
                    const localUser = this.getUser() || {};
                    this.setUser({ ...localUser, ...data.user_info });
                }
                
                // Restore Profiles
                if (data.course) {
                    const profiles = Object.values(data.course);
                    localStorage.setItem(PREFIX + 'profiles_' + userId, JSON.stringify(profiles));
                }
                
                // Restore Students & Attendance
                if (data['course-history']) {
                    const courseHistory = data['course-history'];
                    for (const profileId in courseHistory) {
                        const history = courseHistory[profileId];
                        
                        if (history.students) {
                            const students = Object.values(history.students);
                            localStorage.setItem(PREFIX + 'students_' + profileId, JSON.stringify(students));
                        }
                        
                        if (history.attendance) {
                            const attendance = Object.values(history.attendance);
                            localStorage.setItem(PREFIX + 'attendance_' + profileId, JSON.stringify(attendance));
                        }
                    }
                }
            }
        } catch (error) {
            console.error("Failed to sync from Firebase:", error);
        }
    },

    async triggerSync() {
        if (!navigator.onLine || !isFirebaseInitialized) return;

        const user = this.getUser();
        if (!user) return;

        try {
            const updates = {};
            const itemsToMarkSynced = {
                profiles: [],
                students: {},
                attendance: {}
            };

            // Process Delete Queue first
            const deleteQueue = JSON.parse(localStorage.getItem(PREFIX + 'delete_queue') || '[]');
            deleteQueue.forEach(path => {
                updates[path] = null;
            });

            // Sync User Info Always
            updates[`users/${user.uid}/user_info`] = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || 'Teacher',
                phone: user.phone || ''
            };

            // Sync Profiles
            const profiles = this.getProfiles(user.uid);
            profiles.forEach(p => {
                if (!p.synced) {
                    updates[`users/${user.uid}/course/${p.id}`] = p;
                    itemsToMarkSynced.profiles.push(p.id);
                }
            });

            // Sync Students & Attendance for each profile
            profiles.forEach(p => {
                const students = this.getStudents(p.id);
                students.forEach(s => {
                    if (!s.synced) {
                        updates[`users/${user.uid}/course-history/${p.id}/students/${s.id}`] = s;
                        if (!itemsToMarkSynced.students[p.id]) itemsToMarkSynced.students[p.id] = [];
                        itemsToMarkSynced.students[p.id].push(s.id);
                    }
                });

                const attendance = this.getAttendance(p.id);
                attendance.forEach(a => {
                    if (!a.synced) {
                        updates[`users/${user.uid}/course-history/${p.id}/attendance/${a.date}`] = a;
                        if (!itemsToMarkSynced.attendance[p.id]) itemsToMarkSynced.attendance[p.id] = [];
                        itemsToMarkSynced.attendance[p.id].push(a.date);
                    }
                });
            });

            if (Object.keys(updates).length > 0) {
                // Actually push to Firebase
                await update(ref(db), updates);
                console.log("Data synced to Firebase successfully");

                // Clear delete queue now that it succeeded
                if (deleteQueue.length > 0) {
                    localStorage.removeItem(PREFIX + 'delete_queue');
                }

                // Mark local data as synced ONLY AFTER successful push
                if (itemsToMarkSynced.profiles.length > 0) {
                    const freshProfiles = this.getProfiles(user.uid);
                    freshProfiles.forEach(p => {
                        if (itemsToMarkSynced.profiles.includes(p.id)) p.synced = true;
                    });
                    localStorage.setItem(PREFIX + 'profiles_' + user.uid, JSON.stringify(freshProfiles));
                }

                for (const pid in itemsToMarkSynced.students) {
                    const freshStudents = this.getStudents(pid);
                    freshStudents.forEach(s => {
                        if (itemsToMarkSynced.students[pid].includes(s.id)) s.synced = true;
                    });
                    localStorage.setItem(PREFIX + 'students_' + pid, JSON.stringify(freshStudents));
                }

                for (const pid in itemsToMarkSynced.attendance) {
                    const freshAttendance = this.getAttendance(pid);
                    freshAttendance.forEach(a => {
                        if (itemsToMarkSynced.attendance[pid].includes(a.date)) a.synced = true;
                    });
                    localStorage.setItem(PREFIX + 'attendance_' + pid, JSON.stringify(freshAttendance));
                }

                // Update UI Indicator if needed
                const indicator = document.getElementById('sync-indicator');
                if (indicator) {
                    indicator.classList.add('syncing');
                    setTimeout(() => indicator.classList.remove('syncing'), 1000);
                }
            }

        } catch (e) {
            console.error("Firebase sync failed! Data remains marked as un-synced for next attempt.", e);
            if (e.message && e.message.includes('permission_denied')) {
                import('./app.js').then(({ AppUI }) => AppUI.showToast("Database Permission Denied! Check your Firebase Rules.", "error"));
            } else {
                import('./app.js').then(({ AppUI }) => AppUI.showToast("Firebase Error: " + e.message, "error"));
            }
        }
    }
};

window.addEventListener('online', () => {
    Store.triggerSync();
});
