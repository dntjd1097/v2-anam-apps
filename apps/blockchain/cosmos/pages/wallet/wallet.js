// 지갑 페이지 JavaScript

let walletAddress = '';
let currentBalance = '0';
let privateKeyVisible = false;

// 페이지 로드 시 초기화
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

        // 지갑이 로드되었는지 확인
        if (!window.cosmosWallet.wallet) {
            console.log(
                '지갑이 로드되지 않았습니다. 지갑 복원을 시도합니다...'
            );
            // 지갑 복원을 시도하지만 계속 진행
        }

        try {
            console.log('지갑 페이지 초기화 시작...');
            console.log('cosmosWallet 상태:', {
                exists: !!window.cosmosWallet,
                isInitialized:
                    window.cosmosWallet?.isInitialized,
                hasWallet: !!window.cosmosWallet?.wallet,
            });

            // 지갑 주소 표시
            await loadWalletInfo();

            // 잔액 조회
            await loadBalance();

            // 거래 내역 조회
            await loadTransactions();

            // 설정 정보 표시
            await displayChainInfo();

            console.log('지갑 페이지 초기화 완료');
        } catch (error) {
            console.error(
                '지갑 페이지 초기화 오류:',
                error
            );
            if (window.WalletUtils) {
                WalletUtils.showMessage(
                    '지갑 정보를 불러오는데 실패했습니다.',
                    'error'
                );
            } else {
                alert(
                    '지갑 정보를 불러오는데 실패했습니다.'
                );
            }
        }
    };

    // 지갑 초기화 대기 시작
    waitForWallet();
});

// 체인 정보 표시
async function displayChainInfo() {
    try {
        // 전역 설정에서 체인 정보 가져오기
        const chainInfo =
            window.CosmosConfig.getChainInfo();
        if (chainInfo) {
            console.log('체인 정보:', chainInfo);
        }
    } catch (error) {
        console.error('체인 정보 표시 오류:', error);
    }
}

// 체인 정보 모달 표시
async function showChainInfo() {
    const modal = document.getElementById('chainInfoModal');
    const detailsContainer = document.getElementById(
        'chainInfoDetails'
    );

    modal.style.display = 'block';
    closeSettingsModal();

    // 체인 정보 로드 및 표시
    await loadChainInfoDetails(detailsContainer);
}

// 체인 정보 모달 닫기
function closeChainInfoModal() {
    const modal = document.getElementById('chainInfoModal');
    modal.style.display = 'none';
}

// 체인 정보 상세 로드
async function loadChainInfoDetails(container) {
    try {
        // 전역 설정에서 정보 가져오기
        const chainInfo =
            window.CosmosConfig.getChainInfo();
        const assetInfo =
            window.CosmosConfig.getAssetInfo();
        const feeInfo = window.CosmosConfig.getFeeInfo();
        const rpcEndpoints =
            window.CosmosConfig.getRpcEndpoints();
        const restEndpoints =
            window.CosmosConfig.getRestEndpoints();
        const explorers =
            window.CosmosConfig.getExplorers();

        let html = '<div class="chain-info-section">';

        // 기본 체인 정보
        if (chainInfo) {
            html += `
                <div class="info-group">
                    <h3>기본 정보</h3>
                    <div class="info-item">
                        <span class="info-label">체인 이름:</span>
                        <span class="info-value">${chainInfo.prettyName}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">체인 ID:</span>
                        <span class="info-value">${chainInfo.chainId}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">상태:</span>
                        <span class="info-value">${chainInfo.status}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">네트워크:</span>
                        <span class="info-value">${chainInfo.networkType}</span>
                    </div>
                </div>
            `;
        }

        // 자산 정보
        if (assetInfo) {
            html += `
                <div class="info-group">
                    <h3>자산 정보</h3>
                    <div class="info-item">
                        <span class="info-label">토큰:</span>
                        <span class="info-value">${assetInfo.name}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">심볼:</span>
                        <span class="info-value">${assetInfo.symbol}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">베이스 단위:</span>
                        <span class="info-value">${assetInfo.base}</span>
                    </div>
                </div>
            `;
        }

        // 수수료 정보
        if (feeInfo) {
            html += `
                <div class="info-group">
                    <h3>수수료 정보</h3>
                    <div class="info-item">
                        <span class="info-label">평균 가스 가격:</span>
                        <span class="info-value">${feeInfo.average_gas_price} uatom</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">최소 가스 가격:</span>
                        <span class="info-value">${feeInfo.fixed_min_gas_price} uatom</span>
                    </div>
                </div>
            `;
        }

        // API 엔드포인트
        if (rpcEndpoints.length > 0) {
            html += `
                <div class="info-group">
                    <h3>RPC 엔드포인트</h3>
                    <div class="info-item">
                        <span class="info-label">기본 RPC:</span>
                        <span class="info-value">${rpcEndpoints[0].address}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">제공자:</span>
                        <span class="info-value">${rpcEndpoints[0].provider}</span>
                    </div>
                </div>
            `;
        }

        html += '</div>';

        container.innerHTML = html;
    } catch (error) {
        console.error('체인 정보 로드 오류:', error);
        container.innerHTML = `
            <div class="error-state">
                <div class="error-state-icon">⚠️</div>
                <p>체인 정보를 불러올 수 없습니다</p>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// 지갑 정보 로드
async function loadWalletInfo() {
    try {
        // 지갑이 로드되어 있는지 확인
        if (!window.cosmosWallet.wallet) {
            console.log(
                '지갑이 로드되지 않았습니다. 지갑 복원 시도...'
            );

            // localStorage에서 지갑 정보 로드
            const walletInfo =
                window.cosmosWallet.loadWalletInfo();
            if (walletInfo && walletInfo.mnemonic) {
                console.log(
                    '저장된 지갑 정보 발견, 복원 시도...'
                );
                const result =
                    await window.cosmosWallet.restoreWallet(
                        walletInfo.mnemonic
                    );
                if (!result.success) {
                    throw new Error(
                        '지갑 복원 실패: ' + result.error
                    );
                }
            } else {
                throw new Error(
                    '저장된 지갑 정보가 없습니다.'
                );
            }
        }

        // 지갑 주소 가져오기
        if (window.cosmosWallet.wallet) {
            walletAddress = await CosmosJS.getWalletAddress(
                window.cosmosWallet.wallet
            );
            if (walletAddress) {
                document.getElementById(
                    'walletAddress'
                ).innerHTML = `
                    <span class="address-text">${walletAddress}</span>
                `;
                console.log(
                    '지갑 주소 로드 성공:',
                    walletAddress
                );
            } else {
                throw new Error(
                    '지갑 주소를 가져올 수 없습니다.'
                );
            }
        } else {
            throw new Error('지갑이 로드되지 않았습니다.');
        }
    } catch (error) {
        console.error('지갑 주소 로드 오류:', error);
        document.getElementById(
            'walletAddress'
        ).innerHTML = `
            <span class="address-text error">지갑 주소를 불러올 수 없습니다.</span>
        `;
    }
}

// 잔액 조회
async function loadBalance() {
    try {
        console.log('잔액 조회 시작...');
        console.log('지갑 상태:', {
            hasWallet: !!window.cosmosWallet?.wallet,
            isInitialized:
                window.cosmosWallet?.isInitialized,
        });

        const result =
            await window.cosmosWallet.getBalance();
        console.log('잔액 조회 결과:', result);

        if (result.success) {
            const balance = result.balance;
            currentBalance = balance;

            console.log('잔액 정보:', {
                raw: balance,
                formatted: balance.formatted,
                denom: balance.denom,
            });

            // ATOM 잔액 표시
            const atomBalance = window.WalletUtils
                ? WalletUtils.formatAmount(
                      balance.formatted || balance,
                      6
                  )
                : parseFloat(
                      balance.formatted || balance
                  ).toFixed(6);
            document.getElementById(
                'balanceAmount'
            ).textContent = atomBalance;

            // USD 환산 금액 표시
            const usdBalance = window.WalletUtils
                ? WalletUtils.convertToUSD(
                      balance.formatted || balance
                  )
                : (
                      parseFloat(
                          balance.formatted || balance
                      ) * 10.5
                  ).toFixed(2);
            document.getElementById(
                'balanceUSD'
            ).textContent = `≈ $${usdBalance} USD`;

            console.log('잔액 표시 완료:', {
                atomBalance,
                usdBalance,
            });
        } else {
            console.error('잔액 조회 실패:', result.error);
            document.getElementById(
                'balanceAmount'
            ).textContent = '0.000000';
            document.getElementById(
                'balanceUSD'
            ).textContent = '≈ $0.00 USD';
        }
    } catch (error) {
        console.error('잔액 조회 오류:', error);
        document.getElementById(
            'balanceAmount'
        ).textContent = '0.000000';
        document.getElementById('balanceUSD').textContent =
            '≈ $0.00 USD';
    }
}

// 잔액 조회 테스트 함수 (디버깅용)
window.testBalance = async () => {
    try {
        console.log('=== 잔액 조회 테스트 시작 ===');

        // 1. 지갑 상태 확인
        console.log('1. 지갑 상태:', {
            hasWallet: !!window.cosmosWallet?.wallet,
            isInitialized:
                window.cosmosWallet?.isInitialized,
            hasCosmosJS: typeof CosmosJS !== 'undefined',
        });

        // 2. CosmosJS 설정 확인
        if (typeof CosmosJS !== 'undefined') {
            try {
                const config = CosmosJS.getConfig();
                console.log('2. CosmosJS 설정:', config);
            } catch (e) {
                console.log(
                    '2. CosmosJS 설정 로드 실패:',
                    e.message
                );
            }
        }

        // 3. RPC URL 확인
        if (typeof CosmosJS !== 'undefined') {
            try {
                const rpcUrl = CosmosJS.getDefaultRpcUrl();
                console.log('3. RPC URL:', rpcUrl);
            } catch (e) {
                console.log(
                    '3. RPC URL 가져오기 실패:',
                    e.message
                );
            }
        }

        // 4. 잔액 조회 시도 (자동 RPC 전환 포함)
        console.log(
            '4. 잔액 조회 시도... (CORS 문제 시 자동 전환)'
        );
        const result =
            await window.cosmosWallet.getBalance();
        console.log('4. 잔액 조회 결과:', result);

        console.log('=== 잔액 조회 테스트 완료 ===');
    } catch (error) {
        console.error('잔액 조회 테스트 실패:', error);
    }
};

// 거래 내역 조회
async function loadTransactions() {
    const container = document.getElementById(
        'transactionsContainer'
    );

    try {
        // 지갑 주소를 가져와서 트랜잭션 조회
        const walletAddress =
            await window.cosmosWallet.getWalletAddress();
        console.log(
            '지갑 주소로 트랜잭션 조회:',
            walletAddress
        );

        const result =
            await window.cosmosWallet.getTransactions(
                walletAddress,
                5
            );

        if (
            result.success &&
            result.transactions.length > 0
        ) {
            displayTransactions(result.transactions);
        } else {
            displayNoTransactions();
        }
    } catch (error) {
        console.error('거래 내역 조회 오류:', error);
        displayTransactionError(error.message);
    }
}

// 거래 내역 표시
function displayTransactions(transactions) {
    const container = document.getElementById(
        'transactionsContainer'
    );

    const transactionsHTML = transactions
        .map((tx) => {
            const amount = tx.amount || '0';
            const isReceived =
                tx.type === 'received' ||
                tx.to === walletAddress;
            const amountClass = isReceived
                ? 'received'
                : 'sent';
            const amountPrefix = isReceived ? '+' : '-';

            return `
            <div class="transaction-item">
                <div class="transaction-info">
                    <div class="transaction-amount ${amountClass}">
                        ${amountPrefix}${WalletUtils.formatAmount(
                amount,
                6
            )} ATOM
                    </div>
                    <div class="transaction-date">
                        ${formatTransactionDate(
                            tx.timestamp
                        )}
                    </div>
                    <div class="transaction-hash">
                        ${WalletUtils.shortenAddress(
                            tx.hash || '',
                            8,
                            6
                        )}
                    </div>
                </div>
            </div>
        `;
        })
        .join('');

    container.innerHTML = transactionsHTML;
}

// 거래 내역 없음 표시
function displayNoTransactions() {
    const container = document.getElementById(
        'transactionsContainer'
    );
    container.innerHTML = `
        <div class="no-transactions">
            <div class="no-transactions-icon">📄</div>
            <p>거래 내역이 없습니다</p>
            <p>첫 번째 거래를 시작해보세요!</p>
        </div>
    `;
}

// 거래 내역 오류 표시
function displayTransactionError(errorMessage) {
    const container = document.getElementById(
        'transactionsContainer'
    );
    container.innerHTML = `
        <div class="error-state">
            <div class="error-state-icon">⚠️</div>
            <p>거래 내역을 불러올 수 없습니다</p>
            <p>${errorMessage}</p>
            <button class="retry-btn" onclick="loadTransactions()">다시 시도</button>
        </div>
    `;
}

// 거래 내역 새로고침
async function refreshTransactions() {
    const container = document.getElementById(
        'transactionsContainer'
    );
    container.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>거래 내역을 새로고침하는 중...</p>
        </div>
    `;

    await loadTransactions();
}

// 거래 날짜 포맷팅
function formatTransactionDate(timestamp) {
    if (!timestamp) return '알 수 없음';

    try {
        const date = new Date(timestamp);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch (error) {
        return '알 수 없음';
    }
}

// 주소 복사
function copyAddress() {
    if (walletAddress) {
        navigator.clipboard
            .writeText(walletAddress)
            .then(() => {
                WalletUtils.showMessage(
                    '주소가 클립보드에 복사되었습니다.',
                    'success'
                );
            })
            .catch(() => {
                // 클립보드 API가 지원되지 않는 경우
                const textArea =
                    document.createElement('textarea');
                textArea.value = walletAddress;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                WalletUtils.showMessage(
                    '주소가 클립보드에 복사되었습니다.',
                    'success'
                );
            });
    }
}

// 뒤로 가기
function goBack() {
    window.history.back();
}

// 전송 페이지로 이동
function goToSend() {
    window.location.href = '../send/send.html';
}

// 받기 페이지로 이동
function goToReceive() {
    window.location.href = '../receive/receive.html';
}

function goToTest() {
    window.location.href = '../test/test.html';
}

// 설정 모달 표시
function showSettings() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'block';
}

// 설정 모달 닫기
function closeSettingsModal() {
    const modal = document.getElementById('settingsModal');
    modal.style.display = 'none';
}

// 개인키 모달 표시
async function showPrivateKey() {
    try {
        const walletInfo =
            window.cosmosWallet.loadWalletInfo();
        if (walletInfo && walletInfo.mnemonic) {
            const result = await CosmosJS.extractPrivateKey(
                walletInfo.mnemonic
            );

            if (result.success) {
                document.getElementById(
                    'privateKeyInput'
                ).value = result.data.privateKey;
                privateKeyVisible = false;
                document.getElementById(
                    'privateKeyInput'
                ).type = 'password';

                const modal = document.getElementById(
                    'privateKeyModal'
                );
                modal.style.display = 'block';
                closeSettingsModal();
            } else {
                WalletUtils.showMessage(
                    '개인키 추출에 실패했습니다: ' +
                        result.error,
                    'error'
                );
            }
        } else {
            WalletUtils.showMessage(
                '지갑 정보를 찾을 수 없습니다.',
                'error'
            );
        }
    } catch (error) {
        console.error('개인키 표시 오류:', error);
        WalletUtils.showMessage(
            '개인키를 표시할 수 없습니다.',
            'error'
        );
    }
}

// 개인키 모달 닫기
function closePrivateKeyModal() {
    const modal = document.getElementById(
        'privateKeyModal'
    );
    modal.style.display = 'none';
}

// 개인키 표시/숨김 토글
function togglePrivateKeyVisibility() {
    const input = document.getElementById(
        'privateKeyInput'
    );
    privateKeyVisible = !privateKeyVisible;

    if (privateKeyVisible) {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
}

// 개인키 복사
function copyPrivateKey() {
    const input = document.getElementById(
        'privateKeyInput'
    );
    const privateKey = input.value;

    if (privateKey) {
        navigator.clipboard
            .writeText(privateKey)
            .then(() => {
                WalletUtils.showMessage(
                    '개인키가 클립보드에 복사되었습니다.',
                    'success'
                );
            })
            .catch(() => {
                // 클립보드 API가 지원되지 않는 경우
                const textArea =
                    document.createElement('textarea');
                textArea.value = privateKey;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                WalletUtils.showMessage(
                    '개인키가 클립보드에 복사되었습니다.',
                    'success'
                );
            });
    }
}

// 지갑 내보내기
function exportWallet() {
    try {
        const walletInfo =
            window.cosmosWallet.loadWalletInfo();
        if (walletInfo) {
            const exportData = {
                address: walletAddress,
                mnemonic: walletInfo.mnemonic,
                exportDate: new Date().toISOString(),
            };

            const dataStr = JSON.stringify(
                exportData,
                null,
                2
            );
            const dataBlob = new Blob([dataStr], {
                type: 'application/json',
            });

            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `cosmos-wallet-${walletAddress.substring(
                0,
                8
            )}.json`;
            link.click();

            WalletUtils.showMessage(
                '지갑 정보가 내보내기되었습니다.',
                'success'
            );
            closeSettingsModal();
        } else {
            WalletUtils.showMessage(
                '지갑 정보를 찾을 수 없습니다.',
                'error'
            );
        }
    } catch (error) {
        console.error('지갑 내보내기 오류:', error);
        WalletUtils.showMessage(
            '지갑 내보내기에 실패했습니다.',
            'error'
        );
    }
}

// 지갑 삭제
function clearWallet() {
    if (
        confirm(
            '정말로 지갑을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.'
        )
    ) {
        window.cosmosWallet.clearWalletInfo();
        WalletUtils.showMessage(
            '지갑이 삭제되었습니다.',
            'success'
        );

        // 시작 페이지로 이동
        setTimeout(() => {
            window.location.href = '../index/index.html';
        }, 1500);
    }
}

// 모달 외부 클릭 시 닫기
window.onclick = function (event) {
    const settingsModal =
        document.getElementById('settingsModal');
    const privateKeyModal = document.getElementById(
        'privateKeyModal'
    );
    const chainInfoModal = document.getElementById(
        'chainInfoModal'
    );

    if (event.target === settingsModal) {
        closeSettingsModal();
    }

    if (event.target === privateKeyModal) {
        closePrivateKeyModal();
    }

    if (event.target === chainInfoModal) {
        closeChainInfoModal();
    }
};
