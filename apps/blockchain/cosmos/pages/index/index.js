// 시작 페이지 JavaScript

let currentMnemonic = '';

// 새 지갑 생성
async function createNewWallet() {
    try {
        // 로딩 표시
        const loadingDiv = WalletUtils.showLoading(
            document.querySelector('.main-content')
        );

        // 지갑 생성
        const result =
            await window.cosmosWallet.createNewWallet();

        WalletUtils.hideLoading(loadingDiv);

        if (result.success) {
            currentMnemonic = result.mnemonic;

            // localStorage 저장 확인
            console.log('지갑 생성 후 localStorage 확인:');
            const savedWallet =
                localStorage.getItem('cosmos_wallet');
            console.log('저장된 지갑 정보:', savedWallet);

            showMnemonicModal(result.mnemonic);
        } else {
            WalletUtils.showMessage(
                '지갑 생성에 실패했습니다: ' + result.error,
                'error'
            );
        }
    } catch (error) {
        console.error('지갑 생성 오류:', error);
        WalletUtils.showMessage(
            '지갑 생성 중 오류가 발생했습니다.',
            'error'
        );
    }
}

// 지갑 복원 모달 표시
function showRestoreWallet() {
    const modal = document.getElementById('restoreModal');
    modal.style.display = 'block';

    // 입력 필드 초기화
    document.getElementById('mnemonicInput').value = '';
}

// 지갑 복원 모달 닫기
function closeRestoreModal() {
    const modal = document.getElementById('restoreModal');
    modal.style.display = 'none';
}

// 지갑 복원
async function restoreWallet() {
    const mnemonicInput =
        document.getElementById('mnemonicInput');
    const mnemonic = mnemonicInput.value.trim();

    if (!mnemonic) {
        WalletUtils.showMessage(
            '니모닉을 입력해주세요.',
            'warning'
        );
        return;
    }

    try {
        // 로딩 표시
        const loadingDiv = WalletUtils.showLoading(
            document.querySelector('.modal-body')
        );

        // 지갑 복원
        const result =
            await window.cosmosWallet.restoreWallet(
                mnemonic
            );

        WalletUtils.hideLoading(loadingDiv);

        if (result.success) {
            closeRestoreModal();
            WalletUtils.showMessage(
                '지갑이 성공적으로 복원되었습니다.',
                'success'
            );

            // 메인 지갑 페이지로 이동
            setTimeout(() => {
                window.location.href =
                    '../wallet/wallet.html';
            }, 1500);
        } else {
            WalletUtils.showMessage(
                '지갑 복원에 실패했습니다: ' + result.error,
                'error'
            );
        }
    } catch (error) {
        console.error('지갑 복원 오류:', error);
        WalletUtils.showMessage(
            '지갑 복원 중 오류가 발생했습니다.',
            'error'
        );
    }
}

// 니모닉 모달 표시
function showMnemonicModal(mnemonic) {
    const modal = document.getElementById('mnemonicModal');
    const mnemonicWords =
        document.getElementById('mnemonicWords');

    // 니모닉 단어들을 표시
    const words = mnemonic.split(' ');
    mnemonicWords.innerHTML = words
        .map(
            (word, index) =>
                `<span class="mnemonic-word">${
                    index + 1
                }. ${word}</span>`
        )
        .join(' ');

    modal.style.display = 'block';
}

// 니모닉 모달 닫기
function closeMnemonicModal() {
    const modal = document.getElementById('mnemonicModal');
    modal.style.display = 'none';
}

// 니모닉 복사
function copyMnemonic() {
    if (currentMnemonic) {
        navigator.clipboard
            .writeText(currentMnemonic)
            .then(() => {
                WalletUtils.showMessage(
                    '니모닉이 클립보드에 복사되었습니다.',
                    'success'
                );
            })
            .catch(() => {
                // 클립보드 API가 지원되지 않는 경우
                const textArea =
                    document.createElement('textarea');
                textArea.value = currentMnemonic;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                WalletUtils.showMessage(
                    '니모닉이 클립보드에 복사되었습니다.',
                    'success'
                );
            });
    }
}

// 니모닉 확인 완료
function confirmMnemonic() {
    closeMnemonicModal();
    WalletUtils.showMessage(
        '지갑이 성공적으로 생성되었습니다.',
        'success'
    );

    // 메인 지갑 페이지로 이동
    setTimeout(() => {
        window.location.href = '../wallet/wallet.html';
    }, 1500);
}

// 모달 외부 클릭 시 닫기
window.onclick = function (event) {
    const restoreModal =
        document.getElementById('restoreModal');
    const mnemonicModal =
        document.getElementById('mnemonicModal');

    if (event.target === restoreModal) {
        closeRestoreModal();
    }

    if (event.target === mnemonicModal) {
        closeMnemonicModal();
    }
};

// Enter 키로 지갑 복원
document
    .getElementById('mnemonicInput')
    .addEventListener('keypress', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            restoreWallet();
        }
    });

// 페이지 로드 시 기존 지갑 확인
document.addEventListener('DOMContentLoaded', async () => {
    // 지갑 초기화가 완료될 때까지 대기
    const waitForWallet = async () => {
        if (!window.cosmosWallet) {
            console.log(
                '지갑이 아직 로드되지 않았습니다. 100ms 후 재시도...'
            );
            setTimeout(waitForWallet, 100);
            return;
        }

        if (!window.cosmosWallet.isInitialized) {
            console.log(
                '지갑이 아직 초기화되지 않았습니다. 100ms 후 재시도...'
            );
            setTimeout(waitForWallet, 100);
            return;
        }

        try {
            console.log(
                '지갑 초기화 완료, 기존 지갑 확인 시작...'
            );

            // localStorage 디버깅
            window.cosmosWallet.debugLocalStorage();

            // localStorage 직접 확인
            console.log('localStorage 직접 확인:');
            const directCheck =
                localStorage.getItem('cosmos_wallet');
            console.log(
                'localStorage 직접 조회 결과:',
                directCheck
            );

            // 기존 지갑 정보 확인
            const walletInfo =
                window.cosmosWallet.loadWalletInfo();

            console.log(
                'loadWalletInfo() 결과:',
                walletInfo
            );

            if (walletInfo && walletInfo.mnemonic) {
                console.log('기존 지갑 발견, 복원 시도...');
                console.log('니모닉:', walletInfo.mnemonic);

                // 기존 지갑이 있으면 자동으로 복원
                const result =
                    await window.cosmosWallet.restoreWallet(
                        walletInfo.mnemonic
                    );

                if (result.success) {
                    console.log(
                        '지갑 복원 성공, 지갑 페이지로 이동'
                    );
                    // 메인 지갑 페이지로 자동 이동
                    window.location.href =
                        '../wallet/wallet.html';
                } else {
                    console.log(
                        '지갑 복원 실패, 지갑 정보 삭제'
                    );
                    // 복원 실패 시 지갑 정보 삭제
                    window.cosmosWallet.clearWalletInfo();
                }
            } else {
                console.log('기존 지갑이 없습니다.');
                console.log('walletInfo:', walletInfo);
            }
        } catch (error) {
            console.error('기존 지갑 확인 오류:', error);
        }
    };

    // 지갑 초기화 대기 시작
    waitForWallet();
});
