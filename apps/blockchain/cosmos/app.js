// Cosmos 지갑 전역 설정
class CosmosWallet {
    constructor() {
        this.config = null;
        this.wallet = null;
        this.client = null;
        this.isInitialized = false;
    }

    async initialize() {
        try {
            // Cosmos SDK 번들러 로드
            await this.loadCosmosSDK();

            // CosmosJS 설정 초기화
            if (
                typeof CosmosJS !== 'undefined' &&
                CosmosJS.initializeConfig
            ) {
                await CosmosJS.initializeConfig();
            }

            // 설정 초기화
            this.config = ConfigUtils.getChainInfo();
            this.isInitialized = true;

            console.log('Cosmos 지갑 초기화 완료');
            return true;
        } catch (error) {
            console.error('지갑 초기화 실패:', error);
            throw error;
        }
    }

    async loadCosmosSDK() {
        // Cosmos SDK 번들러가 로드되었는지 확인
        if (typeof CosmosJS === 'undefined') {
            throw new Error(
                'Cosmos SDK 번들러가 로드되지 않았습니다.'
            );
        }

        // config.json 로드
        await this.loadConfig();
    }

    async loadConfig() {
        try {
            // 전역 설정이 이미 로드되어 있으면 사용
            if (window.cosmosConfig) {
                console.log(
                    '전역 설정이 이미 로드되어 있습니다.'
                );
                return;
            }

            // CosmosConfig가 있으면 사용
            if (window.CosmosConfig) {
                console.log(
                    'CosmosConfig를 사용하여 설정 로드...'
                );
                await window.CosmosConfig.load();
                return;
            }

            // 여러 경로에서 config.json 시도
            const possiblePaths = [
                '../../assets/libs/config.json',
                '../assets/libs/config.json',
                './config.json',
                '/assets/libs/config.json',
                'assets/libs/config.json',
            ];

            for (const path of possiblePaths) {
                try {
                    console.log(
                        `config.json 로드 시도: ${path}`
                    );
                    const response = await fetch(path);
                    if (response.ok) {
                        window.cosmosConfig =
                            await response.json();
                        console.log(
                            `config.json 로드 완료: ${path}`
                        );
                        return;
                    }
                } catch (error) {
                    console.log(
                        `config.json 로드 실패: ${path}`,
                        error.message
                    );
                }
            }

            throw new Error(
                '모든 경로에서 config.json을 찾을 수 없습니다.'
            );
        } catch (error) {
            console.error('config.json 로드 실패:', error);
            // 기본 설정으로 계속 진행
        }
    }

    async createWallet() {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const mnemonic = CosmosJS.generateMnemonic();
            this.wallet =
                await CosmosJS.createHdWalletFromMnemonic(
                    mnemonic
                );

            // 지갑 정보 저장
            this.saveWalletInfo(mnemonic);

            return {
                success: true,
                mnemonic: mnemonic,
                address: await CosmosJS.getWalletAddress(
                    this.wallet
                ),
            };
        } catch (error) {
            console.error('지갑 생성 실패:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async restoreWallet(mnemonic) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            // 니모닉 유효성 검사
            if (!CosmosJS.validateMnemonic(mnemonic)) {
                throw new Error(
                    '유효하지 않은 니모닉입니다.'
                );
            }

            this.wallet =
                await CosmosJS.createHdWalletFromMnemonic(
                    mnemonic
                );

            // 지갑 정보 저장
            this.saveWalletInfo(mnemonic);

            return {
                success: true,
                address: await CosmosJS.getWalletAddress(
                    this.wallet
                ),
            };
        } catch (error) {
            console.error('지갑 복원 실패:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async getBalance() {
        try {
            console.log('getBalance 호출됨');

            if (!this.wallet) {
                throw new Error(
                    '지갑이 로드되지 않았습니다.'
                );
            }

            console.log('지갑 주소 가져오기...');
            const address = await CosmosJS.getWalletAddress(
                this.wallet
            );
            console.log('지갑 주소:', address);

            console.log('클라이언트 연결...');
            const client =
                await this.connectClientWithFallback();
            console.log('클라이언트 연결 성공');

            console.log('잔액 조회...');
            const balance = await CosmosJS.getBalance(
                client,
                address
            );
            console.log('잔액 조회 결과:', balance);

            return {
                success: true,
                balance: balance,
                address: address,
            };
        } catch (error) {
            console.error('잔액 조회 실패:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    // CORS 오류 시 여러 RPC 엔드포인트를 시도하는 클라이언트 연결 메서드
    async connectClientWithFallback() {
        const maxRetries = 3;
        let lastError = null;

        for (
            let attempt = 1;
            attempt <= maxRetries;
            attempt++
        ) {
            try {
                console.log(
                    `RPC 연결 시도 ${attempt}/${maxRetries}...`
                );

                // ConfigUtils에서 사용 가능한 RPC 엔드포인트들 가져오기
                const rpcEndpoints =
                    ConfigUtils.getRpcEndpoints();
                console.log(
                    '사용 가능한 RPC 엔드포인트:',
                    rpcEndpoints
                );

                // 랜덤하게 RPC 엔드포인트 선택
                const randomIndex = Math.floor(
                    Math.random() * rpcEndpoints.length
                );
                const selectedEndpoint =
                    rpcEndpoints[randomIndex];
                const rpcUrl = selectedEndpoint.address;

                console.log(
                    `선택된 RPC URL (시도 ${attempt}):`,
                    rpcUrl
                );

                // 클라이언트 연결 시도
                const client = await CosmosJS.connectClient(
                    rpcUrl
                );
                console.log(
                    `RPC 연결 성공 (시도 ${attempt}):`,
                    rpcUrl
                );

                // 클라이언트 객체에 URL 정보 추가
                client.connection = client.connection || {};
                client.connection.url = rpcUrl;

                return client;
            } catch (error) {
                lastError = error;
                console.warn(
                    `RPC 연결 실패 (시도 ${attempt}):`,
                    error.message
                );

                // 마지막 시도가 아니면 잠시 대기 후 재시도
                if (attempt < maxRetries) {
                    const delay =
                        Math.pow(2, attempt) * 1000; // 지수 백오프
                    console.log(`${delay}ms 후 재시도...`);
                    await new Promise((resolve) =>
                        setTimeout(resolve, delay)
                    );
                }
            }
        }

        // 모든 시도 실패 시 에러 발생
        throw new Error(
            `모든 RPC 엔드포인트 연결 실패. 마지막 오류: ${lastError.message}`
        );
    }

    async sendTokens(toAddress, amount, memo = '') {
        try {
            if (!this.wallet) {
                throw new Error(
                    '지갑이 로드되지 않았습니다.'
                );
            }

            // 주소 유효성 검사
            if (!CosmosJS.validateAddress(toAddress)) {
                throw new Error(
                    '유효하지 않은 주소입니다.'
                );
            }

            // CORS 오류 방지를 위해 fallback 클라이언트 사용
            const client =
                await this.connectClientWithFallback();
            const rpcUrl =
                client.connection?.url ||
                this.getDefaultRpcUrl();

            const signingClient =
                await CosmosJS.connectSigningClient(
                    rpcUrl,
                    this.wallet
                );

            const fromAddress =
                await CosmosJS.getWalletAddress(
                    this.wallet
                );

            const result = await CosmosJS.sendTokens(
                signingClient,
                fromAddress,
                toAddress,
                amount,
                null,
                memo
            );

            return {
                success: true,
                result: result,
            };
        } catch (error) {
            console.error('토큰 전송 실패:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async getTransactions(limit = 10) {
        try {
            if (!this.wallet) {
                throw new Error(
                    '지갑이 로드되지 않았습니다.'
                );
            }

            console.log('트랜잭션 조회 시작...');

            const address = await CosmosJS.getWalletAddress(
                this.wallet
            );
            console.log('지갑 주소:', address);

            // 주소 기반 트랜잭션 조회 메서드 호출
            return await this.getTransactionsByAddress(
                address,
                limit
            );
        } catch (error) {
            console.error('거래 내역 조회 실패:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    saveWalletInfo(mnemonic) {
        try {
            console.log('지갑 정보 저장 시도...');
            // 실제 구현에서는 암호화하여 저장해야 함
            const walletInfo = {
                mnemonic: mnemonic,
                timestamp: Date.now(),
            };
            console.log('저장할 지갑 정보:', walletInfo);

            const walletData = JSON.stringify(walletInfo);
            localStorage.setItem(
                'cosmos_wallet',
                walletData
            );

            console.log('지갑 정보 저장 완료');

            // 저장 확인
            const saved =
                localStorage.getItem('cosmos_wallet');
            console.log('저장 확인:', saved);
        } catch (error) {
            console.error('지갑 정보 저장 실패:', error);
        }
    }

    loadWalletInfo() {
        try {
            console.log(
                'localStorage에서 지갑 정보 로드 시도...'
            );
            const walletInfo =
                localStorage.getItem('cosmos_wallet');
            console.log(
                'localStorage에서 가져온 데이터:',
                walletInfo
            );

            if (walletInfo) {
                const parsed = JSON.parse(walletInfo);
                console.log('파싱된 지갑 정보:', parsed);
                return parsed;
            }

            console.log(
                'localStorage에 지갑 정보가 없습니다.'
            );
            return null;
        } catch (error) {
            console.error('지갑 정보 로드 실패:', error);
            return null;
        }
    }

    clearWalletInfo() {
        try {
            console.log('지갑 정보 삭제 시도...');
            localStorage.removeItem('cosmos_wallet');
            console.log('지갑 정보 삭제 완료');

            // 삭제 확인
            const remaining =
                localStorage.getItem('cosmos_wallet');
            console.log('삭제 후 남은 데이터:', remaining);
        } catch (error) {
            console.error('지갑 정보 삭제 실패:', error);
        }
    }

    // localStorage 디버깅용 함수
    debugLocalStorage() {
        console.log('=== localStorage 디버깅 ===');
        console.log(
            '전체 localStorage 키들:',
            Object.keys(localStorage)
        );
        console.log(
            'cosmos_wallet 키 존재:',
            localStorage.hasOwnProperty('cosmos_wallet')
        );
        console.log(
            'cosmos_wallet 값:',
            localStorage.getItem('cosmos_wallet')
        );
        console.log('========================');
    }

    async getWalletAddress() {
        if (!this.wallet) {
            return null;
        }
        return await CosmosJS.getWalletAddress(this.wallet);
    }

    // 테스트 페이지용 메서드들
    async createNewWallet(mnemonicLength = 12) {
        try {
            if (!this.isInitialized) {
                await this.initialize();
            }

            const mnemonic = CosmosJS.generateMnemonic(
                mnemonicLength === 24 ? 256 : 128
            );
            const wallet =
                await CosmosJS.createHdWalletFromMnemonic(
                    mnemonic
                );

            // 지갑 정보 저장
            this.saveWalletInfo(mnemonic);

            return {
                success: true,
                wallet: wallet,
                address: await CosmosJS.getWalletAddress(
                    wallet
                ),
                mnemonic: mnemonic,
            };
        } catch (error) {
            console.error('새 지갑 생성 실패:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    async extractPrivateKey(mnemonic) {
        try {
            // CosmosJS 네임스페이스를 통해 접근
            if (
                typeof CosmosJS !== 'undefined' &&
                CosmosJS.getPrivateKeyFromMnemonic
            ) {
                const result =
                    await CosmosJS.getPrivateKeyFromMnemonic(
                        mnemonic
                    );
                return result.privateKey;
            }

            // 기본 방식: BIP32를 사용하여 개인키 추출
            if (
                typeof bip39 !== 'undefined' &&
                typeof BIP32Factory !== 'undefined'
            ) {
                const seed =
                    bip39.mnemonicToSeedSync(mnemonic);
                const hdNode =
                    BIP32Factory(secp256k1).fromSeed(seed);
                const path = `m/44'/118'/0'/0/0`; // Cosmos HD 경로
                const child = hdNode.derivePath(path);
                const privateKey = child.privateKey;

                return privateKey
                    ? Buffer.from(privateKey).toString(
                          'hex'
                      )
                    : null;
            }

            throw new Error(
                '필요한 라이브러리가 로드되지 않았습니다.'
            );
        } catch (error) {
            console.error('개인키 추출 실패:', error);
            throw error;
        }
    }

    async sendTokens(
        fromPrivateKey,
        toAddress,
        amount,
        memo = ''
    ) {
        try {
            // 개인키로 지갑 생성
            let wallet;

            // CosmosJS 네임스페이스를 통해 접근
            if (
                typeof CosmosJS !== 'undefined' &&
                CosmosJS.createWalletFromPrivateKey
            ) {
                wallet =
                    await CosmosJS.createWalletFromPrivateKey(
                        fromPrivateKey
                    );
            } else if (
                typeof DirectSecp256k1Wallet !== 'undefined'
            ) {
                wallet =
                    await DirectSecp256k1Wallet.fromKey(
                        Buffer.from(fromPrivateKey, 'hex'),
                        this.config?.bech32_prefix ||
                            'cosmos'
                    );
            } else {
                throw new Error(
                    'Cosmos SDK가 로드되지 않았습니다.'
                );
            }

            let signingClient;

            // CosmosJS 네임스페이스를 통해 접근
            if (
                typeof CosmosJS !== 'undefined' &&
                CosmosJS.createSigningClient
            ) {
                signingClient =
                    await CosmosJS.createSigningClient(
                        this.getDefaultRpcUrl(),
                        wallet
                    );
            } else if (
                typeof SigningStargateClient !== 'undefined'
            ) {
                signingClient =
                    await SigningStargateClient.connectWithSigner(
                        this.getDefaultRpcUrl(),
                        wallet
                    );
            } else {
                throw new Error(
                    'Cosmos SDK가 로드되지 않았습니다.'
                );
            }

            const fromAddress = (
                await wallet.getAccounts()
            )[0].address;

            const sendAmount = {
                denom:
                    this.config?.assets?.[0]?.base ||
                    'uatom',
                amount: Math.floor(
                    amount * Math.pow(10, 6)
                ).toString(),
            };

            const result = await signingClient.sendTokens(
                fromAddress,
                toAddress,
                [sendAmount],
                {
                    gas: '200000',
                    amount: [
                        { denom: 'uatom', amount: '5000' },
                    ],
                },
                memo
            );

            return {
                fromAddress: fromAddress,
                height: result.height,
                hash: result.transactionHash,
                gasUsed: result.gasUsed,
                gasWanted: result.gasWanted,
            };
        } catch (error) {
            console.error('토큰 전송 실패:', error);
            throw error;
        }
    }

    async getTransactionsByAddress(address, limit = 10) {
        try {
            console.log(
                '트랜잭션 조회 시작 (주소 기반)...'
            );
            console.log('검색할 주소:', address);
            console.log('주소 타입:', typeof address);

            // 먼저 일반적인 방법으로 시도
            try {
                console.log(
                    '일반적인 방법으로 트랜잭션 조회 시도...'
                );
                const client =
                    await this.connectClientWithFallback();
                console.log('클라이언트 연결 성공');

                console.log('트랜잭션 검색 중...');
                const searchQuery = `message.sender='${address}' OR message.recipient='${address}'`;
                console.log('검색 쿼리:', searchQuery);
                const searchResult = await client.searchTx(
                    searchQuery,
                    limit
                );
                console.log('검색 결과:', searchResult);

                return searchResult.map((tx) => ({
                    height:
                        tx.height?.toString?.() ??
                        tx.height,
                    hash: tx.hash,
                    code: tx.code,
                    gasUsed:
                        tx.gasUsed?.toString?.() ??
                        tx.gasUsed,
                    gasWanted:
                        tx.gasWanted?.toString?.() ??
                        tx.gasWanted,
                    timestamp: tx.timestamp,
                }));
            } catch (clientError) {
                console.warn(
                    '일반적인 방법 실패, JSON-RPC 방법 시도:',
                    clientError.message
                );

                // CORS 오류인 경우 JSON-RPC 직접 호출 방법 시도
                if (
                    clientError.message.includes('CORS') ||
                    clientError.message.includes(
                        'Failed to fetch'
                    ) ||
                    clientError.message.includes(
                        'NetworkError'
                    )
                ) {
                    console.log(
                        'CORS 오류 감지, JSON-RPC 직접 호출 시도...'
                    );
                    const rpcResult =
                        await this.getTransactionsViaRPC(
                            address,
                            limit
                        );
                    if (rpcResult.success) {
                        return rpcResult.transactions;
                    }
                }

                // 다른 오류인 경우 재발생
                throw clientError;
            }
        } catch (error) {
            console.error('트랜잭션 조회 실패:', error);
            throw error;
        }
    }

    generateMnemonic(length = 12) {
        const strength = length === 24 ? 256 : 128;

        // CosmosJS 네임스페이스를 통해 접근
        if (
            typeof CosmosJS !== 'undefined' &&
            CosmosJS.generateMnemonic
        ) {
            return CosmosJS.generateMnemonic(strength);
        }

        // bip39가 전역에 있는 경우 사용
        if (typeof bip39 !== 'undefined') {
            return bip39.generateMnemonic(strength);
        }

        throw new Error(
            'BIP39 라이브러리가 로드되지 않았습니다.'
        );
    }

    async createWalletFromMnemonic(mnemonic) {
        // CosmosJS 네임스페이스를 통해 접근
        if (
            typeof CosmosJS !== 'undefined' &&
            CosmosJS.createHdWalletFromMnemonic
        ) {
            return await CosmosJS.createHdWalletFromMnemonic(
                mnemonic
            );
        }

        // DirectSecp256k1HdWallet이 전역에 있는 경우 사용
        if (
            typeof DirectSecp256k1HdWallet !== 'undefined'
        ) {
            // makeCosmoshubPath 함수 찾기
            let makeCosmoshubPathFunc;
            if (typeof makeCosmoshubPath !== 'undefined') {
                makeCosmoshubPathFunc = makeCosmoshubPath;
            } else if (
                typeof CosmosJS !== 'undefined' &&
                CosmosJS.makeCosmoshubPath
            ) {
                makeCosmoshubPathFunc =
                    CosmosJS.makeCosmoshubPath;
            } else {
                // 기본 Cosmos HD 경로 사용
                makeCosmoshubPathFunc = (index) =>
                    [44, 118, 0, 0, index].map((i, pos) =>
                        pos < 3 ? i + 0x80000000 : i
                    );
            }

            return await DirectSecp256k1HdWallet.fromMnemonic(
                mnemonic,
                {
                    hdPaths: [makeCosmoshubPathFunc(0)],
                    prefix:
                        this.config?.bech32_prefix ||
                        'cosmos',
                }
            );
        }

        throw new Error(
            'Cosmos SDK가 로드되지 않았습니다.'
        );
    }

    async getWalletAddress(wallet) {
        // CosmosJS 네임스페이스를 통해 접근
        if (
            typeof CosmosJS !== 'undefined' &&
            CosmosJS.getWalletAddress
        ) {
            return await CosmosJS.getWalletAddress(wallet);
        }

        // 기본 방식
        const accounts = await wallet.getAccounts();
        return accounts[0].address;
    }

    getDefaultRpcUrl() {
        return ConfigUtils.getDefaultRpcUrl();
    }

    async connectClient() {
        // CORS 오류 방지를 위해 fallback 클라이언트 사용
        return await this.connectClientWithFallback();
    }

    // CORS 우회를 위한 JSON-RPC 직접 호출 (여러 엔드포인트 시도)
    async makeRPCCall(method, params = {}) {
        const maxRetries = 3;
        let lastError = null;

        for (
            let attempt = 1;
            attempt <= maxRetries;
            attempt++
        ) {
            try {
                console.log(
                    `RPC 호출 시도 ${attempt}/${maxRetries}...`
                );

                // ConfigUtils에서 사용 가능한 RPC 엔드포인트들 가져오기
                const rpcEndpoints =
                    ConfigUtils.getRpcEndpoints();

                // 랜덤하게 RPC 엔드포인트 선택
                const randomIndex = Math.floor(
                    Math.random() * rpcEndpoints.length
                );
                const selectedEndpoint =
                    rpcEndpoints[randomIndex];
                const rpcUrl = selectedEndpoint.address;

                console.log(
                    `선택된 RPC URL (시도 ${attempt}):`,
                    rpcUrl
                );

                // CORS 우회를 위한 추가 헤더 설정
                const response = await fetch(rpcUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'User-Agent': 'Cosmos-Wallet/1.0',
                    },
                    mode: 'cors', // 명시적으로 CORS 모드 설정
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        id: 1,
                        method: method,
                        params: params,
                    }),
                });

                if (!response.ok) {
                    throw new Error(
                        `HTTP ${response.status}: ${response.statusText}`
                    );
                }

                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error.message);
                }

                console.log(
                    `RPC 호출 성공 (시도 ${attempt}):`,
                    rpcUrl
                );
                return data.result;
            } catch (error) {
                lastError = error;
                console.warn(
                    `RPC 호출 실패 (시도 ${attempt}):`,
                    error.message
                );

                // CORS 오류인 경우 특별 처리
                if (
                    error.message.includes('CORS') ||
                    error.message.includes(
                        'Failed to fetch'
                    )
                ) {
                    console.log(
                        'CORS 오류 감지, 다른 엔드포인트 시도...'
                    );
                }

                // 마지막 시도가 아니면 잠시 대기 후 재시도
                if (attempt < maxRetries) {
                    const delay =
                        Math.pow(2, attempt) * 1000; // 지수 백오프
                    console.log(`${delay}ms 후 재시도...`);
                    await new Promise((resolve) =>
                        setTimeout(resolve, delay)
                    );
                }
            }
        }

        // 모든 시도 실패 시 에러 발생
        throw new Error(
            `모든 RPC 엔드포인트 호출 실패. 마지막 오류: ${lastError.message}`
        );
    }

    // JSON-RPC를 사용한 트랜잭션 조회 (CORS 우회용)
    async getTransactionsViaRPC(address, limit = 10) {
        try {
            console.log(
                'JSON-RPC를 통한 트랜잭션 조회 시작...'
            );
            console.log('검색할 주소:', address);
            console.log('주소 타입:', typeof address);
            console.log(
                '주소 길이:',
                address ? address.length : 'undefined'
            );

            // tx_search 메서드를 사용하여 트랜잭션 검색
            // 여러 쿼리 형식 시도
            let result;
            try {
                // 첫 번째 시도: 표준 형식
                const query1 = `message.sender='${address}' OR message.recipient='${address}'`;
                console.log('첫 번째 쿼리:', query1);
                result = await this.makeRPCCall(
                    'tx_search',
                    {
                        query: query1,
                        prove: false,
                        page: 1,
                        per_page: limit,
                        order_by: 'desc',
                    }
                );
            } catch (error) {
                console.log(
                    '첫 번째 쿼리 실패, 두 번째 시도...'
                );
                // 두 번째 시도: 간단한 형식
                const query2 = `"${address}"`;
                console.log('두 번째 쿼리:', query2);
                result = await this.makeRPCCall(
                    'tx_search',
                    {
                        query: query2,
                        prove: false,
                        page: 1,
                        per_page: limit,
                        order_by: 'desc',
                    }
                );
            }

            console.log('RPC 트랜잭션 조회 결과:', result);

            if (result && result.txs) {
                return {
                    success: true,
                    transactions: result.txs.map((tx) => ({
                        height: tx.height,
                        hash: tx.hash,
                        code: tx.tx_result?.code || 0,
                        gasUsed:
                            tx.tx_result?.gas_used || '0',
                        gasWanted:
                            tx.tx_result?.gas_wanted || '0',
                        timestamp:
                            tx.tx_result?.timestamp ||
                            new Date().toISOString(),
                        amount: this.extractAmountFromTx(
                            tx
                        ),
                        type: this.determineTransactionType(
                            tx,
                            address
                        ),
                    })),
                };
            }

            return {
                success: true,
                transactions: [],
            };
        } catch (error) {
            console.error('RPC 트랜잭션 조회 실패:', error);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    // 트랜잭션에서 금액 추출
    extractAmountFromTx(tx) {
        try {
            if (tx.tx_result && tx.tx_result.logs) {
                for (const log of tx.tx_result.logs) {
                    if (log.events) {
                        for (const event of log.events) {
                            if (event.type === 'transfer') {
                                for (const attr of event.attributes) {
                                    if (
                                        attr.key ===
                                        'amount'
                                    ) {
                                        return attr.value;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return '0';
        } catch (error) {
            console.error('금액 추출 실패:', error);
            return '0';
        }
    }

    // 트랜잭션 타입 결정 (받기/보내기)
    determineTransactionType(tx, address) {
        try {
            if (tx.tx_result && tx.tx_result.logs) {
                for (const log of tx.tx_result.logs) {
                    if (log.events) {
                        for (const event of log.events) {
                            if (event.type === 'transfer') {
                                for (const attr of event.attributes) {
                                    if (
                                        attr.key ===
                                            'recipient' &&
                                        attr.value ===
                                            address
                                    ) {
                                        return 'received';
                                    }
                                    if (
                                        attr.key ===
                                            'sender' &&
                                        attr.value ===
                                            address
                                    ) {
                                        return 'sent';
                                    }
                                }
                            }
                        }
                    }
                }
            }
            return 'unknown';
        } catch (error) {
            console.error(
                '트랜잭션 타입 결정 실패:',
                error
            );
            return 'unknown';
        }
    }
}

// 보안 저장소 클래스
class SecureStorage {
    static setWallet(encryptedWallet) {
        try {
            localStorage.setItem(
                'cosmos_wallet',
                encryptedWallet
            );
        } catch (error) {
            console.error('지갑 저장 실패:', error);
        }
    }

    static getWallet() {
        try {
            return localStorage.getItem('cosmos_wallet');
        } catch (error) {
            console.error('지갑 로드 실패:', error);
            return null;
        }
    }

    static clearWallet() {
        try {
            localStorage.removeItem('cosmos_wallet');
        } catch (error) {
            console.error('지갑 삭제 실패:', error);
        }
    }
}

// 설정 유틸리티
const ConfigUtils = {
    // config.json 로드 헬퍼 함수
    async loadConfigFile() {
        // 이미 전역 설정이 있으면 반환
        if (window.cosmosConfig) {
            return window.cosmosConfig;
        }

        // 여러 경로에서 config.json 시도
        const possiblePaths = [
            '../../assets/libs/config.json',
            '../assets/libs/config.json',
            './config.json',
            '/assets/libs/config.json',
            'assets/libs/config.json',
        ];

        for (const path of possiblePaths) {
            try {
                console.log(
                    `config.json 로드 시도: ${path}`
                );
                const response = await fetch(path);
                if (response.ok) {
                    const config = await response.json();
                    window.cosmosConfig = config;
                    console.log(
                        `config.json 로드 성공: ${path}`
                    );
                    return config;
                }
            } catch (error) {
                console.log(
                    `config.json 로드 실패: ${path}`,
                    error.message
                );
            }
        }

        // 전역 설정 로드 함수가 있으면 사용
        if (window.loadGlobalConfig) {
            await window.loadGlobalConfig();
            return window.cosmosConfig;
        }

        throw new Error(
            '모든 경로에서 config.json을 찾을 수 없습니다.'
        );
    },

    getConfig() {
        return window.cosmosConfig || null;
    },

    async ensureConfig() {
        if (!window.cosmosConfig) {
            try {
                // CosmosConfig가 있으면 사용
                if (window.CosmosConfig) {
                    await window.CosmosConfig.load();
                } else {
                    await this.loadConfigFile();
                }
            } catch (error) {
                console.error('설정 로드 실패:', error);
                return false;
            }
        }
        return true;
    },

    getChainInfo() {
        const config = this.getConfig();
        if (!config) return null;

        return {
            name: config.chain_name,
            prettyName: config.pretty_name,
            chainId: config.chain_id,
            bech32Prefix: config.bech32_prefix,
            status: config.status,
            networkType: config.network_type,
        };
    },

    getAssetInfo() {
        const config = this.getConfig();
        if (
            !config ||
            !config.assets ||
            config.assets.length === 0
        ) {
            return null;
        }

        return config.assets[0];
    },

    getFeeInfo() {
        const config = this.getConfig();
        if (
            !config ||
            !config.fees ||
            !config.fees.fee_tokens
        ) {
            return null;
        }

        return config.fees.fee_tokens[0];
    },

    getRpcEndpoints() {
        const config = this.getConfig();
        if (!config || !config.apis || !config.apis.rpc) {
            return [];
        }

        return config.apis.rpc;
    },

    getRestEndpoints() {
        const config = this.getConfig();
        if (!config || !config.apis || !config.apis.rest) {
            return [];
        }

        return config.apis.rest;
    },

    getDefaultRpcUrl() {
        const rpcEndpoints = this.getRpcEndpoints();
        return rpcEndpoints.length > 0
            ? rpcEndpoints[0].address
            : null;
    },

    getDefaultRestUrl() {
        const restEndpoints = this.getRestEndpoints();
        return restEndpoints.length > 0
            ? restEndpoints[0].address
            : null;
    },

    getExplorers() {
        const config = this.getConfig();
        if (!config || !config.explorers) {
            return [];
        }

        return config.explorers;
    },
};

// 유틸리티 함수들
const WalletUtils = {
    // 주소 축약 표시
    shortenAddress: (address, start = 6, end = 4) => {
        if (!address) return '';
        return `${address.substring(
            0,
            start
        )}...${address.substring(address.length - end)}`;
    },

    // 금액 포맷팅
    formatAmount: (amount, decimals = 6) => {
        if (!amount) return '0';
        return parseFloat(amount).toFixed(decimals);
    },

    // USD 환산 (예시)
    convertToUSD: (amount, rate = 10.5) => {
        return (parseFloat(amount) * rate).toFixed(2);
    },

    // 메시지 표시
    showMessage: (message, type = 'info') => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    },

    // 로딩 표시
    showLoading: (container) => {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading';
        loadingDiv.innerHTML =
            '<div class="spinner"></div>';

        container.appendChild(loadingDiv);
        return loadingDiv;
    },

    // 로딩 숨기기
    hideLoading: (loadingDiv) => {
        if (loadingDiv) {
            loadingDiv.remove();
        }
    },
};

// 전역 지갑 인스턴스
window.cosmosWallet = new CosmosWallet();

// 전역 유틸리티 노출
window.WalletUtils = WalletUtils;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('지갑 초기화 시작...');
        await window.cosmosWallet.initialize();
        console.log(
            'Cosmos 지갑이 성공적으로 초기화되었습니다.'
        );

        // 초기화 완료 후 약간의 지연을 두어 다른 스크립트들이 실행될 시간을 줍니다
        setTimeout(() => {
            console.log(
                '지갑 초기화 완료, 다른 스크립트 실행 준비 완료'
            );
        }, 100);
    } catch (error) {
        console.error('지갑 초기화 실패:', error);
        WalletUtils.showMessage(
            '지갑 초기화에 실패했습니다.',
            'error'
        );
    }
});
