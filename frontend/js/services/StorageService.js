/**
 * @file StorageService.js
 * @description Quản lý lưu trữ cục bộ (LocalStorage) cho tiến trình màn chơi, cài đặt âm thanh,
 * chủ đề giao diện và thành tích speedrun với cơ chế Fallback an toàn trên bộ nhớ RAM khi trình duyệt chặn lưu trữ.
 */

export class StorageService {
    /**
     * Khóa định danh các mục lưu trữ trong LocalStorage.
     * Tác dụng: Chuẩn hóa tên khóa để tránh xung đột dữ liệu trong ứng dụng web.
     * @readonly
     */
    static KEYS = Object.freeze({
        CURRENT_LEVEL: "level",
        SOUND_ENABLED: "soundEnabled",
        THEME: "bloxorz_theme",
        BEST_TIMES: "bloxorz_best_times",
        TOTAL_FALLS: "bloxorz_total_falls"
    });

    /**
     * Khởi tạo dịch vụ lưu trữ và kiểm tra khả năng hỗ trợ LocalStorage của trình duyệt.
     */
    constructor() {
        /**
         * Bộ nhớ đệm RAM dự phòng khi trình duyệt chặn quyền truy cập LocalStorage (chế độ Ẩn danh / Sandboxed iframe).
         * @private
         * @type {Map<string, string>}
         */
        this._memoryFallback = new Map();

        /**
         * Trạng thái sẵn sàng của LocalStorage trong môi trường runtime hiện tại.
         * @private
         * @type {boolean}
         */
        this._isLocalStorageAvailable = this._checkLocalStorageSupport();
    }

    /**
     * Kiểm tra tính khả dụng của LocalStorage bằng cách thử ghi và xóa một khóa kiểm thử.
     * Tác dụng: Xác định xem ứng dụng có thể lưu trữ dữ liệu bền vững hay phải sử dụng RAM dự phòng.
     *
     * @private
     * @returns {boolean} True nếu LocalStorage hoạt động bình thường và không bị chặn.
     */
    _checkLocalStorageSupport() {
        try {
            if (typeof window === "undefined" || !window.localStorage) {
                return false;
            }
            const testKey = "__bloxorz_test__";
            window.localStorage.setItem(testKey, "1");
            window.localStorage.removeItem(testKey);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Đọc chuỗi thô từ LocalStorage hoặc bộ nhớ RAM dự phòng.
     * Tác dụng: Truy xuất giá trị dữ liệu an toàn, không làm gián đoạn trò chơi ngay cả khi xảy ra lỗi bảo mật.
     *
     * @private
     * @param {string} key - Tên khóa cần truy xuất.
     * @returns {string|null} Chuỗi dữ liệu hoặc null nếu khóa không tồn tại.
     */
    _getItem(key) {
        if (this._isLocalStorageAvailable) {
            try {
                return window.localStorage.getItem(key);
            } catch {
                // Fallback sang bộ nhớ RAM nếu phát sinh ngoại lệ runtime
            }
        }
        return this._memoryFallback.has(key) ? this._memoryFallback.get(key) : null;
    }

    /**
     * Ghi chuỗi thô vào LocalStorage hoặc bộ nhớ RAM dự phòng.
     * Tác dụng: Lưu trữ dữ liệu an toàn với cơ chế tự động chuyển hướng sang RAM nếu dung lượng đầy hoặc bị từ chối quyền.
     *
     * @private
     * @param {string} key - Tên khóa cần ghi.
     * @param {string|number} value - Giá trị cần lưu trữ.
     * @returns {void}
     */
    _setItem(key, value) {
        const strVal = String(value);
        if (this._isLocalStorageAvailable) {
            try {
                window.localStorage.setItem(key, strVal);
                return;
            } catch {
                // Fallback sang bộ nhớ RAM nếu bị chặn hoặc vượt quá hạn mức dung lượng
            }
        }
        this._memoryFallback.set(key, strVal);
    }

    /**
     * Xóa một mục dữ liệu khỏi LocalStorage và bộ nhớ RAM dự phòng.
     * Tác dụng: Dọn dẹp các mục cấu hình hoặc thiết lập lại tiến trình chơi.
     *
     * @private
     * @param {string} key - Tên khóa cần xóa.
     * @returns {void}
     */
    _removeItem(key) {
        if (this._isLocalStorageAvailable) {
            try {
                window.localStorage.removeItem(key);
                return;
            } catch {
                // Bỏ qua lỗi nếu LocalStorage bị khóa
            }
        }
        this._memoryFallback.delete(key);
    }

    // ==========================================
    // 1. QUẢN LÝ TIẾN TRÌNH MÀN CHƠI (LEVEL PROGRESS)
    // ==========================================

    /**
     * Lấy số thứ tự màn chơi đã lưu gần nhất.
     * Tác dụng: Xác định màn chơi để hiển thị và kích hoạt nút Resume Game trên Menu chính.
     *
     * @returns {number} Số thứ tự màn chơi (1 đến 33) hoặc -1 nếu chưa có dữ liệu lưu.
     */
    getSavedLevel() {
        const val = this._getItem(StorageService.KEYS.CURRENT_LEVEL);
        if (val === null || val === undefined || val === "") {
            return -1;
        }
        const parsed = parseInt(val, 10);
        return isNaN(parsed) ? -1 : parsed;
    }

    /**
     * Lưu lại số thứ tự màn chơi hiện tại của người chơi.
     * Tác dụng: Ghi nhận tiến trình để người chơi có thể tiếp tục hành trình khi quay lại game.
     *
     * @param {number} levelNum - Số màn chơi cần lưu (1 đến 33).
     * @returns {void}
     */
    saveLevel(levelNum) {
        if (typeof levelNum === "number" && levelNum > 0) {
            this._setItem(StorageService.KEYS.CURRENT_LEVEL, String(levelNum));
        }
    }

    /**
     * Kiểm tra xem người chơi đã có tiến trình chơi được lưu hay chưa.
     * Tác dụng: Phục vụ bật/tắt hiển thị nút Resume Game trên Menu chính.
     *
     * @returns {boolean} True nếu có màn chơi đã lưu (> 0).
     */
    hasSavedProgress() {
        return this.getSavedLevel() > 0;
    }

    /**
     * Xóa sạch tiến trình màn chơi đã lưu.
     * Tác dụng: Đặt lại trạng thái ban đầu khi người chơi bắt đầu game mới từ Level 1.
     *
     * @returns {void}
     */
    clearProgress() {
        this._removeItem(StorageService.KEYS.CURRENT_LEVEL);
    }

    // ==========================================
    // 2. CÀI ĐẶT ÂM THANH (AUDIO SETTINGS)
    // ==========================================

    /**
     * Lấy trạng thái bật/tắt âm thanh đã lưu. Mặc định là bật (true) nếu chưa từng thiết lập.
     * Tác dụng: Áp dụng trạng thái âm lượng ngay khi khởi động trò chơi.
     *
     * @returns {boolean} True nếu âm thanh được bật, False nếu bị tắt.
     */
    getSoundEnabled() {
        const val = this._getItem(StorageService.KEYS.SOUND_ENABLED);
        if (val === null || val === undefined) {
            return true;
        }
        return val === "1" || val === "true";
    }

    /**
     * Lưu trạng thái bật hoặc tắt âm thanh của người chơi.
     * Tác dụng: Duy trì cài đặt âm thanh xuyên suốt các phiên chơi tiếp theo.
     *
     * @param {boolean} enabled - Trạng thái bật/tắt mới.
     * @returns {void}
     */
    saveSoundEnabled(enabled) {
        this._setItem(StorageService.KEYS.SOUND_ENABLED, enabled ? "1" : "0");
    }

    // ==========================================
    // 3. GIAO DIỆN & THÀNH TÍCH MỞ RỘNG (THEME & SPEEDRUN)
    // ==========================================

    /**
     * Lấy tên chủ đề giao diện (theme) đã chọn.
     * Tác dụng: Tải bộ texture đồ họa tương ứng khi khởi tạo ứng dụng.
     *
     * @param {string} [defaultTheme="original"] - Chủ đề mặc định nếu chưa lưu.
     * @returns {string} Tên định danh của chủ đề.
     */
    getTheme(defaultTheme = "original") {
        return this._getItem(StorageService.KEYS.THEME) || defaultTheme;
    }

    /**
     * Lưu chủ đề giao diện mới mà người chơi vừa chọn.
     * Tác dụng: Ghi nhớ chủ đề để áp dụng tự động trong các phiên chơi sau.
     *
     * @param {string} themeName - Tên chủ đề cần lưu.
     * @returns {void}
     */
    saveTheme(themeName) {
        if (themeName) {
            this._setItem(StorageService.KEYS.THEME, themeName);
        }
    }

    /**
     * Lưu thời gian kỷ lục nhanh nhất hoàn thành một màn chơi (tính bằng mili-giây).
     * Tác dụng: Hỗ trợ tính năng speedrun và bảng thành tích cá nhân.
     *
     * @param {number} level - Số thứ tự màn chơi.
     * @param {number} timeMs - Thời gian hoàn thành (mili-giây).
     * @returns {void}
     */
    saveBestTimeForStage(level, timeMs) {
        const raw = this._getItem(StorageService.KEYS.BEST_TIMES);
        let times = {};
        try {
            times = raw ? JSON.parse(raw) : {};
        } catch {
            times = {};
        }

        const currentBest = times[level];
        if (!currentBest || timeMs < currentBest) {
            times[level] = timeMs;
            this._setItem(StorageService.KEYS.BEST_TIMES, JSON.stringify(times));
        }
    }

    /**
     * Truy xuất thời gian kỷ lục của một màn chơi cụ thể.
     * Tác dụng: Hiển thị thời gian kỷ lục trên bảng điểm hoặc menu tạm dừng.
     *
     * @param {number} level - Số thứ tự màn chơi.
     * @returns {number|null} Thời gian hoàn thành tốt nhất (ms) hoặc null nếu chưa có dữ liệu.
     */
    getBestTimeForStage(level) {
        const raw = this._getItem(StorageService.KEYS.BEST_TIMES);
        if (!raw) return null;
        try {
            const times = JSON.parse(raw);
            return times[level] || null;
        } catch {
            return null;
        }
    }
}
