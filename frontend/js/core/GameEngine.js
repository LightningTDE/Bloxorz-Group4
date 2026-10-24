import { GAME_STATES } from "./StateMachine.js";
import { BLOCK_STATE } from "../utils/Constants.js";
import { AnimationHelper } from "../utils/AnimationHelper.js";
import { Board } from "../entities/Board.js";
import { Block } from "../entities/Block.js";
import { BlockView } from "../entities/BlockView.js";
import { TileView } from "../entities/TileView.js";

export class GameEngine {
    /**
     * Khởi tạo GameEngine với toàn bộ các dependencies cần thiết.
     *
     * @param {Object} modules
     * @param {import("./EventBus.js").EventBus} modules.eventBus
     * @param {import("./StateMachine.js").StateMachine} modules.stateMachine
     * @param {import("../data/LevelRepository.js").LevelRepository} modules.levelRepository
     * @param {import("../services/AudioService.js").AudioService} modules.audioService
     * @param {import("../services/InputService.js").InputService} modules.inputService
     * @param {import("../services/StorageService.js").StorageService} modules.storageService
     * @param {import("../services/TimerService.js").TimerService} modules.timerService
     * @param {import("../ui/Renderer.js").Renderer} modules.renderer
     * @param {import("../ui/Hud.js").Hud} modules.hud
     * @param {import("../ui/OnScreenControls.js").OnScreenControls} modules.onScreenControls
     * @param {import("../ui/PauseMenu.js").PauseMenu} modules.pauseMenu
     * @param {import("../ui/MainMenu.js").MainMenu} modules.mainMenu
     * @param {import("../ui/InstructionsModal.js").InstructionsModal} modules.instructionsModal
     * @param {import("../ui/VictoryModal.js").VictoryModal} modules.victoryModal
     */
    constructor(modules) {
        this._bus = modules.eventBus;
        this._fsm = modules.stateMachine;
        this._levels = modules.levelRepository;
        this._audio = modules.audioService;
        this._input = modules.inputService;
        this._storage = modules.storageService;
        this._timer = modules.timerService;
        this._renderer = modules.renderer;
        this._hud = modules.hud;
        this._controls = modules.onScreenControls;
        this._pauseMenu = modules.pauseMenu;
        this._mainMenu = modules.mainMenu;
        this._instructions = modules.instructionsModal;
        this._victory = modules.victoryModal;
        this._stageTitle = modules.stageTitle || null;

        /** @private @type {number} Màn chơi hiện tại (1..33) */
        this._currentLevelNumber = 1;

        /** @private @type {Object|null} Dữ liệu JSON của level hiện tại */
        this._currentLevelData = null;

        /** @private @type {Board} */
        this._board = new Board();

        /** @private @type {Block[]} Danh sách khối gạch domain (1 khối đầy đủ hoặc 2 khối nhỏ) */
        this._blocks = [];

        /** @private @type {BlockView[]} Danh sách View hiển thị tương ứng */
        this._blockViews = [];

        /** @private @type {number} Số nước đi trong level hiện tại */
        this._levelMoves = 0;

        /** @private @type {number} Tổng số nước đi tích lũy từ các level trước */
        this._totalMoves = 0;

        /** @private @type {number} Tổng số lần rơi vực */
        this._totalFalls = 0;

        /** @private @type {boolean} Cờ khóa chuyển cảnh (ngăn chặn duplicate spawn / race condition khi rơi vực) */
        this._isTransitioning = false;

        /** @private @type {Function|null} Hàm handler của Ticker */
        this._tickHandler = null;

        this._setupBindings();
    }

    /**
     * Khởi động engine và gắn kết các sự kiện từ UI, Input và EventBus.
     * @returns {void}
     */
    init() {
        if (this._stageTitle && typeof this._stageTitle.init === "function") {
            this._stageTitle.init();
        }

        // Gắn các layer tĩnh vào Renderer
        this._renderer.setUIComponents({
            background: this._hud.getBackgroundClip(),
            helpText: this._hud.getHelpTextClip(),
            controls: this._controls.getDisplayObject(),
            pauseMenu: this._pauseMenu.getDisplayObject(),
            mainMenu: this._mainMenu.getDisplayObject(),
            instructions: this._instructions.getDisplayObject(),
            victory: this._victory.getDisplayObject(),
            stageTitle: this._stageTitle ? this._stageTitle.getDisplayObject() : null
        });

        // Bắt đầu vòng lặp Ticker của CreateJS
        this._tickHandler = () => this._onTick();
        createjs.Ticker.addEventListener("tick", this._tickHandler);

        // Kích hoạt dịch vụ Input
        this._input.attach();

        // Mở màn hình Menu chính (hoạt cảnh intro logo kèm nhạc ambient lặp vô tận)
        this._fsm.transitionTo(GAME_STATES.MENU);
        this._renderer.showScreen("menu");
        this._mainMenu.updateResumeState();
        this._audio.playMusic(-1);
    }

    /**
     * Gắn kết toàn bộ các tương tác nút bấm và phản hồi từ các module UI/Input.
     * @private
     * @returns {void}
     */
    _setupBindings() {
        // 1. Tương tác từ MainMenu
        this._mainMenu.onStartNewGame(() => {
            this._totalMoves = 0;
            this._totalFalls = 0;
            this._currentLevelNumber = 1;
            this._fsm.transitionTo(GAME_STATES.INSTRUCTIONS);
            this._renderer.showScreen("instructions");
            this._instructions.show();
        });

        this._mainMenu.onResumeGame((savedLevel) => {
            this._totalMoves = 0;
            this._totalFalls = 0;
            this._currentLevelNumber = savedLevel;
            this._timer.setCurrentLevel(savedLevel);
            this._timer.resume();
            this.showStageTitle(this._currentLevelNumber, () => {
                this.startLevel(this._currentLevelNumber);
            });
        });

        this._mainMenu.onLoadPasscode((levelNumber) => {
            this._totalMoves = 0;
            this._totalFalls = 0;
            this._currentLevelNumber = levelNumber;
            this._timer.reset();
            this._timer.setCurrentLevel(levelNumber);
            this._timer.restartCurrentStage();
            this.showStageTitle(this._currentLevelNumber, () => {
                this.startLevel(this._currentLevelNumber);
            });
        });

        // 2. Tương tác từ InstructionsModal
        this._instructions.onStart(() => {
            this._timer.reset();
            this._timer.setCurrentLevel(1);
            this._timer.start();
            this.showStageTitle(1, () => {
                this.startLevel(1);
            });
        });

        this._instructions.onSkip(() => {
            this._timer.reset();
            this._timer.setCurrentLevel(1);
            this._timer.start();
            this.showStageTitle(1, () => {
                this.startLevel(1);
            });
        });

        this._instructions.onBack(() => {
            this._fsm.transitionTo(GAME_STATES.MENU);
            this._renderer.showScreen("menu");
            this._mainMenu.updateResumeState();
            this._mainMenu.skipIntro();
            this._audio.playMusic(-1);
        });

        // 3. Tương tác từ PauseMenu
        this._hud.onMenuClick(() => this.togglePause());

        this._pauseMenu.onResume(() => {
            if (this._fsm.is(GAME_STATES.PAUSED)) {
                this.togglePause();
            }
        });

        this._pauseMenu.onToggleSound(() => {
            this._audio.toggleSound();
        });

        this._pauseMenu.onQuit(() => {
            this.quitToMenu();
        });

        // 4. Tương tác từ VictoryModal
        this._victory.onReturnToMenu(() => {
            this.quitToMenu();
        });

        // 5. Tín hiệu bấm phím chuyển đổi khối nhỏ (Space)
        this._input.onSwitchFocus((newIndex) => {
            if (!this._fsm.is(GAME_STATES.PLAYING) || this._blocks.length < 2) return;

            const focusBlockView = this._blockViews[newIndex];
            if (focusBlockView) {
                focusBlockView.playSelectBrackets();
            }
        });

        // 6. Tín hiệu bấm phím R để restart màn chơi hiện tại
        this._input.onRestart(() => this.restartLevel());

        // 7. Cầu nối bắt các sự kiện từ Adobe Animate timeline của các màn hình (this.parent.gotoAndPlay)
        this._renderer.onScreenAction((screenName, action, target) => {
            if (target === "instructions") {
                if (this._fsm.is(GAME_STATES.MENU)) {
                    this._fsm.transitionTo(GAME_STATES.INSTRUCTIONS);
                    this._renderer.showScreen("instructions");
                    this._instructions.show();
                }
            } else if (target === "stagetitle") {
                if (screenName === "instructions" && this._fsm.is(GAME_STATES.INSTRUCTIONS)) {
                    this._timer.reset();
                    this._timer.setCurrentLevel(1);
                    this._timer.start();
                    this.showStageTitle(1, () => this.startLevel(1));
                } else if (screenName === "menu" && this._fsm.is(GAME_STATES.MENU)) {
                    const targetLvl = (typeof stage !== "undefined" && stage.levelNumber) ? stage.levelNumber : this._currentLevelNumber;
                    this._timer.setCurrentLevel(targetLvl);
                    this._timer.resume();
                    this.showStageTitle(targetLvl, () => this.startLevel(targetLvl));
                }
            } else if (target === "menu") {
                this.quitToMenu();
            }
        });
    }

    /**
     * Vòng lặp cập nhật trạng thái mỗi frame (CreateJS Ticker Loop tại 36 FPS).
     * Tác dụng:
     * - Điều khiển khối gạch đang được focus lăn liên tục khi người chơi giữ phím điều hướng.
     * - Cập nhật đồng hồ và thống kê số liệu trên PauseMenu khi đang tạm dừng.
     * - Gọi Renderer để vẽ toàn bộ các lớp đồ họa lên Canvas.
     * @private
     * @returns {void}
     */
    _onTick() {
        // 1. Nếu đang chơi: Cập nhật phím giữ liên tục cho khối đang focus
        if (this._fsm.is(GAME_STATES.PLAYING)) {
            const focusIndex = this._input.getFocusIndex();
            const activeDirection = this._input.getActiveDirection();
            const focusView = this._blockViews[focusIndex];

            if (focusView && activeDirection && focusView.isIdle()) {
                focusView.roll(activeDirection);
            }
        }

        // 2. Nếu đang tạm dừng: Cập nhật số liệu hiển thị trên PauseMenu
        if (this._fsm.is(GAME_STATES.PAUSED)) {
            this._pauseMenu.update({
                totalFalls: this._totalFalls,
                levelNumber: this._currentLevelNumber,
                digits: this._timer.getPauseMenuStats().digits
            });
        }

        // 3. Render Stage lên thẻ Canvas
        this._renderer.render();
    }

    // ==========================================
    // 1. QUẢN LÝ VÒNG ĐỜI MÀN CHƠI (LEVEL LIFECYCLE)
    // ==========================================

    /**
     * Hiển thị màn hình giới thiệu Stage (STAGE 01, STAGE 02...) với hoạt cảnh ánh kim (lib.LevelNumber).
     * Tác dụng:
     * - Chuyển đổi trạng thái FSM sang STAGE_INTRO và bật màn hình hiển thị tiêu đề màn chơi.
     * - Kích hoạt âm thanh vút (whoosh) và hiệu ứng kim loại lướt qua chữ STAGE cùng 2 chữ số cấp độ.
     * - Duy trì nhạc nền phát liên tục và gọi callback khi hoạt cảnh hoàn tất để nạp bàn cờ.
     *
     * @param {number} levelNumber Số màn chơi (1..33).
     * @param {() => void} [onComplete] Callback sau khi chạy xong hoạt cảnh để nạp bàn cờ.
     * @returns {void}
     */
    showStageTitle(levelNumber, onComplete) {
        this._currentLevelNumber = levelNumber;
        if (!this._fsm.is(GAME_STATES.STAGE_INTRO)) {
            this._fsm.transitionTo(GAME_STATES.STAGE_INTRO);
        }
        this._renderer.showScreen("stagetitle");

        // Duy trì nhạc nền Music.mp3 chạy liên tục trong suốt quá trình chơi màn chơi
        this._audio.playMusic(-1);

        if (this._stageTitle) {
            this._stageTitle.show(levelNumber, () => {
                if (typeof onComplete === "function") {
                    onComplete();
                } else {
                    this.startLevel(levelNumber);
                }
            });
        } else {
            if (typeof onComplete === "function") {
                onComplete();
            } else {
                this.startLevel(levelNumber);
            }
        }
    }

    /**
     * Khởi động lại màn chơi hiện tại khi người chơi nhấn phím 'R'.
     * @returns {void}
     */
    restartLevel() {
        // Chỉ cho phép restart khi đang ở trong màn chơi hoặc khi khối đang rơi
        if (
            !this._fsm.is(GAME_STATES.PLAYING) &&
            !this._fsm.is(GAME_STATES.PAUSED) &&
            !this._fsm.is(GAME_STATES.STAGE_INTRO) &&
            !this._fsm.is(GAME_STATES.LEVEL_LOSE)
        ) {
            return;
        }

        // Nếu đang tạm dừng PauseMenu, đóng menu pause trước
        if (this._fsm.is(GAME_STATES.PAUSED)) {
            this._pauseMenu.close();
        }

        // Phát âm thanh phản hồi khi bấm restart
        if (this._audio) {
            this._audio.playAction("click");
        }

        // Tải lại màn chơi hiện tại ngay lập tức
        this.startLevel(this._currentLevelNumber);
    }

    /**
     * Nạp và bắt đầu một màn chơi theo số thứ tự (1..33).
     * Tác dụng:
     * - Nạp layout ma trận và cấu hình công tắc/cửa/phân thân từ LevelRepository.
     * - Dọn dẹp các đối tượng đồ họa cũ và tái tạo toàn bộ ô gạch sàn (TileView).
     * - Cập nhật mặt nạ đổ bóng Isometric 8 hướng chiếu xuống sàn.
     * - Cấu hình HUD (mã passcode, số bước đi) và phím ảo cảm ứng (ẩn/hiện nút Space nếu có phân thân).
     * - Chờ hoạt cảnh mở màn của HUD hoàn tất trước khi sinh khối gạch ban đầu và kích hoạt nhận phím.
     *
     * @param {number} levelNumber Số màn chơi cần nạp (1..33).
     * @returns {Promise<void>}
     */
    async startLevel(levelNumber) {
        this._isTransitioning = false;
        this._currentLevelNumber = levelNumber;
        this._timer.setCurrentLevel(levelNumber);
        if (!this._fsm.is(GAME_STATES.STAGE_INTRO)) {
            this._fsm.transitionTo(GAME_STATES.STAGE_INTRO);
        }
        this._renderer.showScreen("game");

        // Duy trì nhạc nền Music.mp3 chạy liên tục trong quá trình chơi màn chơi
        this._audio.playMusic(-1);

        // 1. Nạp dữ liệu JSON từ Repository
        this._currentLevelData = await this._levels.getLevel(this._currentLevelNumber);
        if (!this._currentLevelData) {
            console.error(`[GameEngine] Không tìm thấy dữ liệu cho level ${this._currentLevelNumber}`);
            return;
        }

        // 2. Dọn sạch bàn cờ cũ
        this._clearLevel();

        // 3. Khởi tạo sàn gạch và công tắc
        this._board.initFromLevelData(this._currentLevelData, (type, x, y) => {
            const tileClip = (typeof window !== "undefined" && window.lib && typeof window.lib.Tile === "function")
                ? new window.lib.Tile()
                : new createjs.MovieClip();
            const view = new TileView(tileClip, type, x, y, (isPassable) => {
                if (!isPassable) {
                    this._checkAllBlocksLand();
                }
            });
            this._renderer.addTile(view.getDisplayObject());
            return view;
        });

        // 4. Tạo mặt nạ đổ bóng Isometric
        this._renderer.updateShadowMask(this._board.getTilesMap());

        // 5. Cập nhật HUD & phím ảo cảm ứng
        const hasSplits = Boolean(this._board && this._board.hasSplitSwitch);
        this._controls.setupForLevel(hasSplits);

        this._hud.initLevel({
            levelNumber: this._currentLevelNumber,
            levelCode: this._currentLevelData.code,
            totalMoves: this._totalMoves,
            onReady: () => {
                // Kích hoạt khi frame 28 của background hoàn thành: Sinh khối gạch ra sàn
                this._spawnInitialBlock(this._currentLevelData.start);
                this._fsm.transitionTo(GAME_STATES.PLAYING);
                this._input.setTrapKeys(true);
            }
        });
    }

    /**
     * Sinh khối gạch ban đầu tại tọa độ xuất phát ở tư thế đứng thẳng (UP).
     * Tác dụng:
     * - Dọn dẹp triệt để các thực thể khối cũ trên Renderer để chống duplicate.
     * - Khởi tạo Model Block (kích thước chuẩn 1x1x2) và BlockView tương ứng.
     * - Đăng ký callback lật khối (onStepMove) để kết nối vật lý và va chạm.
     * - Reset chỉ mục focus điều khiển và phát hoạt cảnh tiếp đất ban đầu.
     *
     * @private
     * @param {[number, number]} startCoord Tọa độ xuất phát [x, y] trên lưới ma trận.
     * @returns {void}
     */
    _spawnInitialBlock(startCoord) {
        // Dọn sạch toàn bộ block cũ và layer blocks trước khi sinh khối mới (ngăn chặn triệt để lỗi duplicate block)
        this._blockViews.forEach((v) => v.destroy());
        this._renderer.clearBlocks();
        this._blocks = [];
        this._blockViews = [];

        const [startX, startY] = startCoord;
        const block = new Block({ x: startX, y: startY, state: BLOCK_STATE.UP });

        const blockView = new BlockView({
            block: block,
            x: startX,
            y: startY,
            onStepMove: (axis, change, nextPosition) => {
                this._handleBlockStep(block, blockView, axis, change, nextPosition);
            }
        });
        block.attachView(blockView);

        this._blocks = [block];
        this._blockViews = [blockView];
        this._input.reset();

        this._renderer.addBlock(blockView.getBlockClip(), blockView.getShadowClip());
        blockView.land();
    }

    // ==========================================
    // 2. VẬT LÝ DI CHUYỂN & VA CHẠM (MOVEMENT & LANDING)
    // ==========================================

    /**
     * Xử lý vật lý và tương tác môi trường khi một khối gạch hoàn thành 1 bước lật trên timeline.
     * Tác dụng:
     * - Đồng bộ tọa độ và tư thế hình học giữa View và Model Block.
     * - Tăng biến đếm số nước đi của màn chơi và cập nhật HUD.
     * - Kiểm tra tính toàn vẹn tiếp đất trên lưới sàn (checkLand):
     *   + Nếu rơi vực hoặc hụt mép sàn: kích hoạt chuỗi rơi tự do gia tốc (_handleBlockFall).
     *   + Nếu tiếp đất an toàn trên ô đặc biệt: kích hoạt công tắc (Soft/Hard/Split Switch) hoặc hố đích (Exit).
     *   + Xử lý sàn gạch mỏng màu cam (Fragile Tile): sụp đổ nếu khối gạch đứng thẳng (UP).
     *   + Xử lý cơ chế hợp khối (Rejoin) khi 2 khối nhỏ đứng liền kề cạnh nhau.
     *
     * @private
     * @param {Block} block Model khối gạch di chuyển.
     * @param {BlockView} blockView View hiển thị của khối gạch.
     * @param {"x"|"y"} axis Trục di chuyển ("x" hoặc "y").
     * @param {number} change Bước nhảy tọa độ (+1, -1, +2, -2).
     * @param {string} nextPosition Tư thế tiếp đất ("up", "far", "long").
     * @returns {void}
     */
    _handleBlockStep(block, blockView, axis, change, nextPosition) {
        // 0. Đồng bộ Model Block với View Block (tránh lệch tọa độ và trạng thái)
        block.x = blockView.getX();
        block.y = blockView.getY();
        block.state = nextPosition;

        // 1. Cập nhật số nước đi
        this._levelMoves++;
        this._hud.updateMoves(this._levelMoves, this._totalMoves);

        // 2. Tính toán hướng lăn
        const rollDir = axis === "x" ? (change > 0 ? "right" : "left") : (change > 0 ? "down" : "up");

        // 3. Kiểm tra tiếp đất hoặc rơi vực
        const landing = this._board.checkLand(block, rollDir);

        if (!landing.safe) {
            if (landing.fallType === "square") {
                this._handleBlockFall(block, blockView, "square");
            } else {
                this._handleBlockFall(block, blockView, landing.fallDirection);
            }
            return;
        }

        // Khối đứng thẳng rơi lọt vào ô đích 'e' -> Thắng màn
        if (landing.win) {
            this._handleLevelWin(blockView);
            return;
        }

        // Phát âm thanh chất liệu sàn (chống lặp tiếng qua AudioService)
        if (landing.soundVariation) {
            this._audio.play("clonk", landing.soundVariation, landing.variations || 0);
        }

        // Kích hoạt lật công tắc cầu
        if (landing.switchDoors && landing.linkedDoors) {
            this._board.switchDoors(landing.linkedDoors);
            this._renderer.updateShadowMask(this._board.getTilesMap());

            // Kiểm tra xem có khối nào (đặc biệt là khối đang đứng yên) bị mất sàn do cầu đóng không
            this._checkAllBlocksLand();
            if (this._isTransitioning) return;
        }

        // Kích hoạt ô phân thân chia làm 2 khối nhỏ
        if (landing.split && landing.linkedSplits) {
            this._handleBlockSplit(block, blockView, landing.linkedSplits);
            return;
        }

        // Nếu là 2 khối nhỏ: Kiểm tra xem 2 khối có nằm cạnh nhau để hợp nhất không
        if (this._blocks.length === 2) {
            const rejoinData = this._blocks[0].checkRejoinWith(this._blocks[1]);
            if (rejoinData) {
                this._handleBlockRejoin(rejoinData);
                return;
            }

            // Sắp xếp lại chiều sâu giữa 2 khối nhỏ
            this._renderer.sortBlockDepths(
                this._blocks.map((b, idx) => ({
                    blockClip: this._blockViews[idx].getBlockClip(),
                    shadowClip: this._blockViews[idx].getShadowClip(),
                    pos: { x: b.x, y: b.y },
                    depthNudge: this._blockViews[idx].getDepthNudge()
                }))
            );
        }
    }

    // ==========================================
    // 3. PHÂN THÂN & HỢP KHỐI (SPLIT & REJOIN)
    // ==========================================

    /**
     * Phân thân 1 khối gạch đầy đủ (1x1x2) thành 2 khối lập phương nhỏ (1x1x1) độc lập.
     * Tác dụng:
     * - Khóa nhận phím điều khiển và phát hoạt cảnh nứt tách (split animation) trên khối đầy đủ.
     * - Đợi 10 frame hoạt ảnh phân tách (~278ms tại 36 FPS) để khớp với âm thanh và visual.
     * - Hủy khối lớn, sinh 2 thực thể Block 1x1 tại 2 tọa độ đích được chỉ định bởi công tắc Split.
     * - Kích hoạt hiệu ứng xuất hiện (spawn animation) và khung ngắm chọn (select brackets) cho khối 1.
     * - Cập nhật bàn phím ảo hiển thị nút Space để cho phép chuyển đổi qua lại giữa 2 khối nhỏ.
     *
     * @private
     * @param {Block} fullBlock Thực thể khối đầy đủ đang kích hoạt nút phân thân.
     * @param {BlockView} fullBlockView Đối tượng hiển thị của khối đầy đủ.
     * @param {Array<number>|Array<[number, number]>} splitCoords 2 tọa độ xuất phát của 2 khối nhỏ.
     * @returns {void}
     */
    _handleBlockSplit(fullBlock, fullBlockView, splitCoords) {
        if (!splitCoords) return;

        // 1. Phân giải tọa độ của 2 khối nhỏ (hỗ trợ cả mảng phẳng [x1, y1, x2, y2] và mảng cặp [[x1, y1], [x2, y2]])
        let p1, p2;
        if (Array.isArray(splitCoords[0])) {
            p1 = { x: splitCoords[0][0], y: splitCoords[0][1] };
            p2 = { x: splitCoords[1][0], y: splitCoords[1][1] };
        } else {
            p1 = { x: splitCoords[0], y: splitCoords[1] };
            p2 = { x: splitCoords[2], y: splitCoords[3] };
        }

        // 2. Khóa nhận phím lăn trên khối hiện tại và phát hoạt cảnh phân tách
        const fullClip = fullBlockView.getBlockClip();
        if (fullClip && fullClip.roll) {
            fullClip.roll.idle = false;
        }
        if (fullClip && typeof fullClip.gotoAndPlay === "function") {
            fullClip.gotoAndPlay("split");
        }

        // 3. Sau 10 frames hoạt ảnh tách khối (~278ms tại 36 FPS), sinh 2 khối nhỏ độc lập
        const delayMs = Math.round(10 * (1000 / 36)); // ~278ms tại 36 FPS
        setTimeout(() => {
            if (!this._fsm.is(GAME_STATES.PLAYING)) return;

            // Gỡ bỏ khối cũ
            this._renderer.removeBlock(fullBlockView.getBlockClip(), fullBlockView.getShadowClip());
            fullBlockView.destroy();

            // Khởi tạo 2 thực thể Block 1x1 tại đúng tọa độ đích
            const b1 = new Block({ x: p1.x, y: p1.y, state: BLOCK_STATE.UP, isSmall: true });
            const b2 = new Block({ x: p2.x, y: p2.y, state: BLOCK_STATE.UP, isSmall: true });

            const v1 = new BlockView({
                block: b1,
                x: p1.x,
                y: p1.y,
                isSmall: true,
                onStepMove: (axis, change, nextPos) => this._handleBlockStep(b1, v1, axis, change, nextPos)
            });

            const v2 = new BlockView({
                block: b2,
                x: p2.x,
                y: p2.y,
                isSmall: true,
                onStepMove: (axis, change, nextPos) => this._handleBlockStep(b2, v2, axis, change, nextPos)
            });

            b1.attachView(v1);
            b2.attachView(v2);

            this._blocks = [b1, b2];
            this._blockViews = [v1, v2];
            this._input.setFocusIndex(0);

            // Đưa 2 khối nhỏ lên màn hình và kích hoạt hoạt cảnh spawn + select
            this._renderer.addBlock(v1.getBlockClip(), v1.getShadowClip());
            this._renderer.addBlock(v2.getBlockClip(), v2.getShadowClip());

            v1.playSpawnAnimation();
            v2.playSpawnAnimation();
            v1.playSelectBrackets();

            this._controls.showSplit();
        }, delayMs);
    }

    /**
     * Hợp nhất 2 khối lập phương nhỏ 1x1 thành 1 khối gạch hoàn chỉnh 1x1x2 khi đứng cạnh nhau.
     * Tác dụng:
     * - Loại bỏ 2 khối nhỏ khỏi hệ thống Renderer và giải phóng tài nguyên view.
     * - Tạo thực thể Block lớn tại tọa độ và hướng ghép nối mới ("up", "far", "long").
     * - Phát âm thanh cơ khí chốt khóa (Latch sound) báo hiệu hợp khối thành công.
     * - Chuyển phím ảo cảm ứng về chế độ chuẩn (ẩn nút chuyển đổi Space).
     *
     * @private
     * @param {{ position?: string, orientation?: string, x: number, y: number }} rejoinData Dữ liệu vị trí và tư thế sau khi hợp nhất.
     * @returns {void}
     */
    _handleBlockRejoin(rejoinData) {
        const position = rejoinData.position || rejoinData.orientation || BLOCK_STATE.UP;
        const { x, y } = rejoinData;

        // Dọn 2 khối nhỏ
        this._blockViews.forEach((v) => {
            this._renderer.removeBlock(v.getBlockClip(), v.getShadowClip());
            v.destroy();
        });

        // Tạo lại 1 khối lớn nguyên vẹn
        const fullBlock = new Block({ x, y, state: position, isSmall: false });
        const fullView = new BlockView({
            block: fullBlock,
            x,
            y,
            isSmall: false,
            initialPosition: position,
            onStepMove: (axis, change, nextPos) => this._handleBlockStep(fullBlock, fullView, axis, change, nextPos)
        });

        fullBlock.attachView(fullView);

        this._blocks = [fullBlock];
        this._blockViews = [fullView];
        this._input.reset();

        this._renderer.addBlock(fullView.getBlockClip(), fullView.getShadowClip());
        this._audio.playAction("join"); // Tiếng Latch khi nhập khối
        this._controls.showStandard();
    }

    /**
     * Kiểm tra tính an toàn tiếp đất của tất cả các khối trên bàn chơi (dùng khi cầu đóng hoặc sàn thay đổi).
     * @private
     * @returns {void}
     */
    _checkAllBlocksLand() {
        if (!this._fsm.is(GAME_STATES.PLAYING) || this._isTransitioning) return;

        for (let i = 0; i < this._blocks.length; i++) {
            const b = this._blocks[i];
            const v = this._blockViews[i];
            if (!b || !v) continue;

            const check = this._board.checkLand(b, "down");
            if (!check.safe) {
                const fallDir = check.fallType === "square" ? "square" : (check.fallDirection || "down");
                this._handleBlockFall(b, v, fallDir);
                return;
            }
        }
    }

    // ==========================================
    // 4. RƠI VỰC & CHIẾN THẮNG (FALL & WIN)
    // ==========================================

    /**
     * Xử lý chuỗi sự kiện khi khối gạch trượt mép hoặc tiếp đất hụt và rơi xuống không gian vực sâu.
     * Tác dụng:
     * - Chuyển trạng thái FSM sang LEVEL_LOSE và khóa phím điều khiển.
     * - Nếu đang phân thân (2 khối), khối còn lại sẽ phát hoạt cảnh mờ nhạt (phase animation).
     * - Tái sắp xếp chiều sâu (Depth Sorting) trong Renderer để khối rơi lọt ra sau các ô sàn tiền cảnh.
     * - Áp dụng gia tốc trọng lực tự do (AnimationHelper.playFall) cho khối gạch.
     * - Kích hoạt hiệu ứng kết thúc thua màn (_transitionOutLose) khi khối hoàn thành quỹ đạo rơi.
     *
     * @private
     * @param {Block} block Thực thể khối bị trượt chân rơi vực.
     * @param {BlockView} blockView Đối tượng hiển thị của khối rơi.
     * @param {string} direction Hướng rơi ("up", "down", "left", "right", "square").
     * @returns {void}
     */
    _handleBlockFall(block, blockView, direction) {
        if (this._isTransitioning) return;
        this._isTransitioning = true;

        this._fsm.transitionTo(GAME_STATES.LEVEL_LOSE);
        this._input.setTrapKeys(false);

        // Khóa MovieClip roll để không nhận lệnh lăn tiếp khi đang rơi
        const clip = blockView.getBlockClip();
        if (clip && clip.roll) {
            clip.roll.idle = false;
        }

        // Nếu đang có 2 khối nhỏ, khối còn lại phát hoạt cảnh mờ "phase"
        if (this._blockViews.length > 1) {
            this._blockViews
                .filter((v) => v !== blockView)
                .forEach((v) => v.playPhaseAnimation());
        }

        // Tái sắp xếp chiều sâu để khối rơi khuất ra sau các ô gạch tiền cảnh
        this._renderer.sortBlockDepthAmongTiles({
            blockClip: blockView.getBlockClip(),
            shadowClip: blockView.getShadowClip(),
            pos: { x: block.x, y: block.y },
            direction: direction,
            position: block.state,
            tiles: this._board.getAllTileViewItems()
        });

        // Kích hoạt hoạt cảnh rơi trọng lực gia tốc
        const isSquare = direction === "square";
        const axis = isSquare ? null : (direction === "left" || direction === "right" ? "x" : "y");
        const speed = isSquare ? null : (direction === "down" || direction === "right" ? 1 : -1);

        blockView.playFall(direction, block.state);

        AnimationHelper.playFall(blockView.getBlockClip(), axis, speed, () => {
            this._transitionOutLose();
        });
    }

    /**
     * Hoạt cảnh kết thúc thua màn và chuẩn bị chơi lại.
     * Tác dụng:
     * - Tăng biến đếm tổng số lần rơi vực (totalFalls).
     * - Phát hiệu ứng âm thanh rơi vực đặc trưng.
     * - Thu hồi HUD, ẩn bàn phím ảo và dỡ bỏ mặt nạ bóng đổ.
     * - Làm toàn bộ các ô sàn gạch rơi tự do ngẫu nhiên theo trọng lực.
     * - Sau 30 frame (~830ms), tự động nạp lại màn chơi hiện tại để tiếp tục thử thách.
     *
     * @private
     * @returns {void}
     */
    _transitionOutLose() {
        this._totalFalls++;
        this._audio.playOutcome("lose"); // Tiếng mech5wav rơi vực

        this._hud.playTransitionOut();
        this._controls.hide();
        this._renderer.removeShadowMask();

        // Rơi toàn bộ sàn gạch
        const allTileClips = this._board.getAllTileClips();
        allTileClips.forEach((tileClip) => {
            const delay = Math.floor(Math.random() * 5);
            AnimationHelper.wait(delay, () => {
                AnimationHelper.playFall(tileClip);
            });
        });

        // Sau 30 frame (~830ms), nạp lại màn chơi hiện tại (nếu chưa bị restart trước đó)
        AnimationHelper.wait(30, () => {
            if (this._fsm.is(GAME_STATES.LEVEL_LOSE)) {
                this.startLevel(this._currentLevelNumber);
            }
        });
    }

    /**
     * Xử lý chuỗi sự kiện khi khối gạch hoàn thành màn chơi (đứng thẳng UP lọt vào ô đích 'e').
     * Tác dụng:
     * - Chuyển trạng thái FSM sang LEVEL_WIN và khóa phím điều khiển.
     * - Phát hoạt cảnh chìm sâu vào hố đích (playEndAnimation) trên khối gạch.
     * - Đợi 20 frame (~550ms) khối lọt hẳn vào lòng hố trước khi kích hoạt hiệu ứng chuyển màn.
     *
     * @private
     * @param {BlockView} blockView Khối gạch lọt vào hố đích.
     * @returns {void}
     */
    _handleLevelWin(blockView) {
        if (this._isTransitioning) return;
        this._isTransitioning = true;

        this._fsm.transitionTo(GAME_STATES.LEVEL_WIN);
        this._input.setTrapKeys(false);

        // Khóa MovieClip roll để không nhận lệnh lăn tiếp khi đang lọt hố
        const clip = blockView.getBlockClip();
        if (clip && clip.roll) {
            clip.roll.idle = false;
        }

        blockView.playEndAnimation();

        // Chờ 20 frame (~550ms) khối chìm vào hố rồi bắt đầu chuyển màn
        AnimationHelper.wait(20, () => {
            this._transitionOutWin(blockView.getX(), blockView.getY());
        });
    }

    /**
     * Hoạt cảnh kết thúc chiến thắng màn chơi và chuyển tiếp sang màn tiếp theo.
     * Tác dụng:
     * - Phát âm thanh chuông chiến thắng (Stage Win sound).
     * - Thu hồi HUD, ẩn bàn phím ảo và dỡ bỏ mặt nạ bóng đổ.
     * - Tạo hiệu ứng lốc xoáy (Swirl): toàn bộ các ô sàn gạch bị hút xoáy ly tâm về tâm ô đích (exitX, exitY).
     * - Ghi nhận thời gian hoàn thành màn chơi vào TimerService cho bảng Speedrun.
     * - Tăng cấp độ màn chơi, lưu tiến trình mở khóa vào StorageService.
     * - Nếu vượt qua màn 33: Hiển thị màn hình Phá đảo (Victory Screen) cùng tổng kết số bước, số lần rơi, thời gian.
     * - Nếu chưa phá đảo: Hiển thị STAGE Title giới thiệu màn kế tiếp rồi bắt đầu chơi.
     *
     * @private
     * @param {number} exitX Tọa độ X của ô đích để làm tâm lốc xoáy.
     * @param {number} exitY Tọa độ Y của ô đích để làm tâm lốc xoáy.
     * @returns {void}
     */
    _transitionOutWin(exitX, exitY) {
        this._audio.playOutcome("win"); // Tiếng chuông blox003wav chiến thắng

        this._hud.playTransitionOut();
        this._controls.hide();
        this._renderer.removeShadowMask();

        // Toàn bộ ô gạch bị hút xoáy vào ô đích exitX, exitY
        const allTileClips = this._board.getAllTileClips();
        allTileClips.forEach((tileClip) => {
            const delay = Math.floor(Math.random() * 5);
            AnimationHelper.wait(delay, () => {
                AnimationHelper.playSwirl(tileClip, exitX, exitY);
            });
        });

        // Sau 30 frame (~830ms): Cập nhật tiến trình lưu và nạp màn tiếp theo
        AnimationHelper.wait(30, () => {
            this._totalMoves += this._levelMoves;
            this._levelMoves = 0;
            this._timer.recordStageCompletion(this._currentLevelNumber);

            this._currentLevelNumber++;
            this._storage.saveLevel(this._currentLevelNumber);
            if (typeof window !== "undefined" && window.stage) {
                if (window.stage.localSave) window.stage.localSave.save(this._currentLevelNumber);
                window.stage.levelNumber = this._currentLevelNumber;
            }
            this._timer.setCurrentLevel(this._currentLevelNumber);
            if (typeof window !== "undefined" && typeof window.setCurrentLevel === "function") {
                window.setCurrentLevel(this._currentLevelNumber);
            }

            // Nếu đã vượt qua màn 33 -> Hiển thị màn hình Phá đảo (Victory)
            if (this._currentLevelNumber > 33) {
                this._fsm.transitionTo(GAME_STATES.VICTORY);
                this._renderer.showScreen("victory");
                this._clearLevel();
                this._victory.show({
                    totalMoves: this._totalMoves,
                    totalFalls: this._totalFalls,
                    digits: this._timer.getPauseMenuStats().digits
                });
            } else {
                // Hiển thị STAGE Title của màn tiếp theo (STAGE 02, 03...) rồi vào chơi (timer tiếp tục chạy liên tục)
                this.showStageTitle(this._currentLevelNumber, () => {
                    this.startLevel(this._currentLevelNumber);
                });
            }
        });
    }

    // ==========================================
    // 5. TẠM DỪNG & ĐIỀU HƯỚNG (PAUSE & NAVIGATION)
    // ==========================================

    /**
     * Bật hoặc tắt trạng thái Tạm dừng (Pause / Resume).
     * @returns {void}
     */
    togglePause() {
        if (this._fsm.is(GAME_STATES.PLAYING)) {
            this._fsm.transitionTo(GAME_STATES.PAUSED);
            this._timer.pause();
            this._input.setTrapKeys(false);
            this._pauseMenu.open();
        } else if (this._fsm.is(GAME_STATES.PAUSED)) {
            this._fsm.transitionTo(GAME_STATES.PLAYING);
            this._timer.resume();
            this._input.setTrapKeys(true);
            this._pauseMenu.close();
        }
    }

    /**
     * Thoát khỏi màn chơi đang diễn ra và quay trở về Menu chính.
     * Tác dụng:
     * - Dừng đồng hồ tính giờ màn chơi.
     * - Dọn dẹp sạch sẽ toàn bộ đối tượng đồ họa của màn chơi hiện tại.
     * - Chuyển trạng thái FSM về MENU và kích hoạt hiển thị màn hình Menu chính.
     * - Cập nhật trạng thái nút "RESUME GAME" (nếu có dữ liệu lưu trước đó) và chuyển thẳng tới trạng thái sẵn sàng.
     *
     * @returns {void}
     */
    quitToMenu() {
        this._isTransitioning = false;
        this._timer.pause();
        this._clearLevel();
        this._fsm.transitionTo(GAME_STATES.MENU);
        this._renderer.showScreen("menu");

        this._mainMenu.updateResumeState();
        this._mainMenu.skipIntro();
        this._audio.playMusic(-1);
    }

    /**
     * Kiểm tra trạng thái hiện tại có đang ở Menu chính hay không.
     * @returns {boolean}
     */
    isMenu() {
        return this._fsm.is(GAME_STATES.MENU);
    }

    /**
     * Kích hoạt lại nhạc nền Menu nếu đang ở Menu và nhạc chưa phát.
     * @returns {void}
     */
    resumeMenuMusic() {
        if (this.isMenu() && !this._audio.isMusicPlaying()) {
            this._audio.playMusic(-1);
        }
    }

    /**
     * Dọn sạch toàn bộ các thực thể bàn cờ và khối gạch.
     * @private
     * @returns {void}
     */
    _clearLevel() {
        this._blockViews.forEach((v) => v.destroy());
        this._blocks = [];
        this._blockViews = [];
        this._board.clear();
        this._renderer.clearBoard();
        this._levelMoves = 0;
    }

    // =========================================================================
    // 6. TÍCH HỢP VỚI HỆ THỐNG GIẢI THUẬT (AI SOLVER INTEGRATION)
    // =========================================================================

    /**
     * Thu thập trạng thái hiện tại của khối gạch và các cây cầu trên sàn.
     * Tác dụng: Đóng gói dữ liệu gửi về Backend để giải tiếp từ vị trí hiện tại.
     *
     * @returns {Object|null} Payload trạng thái tương thích CurrentStateSchema.
     */
    getCurrentState() {
        if (!this._blocks || this._blocks.length === 0) return null;
        const focusIndex = this._input ? this._input.getFocusIndex() : 0;
        const activeBlock = this._blocks[focusIndex] || this._blocks[0];

        return {
            x: activeBlock.x,
            y: activeBlock.y,
            position: activeBlock.state || "up",
            doors_state: this._board.getDoorsState(),
            is_split: this._blocks.length > 1,
            blocks: this._blocks.map((b) => [b.x, b.y]),
            active_index: focusIndex
        };
    }

    /**
     * Lấy số thứ tự màn chơi hiện tại.
     * @returns {number}
     */
    getCurrentLevelNumber() {
        return this._currentLevelNumber;
    }

    /**
     * Kiểm tra khối gạch hiện tại có đang đứng yên (sẵn sàng lăn bước tiếp theo) hay không.
     * @returns {boolean}
     */
    isCurrentBlockIdle() {
        const focusIndex = this._input ? this._input.getFocusIndex() : 0;
        const focusView = this._blockViews[focusIndex];
        return Boolean(focusView && focusView.isIdle());
    }

    /**
     * Thực thi một bước đi từ AI Solver ("up", "down", "left", "right", "swap").
     * @param {string} action
     * @returns {boolean} True nếu lệnh lăn đã được phát đi thành công.
     */
    executeAction(action) {
        if (!action) return false;
        if (action === "swap") {
            if (this._input) this._input.switchFocus();
            return true;
        }
        const focusIndex = this._input ? this._input.getFocusIndex() : 0;
        const focusView = this._blockViews[focusIndex];
        if (focusView && focusView.isIdle()) {
            focusView.roll(action);
            return true;
        }
        return false;
    }

    /**
     * Khóa hoặc mở khóa bàn phím và phím ảo của người chơi trong quá trình Auto Solve.
     * @param {boolean} locked True để khóa (chặn người chơi), False để mở lại.
     * @returns {void}
     */
    lockPlayerInput(locked) {
        if (this._input) {
            this._input.setTrapKeys(!locked);
        }
        if (this._controls) {
            if (locked) {
                this._controls.hide();
            } else {
                const hasSplits = Boolean(this._board && this._board.hasSplitSwitch);
                this._controls.setupForLevel(hasSplits);
                if (this._blocks.length > 1) {
                    this._controls.showSplit();
                } else {
                    this._controls.showStandard();
                }
            }
        }
    }

    /**
     * Dọn dẹp tài nguyên khi hủy hoàn toàn GameEngine.
     * @returns {void}
     */
    destroy() {
        if (this._tickHandler) {
            createjs.Ticker.removeEventListener("tick", this._tickHandler);
            this._tickHandler = null;
        }

        this._clearLevel();
        this._input.detach();
        this._board.clear();
        this._renderer.destroy();
        this._hud.destroy();
        this._controls.destroy();
        this._pauseMenu.destroy();
        this._mainMenu.destroy();
        this._instructions.destroy();
        this._victory.destroy();
        if (this._stageTitle && typeof this._stageTitle.destroy === "function") {
            this._stageTitle.destroy();
        }
        this._fsm.destroy();
        this._bus.clear();
    }
}