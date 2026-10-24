/**
 * @file TimerService.js
 * @description Quản lý thời gian chơi, đếm giờ tổng thể và từng màn chơi,
 * đồng bộ thời gian với giao diện bảng điểm HTML và cung cấp dữ liệu số hiển thị cho menu Pause và màn hình chiến thắng.
 */

export class TimerService {
    /**
     * Khởi tạo dịch vụ đếm giờ và đăng ký các hook hỗ trợ tương thích giao diện.
     */
    constructor() {
        /**
         * Mốc thời gian bắt đầu phiên chơi tổng (Timestamp ms).
         * @private
         * @type {number}
         */
        this._totalStartTime = Date.now();

        /**
         * Mốc thời gian bắt đầu của màn chơi hiện tại (Timestamp ms).
         * @private
         * @type {number}
         */
        this._stageStartTime = Date.now();

        /**
         * Thời gian đã tích lũy trước khi người chơi nhấn tạm dừng (ms).
         * @private
         * @type {number}
         */
        this._pausedElapsed = 0;

        /**
         * Trạng thái hoạt động của đồng hồ (true: đang đếm, false: đang tạm dừng).
         * @private
         * @type {boolean}
         */
        this._isActive = false;

        /**
         * Số thứ tự màn chơi hiện tại đang được theo dõi (1 đến 33).
         * @private
         * @type {number}
         */
        this._currentLevel = 1;

        /**
         * Mảng lưu trữ thời gian hoàn thành (ms) của từng màn chơi riêng biệt.
         * @private
         * @type {number[]}
         */
        this._stageTimes = [];

        /**
         * ID của bộ định thời setInterval dùng để cập nhật chu kỳ hiển thị lên bảng thời gian HTML.
         * @private
         * @type {number|null}
         */
        this._timerInterval = null;

        /**
         * Danh sách cache các phần tử thẻ <td> hiển thị thời gian của 33 màn chơi trên DOM.
         * @private
         * @type {HTMLElement[]}
         */
        this._stageTimeCells = [];

        this._registerGlobalHooks();
        this._initDOMTable();
    }

    /**
     * Đăng ký các hàm điều khiển thời gian toàn cục để các thành phần giao diện có thể truy cập thuận tiện.
     * Tác dụng: Cho phép các màn hình và menu kích hoạt bắt đầu, tạm dừng hoặc thiết lập lại bộ đếm giờ.
     *
     * @private
     * @returns {void}
     */
    _registerGlobalHooks() {
        if (typeof window === "undefined") return;

        window.StartTimer = () => this.start();
        window.PauseTimer = () => this.pause();
        window.ResumeTimer = () => this.resume();
        window.ResetTimer = () => this.reset();
        window.RestartTimerForCurrentStage = () => this.restartCurrentStage();
        window.setCurrentLevel = (lvl) => this.setCurrentLevel(lvl);
        window.AddStageByLevel = (lvl) => this.recordStageCompletion(lvl);
    }

    /**
     * Khởi tạo cấu trúc bảng hiển thị 33 màn chơi trên giao diện HTML side panel (thẻ #timeRows).
     * Tác dụng: Tạo sẵn các hàng hiển thị từ Stage 1 đến Stage 33 để cập nhật thời gian theo thời gian thực.
     *
     * @private
     * @returns {void}
     */
    _initDOMTable() {
        if (typeof document === "undefined") return;
        const timeRows = document.getElementById("timeRows");
        if (!timeRows) return;

        let html = "";
        for (let i = 1; i <= 33; i++) {
            html += `<tr id='stage${i}'><td>${i}</td><td id='stage${i}time'>-</td></tr>`;
        }
        timeRows.innerHTML = html;

        this._stageTimeCells = [];
        for (let i = 1; i <= 33; i++) {
            this._stageTimeCells[i] = document.getElementById(`stage${i}time`);
        }
    }

    /**
     * Cập nhật thời gian đã trôi qua của màn chơi hiện tại lên ô tương ứng trong bảng HTML.
     * Tác dụng: Tạo hiệu ứng đồng hồ đếm giây mượt mà và trực quan trên thanh side panel.
     *
     * @private
     * @returns {void}
     */
    _updateDOMTable() {
        if (!this._isActive || typeof document === "undefined") return;
        const cell = this._stageTimeCells[this._currentLevel];
        if (cell) {
            const elapsed = this.getTotalElapsedMs();
            cell.textContent = TimerService.formatDuration(elapsed);
        }
    }

    /**
     * Thiết lập màn chơi hiện tại và tự động cuộn bảng HTML tới hàng của màn chơi đó.
     * Tác dụng: Đồng bộ hóa đồng hồ với màn chơi đang chơi và giữ hàng thời gian luôn trong tầm nhìn của người chơi.
     *
     * @param {number} levelNumber - Số thứ tự màn chơi (1 đến 33).
     * @returns {void}
     */
    setCurrentLevel(levelNumber) {
        const parsedLevel = Number.parseInt(levelNumber, 10);
        this._currentLevel = Math.max(1, Number.isFinite(parsedLevel) ? parsedLevel : 1);
        if (typeof window !== "undefined") {
            window.currentLevel = this._currentLevel;
        }

        if (typeof document !== "undefined") {
            const row = document.getElementById(`stage${this._currentLevel}`);
            if (row && typeof row.scrollIntoView === "function") {
                row.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });
            }
        }
        this._updateDOMTable();
    }

    /**
     * Bắt đầu đếm thời gian khi người chơi bước vào màn chơi đầu tiên hoặc chơi mới.
     * Tác dụng: Khởi động mốc thời gian gốc và kích hoạt vòng lặp cập nhật bảng hiển thị (50ms/lần).
     *
     * @returns {void}
     */
    start() {
        this._pausedElapsed = 0;
        this._totalStartTime = Date.now();
        this._stageStartTime = this._totalStartTime;
        this._isActive = true;

        if (this._timerInterval) {
            clearInterval(this._timerInterval);
        }
        this._timerInterval = setInterval(() => this._updateDOMTable(), 50);
        this._updateDOMTable();
    }

    /**
     * Tạm dừng đồng hồ khi mở Menu tạm dừng hoặc khi người chơi đang xem thông báo.
     * Tác dụng: Đóng băng thời gian đã trôi qua để không tính thời gian tạm dừng vào thành tích chơi.
     *
     * @returns {void}
     */
    pause() {
        if (!this._isActive) return;

        this._pausedElapsed = Date.now() - this._totalStartTime;
        this._isActive = false;

        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }
    }

    /**
     * Tiếp tục đếm giờ sau khi đóng Menu tạm dừng và quay trở lại màn chơi.
     * Tác dụng: Bù trừ phần thời gian đã tạm dừng để mốc thời gian tổng tiếp tục chạy chính xác.
     *
     * @returns {void}
     */
    resume() {
        if (this._isActive) return;

        this._totalStartTime = Date.now() - this._pausedElapsed;
        this._stageStartTime = this._totalStartTime;
        this._isActive = true;

        if (this._timerInterval) {
            clearInterval(this._timerInterval);
        }
        this._timerInterval = setInterval(() => this._updateDOMTable(), 50);
        this._updateDOMTable();
    }

    /**
     * Đặt lại toàn bộ dữ liệu thời gian về trạng thái ban đầu.
     * Tác dụng: Xóa sạch dữ liệu khi bắt đầu một phiên chơi hoàn toàn mới từ đầu.
     *
     * @returns {void}
     */
    reset() {
        this._totalStartTime = Date.now();
        this._stageStartTime = this._totalStartTime;
        this._pausedElapsed = 0;
        this._isActive = false;
        this._stageTimes = [];

        if (this._timerInterval) {
            clearInterval(this._timerInterval);
            this._timerInterval = null;
        }

        if (this._stageTimeCells.length === 0) {
            this._initDOMTable();
        }

        for (let i = 1; i <= 33; i++) {
            if (this._stageTimeCells[i]) {
                this._stageTimeCells[i].textContent = "-";
            }
        }
    }

    /**
     * Đặt lại đồng hồ riêng cho màn chơi hiện tại khi người chơi nhập mật mã chuyển màn (Load Stage).
     * Tác dụng: Khởi tạo lại mốc tính giờ để bắt đầu tính thời gian cho màn chơi vừa được nạp.
     *
     * @returns {void}
     */
    restartCurrentStage() {
        this._totalStartTime = Date.now();
        this._stageStartTime = this._totalStartTime;
        this._pausedElapsed = 0;
        this._isActive = true;

        if (this._timerInterval) {
            clearInterval(this._timerInterval);
        }
        this._timerInterval = setInterval(() => this._updateDOMTable(), 50);
        this._updateDOMTable();
    }

    /**
     * Ghi nhận mốc thời gian hoàn thành khi khối hộp lọt vào lỗ đích của màn chơi.
     * Tác dụng: Lưu lại thành tích thời gian của màn đó và cập nhật giá trị cố định lên bảng HTML.
     *
     * @param {number} level - Số thứ tự màn chơi vừa hoàn thành.
     * @returns {number} Thời gian hoàn thành màn chơi (mili-giây).
     */
    recordStageCompletion(level) {
        const parsedLevel = Number.parseInt(level, 10);
        const completedLevel = Math.max(1, Number.isFinite(parsedLevel) ? parsedLevel : this._currentLevel);
        const elapsed = this.getTotalElapsedMs();
        this._stageTimes[completedLevel] = elapsed;

        if (this._stageTimeCells[completedLevel]) {
            this._stageTimeCells[completedLevel].textContent = TimerService.formatDuration(elapsed);
        }

        return elapsed;
    }

    /**
     * Lấy tổng thời gian chơi đã trôi qua tính bằng mili-giây.
     * Tác dụng: Phục vụ tính điểm tổng kết và hiển thị trên menu kết thúc màn chơi.
     *
     * @returns {number} Thời gian (ms).
     */
    getTotalElapsedMs() {
        if (!this._isActive) {
            return this._pausedElapsed;
        }
        return Date.now() - this._totalStartTime;
    }

    /**
     * @public
     * @api
     * Lấy thời gian đã trôi qua của riêng màn chơi hiện tại tính bằng mili-giây.
     * Tác dụng: Đo thời gian người chơi giải đố màn chơi đang diễn ra.
     *
     * @returns {number} Thời gian màn chơi hiện tại (ms).
     */
    // noinspection JSUnusedGlobalSymbols
    getCurrentStageElapsedMs() {
        if (!this._isActive) return 0;
        return Date.now() - this._stageStartTime;
    }

    /**
     * @public
     * @api
     * Kiểm tra xem đồng hồ đếm giờ có đang ở trạng thái hoạt động hay không.
     * Tác dụng: Xác định trạng thái của game để đồng bộ hóa với hệ thống quản lý trạng thái.
     *
     * @returns {boolean} True nếu đồng hồ đang chạy.
     */
    // noinspection JSUnusedGlobalSymbols
    isActive() {
        return this._isActive;
    }

    /**
     * Bóc tách các thành phần giờ, phút, giây và mảng 6 chữ số độc lập.
     * Tác dụng: Cung cấp dữ liệu định dạng chuẩn để ánh xạ trực tiếp lên 6 movieclip chữ số (digit1 đến digit6)
     * trên bảng hiển thị PauseMenu và màn hình Victory.
     *
     * @returns {{
     *   hours: number,
     *   minutes: number,
     *   seconds: number,
     *   digits: [number, number, number, number, number, number]
     * }}
     */
    getPauseMenuStats() {
        const totalMs = this.getTotalElapsedMs();

        const secondsNum = Math.floor(totalMs / 1000) % 60;
        const minutesNum = Math.floor(totalMs / (1000 * 60)) % 60;
        const hoursNum = Math.floor(totalMs / (1000 * 60 * 60));

        const sStr = String(secondsNum).padStart(2, "0");
        const mStr = String(minutesNum).padStart(2, "0");
        const hStr = String(hoursNum).padStart(2, "0");

        return {
            hours: hoursNum,
            minutes: minutesNum,
            seconds: secondsNum,
            // 6 chữ số tương ứng: [chục giờ, đơn vị giờ, chục phút, đơn vị phút, chục giây, đơn vị giây]
            digits: [
                parseInt(hStr[hStr.length - 2] || "0", 10),
                parseInt(hStr[hStr.length - 1] || "0", 10),
                parseInt(mStr[0], 10),
                parseInt(mStr[1], 10),
                parseInt(sStr[0], 10),
                parseInt(sStr[1], 10)
            ]
        };
    }

    /**
     * Chuyển đổi mili-giây sang chuỗi hiển thị định dạng chuẩn phút:giây.mili-giây (mm:ss.mmm).
     * Tác dụng: Hiển thị chuỗi thời gian đẹp mắt trên bảng side panel và giao diện người dùng.
     *
     * @param {number} diffMs - Khoảng thời gian tính bằng mili-giây.
     * @returns {string} Chuỗi thời gian đã định dạng, ví dụ: "01:25.432".
     */
    static formatDuration(diffMs) {
        let diff = Math.max(0, diffMs);

        const mins = Math.floor(diff / (1000 * 60));
        diff -= mins * (1000 * 60);

        const seconds = Math.floor(diff / 1000);
        diff -= seconds * 1000;

        const mStr = String(mins).padStart(2, "0");
        const sStr = String(seconds).padStart(2, "0");
        const msStr = String(diff).padStart(3, "0");

        return `${mStr}:${sStr}.${msStr}`;
    }
}
