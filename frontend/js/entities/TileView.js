/**
 * @file TileView.js
 * @description Lớp hiển thị đồ họa đại diện cho một ô sàn trên bàn cờ CreateJS,
 * quản lý MovieClip lib.Tile(), chuyển đổi tọa độ isometric sang tọa độ pixel hiển thị,
 * điều khiển hoạt cảnh xuất hiện mở màn, mở/đóng cầu nối, đổi màu đèn flasher và hiệu ứng vỡ vụn của ô sàn cam.
 */

import { Isometric } from "../utils/Isometric.js";
import { AnimationHelper } from "../utils/AnimationHelper.js";
import { TILE_TYPES, INITIAL_DOOR_STATES } from "../utils/Constants.js";

export class TileView {
    /**
     * Khởi tạo đối tượng đồ họa hiển thị cho một ô sàn.
     * Tác dụng: Tạo cầu nối điều khiển hoạt họa giữa logic ô sàn và MovieClip đồ họa của CreateJS.
     *
     * @param {createjs.MovieClip} tileClip - Instance MovieClip của ô sàn (từ namespace lib.Tile()).
     * @param {string} type - Ký tự mã hóa loại ô ('b', 's', 'h', 'l', 'k', 'r', 'q', 'e', 'v', 'f').
     * @param {number} gridX - Tọa độ cột trên lưới (0 đến 14).
     * @param {number} gridY - Tọa độ hàng trên lưới (0 đến 9).
     * @param {((isPassable: boolean) => void)|null} [onPassableChange=null] - Callback thông báo khi trạng thái có thể đi qua của cầu thay đổi.
     */
    constructor(tileClip, type, gridX, gridY, onPassableChange = null) {
        /**
         * Instance MovieClip đồ họa đại diện cho ô sàn.
         * @type {createjs.MovieClip}
         */
        this.tileClip = tileClip;

        /**
         * Loại ô sàn.
         * @type {string}
         */
        this.type = type;

        /**
         * Tọa độ cột trên lưới.
         * @type {number}
         */
        this.gridX = gridX;

        /**
         * Tọa độ hàng trên lưới.
         * @type {number}
         */
        this.gridY = gridY;

        // 1. Cài đặt hệ thống tọa độ pixel động (pos) cho ô sàn
        this._setupPosition(gridX, gridY);

        // 2. Thiết lập cấu trúc dữ liệu cầu nối nếu ô này là cầu l, k, r, q
        this._setupDoorBehavior(type, onPassableChange);

        // 3. Khởi tạo nhãn hoạt họa ban đầu và đặt độ trễ ngẫu nhiên cho hoạt cảnh xuất hiện
        this._setupAppearance(type);
    }

    // =========================================================================
    // 1. TỌA ĐỘ VÀ VỊ TRÍ PIXEL KHUNG HÌNH (ISOMETRIC COORDINATES)
    // =========================================================================

    /**
     * Khởi tạo đối tượng tọa độ logic và phương thức cập nhật tọa độ pixel màn hình.
     * Tác dụng: Cho phép các hiệu ứng rơi tự do (playFall) hoặc xoáy hút (playSwirl)
     * thao tác trực tiếp trên thuộc tính pos.x, pos.y và gọi hàm update() để chiếu lại tọa độ pixel.
     *
     * @private
     * @param {number} x - Tọa độ cột trên lưới.
     * @param {number} y - Tọa độ hàng trên lưới.
     * @returns {void}
     */
    _setupPosition(x, y) {
        if (!this.tileClip) return;

        this.tileClip.pos = {
            x: x,
            y: y,
            update: () => {
                const screen = Isometric.toScreen(this.tileClip.pos.x, this.tileClip.pos.y);
                this.tileClip.x = screen[0] ?? screen.x;
                this.tileClip.y = screen[1] ?? screen.y;
            }
        };

        // Áp dụng định vị pixel ban đầu ngay khi khởi tạo
        this.tileClip.pos.update();
    }

    // =========================================================================
    // 2. CƠ CHẾ ĐIỀU KHIỂN CẦU NỐI (DOOR MECHANICS)
    // =========================================================================

    /**
     * Khởi tạo đối tượng trạng thái `tileClip.door` cho các ô cầu sắt.
     * Tác dụng: Cung cấp các biến trạng thái `initialState`, `state`, `passable` và callback `onChange`
     * để timeline hoạt cảnh của CreateJS tự động kích hoạt cập nhật khả năng đi qua khi animation mở cầu hoàn tất.
     *
     * @private
     * @param {string} type - Loại ô sàn.
     * @param {((isPassable: boolean) => void)|null} onPassableChange - Callback khi cầu chuyển trạng thái.
     * @returns {void}
     */
    _setupDoorBehavior(type, onPassableChange) {
        if (!this.tileClip) return;
        if (!INITIAL_DOOR_STATES.hasOwnProperty(type)) {
            return; // Ô sàn kiên cố thường, không cần cơ chế cầu
        }

        const startState = INITIAL_DOOR_STATES[type];

        this.tileClip.door = {
            initialState: startState,
            state: startState,
            passable: false,
            onChange: (isPassable) => {
                this.tileClip.door.passable = isPassable;
                if (onPassableChange) {
                    onPassableChange(isPassable);
                }
            }
        };
    }

    // =========================================================================
    // 3. KHỞI TẠO HOẠT ẢNH BAN ĐẦU (APPEARANCE & ENTRANCE ANIMATION)
    // =========================================================================

    /**
     * Ánh xạ ký tự loại ô sàn sang nhãn khung hình tương ứng trong MovieClip lib.Tile()
     * và đặt độ trễ ngẫu nhiên trước khi chạy hoạt cảnh xuất hiện mở màn.
     * Tác dụng: Tạo hiệu ứng các ô sàn trồi lên so le tự nhiên, mang lại cảm giác sống động khi bước vào màn chơi.
     *
     * @private
     * @param {string} type - Loại ô sàn.
     * @returns {void}
     */
    _setupAppearance(type) {
        if (!this.tileClip) return;

        const frameNames = {
            b: "normalblock",
            s: "softswitch",
            h: "hardswitch",
            l: "doorblockl",
            k: "doorblockl",
            r: "doorblockr",
            q: "doorblockr",
            e: "endblock",
            v: "splitswitch",
            f: "fallblock"
        };

        const targetFrame = frameNames[type] || "normalblock";
        this.tileClip.gotoAndStop(targetFrame);

        // Đặt độ trễ ngẫu nhiên để các ô gạch trồi lên theo nhịp điệu tự nhiên
        const delayTicks = "bshvf".indexOf(type) !== -1 ? Math.floor(Math.random() * 5) + 10 : 30;

        AnimationHelper.wait(delayTicks, () => {
            if (this.tileClip) this.tileClip.play();
        });
    }

    // =========================================================================
    // 4. CÁC PHƯƠNG THỨC ĐIỀU KHIỂN CÔNG KHAI (PUBLIC APIS)
    // =========================================================================

    /**
     * Lấy đối tượng MovieClip CreateJS đại diện cho ô sàn.
     * Tác dụng: Cho phép Renderer thêm ô sàn vào các phân tầng hiển thị trên Stage.
     *
     * @returns {createjs.MovieClip}
     */
    getDisplayObject() {
        return this.tileClip;
    }

    /**
     * Kích hoạt hoạt cảnh đóng hoặc mở cầu nối.
     * Tác dụng: Chạy animation nhấc thanh cầu lên hoặc hạ xuống khi công tắc được bật.
     *
     * @returns {void}
     */
    toggleDoorAnimation() {
        if (this.tileClip) this.tileClip.play();
    }

    /**
     * Cập nhật trạng thái đèn báo (flasher) đặt bên cạnh cầu nối.
     * Tác dụng: Đổi màu đèn báo sang xanh lá ("green") khi cầu mở và đỏ ("red") khi cầu đóng.
     *
     * @param {boolean} isOpen - True để bật đèn xanh (cầu mở), False để bật đèn đỏ (cầu đóng).
     * @returns {void}
     */
    setFlasherState(isOpen) {
        if (this.tileClip && this.tileClip.flasher && typeof this.tileClip.flasher.gotoAndPlay === "function") {
            this.tileClip.flasher.gotoAndPlay(isOpen ? "green" : "red");
        }
    }

    /**
     * Kích hoạt hoạt cảnh nứt vỡ của ô sàn màu cam (Fragile Tile).
     * Tác dụng: Phát animation ô gạch vỡ vụn khi khối hộp đứng thẳng đè lên.
     *
     * @returns {void}
     */
    triggerFragileBreak() {
        if (this.tileClip) this.tileClip.play();
    }

    /**
     * Kiểm tra xem ô cầu nối hiện tại có đang trong trạng thái vững chắc cho phép đi qua hay không.
     * Tác dụng: Cung cấp thông tin cho giải thuật kiểm tra bước đi hợp lệ của khối hộp.
     *
     * @returns {boolean} True nếu cầu đã hạ xuống hoàn toàn và có thể đi qua an toàn.
     */
    isDoorPassable() {
        return (this.tileClip && this.tileClip.door) ? this.tileClip.door.passable : true;
    }
}
