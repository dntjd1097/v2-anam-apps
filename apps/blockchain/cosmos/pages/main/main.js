// Main 페이지 스크립트
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
    displayWalletInfo();
    loadBalance();
    loadRecentTransactions();
    updateChainInfo();

    // 이벤트 리스너 설정
    setupEventListeners();
}

function updateChainInfo() {
    const app = window.CryptoWalletApp;
    const chainInfo = app.getChainInfo();

    // 페이지 제목 업데이트
    const titleElement =
        document.querySelector('.header h1');
    if (titleElement) {
        titleElement.textContent = `${chainInfo.prettyName} Wallet`;
    }

    // 잔액 카드의 심볼 업데이트
    const balanceSymbol = document.querySelector(
        '.balance-symbol'
    );
    if (balanceSymbol) {
        balanceSymbol.textContent = chainInfo.symbol;
    }

    // 체인 정보 로그
    console.log('체인 정보 업데이트:', {
        name: chainInfo.name,
        prettyName: chainInfo.prettyName,
        symbol: chainInfo.symbol,
        denom: chainInfo.denom,
        decimals: chainInfo.decimals,
        coingeckoId: app.chainConfig.assets[0].coingecko_id,
    });
}

function displayWalletInfo() {
    const app = window.CryptoWalletApp;
    const addressElement =
        document.getElementById('walletAddress');

    if (app.wallet && app.wallet.address) {
        // addressElement.textContent =
        //     app.utils.shortenAddress(
        //         app.wallet.address,
        //         12
        //     );
        addressElement.textContent = app.wallet.address;
    } else {
        addressElement.textContent =
            '주소를 불러올 수 없습니다';
    }
}

async function loadBalance() {
    const app = window.CryptoWalletApp;
    const balanceElement =
        document.getElementById('balanceAmount');
    const balanceUsdElement =
        document.getElementById('balanceUsd');

    try {
        showLoading(true);

        // 여러 RPC 엔드포인트 시도
        const client = await connectToRPC();

        if (!client) {
            throw new Error(
                '모든 RPC 서버에 연결할 수 없습니다.'
            );
        }

        // 잔액 조회
        const balance = await app.cosmos.getBalance(
            client,
            app.wallet.address
        );

        // 체인 설정 기반으로 잔액 표시
        const chainInfo = app.getChainInfo();
        const displayAmount = app.baseToDisplay(
            balance.amount
        );

        balanceElement.textContent = app.utils.formatAmount(
            displayAmount,
            chainInfo.decimals
        );

        // USD 가치 계산 (실제 CoinGecko API 사용)
        const usdValue = await calculateUsdValue(
            displayAmount
        );
        balanceUsdElement.textContent = `≈ $${usdValue}`;

        console.log('잔액 로드 완료:', {
            amount: balance.amount,
            denom: balance.denom,
            display: displayAmount,
            usdValue: usdValue,
            chainInfo: chainInfo,
        });
    } catch (error) {
        console.error('잔액 로드 실패:', error);
        balanceElement.textContent = '0.000000';
        balanceUsdElement.textContent = '≈ $0.00';
        app.utils.showToast(
            '잔액을 불러오는데 실패했습니다. 네트워크 연결을 확인해주세요.'
        );
    } finally {
        showLoading(false);
    }
}

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

            // 연결 테스트
            await client.getChainId();

            console.log('RPC 연결 성공:', rpcUrl);
            return client;
        } catch (error) {
            console.log(
                `RPC 연결 실패 ${i + 1}/${
                    rpcEndpoints.length
                }:`,
                rpcUrl,
                error.message
            );

            // 마지막 시도가 아니면 계속 시도
            if (i < rpcEndpoints.length - 1) {
                await new Promise((resolve) =>
                    setTimeout(resolve, 1000)
                ); // 1초 대기
                continue;
            }
        }
    }

    // 모든 RPC 엔드포인트 실패 시 더미 데이터 반환
    console.log('모든 RPC 연결 실패, 더미 데이터 사용');
    return createDummyClient();
}

function createDummyClient() {
    const app = window.CryptoWalletApp;
    const chainInfo = app.getChainInfo();

    // 더미 클라이언트 생성 (개발/테스트용)
    return {
        getChainId: async () => chainInfo.chainId,
        getBalance: async (address) => {
            const dummyAmount =
                app.displayToBase('1.000000'); // 1 토큰
            return {
                amount: dummyAmount,
                denom: chainInfo.denom,
                formatted: '1.000000',
            };
        },
        getTransactions: async (address, limit) => [],
    };
}

async function calculateUsdValue(amount) {
    const app = window.CryptoWalletApp;
    const chainInfo = app.getChainInfo();

    try {
        // CoinGecko API에서 실제 가격 조회
        const price = await app.getCachedPrice();

        if (price !== null) {
            const usdValue = parseFloat(amount) * price;
            return usdValue.toFixed(2);
        } else {
            // 가격 조회 실패 시 기본 가격 사용
            const fallbackPrices = {
                uatom: 8.5, // ATOM
                uosmo: 0.5, // OSMO
                uinit: 0.1, // INIT (예시)
            };

            const fallbackPrice =
                fallbackPrices[chainInfo.denom] || 1.0;
            const usdValue =
                parseFloat(amount) * fallbackPrice;
            return usdValue.toFixed(2);
        }
    } catch (error) {
        console.error('USD 가치 계산 실패:', error);

        // 에러 시 기본 가격 사용
        const fallbackPrices = {
            uatom: 8.5,
            uosmo: 0.5,
            uinit: 0.1,
        };

        const fallbackPrice =
            fallbackPrices[chainInfo.denom] || 1.0;
        const usdValue = parseFloat(amount) * fallbackPrice;
        return usdValue.toFixed(2);
    }
}

async function loadRecentTransactions() {
    const app = window.CryptoWalletApp;
    const transactionList = document.getElementById(
        'transactionList'
    );

    try {
        // RPC 클라이언트 연결
        const client = await connectToRPC();

        if (!client) {
            displayNoTransactions();
            return;
        }

        // 실제 거래 내역 조회
        const transactions = await getRealTransactions(
            client
        );

        if (transactions && transactions.length > 0) {
            displayTransactions(transactions);
        } else {
            displayNoTransactions();
        }

        console.log('거래 내역 로드 완료:', transactions);
    } catch (error) {
        console.error('거래 내역 로드 실패:', error);
        displayNoTransactions();
    }
}

// 실제 거래 내역 조회 함수
async function getRealTransactions(client) {
    const app = window.CryptoWalletApp;
    const address = app.wallet.address;
    const chainInfo = app.getChainInfo();

    try {
        // 여러 쿼리 방식 시도
        let transactions = [];

        try {
            // 방법 1: 기본 쿼리
            transactions = await client.searchTx(
                `message.sender='${address}' OR message.recipient='${address}'`,
                10
            );
        } catch (error) {
            console.log(
                '기본 쿼리 실패, 대체 쿼리 시도:',
                error.message
            );

            try {
                // 방법 2: 단순 주소 쿼리
                transactions = await client.searchTx(
                    `transfer.recipient='${address}'`,
                    10
                );
            } catch (error2) {
                console.log(
                    '단순 쿼리 실패, 최종 쿼리 시도:',
                    error2.message
                );

                try {
                    // 방법 3: 가장 기본적인 쿼리
                    transactions = await client.searchTx(
                        `"${address}"`,
                        10
                    );
                } catch (error3) {
                    console.log(
                        '모든 쿼리 실패:',
                        error3.message
                    );
                    return [];
                }
            }
        }

        // 거래 내역 파싱 및 변환
        return transactions.map((tx) =>
            parseTransaction(tx, address, chainInfo)
        );
    } catch (error) {
        console.error('거래 내역 조회 실패:', error);
        return [];
    }
}

// 거래 내역 파싱 함수
function parseTransaction(tx, address, chainInfo) {
    const app = window.CryptoWalletApp;

    // 기본 거래 정보
    const transaction = {
        hash: tx.hash,
        height: tx.height?.toString?.() || tx.height,
        timestamp: tx.timestamp,
        code: tx.code,
        gasUsed: tx.gasUsed?.toString?.() || tx.gasUsed,
        gasWanted:
            tx.gasWanted?.toString?.() || tx.gasWanted,
        events: tx.events || [],
        amount: '0',
        denom: chainInfo.denom,
        type: 'unknown',
    };

    // 이벤트에서 전송 정보 추출
    if (tx.events) {
        for (const event of tx.events) {
            if (event.type === 'transfer') {
                const transferInfo = parseTransferEvent(
                    event,
                    address,
                    chainInfo
                );
                if (transferInfo) {
                    transaction.amount =
                        transferInfo.amount;
                    transaction.denom = transferInfo.denom;
                    transaction.type = transferInfo.type;
                    break;
                }
            }
        }
    }

    return transaction;
}

// 전송 이벤트 파싱 함수
function parseTransferEvent(event, address, chainInfo) {
    const app = window.CryptoWalletApp;

    if (!event.attributes) return null;

    let sender = '';
    let recipient = '';
    let amount = '';
    let denom = chainInfo.denom;

    // 이벤트 속성에서 정보 추출
    for (const attr of event.attributes) {
        switch (attr.key) {
            case 'sender':
                sender = attr.value;
                break;
            case 'recipient':
                recipient = attr.value;
                break;
            case 'amount':
                amount = attr.value;
                break;
            case 'denom':
                denom = attr.value;
                break;
        }
    }

    // 전송 방향 결정
    let type = 'unknown';
    if (sender === address) {
        type = 'send';
    } else if (recipient === address) {
        type = 'receive';
    }

    // 금액 파싱 (여러 토큰이 있을 수 있음)
    let parsedAmount = '0';
    if (amount) {
        const amounts = amount.split(',');
        for (const amt of amounts) {
            if (amt.endsWith(denom)) {
                parsedAmount = amt.replace(denom, '');
                break;
            }
        }
    }

    return {
        type,
        amount: parsedAmount,
        denom,
        sender,
        recipient,
    };
}

function displayTransactions(transactions) {
    const app = window.CryptoWalletApp;
    const chainInfo = app.getChainInfo();
    const transactionList = document.getElementById(
        'transactionList'
    );

    const transactionHtml = transactions
        .map((tx) => {
            const type = tx.type;
            const icon = type === 'receive' ? '📥' : '📤';
            const amount = app.baseToDisplay(
                tx.amount || '0'
            );
            const date = app.utils.formatDate(tx.timestamp);

            return `
                <div class="transaction-item" onclick="viewTransaction('${tx.hash}')">
                    <div class="transaction-icon ${type}">
                        ${icon}
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-amount">${amount} ${chainInfo.symbol}</div>
                        <div class="transaction-date">${date}</div>
                    </div>
                </div>
            `;
        })
        .join('');

    transactionList.innerHTML = transactionHtml;
}

function displayNoTransactions() {
    const transactionList = document.getElementById(
        'transactionList'
    );
    transactionList.innerHTML = `
        <div class="no-transactions">
            <div
                class="no-transactions-icon"
            >
                📋
            </div>
            <div
                class="no-transactions-text"
            >
                거래 내역이 없습니다
            </div>
        </div>
    `;
}

function setupEventListeners() {
    // 새로고침 버튼
    const refreshBtn =
        document.querySelector('.refresh-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshData);
    }
}

function refreshData() {
    loadBalance();
    loadRecentTransactions();
    window.CryptoWalletApp.utils.showToast(
        '데이터를 새로고침했습니다.'
    );
}

function showLoading(show) {
    const loadingOverlay = document.getElementById(
        'loadingOverlay'
    );
    if (loadingOverlay) {
        if (show) {
            loadingOverlay.classList.add('show');
        } else {
            loadingOverlay.classList.remove('show');
        }
    }
}

// 네비게이션 함수들
function goToSend() {
    window.CryptoWalletApp.navigateTo('send');
}

function goToReceive() {
    window.CryptoWalletApp.navigateTo('receive');
}

function goToHistory() {
    window.CryptoWalletApp.navigateTo('history');
}

function goToSettings() {
    window.CryptoWalletApp.navigateTo('settings');
}

function copyAddress() {
    const app = window.CryptoWalletApp;
    if (app.wallet && app.wallet.address) {
        app.utils.copyToClipboard(app.wallet.address);
    } else {
        app.utils.showToast('주소를 복사할 수 없습니다.');
    }
}

function viewTransaction(hash) {
    // 거래 상세 보기 (나중에 구현)
    console.log('거래 상세 보기:', hash);
    window.CryptoWalletApp.utils.showToast(
        '거래 상세 기능은 준비 중입니다.'
    );
}
