// Receive 페이지 JavaScript

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    await initializeReceivePage();
});

// Receive 페이지 초기화
async function initializeReceivePage() {
    try {
        console.log('Receive 페이지 초기화 시작');
        console.log(
            'window.CryptoWalletApp:',
            window.CryptoWalletApp
        );

        // 지갑 정보 확인
        if (!window.CryptoWalletApp) {
            console.error(
                'CryptoWalletApp이 로드되지 않았습니다.'
            );
            showError('지갑 앱을 찾을 수 없습니다.');
            return;
        }

        if (!window.CryptoWalletApp.wallet) {
            console.error('지갑 정보가 없습니다.');
            console.log(
                'localStorage cosmos_wallet:',
                localStorage.getItem('cosmos_wallet')
            );
            showError(
                '지갑 정보를 찾을 수 없습니다. 메인 페이지로 이동해주세요.'
            );
            return;
        }

        const wallet = window.CryptoWalletApp.wallet;
        console.log('지갑 정보:', wallet);
        console.log('지갑 주소:', wallet.address);

        // 지갑 주소 표시
        displayWalletAddress(wallet.address);

        // cosmos-bundler가 로드될 때까지 기다리기
        await waitForCosmosBundler();

        // QR 코드 생성
        generateQRCode(wallet.address);

        console.log('Receive 페이지 초기화 완료');
    } catch (error) {
        console.error('Receive 페이지 초기화 실패:', error);
        showError('페이지 초기화에 실패했습니다.');
    }
}

// cosmos-bundler가 로드될 때까지 기다리기
async function waitForCosmosBundler() {
    const maxWaitTime = 10000; // 10초
    const checkInterval = 100; // 100ms마다 체크
    let elapsed = 0;

    while (elapsed < maxWaitTime) {
        // cosmos-bundler의 QR 생성기 확인
        if (window.cosmosQRGenerator) {
            console.log('cosmosQRGenerator 로드됨');
            return;
        }

        // CosmosJS의 QR 생성기 확인
        if (
            window.CosmosJS &&
            window.CosmosJS.generateQRCode
        ) {
            console.log('CosmosJS.generateQRCode 로드됨');
            return;
        }

        // 잠시 대기
        await new Promise((resolve) =>
            setTimeout(resolve, checkInterval)
        );
        elapsed += checkInterval;
    }

    console.warn('cosmos-bundler 로드 대기 시간 초과');
}

// 지갑 주소 표시
function displayWalletAddress(address) {
    const addressElement =
        document.getElementById('walletAddress');
    if (addressElement && address) {
        addressElement.textContent = address;
        console.log('지갑 주소 표시 완료:', address);
    } else {
        console.error('지갑 주소 표시 실패:', {
            addressElement,
            address,
        });
    }
}

// QR 코드 생성 (cosmos-bundler의 QR 생성기 사용)
function generateQRCode(address) {
    const qrContainer = document.getElementById('qrCode');
    if (!qrContainer || !address) {
        console.error('QR 코드 생성 실패:', {
            qrContainer,
            address,
        });
        return;
    }

    try {
        // QR 코드 데이터 생성 (Cosmos 표준 형식)
        const qrData = `${address}`;
        console.log('QR 코드 데이터:', qrData);

        // cosmos-bundler의 QR 생성기 사용
        if (window.cosmosQRGenerator) {
            console.log(
                'cosmosQRGenerator 사용하여 QR 코드 생성'
            );

            // Canvas로 QR 코드 생성
            const canvas = document.createElement('canvas');
            canvas.width = 200;
            canvas.height = 200;
            canvas.style.width = '100%';
            canvas.style.height = '100%';

            // 기존 내용 제거하고 canvas 추가
            qrContainer.innerHTML = '';
            qrContainer.appendChild(canvas);

            // cosmos-bundler의 generateQRCodeCanvas 사용
            window.cosmosQRGenerator
                .generateQRCodeCanvas(qrData, canvas, {
                    errorCorrectionLevel: 'M',
                    margin: 2,
                    color: {
                        dark: '#000000',
                        light: '#FFFFFF',
                    },
                    width: 200,
                })
                .then(() => {
                    console.log(
                        'QR 코드 생성 완료 (cosmos-bundler):',
                        address
                    );
                })
                .catch((error) => {
                    console.error(
                        'cosmos-bundler QR 생성 실패:',
                        error
                    );
                    showFallbackQR();
                });
        } else if (
            window.CosmosJS &&
            window.CosmosJS.generateQRCode
        ) {
            console.log('CosmosJS의 generateQRCode 사용');

            // CosmosJS의 generateQRCode 사용
            window.CosmosJS.generateQRCode(qrData, {
                errorCorrectionLevel: 'M',
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF',
                },
                width: 200,
            })
                .then((dataURL) => {
                    // dataURL을 이미지로 표시
                    qrContainer.innerHTML = `<img src="${dataURL}" alt="QR Code" style="width: 100%; height: 100%; object-fit: contain;" />`;
                    console.log(
                        'QR 코드 생성 완료 (CosmosJS):',
                        address
                    );
                })
                .catch((error) => {
                    console.error(
                        'CosmosJS QR 생성 실패:',
                        error
                    );
                    showFallbackQR();
                });
        } else {
            console.warn(
                'QR 생성기를 찾을 수 없습니다. fallback 사용'
            );
            showFallbackQR();
        }
    } catch (error) {
        console.error('QR 코드 생성 실패:', error);
        showFallbackQR();
    }
}

// fallback QR 코드 표시
function showFallbackQR() {
    const qrContainer = document.getElementById('qrCode');
    if (!qrContainer) return;

    qrContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #666;">
            <div style="text-align: center;">
                <div style="font-size: 24px; margin-bottom: 10px;">📱</div>
                <div style="font-size: 12px;">QR 코드 생성 중...</div>
            </div>
        </div>
    `;
}

// 에러 메시지 표시
function showError(message) {
    const addressElement =
        document.getElementById('walletAddress');
    if (addressElement) {
        addressElement.innerHTML = `
            <div style="color: #dc3545; text-align: center; padding: 20px;">
                <div style="font-size: 16px; margin-bottom: 10px;">⚠️</div>
                <div style="font-size: 14px;">${message}</div>
            </div>
        `;
    }

    const qrContainer = document.getElementById('qrCode');
    if (qrContainer) {
        qrContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #dc3545;">
                <div style="text-align: center;">
                    <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
                    <div style="font-size: 12px;">지갑 정보 없음</div>
                </div>
            </div>
        `;
    }
}

// 주소 복사 기능
async function copyAddress() {
    const addressElement =
        document.getElementById('walletAddress');
    if (!addressElement || !addressElement.textContent) {
        showToast('복사할 주소가 없습니다.');
        return;
    }

    const address = addressElement.textContent;

    try {
        // 클립보드에 복사
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(address);
        } else {
            // fallback: 구식 브라우저 지원
            const textArea =
                document.createElement('textarea');
            textArea.value = address;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            textArea.style.top = '-999999px';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            document.execCommand('copy');
            textArea.remove();
        }

        // 복사 완료 토스트 표시
        showToast('주소가 복사되었습니다!');

        // 복사 버튼 애니메이션
        const copyBtn = document.getElementById(
            'copyAddressBtn'
        );
        if (copyBtn) {
            copyBtn.style.transform = 'scale(0.95)';
            setTimeout(() => {
                copyBtn.style.transform = 'scale(1)';
            }, 150);
        }

        console.log('주소 복사 완료:', address);
    } catch (error) {
        console.error('주소 복사 실패:', error);
        showToast('주소 복사에 실패했습니다.');
    }
}

// 토스트 메시지 표시
function showToast(message) {
    const toast = document.getElementById('copyToast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    // 3초 후 자동으로 숨김
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
    // 필요한 정리 작업이 있다면 여기에 추가
    console.log('Receive 페이지 언로드');
});
