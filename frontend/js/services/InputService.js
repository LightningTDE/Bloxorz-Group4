/**
 * @file InputService.js
 * @description Quản lý toàn bộ tín hiệu đầu vào (bàn phím vật lý, phím ảo trên màn hình cảm ứng),
 * điều hướng khối hộp, chuyển đổi điều khiển giữa 2 khối nhỏ (phím Space), kích hoạt khởi động lại màn chơi (phím R),
 * và ngăn ngừa các hành vi mặc định gây cuộn trang của trình duyệt.
 */

import { KEY_DIRECTIONS } from "../utils/Constants.js";

export class InputService {
    /**
     * Bảng ánh xạ mã phím số cũ (keyCode) dự phòng cho các trình duyệt hoặc thiết bị cũ không hỗ trợ event.code chuẩn.
     * Tác dụng: Đảm bảo khả năng tương thích ngược trên nhiều nền tảng phần cứng và trình duyệt khác nhau.
     * @private
     * @readonly
     */
    static FALLBACK_KEY_MAP = Object.freeze({
        38: "ArrowUp",
        87: "KeyW",
        40: "ArrowDown",
        83: "KeyS",
        37: "ArrowLeft",
        65: "KeyA",
        39: "ArrowRight",
        68: "KeyD",
        32: "Space",
        82: "KeyR"
    });

    /**
     * Khởi tạo dịch vụ nhận và xử lý tín hiệu điều khiển.
     */
    constructor() {
        /**
         * Mã phím hiện đang được nhấn giữ (ví dụ: "ArrowRight", "KeyW", hoặc chuỗi rỗng khi không có phím nào).
         * @private
         * @type {string}
         */
        this._activeCode = "";

        /**
         * Chỉ số định danh khối hộp đang nhận tín hiệu điều khiển (0 cho khối chính, hoặc 0/1 khi phân tách khối).
         * @private
         * @type {number}
         */
        this._focusIndex = 0;

        /**
         * Cờ cho phép bẫy phím (ngăn chặn hành vi cuộn trang của trình duyệt khi bấm các phím mũi tên hoặc phím cách).
         * @private
         * @type {boolean}
         */
        this._trapKeys = false;

        /**
         * Trạng thái dịch vụ đã được gắn các bộ lắng nghe sự kiện của cửa sổ hay chưa.
         * @private
         * @type {boolean}
         */
        this._isAttached = false;

        /**
         * Hàm callback thực thi khi người chơi nhấn phím Space để chuyển đổi điều khiển giữa hai khối nhỏ.
         * @private
         * @type {((newIndex: number) => void)|null}
         */
        this._onSwitchCallback = null;

        /**
         * Hàm callback thực thi ngay lập tức khi phát hiện tín hiệu hướng di chuyển hợp lệ.
         * @private
         * @type {((direction: string, focusIndex: number) => void)|null}
         */
        this._onDirectionCallback = null;

        /**
         * Hàm callback thực thi khi người chơi nhấn phím 'R' để khởi động lại màn chơi hiện tại.
         * @private
         * @type {(() => void)|null}
         */
        this._onRestartCallback = null;

        // Ràng buộc ngữ cảnh (bind this) cho các hàm xử lý sự kiện DOM
        this._handleKeyDown = this._handleKeyDown.bind(this);
        this._handleKeyUp = this._handleKeyUp.bind(this);
        this._handleClick = this._handleClick.bind(this);
    }

    /**
     * Kiểm tra xem phần tử mục tiêu của sự kiện có phải là ô nhập văn bản hay không.
     * Tác dụng: Cho phép người chơi gõ chữ/số bình thường trong ô nhập Passcode mà không kích hoạt các phím tắt game (như R hay mũi tên).
     *
     * @param {EventTarget|null} target - Phần tử DOM nhận sự kiện tương tác.
     * @returns {boolean} True nếu phần tử là thẻ input, textarea hoặc có thuộc tính contenteditable.
     */
    static isTextEntryTarget(target) {
        if (!target) {
            return false;
        }
        if (typeof HTMLElement !== "undefined" && !(target instanceof HTMLElement)) {
            return false;
        }
        const tag = (target.tagName || "").toLowerCase();
        return tag === "input" || tag === "textarea" || Boolean(target.isContentEditable);
    }

    /**
     * Bắt đầu lắng nghe các sự kiện bàn phím và nhấp chuột toàn cục của cửa sổ trình duyệt.
     * Tác dụng: Kích hoạt tiếp nhận tín hiệu điều khiển và kết nối các hook tiếp nhận phím ảo từ giao diện cảm ứng.
     *
     * @param {Object} [stageContext=null] Đối tượng CreateJS Stage nếu có để gán các hàm trigger phím ảo.
     * @returns {void}
     */
    attach(stageContext = null) {
        if (this._isAttached) return;

        window.addEventListener("keydown", this._handleKeyDown, { passive: false });
        window.addEventListener("keyup", this._handleKeyUp, { passive: false });
        window.addEventListener("click", this._handleClick);

        // Đăng ký hook toàn cục để nút bấm ảo cảm ứng (OnScreenArrows) có thể truyền sự kiện vào hệ thống
        const targetStage = stageContext || (typeof window !== "undefined" ? window.stage : null);
        if (targetStage) {
            targetStage.triggerKeyDown = (evt) => this._triggerKeyDown(evt);
            targetStage.triggerKeyUp = (evt) => this._triggerKeyUp(evt);
        }

        this._isAttached = true;
    }

    /**
     * Gỡ bỏ các bộ lắng nghe sự kiện của cửa sổ và giải phóng tài nguyên.
     * Tác dụng: Ngăn chặn hiện tượng rò rỉ bộ nhớ (memory leak) khi chuyển đổi màn hình hoặc tải lại game.
     *
     * @param {Object} [stageContext=null] Đối tượng CreateJS Stage nếu có để dọn dẹp các hàm trigger.
     * @returns {void}
     */
    detach(stageContext = null) {
        if (!this._isAttached) return;

        window.removeEventListener("keydown", this._handleKeyDown);
        window.removeEventListener("keyup", this._handleKeyUp);
        window.removeEventListener("click", this._handleClick);

        const targetStage = stageContext || (typeof window !== "undefined" ? window.stage : null);
        if (targetStage) {
            if (targetStage.triggerKeyDown) delete targetStage.triggerKeyDown;
            if (targetStage.triggerKeyUp) delete targetStage.triggerKeyUp;
        }

        this.reset();
        this._isAttached = false;
    }

    /**
     * Bật hoặc tắt chế độ bẫy phím (chống cuộn trang web).
     * Tác dụng: Khi người chơi đang trong màn chơi, việc bấm mũi tên hoặc phím Space sẽ không làm trang web bị cuộn lên/xuống.
     *
     * @param {boolean} trap - True để bật bẫy phím, False để cho phép hành vi mặc định.
     * @returns {void}
     */
    setTrapKeys(trap) {
        this._trapKeys = Boolean(trap);
    }

    /**
     * Đăng ký hàm callback kích hoạt khi người chơi nhấn Space để chuyển tiêu điểm giữa 2 khối nhỏ.
     * Tác dụng: Thông báo cho GameEngine đổi lượt điều khiển giữa khối 1 và khối 2.
     *
     * @param {(newIndex: number) => void} callback
     * @returns {void}
     */
    onSwitchFocus(callback) {
        this._onSwitchCallback = callback;
    }

    /**
     * Đăng ký hàm callback kích hoạt ngay khi nhận được tín hiệu di chuyển hợp lệ.
     * Tác dụng: Hỗ trợ mô hình kiến trúc hướng sự kiện (event-driven) để xử lý bước đi ngay lập tức.
     *
     * @param {(direction: string, focusIndex: number) => void} callback
     * @returns {void}
     */
    onDirection(callback) {
        this._onDirectionCallback = callback;
    }

    /**
     * Đăng ký hàm callback kích hoạt khi người chơi nhấn phím 'R' để khởi động lại màn chơi.
     * Tác dụng: Cung cấp tính năng restart nhanh màn chơi hiện tại cho người chơi.
     *
     * @param {() => void} callback
     * @returns {void}
     */
    onRestart(callback) {
        this._onRestartCallback = callback;
    }

    /**
     * Lấy chỉ số định danh của khối hộp hiện đang nhận điều khiển.
     * Tác dụng: Xác định khối nào sẽ lăn khi người chơi phát lệnh di chuyển.
     *
     * @returns {number} 0 (khối thứ nhất) hoặc 1 (khối thứ hai khi phân tách).
     */
    getFocusIndex() {
        return this._focusIndex;
    }

    /**
     * Thiết lập chỉ số khối hộp nhận điều khiển trực tiếp.
     * Tác dụng: Cho phép GameEngine chỉ định khối active sau khi kích hoạt công tắc phân tách.
     *
     * @param {number} index - Chỉ số khối (>= 0).
     * @returns {void}
     */
    setFocusIndex(index) {
        this._focusIndex = Math.max(0, index);
    }

    /**
     * Chuyển đổi vòng tròn tiêu điểm điều khiển giữa các khối hộp nhỏ trên sàn.
     * Tác dụng: Đổi lượt luân phiên giữa 2 khối nhỏ khi phân tách (0 -> 1 -> 0).
     *
     * @param {number} [totalBlocks=2] - Tổng số lượng khối hiện có trên bàn cờ.
     * @returns {number} Chỉ số khối mới sau khi chuyển đổi.
     */
    switchFocus(totalBlocks = 2) {
        if (totalBlocks > 1) {
            this._focusIndex = (this._focusIndex + 1) % totalBlocks;
            if (this._onSwitchCallback) {
                this._onSwitchCallback(this._focusIndex);
            }
        }
        return this._focusIndex;
    }

    /**
     * Lấy hướng di chuyển chuẩn hóa ("up", "down", "left", "right") tương ứng với phím đang được nhấn đè.
     * Tác dụng: Cung cấp dữ liệu hướng đi cho vòng lặp kiểm tra phím mỗi khung hình (Polling Ticker).
     *
     * @returns {string|null} Tên hướng di chuyển hoặc null nếu không có phím nào được bấm.
     */
    getActiveDirection() {
        if (!this._activeCode) {
            return null;
        }
        return KEY_DIRECTIONS[this._activeCode] || null;
    }

    /**
     * Cập nhật trạng thái phím liên tục theo chu kỳ khung hình (Ticker game loop).
     * Tác dụng: Đảm bảo khi người chơi giữ đè phím mũi tên, khối hộp sẽ tiếp tục lăn đều đặn sau khi hoàn tất hoạt cảnh trước đó.
     *
     * @param {Array<{updateArrowKey: (dir: string) => void}>} blocks - Danh sách thực thể khối hộp trong màn chơi.
     * @returns {void}
     */
    tick(blocks) {
        if (!blocks || blocks.length === 0) return;

        const focusBlock = blocks[this._focusIndex];
        const direction = this.getActiveDirection();

        if (focusBlock && direction && typeof focusBlock.updateArrowKey === "function") {
            focusBlock.updateArrowKey(direction);
        }
    }

    /**
     * Đặt lại trạng thái phím bấm về mặc định (xóa phím active và đưa focus về khối 0).
     * Tác dụng: Dọn dẹp trạng thái phím khi chuyển màn, reset hoặc khi khối hộp ngã rơi.
     *
     * @returns {void}
     */
    reset() {
        this._activeCode = "";
        this._focusIndex = 0;
    }

    /**
     * Chuẩn hóa sự kiện bàn phím thành chuỗi mã phím chuẩn (Event.code).
     * Tác dụng: Đồng nhất mã phím giữa các trình duyệt và hỗ trợ cả phím hoa/thường, phím mũi tên và WASD.
     *
     * @private
     * @param {KeyboardEvent|{code?: string, keyCode?: number, key?: string}} evt
     * @returns {string} Mã phím chuẩn hóa (ví dụ: "KeyR", "ArrowUp").
     */
    _normalizeCode(evt) {
        if (evt.code) {
            return evt.code;
        }
        if (evt.key && (evt.key === "r" || evt.key === "R")) {
            return "KeyR";
        }
        if (evt.keyCode && InputService.FALLBACK_KEY_MAP[evt.keyCode]) {
            return InputService.FALLBACK_KEY_MAP[evt.keyCode];
        }
        return "";
    }

    /**
     * Xử lý sự kiện khi một phím trên bàn phím vật lý được nhấn xuống (keydown).
     * Tác dụng: Ngăn chặn cuộn trang, lọc phím hệ thống của trình duyệt và chuyển tiếp tín hiệu điều khiển vào hệ thống.
     *
     * @private
     * @param {KeyboardEvent} e - Sự kiện bàn phím từ trình duyệt.
     * @returns {void}
     */
    _handleKeyDown(e) {
        // Cho phép các tổ hợp phím hệ thống quan trọng (Ctrl+R, Cmd+R, Alt+F4...) hoạt động bình thường
        if (e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }

        const isTextEntry = InputService.isTextEntryTarget(e.target);

        // Ngăn cuộn trang web nếu đang bật trapKeys và người chơi không thao tác trên ô văn bản
        if (this._trapKeys && !isTextEntry) {
            const code = this._normalizeCode(e);
            if (KEY_DIRECTIONS[code] || code === "Space") {
                e.preventDefault();
            }
        }

        if (isTextEntry) {
            return;
        }

        this._triggerKeyDown({ code: this._normalizeCode(e) });
    }

    /**
     * Xử lý sự kiện khi người chơi nhả phím (keyup).
     * Tác dụng: Cập nhật trạng thái nhả phím để khối hộp dừng lăn khi người chơi không còn nhấn giữ.
     *
     * @private
     * @param {KeyboardEvent} e - Sự kiện bàn phím từ trình duyệt.
     * @returns {void}
     */
    _handleKeyUp(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) {
            return;
        }

        if (this._trapKeys && !InputService.isTextEntryTarget(e.target)) {
            const code = this._normalizeCode(e);
            if (KEY_DIRECTIONS[code] || code === "Space") {
                e.preventDefault();
            }
        }

        this._triggerKeyUp({ code: this._normalizeCode(e) });
    }

    /**
     * Tự động lấy lại tiêu điểm (focus) cho cửa sổ game khi người chơi nhấp chuột ra ngoài các ô input.
     * Tác dụng: Đảm bảo bàn phím luôn nhận được tín hiệu điều khiển ngay cả sau khi tương tác chuột trên màn hình.
     *
     * @private
     * @param {MouseEvent} e - Sự kiện chuột.
     * @returns {void}
     */
    _handleClick(e) {
        if (InputService.isTextEntryTarget(e.target)) {
            return;
        }
        window.focus();
    }

    /**
     * Xử lý nội bộ khi có tín hiệu phím bấm xuống (từ bàn phím vật lý hoặc từ phím ảo trên màn hình cảm ứng).
     * Tác dụng: Lưu trữ mã phím active, xử lý phím Space đổi khối, phím R khởi động lại và gọi callback di chuyển.
     *
     * @private
     * @param {{code?: string}} evt - Dữ liệu sự kiện chứa mã phím.
     * @returns {void}
     */
    _triggerKeyDown(evt) {
        const code = evt.code || "";
        this._activeCode = code;

        // Phím Space: chuyển đổi điều khiển giữa 2 khối nhỏ khi phân thân
        if (code === "Space") {
            this.switchFocus(2);
        }

        // Phím R: khởi động lại màn chơi hiện tại
        if (code === "KeyR" && this._onRestartCallback) {
            this._onRestartCallback();
        }

        // Kích hoạt callback hướng di chuyển tức thời nếu có thành phần đăng ký
        const direction = KEY_DIRECTIONS[code];
        if (direction && this._onDirectionCallback) {
            this._onDirectionCallback(direction, this._focusIndex);
        }
    }

    /**
     * Xử lý nội bộ khi có tín hiệu nhả phím (từ bàn phím vật lý hoặc kết thúc chạm touchup từ phím ảo).
     * Tác dụng: Xóa phím active để kết thúc chu kỳ di chuyển khi người chơi dừng thao tác.
     *
     * @private
     * @param {{code?: string}} evt - Dữ liệu sự kiện nhả phím.
     * @returns {void}
     */
    _triggerKeyUp(evt) {
        const code = evt.code || "";
        // Nếu nhả đúng phím đang được giữ hoặc nhận tín hiệu touchup từ phím cảm ứng thì xóa phím active
        if (code === "touchup" || code === this._activeCode) {
            this._activeCode = "";
        }
    }
}
