// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const dashboard = document.getElementById('dashboard');
const customerDashboard = document.getElementById('customerDashboard');
const staffDashboard = document.getElementById('staffDashboard');
const adminDashboard = document.getElementById('adminDashboard');
const navLinks = document.getElementById('navLinks');
const userInfo = document.getElementById('userInfo');
const username = document.getElementById('username');

// API URL
// Use same origin (ngrok URL) when served via tunnel
const API_URL = window.location.origin + '/api';

// Check if user is logged in
const token = localStorage.getItem('token');
if (token) {
    fetchUserProfile();
    document.getElementById('logoutBtn').style.display = 'block';
}

// Event Listeners
document.getElementById('logoutBtn').addEventListener('click', logout);

// Login Form Submit
document.getElementById('login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const feedback = document.getElementById('loginFeedback');
    feedback.textContent = '';
    try {
        const response = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: formData.get('username'),
                password: formData.get('password')
            })
        });

        const data = await response.json();
        if (response.ok) {
            feedback.textContent = '';
            localStorage.setItem('token', data.token);
            showDashboard(data.user);
        } else {
            feedback.textContent = data.message;
        }
    } catch (err) {
        feedback.textContent = 'Sunucu hatası';
    }
});

// Register Form Submit
document.getElementById('register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');

    // Frontend validasyonu
    let validationErrors = [];

    if (!username || username.trim() === '') {
        validationErrors.push('Kullanıcı adı boş olamaz');
    } else if (username.length < 3) {
        validationErrors.push('Kullanıcı adı en az 3 karakter olmalıdır');
    } else if (!/^[a-zA-Z0-9]+$/.test(username)) {
        validationErrors.push('Kullanıcı adı sadece harf ve rakam içermelidir');
    }

    if (!password || password.trim() === '') {
        validationErrors.push('Şifre boş olamaz');
    } else if (password.length < 5) {
        validationErrors.push('Şifre en az 5 karakter olmalıdır');
    }

    if (validationErrors.length > 0) {
        showDetailedError('Kayıt Formu Hataları', validationErrors);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                password: password
            })
        });

        const data = await response.json();
        if (response.ok) {
            showSuccess(data.message);
            e.target.reset();
            showForm('login');
        } else {
            // Backend'den gelen hataları işle
            if (data.errors && Array.isArray(data.errors)) {
                showDetailedError('Kayıt Hatası', data.errors);
            } else if (data.message) {
                showDetailedError('Kayıt Hatası', [data.message]);
            } else {
                showDetailedError('Kayıt Hatası', ['Bilinmeyen bir hata oluştu']);
            }
        }
    } catch (err) {
        console.error('Register error:', err);
        showDetailedError('Bağlantı Hatası', ['Sunucuya bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.']);
    }
});

// Add Beer Form Submit (Staff Only)
document.getElementById('addBeerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    try {
        const response = await fetch(`${API_URL}/beers/purchase`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('token')
            },
            body: JSON.stringify({
                customerId: formData.get('customerId'),
                quantity: formData.get('quantity')
            })
        });

        const data = await response.json();
        if (response.ok) {
            showSuccess('Bira başarıyla eklendi');
            e.target.reset();
        } else {
            showError(data.message);
        }
    } catch (err) {
        showError('Server error');
    }
});

// Utility Functions
async function fetchUserProfile() {
    try {
        const response = await fetch(`${API_URL}/users/profile`, {
            headers: {
                'x-auth-token': localStorage.getItem('token')
            }
        });

        const user = await response.json();
        console.log('[fetchUserProfile] API yanıtı:', user);
        if (response.ok) {
            showDashboard(user);
        } else {
            logout();
        }
    } catch (err) {
        logout();
    }
}

let qrRefreshInterval = null;
let pendingOrdersInterval = null;
let pendingUsersInterval = null;
let giftQrRefreshInterval = null;
let showingGiftQr = false;

let qrScanLock = false;

let currentTableCount = 20; // Varsayılan

async function fetchTableCount() {
    try {
        const res = await fetch(`${API_URL}/admin/public/table_count`);
        if (res.ok) {
            const data = await res.json();
            currentTableCount = data.tableCount;
        }
    } catch { }
}

function showDashboard(user) {
    if (!user || !user.username) {
        console.log('[showDashboard] Kullanıcı verisi eksik, gösterim yapılmadı:', user);
        return;
    }
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    dashboard.classList.remove('hidden');
    userInfo.classList.remove('hidden');
    document.getElementById('logoutBtn').style.display = 'block';

    const authContainer = document.getElementById('authContainer');
    if (authContainer) authContainer.style.display = 'none';

    // Önce tüm username alanlarını temizle
    const customerUsernameEl = document.getElementById('customerUsername');
    if (customerUsernameEl) {
        customerUsernameEl.textContent = '';
        console.log('[customerUsername] Temizlendi');
    } else {
        console.log('[customerUsername] Alanı bulunamadı!');
    }
    const staffUsernameEl = document.getElementById('staffUsername');
    if (staffUsernameEl) {
        staffUsernameEl.textContent = '';
        console.log('[staffUsername] Temizlendi');
    } else {
        console.log('[staffUsername] Alanı bulunamadı!');
    }
    const adminUsernameEl = document.getElementById('adminUsername');
    if (adminUsernameEl) {
        adminUsernameEl.textContent = '';
        console.log('[adminUsername] Temizlendi');
    } else {
        console.log('[adminUsername] Alanı bulunamadı!');
    }

    customerDashboard.classList.add('hidden');
    staffDashboard.classList.add('hidden');
    adminDashboard.classList.add('hidden');

    if (user.role === 'customer') {
        customerDashboard.classList.remove('hidden');
        if (customerUsernameEl) {
            customerUsernameEl.textContent = user.username;
            console.log('[customerUsername] Atandı:', user.username);
        } else {
            console.log('[customerUsername] Atanamadı, alan bulunamadı!');
        }
        updateCustomerDashboard();
        showDynamicQRCode(user.username);
        fetchTableCount().then(() => {
            setTableNumberInputLimits();
            setupOrderFormValidation();
        });
    } else if (user.role === 'staff') {
        staffDashboard.classList.remove('hidden');
        if (staffUsernameEl) {
            staffUsernameEl.textContent = user.username;
            console.log('[staffUsername] Atandı:', user.username);
        } else {
            console.log('[staffUsername] Atanamadı, alan bulunamadı!');
        }
        clearDynamicQRCode();
        setupStaffQrReader();
        fetchPendingOrders();
        fetchPendingUsers();
        if (pendingOrdersInterval) clearInterval(pendingOrdersInterval);
        pendingOrdersInterval = setInterval(fetchPendingOrders, 5000);
        if (pendingUsersInterval) clearInterval(pendingUsersInterval);
        pendingUsersInterval = setInterval(fetchPendingUsers, 5000);
    } else if (user.role === 'admin') {
        adminDashboard.classList.remove('hidden');
        if (adminUsernameEl) {
            adminUsernameEl.textContent = user.username;
            console.log('[adminUsername] Atandı:', user.username);
        } else {
            console.log('[adminUsername] Atanamadı, alan bulunamadı!');
        }
        updateAdminDashboard();
        clearDynamicQRCode();
    }
}

function setupStaffQrReader() {
    document.getElementById('qr-reader').innerHTML = '';
    document.getElementById('qrResult').textContent = '';
    if (globalThis.qrScanner) {
        globalThis.qrScanner.clear().catch(() => { });
        globalThis.qrScanner = null;
    }
    qrScanLock = false;
    const startBtn = document.getElementById('startQrBtn');
    if (startBtn) {
        startBtn.onclick = function () {
            if (globalThis.qrScanner) {
                globalThis.qrScanner.clear().catch(() => { });
                globalThis.qrScanner = null;
            }
            qrScanLock = false;
            const qrReader = new Html5Qrcode("qr-reader");
            globalThis.qrScanner = qrReader;
            qrReader.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 200 },
                async qrCodeMessage => {
                    if (qrScanLock) return;
                    qrScanLock = true;
                    document.getElementById('qrResult').textContent = 'QR İçeriği: ' + qrCodeMessage;
                    // Backend'e isteği gönder
                    try {
                        const response = await fetch(`${API_URL}/beers/scan`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'x-auth-token': localStorage.getItem('token')
                            },
                            body: JSON.stringify({ qrData: qrCodeMessage })
                        });
                        const data = await response.json();
                        if (response.ok) {
                            if (data.gift) {
                                showSuccess('Müşteri hediye bira kazandı!');
                            } else {
                                showSuccess('Bira başarıyla eklendi!');
                            }
                        } else {
                            showError(data.message || 'Bira eklenemedi!');
                        }
                    } catch (err) {
                        showError('Sunucuya bağlanılamadı!');
                    }
                    qrReader.stop().then(() => { globalThis.qrScanner = null; });
                },
                errorMessage => {
                    // Hata mesajı gösterme, konsola yaz
                }
            ).catch(err => {
                document.getElementById('qrResult').textContent = 'Kamera başlatılamadı: ' + err;
            });
        };
    }
}

// QR kodu oluşturma helper
function generateDynamicQR(username) {
    const qrContainer = document.getElementById('qrCodeContainer');
    if (!qrContainer) return;
    qrContainer.innerHTML = '';
    const now = new Date();
    const minutes = now.getMinutes();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    const qrData = `${username}|${timeStr}`;
    const qr = new QRious({ value: qrData, size: 180 });
    const img = document.createElement('img');
    img.src = qr.toDataURL();
    img.alt = 'Dinamik QR Kod';
    qrContainer.appendChild(img);
}

function showDynamicQRCode(username) {
    if (qrRefreshInterval) clearInterval(qrRefreshInterval);

    generateDynamicQR(username); // İlk QR kodu hemen oluştur

    qrRefreshInterval = setInterval(() => {
        const now = new Date();
        if (now.getSeconds() === 5) { // Yeni dakikaya geçildikten 5 saniye sonra
            generateDynamicQR(username);
        }
    }, 1000); // Her saniye kontrol et
}



function clearDynamicQRCode() {
    const qrContainer = document.getElementById('qrCodeContainer');
    if (qrContainer) qrContainer.innerHTML = '';
    if (qrRefreshInterval) clearInterval(qrRefreshInterval);
    // Personel panelinde kamera varsa kapat
    if (globalThis.qrScanner) {
        globalThis.qrScanner.clear().catch(() => { });
        globalThis.qrScanner = null;
    }
}

async function updateCustomerDashboard() {
    try {
        const [profileResponse, historyResponse] = await Promise.all([
            fetch(`${API_URL}/users/profile`, {
                headers: { 'x-auth-token': localStorage.getItem('token') }
            }),
            fetch(`${API_URL}/users/beer-history`, {
                headers: { 'x-auth-token': localStorage.getItem('token') }
            })
        ]);

        const profile = await profileResponse.json();
        const history = await historyResponse.json();

        document.getElementById('beerCount').textContent = profile.beer_count;
        document.getElementById('freeBeerCount').textContent = profile.free_beers;

        const historyList = document.getElementById('beerHistoryList');
        historyList.innerHTML = history.map(purchase => `
            <div class="bg-gray-50 p-2 rounded">
                ${purchase.quantity} bira - ${new Date(purchase.purchase_date).toLocaleDateString()}
            </div>
        `).join('');

        // Gift Section
        const giftSection = document.getElementById('giftSection');
        if (profile.free_beers > 0) giftSection.classList.remove('hidden'); else giftSection.classList.add('hidden');

        // Hediye butonu ve QR kod kontrolü
        const giftBtn = document.getElementById('giftBeerBtn');
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        const giftQrCodeContainer = document.getElementById('giftQrCodeContainer');
        if (profile.beer_count === 10 && !showingGiftQr) {
            giftBtn.classList.remove('hidden');
            qrCodeContainer.style.display = 'none';
            giftQrCodeContainer.innerHTML = '';
        } else if (profile.beer_count === 11 && showingGiftQr) {
            // Hediye QR kodu okutuldu, sayaç sıfırlanacak, arayüz sıfırlansın
            showingGiftQr = false;
            clearGiftQRCode();
            giftBtn.classList.add('hidden');
            qrCodeContainer.style.display = '';
            showDynamicQRCode(profile.username);
        } else {
            giftBtn.classList.add('hidden');
            qrCodeContainer.style.display = '';
            giftQrCodeContainer.innerHTML = '';
            showingGiftQr = false;
            clearGiftQRCode();
            showDynamicQRCode(profile.username);
        }
    } catch (err) {
        // showError('Veriler yüklenirken hata oluştu');
    }
}

async function handleGiftUse() {
    const giftSection = document.getElementById('giftSection');
    const tableNumber = prompt('Masa numarasını girin:');
    if (!tableNumber) return;
    try {
        const res = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': localStorage.getItem('token') },
            body: JSON.stringify({ tableNumber, quantity: 1, gift: true })
        });
        const data = await res.json();
        if (res.ok) {
            showSuccess('Hediye sipariş gönderildi');
            giftSection.classList.add('hidden');
        } else {
            showError(data.message);
        }
    } catch {
        showError('Sunucu hatası');
    }
}

const useGiftBtn = document.getElementById('useGiftBtn');
if (useGiftBtn) useGiftBtn.onclick = handleGiftUse;

const giftBeerBtn = document.getElementById('giftBeerBtn');
if (giftBeerBtn) {
    giftBeerBtn.addEventListener('click', async function () {
        const qrCodeContainer = document.getElementById('qrCodeContainer');
        const giftQrCodeContainer = document.getElementById('giftQrCodeContainer');
        // Kullanıcı profilinden e-posta adresini çek
        let username = '';
        try {
            const profileResponse = await fetch(`${API_URL}/users/profile`, {
                headers: { 'x-auth-token': localStorage.getItem('token') }
            });
            const profile = await profileResponse.json();
            username = profile.username;
        } catch {
            username = username.textContent; // fallback
        }
        showingGiftQr = true;
        this.classList.add('hidden');
        qrCodeContainer.style.display = 'none';
        showGiftQRCode(username);
    });
}

function showGiftQRCode(username) {
    const giftQrCodeContainer = document.getElementById('giftQrCodeContainer');
    giftQrCodeContainer.innerHTML = '';
    function generateGiftQR() {
        giftQrCodeContainer.innerHTML = '';
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const qrData = `${username}|hediye|${timeStr}`;
        const qr = new QRious({
            value: qrData,
            size: 180
        });
        const img = document.createElement('img');
        img.src = qr.toDataURL();
        img.alt = 'Hediye QR Kod';
        giftQrCodeContainer.appendChild(img);
    }
    generateGiftQR();
    if (giftQrRefreshInterval) clearInterval(giftQrRefreshInterval);
    giftQrRefreshInterval = setInterval(generateGiftQR, 60000);
}

function clearGiftQRCode() {
    const giftQrCodeContainer = document.getElementById('giftQrCodeContainer');
    if (giftQrCodeContainer) giftQrCodeContainer.innerHTML = '';
    if (giftQrRefreshInterval) clearInterval(giftQrRefreshInterval);
}

function logout() {
    // Clear intervals
    if (pendingOrdersInterval) clearInterval(pendingOrdersInterval);
    if (pendingUsersInterval) clearInterval(pendingUsersInterval);
    if (giftQrRefreshInterval) clearInterval(giftQrRefreshInterval);
    if (qrRefreshInterval) clearInterval(qrRefreshInterval);
    localStorage.removeItem('token');
    showForm('login');
}

// Admin paneli satın alım geçmişi için sayfalama
let allPurchases = [];
let purchasesShown = 0;
const PURCHASES_PAGE_SIZE = 7;

// Admin paneli kullanıcı yönetimi için sayfalama
let allUsers = [];
let usersShown = 0;
const USERS_PAGE_SIZE = 7;

let userSearchQuery = '';

document.getElementById('userSearchInput').addEventListener('input', function (e) {
    userSearchQuery = e.target.value.trim().toLowerCase();
    usersShown = USERS_PAGE_SIZE; // Arama yapınca ilk sayfa kadar göster
    renderUsersPage();
});

async function updateAdminDashboard() {
    try {
        const [statsResponse, usersResponse, purchasesResponse] = await Promise.all([
            fetch(`${API_URL}/beers/stats`, {
                headers: { 'x-auth-token': localStorage.getItem('token') }
            }),
            fetch(`${API_URL}/admin/users`, {
                headers: { 'x-auth-token': localStorage.getItem('token') }
            }),
            fetch(`${API_URL}/admin/purchases`, {
                headers: { 'x-auth-token': localStorage.getItem('token') }
            })
        ]);

        const stats = await statsResponse.json();
        const users = await usersResponse.json();
        const purchases = await purchasesResponse.json();

        // İstatistikleri güncelle
        document.getElementById('beersSoldToday').textContent = stats.beersSoldToday;
        document.getElementById('totalBeersSold').textContent = stats.totalBeersSold;

        // Kullanıcı yönetimi için sayfalama başlat
        allUsers = users;
        usersShown = 0;
        renderUsersPage();

        // Satın alım geçmişi için sayfalama başlat
        allPurchases = purchases;
        purchasesShown = 0;
        renderPurchasesPage();

        // Load and display current campaign threshold
        try {
            const thrRes = await fetch(`${API_URL}/admin/settings/campaign_threshold`, {
                headers: { 'x-auth-token': localStorage.getItem('token') }
            });
            if (thrRes.ok) {
                const { threshold } = await thrRes.json();
                document.getElementById('campaignThresholdInput').value = threshold;
            }
        } catch (err) {
            console.error('Threshold load error', err);
        }

        // Update campaign threshold
        document.getElementById('updateCampaignThresholdBtn').onclick = async () => {
            const val = parseInt(document.getElementById('campaignThresholdInput').value, 10);
            const feedbackEl = document.getElementById('thresholdFeedback');
            feedbackEl.textContent = '';
            try {
                const updRes = await fetch(`${API_URL}/admin/settings/campaign_threshold`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': localStorage.getItem('token')
                    },
                    body: JSON.stringify({ threshold: val })
                });
                const data = await updRes.json();
                if (updRes.ok) {
                    feedbackEl.textContent = 'Güncellendi: ' + data.threshold;
                } else {
                    feedbackEl.textContent = data.message;
                }
            } catch (err) {
                feedbackEl.textContent = 'Sunucu hatası';
            }
        };

        // --- MASA SAYISI ---
        await fetchTableCount();
        document.getElementById('tableCountInput').value = currentTableCount;
        document.getElementById('updateTableCountBtn').onclick = async () => {
            const val = parseInt(document.getElementById('tableCountInput').value, 10);
            const feedbackEl = document.getElementById('tableCountFeedback');
            feedbackEl.textContent = '';
            if (isNaN(val) || val < 1) {
                feedbackEl.textContent = 'Geçersiz masa sayısı';
                return;
            }
            try {
                const updRes = await fetch(`${API_URL}/admin/settings/table_count`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': localStorage.getItem('token')
                    },
                    body: JSON.stringify({ tableCount: val })
                });
                const data = await updRes.json();
                if (updRes.ok) {
                    feedbackEl.textContent = 'Güncellendi: ' + data.tableCount;
                    currentTableCount = data.tableCount;
                } else {
                    feedbackEl.textContent = data.message;
                }
            } catch (err) {
                feedbackEl.textContent = 'Sunucu hatası';
            }
        };
    } catch (err) {
        // showError('Veriler yüklenirken hata oluştu');
    }
}

function sortUsersHierarchically(users) {
    // Her rol için kendi içinde en yeni kayıt en üstte olacak şekilde sırala
    const roleOrder = { 'admin': 0, 'staff': 1, 'customer': 2 };
    return users.slice().sort((a, b) => {
        if (roleOrder[a.role] !== roleOrder[b.role]) {
            return roleOrder[a.role] - roleOrder[b.role];
        } else {
            // Kendi rolünde en yeni kayıt en üstte
            return new Date(b.created_at) - new Date(a.created_at);
        }
    });
}

function renderUsersPage() {
    const usersList = document.getElementById('adminUsersList');
    const loadMoreBtn = document.getElementById('loadMoreUsersBtn');
    // Hiyerarşik ve tarihsel sıralama uygula
    let sortedUsers = sortUsersHierarchically(allUsers);

    // Arama varsa, eşleşen kullanıcıyı en üste al
    if (userSearchQuery) {
        const matches = sortedUsers.filter(u => u.username.toLowerCase().includes(userSearchQuery));
        const nonMatches = sortedUsers.filter(u => !u.username.toLowerCase().includes(userSearchQuery));
        sortedUsers = [...matches, ...nonMatches];
    }
    const end = usersShown + USERS_PAGE_SIZE;
    const toShow = sortedUsers.slice(0, end);
    usersList.innerHTML = toShow.map(user => renderUserBox(user)).join('');
    usersShown = toShow.length;
    if (sortedUsers.length > usersShown) {
        loadMoreBtn.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.add('hidden');
    }
    attachUserEventListeners();
}

document.getElementById('loadMoreUsersBtn').addEventListener('click', function () {
    usersShown += USERS_PAGE_SIZE;
    renderUsersPage();
});

function renderUserBox(user) {
    return `
        <div class="bg-white p-4 rounded-lg shadow mb-4">
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-bold">${user.username}</p>
                    <p class="text-sm">Rol: ${user.role}</p>
                    ${user.role === 'customer' ? `<p class="text-sm">Bira: ${user.beer_count} | Hediye: ${user.free_beers}</p>` : ''}
                </div>
                <div>
                    <select class="role-select" data-user-id="${user.id}">
                        <option value="customer" ${user.role === 'customer' ? 'selected' : ''}>Müşteri</option>
                        <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Personel</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                    <button class="delete-user bg-red-500 text-white px-3 py-1 rounded" data-user-id="${user.id}">Sil</button>
                </div>
            </div>
        </div>
    `;
}


function attachUserEventListeners() {
    document.querySelectorAll('.role-select').forEach(select => {
        select.addEventListener('change', async (e) => {
            const userId = e.target.dataset.userId;
            const newRole = e.target.value;

            try {
                const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-auth-token': localStorage.getItem('token')
                    },
                    body: JSON.stringify({ role: newRole })
                });

                if (response.ok) {
                    showSuccess('Kullanıcı rolü güncellendi');
                } else {
                    showError('Rol güncellenirken hata oluştu');
                }
            } catch (err) {
                showError('Sunucu hatası');
            }
        });
    });
    document.querySelectorAll('.delete-user').forEach(button => {
        button.addEventListener('click', async (e) => {
            if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
                return;
            }
            const userId = e.target.dataset.userId;

            try {
                const response = await fetch(`${API_URL}/admin/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'x-auth-token': localStorage.getItem('token')
                    }
                });

                if (response.ok) {
                    showSuccess('Kullanıcı silindi');
                    updateAdminDashboard();
                } else {
                    showError('Kullanıcı silinirken hata oluştu');
                }
            } catch (err) {
                showError('Sunucu hatası');
            }
        });
    });
}

function renderPurchasesPage() {
    const purchasesList = document.getElementById('adminPurchasesList');
    const loadMoreBtn = document.getElementById('loadMorePurchasesBtn');
    const end = purchasesShown + PURCHASES_PAGE_SIZE;
    const toShow = allPurchases.slice(0, end);
    purchasesList.innerHTML = toShow.map(purchase => `
        <div class="bg-white p-4 rounded-lg shadow mb-4">
            <p class="font-bold">${purchase.customer_name}</p>
            <p class="text-sm text-gray-500">Tarih: ${new Date(purchase.purchase_date).toLocaleString()}</p>
        </div>
    `).join('');
    purchasesShown = toShow.length;
    if (allPurchases.length > purchasesShown) {
        loadMoreBtn.classList.remove('hidden');
    } else {
        loadMoreBtn.classList.add('hidden');
    }
}

document.getElementById('loadMorePurchasesBtn').addEventListener('click', function () {
    purchasesShown += PURCHASES_PAGE_SIZE;
    renderPurchasesPage();
});

// Event listeners for role updates and user deletion
document.querySelectorAll('.role-select').forEach(select => {
    select.addEventListener('change', async (e) => {
        const userId = e.target.dataset.userId;
        const newRole = e.target.value;

        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}/role`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': localStorage.getItem('token')
                },
                body: JSON.stringify({ role: newRole })
            });

            if (response.ok) {
                showSuccess('Kullanıcı rolü güncellendi');
            } else {
                showError('Rol güncellenirken hata oluştu');
            }
        } catch (err) {
            showError('Sunucu hatası');
        }
    });
});
document.querySelectorAll('.delete-user').forEach(button => {
    button.addEventListener('click', async (e) => {
        if (!confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
            return;
        }
        const userId = e.target.dataset.userId;

        try {
            const response = await fetch(`${API_URL}/admin/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'x-auth-token': localStorage.getItem('token')
                }
            });

            if (response.ok) {
                showSuccess('Kullanıcı silindi');
                updateAdminDashboard();
            } else {
                showError('Kullanıcı silinirken hata oluştu');
            }
        } catch (err) {
            showError('Sunucu hatası');
        }
    });
});

async function fetchUserInfo() {
    try {
        const response = await fetch(`${API_URL}/users/profile`, {
            headers: {
                'x-auth-token': localStorage.getItem('token')
            }
        });

        if (response.ok) {
            const user = await response.json();
            showDashboard(user);
        } else {
            showError('Kullanıcı bilgileri alınamadı.');
        }
    } catch (err) {
        showError('Sunucu hatası.');
    }
}

function showError(message) {
    const popup = document.createElement('div');
    popup.className = 'popup-message popup-error';
    const p = document.createElement('p');
    p.textContent = message;
    const btn = document.createElement('button');
    btn.className = 'popup-btn';
    btn.textContent = 'Tamam';
    btn.addEventListener('click', () => popup.remove());
    popup.appendChild(p);
    popup.appendChild(btn);
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 5000);
}

function showSuccess(message) {
    const popup = document.createElement('div');
    popup.className = 'popup-message popup-success';
    const p = document.createElement('p');
    p.textContent = message;
    const btn = document.createElement('button');
    btn.className = 'popup-btn';
    btn.textContent = 'Tamam';
    btn.addEventListener('click', () => popup.remove());
    popup.appendChild(p);
    popup.appendChild(btn);
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 5000);
}

function showPersistent(message, isSuccess = true, onOk) {
    const popup = document.createElement('div');
    popup.className = isSuccess ? 'popup-message popup-success' : 'popup-message popup-error';
    const p = document.createElement('p');
    p.textContent = message;
    const btn = document.createElement('button');
    btn.className = 'popup-btn';
    btn.textContent = 'Tamam';
    btn.addEventListener('click', () => {
        popup.remove();
        if (typeof onOk === 'function') onOk();
    });
    popup.appendChild(p);
    popup.appendChild(btn);
    document.body.appendChild(popup);
}

// Toggle between login and register views
function showForm(type) {
    // Ensure auth container is visible
    const authContainer = document.getElementById('authContainer');
    if (authContainer) authContainer.style.display = '';
    loginForm.classList.add('hidden');
    registerForm.classList.add('hidden');
    dashboard.classList.add('hidden');
    userInfo.classList.add('hidden');
    if (type === 'login') {
        loginForm.classList.remove('hidden');
    } else {
        registerForm.classList.remove('hidden');
    }
}

document.addEventListener('DOMContentLoaded', function () {
    showForm('login');
    const regLink = document.getElementById('showRegisterLink');
    const logLink = document.getElementById('showLoginLink');
    regLink?.addEventListener('click', e => { e.preventDefault(); showForm('register'); });
    logLink?.addEventListener('click', e => { e.preventDefault(); showForm('login'); });
});

// Uyarı alanı fonksiyonu
function showInlineWarning(id, message) {
    let el = document.getElementById(id);
    if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.className = 'fixed top-4 right-4 bg-yellow-400 text-black p-3 rounded shadow-lg z-50';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.style.display = 'block';
}
function hideInlineWarning(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
}

let ordersErrorCount = 0;
let usersErrorCount = 0;

async function fetchPendingOrders() {
    try {
        const res = await fetch(`${API_URL}/orders/pending`, {
            headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        if (!res.ok) {
            ordersErrorCount++;
            if (ordersErrorCount === 1 || ordersErrorCount % 3 === 0) {
                showInlineWarning('ordersWarning', 'Siparişler alınamadı');
            }
            return;
        }
        hideInlineWarning('ordersWarning');
        ordersErrorCount = 0;
        const orders = await res.json();
        const list = document.getElementById('ordersList');
        list.innerHTML = '';
        // Sipariş yoksa uyarı gösterme, sadece boş bırak
        orders.forEach(o => {
            const li = document.createElement('li');
            li.className = 'flex justify-between items-center bg-gray-100 p-4 rounded-lg shadow mb-2';
            const orderInfo = document.createElement('span');
            orderInfo.textContent = `Masa ${o.table_number} - ${o.username}: ${o.quantity} bira${o.gift ? ' (Hediye Sipariş)' : ''}`;
            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'flex gap-2';
            const approveBtn = document.createElement('button');
            approveBtn.textContent = 'Onayla';
            approveBtn.className = 'bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600';
            approveBtn.dataset.id = o.id;
            approveBtn.addEventListener('click', () => approveOrder(o.id));
            const rejectBtn = document.createElement('button');
            rejectBtn.textContent = 'Reddet';
            rejectBtn.className = 'bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600';
            rejectBtn.dataset.id = o.id;
            rejectBtn.addEventListener('click', () => rejectOrder(o.id));
            buttonContainer.appendChild(approveBtn);
            buttonContainer.appendChild(rejectBtn);
            li.appendChild(orderInfo);
            li.appendChild(buttonContainer);
            list.appendChild(li);
        });
    } catch {
        ordersErrorCount++;
        if (ordersErrorCount === 1 || ordersErrorCount % 3 === 0) {
            showInlineWarning('ordersWarning', 'Siparişler alınamadı');
        }
    }
}

async function fetchPendingUsers() {
    try {
        const res = await fetch(`${API_URL}/auth/pending-users`, { headers: { 'x-auth-token': localStorage.getItem('token') } });
        if (!res.ok) {
            usersErrorCount++;
            if (usersErrorCount === 1 || usersErrorCount % 3 === 0) {
                showInlineWarning('usersWarning', 'Bekleyen kullanıcılar alınamadı');
            }
            return;
        }
        hideInlineWarning('usersWarning');
        usersErrorCount = 0;
        const users = await res.json();
        users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        const list = document.getElementById('pendingUsersList');
        list.innerHTML = '';
        // Kullanıcı yoksa uyarı gösterme, sadece boş bırak
        users.forEach(u => {
            const li = document.createElement('li');
            li.textContent = u.username;
            const approveBtn = document.createElement('button');
            approveBtn.textContent = 'Onayla';
            approveBtn.className = 'approve-user-btn ml-2 text-blue-600 hover:underline';
            approveBtn.dataset.id = u.id;
            approveBtn.addEventListener('click', () => approveUser(u.id));
            const rejectBtn = document.createElement('button');
            rejectBtn.textContent = 'Reddet';
            rejectBtn.className = 'reject-user-btn ml-2 text-red-600 hover:underline';
            rejectBtn.dataset.id = u.id;
            rejectBtn.addEventListener('click', () => rejectUser(u.id));
            li.appendChild(approveBtn);
            li.appendChild(rejectBtn);
            list.appendChild(li);
        });
    } catch {
        usersErrorCount++;
        if (usersErrorCount === 1 || usersErrorCount % 3 === 0) {
            showInlineWarning('usersWarning', 'Bekleyen kullanıcılar alınamadı');
        }
    }
}

// Approve pending user
async function approveUser(id) {
    try {
        const res = await fetch(`${API_URL}/auth/pending-users/${id}/approve`, {
            method: 'POST',
            headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        const data = await res.json();
        if (res.ok) showSuccess('Kullanıcı onaylandı'); else showError(data.message);
        fetchPendingUsers();
    } catch {
        showError('Onaylama hatası');
    }
}

// Reject pending user
async function rejectUser(id) {
    try {
        const res = await fetch(`${API_URL}/auth/pending-users/${id}/reject`, {
            method: 'POST',
            headers: { 'x-auth-token': localStorage.getItem('token') }
        });
        const data = await res.json();
        if (res.ok) showSuccess('Kullanıcı reddedildi'); else showError(data.message);
        fetchPendingUsers();
    } catch {
        showError('Reddetme hatası');
    }
}

// Approve order
async function approveOrder(id) {
    try {
        const res = await fetch(`${API_URL}/orders/${id}/approve`, { method: 'POST', headers: { 'x-auth-token': localStorage.getItem('token') } });
        await res.json();
        fetchPendingOrders();
    } catch {
        fetchPendingOrders();
    }
}

// Reject order handler
async function rejectOrder(id) {
    try {
        const res = await fetch(`${API_URL}/orders/${id}/reject`, { method: 'POST', headers: { 'x-auth-token': localStorage.getItem('token') } });
        await res.json();
        fetchPendingOrders();
    } catch {
        fetchPendingOrders();
    }
}

async function pollOrderStatus(orderId) {
    const intervalId = setInterval(async () => {
        try {
            const res = await fetch(`${API_URL}/orders/${orderId}/status`, {
                headers: { 'x-auth-token': localStorage.getItem('token') }
            });
            const data = await res.json();
            if (res.ok && data.status === 'approved') {
                clearInterval(intervalId);
                showPersistent('Siparişiniz onaylandı', true, () => {
                    updateCustomerDashboard();
                });
            } else if (res.ok && data.status === 'rejected') {
                clearInterval(intervalId);
                showPersistent('Siparişiniz reddedildi', false, () => {
                    updateCustomerDashboard();
                });
            }
        } catch (err) {
            console.error('Polling error:', err);
            clearInterval(intervalId);
        }
    }, 3000);
}

function showDetailedError(title, errors) {
    const popup = document.createElement('div');
    popup.className = 'popup-message popup-error';

    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.style.marginBottom = '1rem';
    titleElement.style.fontWeight = 'bold';
    titleElement.style.color = '#dc2626';

    const errorList = document.createElement('ul');
    errorList.style.listStyle = 'none';
    errorList.style.padding = '0';
    errorList.style.margin = '0 0 1.5rem 0';

    errors.forEach(error => {
        const li = document.createElement('li');
        li.textContent = '• ' + error;
        li.style.marginBottom = '0.5rem';
        li.style.color = '#dc2626';
        li.style.fontSize = '0.9rem';
        errorList.appendChild(li);
    });

    const btn = document.createElement('button');
    btn.className = 'popup-btn';
    btn.textContent = 'Tamam';
    btn.addEventListener('click', () => popup.remove());

    popup.appendChild(titleElement);
    popup.appendChild(errorList);
    popup.appendChild(btn);
    document.body.appendChild(popup);
    setTimeout(() => popup.remove(), 8000);
}

// Sipariş formunda masa numarası inputunu dinamik olarak ayarla ve validasyon ekle
function setTableNumberInputLimits() {
    const tableInput = document.querySelector('input[name="tableNumber"]');
    if (tableInput) {
        tableInput.min = 1;
        tableInput.max = currentTableCount;
    }
}

// Sipariş formu submit işlemini güncelle
function setupOrderFormValidation() {
    const orderForm = document.getElementById('orderForm');
    if (!orderForm) return;
    orderForm.addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        const tableNumber = parseInt(form.tableNumber.value, 10);
        const quantity = form.quantity.value;
        let errors = [];
        if (isNaN(tableNumber) || tableNumber < 1 || tableNumber > currentTableCount) {
            errors.push(`Masa numarası 1 ile ${currentTableCount} arasında olmalıdır.`);
        }
        if (!quantity || isNaN(quantity) || quantity < 1) {
            errors.push('Geçerli bir bira sayısı giriniz.');
        }
        if (errors.length > 0) {
            showDetailedError('Sipariş Hatası', errors);
            return;
        }
        // Siparişi gönder
        try {
            const res = await fetch(`${API_URL}/orders`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': localStorage.getItem('token')
                },
                body: JSON.stringify({ tableNumber, quantity })
            });
            const data = await res.json();
            if (res.ok) {
                showSuccess(data.message || 'Siparişiniz alındı');
                form.reset();
                if (data.orderId) pollOrderStatus(data.orderId);
            } else {
                showError(data.message || 'Sipariş gönderilemedi');
            }
        } catch {
            showError('Sunucu hatası');
        }
    });
}
