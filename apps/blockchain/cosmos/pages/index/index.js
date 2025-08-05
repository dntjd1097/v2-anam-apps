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

    // 라디오 버튼 이벤트
    setupRadioGroups();

    // 버튼 이벤트
    setupButtons();

    // 모달 이벤트
    setupModal();
}

function setupRadioGroups() {
    // 생성 타입 선택
    const createTypeGroup = document.getElementById(
        'createTypeGroup'
    );
    createTypeGroup.addEventListener('change', (e) => {
        const selectedOption =
            e.target.closest('.radio-option');
        if (selectedOption) {
            // 모든 옵션에서 선택 상태 제거
            createTypeGroup
                .querySelectorAll('.radio-option')
                .forEach((option) => {
                    option.classList.remove('selected');
                });
            // 선택된 옵션에 선택 상태 추가
            selectedOption.classList.add('selected');
        }
    });

    // 불러오기 타입 선택
    const importTypeGroup = document.getElementById(
        'importTypeGroup'
    );
    importTypeGroup.addEventListener('change', (e) => {
        const selectedOption =
            e.target.closest('.radio-option');
        if (selectedOption) {
            // 모든 옵션에서 선택 상태 제거
            importTypeGroup
                .querySelectorAll('.radio-option')
                .forEach((option) => {
                    option.classList.remove('selected');
                });
            // 선택된 옵션에 선택 상태 추가
            selectedOption.classList.add('selected');
        }
    });
}

function setupButtons() {
    const createWalletBtn = document.getElementById(
        'createWalletBtn'
    );
    const importWalletBtn = document.getElementById(
        'importWalletBtn'
    );

    // 지갑 생성 버튼
    createWalletBtn.addEventListener('click', () => {
        const selectedType = document.querySelector(
            'input[name="createType"]:checked'
        );
        if (!selectedType) {
            window.CryptoWalletApp.utils.showToast(
                '지갑 생성 방식을 선택해주세요.'
            );
            return;
        }

        showCreateWalletModal(selectedType.value);
    });

    // 지갑 불러오기 버튼
    importWalletBtn.addEventListener('click', () => {
        const selectedType = document.querySelector(
            'input[name="importType"]:checked'
        );
        if (!selectedType) {
            window.CryptoWalletApp.utils.showToast(
                '지갑 불러오기 방식을 선택해주세요.'
            );
            return;
        }

        showImportWalletModal(selectedType.value);
    });
}

function setupModal() {
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');

    // 모달 닫기
    closeBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    cancelBtn.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // 모달 외부 클릭 시 닫기
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
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
                    <button class="copy-btn" onclick="copyMnemonic('${mnemonic}')">전체 복사</button>
                </div>
            `;

            confirmBtn.textContent = '지갑 생성';
            confirmBtn.onclick = () =>
                createWalletFromMnemonic(mnemonic);
        } catch (error) {
            modalContent.innerHTML = `
                <div class="warning-message">
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
                            <div>${keyInfo.privateKey}</div>
                            <button class="copy-btn" onclick="copyPrivateKey('${keyInfo.privateKey}')">복사</button>
                        </div>
                    `;

                    confirmBtn.textContent = '지갑 생성';
                    confirmBtn.onclick = () =>
                        createWalletFromPrivateKey(keyInfo);
                })
                .catch((error) => {
                    modalContent.innerHTML = `
                        <div class="warning-message">
                            <strong>오류 발생</strong>
                            Private Key 생성 중 오류가 발생했습니다: ${error.message}
                        </div>
                    `;
                    confirmBtn.style.display = 'none';
                });
        } catch (error) {
            modalContent.innerHTML = `
                <div class="warning-message">
                    <strong>오류 발생</strong>
                    Private Key 생성 중 오류가 발생했습니다: ${error.message}
                </div>
            `;
            confirmBtn.style.display = 'none';
        }
    }

    modal.style.display = 'block';
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
            </div>
        `;

        confirmBtn.textContent = '지갑 불러오기';
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
            </div>
        `;

        confirmBtn.textContent = '지갑 불러오기';
        confirmBtn.onclick = () =>
            importWalletFromPrivateKey();
    }

    modal.style.display = 'block';
}

async function createWalletFromMnemonic(mnemonic) {
    try {
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
    }
}

async function createWalletFromPrivateKey(keyInfo) {
    try {
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
    }
}

async function importWalletFromMnemonic() {
    const mnemonicInput =
        document.getElementById('mnemonicInput');
    const mnemonic = mnemonicInput.value.trim();

    if (!mnemonic) {
        window.CryptoWalletApp.utils.showToast(
            '니모닉을 입력해주세요.'
        );
        return;
    }

    try {
        // 니모닉 검증
        if (
            !window.CryptoWalletApp.cosmos.validateMnemonic(
                mnemonic
            )
        ) {
            window.CryptoWalletApp.utils.showToast(
                '유효하지 않은 니모닉입니다.'
            );
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
    }
}

async function importWalletFromPrivateKey() {
    const privateKeyInput = document.getElementById(
        'privateKeyInput'
    );
    const privateKey = privateKeyInput.value.trim();

    if (!privateKey) {
        window.CryptoWalletApp.utils.showToast(
            'Private Key를 입력해주세요.'
        );
        return;
    }

    try {
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
    }
}

// 전역 함수들
function copyMnemonic(mnemonic) {
    window.CryptoWalletApp.utils.copyToClipboard(mnemonic);
}

function copyPrivateKey(privateKey) {
    window.CryptoWalletApp.utils.copyToClipboard(
        privateKey
    );
}
