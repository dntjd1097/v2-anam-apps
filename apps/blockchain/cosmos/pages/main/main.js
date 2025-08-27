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
        hash: tx.txhash || tx.hash,
        height: tx.height?.toString?.() || tx.height,
        timestamp: tx.timestamp,
        code: tx.code,
        gasUsed:
            tx.gas_used?.toString?.() ||
            tx.gasUsed?.toString?.() ||
            tx.gasUsed,
        gasWanted:
            tx.gas_wanted?.toString?.() ||
            tx.gasWanted?.toString?.() ||
            tx.gasWanted,
        events: tx.events || [],
        amount: '0',
        denom: chainInfo.denom,
        type: 'unknown',
        memo: '',
        fee: '0',
        feeDenom: chainInfo.denom,
    };

    // fee_pay 이벤트에서 수수료 정보 추출
    if (tx.events) {
        for (const event of tx.events) {
            if (
                event.type === 'fee_pay' &&
                event.attributes
            ) {
                for (const attr of event.attributes) {
                    if (attr.key === 'fee') {
                        const feeValue = attr.value;
                        if (
                            feeValue &&
                            feeValue.includes('uatom')
                        ) {
                            transaction.fee =
                                feeValue.replace(
                                    'uatom',
                                    ''
                                );
                            transaction.feeDenom = 'uatom';
                            break;
                        }
                    }
                }
            }
        }
    }

    // tx body에서 transfer 정보 파싱 시도 (우선순위 1)
    if (tx.tx && tx.tx.body && tx.tx.body.messages) {
        const transferInfo = parseTxBodyTransfer(
            tx.tx.body,
            address,
            chainInfo
        );
        if (transferInfo) {
            transaction.amount = transferInfo.amount;
            transaction.denom = transferInfo.denom;
            transaction.type = transferInfo.type;
            transaction.sender = transferInfo.sender;
            transaction.recipient = transferInfo.recipient;
            transaction.memo = tx.tx.body.memo || '';

            // 수수료 정보 추가
            if (tx.tx.auth_info && tx.tx.auth_info.fee) {
                const fee = tx.tx.auth_info.fee.amount;
                if (fee && fee.length > 0) {
                    transaction.fee = fee[0].amount;
                    transaction.feeDenom = fee[0].denom;
                }
            }

            return transaction;
        }
    }

    // logs에서 transfer 정보 추출 (우선순위 2)
    if (tx.logs && Array.isArray(tx.logs)) {
        const transferInfo = parseLogsTransfer(
            tx.logs,
            address,
            chainInfo
        );
        if (transferInfo) {
            transaction.amount = transferInfo.amount;
            transaction.denom = transferInfo.denom;
            transaction.type = transferInfo.type;
            transaction.sender = transferInfo.sender;
            transaction.recipient = transferInfo.recipient;
            return transaction;
        }
    }

    // 이벤트에서 전송 정보 추출 (우선순위 3)
    if (tx.events) {
        const transferInfo = parseEventsTransfer(
            tx.events,
            address,
            chainInfo
        );
        if (transferInfo) {
            transaction.amount = transferInfo.amount;
            transaction.denom = transferInfo.denom;
            transaction.type = transferInfo.type;
            transaction.sender = transferInfo.sender;
            transaction.recipient = transferInfo.recipient;
        }
    }

    return transaction;
}

// tx body에서 transfer 정보 파싱하는 함수
function parseTxBodyTransfer(txBody, address, chainInfo) {
    try {
        console.log('=== TX BODY PARSING ===');
        console.log('Tx body:', txBody);

        if (
            !txBody.messages ||
            !Array.isArray(txBody.messages)
        ) {
            console.log('No messages found in tx body');
            return null;
        }

        // MsgSend 메시지 찾기
        for (const message of txBody.messages) {
            console.log('Processing message:', message);

            if (
                message['@type'] ===
                '/cosmos.bank.v1beta1.MsgSend'
            ) {
                console.log('Found MsgSend message');

                const fromAddress = message.from_address;
                const toAddress = message.to_address;
                const amounts = message.amount || [];

                console.log('Transfer details:', {
                    from: fromAddress,
                    to: toAddress,
                    amounts: amounts,
                });

                // 전송 방향 결정
                let type = 'unknown';
                if (fromAddress === address) {
                    type = 'send';
                } else if (toAddress === address) {
                    type = 'receive';
                }

                // 금액 파싱 (uatom 등)
                let parsedAmount = '0';
                let parsedDenom = chainInfo.denom;

                if (amounts.length > 0) {
                    const amount = amounts[0];
                    if (amount.denom && amount.amount) {
                        parsedAmount = amount.amount;
                        parsedDenom = amount.denom;

                        console.log('Parsed amount:', {
                            amount: parsedAmount,
                            denom: parsedDenom,
                        });
                    }
                }

                // 유효한 전송 정보가 있는 경우
                if (
                    parsedAmount !== '0' &&
                    (type === 'send' || type === 'receive')
                ) {
                    return {
                        type,
                        amount: parsedAmount,
                        denom: parsedDenom,
                        sender: fromAddress,
                        recipient: toAddress,
                    };
                }
            }
        }

        // 다른 메시지 타입들도 확인 (MsgMultiSend, MsgDelegate 등)
        for (const message of txBody.messages) {
            console.log(
                'Processing other message type:',
                message
            );

            // MsgMultiSend 처리
            if (
                message['@type'] ===
                '/cosmos.bank.v1beta1.MsgMultiSend'
            ) {
                const inputs = message.inputs || [];
                const outputs = message.outputs || [];

                // 입력에서 주소 찾기
                for (const input of inputs) {
                    if (input.address === address) {
                        const amount = input.coins?.[0];
                        if (
                            amount &&
                            amount.denom &&
                            amount.amount
                        ) {
                            return {
                                type: 'send',
                                amount: amount.amount,
                                denom: amount.denom,
                                sender: address,
                                recipient: 'Multiple',
                            };
                        }
                    }
                }

                // 출력에서 주소 찾기
                for (const output of outputs) {
                    if (output.address === address) {
                        const amount = output.coins?.[0];
                        if (
                            amount &&
                            amount.denom &&
                            amount.amount
                        ) {
                            return {
                                type: 'receive',
                                amount: amount.amount,
                                denom: amount.denom,
                                sender: 'Multiple',
                                recipient: address,
                            };
                        }
                    }
                }
            }

            // MsgDelegate 처리
            if (
                message['@type'] ===
                '/cosmos.staking.v1beta1.MsgDelegate'
            ) {
                if (message.delegator_address === address) {
                    const amount = message.amount;
                    if (
                        amount &&
                        amount.denom &&
                        amount.amount
                    ) {
                        return {
                            type: 'delegate',
                            amount: amount.amount,
                            denom: amount.denom,
                            sender: address,
                            recipient:
                                message.validator_address,
                        };
                    }
                }
            }
        }

        console.log(
            'No valid transfer message found in messages'
        );
        return null;
    } catch (error) {
        console.error(
            'Error parsing tx body transfer:',
            error
        );
        return null;
    }
}

// events 배열에서 transfer 정보 파싱하는 함수
function parseEventsTransfer(events, address, chainInfo) {
    try {
        console.log('=== EVENTS PARSING ===');
        console.log('Events:', events);

        // transfer 이벤트들을 모두 수집
        const transferEvents = events.filter(
            (event) => event.type === 'transfer'
        );
        console.log(
            'Found transfer events:',
            transferEvents
        );

        if (transferEvents.length === 0) {
            return null;
        }

        // 사용자 주소와 관련된 transfer 이벤트 찾기
        let bestTransfer = null;
        let maxAmount = 0;

        for (const event of transferEvents) {
            if (!event.attributes) continue;

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

            // 사용자와 관련이 없는 경우 스킵
            if (type === 'unknown') continue;

            // 금액 파싱
            let parsedAmount = 0;
            if (amount) {
                const amounts = amount.split(',');
                for (const amt of amounts) {
                    if (amt.endsWith(denom)) {
                        const amountValue = amt.replace(
                            denom,
                            ''
                        );
                        const numAmount =
                            parseInt(amountValue);
                        if (
                            !isNaN(numAmount) &&
                            numAmount > 0
                        ) {
                            parsedAmount = numAmount;
                            break;
                        }
                    }
                }
            }

            // 가장 큰 금액의 transfer를 선택 (실제 전송 금액일 가능성이 높음)
            if (parsedAmount > maxAmount) {
                maxAmount = parsedAmount;
                bestTransfer = {
                    type,
                    amount: parsedAmount.toString(),
                    denom,
                    sender,
                    recipient,
                };
            }
        }

        if (bestTransfer) {
            console.log(
                'Best transfer found:',
                bestTransfer
            );
            return bestTransfer;
        }

        console.log('No valid transfer found in events');
        return null;
    } catch (error) {
        console.error(
            'Error parsing events transfer:',
            error
        );
        return null;
    }
}

// logs에서 transfer 정보 파싱하는 함수
function parseLogsTransfer(logs, address, chainInfo) {
    try {
        console.log('=== LOGS PARSING ===');
        console.log('Logs:', logs);

        for (const log of logs) {
            if (!log.events || !Array.isArray(log.events)) {
                continue;
            }

            // transfer 이벤트 찾기
            for (const event of log.events) {
                if (
                    event.type === 'transfer' &&
                    event.attributes
                ) {
                    console.log(
                        'Found transfer event:',
                        event
                    );

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

                    // 금액 파싱 (uatom 등)
                    let parsedAmount = '0';
                    if (amount) {
                        // 여러 토큰이 있을 수 있음 (예: "10000uatom,5000uatom")
                        const amounts = amount.split(',');
                        for (const amt of amounts) {
                            if (amt.endsWith(denom)) {
                                const amountValue =
                                    amt.replace(denom, '');
                                // 수수료나 팁과 관련된 작은 금액은 제외 (일반적으로 1000uatom 미만)
                                // 실제 전송 금액은 보통 더 큰 값임
                                if (
                                    parseInt(amountValue) >=
                                    1000
                                ) {
                                    parsedAmount =
                                        amountValue;
                                    break;
                                }
                            }
                        }
                    }

                    // 유효한 전송 정보가 있는 경우
                    if (
                        parsedAmount !== '0' &&
                        (type === 'send' ||
                            type === 'receive')
                    ) {
                        console.log(
                            'Parsed transfer info from logs:',
                            {
                                type,
                                amount: parsedAmount,
                                denom,
                                sender,
                                recipient,
                            }
                        );

                        return {
                            type,
                            amount: parsedAmount,
                            denom,
                            sender,
                            recipient,
                        };
                    }
                }
            }
        }

        console.log('No valid transfer found in logs');
        return null;
    } catch (error) {
        console.error(
            'Error parsing logs transfer:',
            error
        );
        return null;
    }
}

// 전송 이벤트 파싱 함수
function parseTransferEvent(event, address, chainInfo) {
    const app = window.CryptoWalletApp;

    // type이 'transfer'인 경우에만 처리
    if (event.type !== 'transfer' || !event.attributes)
        return null;

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
                const amountValue = amt.replace(denom, '');
                // 수수료나 팁과 관련된 작은 금액은 제외 (일반적으로 1000uatom 미만)
                // 실제 전송 금액은 보통 더 큰 값임
                if (parseInt(amountValue) >= 1000) {
                    parsedAmount = amountValue;
                    break;
                }
            }
        }
    }

    // 유효한 금액이 없는 경우 null 반환
    if (parsedAmount === '0') {
        return null;
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
            let icon = '📤'; // 기본값
            if (type === 'receive') {
                icon = '📥';
            } else if (type === 'delegate') {
                icon = '🔒';
            } else if (type === 'send') {
                icon = '📤';
            }
            const amount = app.baseToDisplay(
                tx.amount || '0'
            );
            const date = app.utils.formatDate(tx.timestamp);

            // sender/recipient 정보 추가
            let addressInfo = '';
            if (tx.sender && tx.recipient) {
                if (type === 'send') {
                    addressInfo = `To: ${app.utils.shortenAddress(
                        tx.recipient,
                        8
                    )}`;
                } else if (type === 'receive') {
                    addressInfo = `From: ${app.utils.shortenAddress(
                        tx.sender,
                        8
                    )}`;
                }
            }

            // 수수료 정보 추가
            let feeInfo = '';
            if (tx.fee && tx.fee !== '0') {
                const feeAmount = app.baseToDisplay(tx.fee);
                feeInfo = `<div class="transaction-fee">Fee: ${feeAmount} ${
                    tx.feeDenom || chainInfo.symbol
                }</div>`;
            }

            // 메모 정보 추가
            let memoInfo = '';
            if (tx.memo && tx.memo.trim() !== '') {
                memoInfo = `<div class="transaction-memo">Memo: ${tx.memo}</div>`;
            }

            // 상태 정보 추가
            let statusInfo = '';
            if (tx.code !== undefined) {
                const status =
                    tx.code === 0
                        ? '✅ Success'
                        : '❌ Failed';
                statusInfo = `<div class="transaction-status ${
                    tx.code === 0 ? 'success' : 'failed'
                }">${status}</div>`;
            }

            return `
                <div class="transaction-item" onclick="viewTransaction('${tx.hash}')">
                    <div class="transaction-icon ${type}">
                        ${icon}
                    </div>
                    <div class="transaction-details">
                        <div class="transaction-amount">${amount} ${chainInfo.symbol}</div>
                        <div class="transaction-address">${addressInfo}</div>
                        ${memoInfo}
                        ${feeInfo}
                        ${statusInfo}
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
    // 이벤트 리스너 설정 (필요시 추가)
}

function refreshBalance() {
    loadBalance();
    loadRecentTransactions();
    window.CryptoWalletApp.utils.showToast(
        '잔액을 새로고침했습니다.'
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
