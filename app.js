// State Management
const state = {
    currentRole: 'kid', // Kid view opens first by default
    parentPin: '1234',
    activeChildId: 'c1',
    newChildAvatarSeed: 'Polina',
    bookshelf: {
        searchQuery: '',
        statusFilter: 'all',
        sortBy: 'progress_desc',
        viewMode: 'grid' // 'grid' | 'compact' | 'list'
    },
    children: [
        {
            id: 'c1',
            name: 'Поліна',
            nickname: 'Поліна 👧',
            age: 8,
            avatarSeed: 'Polina',
            avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=Polina',
            balance: 450.00,
            streak: 5
        }
    ],
    timer: {
        intervalId: null,
        secondsElapsed: 0,
        isRunning: false,
        lastSpeedMetrics: null
    },
    notifications: [
        {
            id: 'n1',
            icon: 'fa-trophy',
            title: 'Квіз пройдено (100%)!',
            message: 'Поліна відповіла на 5 з 5 запитань для книги "Маленький принц".',
            time: '10 хвилин тому',
            unread: true
        }
    ],
    books: [
        {
            id: 'b1',
            childId: 'c1',
            title: 'Маленький принц',
            author: 'Антуан де Сент-Екзюпері',
            synopsis: 'Казка-притча про хлопчика з віддаленого астероїда Б-612, яка розповідає про любов, дружбу, вірність та відповідальність.',
            coverUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80',
            totalPages: 120,
            rewardPerPage: 2.5, // 2.5 грн/бал
            dailyNorm: 12,       // T = 10 днів
            targetDays: 10,
            currentPage: 120,    // 100% completed
            status: 'quiz_pending', // Waiting for approval after quiz
            startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('uk-UA'),
            completedAt: new Date().toLocaleDateString('uk-UA'),
            earnedPoints: 450,
            avgSpeedPagesPerHour: 40.0
        },
        {
            id: 'b2',
            childId: 'c1',
            title: 'Тореадори з Васюківки',
            author: 'Всеволод Нестайко',
            synopsis: 'Веселі та сповнені пригод історії двох друзів Яви та Павлуші з села Васюківка.',
            coverUrl: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=300&q=80',
            totalPages: 440,
            rewardPerPage: 1.0,
            dailyNorm: 44,      // T = 10 днів
            targetDays: 10,
            currentPage: 180,
            status: 'active',
            startedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString('uk-UA'),
            completedAt: null,
            earnedPoints: 0,
            avgSpeedPagesPerHour: 35.0
        },
        {
            id: 'b3',
            childId: 'c1',
            title: 'Гаррі Поттер і філософський камінь',
            author: 'Дж. К. Роулінг',
            synopsis: 'Історія про 11-річного хлопчика-сироту, який дізнається, що він чарівник, і вирушає на навчання до Гоґвортсу.',
            coverUrl: 'https://images.unsplash.com/photo-1626618012641-bfbca5a31239?auto=format&fit=crop&w=300&q=80',
            totalPages: 320,
            rewardPerPage: 1.0,
            dailyNorm: 32,
            targetDays: 10,
            currentPage: 320,
            status: 'archived',
            startedAt: '10.07.2026',
            completedAt: '18.07.2026',
            earnedPoints: 480,
            avgSpeedPagesPerHour: 45.0
        }
    ],
    activeQuiz: {
        bookId: null,
        questionIndex: 0,
        selectedOption: null,
        score: 0,
        questions: [
            {
                question: 'З якої планети прилетів Маленький принц?',
                options: ['Астероїд Б-612', 'Марс', 'Юпітер-7', 'Комета Галлея'],
                correctIndex: 0,
                explanation: 'Маленький принц жив на крихітному астероїді Б-612.'
            },
            {
                question: 'Кого Маленький принц попросив намалювати льотчика?',
                options: ['Квітку', 'Баранця', 'Лиса', 'Змію'],
                correctIndex: 1,
                explanation: 'Його першим проханням було: "Намалюй мені баранця!".'
            },
            {
                question: 'Яка рослина загрожувала планеті Маленького принца?',
                options: ['Кактуси', 'Дуби', 'Баобаби', 'Троянди'],
                correctIndex: 2,
                explanation: 'Паростки баобабів могли розірвати його маленьку планету.'
            },
            {
                question: 'Кому належить вислів: "Ти назавжди відповідаєш за тих, кого приручив"?',
                options: ["Королю", "Лисеняті (Лису)", "Троянді", "П'яничці"],
                correctIndex: 1,
                explanation: 'Саме Лис відкрив цю секретну мудрість Маленькому принцу.'
            },
            {
                question: 'Що робив Король на своїй першій планеті?',
                options: ['Срахував зірки', 'Правив усім і всіма', 'Запалював ліхтарі', 'Малював карти'],
                correctIndex: 1,
                explanation: 'Король вважав, що віддає розумні накази всім у Всесвіті.'
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
    if (event.target.classList.contains('modal-backdrop')) {
        document.getElementById(modalId).classList.remove('active');
        if (modalId === 'parentPinModal') clearPinInputs();
    }
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
document.addEventListener('DOMContentLoaded', () => {
    renderUI();
});

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
        renderKidBookshelf();
        renderKidActiveReading();
        renderKidArchive();
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
    grid.innerHTML = '';

    // Apply View Mode CSS class
    grid.className = `bookshelf-grid view-${state.bookshelf.viewMode}`;

    let childBooks = state.books.filter(b => b.childId === state.activeChildId);

    // 1. Apply Search Query Filter (Title or Author)
    if (state.bookshelf.searchQuery) {
        const q = state.bookshelf.searchQuery;
        childBooks = childBooks.filter(b => 
            b.title.toLowerCase().includes(q) || 
            b.author.toLowerCase().includes(q)
        );
    }

    // 2. Apply Status Filter
    if (state.bookshelf.statusFilter !== 'all') {
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
        emptyBanner.classList.remove('hidden');
        if (state.bookshelf.searchQuery || state.bookshelf.statusFilter !== 'all') {
            emptyText.innerText = 'За вашим запитом або фільтром книг не знайдено.';
        } else {
            emptyText.innerText = 'Додай свою першу книжку, щоб розпочати пригоду та отримати свої перші золоті монети!';
        }
        grid.style.display = 'none';
        return;
    } else {
        emptyBanner.classList.add('hidden');
        grid.style.display = state.bookshelf.viewMode === 'list' ? 'flex' : 'grid';
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
        streak: 1
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

    document.getElementById('calcTargetDays').innerText = rewardCalc.targetDays;
    document.getElementById('calcBaseReward').innerText = rewardCalc.baseReward;
    document.getElementById('calcBonusReward').innerText = rewardCalc.bonusAmount;
    document.getElementById('calcPenaltyReward').innerText = rewardCalc.bonusAmount;
}

function searchGoogleBooks() {
    const q = document.getElementById('searchQuery').value.trim();
    if (!q) return;
    
    document.getElementById('bookTitleInput').value = `Пригоди ${q}`;
    document.getElementById('bookAuthorInput').value = 'Відомий Автор';
    document.getElementById('bookSynopsisInput').value = `Захоплююча історія про ${q}, яка вчить хоробрості та дружбі.`;
    document.getElementById('bookCoverInput').value = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=300&q=80';
    document.getElementById('totalPagesInput').value = '240';
    recalculateParentTier();
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
function updateSliderValue(val) {
    document.getElementById('sliderVal').innerText = val;
}

function adjustPages(delta) {
    const slider = document.getElementById('pageSlider');
    let newVal = parseInt(slider.value) + delta;
    newVal = Math.max(0, Math.min(30, newVal));
    slider.value = newVal;
    updateSliderValue(newVal);
}

function logDailyPages() {
    const pagesRead = parseInt(document.getElementById('pageSlider').value);
    const activeBook = state.books.find(b => b.childId === state.activeChildId && b.status === 'active');
    if (!activeBook) return;

    activeBook.currentPage = Math.min(activeBook.totalPages, activeBook.currentPage + pagesRead);
    if (activeBook.currentPage >= activeBook.totalPages) {
        activeBook.status = 'quiz_pending';
    }

    renderUI();
    alert(`Гарна робота! Збережено +${pagesRead} прочитаних сторінок! 🎉`);
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
