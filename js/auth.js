import { Store } from './store.js';
import { auth, isFirebaseInitialized, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from './firebase-config.js';
import { AppUI } from './app.js';
import { loadDashboard } from './dashboard.js';

export function setupAuth() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    
    // Switch forms
    document.getElementById('show-signup').addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        signupForm.classList.remove('hidden');
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
        e.preventDefault();
        signupForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const btn = loginForm.querySelector('button');
        const origText = btn.textContent;
        btn.textContent = 'Logging in...';
        btn.disabled = true;

        try {
            if (isFirebaseInitialized && navigator.onLine) {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                handleLoginSuccess({
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || 'Teacher'
                });
            } else {
                // Offline fallback - Check local users
                // For simplicity in this demo, if offline, we mock a user or check if this user previously logged in
                const localUser = Store.getUser();
                if (localUser && localUser.email === email) {
                    handleLoginSuccess(localUser);
                } else {
                    throw new Error("You are offline. Cannot verify credentials.");
                }
            }
        } catch (error) {
            AppUI.showToast(error.message || 'Login failed', 'error');
        } finally {
            btn.textContent = origText;
            btn.disabled = false;
        }
    });

    // Signup
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value;
        const email = document.getElementById('signup-email').value;
        const phone = document.getElementById('signup-phone').value;
        const password = document.getElementById('signup-password').value;
        
        const btn = signupForm.querySelector('button');
        const origText = btn.textContent;
        btn.textContent = 'Creating account...';
        btn.disabled = true;

        try {
            if (isFirebaseInitialized && navigator.onLine) {
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: name });
                
                handleLoginSuccess({
                    uid: userCredential.user.uid,
                    email,
                    displayName: name,
                    phone
                });
            } else {
                // Mock offline signup
                const mockUser = {
                    uid: Store.uuid(),
                    email,
                    displayName: name,
                    phone
                };
                handleLoginSuccess(mockUser);
            }
        } catch (error) {
            AppUI.showToast(error.message || 'Signup failed', 'error');
        } finally {
            btn.textContent = origText;
            btn.disabled = false;
        }
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', () => {
        Store.clearUser();
        if (isFirebaseInitialized && auth) {
            signOut(auth).catch(e => console.error("Sign out error:", e));
        }
        AppUI.switchView('auth-view');
        AppUI.showToast('Logged out successfully', 'info');
    });
}

export function checkAuthState() {
    const localUser = Store.getUser();

    if (isFirebaseInitialized && navigator.onLine) {
        // Show cached user IMMEDIATELY to prevent flash
        if (localUser) {
            document.getElementById('teacher-name').textContent = localUser.displayName;
            AppUI.switchView('dashboard-view');
        }

        // Then verify with Firebase in background
        onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                const merged = {
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || (localUser ? localUser.displayName : 'Teacher'),
                    phone: localUser ? localUser.phone || '' : ''
                };
                handleLoginSuccess(merged);
            } else {
                // Firebase says no session - force login
                Store.clearUser();
                AppUI.switchView('auth-view');
            }
        });
    } else {
        // Offline mode fallback
        if (localUser) {
            handleLoginSuccess(localUser);
        } else {
            AppUI.switchView('auth-view');
        }
    }
}

function handleLoginSuccess(user) {
    Store.setUser(user);
    document.getElementById('teacher-name').textContent = user.displayName;
    AppUI.switchView('dashboard-view');
    
    // Trigger sync immediately upon login
    Store.triggerSync();
}
