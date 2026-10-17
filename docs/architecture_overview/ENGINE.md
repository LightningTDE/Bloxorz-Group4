# Module Engine


## 1. level_loader.py — LevelLoader.load(file_path) -> LevelMap
- **Đầu vào**: Đường dẫn tới file JSON màn chơi (trong resources/levels/).
- **Đầu ra**: Đối tượng LevelMap.
- **Xử lý lỗi**: Nếu lỗi đọc file, sai cú pháp JSON hoặc grid không đúng kích thước 10 dòng × 15 ký tự thì ném LevelLoadError.
- **Trích xuất từ grid**: Ô e là goal. Các ô cầu mở ban đầu (k, q) được đưa vào initial_bridges.
- **Định dạng JSON**:
  - start: [x, y]
  - swatches: [[door_x, door_y, action], ...]
  - splits: [b1_x, b1_y, b2_x, b2_y] (khóa là tọa độ của ô tách khối v).

## 2. bloxorz_engine.py — BloxorzEngine(IGameEngine)

**Hợp đồng các phương thức:**
- `get_initial_state()`: Trả về trạng thái khối đứng thẳng tại start, với open_bridges = initial_bridges.
- `is_goal(state)`: Trả về True khi state.is_standing và state.b1 == goal.
- `validate_state(state)`: Kiểm tra cả b1 và b2 (kể cả khi tách đôi) và trả về MoveStatus theo đúng thứ tự ưu tiên từ 1 đến 6 bên dưới.
- `apply_action(state, action)`: Trả về (state_mới, MoveStatus). Không sửa đổi state đầu vào. Ném InvalidActionError nếu hành động không hợp lệ.
- `get_successors(state)`: Duyệt qua UP, DOWN, LEFT, RIGHT (thêm SWITCH nếu state.is_split == True), chỉ giữ lại các kết quả có trạng thái VALID hoặc WON, với step_cost = 1.0.

**Thứ tự kiểm tra của validate_state:**
1. Nằm ngoài khung 15×10 → FALL_EMPTY.
2. Đứng trên ô trống → FALL_EMPTY.
3. Đứng trên ô cầu không nằm trong open_bridges → FALL_CLOSED_BRIDGE.
4. Đứng thẳng trên ô gạch mỏng f → FALL_FRAGILE.
5. Thỏa mãn is_goal(state) → WON.
6. Các trường hợp còn lại → VALID.

**Hành vi chung của luật di chuyển:**
- Khối lớn lăn theo 4 hướng tùy thuộc trạng thái đang đứng, nằm ngang hay nằm dọc. Kết quả luôn đảm bảo chuẩn hóa b1 <= b2.
- Khi đang tách đôi (is_split = True), chỉ khối tương ứng với active_block dịch chuyển 1 ô theo hướng chỉ định.
- Hành động SWITCH chỉ hợp lệ khi is_split == True và dùng để đổi giá trị active_block.
- Việc giẫm lên công tắc và tách/gộp khối sẽ cập nhật open_bridges và is_split dựa theo swatches và splits của LevelMap.
