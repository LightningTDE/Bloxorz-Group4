/**
 * @file StageTitle.js
 * @description Quản lý màn hình tiêu đề giới thiệu số thứ tự màn chơi (STAGE 01, STAGE 02...),
 * điều khiển MovieClip lib.LevelNumber(), hiển thị chữ STAGE và hai chữ số (hàng chục và hàng đơn vị),
 * phát âm thanh whoosh (blox2wav), tính toán chu kỳ mờ dần/sáng rõ (75 khung hình)
 * và xử lý tính năng bỏ qua nhanh (skip) khi người chơi nhấp chuột hoặc nhấn phím.
 */

export class StageTitle {
    /**
     * Khởi tạo đối tượng quản lý màn hình giới thiệu số thứ tự màn chơi.
     * Tác dụng: Chuẩn bị các thuộc tính theo dõi chu kỳ Ticker và bộ lắng nghe bỏ qua animation.
     *
     * @param {Object} [options={}]
     * @param {import("../services/AudioService.js").AudioService} [options.audioService=null] - Dịch vụ âm thanh.
     */
    constructor(options = {}) {
        /**
         * Dịch vụ âm thanh.
         * @private
         * @type {import("../services/AudioService.js").AudioService|null}
         */
        this._audioService = options.audioService || null;

        /**
         * Instance MovieClip đồ họa của tiêu đề STAGE XX.
         * @private
         * @type {createjs.MovieClip|createjs.Container|null}
         */
        this._clip = null;

        /**
         * Hàm callback cập nhật khung hình Ticker trong quá trình làm mờ và sáng rõ.
         * @private
         * @type {Function|null}
         */
        this._activeTick = null;

        /**
         * Hàm xử lý bỏ qua nhanh (skip) khi có sự kiện nhấn phím hoặc nhấp chuột.
         * @private
         * @type {Function|null}
         */
        this._skipHandler = null;

        /**
         * Bộ định thời debounce để tránh nhận nhầm sự kiện Enter/Click từ màn hình trước.
         * @private
         * @type {number|null}
         */
        this._skipTimer = null;
    }

    /**
     * Khởi tạo MovieClip lib.LevelNumber từ namespace CreateJS lib.
     * Tác dụng: Tạo đối tượng hiển thị và định vị chính xác tại tâm màn hình (x=226, y=153.6).
     *
     * @returns {void}
     */
    init() {
        if (typeof window !== "undefined" && window.lib && typeof window.lib.LevelNumber === "function") {
            this._clip = new window.lib.LevelNumber();
            this._clip.name = "stagetitle";
            // Định vị tọa độ chính giữa màn hình chơi chuẩn
            this._clip.setTransform(226, 153.6, 1, 1, 0, 0, 0, 87, -3);
            this._clip.stop();
        } else {
            this._clip = new createjs.Container();
        }
    }

    /**
     * Lấy đối tượng DisplayObject CreateJS để thêm vào container hiển thị của Renderer.
     *
     * @returns {createjs.DisplayObject}
     */
    getDisplayObject() {
        return this._clip;
    }

    /**
     * Hiển thị bảng tiêu đề STAGE [levelNumber] kèm hiệu ứng sáng dần, dừng lại và mờ dần ra ngoài.
     * Tác dụng: Thông báo số thứ tự màn chơi người chơi chuẩn bị bước vào,
     * phát âm thanh whoosh và gọi callback hoàn thành sau chu kỳ 75 khung hình hoặc khi người chơi bấm bỏ qua.
     *
     * @param {number} levelNumber - Số thứ tự màn chơi (1 đến 33).
     * @param {(() => void)|null} [onComplete] - Callback kích hoạt khi hoạt cảnh hoàn tất để chuyển vào gameplay.
     * @returns {void}
     */
    show(levelNumber, onComplete) {
        if (!this._clip) {
            if (typeof onComplete === "function") onComplete();
            return;
        }

        const num = Math.max(1, parseInt(levelNumber, 10) || 1);

        // Dọn dẹp hoạt cảnh và bộ lắng nghe cũ nếu có
        this._cleanup();

        // Cập nhật biến số màn chơi toàn cục
        if (typeof window !== "undefined" && window.stage) {
            window.stage.levelNumber = num;
        }

        // Đặt MovieClip về khung hình 0 chứa đầy đủ chữ STAGE và hai chữ số (stagesign, digit1, digit2)
        if (typeof this._clip.gotoAndStop === "function") {
            this._clip.gotoAndStop(0);
        }

        // Ẩn lớp phủ đen (cover) nếu có để đảm bảo chữ STAGE hiển thị rõ ràng
        if (this._clip.ppp) {
            this._clip.ppp.visible = false;
        }

        // Tách số màn chơi thành hàng chục và hàng đơn vị
        const tens = Math.floor(num * 0.1);
        const units = num % 10;
        if (this._clip.digit1 && typeof this._clip.digit1.gotoAndStop === "function") {
            this._clip.digit1.gotoAndStop(tens);
        }
        if (this._clip.digit2 && typeof this._clip.digit2.gotoAndStop === "function") {
            this._clip.digit2.gotoAndStop(units);
        }

        // Phát hiệu ứng âm thanh whoosh mở màn (blox2wav)
        if (this._audioService) {
            this._audioService.playDirect("blox2wav");
        } else if (typeof window !== "undefined" && typeof window.playSound === "function") {
            window.playSound("blox2wav");
        }

        // Chu kỳ hoạt cảnh 75 khung hình:
        // - Frame 1 đến 14: Sáng dần đều (Fade In)
        // - Frame 15 đến 59: Hiển thị rực rỡ toàn phần (alpha = 1)
        // - Frame 60 đến 74: Mờ dần ra ngoài (Fade Out)
        this._clip.alpha = 0;
        let currentFrame = 0;
        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;
            this._cleanup();
            if (typeof onComplete === "function") {
                onComplete();
            }
        };

        this._activeTick = () => {
            currentFrame++;
            if (currentFrame <= 14) {
                this._clip.alpha = currentFrame / 14;
            } else if (currentFrame <= 59) {
                this._clip.alpha = 1;
            } else if (currentFrame <= 74) {
                this._clip.alpha = Math.max(0, 1 - (currentFrame - 59) / 15);
            } else {
                this._clip.alpha = 0;
                finish();
                return;
            }
        };
        createjs.Ticker.addEventListener("tick", this._activeTick);

        // Trì hoãn 350ms trước khi cho phép bấm phím/click để tránh nhận nhầm sự kiện vừa thao tác ở màn trước
        this._skipHandler = () => {
            finish();
        };
        this._skipTimer = setTimeout(() => {
            if (finished) return;
            window.addEventListener("click", this._skipHandler, { once: true });
            window.addEventListener("keydown", this._skipHandler, { once: true });
        }, 350);
    }

    /**
     * Dọn dẹp bộ đếm Ticker và gỡ bỏ các bộ lắng nghe sự kiện bỏ qua.
     * Tác dụng: Ngăn chặn xung đột animation và rò rỉ sự kiện.
     *
     * @private
     * @returns {void}
     */
    _cleanup() {
        if (this._skipTimer) {
            clearTimeout(this._skipTimer);
            this._skipTimer = null;
        }
        if (this._clip) {
            if (typeof this._clip.stop === "function") this._clip.stop();
            if (Array.isArray(this._clip.children)) {
                this._clip.children.forEach(c => {
                    if (c && typeof c.stop === "function") c.stop();
                });
            }
        }
        if (this._activeTick) {
            createjs.Ticker.removeEventListener("tick", this._activeTick);
            this._activeTick = null;
        }
        if (this._skipHandler) {
            window.removeEventListener("click", this._skipHandler);
            window.removeEventListener("keydown", this._skipHandler);
            this._skipHandler = null;
        }
    }

    /**
     * Giải phóng hoàn toàn tài nguyên và gỡ bỏ MovieClip khỏi Stage.
     * Tác dụng: Dọn dẹp bộ nhớ khi hủy màn hình tiêu đề.
     *
     * @returns {void}
     */
    destroy() {
        this._cleanup();
        if (this._clip && this._clip.parent) {
            this._clip.parent.removeChild(this._clip);
        }
        this._clip = null;
    }
}
