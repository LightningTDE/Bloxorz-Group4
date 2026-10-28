/**
 * @file SolverService.js
 * Dịch vụ kết nối và điều phối giữa Frontend JavaScript và Backend Python API.
 *
 * @description
 * 1. Đóng gói trạng thái hiện tại (CurrentState) gửi về API /api/v1/solve hoặc /api/v1/hint.
 * 2. Quản lý trạng thái giải tự động (Auto Solve): khóa input người chơi, thực thi chuỗi nước đi từng bước.
 * 3. Hỗ trợ tính năng Stop: dừng giải giữa chừng, mở lại phím để người chơi tự chơi tiếp,
 *    và khi bấm Solve lại sẽ tự động lấy vị trí mới để giải tiếp mà không bị reset về đầu.
 */

export class SolverService {
    /**
     * @param {Object} options
     * @param {string} [options.baseUrl] - Đường dẫn gốc của Backend API (mặc định http://localhost:8000).
     * @param {Object} [options.gameEngine] - Thể hiện của GameEngine điều khiển bàn chơi.
     * @param {Function} [options.onStatusChange] - Callback thông báo thay đổi trạng thái UI.
     * @param {Function} [options.onMetricsUpdate] - Callback cập nhật số liệu hiệu năng giải thuật.
     */
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || "http://localhost:8000";
        this.engine = options.gameEngine || null;
        this.onStatusChange = options.onStatusChange || null;
        this.onMetricsUpdate = options.onMetricsUpdate || null;

        this.isSolving = false;
        this._stepTimer = null;
        this._currentActions = [];
        this._actionIndex = 0;
    }

    /**
     * @public
     * @api
     * Gắn kết GameEngine vào dịch vụ sau khi engine được khởi tạo.
     * @param {Object} engine
     * @returns {void}
     */
    // noinspection JSUnusedGlobalSymbols
    attachEngine(engine) {
        this.engine = engine;
    }

    /**
     * Thông báo cập nhật trạng thái lên giao diện người dùng.
     * @private
     * @param {string} statusText
     * @param {"idle"|"running"|"error"|"success"} [stateType="idle"]
     */
    _notifyStatus(statusText, stateType = "idle") {
        if (typeof this.onStatusChange === "function") {
            this.onStatusChange(statusText, stateType);
        }
    }

    /**
     * Bắt đầu tiến trình tự động giải màn chơi.
     *
     * @param {Object} [params]
     * @param {string} [params.algorithm="A*"] - Thuật toán ("A*", "BFS", "IDS", "UCS").
     * @param {string} [params.heuristic="orientation_aware_manhattan"] - Hàm heuristic ("orientation_aware_manhattan").
     * @returns {Promise<boolean>} True nếu tìm thấy và bắt đầu thực thi lời giải.
     */
    async startSolve(params = {}) {
        if (!this.engine) {
            console.warn("[SolverService] Chưa gắn kết GameEngine.");
            return false;
        }

        if (this.isSolving) {
            console.log("[SolverService] Đang trong quá trình giải tự động.");
            return false;
        }

        const algorithm = params.algorithm || "A*";
        const heuristic = params.heuristic || "orientation_aware_manhattan";
        const levelNumber = this.engine.getCurrentLevelNumber();
        const currentState = this.engine.getCurrentState();

        if (!currentState) {
            this._notifyStatus("Không xác định được vị trí khối gạch", "error");
            return false;
        }

        this._notifyStatus(`Đang tìm đường đi (${algorithm})...`, "running");

        // 1. Khóa toàn bộ nhận phím từ người chơi để không làm lệch tọa độ khi chuẩn bị giải
        this.isSolving = true;
        this.engine.lockPlayerInput(true);

        const payload = {
            level_number: levelNumber,
            algorithm: algorithm,
            heuristic: heuristic,
            timeout_sec: 60.0,
            current_state: currentState
        };

        try {
            const response = await fetch(`${this.baseUrl}/api/v1/solve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}));
                const errMsg = errData.message || `Lỗi HTTP ${response.status}`;
                this._notifyStatus(`Thất bại: ${errMsg}`, "error");
                this.stopSolve();
                return false;
            }

            const data = await response.json();

            // Cập nhật số liệu hiệu năng đo kiểm benchmark lên UI ngay khi bắt đầu giải
            if (data.metrics && typeof this.onMetricsUpdate === "function") {
                this.onMetricsUpdate({
                    algorithm: data.algorithm,
                    timeMs: data.metrics.search_time_ms,
                    memoryKb: data.metrics.memory_peak_kb,
                    nodes: data.metrics.expanded_nodes,
                    steps: data.step_count || (data.actions ? data.actions.length : 0)
                });
            }

            if (!data.success) {
                const failMsg = data.message || `[${data.algorithm}] Không tìm thấy lời giải.`;
                this._notifyStatus(failMsg, "error");
                this.stopSolve();
                return false;
            }

            if (!data.actions || data.actions.length === 0) {
                this._notifyStatus(`[${data.algorithm}] Khối đã ở đích hoặc không cần di chuyển thêm!`, "success");
                this.stopSolve();
                return true;
            }

            const timeStr = data.metrics ? `${data.metrics.search_time_ms.toFixed(1)}ms` : "";
            this._notifyStatus(`[${data.algorithm}] ${data.actions.length} bước (${timeStr}). Đang lăn...`, "running");

            // 2. Bắt đầu lăn khối theo chuỗi hành động nhận được từ backend
            this._currentActions = data.actions;
            this._actionIndex = 0;
            this._scheduleNextStep();

            return true;
        } catch (err) {
            console.error("[SolverService] Lỗi kết nối Backend API:", err);
            this._notifyStatus("Không thể kết nối đến máy chủ Python (http://localhost:8000).", "error");
            this.stopSolve();
            return false;
        }
    }

    /**
     * Lập lịch thực hiện bước di chuyển kế tiếp với hoạt cảnh mượt mà.
     * @private
     */
    _scheduleNextStep() {
        if (!this.isSolving) return;

        if (this._actionIndex >= this._currentActions.length) {
            this._notifyStatus("Đã hoàn thành toàn bộ các bước giải!", "success");
            this.stopSolve();
            return;
        }

        const action = this._currentActions[this._actionIndex];

        // Chờ khối đứng yên (isIdle) rồi mới kích hoạt bước lăn tiếp theo
        const checkIdleAndRoll = () => {
            if (!this.isSolving) return;

            if (this.engine.isCurrentBlockIdle()) {
                const executed = this.engine.executeAction(action);
                if (executed) {
                    this._actionIndex++;
                    // Khoảng nghỉ giữa các bước lật (~340ms) để khớp hoàn hảo với timeline của MovieClip
                    this._stepTimer = setTimeout(() => {
                        this._scheduleNextStep();
                    }, 340);
                    return;
                }
            }

            // Nếu khối chưa đứng yên, thử lại sau 30ms
            this._stepTimer = setTimeout(checkIdleAndRoll, 30);
        };

        checkIdleAndRoll();
    }

    /**
     * Dừng giải tự động ngay lập tức và mở lại quyền điều khiển cho người chơi.
     * @returns {void}
     */
    stopSolve() {
        this.isSolving = false;
        this._currentActions = [];
        this._actionIndex = 0;

        if (this._stepTimer) {
            clearTimeout(this._stepTimer);
            this._stepTimer = null;
        }

        // Mở lại bàn phím và phím ảo cho người chơi
        if (this.engine) {
            this.engine.lockPlayerInput(false);
        }

        this._notifyStatus("Sẵn sàng", "idle");
    }

    /**
     * Yêu cầu Backend gợi ý 1 nước đi tiếp theo tốt nhất (Hint).
     * @returns {Promise<string|null>} Hướng đi gợi ý ("up", "down", "left", "right", "swap").
     */
    async getHint() {
        if (!this.engine) return null;

        const levelNumber = this.engine.getCurrentLevelNumber();
        const currentState = this.engine.getCurrentState();

        if (!currentState) {
            this._notifyStatus("Không lấy được trạng thái hiện tại", "error");
            return null;
        }

        this._notifyStatus("Đang tính toán nước đi gợi ý...", "running");

        try {
            const response = await fetch(`${this.baseUrl}/api/v1/hint`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    level_number: levelNumber,
                    current_state: currentState
                })
            });

            if (!response.ok) {
                this._notifyStatus("Không lấy được gợi ý từ máy chủ", "error");
                return null;
            }

            const data = await response.json();
            if (data.next_action) {
                const actionLabels = {
                    up: "LÊN (UP)",
                    down: "XUỐNG (DOWN)",
                    left: "TRÁI (LEFT)",
                    right: "PHẢI (RIGHT)",
                    swap: "ĐỔI KHỐI (SWAP)"
                };
                const label = actionLabels[data.next_action] || data.next_action;
                this._notifyStatus(`Gợi ý: Lăn ${label} (Còn ~${data.remaining_steps} bước)`, "success");
                return data.next_action;
            } else {
                this._notifyStatus("Không có gợi ý khả dụng cho vị trí này", "error");
                return null;
            }
        } catch (err) {
            console.error("[SolverService] Lỗi gợi ý:", err);
            this._notifyStatus("Lỗi kết nối máy chủ khi lấy gợi ý", "error");
            return null;
        }
    }
}
