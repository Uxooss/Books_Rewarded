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
        renderUI();
    });
} else {
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

// MAIN UI RENDERER
function renderUI() {
    const noChildView = document.getElementById('noChildView');
    const kidView = document.getElementById('kidView');
    const parentView = document.getElementById('parentView');

    if (state.children.length === 0) {
        noChildView.classList.add('active');
        kidView.classList.remove('active');
        parentView.classList.remove('active');
        return;
    } else {
        noChildView.classList.remove('active');
    }

    const activeChild = getActiveChild();

    if (state.currentRole === 'kid') {
        parentView.classList.remove('active');
        kidView.classList.add('active');

        document.getElementById('kidBalance').innerText = activeChild.balance.toFixed(2);
        document.getElementById('kidMascotImg').src = activeChild.avatarUrl;
        document.getElementById('kidNicknameDisplay').innerText = activeChild.name;
        document.getElementById('kidStreakCount').innerText = activeChild.streak;

        renderChildrenProfilesBar();
        initChildAchievements(activeChild);
        checkChildAchievementUnlocks(activeChild);
        showKidSubTab(state.activeKidSubTab || 'shelf');
    } else {
        kidView.classList.remove('active');
        parentView.classList.add('active');

        document.getElementById('parentChildBalance').innerText = activeChild.balance.toFixed(2);
        document.getElementById('parentChildNameDisplay').innerText = `${activeChild.name} (${activeChild.age || 8} років)`;
        document.getElementById('parentChildAvatar').src = activeChild.avatarUrl;

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
        if (book.status === 'active') {
            actionTagHtml = `<span class="shelf-action-tag reading"><i class="fa-solid fa-book-open"></i> Читаю (${percent}%)</span>`;
        } else if (book.status === 'quiz_pending') {
            actionTagHtml = `<span class="shelf-action-tag quiz"><i class="fa-solid fa-trophy"></i> Пройди квіз!</span>`;
        } else {
            actionTagHtml = `<span class="shelf-action-tag done"><i class="fa-solid fa-circle-check"></i> Прочитано</span>`;
        }

        const coverImg = book.coverUrl || 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80';

        if (state.bookshelf.viewMode === 'list') {
            // LIST VIEW ROW
            card.innerHTML = `
                <div class="shelf-cover-wrapper">
                    <img src="${coverImg}" alt="${escapeHTML(book.title)}" class="shelf-cover-img">
                </div>
                <div class="shelf-info">
                    <div>
                        <h3 class="shelf-title">${escapeHTML(book.title)}</h3>
                        <p class="shelf-author">${escapeHTML(book.author)}</p>
                    </div>
                    <div class="shelf-list-progress-bar">
                        <span>Прогрес: ${percent}%</span>
                        <div class="progress-bar-bg" style="height: 8px;">
                            <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                    ${actionTagHtml}
                </div>
            `;
        } else {
            // GRID & COMPACT GRID 3D CARDS
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
                    <div>
                        <h3 class="shelf-title">${escapeHTML(book.title)}</h3>
                        <p class="shelf-author">${escapeHTML(book.author)}</p>
                    </div>
                    ${actionTagHtml}
                </div>
            `;
        }

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
    const activeBook = targetBook || childBooks.find(b => b.status === 'active' || b.status === 'quiz_pending') || childBooks[0];
    
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
    document.getElementById('kidDaysLeft').innerText = Math.max(1, activeBook.targetDays - 2);

    const percent = Math.min(100, Math.round((activeBook.currentPage / activeBook.totalPages) * 100));
    document.getElementById('kidProgressPercent').innerText = `${percent}%`;
    document.getElementById('kidProgressBar').style.width = `${percent}%`;

    const isFinished = activeBook.currentPage >= activeBook.totalPages;
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

    if (dailyLoggerBox) {
        dailyLoggerBox.classList.toggle('hidden', isFinished);
    }
    if (quizBanner) {
        quizBanner.classList.toggle('hidden', !isFinished);
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
                <span class="tag-archive-corner">Прочитано ✅</span>
            </div>
            <div class="book-card-body">
                <p class="book-synopsis-card">${escapeHTML(book.synopsis)}</p>
                <div class="divider"></div>
                <div class="meta-row"><span>Період читання:</span> <strong>${escapeHTML(book.startedAt)} — ${escapeHTML(book.completedAt)}</strong></div>
                <div class="meta-row"><span>Здобуто балів:</span> <strong class="text-success">+${book.earnedPoints} монет</strong></div>
                <div class="meta-row"><span>Середня швидкість:</span> <strong>${book.avgSpeedPagesPerHour} стор/год</strong></div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// PARENT VIEW RENDERERS
function renderParentBooks() {
    const grid = document.getElementById('parentBooksGrid');
    grid.innerHTML = '';

    const activeBooks = state.books.filter(b => b.childId === state.activeChildId && (b.status === 'active' || b.status === 'quiz_pending'));
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

    if (activeBooks.length === 0) {
        grid.innerHTML = '<p class="text-parent-muted">Немає активних книжок. Натисніть "+ Додати нову книгу".</p>';
        return;
    }

    activeBooks.forEach(book => {
        const rewardCalc = calculateReadingReward(book.totalPages, book.rewardPerPage, book.dailyNorm);
        const card = document.createElement('div');
        card.className = 'book-card';
        card.innerHTML = `
            <div class="book-card-header">
                <div>
                    <h3 class="book-title">${escapeHTML(book.title)}</h3>
                    <p class="book-author">${escapeHTML(book.author)}</p>
                    <p class="book-synopsis-card">${escapeHTML(book.synopsis)}</p>
                </div>
                <span class="tag ${book.status === 'quiz_pending' ? 'tag-active' : ''}">
                    ${book.status === 'quiz_pending' ? 'Очікує підтвердження' : 'Читається'}
                </span>
            </div>
            <div class="book-card-body">
                <div class="meta-row"><span>Сторінок (P):</span> <strong>${book.totalPages} стор.</strong></div>
                <div class="meta-row"><span>Ціна/стор (R):</span> <strong>${book.rewardPerPage} грн/бал</strong></div>
                <div class="meta-row"><span>Норма (D):</span> <strong>${book.dailyNorm} стор/день</strong></div>
                <div class="meta-row"><span>Базова нагорода:</span> <strong>${rewardCalc.baseReward} балів</strong></div>
                <div class="meta-row text-success"><span>Макс. Нагорода (+50%):</span> <strong>${rewardCalc.finalRewardPoints} балів</strong></div>
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

// KID SUBTAB ROUTING
function showKidSubTab(tab) {
    state.activeKidSubTab = tab;

    document.getElementById('tabBtnShelf').classList.toggle('active', tab === 'shelf');
    document.getElementById('tabBtnReading').classList.toggle('active', tab === 'reading');
    document.getElementById('tabBtnTimer').classList.toggle('active', tab === 'timer');
    document.getElementById('tabBtnArchive').classList.toggle('active', tab === 'archive');

    document.getElementById('kidSubTabShelf').classList.toggle('active', tab === 'shelf');
    document.getElementById('kidSubTabShelf').classList.toggle('hidden', tab !== 'shelf');

    document.getElementById('kidSubTabReading').classList.toggle('active', tab === 'reading');
    document.getElementById('kidSubTabReading').classList.toggle('hidden', tab !== 'reading');
    
    document.getElementById('kidSubTabTimer').classList.toggle('active', tab === 'timer');
    document.getElementById('kidSubTabTimer').classList.toggle('hidden', tab !== 'timer');

    document.getElementById('kidSubTabArchive').classList.toggle('active', tab === 'archive');
    document.getElementById('kidSubTabArchive').classList.toggle('hidden', tab !== 'archive');

    if (tab === 'shelf') renderKidBookshelf();
    if (tab === 'reading') renderKidActiveReading();
    if (tab === 'archive') renderKidArchive();
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

// LOCAL CURATED BOOK CATALOG FOR INSTANT SEARCH (OFFLINE & FALLBACK SAFE)
const LOCAL_BOOK_CATALOG = [
    {
        title: 'Відьмак. Останнє бажання',
        author: 'Анджей Сапковський',
        pages: 288,
        synopsis: '«Відьмак. Останнє бажання» — це перша книга та вступна збірка оповідань культового фентезійного циклу «Відьмак» польського письменника Анджея Сапковського. У ній розповідається про мандри біловолосого мутанта-мисливця на монстрів Ґеральта з Рівії.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Відьмак. Меч Призначення',
        author: 'Анджей Сапковський',
        pages: 384,
        synopsis: 'Друга збірка оповідань фентезійного циклу про відьмака Ґеральта з Рівії. У цих історіях зав’язується долевий зв’язок Ґеральта з юною княжною Ціріллою та чарівницею Йеннефер.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Відьмак. Кров Ельфів',
        author: 'Анджей Сапковський',
        pages: 320,
        synopsis: 'Перший повноцінний роман епічної саги «Відьмак». Світ занурюється у хаос війни, а Ґеральт береться захищати та навчати бойовому мистецтву дитину-призначення Цірі в гірській фортеці Каер Морхен.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Відьмак. Час погорди',
        author: 'Анджей Сапковський',
        pages: 320,
        synopsis: 'Другий роман саги «Відьмак». Під час чарівницького з’їзду на острові Таннедд спалахує зрада, що розколює магів та розлучає Ґеральта, Йеннефер та Цірі.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Відьмак. Хрещення вогнем',
        author: 'Анджей Сапковський',
        pages: 384,
        synopsis: 'Третій роман саги. Тяжко поранений Ґеральт збирає вірну компанію друзів (Любисток, Мільва, Кагір, Регіс) і вирушає у небезпечний похід через охоплені війною землі на пошуки Цірі.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Відьмак. Вежа Ластівки',
        author: 'Анджей Сапковський',
        pages: 480,
        synopsis: 'Четвертий роман епічного фентезі. Поранена та переслідувана найманими вбивцями Цірі знаходить притулок у самітника Висоготи і готується зустріти свою долю біля загадкової Вежі Ластівки.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Відьмак. Володарка Озера',
        author: 'Анджей Сапковський',
        pages: 560,
        synopsis: 'Кульмінаційний підсумковий роман фентезійної саги Анджея Сапковського. Цірі потрапляє у світ ельфів Aen Elle, а Ґеральт пробивається крізь шторм битв до замку Стигга.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Відьмак. Сезон гроз',
        author: 'Анджей Сапковський',
        pages: 352,
        synopsis: 'Приквел-роман про нові пригоди відьмака Ґеральта з Рівії. У Ґеральта викрадають його славетні відьмацькі мечі, і він починає ризиковану місію з їх повернення.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Нові темні віки. Колонія',
        author: 'Макс Кідрук',
        pages: 904,
        synopsis: 'Незвичайний масштабний фантастичний роман Макса Кідрука про майбутню колонізацію Марса та кризу людства у XXII столітті.',
        coverUrl: 'https://covers.openlibrary.org/b/id/15151801-M.jpg'
    },
    {
        title: 'Зазирни у мої сни',
        author: 'Макс Кідрук',
        pages: 520,
        synopsis: 'Містичний трилер про хлопчика Теорія, у сни якого під час операції проникає щось темне та небезпечне.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Я бачу, вас цікавить пітьма',
        author: 'Ілларіон Павлюк',
        pages: 664,
        synopsis: 'Психологічний детективний трилер про розслідування зникнення дівчинки у загадковому селищі Буськів Сад.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Гаррі Поттер і філософський камінь',
        author: 'Дж. К. Роулінг',
        pages: 320,
        synopsis: 'Історія про 11-річного хлопчика-сироту, який дізнається, що він чарівник, і вирушає на навчання до школи чаклунства Гоґвортс.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Гаррі Поттер і таємна кімната',
        author: 'Дж. К. Роулінг',
        pages: 352,
        synopsis: 'Другий рік навчання Гаррі Поттера у Гоґвортсі, де темні сили відкривають загадкову Таємну кімнату.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Маленький принц',
        author: 'Антуан де Сент-Екзюпері',
        pages: 120,
        synopsis: 'Казка-притча про хлопчика з віддаленого астероїда Б-612, яка розповідає про любов, дружбу, вірність та відповідальність.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Тореадори з Васюківки',
        author: 'Всеволод Нестайко',
        pages: 440,
        synopsis: 'Веселі та сповнені пригод історії двох друзів Яви та Павлуші з села Васюківка.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Аліса в Країні Див',
        author: 'Льюїс Керрол',
        pages: 192,
        synopsis: 'Неймовірна подорож дівчинки Аліси крізь кролячу нору до дивовижного світу капелюшників та Чеширського кота.',
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Пригоди Тома Сойєра',
        author: 'Марк Твен',
        pages: 240,
        synopsis: 'Захопливий роман про кмітливого та винахідливого хлопчика Тома Сойєра на берегах Міссісіпі.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Пеппі Довгапанчоха',
        author: 'Астрід Ліндгрен',
        pages: 180,
        synopsis: 'Історія про найсильнішу та найвеселішу дівчинку у світі з рудими кісками, яка живе у віллі "Схованка".',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Хроніки Нарнії: Лев, Чаклунка і Шафа',
        author: 'Клайв Стейплз Льюїс',
        pages: 208,
        synopsis: 'Четверо дітей знаходять чарівну шафу, яка веде до засніженого чарівного світу Нарнії.',
        coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Чарівник Смарагдового міста',
        author: 'Олександр Волков',
        pages: 210,
        synopsis: 'Подорож дівчинки Еллі та песика Тотошки у чарівну країну Гудвіна за допомогою жовтої цегляної дороги.',
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Кобзар',
        author: 'Тарас Шевченко',
        pages: 280,
        synopsis: 'Класичний збірник поетичних творів великого українського Кобзаря.',
        coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Джури козака Швайки',
        author: 'Володимир Рутківський',
        pages: 430,
        synopsis: 'Історико-пригодницький роман про дитинство майбутніх козаків та розвідника Швайку.',
        coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80'
    },
    {
        title: 'Острів скарбів',
        author: 'Роберт Луїс Стівенсон',
        pages: 250,
        synopsis: 'Легендарний роман про пошуки піратського скарбу капітана Флінта на безимянному острові.',
        coverUrl: 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?auto=format&fit=crop&w=300&q=80'
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

    // 1. Check Local Catalog Matches
    const localMatches = LOCAL_BOOK_CATALOG.filter(b => 
        b.title.toLowerCase().includes(q) || 
        b.author.toLowerCase().includes(q)
    );

    localMatches.forEach(b => {
        globalSearchResultsList.push({
            title: b.title,
            author: b.author,
            pages: b.pages,
            synopsis: b.synopsis,
            coverUrl: b.coverUrl,
            source: 'Каталог',
            editionKey: null
        });
    });

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

    // 3. Fetch from Google Books API
    try {
        const gbRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(rawQuery)}&maxResults=5`);
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

    resultsBox.innerHTML = '';
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

    if (!title || !author) {
        alert('Будь ласка, заповніть назву та автора книги.');
        return;
    }

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
        targetDays: Math.ceil(P / D),
        currentPage: 0,
        status: 'active',
        startedAt: new Date().toLocaleDateString('uk-UA'),
        completedAt: null,
        earnedPoints: 0,
        avgSpeedPagesPerHour: 0
    };

    state.books.push(newBook);
    closeAddBookModal();
    renderUI();
    showKidSubTab('shelf');
    alert(`Книгу "${title}" успішно додано на вашу книжкову полицю! 📚✨`);
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

        // Open Super Achievement Celebration Mini-Modal
        const celebrationPages = document.getElementById('celebrationPagesCount');
        if (celebrationPages) celebrationPages.innerText = pagesRead;
        document.getElementById('superAchievementCelebrationModal').classList.add('active');
    } else {
        renderUI();
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
