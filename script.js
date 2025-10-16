// 発送管理システムのメインJavaScript

class ShippingManager {
    constructor() {
        this.orders = this.loadOrders();
        this.currentOrderId = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderShippingList();
        this.setDefaultDate();
    }

    // ローカルストレージからデータを読み込み
    loadOrders() {
        const saved = localStorage.getItem('shippingOrders');
        return saved ? JSON.parse(saved) : [];
    }

    // ローカルストレージにデータを保存
    saveOrders() {
        localStorage.setItem('shippingOrders', JSON.stringify(this.orders));
    }

    // イベントリスナーの設定
    setupEventListeners() {
        // フォーム送信
        document.getElementById('orderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addOrder();
        });

        // 検索機能
        document.getElementById('searchBtn').addEventListener('click', () => {
            this.searchOrders();
        });

        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.searchOrders();
            }
        });

        // ステータスフィルター
        document.getElementById('statusFilter').addEventListener('change', () => {
            this.filterOrders();
        });

        // モーダル関連
        document.querySelector('.close').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('generateLineUrl').addEventListener('click', () => {
            this.generateLineUrl();
        });

        document.getElementById('updateStatus').addEventListener('click', () => {
            this.updateOrderStatus();
        });

        // モーダル外クリックで閉じる
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('detailModal');
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }

    // 今日の日付をデフォルトに設定
    setDefaultDate() {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('shippingDate').value = tomorrow.toISOString().split('T')[0];
    }

    // 新規受注の追加
    addOrder() {
        const formData = new FormData(document.getElementById('orderForm'));
        const orderContent = formData.get('orderContent').trim();
        const orderNumber = formData.get('orderNumber').trim();
        const shippingDate = formData.get('shippingDate');
        const customerName = formData.get('customerName').trim();

        // バリデーション
        if (!orderContent || !orderNumber || !shippingDate || !customerName) {
            this.showMessage('すべての項目を入力してください。', 'error');
            return;
        }

        // 受注番号の重複チェック
        if (this.orders.some(order => order.orderNumber === orderNumber)) {
            this.showMessage('この受注番号は既に登録されています。', 'error');
            return;
        }

        // 管理番号を生成（受注番号 + タイムスタンプ）
        const managementNumber = `${orderNumber}-${Date.now()}`;

        const newOrder = {
            id: Date.now(),
            managementNumber: managementNumber,
            orderContent: orderContent,
            orderNumber: orderNumber,
            shippingDate: shippingDate,
            customerName: customerName,
            status: 'pending',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            notes: '',
            trackingNumber: '',
            actualShippingDate: ''
        };

        this.orders.unshift(newOrder);
        this.saveOrders();
        this.renderShippingList();
        this.clearForm();
        this.showMessage('受注が正常に登録されました。', 'success');
    }

    // フォームをクリア
    clearForm() {
        document.getElementById('orderForm').reset();
        this.setDefaultDate();
    }

    // 発送一覧の表示
    renderShippingList(ordersToShow = null) {
        const orders = ordersToShow || this.orders;
        const container = document.getElementById('shippingList');

        if (orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <h3>発送データがありません</h3>
                    <p>新規受注を登録してください。</p>
                </div>
            `;
            return;
        }

        container.innerHTML = orders.map(order => this.createOrderCard(order)).join('');
    }

    // 受注カードの作成
    createOrderCard(order) {
        const statusText = this.getStatusText(order.status);
        const statusClass = `status-${order.status}`;
        const shippingDate = new Date(order.shippingDate).toLocaleDateString('ja-JP');
        const createdAt = new Date(order.createdAt).toLocaleDateString('ja-JP');

        return `
            <div class="shipping-item" onclick="shippingManager.showOrderDetail(${order.id})">
                <div class="shipping-item-header">
                    <div class="order-number">${order.orderNumber}</div>
                    <div class="status-badge ${statusClass}">${statusText}</div>
                </div>
                <div class="shipping-item-content">
                    <div class="shipping-item-detail">
                        <strong>顧客名:</strong>
                        <span>${order.customerName}</span>
                    </div>
                    <div class="shipping-item-detail">
                        <strong>発送予定日:</strong>
                        <span>${shippingDate}</span>
                    </div>
                    <div class="shipping-item-detail">
                        <strong>受注内容:</strong>
                        <span>${order.orderContent.length > 50 ? order.orderContent.substring(0, 50) + '...' : order.orderContent}</span>
                    </div>
                    <div class="shipping-item-detail">
                        <strong>登録日:</strong>
                        <span>${createdAt}</span>
                    </div>
                </div>
                <div class="shipping-item-actions">
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); shippingManager.showOrderDetail(${order.id})">詳細確認</button>
                    <button class="btn btn-secondary" onclick="event.stopPropagation(); shippingManager.openEditModal(${order.id})">編集</button>
                    <button class="btn btn-warning" onclick="event.stopPropagation(); shippingManager.confirmDelete(${order.id})">削除</button>
                    <button class="btn btn-primary" onclick="event.stopPropagation(); shippingManager.generateLineUrl(${order.id})">LINE通知</button>
                </div>
            </div>
        `;
    }

    // ステータステキストの取得
    getStatusText(status) {
        const statusMap = {
            'pending': '発送待ち',
            'shipped': '発送済み',
            'delivered': '配送完了'
        };
        return statusMap[status] || status;
    }

    // 受注詳細の表示
    showOrderDetail(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        this.currentOrderId = orderId;
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('modalContent');

        const shippingDate = new Date(order.shippingDate).toLocaleDateString('ja-JP');
        const createdAt = new Date(order.createdAt).toLocaleDateString('ja-JP');
        const updatedAt = new Date(order.updatedAt).toLocaleDateString('ja-JP');

        content.innerHTML = `
            <div style="display: grid; gap: 20px;">
                <div>
                    <h3>基本情報</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        <div><strong>受注番号:</strong> ${order.orderNumber}</div>
                        <div><strong>管理番号:</strong> ${order.managementNumber}</div>
                        <div><strong>顧客名:</strong> ${order.customerName}</div>
                        <div><strong>ステータス:</strong> <span class="status-badge status-${order.status}">${this.getStatusText(order.status)}</span></div>
                        <div><strong>発送予定日:</strong> ${shippingDate}</div>
                        <div><strong>登録日:</strong> ${createdAt}</div>
                    </div>
                </div>
                
                <div>
                    <h3>受注内容</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 10px;">
                        ${order.orderContent}
                    </div>
                </div>
                
                <div>
                    <h3>発送情報</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                        <div><strong>追跡番号:</strong> ${order.trackingNumber || '未設定'}</div>
                        <div><strong>実際の発送日:</strong> ${order.actualShippingDate || '未設定'}</div>
                    </div>
                </div>
                
                ${order.notes ? `
                <div>
                    <h3>備考</h3>
                    <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; margin-top: 10px;">
                        ${order.notes}
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        modal.style.display = 'block';
    }

    // モーダルを閉じる
    closeModal() {
        document.getElementById('detailModal').style.display = 'none';
        this.currentOrderId = null;
    }

    // 検索機能
    searchOrders() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
        if (!searchTerm) {
            this.renderShippingList();
            return;
        }

        const filteredOrders = this.orders.filter(order => 
            order.orderNumber.toLowerCase().includes(searchTerm) ||
            order.customerName.toLowerCase().includes(searchTerm) ||
            order.orderContent.toLowerCase().includes(searchTerm)
        );

        this.renderShippingList(filteredOrders);
    }

    // ステータスフィルター
    filterOrders() {
        const status = document.getElementById('statusFilter').value;
        if (status === 'all') {
            this.renderShippingList();
            return;
        }

        const filteredOrders = this.orders.filter(order => order.status === status);
        this.renderShippingList(filteredOrders);
    }

    // LINE通知用URL生成（共有オプション表示）
    generateLineUrl(orderId = null) {
        const order = orderId ? this.orders.find(o => o.id === orderId) : this.orders.find(o => o.id === this.currentOrderId);
        if (!order) return;

        // 絶対URLで詳細リンクを生成（既存ハッシュは置換）
        const urlObj = new URL(window.location.href);
        urlObj.hash = `detail/${order.managementNumber}`;
        const detailUrl = urlObj.toString();

        // 共有メッセージ
        const message = `【発送管理システム】\n受注番号: ${order.orderNumber}\n顧客名: ${order.customerName}\n発送予定日: ${new Date(order.shippingDate).toLocaleDateString('ja-JP')}\n詳細確認: ${detailUrl}`;

        // Web Share API（対応端末でネイティブ共有）
        if (navigator.share) {
            navigator.share({ title: '発送管理', text: message, url: detailUrl })
                .then(() => this.showMessage('共有を開始しました。', 'success'))
                .catch(() => this.showShareOptions(detailUrl, message));
            return;
        }

        // フォールバック: 共有オプションをモーダルで提示
        this.showShareOptions(detailUrl, message);
    }

    // 共有オプションをモーダル表示（LINE Web共有 / コピー / QR）
    showShareOptions(detailUrl, message) {
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('modalContent');

        const lineWebShare = `https://line.me/R/share?text=${encodeURIComponent(message)}`;
        const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(detailUrl)}`;

        content.innerHTML = `
            <div>
                <h3>共有オプション</h3>
                <div style="display: grid; gap: 14px; margin-top: 10px;">
                    <div>
                        <strong>詳細URL:</strong>
                        <div style="background:#f8f9fa; padding:10px; border-radius:6px; word-break: break-all;">${detailUrl}</div>
                    </div>

                    <div style="display:flex; flex-wrap:wrap; gap:10px;">
                        <a class="btn btn-primary" href="${lineWebShare}" target="_blank" rel="noopener">LINE（ブラウザ）で共有</a>
                        <button class="btn btn-secondary" id="copyMessageBtn">メッセージをコピー</button>
                        <button class="btn btn-secondary" id="copyUrlBtn">URLをコピー</button>
                    </div>

                    <div>
                        <strong>スマホで開く（QRコード）</strong>
                        <div style="margin-top:8px;"><img src="${qrApi}" alt="詳細URLのQRコード"></div>
                    </div>

                    <div>
                        <strong>送信メッセージ内容</strong>
                        <div style="background:#f8f9fa; padding:12px; border-radius:6px; white-space: pre-line;">${message}</div>
                    </div>
                </div>
            </div>
        `;

        modal.style.display = 'block';

        // コピー操作
        const copyMessageBtn = document.getElementById('copyMessageBtn');
        const copyUrlBtn = document.getElementById('copyUrlBtn');
        if (copyMessageBtn) {
            copyMessageBtn.onclick = () => this.copyToClipboard(message, 'メッセージをコピーしました。LINEに貼り付けてください。');
        }
        if (copyUrlBtn) {
            copyUrlBtn.onclick = () => this.copyToClipboard(detailUrl, 'URLをコピーしました。LINEやメールに貼り付けてください。');
        }
    }

    // クリップボードコピー共通処理
    copyToClipboard(text, successMsg) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => this.showMessage(successMsg || 'コピーしました。', 'success'))
                .catch(() => this.showUrlInModal(text, text));
        } else {
            this.showUrlInModal(text, text);
        }
    }

    // URLをモーダルで表示（フォールバック）
    showUrlInModal(url, message) {
        const modal = document.getElementById('detailModal');
        const content = document.getElementById('modalContent');
        
        content.innerHTML = `
            <div>
                <h3>LINE通知用URL</h3>
                <p>以下のURLをコピーしてLINEで送信してください：</p>
                <textarea readonly style="width: 100%; height: 100px; margin: 10px 0;">${url}</textarea>
                
                <h4>送信メッセージ内容：</h4>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 6px; white-space: pre-line;">${message}</div>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    // ステータス更新
    updateOrderStatus() {
        if (!this.currentOrderId) return;

        const order = this.orders.find(o => o.id === this.currentOrderId);
        if (!order) return;

        const currentStatus = order.status;
        let newStatus;

        switch (currentStatus) {
            case 'pending':
                newStatus = 'shipped';
                break;
            case 'shipped':
                newStatus = 'delivered';
                break;
            default:
                this.showMessage('これ以上ステータスを更新できません。', 'info');
                return;
        }

        order.status = newStatus;
        order.updatedAt = new Date().toISOString();

        if (newStatus === 'shipped') {
            order.actualShippingDate = new Date().toISOString().split('T')[0];
        }

        this.saveOrders();
        this.renderShippingList();
        this.closeModal();
        this.showMessage(`ステータスを「${this.getStatusText(newStatus)}」に更新しました。`, 'success');
    }

    // メッセージ表示
    showMessage(message, type = 'info') {
        // 既存のメッセージを削除
        const existingMessage = document.querySelector('.message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.textContent = message;

        // フォームの前に挿入
        const form = document.querySelector('.order-form-section');
        form.insertBefore(messageDiv, form.querySelector('h2').nextSibling);

        // 3秒後に自動削除
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 3000);
    }

    // === 編集/削除 機能 ===
    openEditModal(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;

        this.currentOrderId = orderId;

        // フィールドへ反映
        document.getElementById('editOrderContent').value = order.orderContent;
        document.getElementById('editOrderNumber').value = order.orderNumber;
        document.getElementById('editShippingDate').value = order.shippingDate;
        document.getElementById('editCustomerName').value = order.customerName;
        document.getElementById('editTrackingNumber').value = order.trackingNumber || '';
        document.getElementById('editActualShippingDate').value = order.actualShippingDate || '';
        document.getElementById('editNotes').value = order.notes || '';

        // イベントを一度だけバインド
        const saveBtn = document.getElementById('saveEditBtn');
        const deleteBtn = document.getElementById('deleteOrderBtn');
        const editClose = document.getElementById('editClose');
        const editModal = document.getElementById('editModal');
        const editForm = document.getElementById('editForm');

        // 既存ハンドラをリセット
        saveBtn.onclick = null;
        deleteBtn.onclick = null;
        editClose.onclick = null;

        saveBtn.onclick = () => this.saveEdit();
        deleteBtn.onclick = () => this.confirmDelete(orderId);
        editClose.onclick = () => { editModal.style.display = 'none'; };
        editForm.onsubmit = (e) => { e.preventDefault(); this.saveEdit(); };

        // モーダル表示
        editModal.style.display = 'block';
    }

    saveEdit() {
        if (!this.currentOrderId) return;
        const order = this.orders.find(o => o.id === this.currentOrderId);
        if (!order) return;

        const newOrderContent = document.getElementById('editOrderContent').value.trim();
        const newOrderNumber = document.getElementById('editOrderNumber').value.trim();
        const newShippingDate = document.getElementById('editShippingDate').value;
        const newCustomerName = document.getElementById('editCustomerName').value.trim();
        const newTrackingNumber = document.getElementById('editTrackingNumber').value.trim();
        const newActualShippingDate = document.getElementById('editActualShippingDate').value;
        const newNotes = document.getElementById('editNotes').value.trim();

        if (!newOrderContent || !newOrderNumber || !newShippingDate || !newCustomerName) {
            this.showMessage('必須項目をすべて入力してください。', 'error');
            return;
        }

        // 受注番号の重複チェック（自分以外）
        if (this.orders.some(o => o.orderNumber === newOrderNumber && o.id !== order.id)) {
            this.showMessage('この受注番号は他の受注で使用されています。', 'error');
            return;
        }

        // 反映
        order.orderContent = newOrderContent;
        order.orderNumber = newOrderNumber;
        order.shippingDate = newShippingDate;
        order.customerName = newCustomerName;
        order.trackingNumber = newTrackingNumber;
        order.actualShippingDate = newActualShippingDate;
        order.notes = newNotes;
        order.updatedAt = new Date().toISOString();

        this.saveOrders();
        this.renderShippingList();
        document.getElementById('editModal').style.display = 'none';
        this.showMessage('受注内容を更新しました。', 'success');
    }

    confirmDelete(orderId) {
        const order = this.orders.find(o => o.id === orderId);
        if (!order) return;
        const ok = window.confirm(`受注番号「${order.orderNumber}」を削除しますか？`);
        if (!ok) return;
        this.deleteOrder(orderId);
    }

    deleteOrder(orderId) {
        const before = this.orders.length;
        this.orders = this.orders.filter(o => o.id !== orderId);
        const after = this.orders.length;
        if (after < before) {
            this.saveOrders();
            this.renderShippingList();
            this.closeModal();
            document.getElementById('editModal').style.display = 'none';
            this.showMessage('受注を削除しました。', 'success');
        } else {
            this.showMessage('削除に失敗しました。', 'error');
        }
    }
    }

// ページ読み込み時に初期化
document.addEventListener('DOMContentLoaded', () => {
    window.shippingManager = new ShippingManager();
});

// URLハッシュから詳細ページを表示する機能
window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash.startsWith('#detail/')) {
        const managementNumber = hash.replace('#detail/', '');
        const order = window.shippingManager.orders.find(o => o.managementNumber === managementNumber);
        if (order) {
            window.shippingManager.showOrderDetail(order.id);
        }
    }
});

// ページ読み込み時にハッシュをチェック
window.addEventListener('load', () => {
    const hash = window.location.hash;
    if (hash.startsWith('#detail/')) {
        const managementNumber = hash.replace('#detail/', '');
        const order = window.shippingManager.orders.find(o => o.managementNumber === managementNumber);
        if (order) {
            window.shippingManager.showOrderDetail(order.id);
        }
    }
});
// ここから下の編集系メソッドはクラス定義内にあります
