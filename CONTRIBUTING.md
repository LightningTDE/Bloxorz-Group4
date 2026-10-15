# Đóng góp cho dự án

Đầu tiên, cảm ơn vì dành thời gian để đóng góp!

Trước khi thực hiện dự án, vui lòng đọc kĩ các quy định được nêu dưới đây.
Việc này đảm bảo **không ai làm hỏng việc của ai** và **ai cũng giải thích được code của mình khi bị vấn đáp**. Xem thêm [Tài liệu đi kèm](#tài-liệu-đi-kèm) để hiểu cách vận hành và chi tiết về dự án.

---

## Tài liệu đi kèm

- [`docs/GIT_GUIDE.md`](docs/GIT_GUIDE.md): Quy định về cách sử dụng Git
- [`docs/CODING_RULES.md`](docs/CODING_RULES.md): Quy ước trình bày Code
- [`docs/REVIEW_GUIDE.md`](docs/REVIEW_GUIDE.md): Quy định về cách Review
- [`docs/AI_USAGE.md`](docs/AI_USAGE.md): Quy định về sử dụng AI
- [`docs/REFERENCES.md`](docs/REFERENCES.md): Quy định về tài liệu tham khảo

---

## 1. Bốn quy tắc không được vi phạm
1. **Không push thẳng lên `main`.** Mọi thay đổi đi qua nhánh + Pull Request (PR).
2. **Không tự merge PR của mình** khi chưa có người review (ghi trong file Excel) bấm *Approve*.
3. **Không push code không chạy được** vào `main`: Phải được chạy test và hoạt động được.
4. **Không commit file rác / bí mật**: `.venv/`, `__pycache__/`, file CSV kết quả lớn, token, file cá nhân.

---

## 2. Quy trình cho một việc (từ lúc nhận đến lúc xong)

Mỗi việc trong file Excel **Nhóm 4 - AI Project 1** có ID (ví dụ `A3`), **một người làm**, **một/hai người review**.

| ID | Phụ trách: Người làm | Phụ trách: Người review | Hoạt động                    |     Trạng thái     | Nhánh Git & PR               | Nhận xét                                   |
|:--:|:--------------------:|:-----------------------:|:-----------------------------|:------------------:|:-----------------------------|:-------------------------------------------|
| A3 |          A           |            B            | Viết hàm xác thực JWT login  |    **Xác nhận**    | PR #12                       | Đã squash & merge vào `main`               |
| A4 |          C           |            D            | API lấy thông tin người dùng |  **Chờ xác nhận**  | `feature/c-A2` &rarr; PR #14 | Chờ D review                               |
| A5 |          A           |            B            | Unit Test module thanh toán  |   **Điều chỉnh**   | PR #15                       | Cần sửa test case ranh giới trong 24h      |
| A6 |          B           |            A            | Tối ưu query bảng đơn hàng   | **Đang thực hiện** | `feature/binh-A4`            | Đang code & chạy test                      |
| A7 |          D           |            C            | Tích hợp cổng thanh toán cũ  |     **Hủy bỏ**     |                              | Yêu cầu thay đổi, hủy bỏ task và xóa nhánh |

**Một PR = một việc** (hoặc 2–3 việc rất nhỏ liền nhau). PR nên **dưới ~300 dòng thay đổi**; to hơn thì tách ra.

---

## 3. Nhánh, Commit, Pull Request

- **Nhánh:** `feature/<tên>-<ID>` (thêm tính năng), `fix/<tên>-<mô-tả-ngắn>` (sửa lỗi),
  `docs/<tên>-<mô-tả>` (tài liệu / báo cáo). Ví dụ: `feature/an-A3`, `fix/binh-bfs-visited`.
- **Commit message:** `[ID] Động từ + nội dung ngắn`, ví dụ `[A3] Add orientation transition table`.
  Commit nhỏ, mỗi commit làm một ý, **không** commit kiểu `update`, `fix`, `abc`.
- **Tiêu đề PR:** `[ID] Tên việc` (ví dụ `[A3] Bảng chuyển tư thế`). Điền theo mẫu có sẵn
  (`.github/pull_request_template.md`): làm gì, cách kiểm tra, checklist.
- **Merge:** dùng **Squash and merge** để lịch sử `main` gọn (một việc = một commit).
- **Trước khi mở PR:** `git fetch && git merge origin/main` vào nhánh của mình, giải quyết conflict ở máy mình.

---

## 4. Review (tóm tắt, chi tiết ở `docs/REVIEW_GUIDE.md`)

- **Người review** của từng việc được chỉ định trong cột *Người review* của file Excel. Không ai review việc của chính mình.
- Review phải **chạy code thật** (checkout nhánh, chạy test), không chỉ đọc lướt. Không được "LGTM" suông:
  mỗi lần Approve phải ghi **ít nhất một câu** nói đã kiểm tra điều gì.
- Gắn nhãn nhận xét: `[must]` (bắt buộc sửa), `[suggest]` (nên sửa), `[question]` (hỏi để hiểu), `[nit]` (lặt vặt, không chặn).
- Ý kiến khác nhau mà không thống nhất được trong 24 giờ → hỏi **trưởng nhóm**, trưởng nhóm quyết định.
- **Quan trọng cho vấn đáp:** người review cũng phải giải thích được đoạn code mình đã duyệt.
- Việc không phải code (báo cáo, video, bộ test) cũng được review: người review đọc/xem và kiểm tra theo checklist trong `REVIEW_GUIDE.md`.

---

## 5. "Hoàn thành" nghĩa là gì

Một việc chỉ được đánh dấu **Hoàn thành** khi đủ tất cả:

- [ ] Code chạy được, không còn `TODO [ID]` của việc đó trong code.
- [ ] Có unit test cho phần logic mới (game, solver) và kết quả test **xanh**.
- [ ] Tuân thủ `docs/CODING_RULES.md`
- [ ] PR đã được người review **Approve** và CI xanh, đã merge vào `main`.
- [ ] Cập nhật trạng thái trong file Excel (cột *Trạng thái*).
- [ ] Nếu dùng AI hoặc tài liệu ngoài: đã ghi vào `docs/AI_USAGE.md` / `docs/REFERENCES.md`.

---

## 6. Experiment

TBD

---

## 7. Module quan trọng

Áp dụng cho `core`, `engine`, định dạng JSON màn chơi, quy ước tọa độ và tư thế.

1. Người muốn đổi nhắn vào nhóm chat: *đổi gì, vì sao, ai bị ảnh hưởng*.
2. **Tất cả thành viên** phải phản hồi (✅ hoặc ý kiến) trong 24 giờ. Không phản hồi coi như chưa đồng ý, nhắc lại.
3. Tạo PR **riêng** chỉ chứa thay đổi này, cần **2 người duyệt** (người review + người dùng thay đổi nhiều nhất).
4. Sau khi merge, thông báo cả nhóm để mọi người `git pull` và sửa phần của mình.

---

## 8. AI, nguồn tham khảo và liêm chính học thuật

Đề cho phép dùng AI nhưng giảng viên có thể **phỏng vấn ngẫu nhiên** và **đạo văn = 0 điểm môn**.

- Dùng AI (ChatGPT, Claude, Copilot...) cho việc gì đáng kể thì **ghi vào `docs/AI_USAGE_LOG.md`** (prompt, kết quả, cách kiểm chứng).
  Báo cáo bắt buộc có phụ lục này.
- Code lấy từ GitHub / StackOverflow / bài viết: **ghi nguồn vào `docs/REFERENCES.md` và để comment link ngay trên đoạn code**.
  Cấm copy nguyên repo/bài của người khác nộp như của mình. Solver phải tự cài đặt.
- Code do AI sinh ra phải được **đọc hiểu, chạy thử, có test** trước khi commit. Không commit thứ mình không giải thích được.
- Trước hạn nộp, mỗi người tự kiểm tra: *"mình có giải thích được từng file mình viết và từng PR mình review không?"*

---

## 9. Xung đột, lỗi và khẩn cấp

- **Merge conflict:** tự giải quyết ở nhánh của mình (xem `docs/docs/GIT_GUIDE.md`, mục 6). Không hiểu thì gọi người vừa sửa file đó.
- **`main` bị hỏng** (test đỏ / không chạy): báo ngay vào nhóm chat. Người merge PR gây lỗi ưu tiên sửa hoặc `git revert` trong vòng vài giờ.
- **Không dùng** `git push --force` lên `main`, không xóa nhánh của người khác, không rewrite lịch sử đã merge.

---

## 10. Giao tiếp và tiến độ

- **Cập nhật tiến độ** (khi được yêu cầu, nhắn trong nhóm chat): *đã làm những gì – đang vướng gì*.
- **Họp:** sẽ được cập nhật theo Excel tùy theo tiến độ, việc cần làm.
- **Vướng việc → báo trong vòng 24 giờ.** Đừng im lặng rồi trễ hạn.
- **Sắp trễ hạn → báo trước ít nhất 1 ngày** để nhóm chia lại việc. Chia lại việc thì sửa cột *Mã người* trong Excel
  và ghi chú lý do, để lúc báo cáo tính % đóng góp cho chính xác.
- Hỏi giúp là bình thường. Nhưng **mỗi người vẫn phải tự hiểu** code mình nộp.

---

## 11. Chốt code và nộp bài

TBD