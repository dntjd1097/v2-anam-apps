// Send 페이지 스크립트
document.addEventListener('DOMContentLoaded', () => {
    const app = window.CryptoWalletApp;

    // CosmosJS가 로드될 때까지 대기
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

    // 페이지 초기화
    loadBalance();
    setupEventListeners();
    updateChainInfo();
}

function updateChainInfo() {
    const app = window.CryptoWalletApp;
    const chainInfo = app.getChainInfo();

    // 금액 심볼 업데이트
    const amountSymbol =
        document.getElementById('amountSymbol');
    if (amountSymbol) {
        amountSymbol.textContent = chainInfo.symbol;
    }
}

async function loadBalance() {
    const app = window.CryptoWalletApp;
    const balanceElement = document.getElementById(
        'availableBalance'
    );
    const balanceUsdElement =
        document.getElementById('balanceUsd');

    try {
        showLoading(true);

        // RPC 연결
        const connection = await connectToRPC();

        if (!connection) {
            throw new Error(
                'RPC 서버에 연결할 수 없습니다.'
            );
        }

        const { client } = connection;

        // 잔액 조회 - 클라이언트의 getBalance 메서드 직접 사용
        const balance = await client.getBalance(
            app.wallet.address,
            app.chainConfig.assets[0].base
        );

        // 잔액 표시
        const formattedBalance = app.baseToDisplay(
            balance.amount
        );
        balanceElement.textContent = `${formattedBalance} ${app.chainConfig.assets[0].symbol}`;

        // USD 가치 계산
        const usdValue = await calculateUsdValue(
            formattedBalance
        );
        if (balanceUsdElement) {
            balanceUsdElement.textContent = `$${usdValue}`;
        }

        console.log('잔액 로드 완료:', {
            amount: balance.amount,
            denom: balance.denom,
            formatted: formattedBalance,
            usdValue: usdValue,
        });
    } catch (error) {
        console.error('잔액 로드 실패:', error);

        // 에러 시 기본값 표시
        balanceElement.textContent = '0.000000 ATOM';
        if (balanceUsdElement) {
            balanceUsdElement.textContent = '$0.00';
        }

        window.CryptoWalletApp.utils.showToast(
            '잔액을 불러올 수 없습니다.',
            3000
        );
    } finally {
        showLoading(false);
    }
}

// main.js 패턴에 맞춘 connectToRPC
async function connectToRPC() {
    const app = window.CryptoWalletApp;
    const rpcEndpoints = app.cosmos.getRpcEndpoints();

    for (let i = 0; i < rpcEndpoints.length; i++) {
        const endpoint = rpcEndpoints[i];
        const rpcUrl = endpoint.address;

        try {
            console.log(
                `RPC 연결 시도 ${i + 1}/${
                    rpcEndpoints.length
                }:`,
                rpcUrl
            );

            const client = await app.cosmos.connectClient(
                rpcUrl
            );
            await client.getChainId(); // 연결 테스트

            console.log('RPC 연결 성공:', rpcUrl);
            return { client, rpcUrl };
        } catch (error) {
            console.warn(
                `RPC 연결 실패 (${rpcUrl}):`,
                error
            );
        }
    }

    // 모두 실패 시 null 반환
    return null;
}

async function calculateUsdValue(amount) {
    const app = window.CryptoWalletApp;

    try {
        const price = await app.getTokenPrice();
        const usdValue = (
            parseFloat(amount) * price
        ).toFixed(2);
        return usdValue;
    } catch (error) {
        console.warn('USD 가치 계산 실패:', error);
        return '0.00';
    }
}

function setupEventListeners() {
    const form = document.getElementById('sendForm');
    const recipientAddress = document.getElementById(
        'recipientAddress'
    );
    const sendAmount =
        document.getElementById('sendAmount');
    const gasLimit = document.getElementById('gasLimit');
    const memo = document.getElementById('memo');

    // 폼 제출 이벤트
    form.addEventListener('submit', handleSubmit);

    // 실시간 검증
    recipientAddress.addEventListener(
        'input',
        validateForm
    );
    sendAmount.addEventListener('input', validateForm);
    gasLimit.addEventListener('input', validateForm);

    // 메모 카운터
    memo.addEventListener('input', updateMemoCounter);
}

function validateForm() {
    const recipientAddress = document
        .getElementById('recipientAddress')
        .value.trim();
    const sendAmount = parseFloat(
        document.getElementById('sendAmount').value
    );
    const gasLimit = parseInt(
        document.getElementById('gasLimit').value
    );
    const sendButton =
        document.getElementById('sendButton');

    let isValid = true;

    // 주소 검증
    if (!recipientAddress) {
        isValid = false;
    } else if (!isValidAddress(recipientAddress)) {
        isValid = false;
    }

    // 금액 검증
    if (!sendAmount || sendAmount <= 0) {
        isValid = false;
    }

    // 가스 한도 검증
    if (
        !gasLimit ||
        gasLimit < 100000 ||
        gasLimit > 1000000
    ) {
        isValid = false;
    }

    // 잔액 확인
    const availableBalance = getAvailableBalance();
    if (sendAmount > availableBalance) {
        isValid = false;
    }

    sendButton.disabled = !isValid;

    // 전송 요약 업데이트
    if (isValid) {
        updateSendSummary();
    } else {
        hideSendSummary();
    }
}

function isValidAddress(address) {
    const app = window.CryptoWalletApp;
    return app.validateAddress(address);
}

function getAvailableBalance() {
    const balanceText = document.getElementById(
        'availableBalance'
    ).textContent;
    const match = balanceText.match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
}

function updateSendSummary() {
    const recipientAddress = document
        .getElementById('recipientAddress')
        .value.trim();
    const sendAmount = parseFloat(
        document.getElementById('sendAmount').value
    );
    const gasLimit = parseInt(
        document.getElementById('gasLimit').value
    );
    const memo = document.getElementById('memo').value;
    const app = window.CryptoWalletApp;

    if (!recipientAddress || !sendAmount || !gasLimit) {
        hideSendSummary();
        return;
    }

    // 수수료 계산 - 객체에서 amount 추출
    const feeObj = app.calculateFee(gasLimit);
    const feeAmount = app.baseToDisplay(feeObj.amount); // uatom을 ATOM으로 변환
    const totalAmount = sendAmount + parseFloat(feeAmount);

    // 소수점 자릿수 제한 (6자리)
    const formattedSendAmount = sendAmount.toFixed(6);
    const formattedFeeAmount =
        parseFloat(feeAmount).toFixed(6);
    const formattedTotalAmount = totalAmount.toFixed(6);

    // 요약 업데이트
    document.getElementById('summaryAddress').textContent =
        app.utils.shortenAddress(recipientAddress, 12);
    document.getElementById(
        'summaryAmount'
    ).textContent = `${formattedSendAmount} ${app.chainConfig.assets[0].symbol}`;
    document.getElementById(
        'summaryFee'
    ).textContent = `${formattedFeeAmount} ${app.chainConfig.assets[0].symbol}`;
    document.getElementById(
        'summaryTotal'
    ).textContent = `${formattedTotalAmount} ${app.chainConfig.assets[0].symbol}`;

    // 요약 표시
    document.getElementById('sendSummary').style.display =
        'block';
}

function hideSendSummary() {
    document.getElementById('sendSummary').style.display =
        'none';
}

function updateMemoCounter() {
    const memo = document.getElementById('memo');
    const counter = document.getElementById('memoCount');
    counter.textContent = memo.value.length;
}

// 금액 설정 함수들
function setAmount(percentage) {
    const availableBalance = getAvailableBalance();
    const sendAmount = availableBalance * percentage;
    document.getElementById('sendAmount').value =
        sendAmount.toFixed(6);
    validateForm();
}

// 가스 설정 함수들
function setGas(level) {
    const gasInput = document.getElementById('gasLimit');
    const gasButtons =
        document.querySelectorAll('.gas-btn');

    // 모든 버튼에서 active 클래스 제거
    gasButtons.forEach((btn) =>
        btn.classList.remove('active')
    );

    // 선택된 버튼에 active 클래스 추가
    event.target.classList.add('active');

    // 가스 한도 설정
    switch (level) {
        case 'low':
            gasInput.value = '150000';
            break;
        case 'medium':
            gasInput.value = '200000';
            break;
        case 'high':
            gasInput.value = '300000';
            break;
    }

    validateForm();
}

// 주소 붙여넣기
async function pasteAddress() {
    try {
        const text = await navigator.clipboard.readText();
        document.getElementById('recipientAddress').value =
            text;
        validateForm();
    } catch (error) {
        window.CryptoWalletApp.utils.showToast(
            '클립보드에 접근할 수 없습니다.'
        );
    }
}

// QR 코드 스캔 (미구현)
function scanQR() {
    window.CryptoWalletApp.utils.showToast(
        'QR 코드 스캔 기능은 준비 중입니다.'
    );
}

// 폼 제출 처리
async function handleSubmit(e) {
    e.preventDefault();

    const recipientAddress = document
        .getElementById('recipientAddress')
        .value.trim();
    const sendAmount = parseFloat(
        document.getElementById('sendAmount').value
    );
    const gasLimit = parseInt(
        document.getElementById('gasLimit').value
    );
    const memo = document.getElementById('memo').value;

    // 최종 검증
    if (!isValidAddress(recipientAddress)) {
        window.CryptoWalletApp.utils.showToast(
            '유효하지 않은 주소입니다.'
        );
        return;
    }

    if (sendAmount <= 0) {
        window.CryptoWalletApp.utils.showToast(
            '전송 금액을 입력해주세요.'
        );
        return;
    }

    const availableBalance = getAvailableBalance();
    if (sendAmount > availableBalance) {
        window.CryptoWalletApp.utils.showToast(
            '잔액이 부족합니다.'
        );
        return;
    }

    // 확인 모달 표시
    showConfirmModal(
        recipientAddress,
        sendAmount,
        gasLimit,
        memo
    );
}

function showConfirmModal(
    recipientAddress,
    sendAmount,
    gasLimit,
    memo
) {
    const app = window.CryptoWalletApp;
    const chainInfo = app.getChainInfo();

    // 수수료 계산 - 객체에서 amount 추출
    const feeObj = app.calculateFee(gasLimit);
    const feeAmount = app.baseToDisplay(feeObj.amount); // uatom을 ATOM으로 변환
    const totalAmount = sendAmount + parseFloat(feeAmount);

    // 소수점 자릿수 제한 (6자리)
    const formattedSendAmount = sendAmount.toFixed(6);
    const formattedFeeAmount =
        parseFloat(feeAmount).toFixed(6);
    const formattedTotalAmount = totalAmount.toFixed(6);

    const confirmContent = document.getElementById(
        'confirmContent'
    );
    confirmContent.innerHTML = `
        <div class="confirm-item">
            <span class="confirm-label">받는 주소:</span>
            <span class="confirm-value">${app.utils.shortenAddress(
                recipientAddress,
                12
            )}</span>
        </div>
        <div class="confirm-item">
            <span class="confirm-label">전송 금액:</span>
            <span class="confirm-value">${formattedSendAmount} ${
        chainInfo.symbol
    }</span>
        </div>
        <div class="confirm-item">
            <span class="confirm-label">수수료:</span>
            <span class="confirm-value">${formattedFeeAmount} ${
        chainInfo.symbol
    }</span>
        </div>
        <div class="confirm-item">
            <span class="confirm-label">총 전송:</span>
            <span class="confirm-value">${formattedTotalAmount} ${
        chainInfo.symbol
    }</span>
        </div>
        ${
            memo
                ? `
        <div class="confirm-item">
            <span class="confirm-label">메모:</span>
            <span class="confirm-value">${memo}</span>
        </div>
        `
                : ''
        }
    `;

    // 전송 데이터 저장 - feeAmount를 문자열로 저장
    window.sendData = {
        recipientAddress,
        sendAmount,
        gasLimit,
        memo,
        fee: formattedFeeAmount, // 포맷된 문자열로 저장
        totalAmount: formattedTotalAmount, // 포맷된 문자열로 저장
    };

    document.getElementById('confirmModal').style.display =
        'block';
}

function closeConfirmModal() {
    document.getElementById('confirmModal').style.display =
        'none';
}

// 트랜잭션 전송 시에도 connectToRPC로 client를 받아서 사용
async function confirmSend() {
    const sendData = window.sendData;
    if (!sendData) {
        window.CryptoWalletApp.utils.showToast(
            '전송 데이터가 없습니다.'
        );
        return;
    }

    try {
        showLoading(true, '전송 중...');

        const app = window.CryptoWalletApp;
        const connection = await connectToRPC();

        if (!connection) {
            throw new Error(
                'RPC 서버에 연결할 수 없습니다.'
            );
        }

        const { client, rpcUrl } = connection;

        // 개인키로부터 지갑 생성
        const wallet =
            await app.cosmos.createWalletFromPrivateKey(
                app.wallet.privateKey
            );

        // 서명 클라이언트 연결
        const signingClient =
            await app.cosmos.connectSigningClient(
                rpcUrl,
                wallet
            );

        // 표시 단위를 기본 단위로 변환
        const baseAmount = app.displayToBase(
            sendData.sendAmount.toString()
        );

        // 토큰 전송 실행
        const result = await app.cosmos.sendTokens(
            signingClient,
            app.wallet.address,
            sendData.recipientAddress,
            baseAmount,
            null, // denom (기본값 사용)
            sendData.memo || ''
        );

        if (result && result.hash) {
            window.CryptoWalletApp.utils.showToast(
                '전송이 성공했습니다!',
                5000
            );

            // 모달 닫기
            document.getElementById(
                'confirmModal'
            ).style.display = 'none';

            // 잔액 새로고침
            await loadBalance();

            // 입력 필드 초기화
            document.getElementById(
                'recipientAddress'
            ).value = '';
            document.getElementById('sendAmount').value =
                '';
            document.getElementById('gasLimit').value =
                '200000';
            document.getElementById('memo').value = '';

            // 요약 숨기기
            hideSendSummary();

            console.log('전송 성공:', result);
        } else {
            throw new Error(
                '전송 결과가 올바르지 않습니다.'
            );
        }
    } catch (error) {
        console.error('전송 실패:', error);
        window.CryptoWalletApp.utils.showToast(
            `전송 실패: ${error.message}`,
            5000
        );
    } finally {
        showLoading(false);
    }
}

function enableSendButton() {
    const sendButton =
        document.getElementById('sendButton');
    sendButton.disabled = false;
}

function showLoading(show, text = '로딩 중...') {
    const loadingOverlay = document.getElementById(
        'loadingOverlay'
    );
    const loadingText =
        document.getElementById('loadingText');

    if (loadingOverlay) {
        if (show) {
            loadingOverlay.classList.add('show');
            loadingText.textContent = text;
        } else {
            loadingOverlay.classList.remove('show');
        }
    }
}

function goBack() {
    window.CryptoWalletApp.goBack();
}
