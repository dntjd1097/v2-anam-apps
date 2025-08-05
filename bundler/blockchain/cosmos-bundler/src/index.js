// Cosmos SDK 번들링을 위한 엔트리 파일
import {
    StargateClient,
    SigningStargateClient,
    defaultRegistryTypes,
    coins,
    calculateFee,
    GasPrice,
} from '@cosmjs/stargate';
import {
    DirectSecp256k1Wallet,
    DirectSecp256k1HdWallet,
    makeCosmoshubPath,
} from '@cosmjs/proto-signing';
import {
    fromBech32,
    toBech32,
    fromHex,
    toHex,
} from '@cosmjs/encoding';
import {
    Secp256k1,
    sha256,
    ripemd160,
    hmac,
} from '@cosmjs/crypto';
import { Decimal, Uint53, Int53 } from '@cosmjs/math';
import * as bip39 from 'bip39';
import { BIP32Factory } from 'bip32';
import { ECPairFactory } from 'ecpair';
import ecc from '@bitcoinerlab/secp256k1';

// ECC 라이브러리로 BIP32와 ECPair 팩토리 생성
const bip32 = BIP32Factory(ecc);
const ECPair = ECPairFactory(ecc);

// 전역 Buffer 설정 (브라우저 호환성)
if (typeof window !== 'undefined') {
    window.Buffer = Buffer;
}

// 전역 설정 변수 (나중에 외부에서 설정할 수 있도록)
let chainConfig = null;

// CosmosJS 객체 생성
const CosmosJS = {
    // 기본 클라이언트들
    StargateClient,
    SigningStargateClient,

    // 지갑 관련
    DirectSecp256k1Wallet,
    DirectSecp256k1HdWallet,
    makeCosmoshubPath,

    // 인코딩/디코딩
    fromBech32,
    toBech32,
    fromHex,
    toHex,

    // 암호화
    Secp256k1,
    sha256,
    ripemd160,
    hmac,

    // 수학 연산
    Decimal,
    Uint53,
    Int53,

    // BIP 관련
    bip39,
    bip32,
    ECPair,

    // 유틸리티
    coins,
    calculateFee,
    GasPrice,
    defaultRegistryTypes,

    // 헬퍼 함수들

    // 니모닉 생성
    generateMnemonic: (strength = 128) => {
        return bip39.generateMnemonic(strength);
    },

    // 니모닉 검증
    validateMnemonic: (mnemonic) => {
        return bip39.validateMnemonic(mnemonic);
    },

    // 니모닉으로부터 HD 지갑 생성
    createHdWalletFromMnemonic: async (
        mnemonic,
        path = null
    ) => {
        const config = CosmosJS.getConfig();
        const defaultPath = makeCosmoshubPath(0);
        const hdPath = path || defaultPath;

        return await DirectSecp256k1HdWallet.fromMnemonic(
            mnemonic,
            {
                hdPaths: [hdPath],
            }
        );
    },

    // 니모닉으로부터 개인키 추출
    getPrivateKeyFromMnemonic: async (
        mnemonic,
        path = null
    ) => {
        const config = CosmosJS.getConfig();
        const defaultPath = makeCosmoshubPath(0);
        const hdPath = path || defaultPath;

        // HD 지갑 생성
        const wallet =
            await DirectSecp256k1HdWallet.fromMnemonic(
                mnemonic,
                {
                    hdPaths: [hdPath],
                }
            );

        // 계정 정보 가져오기
        const accounts = await wallet.getAccounts();
        const account = accounts[0];

        // 개인키 추출
        const privateKeyBytes =
            await wallet.getAccountsWithPrivkeys();
        const privateKey = privateKeyBytes[0].privkey;

        return {
            privateKey: toHex(privateKey),
            address: account.address,
            path: hdPath,
            publicKey: toHex(account.pubkey),
        };
    },

    // 니모닉 검증 및 개인키 추출 (간단한 버전)
    extractPrivateKey: async (mnemonic) => {
        try {
            // 니모닉 검증
            if (!CosmosJS.validateMnemonic(mnemonic)) {
                throw new Error(
                    '유효하지 않은 니모닉입니다.'
                );
            }

            // 개인키 추출
            const keyInfo =
                await CosmosJS.getPrivateKeyFromMnemonic(
                    mnemonic
                );

            return {
                success: true,
                data: keyInfo,
                message: '개인키 추출 성공',
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: '개인키 추출 실패',
            };
        }
    },

    // 개인키로부터 지갑 생성
    createWalletFromPrivateKey: async (privateKey) => {
        const config = CosmosJS.getConfig();
        return await DirectSecp256k1Wallet.fromKey(
            fromHex(privateKey),
            config.bech32_prefix
        );
    },

    // 지갑 주소 가져오기
    getWalletAddress: async (wallet) => {
        const accounts = await wallet.getAccounts();
        return accounts[0].address;
    },

    // 잔액 조회
    getBalance: async (client, address) => {
        try {
            const config = CosmosJS.getConfig();
            const baseDenom = config.assets[0].base;
            const balance = await client.getBalance(
                address,
                baseDenom
            );

            // 자산 정보에서 소수점 자릿수 찾기
            const asset = config.assets[0];
            const displayUnit = asset.denom_units.find(
                (unit) => unit.denom === asset.display
            );
            const exponent = displayUnit
                ? displayUnit.exponent
                : 6;

            return {
                amount: balance.amount,
                denom: balance.denom,
                formatted: Decimal.fromAtomics(
                    balance.amount,
                    exponent
                ).toString(),
            };
        } catch (error) {
            console.error('Balance query failed:', error);
            throw error;
        }
    },

    // 거래 내역 조회
    getTransactions: async (
        client,
        address,
        limit = 50
    ) => {
        try {
            // 여러 쿼리 방식을 시도
            let searchResult = [];

            try {
                // 방법 1: 기본 쿼리
                searchResult = await client.searchTx(
                    `message.sender='${address}' OR message.recipient='${address}'`,
                    limit
                );
            } catch (error) {
                console.log(
                    '기본 쿼리 실패, 대체 쿼리 시도:',
                    error.message
                );

                try {
                    // 방법 2: 단순 주소 쿼리
                    searchResult = await client.searchTx(
                        `transfer.recipient='${address}'`,
                        limit
                    );
                } catch (error2) {
                    console.log(
                        '단순 쿼리 실패, 최종 쿼리 시도:',
                        error2.message
                    );

                    // 방법 3: 가장 기본적인 쿼리
                    searchResult = await client.searchTx(
                        `"${address}"`,
                        limit
                    );
                }
            }

            return searchResult.map((tx) => ({
                height:
                    tx.height?.toString?.() ?? tx.height,
                hash: tx.hash,
                code: tx.code,
                gasUsed:
                    tx.gasUsed?.toString?.() ?? tx.gasUsed,
                gasWanted:
                    tx.gasWanted?.toString?.() ??
                    tx.gasWanted,
                timestamp: tx.timestamp,
                events: tx.events,
            }));
        } catch (error) {
            console.error(
                'Transaction query failed:',
                error
            );
            throw error;
        }
    },

    // 코인 전송
    sendTokens: async (
        signingClient,
        fromAddress,
        toAddress,
        amount,
        denom = null,
        memo = ''
    ) => {
        try {
            const config = CosmosJS.getConfig();
            const baseDenom =
                denom || config.assets[0].base;
            const feeInfo = config.fees.fee_tokens[0];

            const fee = calculateFee(
                200000,
                GasPrice.fromString(
                    `${feeInfo.average_gas_price}${baseDenom}`
                )
            );

            const result = await signingClient.sendTokens(
                fromAddress,
                toAddress,
                coins(amount, baseDenom),
                fee,
                memo
            );

            return {
                height: result.height,
                hash: result.transactionHash,
                gasUsed: result.gasUsed,
                gasWanted: result.gasWanted,
            };
        } catch (error) {
            console.error('Send tokens failed:', error);
            throw error;
        }
    },

    // 클라이언트 연결
    connectClient: async (rpcUrl) => {
        try {
            return await StargateClient.connect(rpcUrl);
        } catch (error) {
            console.error(
                'Client connection failed:',
                error
            );
            throw error;
        }
    },

    // 서명 클라이언트 연결
    connectSigningClient: async (rpcUrl, wallet) => {
        try {
            return await SigningStargateClient.connectWithSigner(
                rpcUrl,
                wallet
            );
        } catch (error) {
            console.error(
                'Signing client connection failed:',
                error
            );
            throw error;
        }
    },

    // 주소 검증
    validateAddress: (address, prefix = null) => {
        try {
            const config = CosmosJS.getConfig();
            const expectedPrefix =
                prefix || config.bech32_prefix;
            const decoded = fromBech32(address);
            return decoded.prefix === expectedPrefix;
        } catch {
            return false;
        }
    },

    // 토큰 단위 변환 (표시 단위 → 기본 단위)
    displayToBase: (amount) => {
        const config = CosmosJS.getConfig();
        const asset = config.assets[0];
        const displayUnit = asset.denom_units.find(
            (unit) => unit.denom === asset.display
        );
        const exponent = displayUnit
            ? displayUnit.exponent
            : 6;

        return Decimal.fromUserInput(
            amount.toString(),
            exponent
        ).atomics;
    },

    // 토큰 단위 변환 (기본 단위 → 표시 단위)
    baseToDisplay: (amount) => {
        const config = CosmosJS.getConfig();
        const asset = config.assets[0];
        const displayUnit = asset.denom_units.find(
            (unit) => unit.denom === asset.display
        );
        const exponent = displayUnit
            ? displayUnit.exponent
            : 6;

        return Decimal.fromAtomics(
            amount.toString(),
            exponent
        ).toString();
    },

    // 하위 호환성을 위한 별칭
    atomToUatom: (amount) => {
        return CosmosJS.displayToBase(amount);
    },

    uatomToAtom: (amount) => {
        return CosmosJS.baseToDisplay(amount);
    },

    // 설정 관련 메서드들

    // 설정 등록 (외부에서 호출하여 설정을 등록)
    registerConfig: (config) => {
        if (!config) {
            throw new Error('Config is required');
        }

        // 필수 필드 검증
        if (
            !config.chain_id ||
            !config.bech32_prefix ||
            !config.assets ||
            !config.apis
        ) {
            throw new Error(
                'Invalid config: missing required fields'
            );
        }

        chainConfig = config;
        console.log(
            'Config registered successfully:',
            config.chain_name
        );
        return true;
    },

    // 설정 가져오기
    getConfig: () => {
        if (!chainConfig) {
            throw new Error(
                'Config not registered. Call registerConfig() first.'
            );
        }
        return chainConfig;
    },

    // 체인 정보 가져오기
    getChainInfo: () => {
        const config = CosmosJS.getConfig();
        return {
            name: config.chain_name,
            prettyName: config.pretty_name,
            chainId: config.chain_id,
            networkType: config.network_type,
            status: config.status,
            website: config.website,
            bech32Prefix: config.bech32_prefix,
            slip44: config.slip44,
        };
    },

    // 자산 정보 가져오기
    getAssetInfo: () => {
        const config = CosmosJS.getConfig();
        return config.assets[0]; // 첫 번째 자산 반환
    },

    // 수수료 정보 가져오기
    getFeeInfo: () => {
        const config = CosmosJS.getConfig();
        return config.fees.fee_tokens[0]; // 첫 번째 수수료 토큰 반환
    },

    // RPC 엔드포인트 가져오기
    getRpcEndpoints: () => {
        const config = CosmosJS.getConfig();
        return config.apis.rpc;
    },

    // REST 엔드포인트 가져오기
    getRestEndpoints: () => {
        const config = CosmosJS.getConfig();
        return config.apis.rest;
    },

    // gRPC 엔드포인트 가져오기
    getGrpcEndpoints: () => {
        const config = CosmosJS.getConfig();
        return config.apis.grpc;
    },

    // 익스플로러 가져오기
    getExplorers: () => {
        const config = CosmosJS.getConfig();
        return config.explorers;
    },

    // 기본 RPC URL 가져오기 (랜덤으로 선택)
    getDefaultRpcUrl: () => {
        const config = CosmosJS.getConfig();
        const rpcEndpoints = config.apis.rpc;
        // 랜덤으로 RPC 엔드포인트 선택
        const randomIndex = Math.floor(
            Math.random() * rpcEndpoints.length
        );
        return rpcEndpoints[randomIndex].address;
    },

    // 기본 REST URL 가져오기 (첫 번째 REST 엔드포인트)
    getDefaultRestUrl: () => {
        const config = CosmosJS.getConfig();
        const apiEndpoints = config.apis.rest;
        const randomIndex = Math.floor(
            Math.random() * apiEndpoints.length
        );
        return apiEndpoints[randomIndex].address;
    },

    // 기본 RPC URL들 (하위 호환성을 위해 유지)
    rpcUrls: {
        mainnet: 'https://rpc.cosmos.network:26657',
        testnet:
            'https://rpc.sentry-01.theta-testnet.polypore.xyz:26657',
    },
};

// 전역 변수로도 노출 (미니앱에서 사용하기 위해)
if (typeof window !== 'undefined') {
    window.CosmosJS = CosmosJS;
}

// UMD를 위한 default export
export default CosmosJS;
