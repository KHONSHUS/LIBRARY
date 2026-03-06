// HOME_SAMPLE.js — reads from SAMPLE_BOOKS, SAMPLE_USERS, SAMPLE_BORROWED, SAMPLE_RETURNED
// defined in HOME_SAMPLE.html. No PHP or database needed.

document.addEventListener("DOMContentLoaded", () => {
    const bookList      = document.getElementById("bookList");
    const searchInput   = document.querySelector(".search-input");
    const sectionSelect = document.querySelector(".section-select");

    const expandedSection        = document.getElementById("expandedBookSection");
    const expandedImg            = document.getElementById("expandedImg");
    const expandedTitle          = document.getElementById("expandedTitle");
    const expandedAuthor         = document.getElementById("expandedAuthor");
    const expandedDetailsContent = document.getElementById("expandedDetailsContent");

    const pageNavigation = document.getElementById("pageNavigation");
    const currentPageNum = document.getElementById("currentPageNum");
    const totalPagesNum  = document.getElementById("totalPagesNum");
    const prevBtn        = document.getElementById("prevBtn");
    const nextBtn        = document.getElementById("nextBtn");

    const BOOKS_PER_PAGE = 30;
    let currentPage      = 1;
    let allBooks         = [];
    let filteredBooks    = [];
    let currentSelectedCard = null;
    let currentSection   = "";

    let userSessionData = {
        isLoggedIn: false,
        controlNo: '',
        fullName: '',
        borrowed: [],
        returned: []
    };

    // ── OTP stored in memory (replaces database/session) ──────────────────────
    let otpStore = {}; // { email: { otp, createdAt, used } }
    let otpCooldownTimer = null;

    // ── Helper: build a book card HTML string ─────────────────────────────────
    function buildBookCard(book) {
        const div = document.createElement('div');
        div.className   = 'book-card';
        div.dataset.id  = book.id;
        div.innerHTML = `
            <div class="book-placeholder">📚</div>
            <p class="book-title">${book.TITLEdtb}</p>
            <p class="book-author" style="display:none;"><strong>Author(s): </strong>${book.AUTHORdtb}</p>
            <div class="book-details" style="display:none;">
                <p><strong>Published Year: </strong>${book.COPYRIGHT_YEARSdtb}</p>
                <p><strong>Publisher: </strong>${book.PUBLISHER_NAMEdtb}</p>
                <p><strong>Section: </strong>${book.SECTIONdtb}</p>
                <p><strong>Type of Material: </strong>${book.TYPE_OF_MATERIALdtb}</p>
                <p><strong>Copies: </strong>${book.COPIESdtb}</p>
                <p><strong>Shelf Location: </strong>${book.CALL_NUMBERdtb}</p>
            </div>`;
        return div;
    }

    // ── Render all books into the grid ────────────────────────────────────────
    function loadBooks() {
        bookList.innerHTML = '';
        SAMPLE_BOOKS.forEach(book => bookList.appendChild(buildBookCard(book)));
        initializePagination();
        setupExpandedView();
    }

    // ── Populate sections dropdown ────────────────────────────────────────────
    function loadSections() {
        const sections = [...new Set(SAMPLE_BOOKS.map(b => b.SECTIONdtb))].sort();
        sectionSelect.innerHTML = '<option value="">All Sections</option>';
        sections.forEach(sec => {
            const opt = document.createElement('option');
            opt.value       = sec;
            opt.textContent = sec;
            sectionSelect.appendChild(opt);
        });
    }

    // ── Carousel (Most Borrowed) ──────────────────────────────────────────────
    const carouselTrack       = document.getElementById('carouselTrack');
    const carouselPrev        = document.getElementById('carouselPrev');
    const carouselNext        = document.getElementById('carouselNext');
    const mostBorrowedSection = document.getElementById('mostBorrowedSection');

    let mbRealTotal   = 0;
    let mbIndex       = 0;
    let mbIsAnimating = false;

    function getMbStep() {
        const firstCard = carouselTrack.querySelector('.book-card');
        if (!firstCard) return 280;
        const gap = parseFloat(window.getComputedStyle(carouselTrack).gap) || 80;
        return firstCard.offsetWidth + gap;
    }

    function loadCarousel() {
        // Count borrows per book title
        const counts = {};
        SAMPLE_BORROWED.forEach(b => { counts[b.BOOKNAMEdtb] = (counts[b.BOOKNAMEdtb] || 0) + 1; });
        const topTitles = Object.entries(counts).sort((a,b) => b[1]-a[1]).slice(0,10).map(e => e[0]);
        const topBooks  = topTitles.map(t => SAMPLE_BOOKS.find(b => b.TITLEdtb === t)).filter(Boolean);

        if (topBooks.length === 0) { mostBorrowedSection.style.display = 'none'; return; }

        mbRealTotal = topBooks.length;
        const allNodes = [
            ...topBooks.map(b => buildBookCard(b)),
            ...topBooks.map(b => buildBookCard(b)),
            ...topBooks.map(b => buildBookCard(b))
        ];

        carouselTrack.innerHTML = '';
        allNodes.forEach(card => carouselTrack.appendChild(card));

        mbIndex = mbRealTotal;
        carouselTrack.style.transition = 'none';
        carouselTrack.style.transform  = `translateX(-${mbIndex * getMbStep()}px)`;

        carouselTrack.addEventListener('click', e => {
            const card = e.target.closest('.book-card');
            if (card) openExpandedPanel(card);
        });
    }

    carouselTrack.addEventListener('transitionend', () => {
        mbIsAnimating = false;
        const step = getMbStep();
        if (mbIndex >= mbRealTotal * 2) {
            mbIndex -= mbRealTotal;
            carouselTrack.style.transition = 'none';
            carouselTrack.style.transform  = `translateX(-${mbIndex * step}px)`;
        }
        if (mbIndex < mbRealTotal) {
            mbIndex += mbRealTotal;
            carouselTrack.style.transition = 'none';
            carouselTrack.style.transform  = `translateX(-${mbIndex * step}px)`;
        }
    });

    carouselNext.addEventListener('click', () => {
        if (mbIsAnimating || mbRealTotal === 0) return;
        mbIsAnimating = true; mbIndex++;
        carouselTrack.style.transition = 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)';
        carouselTrack.style.transform  = `translateX(-${mbIndex * getMbStep()}px)`;
    });

    carouselPrev.addEventListener('click', () => {
        if (mbIsAnimating || mbRealTotal === 0) return;
        mbIsAnimating = true; mbIndex--;
        carouselTrack.style.transition = 'transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)';
        carouselTrack.style.transform  = `translateX(-${mbIndex * getMbStep()}px)`;
    });

    // ── Expanded panel ────────────────────────────────────────────────────────
    function openExpandedPanel(card) {
        const bookId    = card.dataset.id;
        const titleEl   = card.querySelector('.book-title');
        const authorEl  = card.querySelector('.book-author');
        const detailsEl = card.querySelector('.book-details');

        const title  = titleEl  ? titleEl.textContent.trim()  : '';
        const author = authorEl ? authorEl.textContent.trim()  : '';

        let detailsHTML = '';
        if (detailsEl) {
            const clone = detailsEl.cloneNode(true);
            clone.removeAttribute('style');
            clone.querySelectorAll('[style]').forEach(el => el.removeAttribute('style'));
            detailsHTML = clone.innerHTML;
        }

        const existingPlaceholder = document.getElementById('expandedPlaceholder');
        if (existingPlaceholder) existingPlaceholder.remove();
        expandedImg.style.display = 'none';

        const placeholder     = document.createElement('div');
        placeholder.id        = 'expandedPlaceholder';
        placeholder.className = 'expanded-placeholder';
        placeholder.textContent = '📚';
        expandedImg.parentNode.insertBefore(placeholder, expandedImg);

        if (currentSelectedCard) currentSelectedCard.classList.remove('selected');
        card.classList.add('selected');
        currentSelectedCard = card;

        expandedTitle.textContent        = title;
        expandedAuthor.textContent       = author;
        expandedDetailsContent.innerHTML = detailsHTML;

        const seeMoreBtn = document.createElement('button');
        seeMoreBtn.className   = 'see-more-btn';
        seeMoreBtn.textContent = 'See More';
        seeMoreBtn.dataset.bookId = bookId;
        expandedDetailsContent.appendChild(seeMoreBtn);

        expandedSection.style.display = 'block';
        setTimeout(() => expandedSection.scrollIntoView({ behavior:'smooth', block:'start' }), 100);
    }

    // ── See More (Full Details modal) ─────────────────────────────────────────
    document.addEventListener('click', e => {
        if (e.target && e.target.classList.contains('see-more-btn')) {
            const bookId = parseInt(e.target.dataset.bookId);
            const book   = SAMPLE_BOOKS.find(b => b.id === bookId);
            if (!book) return;

            document.getElementById('fullDetailsTitle').textContent = book.TITLEdtb;
            document.getElementById('fullDetailsBody').innerHTML = `
                <div class="detail-item"><label>Title</label><input type="text" value="${book.TITLEdtb}" readonly></div>
                <div class="detail-item"><label>Author(s)</label><input type="text" value="${book.AUTHORdtb}" readonly></div>
                <div class="detail-item"><label>Editor</label><input type="text" value="${book.EDITORdtb}" readonly></div>
                <div class="detail-item"><label>Edition</label><input type="text" value="${book.EDITIONdtb}" readonly></div>
                <div class="detail-item"><label>Place of Publication</label><input type="text" value="${book.PLACE_OF_PUBLICATIONdtb}" readonly></div>
                <div class="detail-item"><label>Publisher Name(s)</label><input type="text" value="${book.PUBLISHER_NAMEdtb}" readonly></div>
                <div class="detail-item"><label>Copyright Year</label><input type="text" value="${book.COPYRIGHT_YEARSdtb}" readonly></div>
                <div class="detail-item"><label>Series</label><input type="text" value="${book.SERIESdtb}" readonly></div>
                <div class="detail-item full-width"><label>Physical Description</label><textarea readonly>${book.PHYSICAL_DESCRIPTIONdtb}</textarea></div>
                <div class="detail-item full-width"><label>Notes</label><textarea readonly>${book.NOTESdtb}</textarea></div>
                <div class="detail-item"><label>ISBN</label><input type="text" value="${book.ISBNdtb}" readonly></div>
                <div class="detail-item"><label>ISSN</label><input type="text" value="${book.ISSNdtb}" readonly></div>
                <div class="detail-item"><label>Section</label><input type="text" value="${book.SECTIONdtb}" readonly></div>
                <div class="detail-item"><label>Subject</label><input type="text" value="${book.SUBJECTdtb}" readonly></div>
                <div class="detail-item"><label>Type of Material</label><input type="text" value="${book.TYPE_OF_MATERIALdtb}" readonly></div>
                <div class="detail-item"><label>Copies</label><input type="text" value="${book.COPIESdtb}" readonly></div>
                <div class="detail-item"><label>Call Number</label><input type="text" value="${book.CALL_NUMBERdtb}" readonly></div>
                <div class="detail-item"><label>Book Barcode ID</label><input type="text" value="${book.BOOK_BARCODEIDdtb}" readonly></div>`;

            document.getElementById('fullDetailsModal').setAttribute('aria-hidden','false');
        }
    });

    const fullDetailsModal  = document.getElementById('fullDetailsModal');
    fullDetailsModal.querySelector('.close').addEventListener('click', e => {
        e.stopPropagation();
        fullDetailsModal.setAttribute('aria-hidden','true');
    });
    fullDetailsModal.addEventListener('click', e => {
        if (e.target === fullDetailsModal) fullDetailsModal.setAttribute('aria-hidden','true');
    });

    // ── Pagination ────────────────────────────────────────────────────────────
    function initializePagination() {
        allBooks      = Array.from(bookList.querySelectorAll('.book-card'));
        filteredBooks = [...allBooks];
        currentPage   = 1;
        displayPage();
    }

    function displayPage() {
        const start = (currentPage - 1) * BOOKS_PER_PAGE;
        const end   = start + BOOKS_PER_PAGE;

        filteredBooks.forEach((card, i) => card.style.display = (i >= start && i < end) ? '' : 'none');
        allBooks.forEach(card => { if (!filteredBooks.includes(card)) card.style.display = 'none'; });

        const totalPages = Math.max(1, Math.ceil(filteredBooks.length / BOOKS_PER_PAGE));
        currentPageNum.textContent = currentPage;
        totalPagesNum.textContent  = totalPages;

        mostBorrowedSection.style.display = currentPage === 1 ? 'block' : 'none';
        updateNavButtons(totalPages);
    }

    function updateNavButtons(totalPages) {
        prevBtn.disabled     = currentPage === 1;
        prevBtn.style.opacity = currentPage === 1 ? '0.3' : '1';
        prevBtn.style.cursor  = currentPage === 1 ? 'not-allowed' : 'pointer';
        nextBtn.disabled     = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.3' : '1';
        nextBtn.style.cursor  = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }

    prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; displayPage(); window.scrollTo({top:0,behavior:'smooth'}); } });
    nextBtn.addEventListener('click', () => { const t = Math.ceil(filteredBooks.length/BOOKS_PER_PAGE); if (currentPage < t) { currentPage++; displayPage(); window.scrollTo({top:0,behavior:'smooth'}); } });

    // ── Filter ────────────────────────────────────────────────────────────────
    function filterBooks() {
        const filter  = searchInput.value.toLowerCase();
        currentSection = sectionSelect.value;

        filteredBooks = allBooks.filter(card => {
            const title  = (card.querySelector('.book-title')?.textContent  || '').toLowerCase();
            const author = (card.querySelector('.book-author')?.textContent || '').toLowerCase();
            let sec = '';
            card.querySelectorAll('.book-details p').forEach(p => {
                if (p.textContent.includes('Section:')) sec = p.textContent.replace('Section:','').trim();
            });
            return (title.includes(filter) || author.includes(filter)) &&
                   (currentSection === '' || sec.toLowerCase() === currentSection.toLowerCase());
        });
        currentPage = 1;
        displayPage();
    }

    searchInput.addEventListener('input', filterBooks);
    sectionSelect.addEventListener('change', filterBooks);

    // ── Setup expanded view click-outside close ───────────────────────────────
    function setupExpandedView() {
        bookList.addEventListener('click', e => {
            const card = e.target.closest('.book-card');
            if (card) openExpandedPanel(card);
        });

        document.addEventListener('click', e => {
            if (expandedSection.style.display === 'block' &&
                !expandedSection.contains(e.target) &&
                !bookList.contains(e.target) &&
                !carouselTrack.contains(e.target)) {
                expandedSection.style.display = 'none';
                const ph = document.getElementById('expandedPlaceholder');
                if (ph) ph.remove();
                expandedImg.style.display = 'block';
                if (currentSelectedCard) { currentSelectedCard.classList.remove('selected'); currentSelectedCard = null; }
            }
        });
    }

    // ── Nav buttons ───────────────────────────────────────────────────────────
    const homeBtn     = document.querySelector('.home-btn');
    const borrowedBtn = document.querySelector('.borrowedreturned-btn');
    const userModal   = document.getElementById('userModal');

    const borrowedTitle = document.getElementById('borrowedTitle');
    const returnedTitle = document.getElementById('returnedTitle');
    const borrowedTable = document.getElementById('borrowedBooksTable');
    const returnedTable = document.getElementById('returnedBooksTable');

    function showHome() {
        homeBtn.classList.add('active');
        borrowedBtn.classList.remove('active');
        userModal.setAttribute('aria-hidden','true');
        bookList.style.display       = 'grid';
        pageNavigation.style.display = 'flex';
        sectionSelect.style.visibility = 'visible';
        mostBorrowedSection.style.display = 'block';
        borrowedTitle.style.display  = 'none';
        returnedTitle.style.display  = 'none';
        borrowedTable.style.display  = 'none';
        returnedTable.style.display  = 'none';
        if (currentSelectedCard) { currentSelectedCard.classList.remove('selected'); currentSelectedCard = null; }
    }

    homeBtn.addEventListener('click', showHome);

    borrowedBtn.addEventListener('click', () => {
        borrowedBtn.classList.add('active');
        homeBtn.classList.remove('active');
        expandedSection.style.display = 'none';
        bookList.style.display        = 'none';
        pageNavigation.style.display  = 'none';
        sectionSelect.style.visibility = 'hidden';
        mostBorrowedSection.style.display = 'none';

        const ph = document.getElementById('expandedPlaceholder');
        if (ph) ph.remove();
        expandedImg.style.display = 'block';
        if (currentSelectedCard) { currentSelectedCard.classList.remove('selected'); currentSelectedCard = null; }

        if (userSessionData.isLoggedIn) {
            displayBorrowedReturnedData();
        } else {
            userModal.setAttribute('aria-hidden','false');
        }
    });

    userModal.querySelector('.close').addEventListener('click', () => {
        userModal.setAttribute('aria-hidden','true');
        if (!userSessionData.isLoggedIn) showHome();
    });

    userModal.addEventListener('click', e => {
        if (e.target === userModal) {
            userModal.setAttribute('aria-hidden','true');
            if (!userSessionData.isLoggedIn) showHome();
        }
    });

    // ── Display borrowed & returned tables ────────────────────────────────────
    function displayBorrowedReturnedData() {
        userModal.setAttribute('aria-hidden','true');
        bookList.style.display        = 'none';
        expandedSection.style.display = 'none';
        pageNavigation.style.display  = 'none';
        borrowedTitle.style.display   = 'block';
        returnedTitle.style.display   = 'block';
        borrowedTable.style.display   = 'table';
        returnedTable.style.display   = 'table';

        const today = new Date().toISOString().split('T')[0];

        const bTbody = borrowedTable.querySelector('tbody');
        bTbody.innerHTML = '';
        if (userSessionData.borrowed.length > 0) {
            userSessionData.borrowed.forEach(row => {
                const isOverdue = row.RETURNDATEdtb && row.RETURNDATEdtb < today;
                bTbody.innerHTML += `<tr>
                    <td>${row.FULLNAMEdtb}</td>
                    <td>${row.BOOKNAMEdtb}</td>
                    <td>${row.SECTIONdtb}</td>
                    <td>${row.BORROWTIMEdtb}</td>
                    <td>${isOverdue ? `<span style="color:red;">${row.RETURNDATEdtb}</span>` : row.RETURNDATEdtb}</td>
                </tr>`;
            });
        } else {
            bTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No borrowed books found</td></tr>';
        }

        const rTbody = returnedTable.querySelector('tbody');
        rTbody.innerHTML = '';
        if (userSessionData.returned.length > 0) {
            userSessionData.returned.forEach(row => {
                rTbody.innerHTML += `<tr>
                    <td>${row.FULLNAMEdtb}</td>
                    <td>${row.BOOKNAMEdtb}</td>
                    <td>${row.SECTIONdtb}</td>
                    <td>${row.BORROWTIMEdtb}</td>
                    <td>${row.RETURNDATEdtb}</td>
                </tr>`;
            });
        } else {
            rTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No returned books found</td></tr>';
        }
    }

    // ── OTP cooldown ──────────────────────────────────────────────────────────
    function startOtpCooldown(seconds) {
        const sendBtn   = document.getElementById('sendBtn');
        const resendBtn = document.querySelector('.otpanother-btn');
        let remaining   = seconds;

        sendBtn.disabled   = true;
        resendBtn.disabled = true;
        sendBtn.textContent   = `Resend in ${remaining}s`;
        resendBtn.textContent = `Resend in ${remaining}s`;

        if (otpCooldownTimer) clearInterval(otpCooldownTimer);
        otpCooldownTimer = setInterval(() => {
            remaining--;
            sendBtn.textContent   = `Resend in ${remaining}s`;
            resendBtn.textContent = `Resend in ${remaining}s`;
            if (remaining <= 0) {
                clearInterval(otpCooldownTimer); otpCooldownTimer = null;
                sendBtn.disabled   = false; resendBtn.disabled = false;
                sendBtn.textContent   = 'Send OTP';
                resendBtn.textContent = 'Send Another OTP';
            }
        }, 1000);
    }

    // ── Send OTP (simulated — shows OTP on screen for demo) ───────────────────
    function sendOtp(email, force) {
        const status = document.getElementById('sendStatus');

        const existing = otpStore[email];
        const now      = Date.now();
        if (existing && !existing.used && (now - existing.createdAt) < 60000 && !force) {
            const remaining = Math.ceil((60000 - (now - existing.createdAt)) / 1000);
            status.style.display = 'block';
            status.textContent   = `Please wait ${remaining} seconds before requesting a new OTP.`;
            startOtpCooldown(remaining);
            document.getElementById('otp-group').style.display   = 'block';
            document.getElementById('resend-group').style.display = 'flex';
            return;
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        otpStore[email] = { otp, createdAt: now, used: false };

        status.style.display = 'block';
        // Show OTP on screen for demo purposes (since no email server on GitHub Pages)
        status.innerHTML = `✅ OTP sent! <strong>(Demo mode: your OTP is <span style="color:#264F46;font-size:1.1em;">${otp}</span>)</strong>`;

        document.getElementById('otp-group').style.display   = 'block';
        document.getElementById('resend-group').style.display = 'flex';
        startOtpCooldown(60);
    }

    document.getElementById('sendBtn').addEventListener('click', e => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value.trim();
        if (!email) { alert('Please enter your email.'); return; }
        sendOtp(email, false);
    });

    document.querySelector('.otpanother-btn').addEventListener('click', e => {
        e.preventDefault();
        const email = document.getElementById('signup-email').value.trim();
        if (!email) { alert('Please enter your email first.'); return; }
        sendOtp(email, true);
    });

    // ── Submit form (verify OTP + user) ──────────────────────────────────────
    const borrowAccessForm = document.getElementById('borrowAccessForm');
    borrowAccessForm.addEventListener('submit', e => {
        e.preventDefault();

        if (!agreeCheck.checked) {
            alert('You must agree to the terms and conditions before submitting.');
            termsModal.setAttribute('aria-hidden','false');
            return;
        }

        const controlNo = document.getElementById('control-no').value.trim();
        const fullName  = document.getElementById('fullname').value.trim();
        const contactNo = document.getElementById('contact-no').value.trim();
        const email     = document.getElementById('signup-email').value.trim();
        const otp       = document.getElementById('otpuser').value.trim();

        if (!controlNo || !fullName || !contactNo || !email || !otp) {
            alert('Please fill in all fields including OTP'); return;
        }
        if (!/^09\d{9}$/.test(contactNo)) {
            alert('Contact number must be 11 digits starting with 09'); return;
        }

        // Verify OTP
        const stored = otpStore[email];
        if (!stored || stored.used) {
            alert('Invalid or expired OTP. Please request a new one.'); return;
        }
        if ((Date.now() - stored.createdAt) > 300000) {
            alert('OTP has expired. Please request a new one.'); return;
        }
        if (stored.otp !== otp) {
            alert('Incorrect OTP. Please try again.'); return;
        }
        otpStore[email].used = true;

        // Verify user
        const user = SAMPLE_USERS.find(u =>
            u.CONTROL_NOdtb.toLowerCase() === controlNo.toLowerCase() &&
            u.FULLNAMEdtb.toLowerCase()   === fullName.toLowerCase()  &&
            (u.CONTACTdtb === contactNo || u.EMAILdtb.toLowerCase() === email.toLowerCase())
        );

        if (!user) {
            alert('User not found or contact/email does not match. Please check your information.');
            return;
        }

        // Get their records
        userSessionData.isLoggedIn = true;
        userSessionData.controlNo  = controlNo;
        userSessionData.fullName   = fullName;
        userSessionData.borrowed   = SAMPLE_BORROWED.filter(b =>
            b.CONTROL_NOdtb.toLowerCase() === controlNo.toLowerCase() &&
            b.FULLNAMEdtb.toLowerCase()   === fullName.toLowerCase()
        );
        userSessionData.returned   = SAMPLE_RETURNED.filter(r =>
            r.CONTROL_NOdtb.toLowerCase() === controlNo.toLowerCase() &&
            r.FULLNAMEdtb.toLowerCase()   === fullName.toLowerCase()
        );

        borrowAccessForm.reset();
        document.getElementById('otp-group').style.display   = 'none';
        document.getElementById('resend-group').style.display = 'none';
        document.getElementById('sendStatus').style.display  = 'none';
        if (otpCooldownTimer) { clearInterval(otpCooldownTimer); otpCooldownTimer = null; }
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = false; sendBtn.textContent = 'Send OTP';
        const resendBtn = document.querySelector('.otpanother-btn');
        resendBtn.disabled = false; resendBtn.textContent = 'Send Another OTP';

        document.getElementById('logoutBtn').style.display = 'block';
        displayBorrowedReturnedData();
        window.scrollTo({top:0,behavior:'smooth'});
    });

    // ── Terms modal ───────────────────────────────────────────────────────────
    const termsModal = document.getElementById('termsModal');
    const agreeCheck = document.getElementById('agreeCheck');

    document.getElementById('openTerms').addEventListener('click', e => {
        e.preventDefault();
        termsModal.setAttribute('aria-hidden','false');
    });
    document.querySelector('.close-terms').addEventListener('click', () => termsModal.setAttribute('aria-hidden','true'));
    document.getElementById('agreeBtn').addEventListener('click', () => {
        termsModal.setAttribute('aria-hidden','true');
        agreeCheck.checked  = true;
        agreeCheck.disabled = false;
    });

    // ── Logout ────────────────────────────────────────────────────────────────
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (!confirm('Are you sure you want to logout?')) return;

        userSessionData = { isLoggedIn:false, controlNo:'', fullName:'', borrowed:[], returned:[] };
        borrowedTitle.style.display = 'none'; returnedTitle.style.display = 'none';
        borrowedTable.style.display = 'none'; returnedTable.style.display = 'none';
        document.getElementById('otp-group').style.display   = 'none';
        document.getElementById('resend-group').style.display = 'none';
        document.getElementById('sendStatus').style.display  = 'none';
        if (otpCooldownTimer) { clearInterval(otpCooldownTimer); otpCooldownTimer = null; }
        const sendBtn = document.getElementById('sendBtn');
        sendBtn.disabled = false; sendBtn.textContent = 'Send OTP';
        const resendBtn = document.querySelector('.otpanother-btn');
        resendBtn.disabled = false; resendBtn.textContent = 'Send Another OTP';

        document.getElementById('logoutBtn').style.display = 'none';
        borrowAccessForm.reset();
        agreeCheck.checked = false; agreeCheck.disabled = true;
        showHome();
        userModal.setAttribute('aria-hidden','false');
    });

    // ── INIT ──────────────────────────────────────────────────────────────────
    loadSections();
    loadBooks();
    loadCarousel();
});
