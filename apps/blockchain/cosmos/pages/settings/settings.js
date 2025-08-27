// Settings 페이지 스크립트
document.addEventListener('DOMContentLoaded', () => {
    const app = window.CryptoWalletApp;

    // CosmosJS와 체인 설정이 로드될 때까지 대기 (main과 동일한 방식)
    const waitForCosmosJS = () => {
        if (app.cosmos && app.chainConfig) {
            initializePage();
        } else {
            setTimeout(waitForCosmosJS, 100);
        }
    };

    waitForCosmosJS();
});

function initializePage() {
    const app = window.CryptoWalletApp;

    // 지갑이 없으면 index 페이지로 이동
    if (!app.wallet) {
        app.navigateTo('index');
        return;
    }

    // 지갑 정보 표시
    displayWalletInfo();

    // 체인 정보 표시
    displayChainInfo();

    // 이벤트 리스너 설정
    setupEventListeners();
}

function displayWalletInfo() {
    const app = window.CryptoWalletApp;

    document.getElementById('walletAddress').textContent =
        app.utils && app.wallet.address;

    document.getElementById('walletType').textContent =
        app.wallet.type === 'mnemonic'
            ? '니모닉'
            : '개인키';
}

function displayChainInfo() {
    const app = window.CryptoWalletApp;
    const chainInfo = app.getChainInfo();

    document.getElementById('chainName').textContent =
        chainInfo.prettyName;
    document.getElementById('tokenSymbol').textContent =
        chainInfo.symbol;
    document.getElementById('decimals').textContent =
        chainInfo.decimals.toString();
}

function setupEventListeners() {
    // 모달 설정
    setupModal();
}

function copyAddress() {
    const app = window.CryptoWalletApp;

    if (app.utils && app.utils.copyToClipboard) {
        app.utils.copyToClipboard(app.wallet.address);
        app.showToast('주소가 복사되었습니다.');
    } else if (app.copyToClipboard) {
        app.copyToClipboard(app.wallet.address);
        app.showToast('주소가 복사되었습니다.');
    } else {
        // 폴백: 기본 클립보드 API 사용
        navigator.clipboard
            .writeText(app.wallet.address)
            .then(() => {
                app.showToast('주소가 복사되었습니다.');
            })
            .catch(() => {
                alert(
                    '복사에 실패했습니다. 수동으로 복사해주세요.'
                );
            });
    }
}

function showMnemonic() {
    const app = window.CryptoWalletApp;
    if (
        app.wallet.type !== 'mnemonic' ||
        !app.wallet.mnemonic
    ) {
        showModal(
            '복구구문 없음',
            '이 지갑은 니모닉 기반이 아닙니다.'
        );
        return;
    }

    // 특수문자 이스케이프 처리
    const mnemonic = app.wallet.mnemonic
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');

    showModal(
        '복구구문',
        `
        <div class="mnemonic-display">${app.wallet.mnemonic}</div>
        <button class="copy-btn" onclick="copyMnemonic()">복사</button>
    `
    );

    // 전역 함수로 복사 함수 등록
    window.copyMnemonic = function () {
        const app = window.CryptoWalletApp;
        if (app.utils && app.utils.copyToClipboard) {
            app.utils.copyToClipboard(app.wallet.mnemonic);
            app.showToast('복구구문이 복사되었습니다.');
        } else if (app.copyToClipboard) {
            app.copyToClipboard(app.wallet.mnemonic);
            app.showToast('복구구문이 복사되었습니다.');
        } else {
            // 폴백: 기본 클립보드 API 사용
            navigator.clipboard
                .writeText(app.wallet.mnemonic)
                .then(() => {
                    app.showToast(
                        '복구구문이 복사되었습니다.'
                    );
                })
                .catch(() => {
                    alert(
                        '복사에 실패했습니다. 수동으로 복사해주세요.'
                    );
                });
        }
    };
}

function showPrivateKey() {
    const app = window.CryptoWalletApp;
    if (!app.wallet.privateKey) {
        showModal(
            '개인키 없음',
            '개인키 정보를 찾을 수 없습니다.'
        );
        return;
    }

    showModal(
        '개인키',
        `
        <div class="mnemonic-display">${app.wallet.privateKey}</div>
        <button class="copy-btn" onclick="copyPrivateKey()">복사</button>
    `
    );

    // 전역 함수로 복사 함수 등록
    window.copyPrivateKey = function () {
        const app = window.CryptoWalletApp;
        if (app.utils && app.utils.copyToClipboard) {
            app.utils.copyToClipboard(
                app.wallet.privateKey
            );
            app.showToast('개인키가 복사되었습니다.');
        } else if (app.copyToClipboard) {
            app.copyToClipboard(app.wallet.privateKey);
            app.showToast('개인키가 복사되었습니다.');
        } else {
            // 폴백: 기본 클립보드 API 사용
            navigator.clipboard
                .writeText(app.wallet.privateKey)
                .then(() => {
                    app.showToast(
                        '개인키가 복사되었습니다.'
                    );
                })
                .catch(() => {
                    alert(
                        '복사에 실패했습니다. 수동으로 복사해주세요.'
                    );
                });
        }
    };
}

function exportWallet() {
    const app = window.CryptoWalletApp;
    const exportData = JSON.stringify(app.wallet, null, 2);

    showModal(
        '지갑 내보내기',
        `
        <textarea class="textarea-field" readonly style="min-height:120px;">${exportData}</textarea>
        <button class="copy-btn" onclick="copyWalletData()">복사</button>
    `
    );

    // 전역 함수로 복사 함수 등록
    window.copyWalletData = function () {
        const app = window.CryptoWalletApp;
        const exportData = JSON.stringify(
            app.wallet,
            null,
            2
        );

        if (app.utils && app.utils.copyToClipboard) {
            app.utils.copyToClipboard(exportData);
            app.showToast('지갑 데이터가 복사되었습니다.');
        } else if (app.copyToClipboard) {
            app.copyToClipboard(exportData);
            app.showToast('지갑 데이터가 복사되었습니다.');
        } else {
            // 폴백: 기본 클립보드 API 사용
            navigator.clipboard
                .writeText(exportData)
                .then(() => {
                    app.showToast(
                        '지갑 데이터가 복사되었습니다.'
                    );
                })
                .catch(() => {
                    alert(
                        '복사에 실패했습니다. 수동으로 복사해주세요.'
                    );
                });
        }
    };
}

function deleteWallet() {
    if (
        !confirm(
            '정말로 지갑을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'
        )
    )
        return;

    const app = window.CryptoWalletApp;
    app.deleteWallet();
    app.showToast('지갑이 삭제되었습니다.');
    setTimeout(() => {
        app.navigateTo('index');
    }, 1000);
}

// 모달 관련
function setupModal() {
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementById('closeModal');
    const closeModalBtn =
        document.getElementById('closeModalBtn');

    if (closeBtn) {
        closeBtn.addEventListener(
            'click',
            () => (modal.style.display = 'none')
        );
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener(
            'click',
            () => (modal.style.display = 'none')
        );
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal)
                modal.style.display = 'none';
        });
    }
}

function showModal(title, html) {
    const modal = document.getElementById('modal');
    const modalTitle =
        document.getElementById('modalTitle');
    const modalContent =
        document.getElementById('modalContent');

    if (modalTitle) modalTitle.textContent = title;
    if (modalContent) modalContent.innerHTML = html;
    if (modal) modal.style.display = 'block';
}

// 기존 copyToClipboardModal 함수는 제거 (더 이상 사용하지 않음)
