# Hướng dẫn review

Review không phải để "bắt lỗi" mà để: (1) **code đúng**, (2) **cả hai người cùng hiểu code**, (3) **sẵn sàng cho vấn đáp**.
Người review cũng phải giải thích được phần mình đã duyệt.

## 1. Ai review ai
- Xem cột **Người review** trong file Excel **Nhóm 4 - AI Project 1**.
- Không ai review việc của chính mình. Cần đổi người review thì sửa trong Excel và báo nhóm.
- Thời hạn: **review trong 24 giờ** kể từ khi được báo. Bận thì báo sớm để đổi người.

## 2. Quy trình của người review
1. Đọc **mô tả PR** thông qua mô tả việc trên GitHub và Excel (làm gì, cách kiểm tra).
2. **Chạy thật**: Cập nhật sau
3. Đọc code theo checklist ở mục 3 và mục 4. Đọc **cả test**: test có thật sự kiểm tra điều quan trọng không?
4. Viết nhận xét trên GitHub (*Files changed* → bấm dấu `+` cạnh dòng code, hoặc *Review changes* ở góc trên)
    - **Approve**: đủ điều kiện ở mục 5, ghi ít nhất một câu nói đã kiểm tra gì.
    - **Request changes**: có `[must]` cần sửa.
    - **Comment**: mới chỉ hỏi/góp ý, chưa quyết định.
5. Cập nhật cột **Trạng thái** trong Excel: *Chờ xác nhận* → *Xác nhận*, *Điều chỉnh* hoặc *Hủy bỏ*.
6. Tác giả sửa xong thì **xem lại đúng những chỗ đã yêu cầu sửa**, rồi Approve.

## 3. Checklist chung (mọi PR)
- [ ] PR chỉ làm **một việc** và đúng với việc có ID trong Excel; không lẫn thay đổi không liên quan.
- [ ] Tuân thủ `CONTRIBUTING.md` (nhánh, commit message, mô tả PR) và `docs/CODING_RULES.md`.
- [ ] Chạy được. Test **xanh** trên máy mình (không chỉ tin CI).
- [ ] Có **test mới** cho logic mới; test kiểm tra hành vi thật, không chỉ "chạy qua".
- [ ] Không can thiệp **Module quan trọng** trừ khi đã được cả nhóm đồng ý.
- [ ] Không có code chết, `print` gỡ lỗi, file rác, bí mật.
- [ ] Nếu có code từ AI/nguồn ngoài: đã ghi `docs/AI_USAGE.md` / `docs/REFERENCES.md`.
- [ ] Mình **hiểu** đoạn code này và có thể giải thích lại. Chưa hiểu → hỏi (`[question]`), đừng Approve.

## 4. Checklist theo loại việc

## 5. Khi nào được Approve
Approve khi **tất cả** đúng:
1. Chạy được và test xanh trên máy người review.
2. Không còn `[must]` nào chưa được xử lý.
3. Người review **hiểu và giải thích được** những gì PR làm.

## 6. Cách viết nhận xét tốt
Dùng nhãn ở đầu mỗi nhận xét:
- `[must]` bắt buộc sửa trước khi merge (sai logic, thiếu test quan trọng, vi phạm hợp đồng...).
- `[suggest]` nên sửa, tác giả có thể từ chối nếu có lý do.
- `[question]` hỏi để hiểu, chưa phải yêu cầu sửa.
- `[nit]` chỗ lặt vặt (đặt tên, định dạng), không chặn merge.

Nguyên tắc: **nói về code, không nói về người**; **cụ thể** (dòng nào, vì sao, gợi ý cách sửa); **lịch sự**; **một nhận xét một ý**.

| Nên                                                                                                             | Không nên                |
|-----------------------------------------------------------------------------------------------------------------|--------------------------|
| `[must] Ở dòng 42, nước đi lên ô dễ vỡ khi khối đứng vẫn được trả về, nên bỏ nó khỏi successors. Test mẫu: ...` | "Code này sai."          |
| `[question] Vì sao đếm expanded trước khi kiểm tra đích? Có ảnh hưởng số liệu so sánh không?`                   | "Làm lại đi."            |
| `[nit] Đổi tên biến x2 thành next_row cho dễ đọc.`                                                              | "LGTM" mà chưa chạy thử. |

## 7. Dành cho tác giả khi nhận review
- Cảm ơn và **trả lời từng nhận xét**: đã sửa (kèm commit), hoặc giải thích vì sao không sửa.
- Đừng tranh luận qua nhiều vòng bằng chữ: không thống nhất sau 1–2 lượt thì **gọi nhau 5 phút** hoặc hỏi trưởng nhóm.
- Sau khi sửa xong, báo người review và đổi trạng thái trong Excel.

## 8. Ý kiến khác nhau
Không thống nhất được trong 24 giờ → hỏi **trưởng nhóm**. Trưởng nhóm quyết định và ghi lại ngắn gọn lý do trong PR.
Nếu vấn đề là về giữa các **module quan trọng** thì áp dụng quy trình ở `CONTRIBUTING.md`, mục 7.