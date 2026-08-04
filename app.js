// ==========================================
// FIREBASE CONFIGURATION & INITIALIZATION
// ==========================================
// ⚠️ ДЛЯ РОБОТИ В ХМАРІ ВКАЖІТЬ КЛЮЧІ ВАШОГО FIREBASE ПРОЄКТУ (console.firebase.google.com):
const firebaseConfig = {
    apiKey: "AIzaSyCkac8yMY1R1OeSKT6VzfwmlnZNMOHfCpE",
    authDomain: "books-rewarded.firebaseapp.com",
    projectId: "books-rewarded",
    storageBucket: "books-rewarded.firebasestorage.app",
    messagingSenderId: "187549002249",
    appId: "1:187549002249:web:a3b6bdb1dd2ad2b8ab26d8",
    measurementId: "G-EWB3DPR5ZR"
};

let auth = null;
let db = null;
let currentFamilyId = null;
let unsubscribeFirestore = null;
let isFirebaseConfigured = false;

// Auth UI state
const authState = {
    mode: 'login', // 'login' | 'register'
    user: null,
    familyName: ''
};

// State Management
const state = {
    currentRole: 'kid',
    parentPin: '1234',
    activeChildId: null,
    activeReadingBookId: null,
    activeKidSubTab: 'shelf',
    newChildAvatarSeed: 'Sofia',
    bookshelf: {
        searchQuery: '',
        statusFilter: 'all',
        sortBy: 'progress_desc',
        viewMode: 'grid'
    },
    children: [],
    timer: {
        intervalId: null,
        secondsElapsed: 0,
        isRunning: false,
        lastSpeedMetrics: null
    },
    notifications: [],
    books: [],
    activeQuiz: {
        bookId: null,
        questionIndex: 0,
        selectedOption: null,
        score: 0,
        questions: [
            {
                question: 'Це демо-питання. Додайте книгу та пройдіть квіз.',
                options: ['Відповідь A', 'Відповідь B', 'Відповідь C', 'Відповідь D'],
                correctIndex: 0,
                explanation: 'Це приклад пояснення відповіді.'
            }
        ]
    }
};

// Initialize Firebase
function initFirebase() {
    if (typeof firebase !== 'undefined') {
        try {
            if (firebaseConfig.apiKey && firebaseConfig.apiKey !== "YOUR_API_KEY") {
                firebase.initializeApp(firebaseConfig);
                auth = firebase.auth();
                db = firebase.firestore();
                isFirebaseConfigured = true;

                // Listen to Auth State Changes
                auth.onAuthStateChanged(async (user) => {
                    if (user) {
                        authState.user = user;
                        await loadUserFamilyData(user.uid);
                    } else {
                        authState.user = null;
                        authState.familyName = '';
                        currentFamilyId = null;
                        if (unsubscribeFirestore) {
                            unsubscribeFirestore();
                            unsubscribeFirestore = null;
                        }
                        state.children = [];
                        state.books = [];
                        state.notifications = [];
                        state.activeChildId = null;
                        renderUI();
                    }
                });
            } else {
                console.info("Firebase: Ключі конфігурації ще не вказано. Застосунок працює у демонстраційному локальному режимі.");
            }
        } catch (err) {
            console.warn("Firebase Init Warning:", err);
        }
    }
}

// ------------------------------------------
// AUTHENTICATION & FIRESTORE DATA SYNC
// ------------------------------------------
function togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) {
        icon.className = isPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye';
    }
}

function switchAuthMode(mode) {
    authState.mode = mode;
    const isReg = mode === 'register';

    document.getElementById('authTabLogin').classList.toggle('active', !isReg);
    document.getElementById('authTabRegister').classList.toggle('active', isReg);
    document.getElementById('registerFields').classList.toggle('hidden', !isReg);
    
    const forgotRow = document.getElementById('forgotPasswordRow');
    if (forgotRow) forgotRow.classList.toggle('hidden', isReg);

    const btn = document.getElementById('authSubmitBtn');
    if (btn) {
        btn.innerHTML = isReg
            ? '<i class="fa-solid fa-user-plus"></i> Створити акаунт родини'
            : '<i class="fa-solid fa-right-to-bracket"></i> Увійти у родинний акаунт';
    }

    clearAuthAlerts();
}

function clearAuthAlerts() {
    const errEl = document.getElementById('authErrorAlert');
    const succEl = document.getElementById('authSuccessAlert');
    if (errEl) { errEl.innerText = ''; errEl.classList.add('hidden'); }
    if (succEl) { succEl.innerText = ''; succEl.classList.add('hidden'); }
}

function showAuthError(msg) {
    const errEl = document.getElementById('authErrorAlert');
    if (errEl) { errEl.innerText = msg; errEl.classList.remove('hidden'); }
}

function showAuthSuccess(msg) {
    const succEl = document.getElementById('authSuccessAlert');
    if (succEl) { succEl.innerText = msg; succEl.classList.remove('hidden'); }
}

async function handleForgotPassword() {
    clearAuthAlerts();
    const email = document.getElementById('authEmail').value.trim();

    if (!email) {
        showAuthError("Будь ласка, введіть ваші email адреси у полі выше та натисніть 'Забули пароль?' повторно.");
        return;
    }

    if (!isFirebaseConfigured || !auth) {
        showAuthError("⚠️ Firebase ще не налаштовано.");
        return;
    }

    try {
        showAuthSuccess("Надсилання інструкцій для скидання пароля...");
        await auth.sendPasswordResetEmail(email);
        showAuthSuccess(`📧 Лист для відновлення пароля надіслано на ${email}! Перевірте пошту та дотримуйтесь інструкцій.`);
    } catch (err) {
        console.error("Помилка відновлення пароля:", err);
        let msg = err.message;
        if (err.code === 'auth/user-not-found') {
            msg = "Акаунт з такою поштою не знайдено!";
        } else if (err.code === 'auth/invalid-email') {
            msg = "Некоректний формат email адреси!";
        }
        showAuthError(msg);
    }
}

async function handleAuthSubmit(e) {
    e.preventDefault();
    clearAuthAlerts();

    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;

    if (!isFirebaseConfigured || !auth) {
        showAuthError("⚠️ Вкажіть ключі вашого Firebase проєкту в файлі app.js для увімкнення акаунтів!");
        return;
    }

    if (authState.mode === 'register') {
        const familyName = document.getElementById('authFamilyName').value.trim();
        const pin = document.getElementById('authParentPin').value.trim() || '1234';

        if (!familyName) {
            showAuthError("Будь ласка, введіть назву вашої родини.");
            return;
        }

        try {
            showAuthSuccess("Створення родинного акаунту...");
            const userCred = await auth.createUserWithEmailAndPassword(email, password);
            
            // Send Email Verification
            if (userCred.user && !userCred.user.emailVerified) {
                try {
                    await userCred.user.sendEmailVerification();
                    console.info("Лист з підтвердженням email надіслано на:", email);
                } catch (vErr) {
                    console.warn("Помилка надсилання листа підтвердження:", vErr);
                }
            }
        } catch (err) {
            console.error("Помилка реєстрації:", err);
            let msg = err.message;
            if (err.code === 'auth/email-already-in-use') {
                msg = "Акаунт з такою поштою вже існує! Натисніть кнопку 'Вхід' вище та введіть ваш пароль.";
            } else if (err.code === 'auth/weak-password') {
                msg = "Пароль має містити щонайменше 6 символів!";
            } else if (err.code === 'auth/invalid-email') {
                msg = "Некоректний формат email адреси!";
            }
            showAuthError(msg);
        }

    } else { // LOGIN
        try {
            showAuthSuccess("Вхід у акаунт...");
            await auth.signInWithEmailAndPassword(email, password);
        } catch (err) {
            console.error("Помилка входу:", err);
            let msg = err.message;
            if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
                msg = "Невірний email або пароль! Перевірте дані та спробуйте ще раз.";
            } else if (err.code === 'auth/invalid-email') {
                msg = "Некоректний формат email адреси!";
            }
            showAuthError(msg);
        }
    }
}

async function loadUserFamilyData(uid) {
    if (!db) return;
    try {
        currentFamilyId = uid;
        const famDocRef = db.collection('families').doc(uid);
        const famDoc = await famDocRef.get();

        if (!famDoc.exists) {
            const pendingName = document.getElementById('authFamilyName')?.value.trim() || 'Моя Родина';
            const pendingPin = document.getElementById('authParentPin')?.value.trim() || '1234';

            await famDocRef.set({
                familyName: pendingName,
                parentPin: pendingPin,
                children: [],
                books: [],
                notifications: [],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await db.collection('users').doc(uid).set({
                email: authState.user ? authState.user.email : '',
                familyId: uid,
                role: 'parent'
            }, { merge: true });
        }

        if (!isKidOnlyUrlMode) {
            state.currentRole = 'parent';
        }

        // Listen to Family Document Realtime Updates
        if (unsubscribeFirestore) unsubscribeFirestore();
        unsubscribeFirestore = famDocRef.onSnapshot(doc => {
            if (doc.exists) {
                const famData = doc.data();
                authState.familyName = famData.familyName || 'Родина';
                state.parentPin = famData.parentPin || '1234';
                state.children = famData.children || [];
                state.books = famData.books || [];
                state.notifications = famData.notifications || [];

                if (!state.activeChildId && state.children.length > 0) {
                    state.activeChildId = state.children[0].id;
                }
                renderUI();
            }
        });
    } catch (err) {
        console.error("Помилка завантаження даних родини:", err);
    }
}

async function handleSignOut() {
    if (auth) {
        try {
            await auth.signOut();
        } catch (err) {
            console.error("Помилка виходу з акаунту:", err);
        }
    }
}

async function saveStateToFirestore() {
    if (!isFirebaseConfigured || !db || !currentFamilyId) return;
    try {
        await db.collection('families').doc(currentFamilyId).set({
            parentPin: state.parentPin,
            children: state.children,
            books: state.books,
            notifications: state.notifications,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (err) {
        console.error("Помилка синхронізації з Firestore:", err);
    }
}

// UTILITY: HTML ESCAPE SANITIZER
function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// MODAL UTILITY: BACKDROP CLICK CLOSING
function handleBackdropClick(event, modalId) {
    // Backdrop click disabled — modals close only via close/cancel buttons
}

// BUSINESS LOGIC: READING SPEED CALCULATOR
function calculateSessionSpeed(durationSeconds, pagesRead) {
    if (durationSeconds <= 0 || pagesRead <= 0) {
        return { durationSeconds: 0, durationFormatted: '0 сек', pagesRead: 0, pagesPerHour: 0 };
    }

    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    const durationFormatted = mins > 0 ? `${mins} хв ${secs} сек` : `${secs} сек`;

    const hours = durationSeconds / 3600;
    const pagesPerHour = Number((pagesRead / hours).toFixed(1));

    return {
        durationSeconds,
        durationFormatted,
        pagesRead,
        pagesPerHour
    };
}

// BUSINESS LOGIC: REWARD ENGINE CALCULATOR
function calculateReadingReward(totalPages, rewardPerPage, dailyNorm) {
    const p = Math.max(1, parseInt(totalPages) || 1);
    const r = Math.max(0, parseFloat(rewardPerPage) || 0);
    const d = Math.max(1, parseInt(dailyNorm) || 1);

    const targetDays = Math.ceil(p / d);
    const baseReward = Number((p * r).toFixed(2));
    const bonusAmount = Number((baseReward * 0.5).toFixed(2));
    const finalRewardPoints = Number((baseReward + bonusAmount).toFixed(2));

    return {
        targetDays,
        baseReward,
        bonusAmount,
        finalRewardPoints
    };
}

// INITIALIZATION
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        checkUrlKidLink();
        checkUrlFriendInvite();
        initFirebase();
        renderUI();
    });
} else {
    checkUrlKidLink();
    checkUrlFriendInvite();
    initFirebase();
    renderUI();
}

// ACTIVE CHILD HELPER
function getActiveChild() {
    return state.children.find(c => c.id === state.activeChildId) || state.children[0];
}

function setActiveChild(childId) {
    state.activeChildId = childId;
    renderUI();
}

let isKidOnlyUrlMode = false;

// Check if page was opened via a Child Share Link (?familyId=...&childId=...)
function checkUrlKidLink() {
    const params = new URLSearchParams(window.location.search);
    const familyId = params.get('familyId');
    const childId = params.get('childId');

    if (familyId && childId) {
        currentFamilyId = familyId;
        state.activeChildId = childId;
        state.currentRole = 'kid';
        isKidOnlyUrlMode = true;

        if (typeof firebase !== 'undefined' && firebaseConfig.apiKey !== "YOUR_API_KEY") {
            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
            db = firebase.firestore();
            isFirebaseConfigured = true;

            if (unsubscribeFirestore) unsubscribeFirestore();
            unsubscribeFirestore = db.collection('families').doc(familyId).onSnapshot(
                doc => {
                    if (doc.exists) {
                        const famData = doc.data();
                        state.parentPin = famData.parentPin || '1234';
                        state.children = famData.children || [];
                        state.books = famData.books || [];
                        state.notifications = famData.notifications || [];
                        state.activeChildId = childId;
                        renderUI();
                    } else {
                        console.warn("Родинний документ за цим посиланням не знайдено.");
                    }
                },
                err => {
                    console.error("Помилка доступу за посиланням дитини:", err);
                    if (err.code === 'permission-denied') {
                        alert("⚠️ Помилка доступу до баз даних у Firebase.\n\nОновіть правила безпеки (Rules) у Firestore Console на 'allow read, write: if true;' для колекції families.");
                    }
                }
            );
        }
    }
}

function copyKidShareLink(childId) {
    const familyId = currentFamilyId || 'demo';
    const baseUrl = window.location.href.split('?')[0];
    const kidUrl = `${baseUrl}?familyId=${encodeURIComponent(familyId)}&childId=${encodeURIComponent(childId)}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(kidUrl).then(() => {
            alert(`🔗 Посилання для дитини скопійовано!\n\nНадішліть це посилання дитині у Viber, Telegram або месенджер:\n\n${kidUrl}`);
        }).catch(err => {
            prompt("Скопіюйте посилання для дитини вручну:", kidUrl);
        });
    } else {
        prompt("Скопіюйте посилання для дитини вручну:", kidUrl);
    }
}

function selectChildInParent(childId) {
    state.activeChildId = childId;
    try {
        localStorage.setItem('lastActiveChildId', childId);
    } catch (e) {}
    renderUI();
}

function switchToKidForChild(event, childId) {
    if (event) event.stopPropagation();
    state.activeChildId = childId;
    try {
        localStorage.setItem('lastActiveChildId', childId);
    } catch (e) {}
    switchRole('kid');
}

function updateParentStatsCounters() {
    const elArchived = document.getElementById('archivedBooksCount');
    const elActive = document.getElementById('activeBooksCount');
    const elPending = document.getElementById('pendingApprovalCount');

    if (!elArchived || !elActive || !elPending) return;

    const currentChildId = state.activeChildId;
    
    // String comparison for childId to prevent any type mismatches
    const childBooks = currentChildId 
        ? state.books.filter(b => String(b.childId) === String(currentChildId))
        : state.books;

    const archivedCount = childBooks.filter(b => b.status === 'archived' || b.status === 'completed').length;
    const activeCount = childBooks.filter(b => b.status === 'active' || b.status === 'planned' || b.status === 'reading').length;
    const pendingCount = childBooks.filter(b => b.status === 'quiz_pending').length;

    elArchived.innerText = String(archivedCount);
    elActive.innerText = String(activeCount);
    elPending.innerText = String(pendingCount);
}

function renderParentChildrenList() {
    const list = document.getElementById('parentChildrenList');
    if (!list) return;
    list.innerHTML = '';

    if (state.children.length === 0) {
        list.innerHTML = '<p style="font-size:0.85rem; color:#94a3b8; text-align:center; padding:10px 0;">Поки немає доданих дітей. Натисніть "+ Дитина".</p>';
        updateParentStatsCounters();
        return;
    }

    // Preserve previously selected child if valid
    const savedChildId = localStorage.getItem('lastActiveChildId');
    if (savedChildId && state.children.some(c => String(c.id) === String(savedChildId)) && (!state.activeChildId || !state.children.some(c => String(c.id) === String(state.activeChildId)))) {
        state.activeChildId = savedChildId;
    }

    if (!state.activeChildId && state.children.length > 0) {
        state.activeChildId = state.children[0].id;
    }

    state.children.forEach(child => {
        const card = document.createElement('div');
        const isActive = String(child.id) === String(state.activeChildId);
        card.className = `parent-child-card ${isActive ? 'active' : ''}`;

        card.innerHTML = `
            <div class="parent-child-header" onclick="selectChildInParent('${child.id}')" title="Обрати профайл ${escapeHTML(child.name)} у батьківському режимі">
                <img src="${child.avatarUrl}" alt="${escapeHTML(child.name)}" class="child-avatar">
                <div class="child-info" style="flex: 1;">
                    <h3>${escapeHTML(child.name)} (${child.age || 8} років)</h3>
                    <div class="balance-badge"><i class="fa-solid fa-coins"></i> ${(child.balance || 0).toFixed(2)} балів</div>
                </div>
                <div class="card-icon-actions" style="display: flex; gap: 6px; align-items: center; flex-shrink: 0;">
                    <button type="button" class="copy-link-btn" style="padding: 8px 10px; border-radius: 8px;" onclick="event.stopPropagation(); copyKidShareLink('${child.id}')" title="Скопіювати унікальне посилання для ${escapeHTML(child.name)}" aria-label="Скопіювати посилання для дитини">
                        <i class="fa-solid fa-link"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-success" style="padding: 8px 10px; border-radius: 8px;" onclick="event.stopPropagation(); switchToKidForChild(event, '${child.id}')" title="Перейти у Дитячий режим для ${escapeHTML(child.name)}" aria-label="Перейти у Дитячий режим">
                        <i class="fa-solid fa-arrow-right-to-bracket"></i>
                    </button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });

    updateParentStatsCounters();
}

async function requestDeleteAccount() {
    const confirmDelete = confirm("⚠️ Ви впевнені, що хочете ОСТАТОЧНО видалити акаунт вашої родини та всі дані про дітей, книги і монети?\n\nЦю дію неможливо скасувати!");
    if (!confirmDelete) return;

    if (isFirebaseConfigured && auth && authState.user && currentFamilyId) {
        try {
            await db.collection('families').doc(currentFamilyId).delete();
            await db.collection('users').doc(authState.user.uid).delete();
            await authState.user.delete();
            alert("Ваш родинний акаунт успішно видалено.");
        } catch (err) {
            console.error("Помилка видалення акаунту:", err);
            alert("Помилка видалення: " + err.message);
        }
    } else {
        state.children = [];
        state.books = [];
        state.notifications = [];
        renderUI();
        alert("Дані очищено.");
    }
}

// MAIN UI RENDERER
function renderUI() {
    const authView = document.getElementById('authView');
    const noChildView = document.getElementById('noChildView');
    const kidView = document.getElementById('kidView');
    const parentView = document.getElementById('parentView');
    const authHeaderInfo = document.getElementById('authHeaderInfo');
    const familyBadgeText = document.getElementById('familyBadgeText');
    const firebaseConfigNotice = document.getElementById('firebaseConfigNotice');

    if (firebaseConfigNotice) {
        firebaseConfigNotice.classList.toggle('hidden', isFirebaseConfigured);
    }

    // Check if opened via Kid Share Link URL
    if (isKidOnlyUrlMode) {
        if (authView) authView.classList.remove('active');
        if (authHeaderInfo) authHeaderInfo.classList.add('hidden');

        const btnParent = document.getElementById('btnRoleParent');
        const btnKid = document.getElementById('btnRoleKid');
        if (btnParent) btnParent.classList.remove('hidden');
        if (btnKid) btnKid.classList.add('hidden');

        if (state.children.length === 0) {
            if (noChildView) noChildView.classList.add('active');
            if (kidView) kidView.classList.remove('active');
            if (parentView) parentView.classList.remove('active');
            return;
        }

        const activeChild = getActiveChild();
        if (noChildView) noChildView.classList.remove('active');
        if (parentView) parentView.classList.remove('active');
        if (kidView) kidView.classList.add('active');

        if (activeChild) {
            document.getElementById('kidBalance').innerText = (activeChild.balance || 0).toFixed(2);
            document.getElementById('kidMascotImg').src = activeChild.avatarUrl;
            document.getElementById('kidNicknameDisplay').innerText = activeChild.name;
            document.getElementById('kidStreakCount').innerText = activeChild.streak || 1;

            renderChildrenProfilesBar();
            initChildAchievements(activeChild);
            checkChildAchievementUnlocks(activeChild);
            showKidSubTab(state.activeKidSubTab || 'shelf');
        }
        renderNotifications();
        return;
    }

    // 1. Check if Firebase Auth is active and user is NOT logged in
    if (isFirebaseConfigured && !authState.user) {
        if (authView) authView.classList.add('active');
        if (noChildView) noChildView.classList.remove('active');
        if (kidView) kidView.classList.remove('active');
        if (parentView) parentView.classList.remove('active');
        if (authHeaderInfo) authHeaderInfo.classList.add('hidden');
        return;
    }

    // 2. Logged in (or local demo mode)
    if (authView) authView.classList.remove('active');
    if (authHeaderInfo && authState.familyName) {
        authHeaderInfo.classList.remove('hidden');
        if (familyBadgeText) familyBadgeText.innerText = authState.familyName;
    }

    if (state.children.length === 0) {
        noChildView.classList.add('active');
        kidView.classList.remove('active');
        parentView.classList.remove('active');
        return;
    } else {
        noChildView.classList.remove('active');
    }

    if (!state.activeChildId || !state.children.some(c => c.id === state.activeChildId)) {
        state.activeChildId = state.children[0]?.id || null;
    }

    const activeChild = getActiveChild();

    const btnParent = document.getElementById('btnRoleParent');
    const btnKid = document.getElementById('btnRoleKid');

    if (state.currentRole === 'kid') {
        if (btnParent) btnParent.classList.remove('hidden');
        if (btnKid) btnKid.classList.add('hidden');

        parentView.classList.remove('active');
        kidView.classList.add('active');

        if (activeChild) {
            document.getElementById('kidBalance').innerText = (activeChild.balance || 0).toFixed(2);
            document.getElementById('kidMascotImg').src = activeChild.avatarUrl;
            document.getElementById('kidNicknameDisplay').innerText = activeChild.name;
            document.getElementById('kidStreakCount').innerText = activeChild.streak || 1;

            renderChildrenProfilesBar();
            initChildAchievements(activeChild);
            checkChildAchievementUnlocks(activeChild);
            showKidSubTab(state.activeKidSubTab || 'shelf');
        }
    } else {
        if (btnParent) btnParent.classList.add('hidden');
        if (btnKid) btnKid.classList.remove('hidden');

        kidView.classList.remove('active');
        parentView.classList.add('active');

        renderParentChildrenList();
        renderParentBooks();
        renderParentArchive();
    }

    renderNotifications();
}

// CHILDREN PROFILES SWITCHER BAR
function renderChildrenProfilesBar() {
    const bar = document.getElementById('childrenProfilesBar');
    bar.innerHTML = '';

    state.children.forEach(child => {
        const btn = document.createElement('button');
        btn.className = `child-pill ${child.id === state.activeChildId ? 'active' : ''}`;
        btn.onclick = () => setActiveChild(child.id);
        btn.innerHTML = `
            <img src="${child.avatarUrl}" alt="${escapeHTML(child.name)}" class="child-pill-avatar">
            <span>${escapeHTML(child.name)}</span>
        `;
        bar.appendChild(btn);
    });

    const addBtn = document.createElement('button');
    addBtn.className = 'add-child-pill';
    addBtn.title = 'Додати нового читача';
    addBtn.onclick = () => openAddChildModal();
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    bar.appendChild(addBtn);
}

// BOOKSHELF FILTERS, SORT & VIEW MODE LOGIC
function onShelfFilterChange() {
    state.bookshelf.searchQuery = document.getElementById('shelfSearchInput').value.trim().toLowerCase();
    state.bookshelf.statusFilter = document.getElementById('shelfFilterStatus').value;
    state.bookshelf.sortBy = document.getElementById('shelfSortBy').value;
    renderKidBookshelf();
}

function setBookshelfViewMode(mode) {
    state.bookshelf.viewMode = mode;
    document.getElementById('btnViewGrid').classList.toggle('active', mode === 'grid');
    document.getElementById('btnViewCompact').classList.toggle('active', mode === 'compact');
    document.getElementById('btnViewList').classList.toggle('active', mode === 'list');
    renderKidBookshelf();
}

// SUBTAB 1: BOOKSHELF RENDERER
function renderKidBookshelf() {
    const grid = document.getElementById('kidBookshelfGrid');
    const emptyBanner = document.getElementById('emptyShelfBanner');
    const emptyText = document.getElementById('emptyShelfText');
    if (!grid) return;

    grid.innerHTML = '';

    const searchInput = document.getElementById('shelfSearchInput');
    const statusSelect = document.getElementById('shelfFilterStatus');
    const sortSelect = document.getElementById('shelfSortBy');

    if (searchInput) state.bookshelf.searchQuery = searchInput.value.trim().toLowerCase();
    if (statusSelect) state.bookshelf.statusFilter = statusSelect.value || 'all';
    if (sortSelect) state.bookshelf.sortBy = sortSelect.value || 'progress_desc';

    const currentMode = state.bookshelf.viewMode || 'grid';

    // Apply View Mode CSS class
    grid.className = `bookshelf-grid view-${currentMode}`;

    // Update View Mode Button Highlights
    const btnGrid = document.getElementById('btnViewGrid');
    const btnCompact = document.getElementById('btnViewCompact');
    const btnList = document.getElementById('btnViewList');
    if (btnGrid) btnGrid.classList.toggle('active', currentMode === 'grid');
    if (btnCompact) btnCompact.classList.toggle('active', currentMode === 'compact');
    if (btnList) btnList.classList.toggle('active', currentMode === 'list');

    let childBooks = state.books.filter(b => b.childId === state.activeChildId);

    // 1. Apply Search Query Filter (Title, Author or Synopsis)
    if (state.bookshelf.searchQuery) {
        const q = state.bookshelf.searchQuery;
        childBooks = childBooks.filter(b => 
            (b.title && b.title.toLowerCase().includes(q)) || 
            (b.author && b.author.toLowerCase().includes(q)) ||
            (b.synopsis && b.synopsis.toLowerCase().includes(q))
        );
    }

    // 2. Apply Status Filter
    if (state.bookshelf.statusFilter && state.bookshelf.statusFilter !== 'all') {
        childBooks = childBooks.filter(b => b.status === state.bookshelf.statusFilter);
    }

    // 3. Apply Sorting
    childBooks.sort((a, b) => {
        const pA = Math.min(100, Math.round((a.currentPage / a.totalPages) * 100));
        const pB = Math.min(100, Math.round((b.currentPage / b.totalPages) * 100));

        if (state.bookshelf.sortBy === 'progress_desc') return pB - pA;
        if (state.bookshelf.sortBy === 'progress_asc') return pA - pB;
        if (state.bookshelf.sortBy === 'title_asc') return a.title.localeCompare(b.title);
        return 0;
    });

    if (childBooks.length === 0) {
        if (emptyBanner) emptyBanner.classList.remove('hidden');
        if (emptyText) {
            if (state.bookshelf.searchQuery || (state.bookshelf.statusFilter && state.bookshelf.statusFilter !== 'all')) {
                emptyText.innerText = 'За вашим запитом або фільтром книг не знайдено.';
            } else {
                emptyText.innerText = 'Додай свою першу книжку, щоб розпочати пригоду та отримати свої перші золоті монети!';
            }
        }
        grid.style.display = 'none';
        return;
    } else {
        if (emptyBanner) emptyBanner.classList.add('hidden');
        grid.style.display = (currentMode === 'list') ? 'flex' : 'grid';
    }

    childBooks.forEach(book => {
        const percent = Math.min(100, Math.round((book.currentPage / book.totalPages) * 100));
        const card = document.createElement('div');
        card.className = 'shelf-book-card';
        card.onclick = () => selectBookForReading(book.id);

        let actionTagHtml = '';
        if (book.status === 'planned') {
            actionTagHtml = `
                <span class="shelf-action-tag" style="background: rgba(251, 191, 36, 0.2); color: var(--gold);"><i class="fa-solid fa-clock"></i> Заплановано</span>
                <button class="btn btn-sm btn-success full-width margin-top" onclick="event.stopPropagation(); startReadingBook('${book.id}')">
                    <i class="fa-solid fa-rocket"></i> Розпочинаю читати!
                </button>
            `;
        } else if (book.status === 'active') {
            actionTagHtml = `<span class="shelf-action-tag reading"><i class="fa-solid fa-book-open"></i> Читаю (${percent}%)</span>`;
        } else if (book.status === 'quiz_pending') {
            actionTagHtml = `<span class="shelf-action-tag quiz"><i class="fa-solid fa-trophy"></i> Пройди квіз!</span>`;
        } else {
            actionTagHtml = `<span class="shelf-action-tag done"><i class="fa-solid fa-circle-check"></i> Прочитано</span>`;
        }

        const coverImg = book.coverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80';

        card.innerHTML = `
            <div class="shelf-cover-wrapper">
                <img src="${coverImg}" alt="${escapeHTML(book.title)}" class="shelf-cover-img">
                <div class="shelf-progress-ribbon">
                    <div class="ribbon-info">
                        <span>Прогрес:</span>
                        <span>${percent}%</span>
                    </div>
                    <div class="progress-bar-bg" style="height: 6px;">
                        <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                    </div>
                </div>
            </div>
            <div class="shelf-info">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <div>
                        <h3 class="shelf-title">${escapeHTML(book.title)}</h3>
                        <p class="shelf-author">${escapeHTML(book.author)}</p>
                    </div>
                    <button class="btn btn-sm btn-outline text-danger" style="padding: 3px 6px; font-size: 0.75rem;" onclick="event.stopPropagation(); deleteBook('${book.id}')" title="Видалити книгу з полиці">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                ${actionTagHtml}
            </div>
        `;

        grid.appendChild(card);
    });
}

function selectBookForReading(bookId) {
    const book = state.books.find(b => b.id === bookId);
    if (!book) return;

    showKidSubTab('reading');
    renderKidActiveReading(book);
}

// SUBTAB 2: READING NOW RENDERER
function renderKidActiveReading(targetBook = null) {
    const childBooks = state.books.filter(b => b.childId === state.activeChildId);
    const activeBook = targetBook || childBooks.find(b => b.status === 'active' || b.status === 'quiz_pending' || b.status === 'planned') || childBooks[0];
    
    if (!activeBook) return;

    state.activeReadingBookId = activeBook.id;

    document.getElementById('kidBookTitle').innerText = activeBook.title;
    document.getElementById('kidBookAuthor').innerText = activeBook.author;
    document.getElementById('kidBookSynopsis').innerText = activeBook.synopsis || 'Опис книги відсутній.';
    document.getElementById('kidCurrentPage').innerText = activeBook.currentPage;
    document.getElementById('kidTotalPages').innerText = activeBook.totalPages;
    
    if (activeBook.coverUrl) {
        document.getElementById('kidBookCover').src = activeBook.coverUrl;
    }

    const rewardCalc = calculateReadingReward(activeBook.totalPages, activeBook.rewardPerPage, activeBook.dailyNorm);
    document.getElementById('kidBonusRewardVal').innerText = rewardCalc.finalRewardPoints;
    document.getElementById('kidBaseRewardVal').innerText = rewardCalc.baseReward;

    if (activeBook.status === 'planned') {
        document.getElementById('kidDaysLeft').innerText = `${activeBook.targetDays} (не активовано)`;
    } else {
        document.getElementById('kidDaysLeft').innerText = Math.max(1, activeBook.targetDays - 1);
    }

    const percent = Math.min(100, Math.round((activeBook.currentPage / activeBook.totalPages) * 100));
    document.getElementById('kidProgressPercent').innerText = `${percent}%`;
    document.getElementById('kidProgressBar').style.width = `${percent}%`;

    const isFinished = activeBook.currentPage >= activeBook.totalPages;
    const isPlanned = activeBook.status === 'planned';

    const dailyLoggerBox = document.getElementById('dailyLoggerBox');
    const quizBanner = document.getElementById('kidQuizActionBanner');

    const remainingPages = Math.max(0, activeBook.totalPages - activeBook.currentPage);
    const pageSlider = document.getElementById('pageSlider');
    const pageInputManual = document.getElementById('pageInputManual');

    if (pageSlider && pageInputManual) {
        pageSlider.max = Math.max(1, remainingPages);
        pageInputManual.max = remainingPages;
        const defaultLogged = Math.min(activeBook.dailyNorm || 20, remainingPages);
        pageSlider.value = defaultLogged;
        pageInputManual.value = defaultLogged;
    }

    // Toggle planned start banner vs daily logger vs quiz
    let plannedBanner = document.getElementById('plannedBookStartBanner');
    if (!plannedBanner) {
        plannedBanner = document.createElement('div');
        plannedBanner.id = 'plannedBookStartBanner';
        plannedBanner.className = 'margin-top';
        const container = document.querySelector('#kidSubTabReading .card');
        if (container) container.insertBefore(plannedBanner, dailyLoggerBox);
    }

    if (isPlanned) {
        plannedBanner.style.display = 'block';
        plannedBanner.innerHTML = `
            <div style="background: rgba(16, 185, 129, 0.15); border: 2px dashed var(--emerald); padding: 18px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
                <h3 style="color: var(--emerald); font-family: var(--font-heading); margin-bottom: 6px;"><i class="fa-solid fa-hourglass-start"></i> Книга чекає на початок читання!</h3>
                <p style="color: #cbd5e1; font-size: 0.9rem; margin-bottom: 14px;">Натисніть кнопку нижче, коли будете готові відкрити першу сторінку. Відлік днів та бонуси розпочнуться саме з цього моменту!</p>
                <button class="btn btn-success btn-lg pulse" onclick="startReadingBook('${activeBook.id}')">
                    <i class="fa-solid fa-rocket"></i> 🚀 РОЗПОЧИНАЮ ЧИТАТИ ЗАРАЗ!
                </button>
            </div>
        `;
        if (dailyLoggerBox) dailyLoggerBox.style.display = 'none';
        if (quizBanner) quizBanner.classList.add('hidden');
    } else {
        plannedBanner.style.display = 'none';
        if (dailyLoggerBox) dailyLoggerBox.style.display = isFinished ? 'none' : 'block';
        if (quizBanner) quizBanner.classList.toggle('hidden', !isFinished);
    }
}

function renderKidArchive() {
    const grid = document.getElementById('kidArchiveGrid');
    grid.innerHTML = '';

    const archivedBooks = state.books.filter(b => b.childId === state.activeChildId && (b.status === 'archived' || b.status === 'completed'));

    if (archivedBooks.length === 0) {
        grid.innerHTML = '<p style="color: #94a3b8;">Твій архів поки порожній. Прочитай першу книгу!</p>';
        return;
    }

    archivedBooks.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <div class="book-card-header">
                <div>
                    <h3 class="book-title">${escapeHTML(book.title)}</h3>
                    <p class="book-author">${escapeHTML(book.author)}</p>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span class="tag-archive-corner">Прочитано ✅</span>
                    <button class="btn btn-sm btn-outline text-danger" style="padding: 2px 6px;" onclick="deleteBook('${book.id}')" title="Видалити книгу з архіву">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="book-card-body">
                <p class="book-synopsis-card">${escapeHTML(book.synopsis)}</p>
                <div class="divider"></div>
                <div class="meta-row"><span>Період читання:</span> <strong>${escapeHTML(book.startedAt || 'Не вказано')} — ${escapeHTML(book.completedAt)}</strong></div>
                <div class="meta-row"><span>Здобуто балів:</span> <strong class="text-success">+${book.earnedPoints} монет</strong></div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// PARENT VIEW RENDERERS
function renderParentBooks() {
    const grid = document.getElementById('parentBooksGrid');
    grid.innerHTML = '';

    const activeBooks = state.books.filter(b => b.childId === state.activeChildId && (b.status === 'active' || b.status === 'quiz_pending' || b.status === 'planned'));
    const pendingBook = state.books.find(b => b.childId === state.activeChildId && b.status === 'quiz_pending');

    const approvalBanner = document.getElementById('approvalBanner');
    if (pendingBook) {
        const rewardCalc = calculateReadingReward(pendingBook.totalPages, pendingBook.rewardPerPage, pendingBook.dailyNorm);
        document.getElementById('approvalBannerTitle').innerText = `${getActiveChild().name} пройшла Quiz для книги "${pendingBook.title}" (Score: 100%)!`;
        document.getElementById('approvalBannerRewardText').innerHTML = `Розрахована винагорода: <strong>${rewardCalc.baseReward} балів + ${rewardCalc.bonusAmount} бонус (Разом: ${rewardCalc.finalRewardPoints} балів)</strong>`;
        approvalBanner.style.display = 'flex';
    } else {
        approvalBanner.style.display = 'none';
    }

    updateParentStatsCounters();

    if (activeBooks.length === 0) {
        grid.innerHTML = '<p class="text-parent-muted">Немає активних або запланованих книжок. Натисніть "+ Додати нову книгу".</p>';
        return;
    }

    activeBooks.forEach(book => {
        const rewardCalc = calculateReadingReward(book.totalPages, book.rewardPerPage, book.dailyNorm);
        const card = document.createElement('div');
        card.className = 'book-card';

        let statusText = 'Читається';
        let statusTagClass = 'tag-active';
        if (book.status === 'planned') {
            statusText = '⏳ Заплановано';
            statusTagClass = 'tag-warning';
        } else if (book.status === 'quiz_pending') {
            statusText = '🏆 Очікує підтвердження';
            statusTagClass = 'tag-success';
        }

        let startButtonHtml = '';
        if (book.status === 'planned') {
            startButtonHtml = `
                <button class="btn btn-sm btn-success full-width margin-top" onclick="startReadingBook('${book.id}')">
                    <i class="fa-solid fa-rocket"></i> Розпочати читання для дитини
                </button>
            `;
        }

        card.innerHTML = `
            <div class="book-card-header">
                <div>
                    <h3 class="book-title">${escapeHTML(book.title)}</h3>
                    <p class="book-author">${escapeHTML(book.author)}</p>
                    <p class="book-synopsis-card">${escapeHTML(book.synopsis)}</p>
                </div>
                <div style="display: flex; gap: 8px; align-items: center; flex-direction: column;">
                    <span class="tag ${statusTagClass}">
                        ${statusText}
                    </span>
                    <button class="btn btn-sm btn-outline text-danger" style="padding: 3px 6px;" onclick="deleteBook('${book.id}')" title="Видалити книгу">
                        <i class="fa-solid fa-trash"></i> Видалити
                    </button>
                </div>
            </div>
            <div class="book-card-body">
                <div class="meta-row"><span>Сторінок (P):</span> <strong>${book.totalPages} стор. (початок з ${book.startPage || 1} стор.)</strong></div>
                <div class="meta-row"><span>Ціна/стор (R):</span> <strong>${book.rewardPerPage} грн/бал</strong></div>
                <div class="meta-row"><span>Норма (D):</span> <strong>${book.dailyNorm} стор/день</strong></div>
                <div class="meta-row"><span>Базова нагорода:</span> <strong>${rewardCalc.baseReward} балів</strong></div>
                <div class="meta-row text-success"><span>Макс. Нагорода (+50%):</span> <strong>${rewardCalc.finalRewardPoints} балів</strong></div>
                ${startButtonHtml}
            </div>
        `;
        grid.appendChild(card);
    });
}

function renderParentArchive() {
    const grid = document.getElementById('parentArchiveGrid');
    grid.innerHTML = '';

    const archivedBooks = state.books.filter(b => b.childId === state.activeChildId && (b.status === 'archived' || b.status === 'completed'));

    if (archivedBooks.length === 0) {
        grid.innerHTML = '<p class="text-parent-muted">Архів порожній.</p>';
        return;
    }

    archivedBooks.forEach(book => {
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <div class="book-card-header">
                <div>
                    <h3 class="book-title">${escapeHTML(book.title)}</h3>
                    <p class="book-author">${escapeHTML(book.author)}</p>
                </div>
                <span class="tag-archive-corner">Прочитано ✅</span>
            </div>
            <div class="book-card-body">
                <div class="meta-row"><span>Дата початку:</span> <strong>${escapeHTML(book.startedAt)}</strong></div>
                <div class="meta-row"><span>Дата фінішу:</span> <strong>${escapeHTML(book.completedAt)}</strong></div>
                <div class="meta-row"><span>Здобуто балів:</span> <strong class="text-success">+${book.earnedPoints} балів</strong></div>
                <div class="meta-row"><span>Швидкість читання:</span> <strong>${book.avgSpeedPagesPerHour} стор/год</strong></div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// KID SUBTAB ROUTING & FRIENDS LEADERBOARD
function showKidSubTab(tab) {
    state.activeKidSubTab = tab;

    const btnShelf = document.getElementById('tabBtnShelf');
    const btnReading = document.getElementById('tabBtnReading');
    const btnTimer = document.getElementById('tabBtnTimer');
    const btnArchive = document.getElementById('tabBtnArchive');
    const btnFriends = document.getElementById('tabBtnFriends');

    if (btnShelf) btnShelf.classList.toggle('active', tab === 'shelf');
    if (btnReading) btnReading.classList.toggle('active', tab === 'reading');
    if (btnTimer) btnTimer.classList.toggle('active', tab === 'timer');
    if (btnArchive) btnArchive.classList.toggle('active', tab === 'archive');
    if (btnFriends) btnFriends.classList.toggle('active', tab === 'friends');

    const secShelf = document.getElementById('kidSubTabShelf');
    const secReading = document.getElementById('kidSubTabReading');
    const secTimer = document.getElementById('kidSubTabTimer');
    const secArchive = document.getElementById('kidSubTabArchive');
    const secFriends = document.getElementById('kidSubTabFriends');

    if (secShelf) { secShelf.classList.toggle('active', tab === 'shelf'); secShelf.classList.toggle('hidden', tab !== 'shelf'); }
    if (secReading) { secReading.classList.toggle('active', tab === 'reading'); secReading.classList.toggle('hidden', tab !== 'reading'); }
    if (secTimer) { secTimer.classList.toggle('active', tab === 'timer'); secTimer.classList.toggle('hidden', tab !== 'timer'); }
    if (secArchive) { secArchive.classList.toggle('active', tab === 'archive'); secArchive.classList.toggle('hidden', tab !== 'archive'); }
    if (secFriends) { secFriends.classList.toggle('active', tab === 'friends'); secFriends.classList.toggle('hidden', tab !== 'friends'); }

    if (tab === 'shelf') renderKidBookshelf();
    if (tab === 'reading') renderKidActiveReading();
    if (tab === 'archive') renderKidArchive();
    if (tab === 'friends') renderFriendsLeaderboard();
}

function copyMyFriendInviteLink() {
    const activeChild = getActiveChild();
    if (!activeChild) {
        alert("Спочатку оберіть профіль дитини.");
        return;
    }

    const friendCode = `${currentFamilyId || 'demo'}_${activeChild.id}`;
    const baseUrl = window.location.href.split('?')[0];
    const inviteUrl = `${baseUrl}?addFriend=${encodeURIComponent(friendCode)}&friendName=${encodeURIComponent(activeChild.name)}&avatarSeed=${encodeURIComponent(activeChild.avatarSeed || 'Sofia')}`;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(inviteUrl).then(() => {
            alert(`🚀 Запрошення для друга скопійовано!\n\nНадішліть це посилання другу у Viber чи Telegram:\n\n${inviteUrl}`);
        }).catch(() => {
            prompt("Скопіюйте посилання для друга вручну:", inviteUrl);
        });
    } else {
        prompt("Скопіюйте посилання для друга вручну:", inviteUrl);
    }
}

async function checkUrlFriendInvite() {
    const params = new URLSearchParams(window.location.search);
    const friendCode = params.get('addFriend');
    const friendName = params.get('friendName') || 'Друг-Читач';
    const avatarSeed = params.get('avatarSeed') || 'Sofia';

    if (friendCode) {
        const activeChild = getActiveChild();
        if (!activeChild) return;

        if (!activeChild.friends) activeChild.friends = [];

        // Avoid adding self or duplicate friend
        const existing = activeChild.friends.find(f => f.code === friendCode);
        if (!existing) {
            const addConfirm = confirm(`🎉 Твій друг ${friendName} запрошує тебе змагатися у читанні!\n\nДодати ${friendName} до твого списку друзів-читачів?`);
            if (addConfirm) {
                activeChild.friends.push({
                    code: friendCode,
                    name: friendName,
                    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}`,
                    streak: Math.floor(Math.random() * 5) + 3,
                    balance: Math.floor(Math.random() * 200) + 150,
                    booksCount: Math.floor(Math.random() * 4) + 1
                });

                saveStateToFirestore();
                alert(`Ура! ${friendName} тепер у твоєму списку друзів! 🚀`);
                showKidSubTab('friends');
            }
        }
    }
}

function renderFriendsLeaderboard() {
    const grid = document.getElementById('friendsListGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const activeChild = getActiveChild();
    if (!activeChild) return;

    if (!activeChild.friends) activeChild.friends = [];

    // Calculate completed books for active child
    const myArchivedCount = state.books.filter(b => b.childId === activeChild.id && (b.status === 'archived' || b.status === 'completed')).length;

    // Combine me + friends for ranking
    const participants = [
        {
            isMe: true,
            name: `${activeChild.name} (Я)`,
            avatarUrl: activeChild.avatarUrl,
            streak: activeChild.streak || 1,
            balance: activeChild.balance || 0,
            booksCount: myArchivedCount
        },
        ...activeChild.friends.map(f => ({
            isMe: false,
            name: f.name,
            avatarUrl: f.avatarUrl,
            streak: f.streak || 3,
            balance: f.balance || 100,
            booksCount: f.booksCount || 1
        }))
    ];

    // Sort by streak desc, then by balance desc
    participants.sort((a, b) => (b.streak - a.streak) || (b.balance - a.balance));

    participants.forEach((p, idx) => {
        const rank = idx + 1;
        const card = document.createElement('div');
        card.className = `friend-card ${p.isMe ? 'my-card' : ''}`;

        let rankBadgeClass = `friend-rank-badge rank-${rank}`;
        let rankText = `#${rank}`;
        if (rank === 1) rankText = '🥇';
        if (rank === 2) rankText = '🥈';
        if (rank === 3) rankText = '🥉';

        card.innerHTML = `
            <div class="${rankBadgeClass}">${rankText}</div>
            <img src="${p.avatarUrl}" alt="${escapeHTML(p.name)}" class="friend-avatar-img">
            <div class="friend-info">
                <div class="friend-name">${escapeHTML(p.name)}</div>
                <div class="friend-stats-pills">
                    <span class="stat-pill streak"><i class="fa-solid fa-fire"></i> ${p.streak} Днів стріку</span>
                    <span class="stat-pill books"><i class="fa-solid fa-book"></i> ${p.booksCount} Книг</span>
                    <span class="stat-pill coins"><i class="fa-solid fa-coins"></i> ${p.balance.toFixed(0)} Монет</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// PARENT PIN SECURITY LOGIC
function requestParentAccess() {
    document.getElementById('parentPinModal').classList.add('active');
    document.getElementById('pin1').focus();
}

function closePinModal() {
    document.getElementById('parentPinModal').classList.remove('active');
    document.getElementById('pinError').classList.add('hidden');
    clearPinInputs();
}

function clearPinInputs() {
    ['pin1', 'pin2', 'pin3', 'pin4'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function handlePinKey(event, step) {
    if (event.key === 'Backspace' && !event.target.value && step > 1) {
        document.getElementById(`pin${step - 1}`).focus();
    }
}

function movePinFocus(step) {
    const currentInput = document.getElementById(`pin${step}`);
    if (step < 4 && currentInput.value) {
        document.getElementById(`pin${step + 1}`).focus();
    } else if (step === 4 && currentInput.value) {
        verifyParentPin();
    }
}

function verifyParentPin() {
    const pin = ['pin1', 'pin2', 'pin3', 'pin4'].map(id => document.getElementById(id).value).join('');
    if (pin === state.parentPin) {
        closePinModal();
        switchRole('parent');
    } else {
        document.getElementById('pinError').classList.remove('hidden');
        clearPinInputs();
        document.getElementById('pin1').focus();
    }
}

function switchRole(role) {
    if (role === 'parent') {
        isKidOnlyUrlMode = false;
    }
    state.currentRole = role;

    const btnParent = document.getElementById('btnRoleParent');
    const btnKid = document.getElementById('btnRoleKid');
    if (btnParent) btnParent.classList.toggle('hidden', role === 'parent');
    if (btnKid) btnKid.classList.toggle('hidden', role === 'kid');

    renderUI();
}

// TIMER LOGIC
function startReadingTimer() {
    if (state.timer.isRunning) return;
    state.timer.isRunning = true;

    document.getElementById('btnStartTimer').classList.add('hidden');
    document.getElementById('btnPauseTimer').classList.remove('hidden');
    document.getElementById('btnStopTimer').classList.remove('hidden');

    state.timer.intervalId = setInterval(() => {
        state.timer.secondsElapsed++;
        updateTimerDisplay();
    }, 1000);
}

function pauseReadingTimer() {
    state.timer.isRunning = false;
    if (state.timer.intervalId) {
        clearInterval(state.timer.intervalId);
        state.timer.intervalId = null;
    }

    document.getElementById('btnStartTimer').classList.remove('hidden');
    document.getElementById('btnPauseTimer').classList.add('hidden');
}

function requestResetTimer() {
    if (state.timer.secondsElapsed <= 0) return;
    pauseReadingTimer();
    document.getElementById('resetTimerConfirmModal').classList.add('active');
}

function closeResetTimerModal() {
    document.getElementById('resetTimerConfirmModal').classList.remove('active');
}

function confirmResetTimer() {
    closeResetTimerModal();
    state.timer.secondsElapsed = 0;
    updateTimerDisplay();
    document.getElementById('btnStartTimer').classList.remove('hidden');
    document.getElementById('btnPauseTimer').classList.add('hidden');
    document.getElementById('btnStopTimer').classList.add('hidden');
    document.getElementById('btnResetTimer').classList.add('hidden');
    document.getElementById('timerSpeedMetrics').classList.add('hidden');
}

function updateTimerDisplay() {
    const hrs = Math.floor(state.timer.secondsElapsed / 3600);
    const mins = Math.floor((state.timer.secondsElapsed % 3600) / 60);
    const secs = state.timer.secondsElapsed % 60;

    const pad = (n) => String(n).padStart(2, '0');
    document.getElementById('timerClock').innerText = `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;

    // Reset button only visible if timer > 0
    const btnReset = document.getElementById('btnResetTimer');
    if (btnReset) {
        btnReset.classList.toggle('hidden', state.timer.secondsElapsed <= 0);
    }
}

function openFinishSessionModal() {
    pauseReadingTimer();
    const durationMins = Math.floor(state.timer.secondsElapsed / 60);
    const durationSecs = state.timer.secondsElapsed % 60;
    const formatted = durationMins > 0 ? `${durationMins} хв ${durationSecs} сек` : `${durationSecs} сек`;
    
    document.getElementById('modalSessionDuration').innerText = formatted;
    document.getElementById('finishSessionModal').classList.add('active');
}

function closeFinishSessionModal() {
    document.getElementById('finishSessionModal').classList.remove('active');
}

function confirmFinishSession() {
    const pagesRead = Math.max(1, parseInt(document.getElementById('sessionPagesInput').value) || 1);
    const durationSecs = Math.max(1, state.timer.secondsElapsed);

    const speedCalc = calculateSessionSpeed(durationSecs, pagesRead);
    
    const activeBook = state.books.find(b => b.childId === state.activeChildId && b.status === 'active');
    if (activeBook) {
        activeBook.currentPage = Math.min(activeBook.totalPages, activeBook.currentPage + pagesRead);
        activeBook.avgSpeedPagesPerHour = speedCalc.pagesPerHour;
        if (activeBook.currentPage >= activeBook.totalPages) {
            activeBook.status = 'quiz_pending';
        }
    }

    state.timer.secondsElapsed = 0;
    updateTimerDisplay();
    closeFinishSessionModal();

    document.getElementById('metricDuration').innerText = speedCalc.durationFormatted;
    document.getElementById('metricPages').innerText = `${pagesRead} стор.`;
    document.getElementById('metricSpeed').innerText = `${speedCalc.pagesPerHour} стор/год`;
    document.getElementById('timerSpeedMetrics').classList.remove('hidden');

    renderUI();
    showKidSubTab('reading');
    alert(`Сесію збережено! Твоя швидкість читання: ${speedCalc.pagesPerHour} сторінок на годину! 🚀`);
}

// NEW CHILD CREATION MODAL
function openAddChildModal() {
    document.getElementById('newChildNameInput').value = '';
    document.getElementById('newChildAgeInput').value = '8';
    state.newChildAvatarSeed = 'Polina';
    document.getElementById('addChildModal').classList.add('active');
    document.getElementById('newChildNameInput').focus();
}

function closeAddChildModal() {
    document.getElementById('addChildModal').classList.remove('active');
}

function selectNewChildAvatar(el, seed) {
    document.querySelectorAll('#addChildModal .avatar-option').forEach(a => a.classList.remove('selected'));
    el.classList.add('selected');
    state.newChildAvatarSeed = seed;
}

function saveNewChildProfile() {
    const name = document.getElementById('newChildNameInput').value.trim();
    const age = parseInt(document.getElementById('newChildAgeInput').value) || 8;

    if (!name) {
        alert('Будь ласка, введіть ім\'я дитини.');
        return;
    }

    const newChildId = 'c' + Date.now();
    const newChild = {
        id: newChildId,
        name: name,
        nickname: name,
        age: age,
        avatarSeed: state.newChildAvatarSeed,
        avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${state.newChildAvatarSeed}`,
        balance: 0.00,
        streak: 1,
        achievements: {}
    };

    state.children.push(newChild);
    state.activeChildId = newChildId;
    closeAddChildModal();
    renderUI();
    saveStateToFirestore();
    alert(`Вітаємо, ${name}! Твій новий профіль створено. Час додати першу книжку! 🎉`);
}

// PROFILE EDITING
function openEditProfileModal() {
    const activeChild = getActiveChild();
    document.getElementById('nicknameInput').value = activeChild.name;
    document.getElementById('editProfileModal').classList.add('active');
}

function closeEditProfileModal() {
    document.getElementById('editProfileModal').classList.remove('active');
}

function selectAvatar(el, seed) {
    document.querySelectorAll('#editProfileModal .avatar-option').forEach(a => a.classList.remove('selected'));
    el.classList.add('selected');
    const activeChild = getActiveChild();
    activeChild.avatarSeed = seed;
}

function saveProfileChanges() {
    const activeChild = getActiveChild();
    const newName = document.getElementById('nicknameInput').value.trim();
    if (newName) {
        activeChild.name = newName;
        activeChild.nickname = newName;
    }
    activeChild.avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${activeChild.avatarSeed}`;
    closeEditProfileModal();
    renderUI();
    saveStateToFirestore();
    alert(`Профіль успішно оновлено! Вітаємо, ${activeChild.name}! 🎉`);
}

// NOTIFICATIONS
function toggleNotificationsModal() {
    const modal = document.getElementById('notificationsModal');
    modal.classList.toggle('active');
    if (modal.classList.contains('active')) {
        state.notifications.forEach(n => n.unread = false);
        renderNotifications();
    }
}

function renderNotifications() {
    const list = document.getElementById('notifList');
    list.innerHTML = '';

    const unreadCount = state.notifications.filter(n => n.unread).length;
    const badge = document.getElementById('notifBadge');
    badge.innerText = unreadCount;
    badge.style.display = unreadCount > 0 ? 'flex' : 'none';

    if (state.notifications.length === 0) {
        list.innerHTML = '<p style="color: #94a3b8;">Немає сповіщень.</p>';
        return;
    }

    state.notifications.forEach(n => {
        const item = document.createElement('div');
        item.className = `notif-item ${n.unread ? 'unread' : ''}`;
        item.innerHTML = `
            <i class="fa-solid ${escapeHTML(n.icon)} notif-icon" aria-hidden="true"></i>
            <div>
                <h4>${escapeHTML(n.title)}</h4>
                <p>${escapeHTML(n.message)}</p>
                <div class="notif-time">${escapeHTML(n.time)}</div>
            </div>
        `;
        list.appendChild(item);
    });
}

// ADD BOOK MODAL & GOOGLE BOOKS API SEARCH
function openAddBookModal() {
    document.getElementById('addBookModal').classList.add('active');
    document.getElementById('searchResultsBox').classList.add('hidden');
    recalculateParentTier();
}

function closeAddBookModal() {
    document.getElementById('addBookModal').classList.remove('active');
}

function recalculateParentTier() {
    const P = parseInt(document.getElementById('totalPagesInput').value) || 0;
    const R = parseFloat(document.getElementById('rewardPerPageInput').value) || 0;
    const D = parseInt(document.getElementById('dailyNormInput').value) || 1;

    const rewardCalc = calculateReadingReward(P, R, D);

    const pagesDisp = document.getElementById('calcTotalPagesDisplay');
    if (pagesDisp) {
        pagesDisp.innerText = P;
    }

    document.getElementById('calcTargetDays').innerText = rewardCalc.targetDays;
    document.getElementById('calcBaseReward').innerText = rewardCalc.baseReward;
    document.getElementById('calcBonusReward').innerText = rewardCalc.bonusAmount;
    document.getElementById('calcPenaltyReward').innerText = rewardCalc.bonusAmount;
}

function openStoreSearch(store) {
    const queryInput = document.getElementById('searchQuery');
    const query = queryInput ? queryInput.value.trim() : '';
    if (!query) {
        alert('Будь ласка, спочатку введіть назву книги або автора у полі пошуку вище.');
        return;
    }

    const encoded = encodeURIComponent(query);
    const storeUrls = {
        yakaboo: `https://www.yakaboo.ua/ua/catalogsearch/result/?q=${encoded}`,
        ye: `https://book-ye.com.ua/search/?q=${encoded}`,
        vivat: `https://vivat.com.ua/search/?q=${encoded}`,
        readeat: `https://readeat.com/search?q=${encoded}`,
        starylev: `https://starylev.com.ua/search?query=${encoded}`,
        ksd: `https://bookclub.ua/search/search_list.html?text=${encoded}`,
        knigoland: `https://knigoland.com.ua/search?q=${encoded}`,
        bukva: `https://bukva.ua/ua/search/index?q=${encoded}`,
        nashformat: `https://nashformat.ua/search?q=${encoded}`,
        ababahalamaha: `https://store.ababahalamaha.com.ua/index.php?route=product/search&search=${encoded}`,
        bookchef: `https://bookchef.ua/search/?q=${encoded}`,
        kmbooks: `https://kmbooks.com.ua/catalog?search=${encoded}`,
        knigolove: `https://knigolove.ua/search?q=${encoded}`,
        fabula: `https://fabulabook.com/?s=${encoded}`,
        ridnamova: `https://ridna-mova.com/catalogsearch/result/?q=${encoded}`,
        bohdan: `https://bohdan-books.com/search/?q=${encoded}`,
        astrolabium: `https://astrolabium.com.ua/search?q=${encoded}`,
        ranok: `https://www.ranok.com.ua/search.html?q=${encoded}`,
        bookua: `https://book.ua/search?q=${encoded}`,
        bookopt: `https://bookopt.com.ua/catalogsearch/result/?q=${encoded}`
    };

    const url = storeUrls[store];

    if (url) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// LOCAL CURATED UKRAINIAN CHILDREN'S & YA BESTSELLERS CATALOG (INSTANT & PRECISE)
const LOCAL_BOOK_CATALOG = [
    {
        title: 'Я бачу, вас цікавить пітьма',
        author: 'Ілларіон Павлюк',
        pages: 664,
        synopsis: 'Містичний психологічний детективний трилер про київського кримінального психолога Вадима Чорного, який прибуває у зникле в часі селище Бучач для розслідування загадкового зникнення маленької дівчинки.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Танець недоумка',
        author: 'Ілларіон Павлюк',
        pages: 680,
        synopsis: 'Захопливий психологічний космічний детектив про біолога Гіля, який погоджується на ризиковану наукову експедицію на далеку планету Іш-Чель.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Білий попіл',
        author: 'Ілларіон Павлюк',
        pages: 352,
        synopsis: 'Атмосферний трилер у стилі тривожного детективу, дія якого розгортається на хуторі серед засніжених українських степів XIX століття.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Колонія. Нові темні віки',
        author: 'Макс Кідрук',
        pages: 904,
        synopsis: 'Масштабний науково-фантастичний роман про життя людства у XXII столітті на Марсі та Землі у часи космічних конфліктів.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Бот',
        author: 'Макс Кідрук',
        pages: 480,
        synopsis: 'Технотрилер про київського програміста Тимура, який потрапляє у секретну лабораторію в пустелі Атакама.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Твердиня',
        author: 'Макс Кідрук',
        pages: 592,
        synopsis: 'Пригодницький трилер про розшук затеряної фортеці інків у джунглях Перу.',
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Зазираючи у морок',
        author: 'Макс Кідрук',
        pages: 380,
        synopsis: 'Захопливий психологічний трилер Макса Кідрука про таємниці людського підсвідомого.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Краще ніж у фільмах',
        author: 'Лінн Пейнтер',
        pages: 384,
        synopsis: 'Неймовірна підліткова та молодіжна романтична комедія про Ліз Баксбаум, її мрії про ідеальне кохання як у фільмах та стосунки із сусідським хлопцем Уесом. Видавництво Vivat.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Гіпотеза кохання',
        author: 'Алі Гейзелвуд',
        pages: 384,
        synopsis: 'Бестселер про аспірантку Олівію, яка фіктивно починає зустрічатися з молодим і суворим професором Адамом Карлсеном. Видавництво Vivat.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Двір шипів і троянд',
        author: 'Сара Дж. Маас',
        pages: 480,
        synopsis: 'Захопливе фентезі про 19-річну мисливицю Фейру, яка потрапляє до чарівного та небезпечного краю фейрі Прифіанії. Видавництво Vivat.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Жорстокий принц',
        author: 'Голлі Блек',
        pages: 416,
        synopsis: 'Смертна дівчина Джуд протистоїть підступним та прекрасним фейрі в Ельфгеймі, щоб завоювати своє місце при королівському дворі. Видавництво Vivat.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Шістка круків',
        author: 'Лі Бардуґо',
        pages: 540,
        synopsis: 'Шість відчайдушних вигнанців і злочинців на чолі з Казом Бреккером вирушають у дерзке та смертельно небезпечне пограбування. Видавництво Vivat.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Тореадори з Васюківки',
        author: 'Всеволод Нестайко',
        pages: 540,
        synopsis: 'Неймовірні пригоди Яви Реня та Павлуші Завгороднього — класика української дитячої літератури про справжню дружбу, метро під свинарником та побудову власної кориди у село Васюківка!',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Гаррі Поттер і філософський камінь',
        author: 'Дж. К. Роулінг',
        pages: 320,
        synopsis: 'Історія про 11-річного сироту Гаррі Поттера, який дізнається, що він чарівник, і починає навчання у школі чаклунства Гоґвортс. Переклад Івана Малковича (А-БА-БА-ГА-ЛА-МА-ГА).',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Гаррі Поттер і таємна кімната',
        author: 'Дж. К. Роулінг',
        pages: 352,
        synopsis: 'Другий рік навчання Гаррі у Гоґвортсі. Загадкова Таємна Кімната відкривається, і стіни закладу загрожують усім чарівникам!',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Гаррі Поттер і в’язень Азкабану',
        author: 'Дж. К. Роулінг',
        pages: 384,
        synopsis: 'Третій рік навчання. Сиріус Блек тікає з найсуворішої в’язниці Азкабан, і страшні дементори оточують школу.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Гаррі Поттер і Келих вогню',
        author: 'Дж. К. Роулінг',
        pages: 670,
        synopsis: 'Гаррі бере участь у стародавньому Тричаклунському турнірі, де на нього чекають страшні випробування та повернення Темного Лорда.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Маленький принц',
        author: 'Антуан де Сент-Екзюпері',
        pages: 120,
        synopsis: 'Всесвітньо відома казка-притча про хлопчика з астероїда Б-612, який подорожує планетами і вчить нас бачити серцем.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Джури козака Швайки',
        author: 'Володимир Рутківський',
        pages: 430,
        synopsis: 'Перший роман славетної трилогії про юних Грицика і Санька та вивідника Швайку в часи становлення козацтва в Україні.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Джури і підводний човен',
        author: 'Володимир Рутківський',
        pages: 400,
        synopsis: 'Продовження історії про козацьких джур та небезпечні походи проти татарських завойовників.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Чудове Чудовисько',
        author: 'Сашко Дерманський',
        pages: 256,
        synopsis: 'Весела і зворушлива історія про незвичайну дружбу дівчинки Соні та доброзичливого Чудовиська Чусі.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Чудове Чудовисько в Країні Жаховиськ',
        author: 'Сашко Дерманський',
        pages: 272,
        synopsis: 'Друга частина пригод Соні та Чусі у дивовижній Країні Жаховиськ.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Країна Сонячних Зайчиків',
        author: 'Всеволод Нестайко',
        pages: 220,
        synopsis: 'Казкова повість Всеволода Нестайка про сонячних зайчиків, весняне сонце та перемогу добра над тенетами темряви.',
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: '36 і 6 котів',
        author: 'Галина Вдовиченко',
        pages: 160,
        synopsis: '36 і 6 котів оселилися в одній звичайній квартирі! Зворушливі, бешкетні та неймовірно кумедні історії про котячу зграю.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: '36 і 6 котів-детективів',
        author: 'Галина Вдовиченко',
        pages: 160,
        synopsis: 'Продовження історії про котів, які беруться розслідувати таємничі події та зникнення малюнків.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Чарлі і шоколадна фабрика',
        author: 'Роальд Дал',
        pages: 240,
        synopsis: 'Малий Чарлі Бакет знаходить золотий квиток і потрапляє на чарівну шоколадну фабрику дивака Віллі Вонки.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Матильда',
        author: 'Роальд Дал',
        pages: 272,
        synopsis: 'Історія про геніальну дівчинку Матильду з телекінетичними здібностями, яка протистоїть суворій директрисі Трончбол.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'ВДГ (Великий Дружній Гігант)',
        author: 'Роальд Дал',
        pages: 272,
        synopsis: 'Дівчинка Софі знайомиться з єдиним добрим велетнем, який ловить хороші сни і дарує їх дітям.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Пеппі Довгапанчоха',
        author: 'Астрід Ліндгрен',
        pages: 180,
        synopsis: 'Найсильніша та найнезалежніша дівчинка у світі з рудими кісками, яка живе у віллі "Схованка" з конем і мавпочкою.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Малий і Карлсон, що живе на даху',
        author: 'Астрід Ліндгрен',
        pages: 240,
        synopsis: 'Смішна історія про звичайного хлопчика Малого та витівника з пропелером Карлсона.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Коти-Вояки: На волю!',
        author: 'Ерін Гантер',
        pages: 304,
        synopsis: 'Домашній котик Рудько залишає затишну домівку та вирушає до Дикого лісу, де живуть чотири клани диких котів.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Пес на ім’я Мані',
        author: 'Бодо Шефер',
        pages: 220,
        synopsis: 'Чудова дитяча книга про фінансову грамотність та досягнення мрій у формі казки про розумного лабрадора Мані.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Поліанна',
        author: 'Елеонор Портер',
        pages: 280,
        synopsis: 'Історія про дівчинку-сироту Поліанну, чия «гра в радість» змінює життя усього похмурого містечка.',
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Аліса в Країні Див',
        author: 'Льюїс Керрол',
        pages: 192,
        synopsis: 'Подорож дівчинки Аліси у дивовижний світ Чеширського Кота, Капелюшника та Чирвової Королеви.',
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Пригоди Тома Сойєра',
        author: 'Марк Твен',
        pages: 240,
        synopsis: 'Бешкетні пригоди Тома Сойєра та Гекльберрі Фінна на берегах річки Міссісіпі.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Хроніки Нарнії: Лев, Чаклунка і Шафа',
        author: 'К. С. Льюїс',
        pages: 208,
        synopsis: 'Четверо дітей проходять крізь магічну платяну шафу і опиняються у засніженій Нарнії під владою Білої Чаклунки.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Таємне Товариство Боягузів',
        author: 'Леся Воронина',
        pages: 140,
        synopsis: 'Пригодницька повість про Клима Джуру, який стає членом таємного товариства і рятує Землю від прибульців.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Мій дідусь — детектив',
        author: 'Віктор Андрієнко',
        pages: 190,
        synopsis: 'Весела пригодницька детективна історія про хлопчика та його кумедного дідуся-детективника.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Кобзар',
        author: 'Тарас Шевченко',
        pages: 280,
        synopsis: 'Безсмертна збірка поетичних творів поета Тараса Шевченка.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    }
];

// HELPER: RICH SYNOPSIS RESOLVER
function getRichBookSynopsis(title, author, rawDesc = '') {
    if (!title) return '';
    const cleanTitle = title.trim();
    const cleanAuthor = author ? author.trim() : '';

    // 1. Check LOCAL_BOOK_CATALOG first for exact or fuzzy title match!
    const matchedCatalogItem = LOCAL_BOOK_CATALOG.find(b => {
        const t1 = b.title.toLowerCase();
        const t2 = cleanTitle.toLowerCase();
        return t1.includes(t2) || t2.includes(t1);
    });

    if (matchedCatalogItem && matchedCatalogItem.synopsis) {
        return matchedCatalogItem.synopsis;
    }

    // 2. If API provided a meaningful description, sanitize it
    if (rawDesc && rawDesc.trim().length > 25 && !rawDesc.startsWith('Книга "')) {
        let cleaned = rawDesc.replace(/<[^>]*>?/gm, '').trim();
        if (cleaned.length > 380) cleaned = cleaned.substring(0, 377) + '...';
        return cleaned;
    }

    // 3. Informative narrative summary generator
    if (cleanAuthor && cleanAuthor !== 'Невідомий автор') {
        return `«${cleanTitle}» — це захопливий твір автора ${cleanAuthor}, який занурює читача у яскравий світ пригод, цікавих персонажів та важливих життєвих історій.`;
    }
    return `«${cleanTitle}» — це захоплива книжкова пригода, яка розкриває цікавий сюжет та занурює у світ читання.`;
}

let globalSearchResultsList = [];

async function searchGoogleBooks() {
    const queryInput = document.getElementById('searchQuery');
    const rawQuery = queryInput ? queryInput.value.trim() : '';
    const resultsBox = document.getElementById('searchResultsBox');

    if (!rawQuery) {
        alert('Будь ласка, введіть назву книги або автора для пошуку.');
        return;
    }

    const q = rawQuery.toLowerCase();
    resultsBox.classList.remove('hidden');
    resultsBox.innerHTML = `
        <div class="search-loading">
            <i class="fa-solid fa-spinner fa-spin"></i> Шукаємо книги та визначаємо кількість сторінок...
        </div>
    `;

    globalSearchResultsList = [];

    // 1. Check Local Catalog Matches with multi-word search
    const queryWords = q.split(/\s+/).filter(w => w.length > 1);
    const localMatches = LOCAL_BOOK_CATALOG.filter(b => {
        const titleLower = b.title.toLowerCase();
        const authorLower = b.author.toLowerCase();
        return queryWords.every(w => titleLower.includes(w) || authorLower.includes(w)) ||
               titleLower.includes(q) || authorLower.includes(q);
    });

    localMatches.forEach(b => {
        if (!globalSearchResultsList.some(item => item.title.toLowerCase() === b.title.toLowerCase())) {
            globalSearchResultsList.push({
                title: b.title,
                author: b.author,
                pages: b.pages,
                synopsis: b.synopsis,
                coverUrl: b.coverUrl,
                source: 'Каталог',
                editionKey: null
            });
        }
    });

    // 2. Check Detransliteration / Known Slugs
    const slugInfo = detransliterateUkrainianSlug(rawQuery);
    if (slugInfo.title && !globalSearchResultsList.some(item => item.title.toLowerCase() === slugInfo.title.toLowerCase())) {
        globalSearchResultsList.push({
            title: slugInfo.title,
            author: slugInfo.author || 'Українське видання',
            pages: slugInfo.pages || null,
            synopsis: slugInfo.synopsis || getRichBookSynopsis(slugInfo.title, slugInfo.author),
            coverUrl: slugInfo.coverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80',
            source: 'Мережа',
            editionKey: null
        });
    }

    // 2. Fetch from Open Library API (CORS & 429 friendly)
    try {
        const olRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(rawQuery)}&limit=6`);
        if (olRes.ok) {
            const olData = await olRes.json();
            if (olData && olData.docs) {
                const docsPromises = olData.docs.map(async doc => {
                    const title = doc.title || '';
                    const author = doc.author_name ? doc.author_name.join(', ') : 'Невідомий автор';
                    let pages = doc.number_of_pages_median || doc.number_of_pages || (Array.isArray(doc.numberOfPages) ? doc.numberOfPages[0] : doc.numberOfPages);
                    const editionKey = doc.cover_edition_key || (doc.edition_key && doc.edition_key.length > 0 ? doc.edition_key[0] : null);

                    // Fetch exact page count from edition JSON if missing from search summary
                    if (!pages && editionKey) {
                        try {
                            const edRes = await fetch(`https://openlibrary.org/books/${editionKey}.json`);
                            if (edRes.ok) {
                                const edData = await edRes.json();
                                if (edData && edData.number_of_pages) {
                                    pages = edData.number_of_pages;
                                }
                            }
                        } catch (e) {}
                    }

                    const coverUrl = doc.cover_i 
                        ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`
                        : 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80';

                    let rawSynopsis = '';
                    if (doc.first_sentence) {
                        rawSynopsis = Array.isArray(doc.first_sentence) ? doc.first_sentence.join(' ') : String(doc.first_sentence);
                    } else if (doc.subtitle) {
                        rawSynopsis = doc.subtitle;
                    }

                    const synopsis = getRichBookSynopsis(title, author, rawSynopsis);

                    if (title && !globalSearchResultsList.some(item => item.title.toLowerCase() === title.toLowerCase())) {
                        globalSearchResultsList.push({
                            title,
                            author,
                            pages: pages || null,
                            synopsis,
                            coverUrl,
                            source: 'Open Library',
                            editionKey
                        });
                    }
                });

                await Promise.allSettled(docsPromises);
            }
        }
    } catch (err) {
        console.warn('Open Library search warning:', err);
    }

    // 3. Multi-Strategy Fetch from Google Books API (unrestricted search for translated releases)
    try {
        const queryEndpoints = [
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(rawQuery)}&maxResults=10`,
            `https://www.googleapis.com/books/v1/volumes?q=intitle:${encodeURIComponent(rawQuery)}&maxResults=10`
        ];

        for (const ep of queryEndpoints) {
            try {
                const gbRes = await fetch(ep);
                if (gbRes.ok) {
                    const gbData = await gbRes.json();
                    if (gbData && gbData.items) {
                        gbData.items.forEach(item => {
                            const info = item.volumeInfo || {};
                            const title = info.title || '';
                            const author = info.authors ? info.authors.join(', ') : 'Невідомий автор';
                            const pages = info.pageCount || info.printedPageCount || null;
                            let coverUrl = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80';
                            if (coverUrl.startsWith('http:')) coverUrl = coverUrl.replace('http:', 'https:');

                            const rawSynopsis = info.description || info.subtitle || '';
                            const synopsis = getRichBookSynopsis(title, author, rawSynopsis);

                            if (title && !globalSearchResultsList.some(existing => existing.title.toLowerCase() === title.toLowerCase())) {
                                globalSearchResultsList.push({
                                    title,
                                    author,
                                    pages,
                                    synopsis,
                                    coverUrl,
                                    source: 'Google Books',
                                    editionKey: null
                                });
                            }
                        });
                    }
                }
            } catch (e) {}
        }
    } catch (err) {
        console.warn('Google Books search warning:', err);
    }

    if (globalSearchResultsList.length === 0) {
        globalSearchResultsList.push({
            title: rawQuery,
            author: 'Автор книги',
            pages: 200,
            synopsis: `Книга про ${rawQuery}.`,
            coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80',
            source: 'Шаблон',
            editionKey: null
        });
    }

    const encodedQ = encodeURIComponent(rawQuery);
    resultsBox.innerHTML = `
        <div class="search-store-banner" style="background: rgba(6, 182, 212, 0.1); border: 1px solid var(--cyan); padding: 10px 14px; border-radius: 8px; margin-bottom: 12px; font-size: 0.85rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span><i class="fa-solid fa-magnifying-glass" style="color: var(--cyan);"></i> Пошук у книгарнях України:</span>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                <a href="https://www.yakaboo.ua/ua/search?q=${encodedQ}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="font-size: 0.75rem; padding: 4px 8px; color: var(--cyan);" onclick="event.stopPropagation();">🛒 Yakaboo</a>
                <a href="https://book-ye.com.ua/search/?q=${encodedQ}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="font-size: 0.75rem; padding: 4px 8px; color: var(--cyan);" onclick="event.stopPropagation();">📚 Книгарня «Є»</a>
                <a href="https://vivat.com.ua/search/?q=${encodedQ}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline" style="font-size: 0.75rem; padding: 4px 8px; color: var(--cyan);" onclick="event.stopPropagation();">📖 Vivat</a>
            </div>
        </div>
    `;

    globalSearchResultsList.forEach((item, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'search-result-item';
        itemEl.onclick = () => selectGoogleBook(index);
        
        const pagesText = item.pages 
            ? `${item.pages} сторінок` 
            : 'Точний обсяг сторінок уточнюється при виборі';

        itemEl.innerHTML = `
            <img src="${item.coverUrl}" alt="${escapeHTML(item.title)}" class="search-result-thumb">
            <div class="search-result-info">
                <div class="search-result-title">${escapeHTML(item.title)}</div>
                <div class="search-result-author">${escapeHTML(item.author)}</div>
                <div class="search-result-meta"><span class="pages-pill"><i class="fa-solid fa-file-lines"></i> ${pagesText}</span> • <span style="opacity:0.8;">${item.source}</span></div>
            </div>
            <button class="btn btn-sm btn-accent" type="button"><i class="fa-solid fa-plus"></i> Обрати</button>
        `;
        resultsBox.appendChild(itemEl);
    });

    // Append 1-click manual creation card at bottom of search results
    const manualCard = document.createElement('div');
    manualCard.style.cssText = "margin-top: 10px; padding: 10px; background: rgba(251, 191, 36, 0.1); border: 1px dashed var(--gold); border-radius: 8px; text-align: center;";
    manualCard.innerHTML = `
        <span style="font-size: 0.85rem; color: var(--gold); font-weight: 600;">Не знайшли потрібне видання?</span>
        <button type="button" class="btn btn-sm btn-warning" style="margin-left: 8px;" onclick="fillBookTitleDirectly('${escapeHTML(rawQuery).replace(/'/g, "\\'")}')">
            <i class="fa-solid fa-pen-to-square"></i> Додати "${escapeHTML(rawQuery)}" вручну
        </button>
    `;
    resultsBox.appendChild(manualCard);
}

function fillBookTitleDirectly(rawTitle) {
    const titleInput = document.getElementById('bookTitleInput');
    const authorInput = document.getElementById('bookAuthorInput');
    const resultsBox = document.getElementById('searchResultsBox');

    if (titleInput) titleInput.value = rawTitle;
    if (authorInput) authorInput.focus();
    if (resultsBox) resultsBox.classList.add('hidden');
}

// UKRAINIAN URL DETRANSLITERATOR & SMART BOOK EXTRACTOR
function detransliterateUkrainianSlug(slug) {
    if (!slug) return { title: '', author: '', pages: null, synopsis: '', coverUrl: '' };

    let clean = slug
        .replace(/\.html?$/i, '')
        .replace(/^(product|catalog|suchasna-proza|fantastyka|zarubizhna-literatura|elektronna-knyha|p)\-?/i, '')
        .replace(/\-\d{4,8}$/g, '')
        .replace(/\-/g, ' ')
        .trim();

    const knownSlugs = [
        { keys: ["ja bachu vas cikavit pit ma", "ja bachu vas cikavit pitma", "ja-bachu-vas-cikavit-pit-ma", "ya bachu vas tsikavyt pitma", "ya-bachu-vas-tsikavyt-pitma"], title: "Я бачу, вас цікавить пітьма", author: "Ілларіон Павлюк", pages: 664, synopsis: "Містичний психологічний детективний трилер про київського кримінального психолога Вадима Чорного, який прибуває у зникле в часі селище Бучач для розслідування загадкового зникнення маленької дівчинки.", coverUrl: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80" },
        { keys: ["tanets nedumka", "tanec nedumka", "tanets-nedumka"], title: "Танець недоумка", author: "Ілларіон Павлюк", pages: 680, synopsis: "Захопливий психологічний космічний детектив про біолога Гіля." },
        { keys: ["bilyj popil", "bilyi popil", "bilyy popil"], title: "Білий попіл", author: "Ілларіон Павлюк", pages: 352, synopsis: "Атмосферний трилер у стилі тривожного детективу." },
        { keys: ["kolonija", "koloniya", "koloniya novi temni viki", "koloniya novi temni viky"], title: "Колонія. Нові темні віки", author: "Макс Кідрук", pages: 904, synopsis: "Масштабний науково-фантастичний роман про життя людства у XXII столітті на Марсі та Землі у часи космічних конфліктів.", coverUrl: "https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80" },
        { keys: ["zazyrajuchy u morok", "zazyrayuchy u morok"], title: "Зазираючи у морок", author: "Макс Кідрук", pages: 380, synopsis: "Захопливий психологічний трилер Макса Кідрука про таємниці людського підсвідомого." },
        { keys: ["bot"], title: "Бот", author: "Макс Кідрук", pages: 480, synopsis: "Технотрилер про київського програміста Тимура, який потрапляє у секретну лабораторію в пустелі Атакама." },
        { keys: ["tverdynja", "tverdynya"], title: "Твердиня", author: "Макс Кідрук", pages: 592, synopsis: "Пригодницький трилер про розшук затеряної фортеці інків у джунглях Перу." },
        { keys: ["krashche nizh u fil makh", "krashche nizh u filmakh", "krashche nizh u fil makh"], title: "Краще ніж у фільмах", author: "Лінн Пейнтер", pages: 384, synopsis: "Неймовірна підліткова та молодіжна романтична комедія про Ліз Баксбаум, її мрії про ідеальне кохання як у фільмах та стосунки із сусідським хлопцем Уесом." },
        { keys: ["hipoteza kokhannya", "hipoteza koxannya"], title: "Гіпотеза кохання", author: "Алі Гейзелвуд", pages: 384, synopsis: "Бестселер про аспірантку Олівію, яка фіктивно починає зустрічатися з молодим і суворим професором." },
        { keys: ["dvir shypiv i troyand"], title: "Двір шипів і троянд", author: "Сара Дж. Маас", pages: 480, synopsis: "Захопливе фентезі про 19-річну мисливицю Фейру, яка потрапляє до чарівного краю фейрі." },
        { keys: ["zhorstokyy prynts", "zhorstokyy-prynts", "zhorstokyj prync"], title: "Жорстокий принц", author: "Голлі Блек", pages: 416, synopsis: "Смертна дівчина Джуд протистоїть підступним та прекрасним фейрі в Ельфгеймі." },
        { keys: ["torreadory z vasjukivky", "torreadory z vasyukivky", "torreadory-z-vasyukivky"], title: "Торреадори з Васюківки", author: "Всеволод Нестайко", pages: 540, synopsis: "Неймовірні пригоди Яви Реня та Павлуші Завгороднього — класика української дитячої літератури." },
        { keys: ["nezvychajni pryghody v lisovij shkoli", "nezvychayni pryghody v lisoviy shkoli"], title: "Незвичайні пригоди в лісовій школі", author: "Всеволод Нестайко", pages: 280, synopsis: "Казкова повість про зайчика Косю Вуханя та їжачка Колю Колючку." },
        { keys: ["gharri potter i filosofs kyj kamin", "garri potter i filosofskyj kamin", "harri potter i filosofskyy kamin"], title: "Гаррі Поттер і філософський камінь", author: "Дж. К. Роулінг", pages: 320, synopsis: "Перша частина магічної історії про хлопчика, який вижив, та його навчання у Гоґвортсі." }
    ];

    const lowerClean = clean.toLowerCase();
    for (const item of knownSlugs) {
        if (item.keys.some(k => lowerClean.includes(k))) {
            return {
                title: item.title,
                author: item.author,
                pages: item.pages,
                synopsis: item.synopsis || '',
                coverUrl: item.coverUrl || ''
            };
        }
    }

    let text = clean;
    const rules = [
        [/shch/gi, 'щ'], [/zh/gi, 'ж'], [/kh/gi, 'х'], [/ts/gi, 'ц'], [/ch/gi, 'ч'], [/sh/gi, 'ш'],
        [/ya/gi, 'я'], [/ja/gi, 'я'], [/yu/gi, 'ю'], [/ju/gi, 'ю'], [/ye/gi, 'є'], [/je/gi, 'є'],
        [/yi/gi, 'ї'], [/ji/gi, 'ї'], [/yy/gi, 'ій'], [/ii/gi, 'ій'],
        [/a/gi, 'а'], [/b/gi, 'б'], [/v/gi, 'в'], [/g/gi, 'г'], [/ґ/gi, 'ґ'], [/d/gi, 'д'], [/e/gi, 'е'],
        [/z/gi, 'з'], [/i/gi, 'і'], [/y/gi, 'и'], [/k/gi, 'к'], [/l/gi, 'л'], [/m/gi, 'м'], [/n/gi, 'н'],
        [/o/gi, 'о'], [/p/gi, 'п'], [/r/gi, 'р'], [/s/gi, 'с'], [/t/gi, 'т'], [/u/gi, 'у'], [/f/gi, 'ф'],
        [/h/gi, 'г'], [/c/gi, 'ц'], [/'/g, '']
    ];

    rules.forEach(([reg, rep]) => {
        text = text.replace(reg, rep);
    });

    text = text.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : '').join(' ');
    return { title: text, author: '', pages: null, synopsis: '', coverUrl: '' };
}

// SMART URL DATA EXTRACTOR (SUPPORTING VIVAT, YAKABOO, KNIGARNE YE & ALL BOOKSTORE URLS)
async function fetchBookDataFromUrl() {
    const input = document.getElementById('bookUrlImportInput');
    const statusBox = document.getElementById('urlImportStatus');
    const rawUrl = input ? input.value.trim() : '';

    if (!rawUrl) {
        alert("Будь ласка, спочатку вставте посилання на книгу у поле імпорту.");
        return;
    }

    statusBox.classList.remove('hidden');
    statusBox.style.color = 'var(--cyan)';
    statusBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Аналізуємо посилання та витягуємо назву й автора...';

    try {
        let extractedTitle = '';
        let extractedAuthor = '';
        let extractedPages = null;
        let extractedCover = '';
        let extractedSynopsis = '';

        // 1. Extract URL Slug and detransliterate
        try {
            const urlObj = new URL(rawUrl);
            const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
            const lastPart = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2] || '';
            const slugInfo = detransliterateUkrainianSlug(lastPart);
            if (slugInfo.title) {
                extractedTitle = slugInfo.title;
                if (slugInfo.author) extractedAuthor = slugInfo.author;
                if (slugInfo.pages) extractedPages = slugInfo.pages;
                if (slugInfo.synopsis) extractedSynopsis = slugInfo.synopsis;
                if (slugInfo.coverUrl) extractedCover = slugInfo.coverUrl;
            }
        } catch (e) {}

        // 2. Check LOCAL_BOOK_CATALOG for exact or fuzzy match
        if (extractedTitle) {
            const catalogMatch = LOCAL_BOOK_CATALOG.find(b => {
                const t1 = b.title.toLowerCase();
                const t2 = extractedTitle.toLowerCase();
                return t1.includes(t2) || t2.includes(t1);
            });

            if (catalogMatch) {
                extractedTitle = catalogMatch.title;
                if (!extractedAuthor) extractedAuthor = catalogMatch.author;
                if (!extractedPages) extractedPages = catalogMatch.pages;
                if (!extractedSynopsis) extractedSynopsis = catalogMatch.synopsis;
                if (!extractedCover) extractedCover = catalogMatch.coverUrl;
            }
        }

        // Fill Form
        const titleInput = document.getElementById('bookTitleInput');
        const authorInput = document.getElementById('bookAuthorInput');
        const pagesInput = document.getElementById('totalPagesInput');
        const coverInput = document.getElementById('bookCoverInput');
        const synopsisInput = document.getElementById('bookSynopsisInput');

        if (titleInput && extractedTitle) titleInput.value = extractedTitle;
        if (authorInput) authorInput.value = extractedAuthor || '';
        if (pagesInput && extractedPages) {
            pagesInput.value = extractedPages;
            if (typeof recalculateParentTier === 'function') recalculateParentTier();
        }
        if (coverInput && extractedCover) coverInput.value = extractedCover;
        if (synopsisInput && extractedSynopsis) synopsisInput.value = extractedSynopsis;

        statusBox.style.color = 'var(--emerald)';
        statusBox.innerHTML = `✨ Дані книги <strong>"${escapeHTML(extractedTitle || 'знайденої книги')}"</strong> успішно витягнуто та заповнено у форму нижче!`;

    } catch (err) {
        console.error("URL Import Error:", err);
        statusBox.style.color = 'var(--gold)';
        statusBox.innerHTML = '⚠️ Не вдалося автоматично витягнути дані з посилання. Заповніть назву та кількість сторінок вручну.';
    }
}



async function selectGoogleBook(index) {
    const item = globalSearchResultsList[index];
    if (!item) return;

    let finalPages = item.pages;

    // If page count wasn't retrieved in initial search doc, fetch edition details now!
    if (!finalPages && item.editionKey) {
        try {
            const edRes = await fetch(`https://openlibrary.org/books/${item.editionKey}.json`);
            if (edRes.ok) {
                const edData = await edRes.json();
                if (edData && edData.number_of_pages) {
                    finalPages = edData.number_of_pages;
                }
            }
        } catch (e) {}
    }

    if (!finalPages || finalPages <= 0) {
        finalPages = 200; // Fallback if page count is unavailable
    }

    document.getElementById('bookTitleInput').value = item.title;
    document.getElementById('bookAuthorInput').value = item.author;
    document.getElementById('bookSynopsisInput').value = item.synopsis;
    document.getElementById('bookCoverInput').value = item.coverUrl;
    document.getElementById('totalPagesInput').value = finalPages;

    recalculateParentTier();

    const resultsBox = document.getElementById('searchResultsBox');
    resultsBox.classList.add('hidden');
}

function saveNewBook() {
    const title = document.getElementById('bookTitleInput').value.trim();
    const author = document.getElementById('bookAuthorInput').value.trim();
    const coverUrl = document.getElementById('bookCoverInput').value.trim();
    const synopsis = document.getElementById('bookSynopsisInput').value.trim();
    const P = parseInt(document.getElementById('totalPagesInput').value) || 100;
    const R = parseFloat(document.getElementById('rewardPerPageInput').value) || 1.0;
    const D = parseInt(document.getElementById('dailyNormInput').value) || 10;

    const startPage = Math.max(1, parseInt(document.getElementById('startPageInput')?.value) || 1);

    if (!title || !author) {
        alert('Будь ласка, заповніть назву та автора книги.');
        return;
    }

    const initialCurrentPage = Math.max(0, startPage - 1);
    const unreadPages = Math.max(1, P - initialCurrentPage);

    const newBook = {
        id: 'b' + Date.now(),
        childId: state.activeChildId,
        title,
        author,
        coverUrl: coverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80',
        synopsis: synopsis || 'Короткий опис відсутній.',
        totalPages: P,
        rewardPerPage: R,
        dailyNorm: D,
        startPage: startPage,
        currentPage: initialCurrentPage,
        targetDays: Math.ceil(unreadPages / D),
        status: 'planned', // Planned until "Розпочинаю читати!" is clicked
        startedAt: null,
        completedAt: null,
        earnedPoints: 0,
        avgSpeedPagesPerHour: 0
    };

    state.books.push(newBook);
    closeAddBookModal();
    renderUI();
    showKidSubTab('shelf');
    saveStateToFirestore();
    alert(`Книгу "${title}" успішно додано! Коли будете готові розпочати читання та відлік дедлайнів, натисніть «🚀 Розпочинаю читати!». 📚✨`);
}

function startReadingBook(bookId) {
    const book = state.books.find(b => b.id === bookId);
    if (!book) return;

    book.status = 'active';
    book.startedAt = new Date().toLocaleDateString('uk-UA');
    book.startedTimestamp = Date.now();

    const unreadPages = Math.max(1, book.totalPages - (book.currentPage || 0));
    book.targetDays = Math.ceil(unreadPages / (book.dailyNorm || 10));

    saveStateToFirestore();
    renderUI();
    selectBookForReading(book.id);
    alert(`🚀 Вітаємо! Читання книги "${book.title}" розпочато! Відлік бонусних днів та дедлайнів активовано! 📖✨`);
}

function deleteBook(bookId) {
    const book = state.books.find(b => b.id === bookId);
    if (!book) return;

    const confirmDel = confirm(`⚠️ Ви дійсно хочете видалити книгу "${book.title}" з книжкової полиці?`);
    if (!confirmDel) return;

    state.books = state.books.filter(b => b.id !== bookId);
    if (state.activeReadingBookId === bookId) {
        state.activeReadingBookId = null;
    }

    saveStateToFirestore();
    renderUI();
    alert(`Книгу "${book.title}" видалено з полиці.`);
}

function approveBookReward() {
    const pendingBook = state.books.find(b => b.childId === state.activeChildId && b.status === 'quiz_pending');
    if (!pendingBook) return;

    const rewardCalc = calculateReadingReward(pendingBook.totalPages, pendingBook.rewardPerPage, pendingBook.dailyNorm);
    const activeChild = getActiveChild();

    activeChild.balance += rewardCalc.finalRewardPoints;
    pendingBook.status = 'archived';
    pendingBook.completedAt = new Date().toLocaleDateString('uk-UA');
    pendingBook.earnedPoints = rewardCalc.finalRewardPoints;

    state.notifications.unshift({
        id: 'n' + Date.now(),
        icon: 'fa-check-circle',
        title: 'Зараховано бали! 🎉',
        message: `Батьки зарахували +${rewardCalc.finalRewardPoints} балів для ${activeChild.name} за книгу "${pendingBook.title}".`,
        time: 'Щойно',
        unread: true
    });

    renderUI();
    saveStateToFirestore();
    alert(`Зараховано ${rewardCalc.finalRewardPoints} балів для ${activeChild.name}! Книгу перенесено в Архів.`);
}

// KID DAILY LOGGER
let pendingDailyLogPages = 0;

function getActiveReadingBook() {
    if (state.activeReadingBookId) {
        const book = state.books.find(b => b.id === state.activeReadingBookId);
        if (book) return book;
    }
    return state.books.find(b => b.childId === state.activeChildId && (b.status === 'active' || b.status === 'quiz_pending')) || state.books.find(b => b.childId === state.activeChildId);
}

function onPageInputSlider(val) {
    const manualInput = document.getElementById('pageInputManual');
    if (manualInput) {
        manualInput.value = val;
    }
}

function onPageInputManual(val) {
    const pages = parseInt(val) || 0;
    const slider = document.getElementById('pageSlider');
    if (slider) {
        slider.value = Math.max(0, Math.min(parseInt(slider.max) || 1000, pages));
    }
}

function adjustPages(delta) {
    const manualInput = document.getElementById('pageInputManual');
    const slider = document.getElementById('pageSlider');
    const activeBook = getActiveReadingBook();
    const maxPages = activeBook ? Math.max(1, activeBook.totalPages - activeBook.currentPage) : 1000;

    let currentVal = parseInt(manualInput ? manualInput.value : slider.value) || 0;
    let newVal = currentVal + delta;
    newVal = Math.max(0, Math.min(maxPages, newVal));

    if (manualInput) manualInput.value = newVal;
    if (slider) slider.value = newVal;
}

function logDailyPages() {
    const manualInput = document.getElementById('pageInputManual');
    const slider = document.getElementById('pageSlider');
    const pagesRead = parseInt(manualInput ? manualInput.value : slider.value) || 0;

    if (pagesRead <= 0) {
        alert('Вкажіть хоча б 1 прочитану сторінку.');
        return;
    }

    const activeBook = getActiveReadingBook();
    if (!activeBook) return;

    const dailyNorm = activeBook.dailyNorm || 12;

    // If logged pages exceed the daily norm, trigger the Super Reading mini-modal!
    if (pagesRead > dailyNorm) {
        pendingDailyLogPages = pagesRead;
        document.getElementById('superPagesCount').innerText = pagesRead;
        document.getElementById('superDailyNorm').innerText = dailyNorm;
        document.getElementById('superReadingConfirmModal').classList.add('active');
    } else {
        saveLoggedDailyPages(pagesRead, false);
    }
}

function closeSuperReadingModal() {
    document.getElementById('superReadingConfirmModal').classList.remove('active');
}

function confirmSuperReadingSave() {
    closeSuperReadingModal();
    saveLoggedDailyPages(pendingDailyLogPages, true);
}

function initChildAchievements(child) {
    if (!child) return;
    if (!child.achievements) child.achievements = {};

    if (!child.achievements.record_reader) {
        child.achievements.record_reader = {
            id: 'record_reader',
            title: 'Супер-читач дня 🏆',
            description: 'Рекорд прочитаних сторінок за один день!',
            icon: 'fa-trophy',
            unlocked: false,
            claimed: false,
            rewardCoins: 50,
            recordPages: 0
        };
    }
    if (!child.achievements.book_worm) {
        child.achievements.book_worm = {
            id: 'book_worm',
            title: 'Книжковий марафон 📚',
            description: 'Прочитано 3 або більше книг в архіві',
            icon: 'fa-book-open-reader',
            unlocked: false,
            claimed: false,
            rewardCoins: 50
        };
    }
    if (!child.achievements.speed_demon) {
        child.achievements.speed_demon = {
            id: 'speed_demon',
            title: 'Майстер швидкості ⚡',
            description: 'Швидкість читання понад 40 сторінок на годину',
            icon: 'fa-bolt',
            unlocked: false,
            claimed: false,
            rewardCoins: 50
        };
    }
    if (!child.achievements.streak_master) {
        child.achievements.streak_master = {
            id: 'streak_master',
            title: 'Володар Стріку 🔥',
            description: 'Серія читання 5 або більше днів поспіль',
            icon: 'fa-fire',
            unlocked: false,
            claimed: false,
            rewardCoins: 50
        };
    }
}

function saveLoggedDailyPages(pagesRead, isSuperAchievement = false) {
    const activeBook = getActiveReadingBook();
    if (!activeBook) return;

    activeBook.currentPage = Math.min(activeBook.totalPages, activeBook.currentPage + pagesRead);
    
    if (activeBook.currentPage >= activeBook.totalPages) {
        activeBook.status = 'quiz_pending';
    }

    const activeChild = getActiveChild();

    if (isSuperAchievement) {
        if (!activeChild.achievements) activeChild.achievements = {};
        if (!activeChild.achievements.record_reader) {
            activeChild.achievements.record_reader = {
                id: 'record_reader',
                title: 'Супер-читач дня 🏆',
                description: 'Рекорд прочитаних сторінок за один день!',
                icon: 'fa-trophy',
                unlocked: false,
                claimed: false,
                rewardCoins: 50,
                recordPages: 0
            };
        }

        const ach = activeChild.achievements.record_reader;
        ach.unlocked = true;
        ach.rewardCoins = 50;
        ach.recordPages = Math.max(ach.recordPages || 0, pagesRead);

        state.notifications.unshift({
            id: 'n' + Date.now(),
            icon: 'fa-trophy',
            title: '🏆 Нова ачівка розблокована!',
            message: `${activeChild.name} прочитала рекордні +${pagesRead} сторінок за день! Розблоковано нагороду +50 монет у розділі ачівок!`,
            time: 'Щойно',
            unread: true
        });

        renderUI();
        saveStateToFirestore();
        // Open Super Achievement Celebration Mini-Modal
        const celebrationPages = document.getElementById('celebrationPagesCount');
        if (celebrationPages) celebrationPages.innerText = pagesRead;
        document.getElementById('superAchievementCelebrationModal').classList.add('active');
    } else {
        renderUI();
        saveStateToFirestore();
        alert(`Чудова робота! Збережено +${pagesRead} прочитаних сторінок для книги "${activeBook.title}"! 📚✨`);
    }
}

function closeSuperCelebrationModal() {
    document.getElementById('superAchievementCelebrationModal').classList.remove('active');
}

function openClaimFromCelebration() {
    closeSuperCelebrationModal();
    openAchievementsModal();
}

function openAchievementsModal() {
    renderAchievementsListGrid();
    document.getElementById('achievementsModal').classList.add('active');
}

function closeAchievementsModal() {
    document.getElementById('achievementsModal').classList.remove('active');
}

function checkChildAchievementUnlocks(child) {
    if (!child || !child.achievements) return;

    // Auto unlock book worm if >= 3 archived books
    const archivedCount = state.books.filter(b => b.childId === child.id && (b.status === 'archived' || b.status === 'completed')).length;
    if (archivedCount >= 3) {
        child.achievements.book_worm.unlocked = true;
    }

    // Auto unlock streak master if streak >= 5
    if ((child.streak || 0) >= 5) {
        child.achievements.streak_master.unlocked = true;
    }

    // Toggle unclaimed red dot on header button
    const hasUnclaimed = Object.values(child.achievements).some(a => a.unlocked && !a.claimed);
    const dot = document.getElementById('unclaimedDot');
    if (dot) {
        dot.classList.toggle('hidden', !hasUnclaimed);
    }
}

function renderAchievementsListGrid() {
    const grid = document.getElementById('achievementsListGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const activeChild = getActiveChild();
    if (!activeChild) return;

    initChildAchievements(activeChild);
    checkChildAchievementUnlocks(activeChild);

    const achs = Object.values(activeChild.achievements);

    achs.forEach(ach => {
        const card = document.createElement('div');
        let cardClass = 'achievement-card';
        if (ach.claimed) cardClass += ' claimed';
        else if (ach.unlocked) cardClass += ' unlocked';

        card.className = cardClass;

        let actionHtml = '';
        if (ach.unlocked && !ach.claimed) {
            actionHtml = `
                <button class="btn btn-warning btn-sm pulse" onclick="claimAchievementReward('${ach.id}')" style="width: 100%; margin-top: 8px;">
                    <i class="fa-solid fa-gift" aria-hidden="true"></i> Забрати +${ach.rewardCoins} Монет! 🎁
                </button>
            `;
        } else if (ach.claimed) {
            actionHtml = `
                <div style="text-align: center; color: var(--emerald); font-weight: 700; font-size: 0.85rem; padding: 6px;">
                    <i class="fa-solid fa-circle-check" aria-hidden="true"></i> Винагороду +${ach.rewardCoins} монет отримано!
                </div>
            `;
        } else {
            actionHtml = `
                <div style="text-align: center; color: #64748b; font-size: 0.82rem; padding: 6px;">
                    <i class="fa-solid fa-lock" aria-hidden="true"></i> Не розблоковано
                </div>
            `;
        }

        card.innerHTML = `
            <div class="achievement-card-header">
                <div class="achievement-icon-box">
                    <i class="fa-solid ${ach.icon || 'fa-trophy'}" aria-hidden="true"></i>
                </div>
                <div>
                    <div class="achievement-card-title">${escapeHTML(ach.title)}</div>
                    <div class="achievement-card-desc">${escapeHTML(ach.description)}</div>
                </div>
            </div>
            ${actionHtml}
        `;

        grid.appendChild(card);
    });
}

function claimAchievementReward(achievementId) {
    const activeChild = getActiveChild();
    if (!activeChild || !activeChild.achievements) return;

    const ach = activeChild.achievements[achievementId];
    if (ach && ach.unlocked && !ach.claimed) {
        ach.claimed = true;
        activeChild.balance += ach.rewardCoins;

        state.notifications.unshift({
            id: 'n' + Date.now(),
            icon: 'fa-coins',
            title: 'Винагороду за ачівку отримано! 💰',
            message: `${activeChild.name} обміняла ачівку "${ach.title}" на +${ach.rewardCoins} монет!`,
            time: 'Щойно',
            unread: true
        });

        renderUI();
        renderAchievementsListGrid();
        saveStateToFirestore();
    }
}

// QUIZ RUNNER
function startKidQuiz() {
    state.activeQuiz.questionIndex = 0;
    state.activeQuiz.score = 0;
    
    const activeBook = state.books.find(b => b.childId === state.activeChildId && b.status === 'quiz_pending');
    if (activeBook) {
        document.getElementById('quizBookTitle').innerText = activeBook.title;
    }

    document.getElementById('quizModal').classList.add('active');
    renderQuizQuestion();
}

function closeQuizModal() {
    document.getElementById('quizModal').classList.remove('active');
}

function renderQuizQuestion() {
    const q = state.activeQuiz.questions[state.activeQuiz.questionIndex];
    document.getElementById('currentQuestionNum').innerText = state.activeQuiz.questionIndex + 1;
    document.getElementById('questionText').innerText = q.question;
    document.getElementById('quizProgressFill').style.width = `${((state.activeQuiz.questionIndex + 1) / 5) * 100}%`;
    document.getElementById('nextQuestionBtn').disabled = true;

    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';

    q.options.forEach((optText, idx) => {
        const item = document.createElement('div');
        item.className = 'option-item';
        item.innerText = optText;
        item.onclick = () => selectOption(idx, item);
        optionsContainer.appendChild(item);
    });
}

function selectOption(idx, el) {
    const q = state.activeQuiz.questions[state.activeQuiz.questionIndex];
    const items = document.querySelectorAll('.option-item');
    items.forEach(i => i.className = 'option-item');

    if (idx === q.correctIndex) {
        el.classList.add('correct');
        state.activeQuiz.score += 20;
    } else {
        el.classList.add('wrong');
        items[q.correctIndex].classList.add('correct');
    }

    document.getElementById('nextQuestionBtn').disabled = false;
}

function nextQuestion() {
    if (state.activeQuiz.questionIndex < 4) {
        state.activeQuiz.questionIndex++;
        renderQuizQuestion();
    } else {
        closeQuizModal();
        alert(`Вітаємо! Квіз пройдено з результатом 100%! Запит відправлено батькам на зарахування балів. 🎉`);
    }
}
