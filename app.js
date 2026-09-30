import { ThermalPrinter } from './printer.js';

// ==========================================================================
// 1. DATA DEFAULT STRUK (TEMPLATE T-MOBILE DENGAN IMEI)
// ==========================================================================
const DEFAULT_DATA = {
    template: 'tmobile-imei',
    paperWidth: 'w-80',
    currency: '$',
    storeName: 'T MOBILE',
    rocNo: 'ROC no.2025593844m',
    address1: '513 Bishan St. 13,',
    address2: '#01-502 Singapore 570513',
    storePhone: '8376 6999',
    storeEmail: 'atmobile5g@gmail.com',
    billNumber: '0362393',
    date: '02-10-2026',
    time: '14:35',
    cashier: 'AT Mobile',
    items: [
        {
            id: 'item-1',
            name: '14 PRO MAX',
            qty: 1,
            price: 700.00,
            specs: '128GB\nGOLD',
            imeis: ['353843245852278', '353843245588823']
        }
    ],
    total: 700.00,
    totalAmount: 700.00,
    cash: 700.00,
    customerName: '*BELLA',
    customerPhone: '',
    balance: 0.00,
    billId: 'AT-965377',
    footerText: 'Thanks for The Purchase',
    showBarcode: true
};

// Salinan state aktif aplikasi
let receiptData = JSON.parse(JSON.stringify(DEFAULT_DATA));

// Muat dari localStorage jika ada riwayat simpan sebelumnya
try {
    const saved = localStorage.getItem('struk_imei_data_v2');
    if (saved) {
        receiptData = { ...DEFAULT_DATA, ...JSON.parse(saved) };
    }
} catch (e) {
    console.warn("Gagal memuat dari localStorage:", e);
}

// Cek apakah ada data dinamis dari parameter URL: index.html?data=BASE64_JSON
try {
    const urlParams = new URLSearchParams(window.location.search);
    const dataParam = urlParams.get('data');
    if (dataParam) {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(dataParam))));
        receiptData = { ...receiptData, ...decoded };
    }
} catch (e) {
    console.warn("Parameter URL tidak valid:", e);
}

// Simpan otomatis ke localStorage
function saveToStorage() {
    try {
        localStorage.setItem('struk_imei_data_v2', JSON.stringify(receiptData));
    } catch (e) {
        console.warn("Gagal menyimpan ke localStorage:", e);
    }
}

// Helper format angka desimal
function formatCurrency(val) {
    const num = parseFloat(val) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ==========================================================================
// 2. SISTEM TEMPLATE STRUK
// ==========================================================================
const templates = {
    // ------------------------------------------------------------------------
    // Template Utama: T-Mobile Handphone & IMEI
    // ------------------------------------------------------------------------
    'tmobile-imei': (data) => `
        <div class="receipt-content tmobile-receipt">
            <!-- Header Toko -->
            <div class="receipt-header text-center">
                <h1 class="store-title">${escapeHtml(data.storeName)}</h1>
                <p class="store-meta">${escapeHtml(data.rocNo)}</p>
                <p class="store-meta">${escapeHtml(data.address1)}</p>
                <p class="store-meta">${escapeHtml(data.address2)}</p>
                <p class="store-meta">Tel  ${escapeHtml(data.storePhone)}</p>
                <p class="store-meta">Email ${escapeHtml(data.storeEmail)}</p>
            </div>

            <div class="receipt-divider-space"></div>

            <!-- Detail Faktur -->
            <div class="bill-info">
                <div class="flex-between">
                    <span>Bill Number</span>
                    <span class="font-bold">${escapeHtml(data.billNumber)}</span>
                </div>
                <div class="flex-between text-muted" style="margin-top: 3px;">
                    <span>${escapeHtml(data.date)}&nbsp;&nbsp;&nbsp;${escapeHtml(data.time)}</span>
                    <span>${escapeHtml(data.cashier)}</span>
                </div>
            </div>

            <!-- Tabel Header Item -->
            <div class="table-header-row">
                <div class="col-product">Product</div>
                <div class="col-qty">Qty</div>
                <div class="col-total">Total</div>
            </div>

            <!-- Daftar Item & IMEI -->
            <div class="items-list">
                ${data.items.map(item => {
        const itemTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
        const specsArr = item.specs ? item.specs.split('\n').filter(s => s.trim()) : [];
        const imeisArr = item.imeis ? item.imeis.filter(im => im.trim()) : [];

        return `
                        <div class="receipt-item">
                            <div class="item-main-row flex-between">
                                <span class="col-product font-bold">${escapeHtml(item.name)}</span>
                                <span class="col-qty">${item.qty}</span>
                                <span class="col-total font-bold">${escapeHtml(data.currency)}${formatCurrency(itemTotal)}</span>
                            </div>
                            ${specsArr.map(s => `
                                <div class="item-spec">${escapeHtml(s.trim())}</div>
                            `).join('')}
                            ${imeisArr.map(imei => `
                                <div class="item-imei">IMEI : ${escapeHtml(imei.trim())}</div>
                            `).join('')}
                        </div>
                    `;
    }).join('')}
            </div>

            <div class="receipt-divider-dash"></div>

            <!-- Total Row -->
            <div class="flex-between font-bold total-row">
                <span>Total</span>
                <span>${escapeHtml(data.currency)}${formatCurrency(data.total)}</span>
            </div>

            <div class="receipt-divider-dash"></div>

            <!-- Rincian Pembayaran & Pelanggan -->
            <div class="payment-details">
                <div class="flex-between">
                    <span>Total Amount</span>
                    <span class="font-bold">${escapeHtml(data.currency)}${formatCurrency(data.totalAmount)}</span>
                </div>
                <div class="flex-between">
                    <span>Cash</span>
                    <span>${escapeHtml(data.currency)}${formatCurrency(data.cash)}</span>
                </div>
                <div class="flex-between">
                    <span>Customer</span>
                    <span class="font-bold">${escapeHtml(data.customerName)}</span>
                </div>
                <div class="flex-between">
                    <span>Balance</span>
                    <span>${escapeHtml(data.currency)}${formatCurrency(data.balance)}</span>
                </div>
                <div class="flex-between">
                    <span>Bill ID</span>
                    <span class="font-bold">${escapeHtml(data.billId)}</span>
                </div>
            </div>

            <div class="receipt-divider-space"></div>

            <!-- Footer & Barcode -->
            <div class="receipt-footer text-center">
                <p class="footer-msg font-bold">${escapeHtml(data.footerText)}</p>
                ${data.showBarcode ? `
                    <div class="receipt-barcode-wrap">
                        <canvas id="receipt-barcode-canvas" class="barcode-canvas"></canvas>
                    </div>
                ` : ''}
            </div>
        </div>
    `,

    // ------------------------------------------------------------------------
    // Template 2: Struk Retail 80mm
    // ------------------------------------------------------------------------
    'modern-80': (data) => `
        <div class="receipt-content">
            <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 10px;">
                <h1 style="font-size: 18px; font-weight: bold; margin-bottom: 2px;">${escapeHtml(data.storeName)}</h1>
                <p style="font-size: 11px;">${escapeHtml(data.address1)} ${escapeHtml(data.address2)}</p>
                <p style="font-size: 11px;">Tel: ${escapeHtml(data.storePhone)} | ${escapeHtml(data.storeEmail)}</p>
            </div>

            <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 8px;">
                <div>
                    <div><strong>Bill No:</strong> ${escapeHtml(data.billNumber)}</div>
                    <div><strong>Customer:</strong> ${escapeHtml(data.customerName)}</div>
                </div>
                <div style="text-align: right;">
                    <div>${escapeHtml(data.date)} ${escapeHtml(data.time)}</div>
                    <div>Kasir: ${escapeHtml(data.cashier)}</div>
                </div>
            </div>

            <table style="width: 100%; font-size: 11px; border-collapse: collapse; margin-bottom: 8px;">
                <thead>
                    <tr style="border-bottom: 1px solid #000; border-top: 1px solid #000;">
                        <th style="text-align: left; padding: 4px 0;">Item</th>
                        <th style="text-align: center; padding: 4px 0;">Qty</th>
                        <th style="text-align: right; padding: 4px 0;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(item => `
                        <tr style="border-bottom: 1px dotted #ccc;">
                            <td style="padding: 4px 0;">
                                <strong>${escapeHtml(item.name)}</strong>
                                ${item.specs ? `<div style="font-size: 9.5px; color: #444;">${escapeHtml(item.specs.replace(/\n/g, ', '))}</div>` : ''}
                                ${item.imeis && item.imeis.length ? `<div style="font-size: 9.5px;">IMEI: ${escapeHtml(item.imeis.join(', '))}</div>` : ''}
                            </td>
                            <td style="text-align: center; padding: 4px 0;">${item.qty}</td>
                            <td style="text-align: right; padding: 4px 0;">${escapeHtml(data.currency)}${formatCurrency(item.qty * item.price)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div style="border-top: 2px solid #000; padding-top: 6px; font-size: 11.5px; line-height: 1.5;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
                    <span>TOTAL:</span>
                    <span>${escapeHtml(data.currency)}${formatCurrency(data.totalAmount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Cash:</span>
                    <span>${escapeHtml(data.currency)}${formatCurrency(data.cash)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Balance:</span>
                    <span>${escapeHtml(data.currency)}${formatCurrency(data.balance)}</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 12px; font-size: 10.5px; border-top: 1px dashed #000; padding-top: 8px;">
                <p style="font-weight: bold;">${escapeHtml(data.footerText)}</p>
                ${data.showBarcode ? `
                    <div class="receipt-barcode-wrap" style="margin-top: 6px;">
                        <canvas id="receipt-barcode-canvas" class="barcode-canvas"></canvas>
                    </div>
                ` : ''}
            </div>
        </div>
    `,

    // ------------------------------------------------------------------------
    // Template 3: Struk Kasir Standar 58mm
    // ------------------------------------------------------------------------
    'standard-58': (data) => `
        <div class="receipt-content">
            <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 6px; margin-bottom: 6px;">
                <h2 style="font-size: 14px; font-weight: bold; margin-bottom: 2px;">${escapeHtml(data.storeName)}</h2>
                <p style="font-size: 9px;">${escapeHtml(data.address1)}</p>
                <p style="font-size: 9px;">Tel: ${escapeHtml(data.storePhone)}</p>
            </div>

            <div style="font-size: 9.5px; margin-bottom: 6px; line-height: 1.35;">
                <div style="display: flex; justify-content: space-between;">
                    <span>No: ${escapeHtml(data.billNumber)}</span>
                    <span>${escapeHtml(data.date)}</span>
                </div>
                <div>Cust: ${escapeHtml(data.customerName)}</div>
            </div>

            <div style="border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0; margin-bottom: 6px; font-size: 9.5px;">
                ${data.items.map(item => `
                    <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                        <span>${item.qty}x ${escapeHtml(item.name)}</span>
                        <span style="font-weight: bold;">${escapeHtml(data.currency)}${formatCurrency(item.qty * item.price)}</span>
                    </div>
                    ${item.imeis && item.imeis.length ? `
                        <div style="font-size: 8.5px; color: #333; margin-bottom: 2px;">IMEI: ${escapeHtml(item.imeis.join(', '))}</div>
                    ` : ''}
                `).join('')}
            </div>

            <div style="font-size: 10px; line-height: 1.4;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 11px;">
                    <span>TOTAL:</span>
                    <span>${escapeHtml(data.currency)}${formatCurrency(data.totalAmount)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Cash:</span>
                    <span>${escapeHtml(data.currency)}${formatCurrency(data.cash)}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Balance:</span>
                    <span>${escapeHtml(data.currency)}${formatCurrency(data.balance)}</span>
                </div>
            </div>

            <div style="text-align: center; font-size: 9px; border-top: 1px dashed #000; padding-top: 6px; margin-top: 6px;">
                <p>${escapeHtml(data.footerText)}</p>
                ${data.showBarcode ? `
                    <div class="receipt-barcode-wrap" style="margin-top: 4px;">
                        <canvas id="receipt-barcode-canvas" class="barcode-canvas"></canvas>
                    </div>
                ` : ''}
            </div>
        </div>
    `,

    // ------------------------------------------------------------------------
    // Template 4: Kafe / Minimalis
    // ------------------------------------------------------------------------
    'cafe-minimalist': (data) => `
        <div class="receipt-content" style="text-align: center;">
            <p style="font-size: 18px; font-weight: bold; margin-bottom: 2px;">~ ${escapeHtml(data.storeName)} ~</p>
            <p style="font-size: 9px; letter-spacing: 2px; margin-bottom: 10px;">ORDER RECEIPT</p>

            <div style="font-size: 10px; border-bottom: 1px dotted #000; padding-bottom: 6px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Bill: #${escapeHtml(data.billNumber)}</span>
                    <span>${escapeHtml(data.date)} ${escapeHtml(data.time)}</span>
                </div>
                <div style="text-align: left;">Customer: ${escapeHtml(data.customerName)}</div>
            </div>

            <ul style="list-style: none; padding: 0; margin-bottom: 10px;">
                ${data.items.map(item => `
                    <li style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 10.5px;">
                        <span>${item.qty}x ${escapeHtml(item.name)}</span>
                        <span>${escapeHtml(data.currency)}${formatCurrency(item.qty * item.price)}</span>
                    </li>
                `).join('')}
            </ul>

            <div style="border-top: 1px solid #000; padding-top: 6px;">
                <p style="font-size: 12px; font-weight: bold;">Total: ${escapeHtml(data.currency)}${formatCurrency(data.totalAmount)}</p>
                <p style="font-size: 9.5px; margin-top: 8px; font-style: italic;">*** ${escapeHtml(data.footerText)} ***</p>
            </div>
        </div>
    `
};

// Helper sanitasi HTML
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ==========================================================================
// 3. BARCODE GENERATOR (JSBARCODE DENGAN FALLBACK NATIVE CODE39)
// ==========================================================================
function renderBarcode() {
    if (!receiptData.showBarcode) return;
    const canvas = document.getElementById('receipt-barcode-canvas');
    if (!canvas) return;

    const code = receiptData.billId || receiptData.billNumber || '000000';

    try {
        if (typeof JsBarcode === 'function') {
            JsBarcode(canvas, code, {
                format: "CODE128",
                width: receiptData.paperWidth === 'w-58' ? 1.2 : 1.7,
                height: receiptData.paperWidth === 'w-58' ? 32 : 44,
                displayValue: true,
                text: code,
                font: "Space Mono, Courier New, monospace",
                fontSize: receiptData.paperWidth === 'w-58' ? 10 : 11,
                textMargin: 2,
                margin: 2,
                background: "#ffffff",
                lineColor: "#000000"
            });
            return;
        }
    } catch (e) {
        console.warn("JsBarcode gagal, menggunakan fallback native canvas Code39:", e);
    }

    // Fallback Canvas Code 39 Standar
    drawFallbackBarcode(canvas, code);
}

function drawFallbackBarcode(canvas, rawCode) {
    const CODE39_MAP = {
        '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
        '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
        '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
        'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
        'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
        'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
        'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
        'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
        'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
        '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
        '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100'
    };

    const cleanCode = (rawCode || '').toUpperCase().replace(/[^0-9A-Z\-.$/+% ]/g, '');
    const encoded = '*' + cleanCode + '*';
    const ctx = canvas.getContext('2d');
    const isNarrow = receiptData.paperWidth === 'w-58';
    const narrowW = isNarrow ? 1.0 : 1.7;
    const wideW = isNarrow ? 2.4 : 4.0;
    const barH = isNarrow ? 28 : 42;

    let totalWidth = 20;
    for (let i = 0; i < encoded.length; i++) {
        const pattern = CODE39_MAP[encoded[i]] || CODE39_MAP['*'];
        for (let j = 0; j < 9; j++) {
            totalWidth += pattern[j] === '1' ? wideW : narrowW;
        }
        totalWidth += narrowW;
    }

    canvas.width = Math.ceil(totalWidth);
    canvas.height = barH + 18;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';

    let x = 10;
    for (let i = 0; i < encoded.length; i++) {
        const pattern = CODE39_MAP[encoded[i]] || CODE39_MAP['*'];
        for (let j = 0; j < 9; j++) {
            const isBar = (j % 2 === 0);
            const w = pattern[j] === '1' ? wideW : narrowW;
            if (isBar) {
                ctx.fillRect(Math.round(x), 2, Math.round(w), barH);
            }
            x += w;
        }
        x += narrowW;
    }

    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(rawCode, canvas.width / 2, barH + 14);
}

// ==========================================================================
// 4. RENDER PREVIEW STRUK KE LAYAR
// ==========================================================================
const container = document.getElementById('receipt-container');
const templateSelect = document.getElementById('template-select');
const badgePaperSize = document.getElementById('badge-paper-size');

function renderTemplate() {
    const selectedTemplate = receiptData.template || 'tmobile-imei';
    templateSelect.value = selectedTemplate;

    // Sesuaikan lebar kertas: 58mm atau 80mm
    const widthClass = receiptData.paperWidth === 'w-58' ? 'w-58' : 'w-80';
    container.className = `receipt-paper ${widthClass}`;

    if (badgePaperSize) {
        badgePaperSize.textContent = receiptData.paperWidth === 'w-58' ? '58mm Paper' : '80mm Paper';
    }

    // Render HTML template
    const templateRenderer = templates[selectedTemplate] || templates['tmobile-imei'];
    container.innerHTML = templateRenderer(receiptData);

    // Render Barcode
    renderBarcode();

    // Terapkan mode edit langsung jika aktif
    applyInlineEditMode();
}

// ==========================================================================
// 5. BINDING DATA FORMULIR EDITOR
// ==========================================================================
const inputStoreName = document.getElementById('input-store-name');
const inputRocNo = document.getElementById('input-roc-no');
const inputAddress1 = document.getElementById('input-address-1');
const inputAddress2 = document.getElementById('input-address-2');
const inputStoreTel = document.getElementById('input-store-tel');
const inputStoreEmail = document.getElementById('input-store-email');
const inputBillNumber = document.getElementById('input-bill-number');
const inputCashier = document.getElementById('input-cashier');
const inputDate = document.getElementById('input-date');
const inputTime = document.getElementById('input-time');
const inputCurrency = document.getElementById('input-currency');
const inputTotalAmount = document.getElementById('input-total-amount');
const inputCash = document.getElementById('input-cash');
const inputCustomer = document.getElementById('input-customer');
const inputBalance = document.getElementById('input-balance');
const inputBillId = document.getElementById('input-bill-id');
const inputCustomerPhone = document.getElementById('input-customer-phone');
const inputFooterText = document.getElementById('input-footer-text');
const checkShowBarcode = document.getElementById('check-show-barcode');
const checkInlineEdit = document.getElementById('check-inline-edit');
const itemsEditorContainer = document.getElementById('items-editor-container');

// Isi form dari data state
function populateFormFromData() {
    inputStoreName.value = receiptData.storeName || '';
    inputRocNo.value = receiptData.rocNo || '';
    inputAddress1.value = receiptData.address1 || '';
    inputAddress2.value = receiptData.address2 || '';
    inputStoreTel.value = receiptData.storePhone || '';
    inputStoreEmail.value = receiptData.storeEmail || '';
    inputBillNumber.value = receiptData.billNumber || '';
    inputCashier.value = receiptData.cashier || '';
    inputDate.value = receiptData.date || '';
    inputTime.value = receiptData.time || '';
    inputCurrency.value = receiptData.currency || '$';
    inputTotalAmount.value = receiptData.totalAmount !== undefined ? receiptData.totalAmount : 700;
    inputCash.value = receiptData.cash !== undefined ? receiptData.cash : 700;
    inputCustomer.value = receiptData.customerName || '';
    inputBalance.value = receiptData.balance !== undefined ? receiptData.balance : 0;
    inputBillId.value = receiptData.billId || '';
    inputCustomerPhone.value = receiptData.customerPhone || '';
    inputFooterText.value = receiptData.footerText || '';
    checkShowBarcode.checked = !!receiptData.showBarcode;

    // Set tombol lebar kertas
    document.querySelectorAll('#paper-width-switch .seg-btn').forEach(btn => {
        if (btn.dataset.width === receiptData.paperWidth) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderItemsEditor();
}

// Render dynamic items di form
function renderItemsEditor() {
    itemsEditorContainer.innerHTML = '';

    receiptData.items.forEach((item, index) => {
        const itemCard = document.createElement('div');
        itemCard.className = 'item-editor-card';
        itemCard.dataset.index = index;

        itemCard.innerHTML = `
            <div class="item-editor-header">
                <span class="item-badge-num">Produk #${index + 1}</span>
                ${receiptData.items.length > 1 ? `
                    <button type="button" class="btn-remove-item" data-index="${index}" title="Hapus produk ini">
                        Hapus
                    </button>
                ` : ''}
            </div>

            <div class="form-row">
                <div class="form-group col-6">
                    <label>Nama Produk</label>
                    <input type="text" class="item-input-name" value="${escapeHtml(item.name)}" placeholder="Contoh: 14 PRO MAX">
                </div>
                <div class="form-group col-3">
                    <label>Qty</label>
                    <input type="number" class="item-input-qty" min="1" value="${item.qty}" placeholder="1">
                </div>
                <div class="form-group col-3">
                    <label>Harga Satuan</label>
                    <input type="number" step="0.01" class="item-input-price" value="${item.price}" placeholder="700.00">
                </div>
            </div>

            <div class="form-row">
                <div class="form-group col-12">
                    <label>Spesifikasi / Detail (1 baris per keterangan, misal: 128GB, GOLD)</label>
                    <textarea class="item-input-specs" rows="2" placeholder="128GB&#10;GOLD">${escapeHtml(item.specs || '')}</textarea>
                </div>
            </div>

            <!-- Manajer Daftar IMEI -->
            <div class="imei-manager">
                <div class="imei-manager-header">
                    <label>Daftar Nomor IMEI (${(item.imeis || []).length})</label>
                </div>
                <div class="imei-chips-wrap" id="imei-chips-${index}">
                    ${(item.imeis || []).map((imei, imeiIdx) => `
                        <div class="imei-chip">
                            <span>${escapeHtml(imei)}</span>
                            <span class="imei-chip-delete" data-item-idx="${index}" data-imei-idx="${imeiIdx}" title="Hapus IMEI">×</span>
                        </div>
                    `).join('')}
                </div>
                <div class="imei-add-row">
                    <input type="text" class="imei-input-add" placeholder="Ketik IMEI lalu tekan Tambah..." data-item-idx="${index}">
                    <button type="button" class="btn-sm btn-secondary btn-add-imei" data-item-idx="${index}">
                        +
                    </button>
                </div>
            </div>
        `;

        itemsEditorContainer.appendChild(itemCard);
    });

    attachItemEditorEvents();
}

// Pasang listener pada input produk
function attachItemEditorEvents() {
    // 1. Input perubahan nama, qty, harga, specs
    itemsEditorContainer.querySelectorAll('.item-editor-card').forEach(card => {
        const idx = parseInt(card.dataset.index);

        const nameInput = card.querySelector('.item-input-name');
        nameInput.addEventListener('input', (e) => {
            receiptData.items[idx].name = e.target.value;
            saveToStorage();
            renderTemplate();
        });

        const qtyInput = card.querySelector('.item-input-qty');
        qtyInput.addEventListener('input', (e) => {
            receiptData.items[idx].qty = parseInt(e.target.value) || 0;
            recalculateTotals();
            saveToStorage();
            renderTemplate();
        });

        const priceInput = card.querySelector('.item-input-price');
        priceInput.addEventListener('input', (e) => {
            receiptData.items[idx].price = parseFloat(e.target.value) || 0;
            recalculateTotals();
            saveToStorage();
            renderTemplate();
        });

        const specsInput = card.querySelector('.item-input-specs');
        specsInput.addEventListener('input', (e) => {
            receiptData.items[idx].specs = e.target.value;
            saveToStorage();
            renderTemplate();
        });

        // 2. Tombol Hapus Produk
        const removeBtn = card.querySelector('.btn-remove-item');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                receiptData.items.splice(idx, 1);
                recalculateTotals();
                saveToStorage();
                renderItemsEditor();
                renderTemplate();
                showToast("Produk berhasil dihapus");
            });
        }

        // 3. Tambah IMEI
        const imeiInput = card.querySelector('.imei-input-add');
        const imeiAddBtn = card.querySelector('.btn-add-imei');

        const doAddImei = () => {
            const val = imeiInput.value.trim();
            if (!val) return;

            if (!receiptData.items[idx].imeis) {
                receiptData.items[idx].imeis = [];
            }

            // Jika dipisahkan koma atau newline, pecah menjadi beberapa IMEI
            const splitted = val.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
            splitted.forEach(im => receiptData.items[idx].imeis.push(im));

            imeiInput.value = '';
            saveToStorage();
            renderItemsEditor();
            renderTemplate();
            showToast(`${splitted.length} IMEI berhasil ditambahkan`);
        };

        imeiAddBtn.addEventListener('click', doAddImei);
        imeiInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                doAddImei();
            }
        });
    });

    // 4. Hapus chip IMEI individual
    itemsEditorContainer.querySelectorAll('.imei-chip-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const itemIdx = parseInt(btn.dataset.itemIdx);
            const imeiIdx = parseInt(btn.dataset.imeiIdx);
            if (receiptData.items[itemIdx]?.imeis) {
                receiptData.items[itemIdx].imeis.splice(imeiIdx, 1);
                saveToStorage();
                renderItemsEditor();
                renderTemplate();
            }
        });
    });
}

// Hitung total harga otomatis
function recalculateTotals() {
    let subtotal = 0;
    receiptData.items.forEach(item => {
        subtotal += (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
    });

    receiptData.total = subtotal;
    receiptData.totalAmount = subtotal;
    inputTotalAmount.value = subtotal.toFixed(2);

    const cashVal = parseFloat(receiptData.cash) || 0;
    receiptData.balance = Math.max(0, cashVal - subtotal);
    inputBalance.value = receiptData.balance.toFixed(2);
}

// Pasang event listener pada field umum
function initGeneralFormListeners() {
    inputStoreName.addEventListener('input', (e) => { receiptData.storeName = e.target.value; saveToStorage(); renderTemplate(); });
    inputRocNo.addEventListener('input', (e) => { receiptData.rocNo = e.target.value; saveToStorage(); renderTemplate(); });
    inputAddress1.addEventListener('input', (e) => { receiptData.address1 = e.target.value; saveToStorage(); renderTemplate(); });
    inputAddress2.addEventListener('input', (e) => { receiptData.address2 = e.target.value; saveToStorage(); renderTemplate(); });
    inputStoreTel.addEventListener('input', (e) => { receiptData.storePhone = e.target.value; saveToStorage(); renderTemplate(); });
    inputStoreEmail.addEventListener('input', (e) => { receiptData.storeEmail = e.target.value; saveToStorage(); renderTemplate(); });
    inputBillNumber.addEventListener('input', (e) => { receiptData.billNumber = e.target.value; saveToStorage(); renderTemplate(); });
    inputCashier.addEventListener('input', (e) => { receiptData.cashier = e.target.value; saveToStorage(); renderTemplate(); });
    inputDate.addEventListener('input', (e) => { receiptData.date = e.target.value; saveToStorage(); renderTemplate(); });
    inputTime.addEventListener('input', (e) => { receiptData.time = e.target.value; saveToStorage(); renderTemplate(); });
    inputCurrency.addEventListener('change', (e) => { receiptData.currency = e.target.value; saveToStorage(); renderTemplate(); });

    inputTotalAmount.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        receiptData.totalAmount = val;
        receiptData.total = val;
        const cashVal = parseFloat(receiptData.cash) || 0;
        receiptData.balance = Math.max(0, cashVal - val);
        inputBalance.value = receiptData.balance.toFixed(2);
        saveToStorage();
        renderTemplate();
    });

    inputCash.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value) || 0;
        receiptData.cash = val;
        const tot = parseFloat(receiptData.totalAmount) || 0;
        receiptData.balance = Math.max(0, val - tot);
        inputBalance.value = receiptData.balance.toFixed(2);
        saveToStorage();
        renderTemplate();
    });

    inputCustomer.addEventListener('input', (e) => { receiptData.customerName = e.target.value; saveToStorage(); renderTemplate(); });
    inputBalance.addEventListener('input', (e) => { receiptData.balance = parseFloat(e.target.value) || 0; saveToStorage(); renderTemplate(); });
    inputBillId.addEventListener('input', (e) => { receiptData.billId = e.target.value; saveToStorage(); renderTemplate(); });
    inputCustomerPhone.addEventListener('input', (e) => { receiptData.customerPhone = e.target.value; saveToStorage(); });
    inputFooterText.addEventListener('input', (e) => { receiptData.footerText = e.target.value; saveToStorage(); renderTemplate(); });

    checkShowBarcode.addEventListener('change', (e) => {
        receiptData.showBarcode = e.target.checked;
        saveToStorage();
        renderTemplate();
    });

    // Pilihan Template di Toolbar
    templateSelect.addEventListener('change', (e) => {
        receiptData.template = e.target.value;
        saveToStorage();
        renderTemplate();
        showToast(`Template diubah ke ${templateSelect.options[templateSelect.selectedIndex].text}`);
    });

    // Pilihan Lebar Kertas (58mm / 80mm)
    document.querySelectorAll('#paper-width-switch .seg-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#paper-width-switch .seg-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            receiptData.paperWidth = btn.dataset.width;
            saveToStorage();
            renderTemplate();
            showToast(`Ukuran kertas: ${btn.textContent}`);
        });
    });

    // Tombol Tambah Produk Baru
    document.getElementById('btn-add-item').addEventListener('click', () => {
        receiptData.items.push({
            id: 'item-' + Date.now(),
            name: 'NEW PRODUCT',
            qty: 1,
            price: 0,
            specs: '',
            imeis: []
        });
        recalculateTotals();
        saveToStorage();
        renderItemsEditor();
        renderTemplate();
        showToast("Produk baru ditambahkan");
    });

    // Tombol Cepat "Hari ini" & "Sekarang"
    document.getElementById('btn-today').addEventListener('click', () => {
        const today = new Date();
        const d = String(today.getDate()).padStart(2, '0');
        const m = String(today.getMonth() + 1).padStart(2, '0');
        const y = today.getFullYear();
        const formatted = `${d}-${m}-${y}`;
        inputDate.value = formatted;
        receiptData.date = formatted;
        saveToStorage();
        renderTemplate();
    });

    document.getElementById('btn-now').addEventListener('click', () => {
        const today = new Date();
        const h = String(today.getHours()).padStart(2, '0');
        const min = String(today.getMinutes()).padStart(2, '0');
        const formatted = `${h}:${min}`;
        inputTime.value = formatted;
        receiptData.time = formatted;
        saveToStorage();
        renderTemplate();
    });

    // Tombol "Gunakan Data Contoh T-Mobile" & "Reset"
    const resetToTMobile = () => {
        if (confirm("Muat ulang data contoh template T-Mobile? Data inputan Anda saat ini akan digantikan.")) {
            receiptData = JSON.parse(JSON.stringify(DEFAULT_DATA));
            saveToStorage();
            populateFormFromData();
            renderTemplate();
            showToast("Template T-Mobile berhasil dimuat ulang");
        }
    };

    document.getElementById('btn-sample-tmobile').addEventListener('click', resetToTMobile);
    document.getElementById('btn-reset').addEventListener('click', resetToTMobile);

    // Toggle Inline Edit langsung pada struk
    checkInlineEdit.addEventListener('change', () => {
        applyInlineEditMode();
        if (checkInlineEdit.checked) {
            showToast("Mode edit langsung di struk aktif. Klik teks di struk untuk mengedit!");
        }
    });

    // Mobile Tab Switcher
    document.querySelectorAll('.mobile-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const isEditor = tab.dataset.tab === 'editor';
            document.getElementById('editor-pane').classList.toggle('tab-hidden', !isEditor);
            document.getElementById('preview-pane').classList.toggle('tab-hidden', isEditor);
        });
    });
}

// Mode Edit Langsung (contenteditable)
function applyInlineEditMode() {
    const isInline = checkInlineEdit && checkInlineEdit.checked;
    container.classList.toggle('inline-editable-active', isInline);

    // Jadikan elemen teks contenteditable jika aktif
    const editableSelectors = '.store-title, .store-meta, .item-name, .item-spec, .item-imei, .footer-msg';
    container.querySelectorAll(editableSelectors).forEach(el => {
        el.setAttribute('contenteditable', isInline ? 'true' : 'false');
    });
}

// ==========================================================================
// 6. LOGIKA CETAK & DRIVER (PRINTER, PNG, WHATSAPP, COPY TEXT)
// ==========================================================================
const printer = new ThermalPrinter();

// Generator Perintah Native ESC/POS (Super Cepat & Huruf Tajam Bebas Kabur)
function generateESCPosCommands(data, paperWidth = 'w-80') {
    const is58 = paperWidth === 'w-58';
    const maxChars = is58 ? 32 : 48; // Standar Font A printer thermal
    const ESC = 0x1B;
    const GS = 0x1D;

    let bytes = [];

    function pushText(str = '') {
        for (let i = 0; i < str.length; i++) {
            bytes.push(str.charCodeAt(i) & 0xFF);
        }
    }

    function pushLine(str = '') {
        pushText(str);
        bytes.push(0x0A);
    }

    function lineBetween(left, right) {
        const lStr = String(left || '');
        const rStr = String(right || '');
        const spaceCount = Math.max(1, maxChars - lStr.length - rStr.length);
        return lStr + ' '.repeat(spaceCount) + rStr;
    }

    function tableLine(prod, qty, tot) {
        const qStr = String(qty || '1');
        const tStr = String(tot || '');
        if (is58) {
            // 58mm: 17 chars product, 3 chars qty, 10 chars total
            const p = String(prod || '').slice(0, 17).padEnd(17);
            const q = qStr.padStart(3).slice(0, 3);
            const t = tStr.padStart(10).slice(0, 10);
            return p + ' ' + q + ' ' + t;
        } else {
            // 80mm: 28 chars product, 5 chars qty, 13 chars total
            const p = String(prod || '').slice(0, 28).padEnd(28);
            const q = qStr.padStart(5).slice(0, 5);
            const t = tStr.padStart(13).slice(0, 13);
            return p + ' ' + q + ' ' + t;
        }
    }

    // Inisialisasi printer & set Font A standar
    bytes.push(ESC, 0x40); // Reset / Initialize
    bytes.push(ESC, 0x74, 0x00); // Standard Code Page PC437

    // 1. HEADER TOKO (Rata Tengah)
    bytes.push(ESC, 0x61, 0x01); // Center
    bytes.push(ESC, 0x21, 0x10); // Double height font
    bytes.push(ESC, 0x45, 0x01); // Bold ON
    pushLine(data.storeName);
    bytes.push(ESC, 0x21, 0x00); // Normal font
    bytes.push(ESC, 0x45, 0x00); // Bold OFF

    pushLine(data.rocNo);
    pushLine(data.address1);
    pushLine(data.address2);
    pushLine(`Tel  ${data.storePhone}`);
    pushLine(`Email ${data.storeEmail}`);
    pushLine('');

    // 2. DETAIL FAKTUR (Rata Kiri)
    bytes.push(ESC, 0x61, 0x00); // Left align
    pushLine(lineBetween('Bill Number', data.billNumber));
    pushLine(lineBetween(`${data.date}   ${data.time}`, data.cashier));

    // 3. TABEL HEADER
    const dashedLine = '-'.repeat(maxChars);
    pushLine(dashedLine);
    bytes.push(ESC, 0x45, 0x01); // Bold
    pushLine(tableLine('Product', 'Qty', 'Total'));
    bytes.push(ESC, 0x45, 0x00); // Bold OFF
    pushLine(dashedLine);

    // 4. DAFTAR ITEM & IMEI
    data.items.forEach(item => {
        const itemTot = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
        const totStr = `${data.currency}${formatCurrency(itemTot)}`;
        bytes.push(ESC, 0x45, 0x01); // Bold item name
        pushLine(tableLine(item.name, item.qty, totStr));
        bytes.push(ESC, 0x45, 0x00); // Bold OFF

        if (item.specs) {
            item.specs.split('\n').filter(Boolean).forEach(spec => {
                pushLine(`  ${spec.trim()}`);
            });
        }
        if (item.imeis && item.imeis.length) {
            item.imeis.filter(Boolean).forEach(imei => {
                pushLine(`  IMEI : ${imei.trim()}`);
            });
        }
    });

    // 5. TOTAL
    pushLine(dashedLine);
    bytes.push(ESC, 0x45, 0x01); // Bold
    pushLine(lineBetween('Total', `${data.currency}${formatCurrency(data.total)}`));
    bytes.push(ESC, 0x45, 0x00);
    pushLine(dashedLine);

    // 6. RINCIAN PEMBAYARAN & PELANGGAN
    bytes.push(ESC, 0x45, 0x01);
    pushLine(lineBetween('Total Amount', `${data.currency}${formatCurrency(data.totalAmount)}`));
    bytes.push(ESC, 0x45, 0x00);
    pushLine(lineBetween('Cash', `${data.currency}${formatCurrency(data.cash)}`));
    pushLine(lineBetween('Customer', data.customerName));
    pushLine(lineBetween('Balance', `${data.currency}${formatCurrency(data.balance)}`));
    pushLine(lineBetween('Bill ID', data.billId));
    pushLine('');

    // 7. FOOTER
    bytes.push(ESC, 0x61, 0x01); // Center
    bytes.push(ESC, 0x45, 0x01);
    pushLine(data.footerText);
    bytes.push(ESC, 0x45, 0x00);
    pushLine('');

    // 8. BARCODE BATANG (Hardware Code 128 Engine)
    if (data.showBarcode && data.billId) {
        const cleanCode = data.billId.trim();
        bytes.push(GS, 0x68, is58 ? 40 : 48); // Barcode height
        bytes.push(GS, 0x77, is58 ? 2 : 3);   // Barcode width
        bytes.push(GS, 0x48, 0x02);           // Text position below barcode
        bytes.push(GS, 0x66, 0x00);           // Font A for text
        // Code 128 format ESC/POS: GS k 73 [len] '{B' [chars...]
        bytes.push(GS, 0x6B, 0x49, cleanCode.length + 2, 0x7B, 0x42);
        pushText(cleanCode);
        pushLine('');
    }

    // 9. FEED KERTAS & POTONG
    bytes.push(0x0A, 0x0A, 0x0A);
    bytes.push(GS, 0x56, 0x41, 0x00); // Cut paper (jika printer ada cutter)

    return bytes;
}

async function handlePrint() {
    const method = document.getElementById('connection-select').value;
    const densityVal = parseInt(document.getElementById('density-select')?.value) || 200;

    if (method === 'system') {
        // Metode 1: Dialog cetak sistem bawaan browser (stabil di semua OS)
        window.print();
        return;
    }

    // Metode 2 & 3: Direct ESC/POS via USB atau Bluetooth
    try {
        const isBluetooth = method.startsWith('bluetooth');
        const isTextMode = method === 'usb-text' || method === 'bluetooth-text';

        let connected = false;
        if (isBluetooth) {
            showToast("Menghubungkan printer Bluetooth...");
            connected = await printer.connectBluetooth();
        } else {
            showToast("Menghubungkan printer USB...");
            connected = await printer.connectUSB();
        }

        if (!connected) return;

        if (isTextMode) {
            // Mode Teks ESC/POS: Super cepat (0.3s), 100% tajam, font hardware ROM printer
            showToast("Mencetak mode Teks ESC/POS...");
            const commands = generateESCPosCommands(receiptData, receiptData.paperWidth);
            await printer.printCommands(commands);
            showToast("Struk berhasil dicetak");
        } else {
            // Mode Grafik HD: Menggunakan binarization contrast tinggi (density threshold)
            showToast("Memproses grafik HD & mencetak...");
            const is58 = receiptData.paperWidth === 'w-58';
            const targetDotWidth = is58 ? 384 : 576;

            const rawCanvas = await html2canvas(container, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true
            });

            // Rescale tepat ke lebar targetDotWidth agar buffer ESC/POS printer tidak terpotong di tepi kanan!
            const canvas = document.createElement('canvas');
            canvas.width = targetDotWidth;
            const scaleFactor = targetDotWidth / rawCanvas.width;
            canvas.height = Math.round(rawCanvas.height * scaleFactor);

            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(rawCanvas, 0, 0, canvas.width, canvas.height);

            await printer.printImage(canvas, densityVal);
            showToast("Struk grafik HD berhasil dicetak");
        }
    } catch (err) {
        console.error(err);
        alert('Gagal cetak: ' + (err.message || err));
    }
}

// Pasang listener tombol cetak
document.getElementById('btn-print').addEventListener('click', handlePrint);
const quickPrintBtn = document.getElementById('btn-quick-print');
if (quickPrintBtn) quickPrintBtn.addEventListener('click', handlePrint);

// Tombol Simpan Gambar PNG
document.getElementById('btn-save-img').addEventListener('click', async () => {
    try {
        showToast("Membuat gambar...");
        const canvas = await html2canvas(container, {
            scale: 2,
            backgroundColor: '#ffffff',
            useCORS: true
        });

        const a = document.createElement('a');
        const filename = `Struk-${receiptData.billNumber || receiptData.billId || 'POS'}.png`;
        a.download = filename;
        a.href = canvas.toDataURL('image/png');
        a.click();
        showToast(`Gambar ${filename} berhasil diunduh`);
    } catch (e) {
        console.error("Gagal simpan gambar:", e);
        alert("Gagal menyimpan gambar: " + e.message);
    }
});

// Tombol Salin Teks Struk ke Clipboard
document.getElementById('btn-copy-text').addEventListener('click', () => {
    const text = generateTextReceipt(receiptData);
    navigator.clipboard.writeText(text).then(() => {
        showToast("Teks struk berhasil disalin ke clipboard");
    }).catch(() => {
        // Fallback jika permission clipboard dibatasi
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast("Teks struk berhasil disalin");
    });
});

// Format teks struk mentah
function generateTextReceipt(d) {
    const sep = "----------------------------------------";
    let lines = [
        d.storeName,
        d.rocNo,
        d.address1,
        d.address2,
        `Tel  ${d.storePhone}`,
        `Email ${d.storeEmail}`,
        "",
        `Bill Number                    ${d.billNumber}`,
        `${d.date}   ${d.time}    ${d.cashier}`,
        "",
        "Product                Qty         Total",
        sep
    ];

    d.items.forEach(item => {
        const itemTot = (parseFloat(item.qty) || 0) * (parseFloat(item.price) || 0);
        lines.push(`${item.name.padEnd(20)} ${String(item.qty).padEnd(6)} ${d.currency}${formatCurrency(itemTot)}`);
        if (item.specs) {
            item.specs.split('\n').filter(Boolean).forEach(s => lines.push(s.trim()));
        }
        if (item.imeis && item.imeis.length) {
            item.imeis.forEach(im => lines.push(`IMEI : ${im.trim()}`));
        }
    });

    lines.push(sep);
    lines.push(`Total                        ${d.currency}${formatCurrency(d.total)}`);
    lines.push(sep);
    lines.push(`Total Amount                 ${d.currency}${formatCurrency(d.totalAmount)}`);
    lines.push(`Cash                         ${d.currency}${formatCurrency(d.cash)}`);
    lines.push(`Customer          ${d.customerName}`);
    lines.push(`Balance                      ${d.currency}${formatCurrency(d.balance)}`);
    lines.push(`Bill ID           ${d.billId}`);
    lines.push("");
    lines.push(d.footerText);
    lines.push(`[BARCODE BATANG: ${d.billId}]`);

    return lines.join("\n");
}

// Tombol Kirim ke WhatsApp
document.getElementById('btn-wa').addEventListener('click', () => {
    let targetPhone = receiptData.customerPhone || '';
    if (!targetPhone) {
        targetPhone = prompt("Masukkan nomor WhatsApp pelanggan (contoh: 6583766999 atau 08123456789):", "");
        if (!targetPhone) return;
    }

    // Normalisasi awalan nomor
    targetPhone = targetPhone.replace(/[^0-9]/g, '');
    if (targetPhone.startsWith('0')) targetPhone = '62' + targetPhone.slice(1);

    const itemsSummary = receiptData.items.map(i => {
        let txt = `• *${i.name}* (${i.qty}x ${receiptData.currency}${formatCurrency(i.price)}) = *${receiptData.currency}${formatCurrency(i.qty * i.price)}*`;
        if (i.specs) txt += `\n  _${i.specs.replace(/\n/g, ', ')}_`;
        if (i.imeis && i.imeis.length) {
            txt += `\n  IMEI: ${i.imeis.join(', ')}`;
        }
        return txt;
    }).join('\n\n');

    const msg = `*${receiptData.storeName}*\n${receiptData.address1} ${receiptData.address2}\nTel: ${receiptData.storePhone}\n\n*BUKTI PEMBELIAN / STRUK*\nNo. Bill: *${receiptData.billNumber}*\nTanggal: ${receiptData.date} ${receiptData.time}\nKasir: ${receiptData.cashier}\nPelanggan: ${receiptData.customerName}\n\n*Rincian Produk:*\n${itemsSummary}\n\n*Total Tagihan: ${receiptData.currency}${formatCurrency(receiptData.totalAmount)}*\nTunai: ${receiptData.currency}${formatCurrency(receiptData.cash)}\nKembalian: ${receiptData.currency}${formatCurrency(receiptData.balance)}\nBill ID: *${receiptData.billId}*\n\n_${receiptData.footerText}_\nTerima kasih atas kunjungan Anda!`;

    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
});

// Toast notification helper
let toastTimeout;
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2800);
}

// ==========================================================================
// 7. INISIALISASI SAAT HALAMAN DIMUAT
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    populateFormFromData();
    initGeneralFormListeners();
    renderTemplate();
});

// Render awal
populateFormFromData();
initGeneralFormListeners();
renderTemplate();