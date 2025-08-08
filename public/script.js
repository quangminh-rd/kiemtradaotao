let startTime = Date.now();  // đánh dấu thời điểm bắt đầu làm bài

function getDataFromURI() {
    const url = window.location.href;

    const getParam = (key) => {
        const match = url.match(new RegExp(`${key}=([^&?#]*)`, 'i'));
        return match ? decodeURIComponent(match[1]) : null;
    };

    return {
        mode: getParam('mode'),
        id: getParam('id'),
        mabocauhoi: getParam('mabocauhoi'),
        time: parseInt(getParam('time')) || 60  // mặc định 60 phút
    };
}

// Biến toàn cục để kiểm tra trạng thái nộp bài
let hasSubmitted = false;

// POST endpoint GAS (dùng cùng base script.google.com như GET)
const GAS_POST_URL = "https://script.google.com/macros/s/AKfycbxCw9YdkYgQNQ7QRDoUSf_DnuKdizHcoPYZonMqVfTm7epLQeZuZkylZDHJd5coWHwkVg/exec";

function loadGapiAndLoadKetQua() {
    // Gọi trực tiếp đến Web App thay vì dùng gapi
    loadKetQua();
}

document.addEventListener('DOMContentLoaded', () => {
    const uriData = getDataFromURI();
    const submitBtn = document.querySelector('button[type="button"]');
    if (uriData.mode !== 'baikiemtra') {
        submitBtn.style.display = 'none';
    }

    // Ẩn/hiện userInfo theo mode
    if (uriData.mode === 'baikiemtra') {
        document.getElementById("userInfo").style.display = "grid";
    } else {
        document.getElementById("userInfo").style.display = "none";
    }

    if (uriData.mode === 'xemketqua') {
        document.getElementById('countdownTimerFixed').style.display = 'none';
        loadGapiAndLoadKetQua();
    } else if (uriData.mode === 'chambai') {
        document.getElementById('countdownTimerFixed').style.display = 'none';
        loadBaiNopDeCham();
    } else {
        loadQuiz();
    }

    startCountdown(uriData.time || 60);
});


function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function loadUserInfoFromDetail(detail) {
    const mapping = {
        hoTen: 'ho_va_ten',
        chucDanh: 'chuc_danh',
        boPhan: 'don_vi_phu_trach',
        soDienThoai: 'so_dien_thoai',
        email: 'email'
    };

    for (const field in mapping) {
        const value = detail[mapping[field]] || '';
        const input = document.querySelector(`[name="${field}"]`);
        if (input) {
            input.value = value || 'Không có thông tin';
            input.disabled = true;  // 🔒 Không cho sửa
        }
    }
}

async function loadQuiz() {
    const uriData = getDataFromURI();
    const maBoCauHoi = uriData.mabocauhoi || "";
    const id = uriData.id || "";

    const apiURL = `https://script.google.com/macros/s/AKfycbxCw9YdkYgQNQ7QRDoUSf_DnuKdizHcoPYZonMqVfTm7epLQeZuZkylZDHJd5coWHwkVg/exec?mabocauhoi=${maBoCauHoi}&id=${id}`;

    try {
        const response = await fetch(apiURL);
        const data = await response.json();

        if (data.detail) loadUserInfoFromDetail(data.detail);

        if (!data || !Array.isArray(data.questions) || data.questions.length === 0) {
            document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Không tìm thấy dữ liệu bài kiểm tra.</p>`;
            return;
        }

        const headers = Object.keys(data.questions[0]);
        const index = (name) => headers.indexOf(name);
        const quizForm = document.getElementById("quizForm");

        window.kieuChamDiem = [];
        window.correctAnswers = [];
        window.questionTypes = [];
        window.questionScores = [];
        window.quizHeaders = headers;
        window.quizRows = data.questions.map(row => headers.map(h => row[h]));

        const sectionMap = {};
        const sectionOrder = [];

        data.questions.forEach((rowObj, i) => {
            const row = headers.map(h => rowObj[h]);
            const phanThi = row[index('phan_thi')] || 'Phần không xác định';
            if (!sectionMap[phanThi]) {
                sectionMap[phanThi] = [];
                sectionOrder.push(phanThi);
            }
            sectionMap[phanThi].push({ row, originalIndex: i });
        });

        function toRoman(num) {
            const romanMap = [
                [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
                [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
                [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
            ];
            return romanMap.reduce((acc, [val, roman]) => {
                while (num >= val) {
                    acc += roman;
                    num -= val;
                }
                return acc;
            }, '');
        }

        let globalIndex = 0;

        sectionOrder.forEach((phanThi, sectionIdx) => {
            const sectionTitle = document.createElement("h3");
            sectionTitle.style.marginTop = "30px";
            sectionTitle.textContent = `${toRoman(sectionIdx + 1)}. ${phanThi}`;
            quizForm.appendChild(sectionTitle);

            sectionMap[phanThi].forEach(({ row }) => {
                const kieuChamDiem = row[index('kieu_cham_diem')];
                const question = row[index('noi_dung_cau_hoi')];
                const type = (row[index('phan_loai')] || '').toLowerCase();
                const options = ['a', 'b', 'c', 'd'].map(k => row[index('lua_chon_' + k)]);
                const answer = row[index('dap_an')];
                const diemRaw = row[index('diem_so')] || '0';
                const diemSo = parseFloat(
                    (typeof diemRaw === 'string' ? diemRaw : String(diemRaw)).replace(',', '.')
                ) || 0;


                window.kieuChamDiem.push(kieuChamDiem);
                window.correctAnswers.push(answer);
                window.questionTypes.push(type);
                window.questionScores.push(diemSo);

                const qDiv = document.createElement("div");
                qDiv.className = "question-block";
                let huongDanLuaChon = '';
                if (type === 'trắc nghiệm') {
                    huongDanLuaChon = ' — <em style="color: gray;">Chọn 1 đáp án đúng</em>';
                } else if (type === 'đa lựa chọn') {
                    huongDanLuaChon = ' — <em style="color: gray;">Chọn nhiều đáp án đúng</em>';
                }

                const labelDiem = (kieuChamDiem === 'Theo câu')
                    ? ''
                    : ` (${diemSo} điểm)`;

                qDiv.innerHTML = `<p>Câu ${globalIndex + 1}: ${question}${labelDiem}${huongDanLuaChon}</p>`;


                if (type === 'trắc nghiệm' || type === 'đa lựa chọn') {
                    const optDiv = document.createElement("div");
                    optDiv.className = "options-container";

                    options.forEach((opt, j) => {
                        if (opt) {
                            const inputType = type === 'đa lựa chọn' ? 'checkbox' : 'radio';
                            const value = String.fromCharCode(65 + j);
                            optDiv.innerHTML += `
    <label>
        <input type="${inputType}" name="q${globalIndex}" value="${value}">
            <span>${value}. ${opt}</span>
    </label>`;
                        }
                    });

                    qDiv.appendChild(optDiv);

                } else if (type === 'tự luận') {
                    qDiv.innerHTML += `<textarea name="q${globalIndex}" rows="4" placeholder="Nhập câu trả lời..."></textarea>`;
                } else if (type === 'số') {
                    qDiv.innerHTML += `<input type="number" name="q${globalIndex}" min="1" placeholder="Nhập số > 0">`;
                } else if (type === 'ngày tháng') {
                    qDiv.innerHTML += `<input type="date" name="q${globalIndex}">`;
                }

                quizForm.appendChild(qDiv);
                globalIndex++;
            });
        });

    } catch (error) {
        console.error("Lỗi khi tải bài kiểm tra:", error);
        document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Lỗi khi tải dữ liệu. Vui lòng thử lại.</p>`;
    }
}



// Hiển thị popup xác nhận
function showConfirmPopup() {
    if (hasSubmitted) {
        alert("Bạn đã nộp bài rồi!");
        return;
    }

    document.getElementById('confirmPopup').style.display = 'flex';
}

// Ẩn popup xác nhận
function hideConfirmPopup() {
    document.getElementById('confirmPopup').style.display = 'none';
}

// Xử lý khi người dùng xác nhận nộp bài
function confirmSubmit() {
    hideConfirmPopup();
    submitQuiz();
}

async function submitQuiz() {
    const hoTen = document.querySelector('[name="hoTen"]').value.trim();
    const chucDanh = document.querySelector('[name="chucDanh"]').value.trim();
    const boPhan = document.querySelector('[name="boPhan"]').value.trim();
    const soDienThoai = document.querySelector('[name="soDienThoai"]').value.trim();
    const email = document.querySelector('[name="email"]').value.trim();
    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const durationSec = Math.floor(durationMs / 1000);
    const durationMin = Math.floor(durationSec / 60);
    const durationFormatted = `${durationMin} phút ${durationSec % 60} giây`;
    const now = new Date().toLocaleString('vi-VN');

    const total = window.correctAnswers.length;
    let score = 0;
    let maxScore = 0;
    let soCauDung = 0;

    const cauTraloi = [];
    const cauHoi = [];
    const listDapAnText = [];
    const diemTungCau = [];

    const submitButton = document.querySelector('button[type="button"]');
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    submitButton.textContent = "Đang nộp bài...";
    document.getElementById('countdownTimerFixed').style.display = 'none';

    // --- (giữ nguyên phần tính điểm như trước) ---
    for (let i = 0; i < total; i++) {
        // (tính correctTexts)
        const type = window.questionTypes[i];
        const currentRow = window.quizRows[i];
        const index = (name) => window.quizHeaders.indexOf(name);

        const correctKeys = (window.correctAnswers[i] || '').split(',').map(c => c.trim().toUpperCase());
        let correctTexts = [];

        if (type === 'trắc nghiệm' || type === 'đa lựa chọn') {
            const inputs = document.querySelectorAll(`[name="q${i}"]`);
            const options = Array.from(inputs).map(input => {
                const label = input.closest('label');
                const span = label?.querySelector('span');
                return span ? span.textContent.trim().replace(/^[A-Z]\.\s*/, '') : '';
            });
            correctTexts = correctKeys.map(k => {
                const idx = k.charCodeAt(0) - 65;
                return options[idx] || '';
            });
        } else if (['số', 'ngày tháng'].includes(type)) {
            correctTexts = correctKeys;
        } else {
            correctTexts = correctKeys.map(k => {
                const char = k.charCodeAt(0) - 65;
                const key = ['a', 'b', 'c', 'd'][char];
                return currentRow?.[index(`lua_chon_${key}`)] || k;
            });
        }
        listDapAnText.push(correctTexts.join(', '));
    }

    for (let i = 0; i < total; i++) {
        const type = window.questionTypes[i];
        const correct = (window.correctAnswers[i] || '').toString().split(',').map(a => a.trim());
        const diem = window.questionScores[i] || 0;
        maxScore += diem;

        const cauHoiText = document.querySelectorAll('.question-block p')[i]?.innerText.replace(/^Câu\s*\d+:\s*/, '') || '';
        const questionTitleEl = document.querySelectorAll('.question-block p')[i];
        // (phần hiển thị điểm cạnh tiêu đề giữ nguyên)
        if (questionTitleEl && type !== 'tự luận') {
            const diemDat =
                (type === 'trắc nghiệm' && correct.includes(document.querySelector(`input[name="q${i}"]:checked`)?.value)) ||
                (type === 'đa lựa chọn' && (() => {
                    const selectedValues = [...document.querySelectorAll(`input[name="q${i}"]:checked`)].map(el => el.value);
                    return selectedValues.length === correct.length && selectedValues.every(v => correct.includes(v));
                })()) ||
                (['tự luận', 'ngày tháng'].includes(type) && document.querySelector(`[name="q${i}"]`).value.trim() !== "") ||
                (type === 'số' && (() => {
                    const val = parseFloat(document.querySelector(`[name="q${i}"]`).value);
                    return !isNaN(val) && val > 0;
                })());

            const diemSo = window.questionScores[i];
            const diemDatDuoc = diemDat ? diemSo : 0;

            if (window.kieuChamDiem[i] === 'Theo câu') {
                const text = diemDatDuoc > 0 ? 'Trả lời đúng' : 'Trả lời sai';
                questionTitleEl.innerHTML += ` <span style="color: ${diemDatDuoc > 0 ? 'green' : 'red'};">— ${text}</span>`;
            } else {
                questionTitleEl.innerHTML += ` <span style="color: ${diemDatDuoc > 0 ? 'green' : 'red'};">— Bạn đạt: ${diemDatDuoc} điểm</span>`;
            }
        }

        cauHoi.push(cauHoiText);

        // (xác định userAnswer và cập nhật score, diemTungCau giống code gốc)
        let userAnswer = "";
        if (type === 'trắc nghiệm') {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            if (selected) {
                const label = selected.closest('label');
                const span = label.querySelector('span');
                userAnswer = span.textContent.trim().replace(/^[A-Z]\.\s*/, '');
            }
            if (selected && correct.includes(selected.value)) {
                score += diem; soCauDung++; diemTungCau.push(diem);
            } else diemTungCau.push(0);
        } else if (type === 'đa lựa chọn') {
            const selectedElements = [...document.querySelectorAll(`input[name="q${i}"]:checked`)];
            const answers = selectedElements.map(el => el.closest('label').querySelector('span').textContent.trim().replace(/^[A-Z]\.\s*/, ''));
            userAnswer = answers.join(', ');
            const selectedValues = selectedElements.map(el => el.value);
            if (selectedValues.length === correct.length && selectedValues.every(v => correct.includes(v))) {
                score += diem; soCauDung++; diemTungCau.push(diem);
            } else diemTungCau.push(0);
        } else if (type === 'tự luận') {
            const val = document.querySelector(`[name="q${i}"]`).value.trim();
            userAnswer = val; diemTungCau.push(0);
        } else if (type === 'ngày tháng') {
            const val = document.querySelector(`[name="q${i}"]`).value.trim();
            userAnswer = val;
            if (val !== "") { score += diem; soCauDung++; diemTungCau.push(diem); } else diemTungCau.push(0);
        } else if (type === 'số') {
            const val = parseFloat(document.querySelector(`[name="q${i}"]`).value);
            userAnswer = isNaN(val) ? '' : val;
            if (!isNaN(val) && val > 0) { score += diem; soCauDung++; diemTungCau.push(diem); } else diemTungCau.push(0);
        }

        cauTraloi.push(userAnswer);
    }

    const loaicauHoi = window.questionTypes.map(x => x);
    const kieuchamdiem = window.kieuChamDiem.map(x => x);
    const listdiemToida = window.questionScores.map(x => x);

    const hasEssay = window.questionTypes.some(type => type === 'tự luận');
    const trangthaiChamBai = hasEssay ? "Chờ chấm điểm câu tự luận" : "Đã chấm";
    const ngaygioChamBai = hasEssay ? "" : now;

    // --- Gửi POST dưới dạng form (URLSearchParams) để tránh preflight CORS ---
    try {
        const postPayload = {
            id: getDataFromURI().id,
            ngayGioNop: now,
            trangthaiChamBai,
            ngaygioChamBai,
            tongDiemDatDuoc: score,
            tongDiemToiDa: maxScore,
            soCauDung,
            tongSoCau: total,
            thoiGianLamBai: durationFormatted,
            cauHoi,
            kieuchamdiem,
            loaicauHoi,
            listdiemToida,
            listDapAn: listDapAnText,
            cauTraloi,
            diemTungCau,
            mabocauhoi: getDataFromURI().mabocauhoi
        };

        const form = new URLSearchParams();
        form.append('payload', JSON.stringify(postPayload));
        // form.append('secret', 'MY_SECRET'); // nếu bạn dùng secret, bật dòng này và kiểm tra trong GAS

        const res = await fetch(GAS_POST_URL, {
            method: 'POST',
            body: form // **không set headers** để tránh preflight
        });

        const json = await res.json().catch(() => null);
        console.log("GAS trả về:", res.status, json);

        if (json && json.status && json.status.toLowerCase() === 'ok') {
            // thành công (giữ nguyên phần UI)
            hasSubmitted = true;
            submitButton.style.display = 'none';
            document.querySelectorAll('input, textarea, select').forEach(el => el.disabled = true);

            const statusDiv = document.createElement('div');
            statusDiv.className = 'submission-status';
            statusDiv.innerHTML = `
    <h3>THÔNG BÁO</h3>
    <p class="success-message">Bài làm của bạn đã được ghi nhận thành công!</p>
    <p><strong>Tổng điểm phần trắc nghiệm:</strong> ${score}/${maxScore}</p>
    <p><strong>Kết quả phần trắc nghiệm:</strong> ${soCauDung}/${total} câu đúng</p>
    ${hasEssay ? '<p><strong>Kết quả phần tự luận sẽ được thông báo sau!</strong></p>' : ''}
    <p><strong>Thời gian nộp:</strong> ${now}</p>
    <p><strong>Thời gian làm bài:</strong> ${durationFormatted}</p>
    `;
            document.querySelector('.quiz-wrapper').appendChild(statusDiv);

            // tô màu correct/wrong (giữ nguyên)
            for (let i = 0; i < total; i++) {
                const type = window.questionTypes[i];
                const correct = (window.correctAnswers[i] || '').toString().split(',').map(a => a.trim());
                const inputs = document.querySelectorAll(`[name="q${i}"]`);
                if (type === 'trắc nghiệm' || type === 'đa lựa chọn') {
                    inputs.forEach(input => {
                        const label = input.closest('label');
                        const val = input.value;
                        if (correct.includes(val)) {
                            label.style.backgroundColor = '#d4edda';
                            label.style.border = '1px solid #28a745';
                        }
                        if (input.checked && !correct.includes(val)) {
                            label.style.backgroundColor = '#f8d7da';
                            label.style.border = '1px solid #dc3545';
                        }
                    });
                }
            }

        } else {
            console.error("Lỗi từ GAS:", json);
            alert("Có lỗi khi gửi dữ liệu lên server: " + (json?.message || "Không xác định"));
            submitButton.disabled = false;
            submitButton.classList.remove('loading');
            submitButton.textContent = "Nộp bài";
        }

    } catch (err) {
        console.error("Lỗi gửi dữ liệu:", err);
        alert("Đã xảy ra lỗi khi gửi kết quả. Vui lòng thử lại.");
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = "Nộp bài";
    }
}


async function loadKetQua() {
    const { id } = getDataFromURI();

    if (!id) {
        document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Không tìm thấy ID trong URI.</p>`;
        return;
    }

    const apiURL = `https://script.google.com/macros/s/AKfycbxCw9YdkYgQNQ7QRDoUSf_DnuKdizHcoPYZonMqVfTm7epLQeZuZkylZDHJd5coWHwkVg/exec?mode=xemketqua&id=${id}`;

    try {
        const response = await fetch(apiURL);
        const data = await response.json();

        if (data.error) {
            document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">${data.error}</p>`;
            return;
        }

        const quizForm = document.getElementById("quizForm");
        quizForm.innerHTML = "";

        // Ẩn form người dùng
        document.getElementById("userInfo").style.display = 'none';
        document.querySelector('button[type="button"]').style.display = 'none';

        // Thêm tiêu đề
        const header = document.createElement("h2");
        header.textContent = "KẾT QUẢ BÀI KIỂM TRA";
        header.className = "grading-header";
        quizForm.parentElement.insertBefore(header, quizForm);


        // Lấy thông tin người dùng
        const hoTen = data.ho_va_ten || '';
        const chucDanh = data.chuc_danh || '';
        const boPhan = data.don_vi_phu_trach || '';
        const soDienThoai = data.so_dien_thoai || '';
        const email = data.email || '';
        const ngayGioNop = data.ngay_gio_nop || '';
        const thoiGianLamBai = data.thoi_gian_lam_bai || '';
        const soCauDung = data.so_cau_dung || '0';
        const tongSoCau = data.tong_so_cau || '0';
        const tongDiem = data.so_diem || '0';
        const diemToiDa = data.tong_diem || '0';

        // Hiển thị thông tin người dùng
        const infoDiv = document.createElement("div");
        infoDiv.className = "user-result-info";
        infoDiv.style.marginBottom = "30px";
        infoDiv.style.padding = "15px";
        infoDiv.style.backgroundColor = "#f5f5f5";
        infoDiv.style.borderRadius = "8px";
        infoDiv.style.display = "grid";
        infoDiv.style.gridTemplateColumns = "1fr 1fr";
        infoDiv.style.gap = "15px";

        infoDiv.innerHTML = `
    <div>
        <p><strong>Họ và tên:</strong> <span class="highlight-text">${hoTen}</span></p>
        <p><strong>Số điện thoại:</strong> <span class="highlight-text">${soDienThoai}</span></p>
        <p><strong>Email:</strong> <span class="highlight-text">${email}</span></p>
    </div>
    <div>
        <p><strong>Chức danh:</strong> <span class="highlight-text">${chucDanh}</span></p>
        <p><strong>Bộ phận:</strong> <span class="highlight-text">${boPhan}</span></p>
    </div>
    <div style="grid-column: 1 / -1; text-align: left; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
        <p><strong>Số câu đúng:</strong> <span class="highlight-text">${soCauDung}/${tongSoCau}</span></p>
        <p><strong>Số điểm:</strong> <span class="highlight-text">${tongDiem}/${diemToiDa}</span></p>
        <p><strong>Thời gian nộp:</strong> <span class="highlight-text">${ngayGioNop}</span></p>
        <p><strong>Thời gian làm bài:</strong> <span class="highlight-text">${thoiGianLamBai}</span></p>
    </div>
    `;
        document.querySelector(".quiz-wrapper").insertBefore(infoDiv, quizForm);

        // Lấy danh sách câu hỏi và đáp án
        let listKieuchamdiem = [], listCauHoi = [], listDapAn = [], listTraLoi = [], listDiem = [];

        try {
            listKieuchamdiem = JSON.parse(data.list_kieu_cham_diem || "[]");
            listCauHoi = JSON.parse(data.list_cau_hoi || "[]");
            listDapAn = JSON.parse(data.list_dap_an || "[]");
            listTraLoi = JSON.parse(data.list_cau_tra_loi || "[]");
            listDiem = JSON.parse(data.list_diem_tung_cau || "[]");
        } catch (e) {
            quizForm.innerHTML = `<p style="color:red; text-align:center;">Dữ liệu bị lỗi, không thể hiển thị kết quả.</p>`;
            return;
        }

        listCauHoi.forEach((cau, i) => {
            const div = document.createElement("div");
            div.className = "question-block";

            const dapAnDung = listDapAn[i] || '';
            const traLoi = listTraLoi[i] || '(Không trả lời)';

            let diemRaw = listDiem[i] || 0;
            if (typeof diemRaw === 'string') {
                diemRaw = diemRaw.trim().replace(',', '.');
            }
            const diemDatDuoc = parseFloat(diemRaw) || 0;
            const traLoiColor = diemDatDuoc > 0 ? '#28a745' : '#dc3545';

            // Xác định text hiển thị theo kiểu chấm điểm
            let ketQuaText;
            if (listKieuchamdiem[i] === 'Theo câu') {
                ketQuaText = diemDatDuoc > 0
                    ? '— Trả lời đúng'
                    : '— Trả lời sai';
            } else {
                ketQuaText = `— Đạt được: ${diemDatDuoc} điểm`;
            }

            div.innerHTML = `
    <p>
        <strong>Câu ${i + 1}:</strong> ${cau}
        <span style="margin-left: 10px; color: ${traLoiColor};">
            ${ketQuaText}
        </span>
    </p>
    <p style="margin-left: 10px; color: ${traLoiColor};">Câu trả lời: ${traLoi}</p>
    ${dapAnDung
                    ? `<p style="margin-left: 10px; color: #28a745;">Đáp án đúng: ${dapAnDung}</p>`
                    : ''}
    `;
            quizForm.appendChild(div);
        });

    } catch (err) {
        console.error("Lỗi khi load kết quả:", err);
        document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Lỗi khi tải dữ liệu. Vui lòng thử lại sau.</p>`;
    }
}

function startCountdown(durationInMinutes) {
    const countdownEl = document.getElementById("countdownTimerFixed");
    const sound = document.getElementById("alarmSound");
    let timeLeft = durationInMinutes * 60;

    const timer = setInterval(() => {
        if (hasSubmitted) {
            clearInterval(timer); // ❗ Ngừng đếm thời gian nếu đã nộp
            return;
        }

        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        countdownEl.textContent = `Thời gian còn lại: ${minutes} phút ${seconds < 10 ? '0' : ''}${seconds} giây`;

        if (--timeLeft < 0) {
            clearInterval(timer);
            countdownEl.textContent = "Hết giờ!";
            sound.play();
            alert("Đã hết thời gian làm bài. Hệ thống sẽ tự động nộp bài.");
            submitQuiz();
        }
    }, 1000);
}


// Hàm mới: Tải bài nộp để chấm điểm
async function loadBaiNopDeCham() {
    const uriData = getDataFromURI();
    const id = uriData.id;

    if (!id) {
        document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Thiếu ID bài nộp.</p>`;
        return;
    }

    const apiURL = `https://script.google.com/macros/s/AKfycbxCw9YdkYgQNQ7QRDoUSf_DnuKdizHcoPYZonMqVfTm7epLQeZuZkylZDHJd5coWHwkVg/exec?mode=chambai&id=${id}`;

    try {
        const response = await fetch(apiURL);
        const data = await response.json();

        if (data.error) {
            document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">${data.error}</p>`;
            return;
        }

        // Lưu submission data để dùng khi saveEssayPoints gọi
        window.submissionData = data;

        document.getElementById("userInfo").style.display = 'none';
        document.querySelector('button[type="button"]').style.display = 'none';
        const quizForm = document.getElementById("quizForm");
        quizForm.innerHTML = "";

        // Hiển thị thông tin người làm bài
        const infoDiv = document.createElement("div");
        infoDiv.className = "user-result-info";
        infoDiv.style.marginBottom = "30px";
        infoDiv.style.padding = "15px";
        infoDiv.style.backgroundColor = "#f5f5f5";
        infoDiv.style.borderRadius = "8px";
        infoDiv.style.display = "grid";
        infoDiv.style.gridTemplateColumns = "1fr 1fr";
        infoDiv.style.gap = "15px";
        const title = document.createElement("h2");
        title.textContent = "CHẤM ĐIỂM BÀI KIỂM TRA";
        title.className = "grading-header";
        quizForm.appendChild(title);
        infoDiv.innerHTML = `
    <div>
        <p><strong>Họ và tên:</strong> <span class="highlight-text">${data.ho_va_ten || ''}</span></p>
        <p><strong>Số điện thoại:</strong> <span class="highlight-text">${data.so_dien_thoai || ''}</span></p>
        <p><strong>Email:</strong> <span class="highlight-text">${data.email || ''}</span></p>
    </div>
    <div>
        <p><strong>Chức danh:</strong> <span class="highlight-text">${data.chuc_danh || ''}</span></p>
        <p><strong>Bộ phận:</strong> <span class="highlight-text">${data.don_vi_phu_trach || ''}</span></p>
    </div>
    <div style="grid-column: 1 / -1; text-align: left; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
        <p><strong>Trạng thái chấm bài:</strong> <span class="highlight-text">${data.trang_thai_cham_bai || ''}</span></p>
        <p><strong>Tổng điểm hiện tại:</strong> <span class="highlight-text">${data.so_diem || 0}/${data.tong_diem || 0}</span></p>
        <p><strong>Thời gian nộp:</strong> <span class="highlight-text">${data.ngay_gio_nop || ''}</span></p>
        <p><strong>Thời gian làm bài:</strong> <span class="highlight-text">${data.thoi_gian_lam_bai || ''}</span></p>
    </div>
    `;

        quizForm.appendChild(infoDiv);

        // Lấy dữ liệu câu hỏi và câu trả lời
        let listKieuchamdiem = [], listCauHoi = [], listDapAn = [], listTraLoi = [], listDiem = [], listLoaiCau = [];
        try {
            listKieuchamdiem = JSON.parse(data.list_kieu_cham_diem || "[]");
            listCauHoi = JSON.parse(data.list_cau_hoi || "[]");
            listDapAn = JSON.parse(data.list_dap_an || "[]");
            listTraLoi = JSON.parse(data.list_cau_tra_loi || "[]");
            listDiem = JSON.parse(data.list_diem_tung_cau || "[]");
            listLoaiCau = JSON.parse(data.list_loai_cau_hoi || "[]");
        } catch (e) {
            console.error("Lỗi parse dữ liệu:", e);
        }

        let listDiemToiDa = [];

        try {
            // Kiểm tra nếu là chuỗi JSON
            if (typeof data.list_diem_toi_da === "string") {
                listDiemToiDa = JSON.parse(data.list_diem_toi_da);
            }
            // Nếu đã là mảng (tùy backend), dùng luôn
            else if (Array.isArray(data.list_diem_toi_da)) {
                listDiemToiDa = data.list_diem_toi_da;
            }

            // Ép từng phần tử thành số thật
            listDiemToiDa = listDiemToiDa.map(x => parseFloat(x) || 0);

        } catch (e) {
            console.error("Không thể parse list_diem_toi_da:", data.list_diem_toi_da);
            listDiemToiDa = [];
        }

        // Tạo container cho phần chấm điểm
        const gradingContainer = document.createElement("div");
        gradingContainer.className = "grading-container";
        gradingContainer.innerHTML = `<h3>CÂU TỰ LUẬN CẦN CHẤM ĐIỂM</h3>`;

        let hasEssay = false;

        listCauHoi.forEach((cau, i) => {
            if (listLoaiCau[i] === 'tự luận' && listKieuchamdiem[i] === 'Theo điểm') {
                hasEssay = true;
                const essayDiv = document.createElement("div");
                essayDiv.className = "essay-question";

                essayDiv.innerHTML = `
    <p><strong>Câu ${i + 1}:</strong> ${cau}</p>
    <p><strong>Đáp án đúng:</strong></p>
    <div style="background-color: #e8f5e9; padding: 10px; border-radius: 4px; margin: 5px 0;">
        ${listDapAn[i] || '(Không có đáp án mẫu)'}
    </div>
    <p><strong>Câu trả lời:</strong></p>
    <div style="background-color: #e9ecef; padding: 10px; border-radius: 4px; margin-top: 5px;">
        ${listTraLoi[i] || '(Không có câu trả lời)'}
    </div>
    <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
        <span style="white-space: nowrap;"><strong>Chấm điểm:</strong></span>
        <input type="number" class="point-input" id="diem-${i}"
            min="0" max="${listDiemToiDa[i]}" step="0.25"
            value="${listDiem[i] || 0}">
    </div>
    `;

                gradingContainer.appendChild(essayDiv);
            } else if (listLoaiCau[i] === 'tự luận' && listKieuchamdiem[i] === 'Theo câu') {
                hasEssay = true;
                const essayDiv = document.createElement("div");
                essayDiv.className = "essay-question";

                const isDung = parseFloat(listDiem[i]) > 0;

                essayDiv.innerHTML = `
    <p><strong>Câu ${i + 1}:</strong> ${cau}</p>
    <p><strong>Đáp án đúng:</strong></p>
    <div style="background-color: #e8f5e9; padding: 10px; border-radius: 4px; margin: 5px 0;">
        ${listDapAn[i] || '(Không có đáp án mẫu)'}
    </div>
    <p><strong>Câu trả lời:</strong></p>
    <div style="background-color: #e9ecef; padding: 10px; border-radius: 4px; margin-top: 5px;">
        ${listTraLoi[i] || '(Không có câu trả lời)'}
    </div>
    <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
        <span><strong>Chấm điểm:</strong></span>
        <label><input type="radio" name="grade-${i}" value="true" ${isDung ? 'checked' : ''}> Đúng</label>
        <label><input type="radio" name="grade-${i}" value="false" ${!isDung ? 'checked' : ''}> Sai</label>
    </div>
    `;

                gradingContainer.appendChild(essayDiv);
            }

        });

        if (!hasEssay) {
            gradingContainer.innerHTML += `<p>Không có câu tự luận nào trong bài kiểm tra này.</p>`;
        } else {
            // Thêm nút lưu điểm
            const saveBtn = document.createElement("button");
            saveBtn.type = "button"; // 🔧 Ngăn hành vi submit mặc định
            saveBtn.className = "save-btn";
            saveBtn.textContent = "Lưu Điểm";
            saveBtn.onclick = () => saveEssayPoints(data.id, listLoaiCau, listDiem, data);
            gradingContainer.appendChild(saveBtn);
        }
        const isAlreadyGraded = data.trang_thai_cham_bai === "Đã chấm";
        if (isAlreadyGraded) {
            // 1) disable tất cả input (radio, number, checkbox…)
            gradingContainer.querySelectorAll('input').forEach(el => el.disabled = true);

            // 2) nếu có nút Lưu Điểm thì ẩn nó đi
            const saveBtn = gradingContainer.querySelector('.save-btn');
            if (saveBtn) {
                saveBtn.style.display = 'none';
            }
        }
        quizForm.appendChild(gradingContainer);

    } catch (err) {
        console.error("Lỗi khi tải bài chấm điểm:", err);
        document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Lỗi khi tải dữ liệu chấm điểm.</p>`;
    }
}

// Hàm mới: Lưu điểm câu tự luận
async function saveEssayPoints(submissionId, questionTypes, currentPoints, rawData = {}) {
    const quizForm = document.getElementById("quizForm");
    const updatedPoints = [...currentPoints];
    let hasChange = false;

    const data = window.submissionData || rawData;

    const kieuChamList = Array.isArray(data.list_kieu_cham_diem)
        ? data.list_kieu_cham_diem
        : JSON.parse(data.list_kieu_cham_diem || '[]');

    const diemToiDaList = Array.isArray(data.list_diem_toi_da)
        ? data.list_diem_toi_da
        : JSON.parse(data.list_diem_toi_da || '[]');

    questionTypes.forEach((loai, i) => {
        const kieu = kieuChamList[i] || '';
        const diemToiDa = parseFloat(diemToiDaList[i]) || 0;
        const currentPoint = parseFloat(currentPoints[i]) || 0;

        if (loai === 'tự luận' && kieu === 'Theo câu') {
            const val = document.querySelector(`input[name="grade-${i}"]:checked`)?.value;
            const newPoint = val === 'true' ? diemToiDa : 0;
            if (newPoint !== currentPoint) {
                updatedPoints[i] = newPoint;
                hasChange = true;
            }
        } else if (loai === 'tự luận' && kieu === 'Theo điểm') {
            const input = document.querySelector(`#diem-${i}`);
            if (input) {
                const newVal = parseFloat(input.value) || 0;
                if (newVal !== currentPoint) {
                    updatedPoints[i] = newVal;
                    hasChange = true;
                }
            }
        }
    });

    if (!hasChange) { alert("Không có điểm nào thay đổi."); return; }

    try {
        const now = new Date().toLocaleString("vi-VN");
        const tongDiemDatDuoc = updatedPoints.reduce((a, b) => a + (parseFloat(b) || 0), 0);
        const tongDiemToiDa = updatedPoints.length;
        const soCauDung = updatedPoints.filter(p => p > 0).length;
        const listdiemToida = (typeof data.list_diem_toi_da === "string")
            ? JSON.parse(data.list_diem_toi_da || "[]")
            : Array.isArray(data.list_diem_toi_da) ? data.list_diem_toi_da : [];

        const trangthaiChamBai = "Đã chấm";
        const ngaygioChamBai = now;

        const postPayload = {
            id: data.id || '',
            trangthaiChamBai,
            ngaygioChamBai,
            tongDiemDatDuoc,
            tongDiemToiDa,
            soCauDung,
            tongSoCau: updatedPoints.length,
            thoiGianLamBai: data.thoi_gian_lam_bai || '',
            cauHoi: JSON.parse(data.list_cau_hoi || "[]"),
            loaicauHoi: questionTypes,
            listdiemToida: listdiemToida,
            listDapAn: JSON.parse(data.list_dap_an || "[]"),
            cauTraloi: JSON.parse(data.list_cau_tra_loi || "[]"),
            diemTungCau: updatedPoints,
            mabocauhoi: data.ma_bo_cau_hoi || ''
        };

        // Gửi dưới dạng form để tránh preflight
        const form = new URLSearchParams();
        form.append('payload', JSON.stringify(postPayload));
        // form.append('secret', 'MY_SECRET'); // nếu bạn dùng secret

        const res = await fetch(GAS_POST_URL, {
            method: 'POST',
            body: form
        });

        const json = await res.json().catch(() => null);
        console.log("GAS trả về (saveEssayPoints):", res.status, json);

        if (!(json && json.status && json.status.toLowerCase() === 'ok')) {
            console.error("Lỗi khi lưu điểm:", json);
            alert("Có lỗi khi gửi điểm cập nhật: " + (json?.message || "Không xác định"));
            return;
        }

        const oldStatus = document.querySelector('.submission-status');
        if (oldStatus) oldStatus.remove();

        const statusDiv = document.createElement('div');
        statusDiv.className = 'submission-status';
        statusDiv.innerHTML = `
    <h3>THÔNG BÁO</h3>
    <p class="success-message">Đã gửi điểm cập nhật thành công!</p>
    <p><strong>Tổng điểm phần tự luận:</strong> ${tongDiemDatDuoc}/${tongDiemToiDa}</p>
    <p><strong>Thời gian lưu:</strong> ${now}</p>
    `;
        quizForm.appendChild(statusDiv);

        const saveButton = quizForm.querySelector('.save-btn');
        if (saveButton) saveButton.style.display = 'none';

    } catch (err) {
        console.error("Lỗi khi gửi dữ liệu:", err);
        alert("Đã xảy ra lỗi khi gửi kết quả. Vui lòng thử lại.");
    }
}