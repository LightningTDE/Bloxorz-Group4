/**
 * @file Hud.js
 * @description Quản lý giao diện hiển thị trong màn chơi (Heads-Up Display - HUD),
 * bao gồm hình nền bầu trời (Background), hiển thị mật mã passcode của màn chơi (digit1..6),
 * bộ đếm tổng số bước đi (digit1a..6a), dòng chữ hướng dẫn dưới sàn (HelpText)
 * và hoạt cảnh chuyển cảnh mở màn (Intro Wipe) / đóng màn (Outro Wipe).
 */

export class Hud {
    /**
     * Khởi tạo giao diện HUD và gắn kết các MovieClip đồ họa.
     * Tác dụng: Tạo hình nền, dòng chữ chỉ dẫn tương ứng theo thiết bị (cảm ứng hoặc chuột/bàn phím)
     * và thiết lập sự kiện cho nút bấm Menu.
     *
     * @param {Object} [options={}]
     * @param {boolean} [options.isTouch=false] - True nếu đang chạy trên thiết bị cảm ứng (sử dụng HelpTextTouch).
     * @param {import("../services/AudioService.js").AudioService} [options.audioService=null] - Dịch vụ âm thanh.
     */
    constructor(options = {}) {
        /**
         * Chế độ màn hình cảm ứng.
         * @private
         * @type {boolean}
         */
        this._isTouch = Boolean(options.isTouch);

        /**
         * Dịch vụ âm thanh phát tiếng click/latch.
         * @private
         * @type {import("../services/AudioService.js").AudioService|null}
         */
        this._audioService = options.audioService || null;

        /**
         * MovieClip Background chứa bầu trời, mật mã passcode, bộ đếm bước đi và nút Menu.
         * @private
         * @type {createjs.MovieClip|null}
         */
        this._background = this._createBackgroundClip();

        /**
         * MovieClip HelpText hiển thị dòng chữ hướng dẫn dưới mặt sàn gạch.
         * @private
         * @type {createjs.MovieClip|null}
         */
        this._helpText = this._createHelpTextClip();

        /**
         * Callback kích hoạt khi người chơi nhấp vào nút Menu ở góc trên bên trái.
         * @private
         * @type {(() => void)|null}
         */
        this._onMenuClickCallback = null;

        this._setupMenuButton();
    }

    /**
     * Tạo mới instance MovieClip Background từ namespace đồ họa CreateJS.
     * Tác dụng: Cung cấp khung nền hiển thị cho toàn bộ không gian chơi 2.5D.
     *
     * @private
     * @returns {createjs.MovieClip|null}
     */
    _createBackgroundClip() {
        if (typeof window !== "undefined" && window.lib && typeof window.lib.Background === "function") {
            return new window.lib.Background();
        }
        return null;
    }

    /**
     * Tạo mới instance MovieClip HelpText phù hợp với loại thiết bị của người chơi.
     * Tác dụng: Hiển thị hướng dẫn phím mũi tên đối với máy tính, hoặc hướng dẫn chạm vuốt đối với điện thoại/máy tính bảng.
     *
     * @private
     * @returns {createjs.MovieClip|null}
     */
    _createHelpTextClip() {
        if (typeof window !== "undefined" && window.lib) {
            if (this._isTouch && typeof window.lib.HelpTextTouch === "function") {
                return new window.lib.HelpTextTouch();
            }
            if (typeof window.lib.HelpText === "function") {
                return new window.lib.HelpText();
            }
        }
        return null;
    }

    /**
     * Gắn sự kiện chuột và âm thanh phản hồi cho nút Menu ở góc trên bên trái màn hình.
     * Tác dụng: Cho phép người chơi mở Menu tạm dừng để xem thống kê hoặc thoát game.
     *
     * @private
     * @returns {void}
     */
    _setupMenuButton() {
        if (!this._background || !this._background.menuButton) return;

        const btn = this._background.menuButton;

        btn.addEventListener("mouseover", () => {
            if (this._audioService) this._audioService.playAction("click");
        });

        btn.addEventListener("click", () => {
            if (this._audioService) this._audioService.playAction("latch");
            if (typeof this._onMenuClickCallback === "function") {
                this._onMenuClickCallback();
            }
        });
    }

    /**
     * Khởi tạo giao diện HUD khi bắt đầu một màn chơi mới.
     * Tác dụng: Cập nhật 6 chữ số mật mã passcode của màn chơi lên hình nền,
     * đặt lại bộ đếm bước đi, chọn dòng chữ chỉ dẫn tương ứng và kích hoạt hoạt cảnh mở màn (Intro Wipe từ frame 1 đến 28).
     *
     * @param {Object} params
     * @param {number} params.levelNumber - Số thứ tự màn chơi (1 đến 33).
     * @param {string} params.levelCode - Mã passcode 6 chữ số (ví dụ: "074355").
     * @param {number} [params.totalMoves=0] - Tổng số bước đi tích lũy từ các màn trước.
     * @param {(() => void)|null} [params.onReady=null] - Callback kích hoạt khi hoạt cảnh mở màn kết thúc (cho phép khối bắt đầu di chuyển).
     * @returns {void}
     */
    initLevel(params) {
        const { levelNumber, levelCode, totalMoves = 0, onReady = null } = params;

        // 1. Cập nhật 6 chữ số passcode lên MovieClip digit1 đến digit6 trên hình nền
        if (this._background && levelCode) {
            const codeStr = String(levelCode).padStart(6, "0");
            for (let i = 0; i < 6; i++) {
                const digitClip = this._background[`digit${i + 1}`];
                if (digitClip && typeof digitClip.gotoAndStop === "function") {
                    digitClip.gotoAndStop(parseInt(codeStr[i], 10));
                }
            }
        }

        // 2. Cập nhật hiển thị số bước đi khởi đầu
        this.updateMoves(0, totalMoves);

        // 3. Thiết lập nội dung hướng dẫn trên HelpText theo số màn chơi
        if (this._helpText) {
            this._helpText.alpha = 0; // Tạm ẩn trong lúc chuyển cảnh, chỉ hiện khi animation mở màn hoàn tất
            if (typeof this._helpText.gotoAndStop === "function") {
                this._helpText.gotoAndStop(Math.max(0, levelNumber - 1));
            }
        }

        // 4. Kích hoạt hoạt cảnh mở màn (Intro Wipe từ frame 1 đến 28)
        if (this._readyTimeout) {
            clearTimeout(this._readyTimeout);
            this._readyTimeout = null;
        }

        let readyTriggered = false;
        const triggerReady = () => {
            if (readyTriggered) return;
            readyTriggered = true;
            if (this._readyTimeout) {
                clearTimeout(this._readyTimeout);
                this._readyTimeout = null;
            }
            if (this._background) {
                this._background.onReady = null;
            }
            if (this._helpText) {
                this._helpText.alpha = 1;
            }
            if (typeof onReady === "function") {
                onReady();
            }
        };

        if (this._background) {
            this._background.onReady = triggerReady;
            this._background.gotoAndPlay(1);
            this._readyTimeout = setTimeout(triggerReady, 1000);
        } else {
            triggerReady();
        }
    }

    /**
     * Cập nhật số bước đi (Moves Counter) hiển thị trên màn hình theo thời gian thực.
     * Tác dụng: Cộng dồn số bước đi của màn hiện tại với các màn trước và hiển thị dưới dạng chuỗi 6 chữ số (000000).
     *
     * @param {number} levelMoves - Số bước đi trong màn chơi hiện tại.
     * @param {number} [totalMoves=0] - Tổng số bước đi tích lũy từ các màn trước.
     * @returns {void}
     */
    updateMoves(levelMoves, totalMoves = 0) {
        if (!this._background) return;

        const sum = Math.max(0, levelMoves + totalMoves);
        const text = String(sum).padStart(6, "0");

        // Cập nhật từng chữ số vào MovieClip digit1a đến digit6a trên Background
        for (let i = 0; i < 6; i++) {
            const digitClip = this._background[`digit${i + 1}a`];
            if (digitClip && typeof digitClip.gotoAndStop === "function") {
                digitClip.gotoAndStop(parseInt(text[i], 10));
            }
        }
    }

    /**
     * Kích hoạt hoạt cảnh đóng màn chuyển tiếp (Outro Wipe từ frame 28 đến 55).
     * Tác dụng: Làm tối dần khung cảnh khi người chơi hoàn thành màn, bị rơi vực hoặc quay về Menu chính.
     *
     * @returns {void}
     */
    playTransitionOut() {
        if (this._readyTimeout) {
            clearTimeout(this._readyTimeout);
            this._readyTimeout = null;
        }
        if (this._background) {
            this._background.onReady = null;
            this._background.play();
        }
        if (this._helpText) {
            this._helpText.alpha = 0;
        }
    }

    /**
     * Lấy đối tượng MovieClip của Background.
     * Tác dụng: Cho phép Renderer đặt Background vào lớp dưới cùng (Layer 0) của Stage.
     *
     * @returns {createjs.MovieClip|null}
     */
    getBackgroundClip() {
        return this._background;
    }

    /**
     * Lấy đối tượng MovieClip của HelpText.
     * Tác dụng: Cho phép Renderer đặt HelpText vào layer hiển thị chữ hướng dẫn (Layer 6).
     *
     * @returns {createjs.MovieClip|null}
     */
    getHelpTextClip() {
        return this._helpText;
    }

    /**
     * Đăng ký callback xử lý khi người chơi nhấp chuột vào nút Menu.
     * Tác dụng: Thông báo cho GameEngine mở Menu tạm dừng.
     *
     * @param {() => void} cb
     * @returns {void}
     */
    onMenuClick(cb) {
        this._onMenuClickCallback = cb;
    }

    /**
     * Giải phóng toàn bộ tài nguyên của HUD.
     * Tác dụng: Hủy các bộ hẹn giờ và gỡ bỏ MovieClip khỏi cây hiển thị khi thoát game.
     *
     * @returns {void}
     */
    destroy() {
        if (this._readyTimeout) {
            clearTimeout(this._readyTimeout);
            this._readyTimeout = null;
        }
        if (this._background) {
            this._background.onReady = null;
            this._background.stop();
            if (this._background.parent) {
                this._background.parent.removeChild(this._background);
            }
        }
        if (this._helpText) {
            this._helpText.stop();
            if (this._helpText.parent) {
                this._helpText.parent.removeChild(this._helpText);
            }
        }

        this._background = null;
        this._helpText = null;
        this._onMenuClickCallback = null;
    }
}
