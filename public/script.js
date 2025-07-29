
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

function loadGapiAndLoadKetQua() {
    const script = document.createElement('script');
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
        gapi.load('client', async () => {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
            });
            loadKetQua();
        });
    };
    script.onerror = () => console.error('Failed to load Google API');
    document.body.appendChild(script);
}

document.addEventListener('DOMContentLoaded', () => {
    const uriData = getDataFromURI();
    if (uriData.mode === 'xemketqua') {
        document.getElementById('countdownTimerFixed').style.display = 'none';
        loadGapiAndLoadKetQua();
    } else {
        loadQuiz(); // dùng Web App thay cho Google API
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

async function loadQuiz() {
    const uriData = getDataFromURI();
    const maBoCauHoi = uriData.mabocauhoi || "";

    const apiURL = `https://script.google.com/macros/s/AKfycbxCw9YdkYgQNQ7QRDoUSf_DnuKdizHcoPYZonMqVfTm7epLQeZuZkylZDHJd5coWHwkVg/exec?mabocauhoi=${maBoCauHoi}`;

    try {
        const response = await fetch(apiURL);
        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Không tìm thấy dữ liệu bài kiểm tra.</p>`;
            return;
        }

        const headers = Object.keys(data[0]);
        const index = (name) => headers.indexOf(name);
        const quizForm = document.getElementById("quizForm");

        window.correctAnswers = [];
        window.questionTypes = [];
        window.questionScores = [];
        window.quizHeaders = headers;
        window.quizRows = data.map(row => headers.map(h => row[h]));

        const sectionMap = {};
        const sectionOrder = [];

        data.forEach((rowObj, i) => {
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
                const question = row[index('noi_dung_cau_hoi')];
                const type = (row[index('phan_loai')] || '').toLowerCase();
                const options = ['a', 'b', 'c', 'd'].map(k => row[index('lua_chon_' + k)]);
                const answer = row[index('dap_an')];
                const diemRaw = row[index('diem_so')] || '0';
                const diemSo = parseFloat(
                    (typeof diemRaw === 'string' ? diemRaw : String(diemRaw)).replace(',', '.')
                ) || 0;


                window.correctAnswers.push(answer);
                window.questionTypes.push(type);
                window.questionScores.push(diemSo);

                const qDiv = document.createElement("div");
                qDiv.className = "question-block";
                qDiv.innerHTML = `<p>Câu ${globalIndex + 1}: ${question} (${diemSo} điểm)</p>`;

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

    // Lấy thông tin người dùng để hiển thị trong popup
    const hoTen = document.querySelector('[name="hoTen"]').value.trim();
    const soDienThoai = document.querySelector('[name="soDienThoai"]').value.trim();

    if (!hoTen) {
        alert("Vui lòng nhập Họ và Tên");
        return;
    }

    if (!soDienThoai) {
        alert("Vui lòng nhập Số điện thoại");
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

function submitQuiz() {
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
    const diemTungCau = []; // ✅ Thêm dòng này tại đây

    const submitButton = document.querySelector('button[type="button"]');
    submitButton.disabled = true;
    submitButton.classList.add('loading');
    submitButton.textContent = "Đang nộp bài...";
    document.getElementById('countdownTimerFixed').style.display = 'none';

    for (let i = 0; i < total; i++) {
        const type = window.questionTypes[i];
        const correctKeys = (window.correctAnswers[i] || '').split(',').map(c => c.trim().toUpperCase());
        const currentRow = window.quizRows[i]; // Dòng dữ liệu gốc
        const index = (name) => window.quizHeaders.indexOf(name); // Truy cập tiêu đề

        let correctTexts = [];

        if (type === 'trắc nghiệm' || type === 'đa lựa chọn') {
            const inputs = document.querySelectorAll(`[name="q${i}"]`);
            const options = Array.from(inputs).map(input => {
                const label = input.closest('label');
                const span = label?.querySelector('span');
                return span ? span.textContent.trim().replace(/^[A-Z]\.\s*/, '') : '';
            });
            correctTexts = correctKeys.map(k => {
                const index = k.charCodeAt(0) - 65;
                return options[index] || '';
            });
        } else {
            // Dù là tự luận/số/ngày tháng vẫn lấy nội dung lựa chọn nếu có
            correctTexts = correctKeys.map(k => {
                const char = k.charCodeAt(0) - 65;
                const key = ['a', 'b', 'c', 'd'][char];
                return currentRow?.[index(`lua_chon_${key}`)] || '';
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

        // Ghi điểm bên cạnh tiêu đề
        const questionTitleEl = document.querySelectorAll('.question-block p')[i];
        if (questionTitleEl) {
            const diemDat = (type === 'trắc nghiệm' && correct.includes(document.querySelector(`input[name="q${i}"]:checked`)?.value)) ||
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
            questionTitleEl.innerHTML += ` <span style="color: ${diemDatDuoc > 0 ? 'green' : 'red'};">— Bạn đạt: ${diemDatDuoc} điểm</span>`;
        }

        cauHoi.push(cauHoiText);

        let userAnswer = "";

        if (type === 'trắc nghiệm') {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            if (selected) {
                const label = selected.closest('label');
                const span = label.querySelector('span');
                userAnswer = span.textContent.trim().replace(/^[A-Z]\.\s*/, '');
            }
            if (selected && correct.includes(selected.value)) {
                score += diem;
                soCauDung++;
                diemTungCau.push(diem);
            } else {
                diemTungCau.push(0);
            }
        } else if (type === 'đa lựa chọn') {
            const selectedElements = [...document.querySelectorAll(`input[name="q${i}"]:checked`)];
            const answers = [];
            selectedElements.forEach(el => {
                const label = el.closest('label');
                const span = label.querySelector('span');
                answers.push(span.textContent.trim().replace(/^[A-Z]\.\s*/, ''));
            });
            userAnswer = answers.join(', ');
            const selectedValues = selectedElements.map(el => el.value);
            if (selectedValues.length === correct.length && selectedValues.every(v => correct.includes(v))) {
                score += diem;
                soCauDung++;
                diemTungCau.push(diem);
            } else {
                diemTungCau.push(0);
            }
        } else if (type === 'tự luận' || type === 'ngày tháng') {
            const val = document.querySelector(`[name="q${i}"]`).value.trim();
            userAnswer = val;
            if (val !== "") {
                score += diem;
                soCauDung++;
                diemTungCau.push(diem);
            } else {
                diemTungCau.push(0);
            }
        } else if (type === 'số') {
            const val = parseFloat(document.querySelector(`[name="q${i}"]`).value);
            userAnswer = isNaN(val) ? '' : val;
            if (!isNaN(val) && val > 0) {
                score += diem;
                soCauDung++;
                diemTungCau.push(diem);
            } else {
                diemTungCau.push(0);
            }
        }

        cauTraloi.push(userAnswer);
    }


    // Gửi webhook
    fetch("https://new-pet-sunfish.ngrok-free.app/webhook/bc67b99f-72cd-41f2-a690-dc4afe81539a", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            hoTen,
            chucDanh,
            boPhan,
            soDienThoai,
            email,
            ngayGioNop: now,
            tongDiemDatDuoc: score,
            tongDiemToiDa: maxScore,
            soCauDung: soCauDung,
            tongSoCau: total,
            thoiGianLamBai: durationFormatted,
            cauHoi: cauHoi,
            listDapAn: listDapAnText,
            cauTraloi: cauTraloi,
            diemTungCau: diemTungCau  // ✅ THÊM DÒNG NÀY
        })

    }).then(res => res.text()).then(txt => {
        console.log("Gửi thành công:", txt);

        hasSubmitted = true;
        submitButton.style.display = 'none';

        // ✅ Khoá mọi input sau khi nộp
        document.querySelectorAll('input, textarea, select').forEach(el => {
            el.disabled = true;
        });

        const statusDiv = document.createElement('div');
        statusDiv.className = 'submission-status';
        statusDiv.innerHTML = `
            <h3>THÔNG BÁO</h3>
            <p class="success-message">Bài làm của bạn đã được ghi nhận thành công!</p>
            <p><strong>Tổng điểm:</strong> ${score}/${maxScore}</p>
            <p><strong>Kết quả:</strong> ${soCauDung}/${total} câu đúng</p>
            <p><strong>Thời gian nộp:</strong> ${now}</p>
            <p><strong>Thời gian làm bài:</strong> ${durationFormatted}</p>
        `;
        document.querySelector('.quiz-wrapper').appendChild(statusDiv);

        // Tô màu đúng/sai cho trắc nghiệm
        for (let i = 0; i < total; i++) {
            const type = window.questionTypes[i];
            const correct = (window.correctAnswers[i] || '').toString().split(',').map(a => a.trim());
            const inputs = document.querySelectorAll(`[name="q${i}"]`);

            if (type === 'trắc nghiệm' || type === 'đa lựa chọn') {
                inputs.forEach(input => {
                    const label = input.closest('label');
                    const span = label.querySelector('span');
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

    }).catch(err => {
        console.error("Lỗi gửi dữ liệu:", err);
        alert("Đã xảy ra lỗi khi gửi kết quả. Vui lòng thử lại.");
        submitButton.disabled = false;
        submitButton.classList.remove('loading');
        submitButton.textContent = "Nộp bài";
    });
}


async function loadKetQua() {
    const { id } = getDataFromURI();

    if (!id) {
        document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Không tìm thấy ID trong URI.</p>`;
        return;
    }

    const res = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: "ket_qua_kiem_tra!A1:Z"
    });

    const rows = res.result.values;
    const headers = rows[0];
    const dataRows = rows.slice(1); // bỏ dòng tiêu đề

    const index = (name) => headers.indexOf(name);
    const idCol = index('id');

    if (idCol === -1) {
        document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Không tìm thấy cột 'id' trong sheet.</p>`;
        return;
    }

    // Tìm dòng có id khớp với URI
    const row = dataRows.find(r => (r[idCol] || "") === id);

    if (!row) {
        document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Không tìm thấy bài thi với ID <strong>${id}</strong>.</p>`;
        return;
    }

    // Lấy thông tin từ dòng dữ liệu
    const hoTen = row[index('ho_va_ten')] || '';
    const chucDanh = row[index('chuc_danh')] || '';
    const boPhan = row[index('bo_phan')] || '';
    const soDienThoai = row[index('so_dien_thoai')] || '';
    const email = row[index('email')] || '';
    const ngayGioNop = row[index('ngay_gio_nop')] || '';
    const thoiGiamlam = row[index('thoi_gian_lam_bai')] || '';
    const tongDiemDatDuoc = row[index('so_diem')] || '0';
    const tongDiemToiDa = row[index('tong_diem')] || '0';
    const soCauDung = row[index('so_cau_dung')] || '0';
    const tongSoCau = row[index('tong_so_cau')] || '0';

    // Ẩn form nhập thông tin người dùng ban đầu
    document.getElementById("userInfo").style.display = 'none';

    // Tạo phần hiển thị thông tin người làm và kết quả
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
                <p><strong>Họ và tên:</strong> <span style="color: red; font-weight: bold;">${hoTen}</span></p>
                <p><strong>Số điện thoại:</strong> <span style="color: red; font-weight: bold;">${soDienThoai}</span></p>
                <p><strong>Email:</strong> <span style="color: red; font-weight: bold;">${email}</span></p>
            </div>
            <div>
                <p><strong>Chức danh:</strong> <span style="color: red; font-weight: bold;">${chucDanh}</span></p>
                <p><strong>Bộ phận:</strong> <span style="color: red; font-weight: bold;">${boPhan}</span></p>
            </div>
            <div style="grid-column: 1 / -1; text-align: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid #ddd;">
                <p><strong>Số câu đúng:</strong> <span style="color: red; font-weight: bold;">${soCauDung}/${tongSoCau}</span></p>
                <p><strong>Số điểm:</strong> <span style="color: red; font-weight: bold;">${tongDiemDatDuoc}/${tongDiemToiDa}</span></p>
                <p><strong>Thời gian nộp:</strong> <span style="color: red; font-weight: bold;">${ngayGioNop}</span></p>
                <p><strong>Thời gian làm bài:</strong> <span style="color: red; font-weight: bold;">${thoiGiamlam}</span></p>
            </div>
    `;

    // Chèn phần thông tin vào trước form bài làm
    document.querySelector(".quiz-wrapper").insertBefore(infoDiv, document.getElementById("quizForm"));

    // Ẩn nút nộp bài
    document.querySelector('button[type="button"]').style.display = 'none';

    const listCauHoiRaw = row[index('list_cau_hoi')] || '[]';
    const listDapAnRaw = row[index('list_dap_an')] || '[]';
    const listTraLoiRaw = row[index('list_cau_tra_loi')] || '[]';
    const listDiemRaw = row[index('list_diem_tung_cau')] || '[]';


    let listCauHoi = [], listDapAn = [], listTraLoi = [], listDiem = [];

    try {
        listCauHoi = JSON.parse(listCauHoiRaw);
        listDapAn = JSON.parse(listDapAnRaw);
        listTraLoi = JSON.parse(listTraLoiRaw);
        listDiem = JSON.parse(listDiemRaw); // ✅ Thêm dòng này
    } catch (e) {
        document.getElementById("quizForm").innerHTML = `<p style="color:red; text-align:center;">Dữ liệu JSON không hợp lệ.</p>`;
        return;
    }

    const quizForm = document.getElementById("quizForm");
    quizForm.innerHTML = "";

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

        const traLoiColor = diemDatDuoc > 0 ? '#28a745' : '#dc3545';  // ✅ màu xanh nếu đạt điểm

        div.innerHTML = `
        <p>
            <strong>Câu ${i + 1}:</strong> ${cau}
            <span style="margin-left: 10px; color: ${diemDatDuoc > 0 ? 'green' : 'red'};">
                — Đạt được: ${diemDatDuoc} điểm
            </span>
        </p>
        <p style="margin-left: 10px; color: ${traLoiColor};">Câu trả lời: ${traLoi}</p>
        <p style="margin-left: 10px; color: #28a745;">Đáp án đúng: ${dapAnDung}</p>
    `;

        quizForm.appendChild(div);
    });



    document.getElementById("quizResult").innerHTML = `
        `;
}

function startCountdown(durationInMinutes) {
    const countdownEl = document.getElementById("countdownTimerFixed");
    const sound = document.getElementById("alarmSound");
    let timeLeft = durationInMinutes * 60;

    const timer = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        countdownEl.textContent = `Thời gian còn lại: ${minutes} phút ${seconds < 10 ? '0' : ''}${seconds} giây`;

        if (--timeLeft < 0) {
            clearInterval(timer);
            countdownEl.textContent = "Hết giờ!";
            sound.play(); // phát âm thanh
            alert("Đã hết thời gian làm bài. Hệ thống sẽ tự động nộp bài.");
            submitQuiz();
        }
    }, 1000);
}
