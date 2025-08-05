// 받기 페이지 JavaScript

let walletAddress = '';
let currentQRCode = null;

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 지갑이 로드되었는지 확인
        if (!window.cosmosWallet.wallet) {
            // window.location.href = '../index/index.html';
            return;
        }

        // 지갑 주소 로드
        await loadWalletAddress();

        // QR 코드 생성
        generateQRCode();
    } catch (error) {
        console.error('받기 페이지 초기화 오류:', error);
        WalletUtils.showMessage(
            '페이지 초기화에 실패했습니다.',
            'error'
        );
    }
});

// 지갑 주소 로드
async function loadWalletAddress() {
    try {
        walletAddress =
            window.cosmosWallet.getWalletAddress();
        if (walletAddress) {
            document.getElementById(
                'walletAddress'
            ).innerHTML = `
                <span class="address-text">${walletAddress}</span>
            `;
        } else {
            throw new Error(
                '지갑 주소를 가져올 수 없습니다.'
            );
        }
    } catch (error) {
        console.error('지갑 주소 로드 오류:', error);
        document.getElementById(
            'walletAddress'
        ).innerHTML = `
            <span class="address-text" style="color: #e17055;">주소를 불러올 수 없습니다</span>
        `;
    }
}

// QR 코드 생성
function generateQRCode() {
    const qrContainer = document.getElementById('qrCode');
    const amount =
        document.getElementById('receiveAmount').value;
    const memo =
        document.getElementById('receiveMemo').value;

    // QR 코드 데이터 생성
    let qrData = walletAddress;

    // 금액이 지정된 경우
    if (amount && parseFloat(amount) > 0) {
        qrData = `cosmos:${walletAddress}?amount=${amount}000000uatom`;

        // 메모가 있는 경우
        if (memo) {
            qrData += `&memo=${encodeURIComponent(memo)}`;
        }
    }

    // 기존 QR 코드 제거
    qrContainer.innerHTML = '';

    // 새 QR 코드 생성
    QRCode.toCanvas(
        qrContainer,
        qrData,
        {
            width: 200,
            height: 200,
            margin: 2,
            color: {
                dark: '#2e2e2e',
                light: '#ffffff',
            },
        },
        function (error) {
            if (error) {
                console.error('QR 코드 생성 오류:', error);
                qrContainer.innerHTML =
                    '<div style="color: #e17055;">QR 코드 생성 실패</div>';
            }
        }
    );

    currentQRCode = qrData;
}

// QR 코드 업데이트
function updateQRCode() {
    generateQRCode();
}

// 옵션 초기화
function clearOptions() {
    document.getElementById('receiveAmount').value = '';
    document.getElementById('receiveMemo').value = '';
    generateQRCode();
    WalletUtils.showMessage(
        '옵션이 초기화되었습니다.',
        'success'
    );
}

// 새 QR 코드 생성
function generateNewQR() {
    generateQRCode();
    WalletUtils.showMessage(
        '새 QR 코드가 생성되었습니다.',
        'success'
    );
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

// 주소 공유
function shareAddress() {
    if (navigator.share && walletAddress) {
        navigator
            .share({
                title: 'Cosmos 지갑 주소',
                text: `내 Cosmos 지갑 주소: ${walletAddress}`,
                url: `cosmos:${walletAddress}`,
            })
            .then(() => {
                WalletUtils.showMessage(
                    '주소가 공유되었습니다.',
                    'success'
                );
            })
            .catch((error) => {
                console.error('공유 실패:', error);
                copyAddress(); // 공유가 실패하면 복사로 대체
            });
    } else {
        copyAddress(); // 공유 API가 지원되지 않으면 복사
    }
}

// QR 이미지 공유
function shareQR() {
    const qrContainer = document.getElementById('qrCode');
    const canvas = qrContainer.querySelector('canvas');

    if (canvas) {
        canvas.toBlob((blob) => {
            if (
                navigator.share &&
                navigator.canShare &&
                navigator.canShare({ files: [blob] })
            ) {
                const file = new File(
                    [blob],
                    'cosmos-qr.png',
                    { type: 'image/png' }
                );

                navigator
                    .share({
                        title: 'Cosmos QR 코드',
                        text: '내 Cosmos 지갑 QR 코드',
                        files: [file],
                    })
                    .then(() => {
                        WalletUtils.showMessage(
                            'QR 코드가 공유되었습니다.',
                            'success'
                        );
                    })
                    .catch((error) => {
                        console.error(
                            'QR 공유 실패:',
                            error
                        );
                        downloadQRImage();
                    });
            } else {
                downloadQRImage();
            }
        }, 'image/png');
    } else {
        WalletUtils.showMessage(
            'QR 코드를 생성할 수 없습니다.',
            'error'
        );
    }
}

// QR 이미지 다운로드
function downloadQRImage() {
    const qrContainer = document.getElementById('qrCode');
    const canvas = qrContainer.querySelector('canvas');

    if (canvas) {
        const link = document.createElement('a');
        link.download = 'cosmos-wallet-qr.png';
        link.href = canvas.toDataURL();
        link.click();
        WalletUtils.showMessage(
            'QR 코드가 다운로드되었습니다.',
            'success'
        );
    } else {
        WalletUtils.showMessage(
            'QR 코드를 다운로드할 수 없습니다.',
            'error'
        );
    }
}

// 뒤로 가기
function goBack() {
    window.history.back();
}

// 다크 모드 감지 및 QR 코드 색상 조정
function updateQRCodeForDarkMode() {
    const isDarkMode = window.matchMedia(
        '(prefers-color-scheme: dark)'
    ).matches;

    if (isDarkMode && currentQRCode) {
        const qrContainer =
            document.getElementById('qrCode');
        qrContainer.innerHTML = '';

        QRCode.toCanvas(
            qrContainer,
            currentQRCode,
            {
                width: 200,
                height: 200,
                margin: 2,
                color: {
                    dark: '#ffffff',
                    light: '#2d2d2d',
                },
            },
            function (error) {
                if (error) {
                    console.error(
                        '다크 모드 QR 코드 생성 오류:',
                        error
                    );
                }
            }
        );
    }
}

// 다크 모드 변경 감지
window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', updateQRCodeForDarkMode);
