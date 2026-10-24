/**
 * @file VictoryModal.js
 * @description Quản lý màn hình chiến thắng sau khi hoàn thành xuất sắc toàn bộ 33 màn chơi (Congratulations Screen),
 * điều khiển MovieClip lib.Congra(), phát nhạc nền chiến thắng (Music.mp3),
 * hiển thị bảng tổng kết số liệu thành tích (Tổng số bước đi, Tổng số lần ngã rơi, Tổng thời gian speedrun)
 * và cung cấp nút Next để người chơi quay về Menu chính.
 */

export class VictoryModal {
    /**
     * Các mốc khung hình quan trọng trên timeline của MovieClip lib.Congra.
     * Tác dụng: Điều hướng các hoạt cảnh phóng to chúc mừng, cập nhật số liệu và kết thúc màn hình.
     * @readonly
     */
    static FRAMES = Object.freeze({
        START: 0,           // Khung hình bắt đầu hoạt cảnh chúc mừng chiến thắng
        UPDATE_STATS: 30,   // Mốc bảng số liệu trượt vào hoàn tất, sẵn sàng cập nhật số
        IDLE_WAIT_CLICK: 37,// Dừng chờ người chơi đọc kết quả và nhấp nút Next
        RETURN_TO_MENU: 45  // Hoạt cảnh mờ dần kết thúc, quay trở lại Menu chính
    });

    /**
     * Khởi tạo màn hình chiến thắng.
     * Tác dụng: Tạo MovieClip đồ họa, kết nối dịch vụ âm thanh và đăng ký sự kiện cho nút Next.
     *
     * @param {Object} [options={}]
     * @param {createjs.MovieClip|null} [options.clip=null] - Instance MovieClip lib.Congra có sẵn nếu có.
     * @param {import("../services/AudioService.js").AudioService} [options.audioService=null] - Dịch vụ âm thanh.
     * @param {import("../services/StorageService.js").StorageService} [options.storageService=null] - Dịch vụ lưu trữ.
     */
    constructor(options = {}) {
        /**
         * Instance MovieClip CreateJS của màn hình chiến thắng (lib.Congra).
         * @private
         * @type {createjs.MovieClip|null}
         */
        this._clip = options.clip || this._createDefaultClip();

        /**
         * Dịch vụ âm thanh phát nhạc nền chiến thắng và âm thanh nút bấm.
         * @private
         * @type {import("../services/AudioService.js").AudioService|null}
         */
        this._audioService = options.audioService || null;

        /**
         * Dữ liệu thống kê tổng kết lần chơi hoàn thành 33 màn.
         * @private
         * @type {{ totalMoves: number, totalFalls: number, timeTakenMs: number, digits: number[]|null }}
         */
        this._stats = {
            totalMoves: 0,
            totalFalls: 0,
            timeTakenMs: 0,
            digits: null
        };

        /**
         * Callback thực thi khi người chơi nhấn nút Next để quay về Menu chính.
         * @private
         * @type {(() => void)|null}
         */
        this._onReturnCallback = null;

        this._setupListeners();
    }

    /**
     * Tạo mới instance lib.Congra từ namespace CreateJS lib.
     * Tác dụng: Khởi tạo đối tượng đồ họa hiển thị cho màn hình chiến thắng.
     *
     * @private
     * @returns {createjs.MovieClip|null}
     */
    _createDefaultClip() {
        if (typeof window !== "undefined" && window.lib && typeof window.lib.Congra === "function") {
            return new window.lib.Congra();
        }
        return null;
    }

    /**
     * Gắn sự kiện và âm thanh cho nút Next (`rrr.next`).
     * Tác dụng: Cho phép người chơi đóng màn hình tổng kết và quay về Menu chính sau khi chiêm ngưỡng thành tích.
     *
     * @private
     * @returns {void}
     */
    _setupListeners() {
        if (!this._clip || !this._clip.rrr || !this._clip.rrr.next) return;

        const nextBtn = this._clip.rrr.next;

        nextBtn.addEventListener("mouseover", () => {
            if (this._audioService) this._audioService.playAction("click");
        });

        nextBtn.addEventListener("click", () => {
            if (this._audioService) this._audioService.playAction("latch");

            // Kích hoạt hoạt cảnh mờ dần chuyển tiếp (từ frame 38 đến 45)
            if (this._clip) {
                this._clip.play();
            }

            // Gọi callback chuyển về Menu sau khi hoạt cảnh kết thúc
            setTimeout(() => {
                if (typeof this._onReturnCallback === "function") {
                    this._onReturnCallback();
                }
            }, 250);
        });
    }

    /**
     * Lấy đối tượng DisplayObject CreateJS để thêm vào container hiển thị trên Stage.
     *
     * @returns {createjs.MovieClip|null}
     */
    getDisplayObject() {
        return this._clip;
    }

    /**
     * Hiển thị màn hình chiến thắng, phát bài nhạc nền chúc mừng và cập nhật bảng số liệu tổng kết.
     * Tác dụng: Tuyên dương người chơi đã phá đảo thành công toàn bộ 33 màn chơi.
     *
     * @param {Object} stats - Dữ liệu thống kê tổng kết toàn bộ 33 màn.
     * @param {number} stats.totalMoves - Tổng số bước di chuyển đã thực hiện.
     * @param {number} stats.totalFalls - Tổng số lần khối hộp bị rơi vực.
     * @param {number} [stats.timeTakenMs=0] - Tổng thời gian speedrun (mili-giây).
     * @param {number[]|null} [stats.digits=null] - Mảng 6 chữ số [giờ1, giờ2, phút1, phút2, giây1, giây2] từ TimerService.
     * @returns {void}
     */
    show(stats) {
        if (!this._clip) return;

        this._stats = {
            totalMoves: stats.totalMoves || 0,
            totalFalls: stats.totalFalls || 0,
            timeTakenMs: stats.timeTakenMs || 0,
            digits: stats.digits || null
        };

        // 1. Phát bài nhạc nền chúc mừng chiến thắng (phát một lần, không lặp lại)
        if (this._audioService) {
            this._audioService.playMusic(0);
        }

        // 2. Cập nhật các giá trị thống kê lên bảng MovieClip rrr
        this._updateStatsDisplay();

        // 3. Kích hoạt hoạt cảnh giới thiệu bảng số liệu trượt vào giữa màn hình
        this._clip.gotoAndPlay(VictoryModal.FRAMES.START);
    }

    /**
     * Bóc tách và cập nhật toàn bộ các MovieClip con hiển thị số (`lib.numberdisplaysmall`).
     * Tác dụng: Hiển thị trực quan 6 ô số bước đi, 4 ô số lần rơi và 6 ô số đồng hồ giờ:phút:giây.
     *
     * @private
     * @returns {void}
     */
    _updateStatsDisplay() {
        if (!this._clip || !this._clip.rrr) return;

        const rrr = this._clip.rrr;

        // 1. Cập nhật tổng số nước đi (Total Moves) lên 6 ô số moves1 đến moves6
        let movesStr = String(this._stats.totalMoves);
        while (movesStr.length < 6) {
            movesStr = " " + movesStr;
        }

        for (let i = 0; i < 6; i++) {
            const digitClip = rrr[`moves${i + 1}`];
            if (digitClip && typeof digitClip.gotoAndStop === "function") {
                // Khoảng trắng thì hiển thị frame 11 (blank), chữ số 0-9 hiển thị frame tương ứng
                const frame = movesStr[i] === " " ? 11 : parseInt(movesStr[i], 10);
                digitClip.gotoAndStop(frame);
            }
        }

        // 2. Cập nhật tổng số lần rơi vực (Total Falls) lên 4 ô số falls1 đến falls4
        let fallsStr = String(this._stats.totalFalls + 1);
        while (fallsStr.length < 4) {
            fallsStr = " " + fallsStr;
        }

        for (let i = 0; i < 4; i++) {
            const digitClip = rrr[`falls${i + 1}`];
            if (digitClip && typeof digitClip.gotoAndStop === "function") {
                const frame = fallsStr[i] === " " ? 11 : parseInt(fallsStr[i], 10);
                digitClip.gotoAndStop(frame);
            }
        }

        // 3. Cập nhật tổng thời gian speedrun lên 6 ô số digit1 đến digit6 (HH:MM:SS)
        let digits = this._stats.digits;

        if (!digits || digits.length < 6) {
            const totalMs = this._stats.timeTakenMs;
            const seconds = String(Math.floor(totalMs / 1000) % 60).padStart(2, "0");
            const minutes = String(Math.floor(totalMs / 1000 / 60) % 60).padStart(2, "0");
            const hours = String(Math.floor(totalMs / 1000 / 60 / 60)).padStart(2, "0");

            digits = [
                parseInt(hours[hours.length - 2] || "0", 10),
                parseInt(hours[hours.length - 1] || "0", 10),
                parseInt(minutes[0], 10),
                parseInt(minutes[1], 10),
                parseInt(seconds[0], 10),
                parseInt(seconds[1], 10)
            ];
        }

        for (let i = 0; i < 6; i++) {
            const digitClip = rrr[`digit${i + 1}`];
            if (digitClip && typeof digitClip.gotoAndStop === "function") {
                digitClip.gotoAndStop(digits[i]);
            }
        }
    }

    /**
     * Đăng ký callback khi người chơi nhấn nút Next để quay về Menu chính.
     * Tác dụng: Thông báo cho GameEngine chuyển trạng thái về MENU.
     *
     * @param {() => void} cb
     * @returns {void}
     */
    onReturnToMenu(cb) {
        this._onReturnCallback = cb;
    }

    /**
     * Dọn dẹp tài nguyên và dừng bài nhạc nền chiến thắng.
     * Tác dụng: Ngăn chặn rò rỉ bộ nhớ và tắt âm thanh khi rời khỏi màn hình chiến thắng.
     *
     * @returns {void}
     */
    destroy() {
        if (this._audioService) {
            this._audioService.stopMusic();
        }

        if (this._clip) {
            this._clip.stop();
            if (this._clip.parent) {
                this._clip.parent.removeChild(this._clip);
            }
        }

        this._clip = null;
        this._audioService = null;
        this._onReturnCallback = null;
    }
}
