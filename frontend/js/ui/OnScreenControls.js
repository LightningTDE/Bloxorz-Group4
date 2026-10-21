/**
 * @file OnScreenControls.js
 * @description Quản lý giao diện cụm phím điều khiển ảo trên màn hình cảm ứng (On-Screen Arrows),
 * điều khiển MovieClip lib.OnScreenArrows(), tự động nhận diện thiết bị cảm ứng,
 * chuyển đổi linh hoạt giữa chế độ 4 phím mũi tên thường và chế độ phân tách khối (thêm nút Space),
 * xử lý hoạt cảnh xuất hiện (Fade In) và ẩn đi (Fade Out) khi kết thúc màn chơi.
 */

export class OnScreenControls {
    /**
     * Nhãn chế độ hiển thị trên timeline của MovieClip lib.OnScreenArrows.
     * Tác dụng: Chuyển đổi giữa giao diện 4 phím cơ bản và giao diện 5 phím hỗ trợ phân thân.
     * @readonly
     */
    static MODES = Object.freeze({
        STANDARD: "s", // Cụm 4 phím mũi tên điều hướng thông thường (Frame 0 đến 9)
        SPLIT: "ss"    // Cụm 4 phím mũi tên kèm nút Space để đổi khối điều khiển (Frame 22 đến 31)
    });

    /**
     * Khởi tạo cụm điều khiển phím ảo trên màn hình.
     * Tác dụng: Tạo MovieClip phím ảo và kết nối với dịch vụ nhận tín hiệu InputService.
     *
     * @param {Object} [options={}]
     * @param {createjs.MovieClip|null} [options.clip=null] - Instance MovieClip lib.OnScreenArrows có sẵn nếu có.
     * @param {import("../services/InputService.js").InputService} [options.inputService=null] - Dịch vụ điều khiển.
     */
    constructor(options = {}) {
        /**
         * Instance MovieClip CreateJS đại diện cho cụm phím ảo.
         * @private
         * @type {createjs.MovieClip|null}
         */
        this._clip = options.clip || this._createDefaultClip();

        /**
         * Dịch vụ Input để chuyển tiếp tín hiệu chạm nút ảo vào luồng xử lý phím.
         * @private
         * @type {import("../services/InputService.js").InputService|null}
         */
        this._inputService = options.inputService || null;

        /**
         * Chế độ hiển thị hiện tại của phím ảo ("s" hoặc "ss").
         * @private
         * @type {string}
         */
        this._currentMode = OnScreenControls.MODES.STANDARD;

        /**
         * Cờ theo dõi trạng thái hiển thị của phím ảo trên màn hình.
         * @private
         * @type {boolean}
         */
        this._isVisible = false;
    }

    /**
     * Kiểm tra xem thiết bị hiện tại của người dùng có hỗ trợ màn hình cảm ứng hay không.
     * Tác dụng: Tự động phát hiện điện thoại di động, máy tính bảng hoặc laptop màn hình cảm ứng
     * để quyết định hiển thị cụm phím ảo và hướng dẫn thao tác chạm vuốt.
     *
     * @returns {boolean} True nếu là thiết bị có hỗ trợ cảm ứng (Touch Device).
     */
    static isTouchDevice() {
        if (typeof window === "undefined") return false;
        return Boolean("ontouchstart" in window || (navigator && navigator.maxTouchPoints > 0));
    }

    /**
     * Tạo mới instance MovieClip lib.OnScreenArrows từ namespace CreateJS lib.
     * Tác dụng: Khởi tạo đối tượng đồ họa cho cụm nút bấm ảo.
     *
     * @private
     * @returns {createjs.MovieClip|null}
     */
    _createDefaultClip() {
        if (typeof window !== "undefined" && window.lib && typeof window.lib.OnScreenArrows === "function") {
            return new window.lib.OnScreenArrows();
        }
        return null;
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
     * Hiển thị cụm phím ảo ở chế độ tiêu chuẩn (4 nút mũi tên Lên, Xuống, Trái, Phải).
     * Tác dụng: Phục vụ cho các màn chơi đơn khối thông thường.
     *
     * @returns {void}
     */
    showStandard() {
        if (!this._clip) return;

        this._currentMode = OnScreenControls.MODES.STANDARD;
        this._clip.gotoAndPlay(OnScreenControls.MODES.STANDARD);
        this._isVisible = true;
    }

    /**
     * Hiển thị cụm phím ảo ở chế độ phân tách (4 nút mũi tên kèm nút tròn Space ở giữa).
     * Tác dụng: Phục vụ cho các màn chơi có công tắc phân tách khối ('v'), giúp người chơi đổi khối dễ dàng trên màn cảm ứng.
     *
     * @returns {void}
     */
    showSplit() {
        if (!this._clip) return;

        this._currentMode = OnScreenControls.MODES.SPLIT;
        this._clip.gotoAndPlay(OnScreenControls.MODES.SPLIT);
        this._isVisible = true;
    }

    /**
     * Kích hoạt hoạt cảnh mờ dần và biến mất của cụm phím ảo (Fade Out).
     * Tác dụng: Ẩn cụm phím khi hoàn thành màn chơi, khối rơi vực hoặc người chơi quay về Menu chính.
     *
     * @returns {void}
     */
    hide() {
        if (!this._clip || !this._isVisible) return;

        // Kích hoạt timeline chạy tiếp các frame thoát để mờ dần rồi dừng hẳn
        this._clip.play();
        this._isVisible = false;
    }

    /**
     * Tự động cấu hình chế độ hiển thị của cụm phím ảo dựa trên thuộc tính của màn chơi.
     * Tác dụng: Nếu màn chơi có công tắc phân tách khối ('v') thì hiển thị chế độ 5 nút ("ss"),
     * ngược lại hiển thị chế độ 4 nút cơ bản ("s").
     *
     * @param {boolean} hasSplits - True nếu màn chơi có công tắc tách khối.
     * @returns {void}
     */
    setupForLevel(hasSplits) {
        if (hasSplits) {
            this.showSplit();
        } else {
            this.showStandard();
        }
    }

    /**
     * Kiểm tra xem cụm phím ảo có đang hiển thị trên màn hình hay không.
     * Tác dụng: Giúp kiểm soát trạng thái giao diện người dùng.
     *
     * @returns {boolean} True nếu phím ảo đang hiển thị.
     */
    isVisible() {
        return this._isVisible;
    }

    /**
     * Lấy chế độ hiển thị hiện tại của phím ảo ("s" hoặc "ss").
     *
     * @returns {string}
     */
    getCurrentMode() {
        return this._currentMode;
    }

    /**
     * Giải phóng tài nguyên và gỡ bỏ MovieClip khỏi cây hiển thị.
     * Tác dụng: Dọn dẹp bộ nhớ khi hủy thành phần điều khiển.
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
        this._inputService = null;
    }
}
