// 정부24 메인 페이지 로직
console.log('Government24 index page loaded');

// 로그인 상태 확인
let isLoggedIn = false;

// 로그인 핸들러
function handleLogin() {
    console.log('Login button clicked');
    
    // VP 기능 제거 - 바로 로그인 성공 처리
    isLoggedIn = true;
    showToast('Login completed', 'success');
    
    // 결제 페이지로 바로 이동
    window.anam.navigateTo('pages/payment/payment');
}

// VP 응답 처리 (VP 기능 제거로 더 이상 사용하지 않음)
// function handleVPResponse(event) { ... }

// 서비스 클릭 핸들러
function handleServiceClick(serviceName) {
    console.log(`Service clicked: ${serviceName}`);
    
    // 로그인 상태 확인
    if (!isLoggedIn) {
        // 로그인하지 않았으면 아무 반응 없음
        return;
    }
    
    // 주민등록등본 클릭 시 결제 페이지로 이동
    if (serviceName === 'Resident Registration Transcript') {
        window.anam.navigateTo('pages/payment/payment');
    } else {
        // 다른 서비스들도 아무 반응 없음
        return;
    }
}