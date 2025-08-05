// 전역 설정 로더
window.CosmosConfig = {
    // 설정 데이터
    data: null,

    // 설정 로드
    async load() {
        try {
            // 여러 경로에서 config.json 시도
            const possiblePaths = [
                '../../assets/libs/config.json', // 상위에서 assets
                '../assets/libs/config.json', // 한 단계 상위에서 assets
                './config.json', // 현재 디렉토리
                '/assets/libs/config.json', // 루트에서 assets
                'assets/libs/config.json', // 상대 경로
            ];

            for (const path of possiblePaths) {
                try {
                    console.log(
                        `config.json 로드 시도: ${path}`
                    );
                    const response = await fetch(path);
                    if (response.ok) {
                        this.data = await response.json();
                        window.cosmosConfig = this.data;
                        console.log(
                            `전역 설정 로드 완료: ${path}`
                        );
                        return true;
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
            console.error('전역 설정 로드 실패:', error);
            return false;
        }
    },

    // 설정 가져오기
    get() {
        return this.data || window.cosmosConfig;
    },

    // 체인 정보 가져오기
    getChainInfo() {
        const config = this.get();
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

    // 자산 정보 가져오기
    getAssetInfo() {
        const config = this.get();
        if (
            !config ||
            !config.assets ||
            config.assets.length === 0
        ) {
            return null;
        }

        return config.assets[0];
    },

    // 수수료 정보 가져오기
    getFeeInfo() {
        const config = this.get();
        if (
            !config ||
            !config.fees ||
            !config.fees.fee_tokens
        ) {
            return null;
        }

        return config.fees.fee_tokens[0];
    },

    // RPC 엔드포인트 가져오기
    getRpcEndpoints() {
        const config = this.get();
        if (!config || !config.apis || !config.apis.rpc) {
            return [];
        }

        return config.apis.rpc;
    },

    // REST 엔드포인트 가져오기
    getRestEndpoints() {
        const config = this.get();
        if (!config || !config.apis || !config.apis.rest) {
            return [];
        }

        return config.apis.rest;
    },

    // 기본 RPC URL 가져오기
    getDefaultRpcUrl() {
        const rpcEndpoints = this.getRpcEndpoints();
        return rpcEndpoints.length > 0
            ? rpcEndpoints[0].address
            : null;
    },

    // 기본 REST URL 가져오기
    getDefaultRestUrl() {
        const restEndpoints = this.getRestEndpoints();
        return restEndpoints.length > 0
            ? restEndpoints[0].address
            : null;
    },

    // 익스플로러 가져오기
    getExplorers() {
        const config = this.get();
        if (!config || !config.explorers) {
            return [];
        }

        return config.explorers;
    },
};

// 페이지 로드 시 자동으로 설정 로드
document.addEventListener('DOMContentLoaded', function () {
    window.CosmosConfig.load();
});
