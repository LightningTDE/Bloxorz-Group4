/**
 * @file PauseMenu.js
 * @description Quản lý màn hình Menu tạm dừng trong màn chơi (Pause Menu),
 * điều khiển MovieClip lib.PauseMenu(), hiển thị bảng thống kê chi tiết
 * (tổng số lần ngã rơi, số thứ tự màn chơi hiện tại, đồng hồ thời gian giờ:phút:giây),
 * cung cấp các nút tương tác Tiếp tục chơi, Bật/Tắt âm thanh và Thoát về Menu chính.
 */

export class PauseMenu {
    /**
     * Các mốc khung hình quan trọng trên timeline của MovieClip lib.PauseMenu.
     * Tác dụng: Điều hướng các trạng thái đóng, mở và kết thúc hoạt cảnh trượt ra/vào.
     * @readonly
     */
    static FRAMES = Object.freeze({
        CLOSED: 0,        // Trạng thái menu đóng hoàn toàn (nằm ngoài mép màn hình)
        OPEN: 12,         // Trạng thái menu mở đầy đủ trên màn hình
        ANIMATION_END: 24 // Hoạt cảnh trượt đóng kết thúc, quay về trạng thái CLOSED
    });

    /**
     * Khởi tạo đối tượng quản lý Menu tạm dừng.
     * Tác dụng: Tạo MovieClip đồ họa và đăng ký các sự kiện tương tác cho các nút bấm.
     *
     * @param {Object} [options={}]
     * @param {createjs.MovieClip|null} [options.clip=null] - Instance MovieClip lib.PauseMenu có sẵn nếu có.
     * @param {import("../services/AudioService.js").AudioService} [options.audioService=null] - Dịch vụ âm thanh.
     */
    constructor(options = {}) {
        /**
         * Instance MovieClip CreateJS của PauseMenu.
         * @private
         * @type {createjs.MovieClip|null}
         */
        this._clip = options.clip || this._createDefaultClip();

        /**
         * Dịch vụ âm thanh phát hiệu ứng Click và Latch.
         * @private
         * @type {import("../services/AudioService.js").AudioService|null}
         */
        this._audioService = options.audioService || null;

        /**
         * Danh sách các hàm callback xử lý khi người chơi nhấp chọn các nút trên Menu.
         * @private
         */
        this._callbacks = {
            resume: null,
            toggleSound: null,
            quit: null
        };

        this._setupButtonListeners();
    }

    /**
     * Tạo mới instance MovieClip lib.PauseMenu từ namespace CreateJS lib.
     * Tác dụng: Khởi tạo đối tượng đồ họa cho menu tạm dừng.
     *
     * @private
     * @returns {createjs.MovieClip|null}
     */
    _createDefaultClip() {
        if (typeof window !== "undefined" && window.lib && typeof window.lib.PauseMenu === "function") {
            return new window.lib.PauseMenu();
        }
        return null;
    }

    /**
     * Gắn các bộ lắng nghe sự kiện chuột và hiệu ứng âm thanh cho 3 nút bấm trên PauseMenu.
     * Tác dụng: Xử lý nút Tiếp tục chơi (returnToGame), Bật/Tắt âm thanh (toggleSound) và Thoát ra Menu chính (quitToMenu).
     *
     * @private
     * @returns {void}
     */
    _setupButtonListeners() {
        if (!this._clip || !this._clip.buttons) return;

        const btns = this._clip.buttons;

        // 1. Nút Tiếp tục chơi (returnToGame)
        if (btns.returnToGame) {
            this._bindButtonSound(btns.returnToGame);
            btns.returnToGame.addEventListener("click", () => {
                this.close();
                if (typeof this._callbacks.resume === "function") {
                    this._callbacks.resume();
                }
            });
        }

        // 2. Nút Bật/Tắt âm thanh (toggleSound)
        if (btns.toggleSound) {
            this._bindButtonSound(btns.toggleSound);
            btns.toggleSound.addEventListener("click", () => {
                if (typeof this._callbacks.toggleSound === "function") {
                    this._callbacks.toggleSound();
                }
            });
        }

        // 3. Nút Thoát ra Menu chính (quitToMenu)
        if (btns.quitToMenu) {
            this._bindButtonSound(btns.quitToMenu);
            btns.quitToMenu.addEventListener("click", () => {
                this.close();
                if (typeof this._callbacks.quit === "function") {
                    this._callbacks.quit();
                }
            });
        }
    }

    /**
     * Gắn âm thanh hover và âm thanh khi bấm cho nút bấm.
     * Tác dụng: Tạo phản hồi âm thanh trực quan khi người chơi di chuột hoặc click nút.
     *
     * @private
     * @param {createjs.DisplayObject} btn - Nút bấm cần gắn âm thanh.
     * @returns {void}
     */
    _bindButtonSound(btn) {
        if (!btn) return;

        if (typeof window !== "undefined" && typeof window.addButtonSounds === "function") {
            window.addButtonSounds(btn);
            return;
        }

        btn.addEventListener("mouseover", () => {
            if (this._audioService) {
                this._audioService.playAction("click");
            }
        });

        btn.addEventListener("click", () => {
            if (this._audioService) {
                this._audioService.playAction("latch");
            }
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
     * Kiểm tra xem PauseMenu hiện có đang ở trạng thái mở trên màn hình hay không.
     * Tác dụng: Giúp GameEngine xác định trạng thái tạm dừng của trò chơi.
     *
     * @returns {boolean} True nếu menu đang mở (currentFrame khác 0).
     */
    isOpen() {
        if (!this._clip) return false;
        return this._clip.currentFrame !== PauseMenu.FRAMES.CLOSED;
    }

    /**
     * Mở PauseMenu với hoạt cảnh trượt mượt mà từ hai bên mép vào giữa màn hình.
     * Tác dụng: Hiển thị bảng tạm dừng khi người chơi nhấn nút Menu hoặc phím tạm dừng.
     *
     * @returns {void}
     */
    open() {
        if (!this._clip) return;
        if (this._clip.currentFrame === PauseMenu.FRAMES.CLOSED) {
            this._clip.play();
        }
    }

    /**
     * Đóng PauseMenu với hoạt cảnh trượt ra hai bên và dừng lại tại khung hình đóng.
     * Tác dụng: Ẩn bảng tạm dừng để người chơi quay trở lại tiếp tục màn chơi.
     *
     * @returns {void}
     */
    close() {
        if (!this._clip) return;
        if (this._clip.currentFrame === PauseMenu.FRAMES.OPEN) {
            this._clip.play();
        }
    }

    /**
     * Chuyển đổi trạng thái giữa Mở và Đóng của PauseMenu.
     * Tác dụng: Cho phép bật/tắt nhanh menu chỉ bằng một lệnh duy nhất.
     *
     * @returns {void}
     */
    toggle() {
        if (!this._clip) return;
        this._clip.play();
    }

    /**
     * Cập nhật toàn bộ các chỉ số thống kê hiển thị trên PauseMenu:
     * Số lần ngã rơi (Falls), số thứ tự màn chơi (Stage) và 6 chữ số đồng hồ thời gian (Clock digits).
     * Tác dụng: Phản ánh trung thực thành tích và thời gian đã trôi qua lên bảng hiển thị.
     *
     * @param {Object} stats - Dữ liệu thống kê màn chơi.
     * @param {number} stats.totalFalls - Tổng số lần khối bị ngã rơi.
     * @param {number} stats.levelNumber - Số thứ tự màn chơi hiện tại.
     * @param {number[]|null} [stats.digits=null] - Mảng 6 chữ số [giờ1, giờ2, phút1, phút2, giây1, giây2] từ TimerService.
     * @param {number} [stats.timeTakenMs=0] - Tổng thời gian chơi (ms) dùng để tính toán dự phòng nếu thiếu mảng digits.
     * @returns {void}
     */
    update(stats) {
        if (!this._clip || !this._clip.stats) return;

        const timery = this._clip.stats;

        // 1. Cập nhật số lần rơi vực (Falls) lên 4 ô số falls1 đến falls4
        let fallsStr = String((stats.totalFalls || 0) + 1);
        while (fallsStr.length < 4) {
            fallsStr = " " + fallsStr;
        }

        for (let i = 0; i < 4; i++) {
            const digitClip = timery[`falls${i + 1}`];
            if (digitClip && typeof digitClip.gotoAndStop === "function") {
                // Ký tự khoảng trắng thì hiển thị frame 11 (blank), ngược lại hiển thị chữ số tương ứng (0-9)
                const frame = fallsStr[i] === " " ? 11 : parseInt(fallsStr[i], 10);
                digitClip.gotoAndStop(frame);
            }
        }

        // 2. Cập nhật số thứ tự màn chơi (Stage) lên 2 ô số stage1 (hàng chục) và stage2 (hàng đơn vị)
        const levelNum = stats.levelNumber || 1;
        if (timery.stage1 && typeof timery.stage1.gotoAndStop === "function") {
            timery.stage1.gotoAndStop(Math.floor(levelNum * 0.1));
        }
        if (timery.stage2 && typeof timery.stage2.gotoAndStop === "function") {
            timery.stage2.gotoAndStop(levelNum % 10);
        }

        // 3. Cập nhật 6 chữ số đồng hồ thời gian lên digit1 đến digit6
        let digits = stats.digits;

        if (!digits || digits.length < 6) {
            const timeMs = stats.timeTakenMs || 0;
            const seconds = String(Math.floor(timeMs / 1000) % 60).padStart(2, "0");
            const minutes = String(Math.floor(timeMs / 1000 / 60) % 60).padStart(2, "0");
            const hours = String(Math.floor(timeMs / 1000 / 60 / 60)).padStart(2, "0");

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
            const digitClip = timery[`digit${i + 1}`];
            if (digitClip && typeof digitClip.gotoAndStop === "function") {
                digitClip.gotoAndStop(digits[i]);
            }
        }
    }

    /**
     * Đăng ký callback khi người chơi nhấp chọn nút "Return to Game" để tiếp tục chơi.
     * Tác dụng: Đóng menu tạm dừng và tiếp tục đếm giờ.
     *
     * @param {() => void} callback
     * @returns {void}
     */
    onResume(callback) {
        this._callbacks.resume = callback;
    }

    /**
     * Đăng ký callback khi người chơi nhấp chọn nút "Toggle Sound" để đổi trạng thái âm thanh.
     *
     * @param {() => void} callback
     * @returns {void}
     */
    onToggleSound(callback) {
        this._callbacks.toggleSound = callback;
    }

    /**
     * Đăng ký callback khi người chơi nhấp chọn nút "Quit to Menu" để thoát màn chơi.
     * Tác dụng: Trở về Menu chính của trò chơi.
     *
     * @param {() => void} callback
     * @returns {void}
     */
    onQuit(callback) {
        this._callbacks.quit = callback;
    }

    /**
     * Giải phóng toàn bộ tài nguyên của PauseMenu.
     * Tác dụng: Gỡ bỏ MovieClip khỏi cây hiển thị để chống rò rỉ bộ nhớ.
     *
     * @returns {void}
     */
    destroy() {
        if (this._clip) {
            this._clip.stop();
            if (this._clip.parent) {
                this._clip.parent.removeChild(this._clip);
            }
        }
        this._clip = null;
        this._audioService = null;
        this._callbacks = { resume: null, toggleSound: null, quit: null };
    }
}
