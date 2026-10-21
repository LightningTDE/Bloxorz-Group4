/**
 * @file AnimationHelper.js
 * @description Cung cấp các tiện ích hoạt họa và hiệu ứng chuyển động vật lý dựa trên nhịp Ticker của CreateJS,
 * bao gồm trì hoãn khung hình, mô phỏng trọng lực rơi tự do và hiệu ứng xoáy hút khi hoàn thành màn chơi.
 */

export class AnimationHelper {
    /**
     * Tạo độ trễ định thời chính xác theo số chu kỳ khung hình (Ticker ticks).
     * Tác dụng: Đồng bộ hóa các hành động trong trò chơi với tốc độ khung hình (FPS) của động cơ đồ họa,
     * thay thế việc dùng setTimeout dễ bị lệch pha khi tab trình duyệt bị ẩn hoặc lag.
     *
     * @param {number} ticks - Số lượng khung hình cần chờ trước khi kích hoạt callback.
     * @param {(() => void)|null} onComplete - Hàm callback được thực thi sau khi hoàn tất thời gian chờ.
     * @returns {void}
     */
    static wait(ticks, onComplete) {
        let delay = ticks;
        const onTick = () => {
            if (delay <= 0) {
                createjs.Ticker.removeEventListener("tick", onTick);
                if (onComplete) onComplete();
            }
            delay--;
        };
        createjs.Ticker.addEventListener("tick", onTick);
    }

    /**
     * Mô phỏng chuyển động vật lý rơi tự do có gia tốc trọng trường khi khối hộp hoặc ô sàn rơi khỏi bàn cờ.
     * Tác dụng: Tạo cảm giác rơi xuống hố sâu chân thực với quán tính văng ngang và tốc độ rơi tăng dần đều.
     *
     * @param {createjs.DisplayObject & { pos?: { x: number, y: number, update?: () => void } }} displayObject - Đối tượng hiển thị cần rơi.
     * @param {("x"|"y"|null)} axis - Trục văng ngang theo quán tính ('x' hoặc 'y'), hoặc null nếu rơi thẳng đứng.
     * @param {(number|null)} speed - Hướng và tốc độ văng ban đầu (1, -1 hoặc null).
     * @param {(() => void)|null} onFallFinished - Callback kích hoạt khi đối tượng đã rơi ra khỏi phạm vi nhìn thấy (> 500px).
     * @returns {void}
     */
    static playFall(displayObject, axis, speed, onFallFinished) {
        let z = 0;
        let zs = (axis === "y" && speed < 0) ? 3 : 0; // Vận tốc ban đầu nếu văng hướng lên theo trục Y

        const onTick = () => {
            // 1. Cập nhật vị trí văng ngang theo quán tính hướng lăn
            if (axis && speed && displayObject.pos) {
                displayObject.pos[axis] += speed * 0.25;
            }
            if (displayObject.pos && typeof displayObject.pos.update === "function") {
                displayObject.pos.update();
            }

            // 2. Gia tốc trọng trường: vận tốc rơi tăng thêm 3 đơn vị qua mỗi khung hình
            zs += 3;
            z += zs;
            displayObject.y += z;

            // 3. Giảm dần độ trong suốt (alpha) nếu đối tượng rơi thẳng đứng
            if (!axis) {
                displayObject.alpha = Math.max(0, 1 - z / 300);
            }

            // 4. Khi độ sâu rơi vượt quá 500 pixel, dừng lắng nghe Ticker và hoàn tất
            if (z > 500) {
                createjs.Ticker.removeEventListener("tick", onTick);
                if (onFallFinished) onFallFinished();
            }
        };

        createjs.Ticker.addEventListener("tick", onTick);
    }

    /**
     * Tạo hiệu ứng xoáy ốc hút dần vào tâm lỗ đích khi người chơi chiến thắng màn chơi.
     * Tác dụng: Tạo hiệu ứng hình ảnh đẹp mắt khi khối hộp lọt vào lỗ thoát, các ô sàn xung quanh
     * xoay quanh tâm lỗ và mờ dần trước khi chuyển tiếp sang màn tiếp theo.
     *
     * @param {createjs.DisplayObject & { pos?: { x: number, y: number, update?: () => void } }} tileObject - Ô gạch hoặc đối tượng cần xoáy.
     * @param {number} centreX - Tọa độ cột tâm của lỗ đích.
     * @param {number} centreY - Tọa độ hàng tâm của lỗ đích.
     * @returns {void}
     */
    static playSwirl(tileObject, centreX, centreY) {
        let timeStep = 1;

        const onTick = () => {
            if (!tileObject.pos) return;

            // Tính góc phương vị từ đối tượng đến tâm lỗ đích
            const theta = Math.atan2(tileObject.pos.y - centreY, tileObject.pos.x - centreX);
            tileObject.pos.x -= Math.sin(theta) * timeStep * 0.2;
            tileObject.pos.y += Math.cos(theta) * timeStep * 0.2;

            if (typeof tileObject.pos.update === "function") {
                tileObject.pos.update();
            }
            timeStep++;

            // Mờ dần theo thời gian xoáy
            tileObject.alpha = Math.max(0, 1 - timeStep / 20);

            if (tileObject.alpha === 0) {
                createjs.Ticker.removeEventListener("tick", onTick);
            }
        };

        createjs.Ticker.addEventListener("tick", onTick);
    }
}
