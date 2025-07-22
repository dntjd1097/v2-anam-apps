// 정부24 미니앱 생명주기 정의

window.App = {
  onLaunch() {
    console.log('Government24 mini app started');
  },
  
  onShow() {
    console.log('Government24 mini app shown');
  },
  
  onHide() {
    console.log('Government24 mini app hidden');
  }
};

// Toast 메시지 표시
window.showToast = (message, type = "info") => {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};