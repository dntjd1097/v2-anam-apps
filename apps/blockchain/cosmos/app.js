// Cosmos 지갑 미니앱 메인 애플리케이션 파일

// 전역 앱 객체
window.CryptoWalletApp = {
    // 현재 페이지 관리
    currentPage: null,

    // 지갑 정보
    wallet: null,

    // CosmosJS 인스턴스
    cosmos: null,

    // 체인 설정
    chainConfig: null,

    // 페이지 초기화
    init() {
        console.log('Cosmos Wallet App 초기화');
        this.initCosmosJS();
        this.loadWalletFromStorage();
        this.setupEventListeners();
    },

    // CosmosJS 초기화
    async initCosmosJS() {
        try {
            // config.json 로드
            const response = await fetch(
                '../../assets/libs/config.json'
            );
            const config = await response.json();

            // 체인 설정 저장
            this.chainConfig = config;

            // CosmosJS 설정 등록
            if (window.CosmosJS) {
                window.CosmosJS.registerConfig(config);
                this.cosmos = window.CosmosJS;
                console.log('CosmosJS 초기화 완료');
                console.log('체인 설정:', {
                    name: config.chain_name,
                    prefix: config.bech32_prefix,
                    denom: config.assets[0].base,
                    display: config.assets[0].display,
                    decimals: this.getDecimals(),
                });
            } else {
                console.error(
                    'CosmosJS가 로드되지 않았습니다.'
                );
            }
        } catch (error) {
            console.error('CosmosJS 초기화 실패:', error);
        }
    },

    // 체인별 설정 가져오기
    getChainInfo() {
        if (!this.chainConfig) {
            throw new Error(
                '체인 설정이 로드되지 않았습니다.'
            );
        }

        return {
            name: this.chainConfig.chain_name,
            prettyName: this.chainConfig.pretty_name,
            chainId: this.chainConfig.chain_id,
            prefix: this.chainConfig.bech32_prefix,
            denom: this.chainConfig.assets[0].base,
            display: this.chainConfig.assets[0].display,
            symbol: this.chainConfig.assets[0].symbol,
            decimals: this.getDecimals(),
            feeToken: this.chainConfig.fees.fee_tokens[0],
        };
    },

    // 소수점 자릿수 계산
    getDecimals() {
        if (
            !this.chainConfig ||
            !this.chainConfig.assets[0]
        ) {
            return 6; // 기본값
        }

        const asset = this.chainConfig.assets[0];
        const displayUnit = asset.denom_units.find(
            (unit) => unit.denom === asset.display
        );

        return displayUnit ? displayUnit.exponent : 6;
    },

    // 기본 단위를 표시 단위로 변환
    baseToDisplay(amount) {
        const decimals = this.getDecimals();
        const num =
            parseFloat(amount) / Math.pow(10, decimals);
        return num.toFixed(decimals);
    },

    // 표시 단위를 기본 단위로 변환
    displayToBase(amount) {
        const decimals = this.getDecimals();
        return Math.floor(
            parseFloat(amount) * Math.pow(10, decimals)
        ).toString();
    },

    // 주소 검증
    validateAddress(address) {
        if (!this.chainConfig) return false;

        try {
            const prefix = this.chainConfig.bech32_prefix;
            // 간단한 prefix 검증
            return address.startsWith(prefix);
        } catch {
            return false;
        }
    },

    // 수수료 계산
    calculateFee(gas = 200000) {
        if (!this.chainConfig) {
            return { amount: '5000', denom: 'uatom' };
        }

        const feeToken =
            this.chainConfig.fees.fee_tokens[0];
        const gasPrice =
            feeToken.average_gas_price || 0.025;
        const feeAmount = Math.floor(gas * gasPrice);

        return {
            amount: feeAmount.toString(),
            denom: feeToken.denom,
        };
    },

    // 로컬 스토리지에서 지갑 정보 로드
    loadWalletFromStorage() {
        try {
            const walletData =
                localStorage.getItem('cosmos_wallet');
            if (walletData) {
                this.wallet = JSON.parse(walletData);
                console.log(
                    '지갑 정보 로드됨:',
                    this.wallet.address
                );
            }
        } catch (error) {
            console.error('지갑 정보 로드 실패:', error);
        }
    },

    // 지갑 정보 저장
    saveWalletToStorage(walletData) {
        try {
            this.wallet = walletData;
            localStorage.setItem(
                'cosmos_wallet',
                JSON.stringify(walletData)
            );
            console.log('지갑 정보 저장됨');
        } catch (error) {
            console.error('지갑 정보 저장 실패:', error);
        }
    },

    // 지갑 정보 삭제
    deleteWallet() {
        try {
            this.wallet = null;
            localStorage.removeItem('cosmos_wallet');
            console.log('지갑 정보 삭제됨');
        } catch (error) {
            console.error('지갑 정보 삭제 실패:', error);
        }
    },

    // 페이지 이동 (정확한 상대 경로 계산)
    navigateTo(page) {
        this.currentPage = page;

        // 현재 URL 분석
        const currentUrl = window.location.href;
        const urlObj = new URL(currentUrl);
        const pathParts = urlObj.pathname
            .split('/')
            .filter((part) => part);

        // 현재 위치 확인
        const isInPages = pathParts.includes('pages');
        const currentPageIndex = pathParts.indexOf('pages');

        if (isInPages && currentPageIndex !== -1) {
            // pages 폴더 안에 있는 경우
            const currentPage =
                pathParts[currentPageIndex + 1];

            if (currentPage && currentPage !== page) {
                // 다른 페이지로 이동
                window.location.href = `../${page}/${page}.html`;
            } else if (!currentPage) {
                // pages 폴더 바로 아래에 있는 경우
                window.location.href = `${page}/${page}.html`;
            }
        } else {
            // 루트에서 시작하는 경우
            window.location.href = `pages/${page}/${page}.html`;
        }
    },

    // 뒤로가기 (지갑 삭제 후 index로)
    goBack() {
        this.deleteWallet();
        this.navigateTo('index');
    },

    // 이벤트 리스너 설정
    setupEventListeners() {
        // 뒤로가기 버튼 이벤트
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('back-btn')) {
                this.goBack();
            }
        });
    },

    // 유틸리티 함수들
    utils: {
        // 주소 축약 표시
        shortenAddress(address, length = 8) {
            if (!address) return '';
            return `${address.substring(
                0,
                length
            )}...${address.substring(
                address.length - length
            )}`;
        },

        // 날짜 포맷팅
        formatDate(timestamp) {
            if (!timestamp) return '';
            // ISO 문자열 또는 숫자 모두 지원
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) return '';
            // YYYY-MM-DD HH:mm 형식
            return (
                date.getFullYear() +
                '-' +
                String(date.getMonth() + 1).padStart(
                    2,
                    '0'
                ) +
                '-' +
                String(date.getDate()).padStart(2, '0') +
                ' ' +
                String(date.getHours()).padStart(2, '0') +
                ':' +
                String(date.getMinutes()).padStart(2, '0')
            );
        },

        // 금액 포맷팅 (체인 설정 기반)
        formatAmount(amount, decimals = null) {
            const app = window.CryptoWalletApp;
            const chainInfo = app.getChainInfo();
            const decimalPlaces =
                decimals !== null
                    ? decimals
                    : chainInfo.decimals;

            const num = parseFloat(amount);
            return num.toFixed(decimalPlaces);
        },

        // 복사 기능
        copyToClipboard(text) {
            navigator.clipboard
                .writeText(text)
                .then(() => {
                    this.showToast(
                        '주소가 복사되었습니다.'
                    );
                })
                .catch(() => {
                    this.showToast('복사에 실패했습니다.');
                });
        },

        // 토스트 메시지
        showToast(message, duration = 3000) {
            const toast = document.createElement('div');
            toast.className = 'toast';
            toast.textContent = message;
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                z-index: 1000;
                font-size: 14px;
            `;
            document.body.appendChild(toast);

            setTimeout(() => {
                document.body.removeChild(toast);
            }, duration);
        },
    },

    // 가격 조회 함수 추가
    async getTokenPrice() {
        if (
            !this.chainConfig ||
            !this.chainConfig.assets[0]
        ) {
            return null;
        }

        const asset = this.chainConfig.assets[0];
        const coingeckoId = asset.coingecko_id;

        if (!coingeckoId) {
            console.warn(
                'CoinGecko ID가 없습니다:',
                asset.symbol
            );
            return null;
        }

        try {
            const response = await fetch(
                `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`
            );

            if (!response.ok) {
                throw new Error(
                    `HTTP error! status: ${response.status}`
                );
            }

            const data = await response.json();
            const price = data[coingeckoId]?.usd;

            if (price) {
                console.log(
                    `${asset.symbol} 가격 조회 성공: $${price}`
                );
                return price;
            } else {
                console.warn(
                    `${asset.symbol} 가격을 찾을 수 없습니다.`
                );
                return null;
            }
        } catch (error) {
            console.error('가격 조회 실패:', error);
            return null;
        }
    },

    // 캐시된 가격 정보
    priceCache: {
        price: null,
        timestamp: null,
        cacheDuration: 5 * 60 * 1000, // 5분
    },

    // 캐시된 가격 가져오기
    async getCachedPrice() {
        const now = Date.now();

        // 캐시가 유효한 경우
        if (
            this.priceCache.price &&
            this.priceCache.timestamp &&
            now - this.priceCache.timestamp <
                this.priceCache.cacheDuration
        ) {
            return this.priceCache.price;
        }

        // 새로운 가격 조회
        const price = await this.getTokenPrice();

        if (price !== null) {
            this.priceCache.price = price;
            this.priceCache.timestamp = now;
        }

        return price;
    },
};

// 앱 초기화
document.addEventListener('DOMContentLoaded', () => {
    window.CryptoWalletApp.init();
});
