const SPREADSHEET_ID = '1HSu0zVtvTu5N9uun6fp81dxEXayzNVGYdigu_7pYk20';
const RANGE = 'danh_sach_cau_hoi!A1:N';
const API_KEY = 'AIzaSyA9g2qFUolpsu3_HVHOebdZb0NXnQgXlFM';

function loadGapiAndInitialize() {
    const script = document.createElement('script');
    script.src = "https://apis.google.com/js/api.js";
    script.onload = initialize;
    script.onerror = () => console.error('Failed to load Google API Client.');
    document.body.appendChild(script);
}

function initialize() {
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4']
            });
            loadQuiz();
        } catch (error) {
            console.error('Initialization Error:', error);
        }
    });
}

document.addEventListener('DOMContentLoaded', loadGapiAndInitialize);

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function loadQuiz() {
    const res = await gapi.client.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: RANGE
    });

    const rows = res.result.values;
    const headers = rows[0];
    const data = shuffleArray(rows.slice(1));  // Xáo trộn câu hỏi mỗi lần tải

    const index = (name) => headers.indexOf(name);
    const quizForm = document.getElementById("quizForm");

    window.correctAnswers = [];
    window.questionTypes = [];

    data.forEach((row, i) => {
        const question = row[index('noi_dung_cau_hoi')];
        const type = (row[index('phan_loai')] || '').toLowerCase();
        const options = ['a', 'b', 'c', 'd'].map(k => row[index('lua_chon_' + k)]);
        const answer = row[index('dap_an')];

        window.correctAnswers.push(answer);
        window.questionTypes.push(type);

        const qDiv = document.createElement("div");
        qDiv.className = "question-block";
        qDiv.innerHTML = `<p>Câu ${i + 1}: ${question}</p>`;

        if (type === 'trắc nghiệm' || type === 'đa lựa chọn') {
            const optDiv = document.createElement("div");
            optDiv.className = "options-container";

            options.forEach((opt, j) => {
                if (opt) {
                    const inputType = type === 'đa lựa chọn' ? 'checkbox' : 'radio';
                    const value = String.fromCharCode(65 + j);
                    optDiv.innerHTML += `
                        <label>
                            <input type="${inputType}" name="q${i}" value="${value}">
                            <span>${value}. ${opt}</span>
                        </label>`;
                }
            });

            qDiv.appendChild(optDiv);

        } else if (type === 'tự luận') {
            qDiv.innerHTML += `<textarea name="q${i}" rows="4" placeholder="Nhập câu trả lời..."></textarea>`;
        } else if (type === 'số') {
            qDiv.innerHTML += `<input type="number" name="q${i}" min="1" placeholder="Nhập số > 0">`;
        } else if (type === 'ngày tháng') {
            qDiv.innerHTML += `<input type="date" name="q${i}">`;
        }

        quizForm.appendChild(qDiv);
    });
}


function submitQuiz() {
    const total = window.correctAnswers.length;
    let score = 0;

    for (let i = 0; i < total; i++) {
        const type = window.questionTypes[i];
        const correct = (window.correctAnswers[i] || '').toString().split(',').map(a => a.trim());
        let userAnswer = "";

        if (type === 'trắc nghiệm') {
            const selected = document.querySelector(`input[name="q${i}"]:checked`);
            userAnswer = selected ? selected.value : '';
            if (correct.includes(userAnswer)) score++;
        } else if (type === 'đa lựa chọn') {
            const selected = [...document.querySelectorAll(`input[name="q${i}"]:checked`)].map(el => el.value);
            if (selected.length === correct.length && selected.every(v => correct.includes(v))) score++;
        } else if (type === 'tự luận' || type === 'ngày tháng') {
            const val = document.querySelector(`[name="q${i}"]`).value.trim();
            if (val !== "") score++;
        } else if (type === 'số') {
            const val = parseFloat(document.querySelector(`[name="q${i}"]`).value);
            if (!isNaN(val) && val > 0) score++;
        }
    }

    document.getElementById("quizResult").innerText = `Kết quả: đúng ${score}/${total} câu (dựa theo định dạng hợp lệ hoặc khớp đáp án)`;

    // Lấy thông tin người dùng
    const hoTen = document.querySelector('[name="hoTen"]').value.trim();
    const chucDanh = document.querySelector('[name="chucDanh"]').value.trim();
    const boPhan = document.querySelector('[name="boPhan"]').value.trim();
    const soDienThoai = document.querySelector('[name="soDienThoai"]').value.trim();
    const email = document.querySelector('[name="email"]').value.trim();
    const now = new Date().toLocaleString();

    // Thu thập chi tiết câu trả lời
    const chiTiet = [];

    for (let i = 0; i < total; i++) {
        const type = window.questionTypes[i];
        if (type === 'trắc nghiệm') {
            const sel = document.querySelector(`input[name="q${i}"]:checked`);
            chiTiet.push(sel ? sel.value : '');
        } else if (type === 'đa lựa chọn') {
            const selected = [...document.querySelectorAll(`input[name="q${i}"]:checked`)].map(el => el.value).join(',');
            chiTiet.push(selected);
        } else {
            const val = document.querySelector(`[name="q${i}"]`).value.trim();
            chiTiet.push(val);
        }
    }

    // Ghi dữ liệu về Google Sheets thông qua Web App
    fetch("https://script.google.com/a/macros/quangminhpro.com/s/AKfycbxzOfiQ1Uh-EYkDNwC4d4J7TTHwCD7he0kVrQioIRwI7BPGMygA0UWspBj3O8NJ9Ep1/exec", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            hoTen,
            chucDanh,
            boPhan,
            soDienThoai,
            email,
            ngayGioNop: now,
            soCauDung: score,
            tongSoCau: total,
            chiTiet: chiTiet.join(" | ")
        })
    })
        .then(res => res.text())
        .then(txt => {
            console.log("Gửi thành công:", txt);
            alert("Bài làm của bạn đã được ghi nhận!");
        })
        .catch(err => {
            console.error("Lỗi gửi dữ liệu:", err);
            alert("Đã xảy ra lỗi khi gửi kết quả. Vui lòng thử lại.");
        });

}

async function writeResultToSheet(data) {
    try {
        const response = await gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: "ket_qua_kiem_tra!A1",
            valueInputOption: "USER_ENTERED",
            insertDataOption: "INSERT_ROWS",
            resource: {
                values: [data]
            }
        });
        console.log("Ghi dữ liệu thành công", response);
    } catch (error) {
        console.error("Lỗi khi ghi dữ liệu:", error);
        alert("Đã xảy ra lỗi khi lưu kết quả. Vui lòng thử lại.");
    }
}
