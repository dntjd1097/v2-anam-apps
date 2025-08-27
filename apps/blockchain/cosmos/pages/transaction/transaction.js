// 거래 상세 페이지 스크립트
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

    // URL에서 거래 해시 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const txHash = urlParams.get('hash');

    if (!txHash) {
        showError('거래 해시가 제공되지 않았습니다.');
        return;
    }

    // 거래 상세 정보 로드
    loadTransactionDetails(txHash);
}

async function loadTransactionDetails(txHash) {
    const app = window.CryptoWalletApp;
    
    try {
        showLoading(true);
        hideError();

        // RPC 클라이언트 연결
        const client = await connectToRPC();
        if (!client) {
            throw new Error('RPC 서버에 연결할 수 없습니다.');
        }

        // 거래 정보 조회
        const transaction = await client.getTx(txHash);
        if (!transaction) {
            throw new Error('거래 정보를 찾을 수 없습니다.');
        }

        // 거래 정보 파싱 및 표시
        const parsedTx = parseTransactionForDetail(transaction, app.wallet.address, app.getChainInfo());
        displayTransactionDetails(parsedTx);

        console.log('거래 상세 정보 로드 완료:', parsedTx);
    } catch (error) {
        console.error('거래 상세 정보 로드 실패:', error);
        showError(error.message);
    } finally {
        showLoading(false);
    }
}

function parseTransactionForDetail(tx, address, chainInfo) {
    const app = window.CryptoWalletApp;

    // 기본 거래 정보
    const transaction = {
        hash: tx.txhash || tx.hash,
        height: tx.height?.toString?.() || tx.height,
        timestamp: tx.timestamp,
        code: tx.code,
        gasUsed: tx.gas_used?.toString?.() || tx.gasUsed?.toString?.() || tx.gasUsed,
        gasWanted: tx.gas_wanted?.toString?.() || tx.gasWanted?.toString?.() || tx.gasWanted,
        events: tx.events || [],
        amount: '0',
        denom: chainInfo.denom,
        type: 'unknown',
        memo: '',
        fee: '0',
        feeDenom: chainInfo.denom,
        sender: '',
        recipient: '',
        rawTx: tx
    };

    // fee_pay 이벤트에서 수수료 정보 추출
    if (tx.events) {
        for (const event of tx.events) {
            if (event.type === 'fee_pay' && event.attributes) {
                for (const attr of event.attributes) {
                    if (attr.key === 'fee') {
                        const feeValue = attr.value;
                        if (feeValue && feeValue.includes('uatom')) {
                            transaction.fee = feeValue.replace('uatom', '');
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
        const transferInfo = parseTxBodyTransferForDetail(tx.tx.body, address, chainInfo);
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
        }
    }

    // logs에서 transfer 정보 추출 (우선순위 2)
    if (!transaction.sender && tx.logs && Array.isArray(tx.logs)) {
        const transferInfo = parseLogsTransferForDetail(tx.logs, address, chainInfo);
        if (transferInfo) {
            transaction.amount = transferInfo.amount;
            transaction.denom = transferInfo.denom;
            transaction.type = transferInfo.type;
            transaction.sender = transferInfo.sender;
            transaction.recipient = transferInfo.recipient;
        }
    }

    // 이벤트에서 전송 정보 추출 (우선순위 3)
    if (!transaction.sender && tx.events) {
        const transferInfo = parseEventsTransferForDetail(tx.events, address, chainInfo);
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

function parseTxBodyTransferForDetail(txBody, address, chainInfo) {
    try {
        if (!txBody.messages || !Array.isArray(txBody.messages)) {
            return null;
        }

        // MsgSend 메시지 찾기
        for (const message of txBody.messages) {
            if (message['@type'] === '/cosmos.bank.v1beta1.MsgSend') {
                const fromAddress = message.from_address;
                const toAddress = message.to_address;
                const amounts = message.amount || [];

                // 전송 방향 결정
                let type = 'unknown';
                if (fromAddress === address) {
                    type = 'send';
                } else if (toAddress === address) {
                    type = 'receive';
                }

                // 금액 파싱
                let parsedAmount = '0';
                let parsedDenom = chainInfo.denom;

                if (amounts.length > 0) {
                    const amount = amounts[0];
                    if (amount.denom && amount.amount) {
                        parsedAmount = amount.amount;
                        parsedDenom = amount.denom;
                    }
                }

                if (parsedAmount !== '0' && (type === 'send' || type === 'receive')) {
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

        return null;
    } catch (error) {
        console.error('Error parsing tx body transfer for detail:', error);
        return null;
    }
}

function parseLogsTransferForDetail(logs, address, chainInfo) {
    try {
        for (const log of logs) {
            if (!log.events || !Array.isArray(log.events)) {
                continue;
            }

            for (const event of log.events) {
                if (event.type === 'transfer' && event.attributes) {
                    let sender = '';
                    let recipient = '';
                    let amount = '';
                    let denom = chainInfo.denom;

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

                    let type = 'unknown';
                    if (sender === address) {
                        type = 'send';
                    } else if (recipient === address) {
                        type = 'receive';
                    }

                    if (type === 'unknown') continue;

                    let parsedAmount = '0';
                    if (amount) {
                        const amounts = amount.split(',');
                        for (const amt of amounts) {
                            if (amt.endsWith(denom)) {
                                const amountValue = amt.replace(denom, '');
                                if (parseInt(amountValue) >= 1000) {
                                    parsedAmount = amountValue;
                                    break;
                                }
                            }
                        }
                    }

                    if (parsedAmount !== '0') {
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

        return null;
    } catch (error) {
        console.error('Error parsing logs transfer for detail:', error);
        return null;
    }
}

function parseEventsTransferForDetail(events, address, chainInfo) {
    try {
        const transferEvents = events.filter(event => event.type === 'transfer');
        
        if (transferEvents.length === 0) {
            return null;
        }

        let bestTransfer = null;
        let maxAmount = 0;

        for (const event of transferEvents) {
            if (!event.attributes) continue;

            let sender = '';
            let recipient = '';
            let amount = '';
            let denom = chainInfo.denom;

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

            let type = 'unknown';
            if (sender === address) {
                type = 'send';
            } else if (recipient === address) {
                type = 'receive';
            }

            if (type === 'unknown') continue;

            let parsedAmount = 0;
            if (amount) {
                const amounts = amount.split(',');
                for (const amt of amounts) {
                    if (amt.endsWith(denom)) {
                        const amountValue = amt.replace(denom, '');
                        const numAmount = parseInt(amountValue);
                        if (!isNaN(numAmount) && numAmount > 0) {
                            parsedAmount = numAmount;
                            break;
                        }
                    }
                }
            }

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

        return bestTransfer;
    } catch (error) {
        console.error('Error parsing events transfer for detail:', error);
        return null;
    }
}

function displayTransactionDetails(transaction) {
    const app = window.CryptoWalletApp;
    const chainInfo = app.getChainInfo();

    // 상태 정보 표시
    const statusIcon = document.getElementById('statusIcon');
    const statusText = document.getElementById('statusText');
    const statusDescription = document.getElementById('statusDescription');

    if (transaction.code === 0) {
        statusIcon.textContent = '✅';
        statusText.textContent = '성공';
        statusDescription.textContent = '거래가 성공적으로 처리되었습니다';
    } else {
        statusIcon.textContent = '❌';
        statusText.textContent = '실패';
        statusDescription.textContent = `거래 처리 중 오류가 발생했습니다 (코드: ${transaction.code})`;
    }

    // 금액 정보 표시
    const amountValue = document.getElementById('transactionAmount');
    const amountSymbol = document.getElementById('transactionSymbol');
    
    if (transaction.amount && transaction.amount !== '0') {
        const displayAmount = app.baseToDisplay(transaction.amount);
        amountValue.textContent = displayAmount;
        amountSymbol.textContent = chainInfo.symbol;
    } else {
        amountValue.textContent = '0';
        amountSymbol.textContent = chainInfo.symbol;
    }

    // 거래 정보 표시
    document.getElementById('transactionHash').textContent = transaction.hash;
    document.getElementById('blockHeight').textContent = transaction.height || 'N/A';
    document.getElementById('transactionTime').textContent = app.utils.formatDate(transaction.timestamp);
    
    let typeText = '알 수 없음';
    if (transaction.type === 'send') typeText = '전송';
    else if (transaction.type === 'receive') typeText = '수신';
    else if (transaction.type === 'delegate') typeText = '위임';
    
    document.getElementById('transactionType').textContent = typeText;

    // 주소 정보 표시
    document.getElementById('senderAddress').textContent = transaction.sender || 'N/A';
    document.getElementById('recipientAddress').textContent = transaction.recipient || 'N/A';

    // 메모 표시
    const memoCard = document.getElementById('memoCard');
    const memoText = document.getElementById('memoText');
    
    if (transaction.memo && transaction.memo.trim() !== '') {
        memoText.textContent = transaction.memo;
        memoCard.style.display = 'block';
    } else {
        memoCard.style.display = 'none';
    }

    // 가스 정보 표시
    document.getElementById('gasUsed').textContent = transaction.gasUsed || 'N/A';
    document.getElementById('gasWanted').textContent = transaction.gasWanted || 'N/A';

    // 수수료 정보 표시
    const feeCard = document.getElementById('feeCard');
    const feeAmount = document.getElementById('feeAmount');
    
    if (transaction.fee && transaction.fee !== '0') {
        const displayFee = app.baseToDisplay(transaction.fee);
        feeAmount.textContent = `${displayFee} ${transaction.feeDenom || chainInfo.symbol}`;
        feeCard.style.display = 'block';
    } else {
        feeCard.style.display = 'none';
    }

    // 이벤트 정보 표시
    displayEvents(transaction.events);

    // 거래 상세 정보 표시
    document.getElementById('transactionDetails').style.display = 'block';
}

function displayEvents(events) {
    const eventsList = document.getElementById('eventsList');
    
    if (!events || events.length === 0) {
        eventsList.innerHTML = '<div class="no-events">이벤트 정보가 없습니다</div>';
        return;
    }

    const eventsHtml = events.map(event => {
        let attributesHtml = '';
        
        if (event.attributes && Array.isArray(event.attributes)) {
            attributesHtml = event.attributes.map(attr => `
                <div class="event-attribute">
                    <span class="attribute-key">${attr.key}</span>
                    <span class="attribute-value">${attr.value}</span>
                </div>
            `).join('');
        }

        return `
            <div class="event-item">
                <div class="event-type">${event.type}</div>
                <div class="event-attributes">
                    ${attributesHtml}
                </div>
            </div>
        `;
    }).join('');

    eventsList.innerHTML = eventsHtml;
}

async function connectToRPC() {
    const app = window.CryptoWalletApp;
    const chainInfo = app.getChainInfo();
    
    // 여러 RPC 엔드포인트 시도
    const rpcEndpoints = [
        'https://rpc.cosmos.network:26657',
        'https://cosmos-rpc.publicnode.com:26657',
        'https://rpc.cosmos.directory:26657'
    ];

    for (const endpoint of rpcEndpoints) {
        try {
            console.log(`RPC 엔드포인트 시도: ${endpoint}`);
            const client = await app.cosmos.connect(endpoint);
            if (client) {
                console.log(`RPC 연결 성공: ${endpoint}`);
                return client;
            }
        } catch (error) {
            console.log(`RPC 연결 실패: ${endpoint}`, error.message);
        }
    }

    return null;
}

function copyTransactionHash() {
    const hash = document.getElementById('transactionHash').textContent;
    navigator.clipboard.writeText(hash).then(() => {
        window.CryptoWalletApp.utils.showToast('거래 해시가 복사되었습니다.');
    }).catch(() => {
        window.CryptoWalletApp.utils.showToast('복사에 실패했습니다.');
    });
}

function viewInExplorer() {
    const hash = document.getElementById('transactionHash').textContent;
    const explorerUrl = `https://www.mintscan.io/cosmos/tx/${hash}`;
    window.open(explorerUrl, '_blank');
}

function goBack() {
    window.history.back();
}

function showLoading(show) {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = show ? 'flex' : 'none';
    }
}

function showError(message) {
    const errorMessage = document.getElementById('errorMessage');
    const errorText = document.querySelector('.error-text');
    
    if (errorMessage && errorText) {
        errorText.textContent = message;
        errorMessage.style.display = 'block';
    }
}

function hideError() {
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage) {
        errorMessage.style.display = 'none';
    }
}
