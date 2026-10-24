/**
 * @file BlockView.js
 * @description Lớp hiển thị đồ họa đại diện cho khối hộp trên CreateJS Stage,
 * quản lý MovieClip khối chính (lib.Block hoặc lib.BlockSmall) và bóng đổ (lib.BlockShadow hoặc lib.BlockSmallShadow),
 * đồng bộ hóa chuyển động lăn 2.5D, tính toán độ sâu Z-order và xử lý hoạt cảnh tiếp đất, ngã rơi, chui hố đích.
 */

import { Isometric } from "../utils/Isometric.js";

export class BlockView {
    /**
     * Khởi tạo đối tượng hiển thị khối hộp và bóng đổ tương ứng.
     * Tác dụng: Kết nối logic điều khiển với các MovieClip hoạt hình trong CreateJS.
     *
     * @param {createjs.MovieClip|{ block?: import("./Block.js").Block, isSmall?: boolean, blockClip?: createjs.MovieClip, shadowClip?: createjs.MovieClip, x?: number, y?: number, gridX?: number, gridY?: number, onStepMove?: Function, onStep?: Function, sortDepth?: Function, initialPosition?: string }} optionsOrClip - MovieClip khối hoặc cấu hình khởi tạo.
     * @param {createjs.MovieClip} [shadowClip] - MovieClip bóng đổ nếu truyền rời rạc.
     * @param {number} [startGridX] - Tọa độ cột bắt đầu trên lưới.
     * @param {number} [startGridY] - Tọa độ hàng bắt đầu trên lưới.
     * @param {Function} [onRollFinishedCallback] - Callback thực thi khi khối hoàn tất bước lăn lật mặt.
     * @param {Function} [sortDepthCallback] - Callback sắp xếp lại Z-Index giữa các ô sàn và khối.
     */
    constructor(optionsOrClip, shadowClip, startGridX, startGridY, onRollFinishedCallback, sortDepthCallback) {
        let options = null;
        const isDisplayObject = Boolean(optionsOrClip && (typeof optionsOrClip.draw === "function" || optionsOrClip instanceof createjs.DisplayObject));

        if (!isDisplayObject && typeof optionsOrClip === "object" && optionsOrClip !== null) {
            options = optionsOrClip;
            const block = options.block || null;
            this.isSmall = Boolean(options.isSmall || (block && block.isSmall));

            this.blockClip = options.blockClip || (
                this.isSmall
                    ? (typeof window !== "undefined" && window.lib && typeof window.lib.BlockSmall === "function" ? new window.lib.BlockSmall() : new createjs.MovieClip())
                    : (typeof window !== "undefined" && window.lib && typeof window.lib.Block === "function" ? new window.lib.Block() : new createjs.MovieClip())
            );

            this.shadowClip = options.shadowClip || (
                this.isSmall
                    ? (typeof window !== "undefined" && window.lib && typeof window.lib.BlockSmallShadow === "function" ? new window.lib.BlockSmallShadow() : new createjs.MovieClip())
                    : (typeof window !== "undefined" && window.lib && typeof window.lib.BlockShadow === "function" ? new window.lib.BlockShadow() : new createjs.MovieClip())
            );

            startGridX = (block && typeof block.x === "number") ? block.x : (options.x ?? options.gridX ?? 0);
            startGridY = (block && typeof block.y === "number") ? block.y : (options.y ?? options.gridY ?? 0);
            onRollFinishedCallback = options.onStepMove || options.onStep || null;
            sortDepthCallback = options.sortDepth || null;

            if (block && typeof block.attachView === "function") {
                block.attachView(this);
            }
        } else {
            this.blockClip = optionsOrClip || (typeof window !== "undefined" && window.lib && typeof window.lib.Block === "function" ? new window.lib.Block() : new createjs.MovieClip());
            this.shadowClip = shadowClip || (typeof window !== "undefined" && window.lib && typeof window.lib.BlockShadow === "function" ? new window.lib.BlockShadow() : new createjs.MovieClip());
            this.isSmall = false;
        }

        // 1. Đồng bộ hóa hoạt cảnh bóng đổ luôn chạy song song với khối hộp
        this._setupShadowSync();

        // 2. Thiết lập hệ thống tọa độ pixel động và cập nhật độ sâu hiển thị
        this._setupPositionSystem(startGridX, startGridY, sortDepthCallback);

        // 3. Kết nối callback nhận tín hiệu bước lăn từ timeline của CreateJS MovieClip
        this._setupTimelineRoll(onRollFinishedCallback);

        // Khởi tạo tư thế ban đầu nếu được cung cấp (ví dụ 'far' hoặc 'long' khi tái hợp hai khối nhỏ)
        if (options && options.initialPosition) {
            if (this.blockClip && typeof this.blockClip.gotoAndStop === "function") {
                this.blockClip.gotoAndStop(options.initialPosition);
            }
            if (this.blockClip && this.blockClip.roll) {
                this.blockClip.roll.position = options.initialPosition;
                this.blockClip.roll.idle = true;
            }
        }
    }

    // =========================================================================
    // 1. ĐỒNG BỘ HOẠT ẢNH BÓNG ĐỔ (SHADOW SYNCHRONIZATION)
    // =========================================================================

    /**
     * Đồng bộ hóa mọi thao tác chuyển khung hình (play, stop, gotoAndPlay, gotoAndStop) giữa khối hộp và bóng đổ.
     * Tác dụng: Đảm bảo bóng đổ luôn phản ánh chính xác hình dáng, góc xoay và hoạt cảnh ngã rơi của khối hộp
     * ngay cả khi timeline bên trong MovieClip tự động nhảy frame.
     *
     * @private
     * @returns {void}
     */
    _setupShadowSync() {
        if (!this.shadowClip || !this.blockClip) return;

        this.blockClip.shadow = this.shadowClip;

        const rawPlay = this.blockClip.play.bind(this.blockClip);
        this.blockClip.play = () => {
            rawPlay();
            if (this.shadowClip) this.shadowClip.play();
        };

        const rawStop = this.blockClip.stop.bind(this.blockClip);
        this.blockClip.stop = () => {
            rawStop();
            if (this.shadowClip) this.shadowClip.stop();
        };

        const rawGotoAndPlay = this.blockClip.gotoAndPlay.bind(this.blockClip);
        this.blockClip.gotoAndPlay = (frame) => {
            rawGotoAndPlay(frame);
            if (this.shadowClip) this.shadowClip.gotoAndPlay(frame);
        };

        const rawGotoAndStop = this.blockClip.gotoAndStop.bind(this.blockClip);
        this.blockClip.gotoAndStop = (frame) => {
            rawGotoAndStop(frame);
            if (this.shadowClip) this.shadowClip.gotoAndStop(frame);
        };
    }

    // =========================================================================
    // 2. HỆ THỐNG TỌA ĐỘ VÀ CHIỀU SÂU HIỂN THỊ (ISOMETRIC POSITIONING)
    // =========================================================================

    /**
     * Khởi tạo đối tượng `pos` trên MovieClip để quản lý tọa độ logic và chuyển đổi sang tọa độ pixel màn hình.
     * Tác dụng: Cho phép cập nhật tọa độ liên tục khi khối hộp lăn hoặc rơi,
     * tự động dịch chuyển bóng đổ lệch 1 pixel và gọi hàm sắp xếp lại Z-Index chiều sâu hiển thị.
     *
     * @private
     * @param {number} startX - Tọa độ cột bắt đầu.
     * @param {number} startY - Tọa độ hàng bắt đầu.
     * @param {Function} sortDepthCallback - Callback sắp xếp lại Z-Index.
     * @returns {void}
     */
    _setupPositionSystem(startX, startY, sortDepthCallback) {
        if (!this.blockClip) return;

        this.blockClip.afterPos = sortDepthCallback || null;

        this.blockClip.pos = {
            x: startX,
            y: startY,
            update: () => {
                // Chuyển đổi tọa độ logic ma trận sang tọa độ pixel isometric trên màn hình
                const screen = Isometric.toScreen(this.blockClip.pos.x, this.blockClip.pos.y);
                this.blockClip.x = screen[0] ?? screen.x;
                this.blockClip.y = screen[1] ?? screen.y;

                // Bóng đổ được đặt lệch -1 pixel so với vị trí khối để tạo cảm giác chiều sâu tự nhiên
                if (this.shadowClip) {
                    this.shadowClip.x = this.blockClip.x - 1;
                    this.shadowClip.y = this.blockClip.y - 1;
                }

                // Kích hoạt hàm sắp xếp lại thứ tự vẽ (Z-Order) giữa các layer
                if (this.blockClip.afterPos) {
                    this.blockClip.afterPos();
                }
            }
        };

        // Áp dụng định vị pixel ban đầu
        this.blockClip.pos.update();
    }

    // =========================================================================
    // 3. KẾT NỐI VỚI HOẠT CẢNH TIMELINE LĂN KHỐI (TIMELINE ROLL HOOKS)
    // =========================================================================

    /**
     * Thiết lập cấu trúc `blockClip.roll` để MovieClip tương tác hai chiều với mã nguồn ứng dụng.
     * Tác dụng: Khi animation lăn đạt đến khung hình tiếp đất (frame 9 hoặc 19),
     * timeline tự động gọi hàm `move(axis, change, nextPosition)` để cập nhật tọa độ logic mới
     * và thông báo cho GameEngine xử lý va chạm, âm thanh tiếp đất.
     *
     * @private
     * @param {Function} onRollFinishedCallback - Callback thông báo bước lăn hoàn tất.
     * @returns {void}
     */
    _setupTimelineRoll(onRollFinishedCallback) {
        if (!this.blockClip) return;

        this.blockClip.roll = {
            idle: false,
            position: "up", // Tư thế hiện tại ('up', 'far', hoặc 'long')
            depthNudge: 0,  // Độ bù chiều sâu khi lăn sang trái hoặc xuống dưới

            move: (axis, change, nextPosition) => {
                // Cập nhật tọa độ logic mới khi khối lật mặt tiếp xúc sàn
                this.blockClip.pos[axis] += change;
                this.blockClip.roll.depthNudge = 0;
                this.blockClip.roll.position = nextPosition;
                this.blockClip.pos.update();
                this.blockClip.gotoAndStop(nextPosition);

                // Thông báo cho GameEngine kiểm tra các ô sàn tiếp đất, công tắc và phát âm thanh
                if (onRollFinishedCallback) {
                    onRollFinishedCallback(axis, change, nextPosition);
                }
            }
        };
    }

    // =========================================================================
    // 4. CÁC PHƯƠNG THỨC ĐIỀU KHIỂN CÔNG KHAI (PUBLIC APIS)
    // =========================================================================

    /**
     * Lấy đối tượng MovieClip của khối hộp.
     * @returns {createjs.MovieClip}
     */
    getBlockClip() {
        return this.blockClip;
    }

    /**
     * Lấy đối tượng MovieClip của bóng đổ.
     * @returns {createjs.MovieClip}
     */
    getShadowClip() {
        return this.shadowClip;
    }

    /**
     * Lấy hệ số bù chiều sâu (depthNudge) dùng khi khối đang lăn.
     * @returns {number}
     */
    getDepthNudge() {
        return (this.blockClip && this.blockClip.roll) ? this.blockClip.roll.depthNudge : 0;
    }

    /**
     * Lấy tọa độ cột logic hiện tại.
     * @returns {number}
     */
    getX() {
        return (this.blockClip && this.blockClip.pos) ? this.blockClip.pos.x : 0;
    }

    /**
     * Lấy tọa độ hàng logic hiện tại.
     * @returns {number}
     */
    getY() {
        return (this.blockClip && this.blockClip.pos) ? this.blockClip.pos.y : 0;
    }

    /**
     * Kích hoạt động tác lăn theo hướng chỉ định khi người chơi nhấn phím.
     * Tác dụng: Khóa nhận phím để tránh lăn chồng chéo, bù chiều sâu hiển thị nếu lăn hướng trái/xuống
     * và phát hoạt cảnh lăn lật tương ứng (ví dụ: "rollupleft").
     *
     * @param {string} key - Hướng lăn ("up", "down", "left", "right").
     * @returns {void}
     */
    roll(key) {
        if (!key || !this.blockClip || !this.blockClip.roll || !this.blockClip.roll.idle) return;

        // Khóa phím tạm thời trong suốt thời gian animation lăn diễn ra
        this.blockClip.roll.idle = false;

        // Bù Z-Index khi lăn sang trái hoặc xuống dưới để khối không bị các ô gạch phía trước che khuất
        this.blockClip.roll.depthNudge = (key === "left" || key === "down") ? 1 : 0;
        this.blockClip.pos.update();

        // Kích hoạt nhãn hoạt cảnh lăn tương ứng trên timeline
        this.blockClip.gotoAndPlay("roll" + this.blockClip.roll.position + key);
    }

    /**
     * Kích hoạt hoạt cảnh khối hộp rơi từ trên trời xuống tiếp đất khi bắt đầu màn chơi.
     * Tác dụng: Tạo hiệu ứng xuất phát ấn tượng cho khối hộp khi vừa nạp màn mới.
     *
     * @returns {void}
     */
    land() {
        if (this.blockClip) this.blockClip.gotoAndPlay("land");
    }

    /**
     * Kích hoạt hoạt cảnh ngã rơi xuống vực sâu theo hướng xác định.
     * Tác dụng: Hiển thị chuyển động khối hộp mất thăng bằng lộn nhào qua mép bàn cờ khi người chơi đi sai bước.
     *
     * @param {string} direction - Hướng ngã ("up", "down", "left", "right", hoặc "square" nếu sập sàn cam).
     * @param {string} [position] - Tư thế khối trước khi ngã ("up", "far", "long").
     * @returns {void}
     */
    playFall(direction, position) {
        if (!this.blockClip || typeof this.blockClip.gotoAndPlay !== "function") return;
        let animName;
        if (!direction) {
            animName = "fall";
        } else if (direction.startsWith("fall")) {
            animName = direction;
        } else if (direction === "square") {
            animName = "fallsquare";
        } else if (direction.length > 4 && (direction.startsWith("up") || direction.startsWith("far") || direction.startsWith("long"))) {
            animName = `fall${direction}`;
        } else {
            const pos = position || (this.blockClip.roll ? this.blockClip.roll.position : "up");
            animName = `fall${pos}${direction}`;
        }
        this.blockClip.gotoAndPlay(animName);
    }

    /**
     * Kích hoạt hoạt cảnh mờ dần và biến mất của khối nhỏ khi khối nhỏ còn lại bị rơi vực.
     * Tác dụng: Tạo hiệu ứng tan biến đồng bộ (phase out) trước khi đặt lại vị trí xuất phát.
     *
     * @returns {void}
     */
    playPhaseAnimation() {
        if (this.blockClip && typeof this.blockClip.gotoAndPlay === "function") {
            this.blockClip.gotoAndPlay("phase");
        }
    }

    /**
     * Kích hoạt hoạt cảnh chui thẳng đứng vào lỗ đích khi hoàn thành màn chơi.
     * Tác dụng: Thể hiện hành động chiến thắng ngoạn mục khi khối lọt vừa khít hố thoát.
     *
     * @returns {void}
     */
    playEndAnimation() {
        if (this.blockClip) {
            this.blockClip.gotoAndPlay("end");
        }
    }

    /**
     * Kích hoạt hoạt cảnh xuất hiện của khối lập phương nhỏ khi phân tách.
     * Tác dụng: Hiển thị hiệu ứng khối nhỏ rơi nhẹ xuống sàn tại vị trí spawn mới.
     *
     * @returns {void}
     */
    playSpawnAnimation() {
        if (this.blockClip && typeof this.blockClip.gotoAndPlay === "function") {
            this.blockClip.gotoAndPlay("spawn");
        }
    }

    /**
     * Hiển thị dấu ngoặc chỉ báo (brackets) bao quanh khối nhỏ đang được chọn điều khiển khi nhấn Space.
     * Tác dụng: Giúp người chơi nhận biết trực quan khối nào đang nhận lệnh điều khiển từ bàn phím.
     *
     * @returns {void}
     */
    playSelectBrackets() {
        if (this.blockClip) {
            if (this.blockClip.select && typeof this.blockClip.select.gotoAndPlay === "function") {
                this.blockClip.select.gotoAndPlay("select");
            } else if (this.blockClip.brackets && typeof this.blockClip.brackets.gotoAndPlay === "function") {
                this.blockClip.brackets.gotoAndPlay(0);
            }
        }
    }

    /**
     * Kiểm tra xem khối hộp có đang ở trạng thái nghỉ và sẵn sàng tiếp nhận lệnh lăn tiếp theo hay không.
     * Tác dụng: Ngăn chặn nhận tín hiệu phím khi khối đang giữa chừng bước lăn hoặc đang ngã rơi.
     *
     * @returns {boolean} True nếu khối đang đứng yên (idle = true).
     */
    isIdle() {
        return Boolean(this.blockClip && this.blockClip.roll && this.blockClip.roll.idle);
    }

    /**
     * Dọn dẹp và giải phóng hoàn toàn đối tượng hiển thị khối hộp và bóng đổ khỏi Stage.
     * Tác dụng: Dừng toàn bộ timeline đang chạy và gỡ bỏ MovieClip khỏi cây hiển thị để chống rò rỉ bộ nhớ.
     *
     * @returns {void}
     */
    destroy() {
        if (this.blockClip) {
            if (typeof this.blockClip.stop === "function") this.blockClip.stop();
            if (this.blockClip.parent) {
                this.blockClip.parent.removeChild(this.blockClip);
            }
        }
        if (this.shadowClip) {
            if (typeof this.shadowClip.stop === "function") this.shadowClip.stop();
            if (this.shadowClip.parent) {
                this.shadowClip.parent.removeChild(this.shadowClip);
            }
        }
    }
}
