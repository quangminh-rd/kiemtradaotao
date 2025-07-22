document.getElementById('export-pdf').addEventListener('click', async function () {
    try {
        // Gọi hàm in của trình duyệt
        window.print();
    } catch (error) {
        console.error("Đã xảy ra lỗi khi mở trình in:", error);
    }
});