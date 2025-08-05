// 전송 페이지 JavaScript

// 기본 유틸리티 함수들 (WalletUtils가 없을 경우를 대비)
const defaultUtils = {
    formatAmount: (amount, decimals = 6) => {
        return parseFloat(amount).toFixed(decimals);
    },
    shortenAddress: (address, start = 8, end = 6) => {
        if (!address || address.length < start + end)
            return address;
        return (
            address.substring(0, start) +
            '...' +
            address.substring(address.length - end)
        );
    },
    showMessage: (message, type = 'info') => {
        console.log(`[${type.toUpperCase()}] ${message}`);
        // 간단한 알림 표시
        alert(message);
    },
    showLoading: (container) => {
        const loadingDiv = document.createElement('div');
        loadingDiv.innerHTML =
            '<div style="text-align: center; padding: 20px;">로딩 중...</div>';
        loadingDiv.style.cssText =
            'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;';
        document.body.appendChild(loadingDiv);
        return loadingDiv;
    },
    hideLoading: (loadingDiv) => {
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
        }
    },
};

// WalletUtils가 없으면 기본 유틸리티 사용
if (typeof WalletUtils === 'undefined') {
    window.WalletUtils = defaultUtils;
    console.log(
        'WalletUtils가 없어서 기본 유틸리티를 사용합니다.'
    );
}

let currentBalance = 0;
let feeOptions = {
    low: 0.0001,
    average: 0.0001,
    high: 0.0001,
};
let selectedFeeOption = 'average';
let qrScanner = null;

// 설정에서 수수료 정보 가져오기
async function getFeeFromConfig() {
    try {
        // 전역 설정에서 수수료 정보 가져오기
        const feeInfo = window.CosmosConfig.getFeeInfo();
        if (feeInfo) {
            console.log(
                '설정에서 수수료 정보 로드:',
                feeInfo
            );

            // 수수료 옵션 설정
            feeOptions = {
                low:
                    feeInfo.low_gas_price ||
                    feeInfo.fixed_min_gas_price ||
                    0.01,
                average: feeInfo.average_gas_price || 0.025,
                high: feeInfo.high_gas_price || 0.03,
            };

            // UI에 수수료 표시
            updateFeeDisplay();

            return feeOptions.average; // 기본값으로 평균 수수료 반환
        }
    } catch (error) {
        console.error(
            '설정에서 수수료 정보를 가져올 수 없습니다:',
            error
        );
    }
    return 0.0001; // 기본값
}

// 수수료 표시 업데이트
function updateFeeDisplay() {
    document.getElementById('lowFee').textContent =
        feeOptions.low.toFixed(6);
    document.getElementById('averageFee').textContent =
        feeOptions.average.toFixed(6);
    document.getElementById('highFee').textContent =
        feeOptions.high.toFixed(6);
}

// 선택된 수수료 업데이트
function updateFee() {
    const selectedOption = document.querySelector(
        'input[name="feeOption"]:checked'
    ).value;
    selectedFeeOption = selectedOption;
    console.log(
        '선택된 수수료 옵션:',
        selectedOption,
        '수수료:',
        feeOptions[selectedOption]
    );
    calculateFee();
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 지갑 초기화 확인 및 로드
        await ensureWalletLoaded();

        // 잔액 로드
        await loadBalance();

        // 설정에서 수수료 정보 가져오기
        await getFeeFromConfig();

        // 수수료 계산
        calculateFee();

        // 전송 버튼 활성화 및 이벤트 리스너 추가
        const sendButton =
            document.querySelector('.send-btn');
        if (sendButton) {
            sendButton.disabled = false;
            console.log('전송 버튼 활성화 완료');

            // 클릭 이벤트 리스너 추가
            sendButton.addEventListener(
                'click',
                function (e) {
                    console.log(
                        '전송 버튼 클릭 이벤트 발생!'
                    );
                    e.preventDefault();
                    sendTokens();
                }
            );

            console.log(
                '전송 버튼 이벤트 리스너 추가 완료'
            );
        } else {
            console.error('전송 버튼을 찾을 수 없습니다.');
        }
    } catch (error) {
        console.error('전송 페이지 초기화 오류:', error);
        WalletUtils.showMessage(
            '페이지 초기화에 실패했습니다.',
            'error'
        );
    }
});

// 지갑 로드 확인 및 초기화
async function ensureWalletLoaded() {
    try {
        console.log('=== 지갑 로드 상태 확인 ===');
        console.log(
            'window.cosmosWallet 존재:',
            !!window.cosmosWallet
        );

        if (window.cosmosWallet) {
            console.log(
                '지갑 초기화 상태:',
                window.cosmosWallet.isInitialized
            );
            console.log(
                '지갑 객체 존재:',
                !!window.cosmosWallet.wallet
            );
        }

        // 지갑이 이미 로드되어 있는지 확인
        if (
            window.cosmosWallet &&
            window.cosmosWallet.wallet
        ) {
            console.log('지갑이 이미 로드되어 있습니다.');
            return;
        }

        // 지갑 초기화
        if (window.cosmosWallet) {
            console.log('지갑 초기화 중...');
            await window.cosmosWallet.initialize();
            console.log('지갑 초기화 완료');
        }

        // 저장된 지갑 정보 로드 시도
        if (window.cosmosWallet) {
            console.log('저장된 지갑 정보 확인 중...');
            const walletInfo =
                window.cosmosWallet.loadWalletInfo();
            console.log('로드된 지갑 정보:', walletInfo);

            if (walletInfo && walletInfo.mnemonic) {
                console.log('저장된 지갑 복원 중...');
                await window.cosmosWallet.restoreWallet(
                    walletInfo.mnemonic
                );
                console.log('지갑 복원 완료');
            } else {
                console.log('저장된 지갑 정보가 없습니다.');
                // 지갑이 없으면 wallet 페이지로 이동
                console.log('wallet 페이지로 이동');
                window.location.href =
                    '../index/index.html';
                return;
            }
        }

        // 지갑이 여전히 로드되지 않았으면 wallet 페이지로 이동
        if (
            !window.cosmosWallet ||
            !window.cosmosWallet.wallet
        ) {
            console.log(
                '지갑 로드 실패, wallet 페이지로 이동'
            );
            window.location.href = '../index/index.html';
            return;
        }

        console.log('지갑 로드 완료');
        console.log('=== 지갑 로드 상태 확인 완료 ===');
    } catch (error) {
        console.error('지갑 로드 오류:', error);
        window.location.href = '../index/index.html';
    }
}

// 잔액 로드
async function loadBalance() {
    try {
        console.log('잔액 조회 시작...');
        const result =
            await window.cosmosWallet.getBalance();
        console.log('잔액 조회 결과:', result);

        if (result.success) {
            // 잔액 데이터 구조 확인
            const balance = result.balance;
            console.log('잔액 데이터:', balance);

            if (balance && balance.formatted) {
                // formatted 값이 있으면 사용
                currentBalance = parseFloat(
                    balance.formatted
                );
                document.getElementById(
                    'availableBalance'
                ).textContent = `${balance.formatted} ATOM`;
            } else if (balance && balance.amount) {
                // amount 값이 있으면 변환
                const amount = parseFloat(balance.amount);
                const formattedBalance = (
                    amount / 1000000
                ).toFixed(6); // uatom을 atom으로 변환
                currentBalance = parseFloat(
                    formattedBalance
                );
                document.getElementById(
                    'availableBalance'
                ).textContent = `${formattedBalance} ATOM`;
            } else {
                console.error(
                    '잔액 데이터 구조가 올바르지 않습니다:',
                    balance
                );
                document.getElementById(
                    'availableBalance'
                ).textContent = '0.000000 ATOM';
            }

            console.log('현재 잔액 설정:', currentBalance);
        } else {
            console.error('잔액 조회 실패:', result.error);
            document.getElementById(
                'availableBalance'
            ).textContent = '0.000000 ATOM';
        }
    } catch (error) {
        console.error('잔액 조회 오류:', error);
        document.getElementById(
            'availableBalance'
        ).textContent = '0.000000 ATOM';
    }
}

// 주소 유효성 검사
function validateAddress() {
    const address = document
        .getElementById('recipientAddress')
        .value.trim();
    const validationDiv = document.getElementById(
        'addressValidation'
    );
    const sendBtn = document.querySelector('.send-btn');

    if (!address) {
        validationDiv.textContent = '';
        validationDiv.className = 'validation-message';
        sendBtn.disabled = true;
        return;
    }

    try {
        // Cosmos 주소 형식 검사
        if (
            address.startsWith('cosmos1') &&
            address.length === 45
        ) {
            validationDiv.textContent =
                '✅ 유효한 주소입니다';
            validationDiv.className =
                'validation-message valid';
            sendBtn.disabled = false;
        } else {
            validationDiv.textContent =
                '❌ 유효하지 않은 주소입니다';
            validationDiv.className =
                'validation-message invalid';
            sendBtn.disabled = true;
        }
    } catch (error) {
        validationDiv.textContent =
            '❌ 주소 형식이 올바르지 않습니다';
        validationDiv.className =
            'validation-message invalid';
        sendBtn.disabled = true;
    }
}

// 수수료 계산
function calculateFee() {
    const amount =
        parseFloat(
            document.getElementById('sendAmount').value
        ) || 0;
    const selectedFee = feeOptions[selectedFeeOption];
    const total = amount + selectedFee;

    document.getElementById(
        'feeInfo'
    ).textContent = `수수료: ${WalletUtils.formatAmount(
        selectedFee,
        6
    )} ATOM`;
    document.getElementById(
        'totalInfo'
    ).textContent = `총액: ${WalletUtils.formatAmount(
        total,
        6
    )} ATOM`;

    // 잔액 확인
    if (total > currentBalance) {
        document.getElementById('totalInfo').style.color =
            '#e17055';
    } else {
        document.getElementById('totalInfo').style.color =
            '#6c5ce7';
    }
}

// 최대 금액 설정
function setMaxAmount() {
    const selectedFee = feeOptions[selectedFeeOption];
    const maxAmount = Math.max(
        0,
        currentBalance - selectedFee
    );
    document.getElementById('sendAmount').value =
        WalletUtils.formatAmount(maxAmount, 6);
    calculateFee();
}

// QR 스캐너 열기
function openQRScanner() {
    const modal = document.getElementById('qrScannerModal');
    modal.style.display = 'block';

    // 카메라 접근
    navigator.mediaDevices
        .getUserMedia({
            video: { facingMode: 'environment' },
        })
        .then((stream) => {
            const video =
                document.getElementById('qrVideo');
            video.srcObject = stream;

            // QR 코드 스캔 시작
            startQRScan();
        })
        .catch((error) => {
            console.error('카메라 접근 실패:', error);
            WalletUtils.showMessage(
                '카메라 권한이 필요합니다.',
                'error'
            );
            closeQRScanner();
        });
}

// QR 스캐너 닫기
function closeQRScanner() {
    const modal = document.getElementById('qrScannerModal');
    modal.style.display = 'none';

    // 비디오 스트림 정지
    const video = document.getElementById('qrVideo');
    if (video.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach((track) => track.stop());
    }

    // QR 스캐너 정지
    if (qrScanner) {
        qrScanner.stop();
        qrScanner = null;
    }
}

// QR 코드 스캔 시작
function startQRScan() {
    const video = document.getElementById('qrVideo');

    // 간단한 QR 스캔 시뮬레이션 (실제 구현에서는 QR 라이브러리 사용)
    // 여기서는 예시로 3초 후에 테스트 주소를 설정
    setTimeout(() => {
        const testAddress =
            'cosmos1exampleaddress123456789012345678901234567890';
        document.getElementById('recipientAddress').value =
            testAddress;
        validateAddress();
        closeQRScanner();
        WalletUtils.showMessage(
            'QR 코드가 스캔되었습니다.',
            'success'
        );
    }, 3000);
}

// 토큰 전송
function sendTokens() {
    console.log('=== sendTokens 함수 호출됨 ===');
    console.log('전송 버튼 클릭됨!');

    const address = document
        .getElementById('recipientAddress')
        .value.trim();
    const amount = parseFloat(
        document.getElementById('sendAmount').value
    );
    const memo = document
        .getElementById('sendMemo')
        .value.trim();
    const selectedFee = feeOptions[selectedFeeOption];

    console.log('입력된 정보:', {
        address: address,
        amount: amount,
        memo: memo,
        selectedFee: selectedFee,
        currentBalance: currentBalance,
    });

    if (!address || !amount || amount <= 0) {
        console.log('유효성 검사 실패: 필수 정보 누락');
        WalletUtils.showMessage(
            '모든 필수 정보를 입력해주세요.',
            'warning'
        );
        return;
    }

    if (amount + selectedFee > currentBalance) {
        console.log('유효성 검사 실패: 잔액 부족');
        WalletUtils.showMessage(
            '잔액이 부족합니다.',
            'error'
        );
        return;
    }

    console.log('유효성 검사 통과, 확인 모달 표시');
    // 확인 모달 표시
    showConfirmModal(address, amount, memo);
}

// 전역에서 접근 가능하도록 노출
window.sendTokens = sendTokens;

// 확인 화면 표시
function showConfirmModal(address, amount, memo) {
    console.log('=== showConfirmModal 함수 호출됨 ===');
    console.log('확인 화면 표시 정보:', {
        address,
        amount,
        memo,
    });

    const selectedFee = feeOptions[selectedFeeOption];
    console.log('선택된 수수료:', selectedFee);

    try {
        // 모달 요소들 찾기
        const confirmAddress = document.getElementById(
            'confirmAddress'
        );
        const confirmAmount =
            document.getElementById('confirmAmount');
        const confirmFee =
            document.getElementById('confirmFee');
        const confirmTotal =
            document.getElementById('confirmTotal');
        const confirmMemo =
            document.getElementById('confirmMemo');
        const confirmMemoItem = document.getElementById(
            'confirmMemoItem'
        );
        const sendForm =
            document.getElementById('sendForm');
        const confirmScreen =
            document.getElementById('confirmScreen');

        console.log('DOM 요소 확인:', {
            confirmAddress: !!confirmAddress,
            confirmAmount: !!confirmAmount,
            confirmFee: !!confirmFee,
            confirmTotal: !!confirmTotal,
            confirmMemo: !!confirmMemo,
            confirmMemoItem: !!confirmMemoItem,
            sendForm: !!sendForm,
            confirmScreen: !!confirmScreen,
        });

        // 필수 요소들이 없으면 오류
        if (
            !confirmAddress ||
            !confirmAmount ||
            !confirmFee ||
            !confirmTotal ||
            !sendForm ||
            !confirmScreen
        ) {
            console.error(
                '필수 DOM 요소를 찾을 수 없습니다.'
            );
            alert('확인 화면 요소를 찾을 수 없습니다.');
            return;
        }

        // 주소 설정 (간단한 방식)
        const shortAddress =
            address.length > 14
                ? address.substring(0, 8) +
                  '...' +
                  address.substring(address.length - 6)
                : address;
        confirmAddress.textContent = shortAddress;
        console.log('주소 설정 완료:', shortAddress);

        // 금액 설정 (간단한 방식)
        const formattedAmount =
            parseFloat(amount).toFixed(6);
        confirmAmount.textContent = `${formattedAmount} ATOM`;
        console.log('금액 설정 완료:', formattedAmount);

        // 수수료 설정 (간단한 방식)
        const formattedFee =
            parseFloat(selectedFee).toFixed(6);
        confirmFee.textContent = `${formattedFee} ATOM`;
        console.log('수수료 설정 완료:', formattedFee);

        // 총액 설정 (간단한 방식)
        const totalAmount =
            parseFloat(amount) + parseFloat(selectedFee);
        const formattedTotal = totalAmount.toFixed(6);
        confirmTotal.textContent = `${formattedTotal} ATOM`;
        console.log('총액 설정 완료:', formattedTotal);

        // 메모 설정
        if (memo && confirmMemo && confirmMemoItem) {
            confirmMemo.textContent = memo;
            confirmMemoItem.style.display = 'flex';
            console.log('메모 설정 완료:', memo);
        } else if (confirmMemoItem) {
            confirmMemoItem.style.display = 'none';
            console.log('메모 숨김 완료');
        }

        // 화면 전환
        sendForm.style.display = 'none';
        confirmScreen.style.display = 'block';
        console.log('확인 화면 표시 완료');
    } catch (error) {
        console.error('확인 화면 표시 중 오류:', error);
        console.error('오류 상세:', error.stack);
        alert(
            '확인 화면 표시 중 오류가 발생했습니다: ' +
                error.message
        );
    }
}

// 전송 폼으로 돌아가기
function backToSendForm() {
    console.log('전송 폼으로 돌아가기');
    const sendForm = document.getElementById('sendForm');
    const confirmScreen =
        document.getElementById('confirmScreen');

    if (sendForm && confirmScreen) {
        confirmScreen.style.display = 'none';
        sendForm.style.display = 'block';
        console.log('전송 폼으로 돌아가기 완료');
    }
}

// 전송 확인
async function confirmSend() {
    const address = document
        .getElementById('recipientAddress')
        .value.trim();
    const amount = parseFloat(
        document.getElementById('sendAmount').value
    );
    const memo = document
        .getElementById('sendMemo')
        .value.trim();

    try {
        // 전송 폼으로 돌아가기
        backToSendForm();

        // 로딩 표시
        const loadingDiv = WalletUtils.showLoading(
            document.querySelector('.send-form')
        );

        // 개인키 추출
        console.log('개인키 추출 시작...');
        const mnemonic =
            window.cosmosWallet.loadWalletInfo()?.mnemonic;
        if (!mnemonic) {
            throw new Error(
                '지갑 정보를 찾을 수 없습니다.'
            );
        }

        const privateKeyResult =
            await window.cosmosWallet.extractPrivateKey(
                mnemonic
            );
        if (!privateKeyResult) {
            throw new Error('개인키를 추출할 수 없습니다.');
        }

        console.log(
            '개인키 추출 완료:',
            privateKeyResult.substring(0, 10) + '...'
        );

        // test.html과 같은 방식으로 토큰 전송
        try {
            // 1. 개인키로 지갑 생성
            const wallet =
                await CosmosJS.createWalletFromPrivateKey(
                    privateKeyResult
                );
            const fromAddress =
                await CosmosJS.getWalletAddress(wallet);

            console.log(
                '지갑 생성 완료, 보내는 주소:',
                fromAddress
            );

            // 2. 주소 검증
            if (
                !CosmosJS.validateAddress(fromAddress) ||
                !CosmosJS.validateAddress(address)
            ) {
                throw new Error(
                    '유효하지 않은 주소입니다.'
                );
            }

            // 3. 서명 클라이언트 연결
            const signingClient =
                await CosmosJS.connectSigningClient(
                    CosmosJS.getDefaultRpcUrl(),
                    wallet
                );

            console.log('서명 클라이언트 연결 완료');

            // 4. 전송량을 기본 단위로 변환
            const baseAmount = CosmosJS.displayToBase(
                amount.toString()
            );

            console.log('전송 정보:', {
                from: fromAddress,
                to: address,
                amount: baseAmount,
                memo: memo,
            });

            // 5. 토큰 전송 (CosmosJS.sendTokens 사용)
            const result = await CosmosJS.sendTokens(
                signingClient,
                fromAddress,
                address,
                baseAmount,
                null, // denom (설정에서 자동 선택)
                memo
            );

            console.log('전송 성공:', result);

            WalletUtils.hideLoading(loadingDiv);

            WalletUtils.showMessage(
                '토큰이 성공적으로 전송되었습니다.',
                'success'
            );

            // 폼 초기화
            document.getElementById(
                'recipientAddress'
            ).value = '';
            document.getElementById('sendAmount').value =
                '';
            document.getElementById('sendMemo').value = '';

            // 잔액 새로고침
            await loadBalance();

            // 잠시 후 지갑 페이지로 이동
            setTimeout(() => {
                window.location.href =
                    '../wallet/wallet.html';
            }, 2000);
        } catch (error) {
            console.error('토큰 전송 실패:', error);
            WalletUtils.hideLoading(loadingDiv);
            WalletUtils.showMessage(
                '전송에 실패했습니다: ' + error.message,
                'error'
            );
        }
    } catch (error) {
        console.error('전송 오류:', error);
        WalletUtils.hideLoading(loadingDiv);
        WalletUtils.showMessage(
            '전송 중 오류가 발생했습니다: ' + error.message,
            'error'
        );
    }
}

// 뒤로 가기
function goBack() {
    window.history.back();
}

// 모달 외부 클릭 시 닫기
window.onclick = function (event) {
    const qrModal = document.getElementById(
        'qrScannerModal'
    );
    const confirmModal =
        document.getElementById('confirmModal');

    if (event.target === qrModal) {
        closeQRScanner();
    }

    if (event.target === confirmModal) {
        // closeConfirmModal(); // 제거됨
    }
};
