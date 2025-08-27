// Index 페이지 스크립트
document.addEventListener('DOMContentLoaded', () => {
    const app = window.CryptoWalletApp;

    // CosmosJS가 로드될 때까지 대기
    const waitForCosmosJS = () => {
        if (app.cosmos) {
            initializePage();
        } else {
            setTimeout(waitForCosmosJS, 100);
        }
    };

    waitForCosmosJS();
});

function initializePage() {
    const app = window.CryptoWalletApp;

    // 이미 지갑이 있으면 메인 페이지로 이동
    if (app.wallet) {
        app.navigateTo('main');
        return;
    }

    // 모달 이벤트
    setupModal();

    // 페이지 로드 완료 표시
    document.body.classList.add('loaded');
}

function setupModal() {
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const confirmBtn =
        document.getElementById('confirmBtn');

    if (!modal) return;

    // 모달 닫기
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeModal();
        });
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeModal();
        });
    }

    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // ESC 키로 모달 닫기
    document.addEventListener('keydown', (e) => {
        if (
            e.key === 'Escape' &&
            modal.style.display === 'block'
        ) {
            closeModal();
        }
    });
}

function closeModal() {
    const modal = document.getElementById('modal');
    const confirmBtn =
        document.getElementById('confirmBtn');

    if (modal) {
        modal.style.display = 'none';
    }

    if (confirmBtn) {
        confirmBtn.onclick = null;
        confirmBtn.style.display = 'block';
    }
}

// HTML에서 호출되는 함수들
function showMnemonicOptions() {
    const modal = document.getElementById('modal');
    const modalTitle =
        document.getElementById('modalTitle');
    const modalContent =
        document.getElementById('modalContent');
    const confirmBtn =
        document.getElementById('confirmBtn');

    modalTitle.textContent = '니모닉 생성 방식 선택';

    modalContent.innerHTML = `
        <div class="mnemonic-options">
            <div class="mnemonic-option" onclick="selectMnemonicOption('mnemonic-12')">
                <div class="option-header">
                    <div class="option-title">12단어 니모닉</div>
                    <div class="option-badge">보안</div>
                </div>
                <div class="option-desc">128비트 보안, 12개의 단어로 구성된 표준 니모닉</div>
            </div>
            
            <div class="mnemonic-option" onclick="selectMnemonicOption('mnemonic-24')">
                <div class="option-header">
                    <div class="option-title">24단어 니모닉</div>
                    <div class="option-badge">고보안</div>
                </div>
                <div class="option-desc">256비트 보안, 24개의 단어로 구성된 고보안 니모닉</div>
            </div>
        </div>
    `;

    confirmBtn.style.display = 'none';
    modal.style.display = 'block';
}

function selectMnemonicOption(type) {
    // 선택 상태 업데이트
    document
        .querySelectorAll('.mnemonic-option')
        .forEach((option) => {
            option.classList.remove('selected');
        });
    event.target
        .closest('.mnemonic-option')
        .classList.add('selected');

    // 지갑 생성 모달 표시
    showCreateWalletModal(type);
}

function showPrivateKeyModal() {
    showCreateWalletModal('private');
}

function showCreateWalletModal(type) {
    const modal = document.getElementById('modal');
    const modalTitle =
        document.getElementById('modalTitle');
    const modalContent =
        document.getElementById('modalContent');
    const confirmBtn =
        document.getElementById('confirmBtn');

    modalTitle.textContent = '지갑 생성';

    // 로딩 상태 표시
    modalContent.innerHTML = `
        <div class="loading-container">
            <div class="loading-spinner"></div>
            <p>지갑을 생성하고 있습니다...</p>
        </div>
    `;

    modal.style.display = 'block';
    confirmBtn.style.display = 'none';

    if (type === 'mnemonic-12' || type === 'mnemonic-24') {
        // 니모닉 생성
        const wordCount = type === 'mnemonic-12' ? 12 : 24;
        const strength = type === 'mnemonic-12' ? 128 : 256;

        try {
            const mnemonic =
                window.CryptoWalletApp.cosmos.generateMnemonic(
                    strength
                );
            const words = mnemonic.split(' ');

            modalContent.innerHTML = `
                <div class="warning-message">
                    <strong>⚠️ 중요!</strong>
                    이 니모닉을 안전한 곳에 백업하세요. 지갑 복구에 필요합니다.
                </div>
                <div class="mnemonic-display">
                    <strong>니모닉 구문 (${wordCount}단어):</strong>
                    <div class="mnemonic-words">
                        ${words
                            .map(
                                (word, index) =>
                                    `<div class="mnemonic-word">${
                                        index + 1
                                    }. ${word}</div>`
                            )
                            .join('')}
                    </div>
                    <button class="copy-btn" onclick="copyMnemonic('${mnemonic}')">
                        <span class="copy-icon">📋</span>
                        전체 복사
                    </button>
                </div>
            `;

            confirmBtn.textContent = '지갑 생성';
            confirmBtn.style.display = 'block';
            confirmBtn.onclick = () =>
                createWalletFromMnemonic(mnemonic);
        } catch (error) {
            modalContent.innerHTML = `
                <div class="error-message">
                    <strong>오류 발생</strong>
                    지갑 생성 중 오류가 발생했습니다: ${error.message}
                </div>
            `;
            confirmBtn.style.display = 'none';
        }
    } else if (type === 'private') {
        // Private Key 생성
        try {
            const mnemonic =
                window.CryptoWalletApp.cosmos.generateMnemonic(
                    128
                );
            window.CryptoWalletApp.cosmos
                .getPrivateKeyFromMnemonic(mnemonic)
                .then((keyInfo) => {
                    modalContent.innerHTML = `
                        <div class="warning-message">
                            <strong>⚠️ 중요!</strong>
                            이 Private Key를 안전한 곳에 백업하세요. 지갑 복구에 필요합니다.
                        </div>
                        <div class="mnemonic-display">
                            <strong>Private Key:</strong>
                            <div class="private-key-display">${keyInfo.privateKey}</div>
                            <button class="copy-btn" onclick="copyPrivateKey('${keyInfo.privateKey}')">
                                <span class="copy-icon">📋</span>
                                복사
                            </button>
                        </div>
                    `;

                    confirmBtn.textContent = '지갑 생성';
                    confirmBtn.style.display = 'block';
                    confirmBtn.onclick = () =>
                        createWalletFromPrivateKey(keyInfo);
                })
                .catch((error) => {
                    modalContent.innerHTML = `
                        <div class="error-message">
                            <strong>오류 발생</strong>
                            Private Key 생성 중 오류가 발생했습니다: ${error.message}
                        </div>
                    `;
                    confirmBtn.style.display = 'none';
                });
        } catch (error) {
            modalContent.innerHTML = `
                <div class="error-message">
                    <strong>오류 발생</strong>
                    Private Key 생성 중 오류가 발생했습니다: ${error.message}
                </div>
            `;
            confirmBtn.style.display = 'none';
        }
    }
}

function showImportWalletModal(type) {
    const modal = document.getElementById('modal');
    const modalTitle =
        document.getElementById('modalTitle');
    const modalContent =
        document.getElementById('modalContent');
    const confirmBtn =
        document.getElementById('confirmBtn');

    modalTitle.textContent = '지갑 불러오기';

    if (type === 'mnemonic') {
        modalContent.innerHTML = `
            <div class="input-group">
                <label for="mnemonicInput">니모닉 구문을 입력하세요:</label>
                <textarea 
                    id="mnemonicInput" 
                    class="textarea-field" 
                    placeholder="단어들을 공백으로 구분하여 입력하세요..."
                    rows="4"
                ></textarea>
                <div class="input-hint">12단어 또는 24단어를 공백으로 구분하여 입력하세요</div>
            </div>
        `;

        confirmBtn.textContent = '지갑 불러오기';
        confirmBtn.style.display = 'block';
        confirmBtn.onclick = () =>
            importWalletFromMnemonic();
    } else if (type === 'private') {
        modalContent.innerHTML = `
            <div class="input-group">
                <label for="privateKeyInput">Private Key를 입력하세요:</label>
                <textarea 
                    id="privateKeyInput" 
                    class="textarea-field" 
                    placeholder="Private Key를 입력하세요..."
                    rows="3"
                ></textarea>
                <div class="input-hint">개인키를 정확히 입력하세요</div>
            </div>
        `;

        confirmBtn.textContent = '지갑 불러오기';
        confirmBtn.style.display = 'block';
        confirmBtn.onclick = () =>
            importWalletFromPrivateKey();
    }

    modal.style.display = 'block';
}

async function createWalletFromMnemonic(mnemonic) {
    const confirmBtn =
        document.getElementById('confirmBtn');

    try {
        // 버튼 비활성화 및 로딩 상태
        confirmBtn.disabled = true;
        confirmBtn.textContent = '생성 중...';

        const keyInfo =
            await window.CryptoWalletApp.cosmos.getPrivateKeyFromMnemonic(
                mnemonic
            );

        const walletData = {
            walletType: 'mnemonic',
            mnemonic: mnemonic,
            privateKey: keyInfo.privateKey,
            address: keyInfo.address,
            createdAt: new Date().toISOString(),
        };

        window.CryptoWalletApp.saveWalletToStorage(
            walletData
        );
        window.CryptoWalletApp.utils.showToast(
            '지갑이 생성되었습니다!'
        );

        setTimeout(() => {
            window.CryptoWalletApp.navigateTo('main');
        }, 1000);
    } catch (error) {
        window.CryptoWalletApp.utils.showToast(
            '지갑 생성에 실패했습니다: ' + error.message
        );
        confirmBtn.disabled = false;
        confirmBtn.textContent = '지갑 생성';
    }
}

async function createWalletFromPrivateKey(keyInfo) {
    const confirmBtn =
        document.getElementById('confirmBtn');

    try {
        // 버튼 비활성화 및 로딩 상태
        confirmBtn.disabled = true;
        confirmBtn.textContent = '생성 중...';

        const walletData = {
            walletType: 'private',
            privateKey: keyInfo.privateKey,
            address: keyInfo.address,
            createdAt: new Date().toISOString(),
        };

        window.CryptoWalletApp.saveWalletToStorage(
            walletData
        );
        window.CryptoWalletApp.utils.showToast(
            '지갑이 생성되었습니다!'
        );

        setTimeout(() => {
            window.CryptoWalletApp.navigateTo('main');
        }, 1000);
    } catch (error) {
        window.CryptoWalletApp.utils.showToast(
            '지갑 생성에 실패했습니다: ' + error.message
        );
        confirmBtn.disabled = false;
        confirmBtn.textContent = '지갑 생성';
    }
}

async function importWalletFromMnemonic() {
    const mnemonicInput =
        document.getElementById('mnemonicInput');
    const confirmBtn =
        document.getElementById('confirmBtn');
    const mnemonic = mnemonicInput.value.trim();

    if (!mnemonic) {
        window.CryptoWalletApp.utils.showToast(
            '니모닉을 입력해주세요.'
        );
        return;
    }

    try {
        // 버튼 비활성화 및 로딩 상태
        confirmBtn.disabled = true;
        confirmBtn.textContent = '불러오는 중...';

        // 니모닉 검증
        if (
            !window.CryptoWalletApp.cosmos.validateMnemonic(
                mnemonic
            )
        ) {
            window.CryptoWalletApp.utils.showToast(
                '유효하지 않은 니모닉입니다.'
            );
            confirmBtn.disabled = false;
            confirmBtn.textContent = '지갑 불러오기';
            return;
        }

        const keyInfo =
            await window.CryptoWalletApp.cosmos.getPrivateKeyFromMnemonic(
                mnemonic
            );

        const walletData = {
            walletType: 'mnemonic',
            mnemonic: mnemonic,
            privateKey: keyInfo.privateKey,
            address: keyInfo.address,
            createdAt: new Date().toISOString(),
        };

        window.CryptoWalletApp.saveWalletToStorage(
            walletData
        );
        window.CryptoWalletApp.utils.showToast(
            '지갑이 불러와졌습니다!'
        );

        setTimeout(() => {
            window.CryptoWalletApp.navigateTo('main');
        }, 1000);
    } catch (error) {
        window.CryptoWalletApp.utils.showToast(
            '지갑 불러오기에 실패했습니다: ' + error.message
        );
        confirmBtn.disabled = false;
        confirmBtn.textContent = '지갑 불러오기';
    }
}

async function importWalletFromPrivateKey() {
    const privateKeyInput = document.getElementById(
        'privateKeyInput'
    );
    const confirmBtn =
        document.getElementById('confirmBtn');
    const privateKey = privateKeyInput.value.trim();

    if (!privateKey) {
        window.CryptoWalletApp.utils.showToast(
            'Private Key를 입력해주세요.'
        );
        return;
    }

    try {
        // 버튼 비활성화 및 로딩 상태
        confirmBtn.disabled = true;
        confirmBtn.textContent = '불러오는 중...';

        const wallet =
            await window.CryptoWalletApp.cosmos.createWalletFromPrivateKey(
                privateKey
            );
        const address =
            await window.CryptoWalletApp.cosmos.getWalletAddress(
                wallet
            );

        const walletData = {
            walletType: 'private',
            privateKey: privateKey,
            address: address,
            createdAt: new Date().toISOString(),
        };

        window.CryptoWalletApp.saveWalletToStorage(
            walletData
        );
        window.CryptoWalletApp.utils.showToast(
            '지갑이 불러와졌습니다!'
        );

        setTimeout(() => {
            window.CryptoWalletApp.navigateTo('main');
        }, 1000);
    } catch (error) {
        window.CryptoWalletApp.utils.showToast(
            '지갑 불러오기에 실패했습니다: ' + error.message
        );
        confirmBtn.disabled = false;
        confirmBtn.textContent = '지갑 불러오기';
    }
}

// 전역 함수들
function copyMnemonic(mnemonic) {
    window.CryptoWalletApp.utils.copyToClipboard(mnemonic);
    window.CryptoWalletApp.utils.showToast(
        '니모닉이 복사되었습니다!'
    );
}

function copyPrivateKey(privateKey) {
    window.CryptoWalletApp.utils.copyToClipboard(
        privateKey
    );
    window.CryptoWalletApp.utils.showToast(
        'Private Key가 복사되었습니다!'
    );
}
