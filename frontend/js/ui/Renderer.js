/**
 * @file Renderer.js
 * @description Hệ thống kết xuất đồ họa và phân tầng hiển thị trên CreateJS Stage,
 * quản lý 8 lớp đồ họa (Background, Sàn gạch, Bóng đổ, Khối gạch, Phím ảo cảm ứng, Chữ hướng dẫn, Menu overlay),
 * tạo mặt nạ bóng đổ hình thoi isometric, giải thuật sắp xếp chiều sâu Z-Order khi lăn và khi rơi vực,
 * cùng cơ chế co giãn responsive hỗ trợ màn hình độ phân giải cao (HiDPI / Retina).
 */

import { Isometric } from "../utils/Isometric.js";

export class Renderer {
    /**
     * Kích thước khung nhìn logic và các thông số tỷ lệ hiển thị.
     * Tác dụng: Cố định độ phân giải không gian làm việc 550x300 pixel,
     * tự động co nhỏ tỷ lệ (scale = 0.85) khi bật chế độ cảm ứng để bàn tay không che khuất mặt sàn.
     * @readonly
     */
    static VIEWPORT = Object.freeze({
        WIDTH: 550,
        HEIGHT: 300,
        TOUCH_SCALE: 0.85, // Hệ số co nhỏ bàn cờ khi bật phím cảm ứng
        TOUCH_OFFSET_Y: 0  // Độ dịch chuyển trục Y trong chế độ cảm ứng
    });

    /**
     * Khởi tạo hệ thống kết xuất đồ họa và phân tầng layer trên CreateJS Stage.
     *
     * @param {Object} options
     * @param {createjs.Stage} options.stage - Đối tượng CreateJS Stage chính gắn với canvas.
     * @param {boolean} [options.isTouch=false] - True nếu đang chạy trên thiết bị cảm ứng.
     */
    constructor(options) {
        if (!options || !options.stage) {
            throw new Error("[Renderer] Cần truyền đối tượng createjs.Stage hợp lệ.");
        }

        /**
         * Stage chính của CreateJS.
         * @private
         * @type {createjs.Stage}
         */
        this._stage = options.stage;

        /**
         * Trạng thái thiết bị cảm ứng.
         * @private
         * @type {boolean}
         */
        this._isTouch = Boolean(options.isTouch);

        /**
         * Container tổng chứa toàn bộ các layer đồ họa của màn chơi.
         * @private
         * @type {createjs.Container}
         */
        this._gameContainer = new createjs.Container();

        // Khởi tạo các phân tầng đồ họa theo thứ tự hiển thị từ dưới lên trên:
        /** @private @type {createjs.Container} */
        this._layerBackground = new createjs.Container(); // Lớp 0: Bầu trời, Passcode, Bước đi, Nút Menu

        /** @private @type {createjs.Container} */
        this._layerTiles = new createjs.Container();      // Lớp 1: Mặt sàn gạch bàn cờ

        /** @private @type {createjs.Container} */
        this._layerShadows = new createjs.Container();    // Lớp 2: Bóng đổ của khối hộp
        this._layerShadows.alpha = 0.5;                   // Độ trong suốt bán phần tạo hiệu ứng đổ bóng tự nhiên

        /** @private @type {createjs.Shape} */
        this._shadowMask = new createjs.Shape();          // Mặt nạ đa giác isometric giới hạn bóng trong mặt sàn
        this._shadowMask.visible = false;                 // Mặt nạ che không vẽ trực tiếp lên canvas

        /** @private @type {createjs.Container} */
        this._layerBlocks = new createjs.Container();     // Lớp 3: Các khối hộp di chuyển

        /** @private @type {createjs.Container} */
        this._layerControls = new createjs.Container();   // Lớp 4: Cụm phím ảo cảm ứng trên màn hình

        /** @private @type {createjs.Container} */
        this._layerHelp = new createjs.Container();       // Lớp 5: Dòng chữ hướng dẫn (HelpText)

        /** @private @type {createjs.Container} */
        this._layerOverlay = new createjs.Container();    // Lớp 6: PauseMenu và màn hình kết thúc

        // Các container đại diện cho từng màn hình độc lập
        /** @private @type {createjs.Container} */
        this._screenMenu = new createjs.Container();
        /** @private @type {createjs.Container} */
        this._screenInstructions = new createjs.Container();
        /** @private @type {createjs.Container} */
        this._screenStageTitle = new createjs.Container();
        /** @private @type {createjs.Container} */
        this._screenVictory = new createjs.Container();

        /** @private @type {((screenName: string, action: string, target?: string) => void)|null} */
        this._onScreenActionCallback = null;

        this._setupScreenBridges();
        this._setupLayers();
        this._applyTouchScaling();
    }

    /**
     * Thiết lập các phương thức cầu nối (bridge) cho các container màn hình
     * để tương thích với các lệnh điều hướng MovieClip (gotoAndPlay, gotoAndStop, play, stop).
     * Tác dụng: Cho phép timeline đồ họa phát tín hiệu chuyển cảnh mượt mà qua callback.
     *
     * @private
     * @returns {void}
     */
    _setupScreenBridges() {
        const screens = [
            { container: this._screenMenu, name: "menu" },
            { container: this._screenInstructions, name: "instructions" },
            { container: this._screenVictory, name: "victory" }
        ];

        screens.forEach(({ container, name }) => {
            const stopChildren = () => {
                if (Array.isArray(container.children)) {
                    container.children.forEach((c) => {
                        if (c && typeof c.stop === "function") c.stop();
                    });
                }
            };
            container.gotoAndPlay = (target) => {
                stopChildren();
                if (typeof this._onScreenActionCallback === "function") {
                    this._onScreenActionCallback(name, "gotoAndPlay", target);
                } else {
                    if (target === "instructions") this.showScreen("instructions");
                    else if (target === "stagetitle" || target === "game") this.showScreen("game");
                    else if (target === "menu") this.showScreen("menu");
                }
            };
            container.gotoAndStop = (target) => {
                stopChildren();
                if (typeof this._onScreenActionCallback === "function") {
                    this._onScreenActionCallback(name, "gotoAndStop", target);
                } else {
                    if (target === "instructions") this.showScreen("instructions");
                    else if (target === "stagetitle" || target === "game") this.showScreen("game");
                    else if (target === "menu") this.showScreen("menu");
                }
            };
            container.play = () => {
                if (typeof this._onScreenActionCallback === "function") {
                    this._onScreenActionCallback(name, "play");
                }
            };
            container.stop = () => {
                if (typeof this._onScreenActionCallback === "function") {
                    this._onScreenActionCallback(name, "stop");
                }
            };
        });
    }

    /**
     * Đăng ký callback xử lý khi timeline của các màn hình yêu cầu chuyển cảnh.
     * Tác dụng: Thông báo cho GameEngine đồng bộ hóa trạng thái FSM.
     *
     * @param {(screenName: string, action: string, target?: string) => void} callback
     * @returns {void}
     */
    onScreenAction(callback) {
        this._onScreenActionCallback = callback;
    }

    /**
     * Lắp ráp các Container phân tầng vào gameContainer và Stage theo thứ tự chiều sâu chuẩn xác.
     * Tác dụng: Đảm bảo thứ tự hiển thị: Nền -> Sàn gạch -> Bóng đổ (có mask) -> Khối hộp -> Phím ảo -> Hướng dẫn -> Menu.
     *
     * @private
     * @returns {void}
     */
    _setupLayers() {
        // Gán mặt nạ đa giác isometric để bóng chỉ đổ trên bề mặt gạch có thực
        this._layerShadows.mask = this._shadowMask;

        // Thứ tự thêm vào container quyết định z-index hiển thị từ dưới lên trên:
        this._gameContainer.addChild(this._layerBackground);
        this._gameContainer.addChild(this._layerTiles);
        this._gameContainer.addChild(this._layerShadows);
        this._gameContainer.addChild(this._layerBlocks);
        this._gameContainer.addChild(this._layerControls);
        this._gameContainer.addChild(this._layerHelp);
        this._gameContainer.addChild(this._layerOverlay);

        this._stage.addChild(this._gameContainer);
        this._stage.addChild(this._screenStageTitle);
        this._stage.addChild(this._screenMenu);
        this._stage.addChild(this._screenInstructions);
        this._stage.addChild(this._screenVictory);
    }

    /**
     * Tự động thu nhỏ tỷ lệ bàn cờ (scale = 0.85) khi phát hiện thiết bị cảm ứng.
     * Tác dụng: Tạo khoảng trống hợp lý cho cụm phím ảo và giúp ngón tay người chơi không che khuất tầm nhìn bàn cờ.
     *
     * @private
     * @returns {void}
     */
    _applyTouchScaling() {
        if (!this._isTouch) return;

        const scale = Renderer.VIEWPORT.TOUCH_SCALE;
        const offsetY = Renderer.VIEWPORT.TOUCH_OFFSET_Y;

        // Áp dụng tỷ lệ co cho các layer thuộc không gian bàn cờ 3D
        const boardLayers = [
            this._layerTiles,
            this._layerShadows,
            this._shadowMask,
            this._layerBlocks
        ];

        boardLayers.forEach((layer) => {
            layer.scaleX = scale;
            layer.scaleY = scale;
            layer.y = offsetY;
        });
    }

    /**
     * Gắn kết các DisplayObject thành phần của HUD, Menu và Phím ảo vào đúng các container phân tầng.
     * Tác dụng: Định vị và tổ chức các thành phần đồ họa theo kiến trúc module sạch sẽ.
     *
     * @param {Object} components
     * @param {createjs.DisplayObject} [components.background]
     * @param {createjs.DisplayObject} [components.helpText]
     * @param {createjs.DisplayObject} [components.controls]
     * @param {createjs.DisplayObject} [components.pauseMenu]
     * @param {createjs.DisplayObject} [components.mainMenu]
     * @param {createjs.DisplayObject} [components.instructions]
     * @param {createjs.DisplayObject} [components.stageTitle]
     * @param {createjs.DisplayObject} [components.victory]
     * @returns {void}
     */
    setUIComponents(components) {
        if (!components) return;
        const isValid = (obj) => Boolean(obj && (typeof obj.draw === "function" || obj instanceof createjs.DisplayObject));

        if (isValid(components.background)) {
            this._layerBackground.removeAllChildren();
            this._layerBackground.addChild(components.background);
        }
        if (isValid(components.helpText)) {
            this._layerHelp.removeAllChildren();
            this._layerHelp.addChild(components.helpText);
        }
        if (isValid(components.controls) && this._isTouch) {
            this._layerControls.removeAllChildren();
            this._layerControls.addChild(components.controls);
        }
        if (isValid(components.pauseMenu)) {
            this._layerOverlay.removeAllChildren();
            this._layerOverlay.addChild(components.pauseMenu);
        }
        if (isValid(components.mainMenu)) {
            this._screenMenu.removeAllChildren();
            components.mainMenu.setTransform(275, 150, 1, 1, 0, 0, 0, 275, 150);
            this._screenMenu.addChild(components.mainMenu);
        }
        if (isValid(components.instructions)) {
            this._screenInstructions.removeAllChildren();
            components.instructions.setTransform(197.5, 163, 1, 1, 0, 0, 0, 188.5, 0);
            this._screenInstructions.addChild(components.instructions);
        }
        if (isValid(components.stageTitle)) {
            this._screenStageTitle.removeAllChildren();
            const bg = new createjs.Shape();
            bg.graphics.f("#000000").r(0, 0, Renderer.VIEWPORT.WIDTH, Renderer.VIEWPORT.HEIGHT);
            this._screenStageTitle.addChild(bg);
            components.stageTitle.setTransform(226, 153.6, 1, 1, 0, 0, 0, 87, -3);
            this._screenStageTitle.addChild(components.stageTitle);
        }
        if (isValid(components.victory)) {
            this._screenVictory.removeAllChildren();
            components.victory.setTransform(275, 150, 1, 1, 0, 0, 0, 275, 150);
            this._screenVictory.addChild(components.victory);
        }
    }

    /**
     * Chuyển đổi màn hình hiển thị chính (menu, instructions, stagetitle, game, victory).
     * Tác dụng: Bật/tắt thuộc tính visible của từng Container tương ứng để chỉ hiển thị màn hình đang active,
     * đồng thời dọn dẹp các phần tử DOM nhập liệu khi chuyển khỏi Menu.
     *
     * @param {string} screenName - Tên màn hình cần hiển thị.
     * @returns {void}
     */
    showScreen(screenName) {
        const s = String(screenName).toLowerCase();
        this._screenMenu.visible = (s === "menu");
        this._screenInstructions.visible = (s === "instructions");
        this._screenStageTitle.visible = (s === "stagetitle" || s === "stage_title");
        this._screenVictory.visible = (s === "victory");
        this._gameContainer.visible = (s === "game" || s === "playing" || s === "paused" || s === "stage_intro" || s === "level_lose" || s === "level_win");

        // Đảm bảo không còn ô nhập văn bản passcode DOM nào che khuất màn hình chơi
        if (s !== "menu") {
            const input = document.getElementById("loadLevelTextInput");
            if (input) {
                input.style.display = "none";
                if (input.parentNode) {
                    input.parentNode.removeChild(input);
                }
            }
        }
    }

    // ==========================================
    // 1. QUẢN LÝ KHỐI HỘP VÀ BÓNG ĐỔ (BLOCKS & SHADOWS)
    // ==========================================

    /**
     * Thêm một khối hộp và bóng đổ tương ứng vào Renderer.
     * Tác dụng: Đưa khối hộp vào layerBlocks và bóng đổ vào layerShadows.
     *
     * @param {createjs.DisplayObject} blockClip - MovieClip của khối hộp.
     * @param {createjs.DisplayObject} shadowClip - MovieClip của bóng đổ.
     * @returns {void}
     */
    addBlock(blockClip, shadowClip) {
        if (shadowClip && (typeof shadowClip.draw === "function" || shadowClip instanceof createjs.DisplayObject)) {
            this._layerShadows.addChild(shadowClip);
        }
        if (blockClip && (typeof blockClip.draw === "function" || blockClip instanceof createjs.DisplayObject)) {
            this._layerBlocks.addChild(blockClip);
        }
    }

    /**
     * Gỡ bỏ một khối hộp và bóng đổ khỏi các layer hiển thị.
     *
     * @param {createjs.DisplayObject} blockClip
     * @param {createjs.DisplayObject} shadowClip
     * @returns {void}
     */
    removeBlock(blockClip, shadowClip) {
        if (shadowClip) {
            this._layerShadows.removeChild(shadowClip);
        }
        if (blockClip) {
            this._layerBlocks.removeChild(blockClip);
        }
    }

    /**
     * Sắp xếp lại thứ tự chiều sâu (Z-Index) giữa hai khối lập phương nhỏ khi ở chế độ phân tách.
     * Tác dụng: Khối nào ở gần người xem hơn (chỉ số depth = y - x + depthNudge lớn hơn)
     * sẽ được vẽ đè lên trên khối nằm xa hơn, đảm bảo phối cảnh 3D chân thực.
     *
     * @param {Array<{
     *   blockClip: createjs.DisplayObject,
     *   shadowClip: createjs.DisplayObject,
     *   pos: { x: number, y: number },
     *   depthNudge: number
     * }>} blockItems - Danh sách các khối nhỏ cần sắp xếp.
     * @returns {void}
     */
    sortBlockDepths(blockItems) {
        if (!blockItems || blockItems.length < 2) return;

        const sorted = blockItems.map((item) => {
            this._layerShadows.removeChild(item.shadowClip);
            this._layerBlocks.removeChild(item.blockClip);

            return {
                item: item,
                depth: Isometric.getDepth(item.pos.x, item.pos.y, item.depthNudge || 0)
            };
        });

        // Sắp xếp tăng dần theo độ sâu (vật thể sâu hơn vẽ trước, gần hơn vẽ sau)
        sorted.sort((a, b) => a.depth - b.depth);

        // Đưa lại vào container theo đúng thứ tự vẽ mới
        sorted.forEach((data) => {
            if (data.item.shadowClip) this._layerShadows.addChild(data.item.shadowClip);
            if (data.item.blockClip) this._layerBlocks.addChild(data.item.blockClip);
        });
    }

    /**
     * Tái phân tầng chiều sâu khi khối hộp bị ngã rơi khỏi mép bàn cờ:
     * Rút khối hộp khỏi layerBlocks và chèn vào giữa danh sách ô sàn của layerTiles.
     * Tác dụng: Tạo hiệu ứng thị sai không gian 3D, giúp khối hộp rơi lọt ra phía sau các ô gạch tiền cảnh
     * nhưng vẫn che khuất các ô gạch hậu cảnh nằm phía sau nó.
     *
     * @param {Object} params
     * @param {createjs.DisplayObject} params.blockClip
     * @param {createjs.DisplayObject} params.shadowClip
     * @param {{ x: number, y: number }} params.pos - Tọa độ logic của khối hộp.
     * @param {string} params.direction - Hướng ngã rơi ("up", "down", "left", "right").
     * @param {string} params.position - Tư thế khối ("up", "far", "long").
     * @param {Array<{ tileClip: createjs.DisplayObject, pos: { x: number, y: number } }>} params.tiles - Danh sách các ô sàn.
     * @returns {void}
     */
    sortBlockDepthAmongTiles(params) {
        const { blockClip, shadowClip, pos, direction, position, tiles } = params;

        // Gỡ bóng đổ và rút khối khỏi layerBlocks
        if (shadowClip) this._layerShadows.removeChild(shadowClip);
        if (blockClip) {
            blockClip.afterPos = null;
            this._layerBlocks.removeChild(blockClip);
        }

        // Tính toán độ lệch tọa độ ảo khi khối ngã lật theo hướng và tư thế từ Isometric helper
        const [nudgeX, nudgeY] = Isometric.getFallDepthNudge(direction, position);
        const targetX = pos.x + nudgeX;
        const targetY = pos.y + nudgeY;

        // Tách sàn gạch thành hai nhóm: Nhóm nằm phía sau khối và Nhóm nằm phía trước khối
        const tilesBehind = [];
        const tilesInfront = [];

        tiles.forEach((item) => {
            const isBehind = Isometric.isTileBehindBlock(item.pos.x, item.pos.y, targetX, targetY);
            if (isBehind) {
                tilesBehind.push(item.tileClip);
            } else {
                tilesInfront.push(item.tileClip);
            }
        });

        // Xếp lại thứ tự vẽ trong layerTiles: Gạch hậu cảnh -> Khối hộp -> Gạch tiền cảnh
        tilesBehind.forEach((clip) => this._layerTiles.addChild(clip));
        this._layerTiles.addChild(blockClip);
        tilesInfront.forEach((clip) => this._layerTiles.addChild(clip));
    }

    // ==========================================
    // 2. QUẢN LÝ SÀN GẠCH VÀ MẶT NẠ BÓNG ĐỔ (TILES & SHADOW MASK)
    // ==========================================

    /**
     * Thêm một MovieClip ô sàn vào layerTiles.
     *
     * @param {createjs.DisplayObject} tileClip
     * @returns {void}
     */
    addTile(tileClip) {
        if (tileClip && (typeof tileClip.draw === "function" || tileClip instanceof createjs.DisplayObject)) {
            this._layerTiles.addChild(tileClip);
        }
    }

    /**
     * Tạo mặt nạ đa giác đổ bóng isometric dựa trên danh sách các ô sàn có thực và vững chắc trên bàn cờ.
     * Tác dụng: Giới hạn bóng đổ của khối hộp chỉ xuất hiện trên bề mặt các ô gạch kiên cố,
     * ngăn chặn bóng bị vẽ tràn ra ngoài không gian vực thẳm hoặc trên các cây cầu đang mở.
     *
     * @param {Map<string, { type: string, x: number, y: number, isPassable: boolean }>} tilesMap - Bảng thông tin các ô sàn.
     * @returns {void}
     */
    updateShadowMask(tilesMap) {
        this.removeShadowMask();

        const gfx = this._shadowMask.graphics;
        gfx.beginFill("blue"); // Màu vẽ bất kỳ dùng định hình vùng mask cho CreateJS Shape

        // Duyệt toàn bộ lưới ma trận để vẽ các hình thoi isometric tương ứng cho từng ô sàn
        for (let y = 0; y < 10; y++) {
            for (let x = 14; x >= 0; x--) {
                const tile = tilesMap.get(`${x},${y}`);
                if (!tile) continue;

                // Ô đích 'e' là lỗ thủng nên không có mặt nạ bóng
                if (tile.type === "e") continue;

                // Cầu sắt đang mở/chưa hạ xuống thì không có mặt nạ bóng
                if (tile.isPassable === false) continue;

                // Vẽ hình thoi Isometric 4 đỉnh chuẩn xác bao quanh bề mặt ô gạch
                const p0 = Isometric.toScreen(x, y);
                const p1 = Isometric.toScreen(x, y - 1);
                const p2 = Isometric.toScreen(x + 1, y - 1);
                const p3 = Isometric.toScreen(x + 1, y);

                gfx.moveTo(p3[0], p3[1]);
                gfx.lineTo(p0[0], p0[1]);
                gfx.lineTo(p1[0], p1[1]);
                gfx.lineTo(p2[0], p2[1]);
                gfx.lineTo(p3[0], p3[1]);
            }
        }
    }

    /**
     * Xóa sạch mặt nạ đổ bóng.
     * Tác dụng: Làm bóng đổ biến mất ngay lập tức khi khối rơi vực hoặc kết thúc màn chơi.
     *
     * @returns {void}
     */
    removeShadowMask() {
        this._shadowMask.graphics.clear();
    }

    /**
     * Dọn sạch toàn bộ khối hộp và bóng đổ khỏi các layer.
     * Tác dụng: Đặt lại trạng thái hiển thị trước khi sinh khối mới.
     *
     * @returns {void}
     */
    clearBlocks() {
        this._layerBlocks.removeAllChildren();
        this._layerShadows.removeAllChildren();
        // Xóa cả các MovieClip khối nếu từng bị chèn tạm thời vào layerTiles trong pha ngã rơi
        if (this._layerTiles && Array.isArray(this._layerTiles.children)) {
            const tilesChildren = this._layerTiles.children.slice();
            tilesChildren.forEach((child) => {
                if (child && child.roll) {
                    this._layerTiles.removeChild(child);
                }
            });
        }
    }

    /**
     * Xóa sạch toàn bộ sàn gạch, bóng đổ và khối hộp khỏi Renderer.
     * Tác dụng: Dọn dẹp hoàn toàn không gian bàn cờ khi chuyển sang màn chơi mới.
     *
     * @returns {void}
     */
    clearBoard() {
        this.removeShadowMask();
        this.clearBlocks();
        this._layerTiles.removeAllChildren();
    }

    // ==========================================
    // 3. VÒNG LẶP RENDER & CẬP NHẬT RESPONSIVE
    // ==========================================

    /**
     * Cập nhật và vẽ lại toàn bộ CreateJS Stage lên thẻ Canvas.
     * Tác dụng: Thực thi chu kỳ vẽ trong vòng lặp game loop.
     *
     * @returns {void}
     */
    render() {
        this._stage.update();
    }

    /**
     * Xử lý co giãn responsive cho thẻ Canvas và Stage theo kích thước cửa sổ trình duyệt (hỗ trợ màn hình Retina/HiDPI).
     * Tác dụng: Đảm bảo hình ảnh luôn sắc nét, giữ đúng tỷ lệ khung hình 550x300 và không bị vỡ hạt trên màn hình độ phân giải cao.
     *
     * @param {HTMLCanvasElement} canvas - Thẻ canvas hiển thị game.
     * @param {HTMLElement} containerElement - Thẻ div bao bọc canvas.
     * @returns {void}
     */
    resize(canvas, containerElement) {
        if (!canvas || !containerElement) return;

        const w = Renderer.VIEWPORT.WIDTH;
        const h = Renderer.VIEWPORT.HEIGHT;

        const iw = containerElement.offsetWidth || window.innerWidth;
        const ih = containerElement.offsetHeight || window.innerHeight;

        const pRatio = window.devicePixelRatio || 1;
        const xRatio = iw / w;
        const yRatio = ih / h;
        const sRatio = Math.min(xRatio, yRatio);

        // Đặt kích thước buffer thực tế hỗ trợ màn hình Retina/HiDPI
        canvas.width = w * pRatio * sRatio;
        canvas.height = h * pRatio * sRatio;

        // Đặt kích thước hiển thị CSS
        const wpx = `${w * sRatio}px`;
        const hpx = `${h * sRatio}px`;
        canvas.style.width = wpx;
        canvas.style.height = hpx;

        const domOverlay = document.getElementById("dom_overlay_container");
        if (domOverlay) {
            domOverlay.style.width = wpx;
            domOverlay.style.height = hpx;
            domOverlay.style.display = "block";
        }

        // Đồng bộ tỷ lệ co giãn cho Stage của CreateJS
        this._stage.scaleX = pRatio * sRatio;
        this._stage.scaleY = pRatio * sRatio;

        this.render();
    }

    /**
     * Giải phóng toàn bộ tài nguyên và gỡ bỏ tất cả các layer khỏi Stage.
     * Tác dụng: Dọn dẹp sạch sẽ bộ nhớ đồ họa khi thoát hoặc tải lại trò chơi.
     *
     * @returns {void}
     */
    destroy() {
        this.clearBoard();
        this._layerBackground.removeAllChildren();
        this._layerControls.removeAllChildren();
        this._layerHelp.removeAllChildren();
        this._layerOverlay.removeAllChildren();
        this._screenMenu.removeAllChildren();
        this._screenInstructions.removeAllChildren();
        this._screenStageTitle.removeAllChildren();
        this._screenVictory.removeAllChildren();

        if (this._gameContainer.parent) {
            this._gameContainer.parent.removeChild(this._gameContainer);
        }
    }
}
