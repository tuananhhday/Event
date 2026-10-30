# Bắt đầu: Event QA Live

## Mở Chrome / Edge ngay trên máy của bạn

Nếu muốn nhập link rồi mở một cửa sổ **Google Chrome hoặc Microsoft Edge riêng trên máy cá nhân**, dùng bản local:

1. Tải source repo về máy Windows và giải nén (hoặc `git clone`).
2. Cài Node.js **24 trở lên** và Chrome hoặc Edge.
3. Mở `OPEN_LOCAL_CHROME_EDGE.cmd`. Lần đầu script tự cài dependency theo lockfile rồi mở giao diện local.
4. Chọn **Chrome** hoặc **Edge**, nhập URL (ví dụ `https://vinpearlota.com`), bấm **Mở trình duyệt test**.
5. Thao tác trong cửa sổ trình duyệt vừa mở; xem event và xuất báo cáo trong giao diện EventQA. Giữ cửa sổ dòng lệnh mở trong khi test.

Trình duyệt test dùng profile riêng; đăng nhập website trong cửa sổ đó nếu cần. Với website nội bộ, máy bạn cần có mạng/VPN tương ứng. Nếu Edge bị công ty chặn remote debugging, liên hệ IT.

Trên macOS/Linux, chạy `npm ci --ignore-scripts --no-audit --no-fund`, rồi `npm run cdp -- --open` trong thư mục repo.

Bản cloud/Render bên dưới mở Chromium **trên máy chủ** và truyền hình ảnh vào công cụ. Nó không tự mở hay điều khiển Chrome/Edge trên máy cá nhân của người truy cập.

## Mở website bên trong công cụ cloud

**Muốn mở website test ngay trong công cụ:** deploy bản `cloud/` dưới dạng **Docker Web Service**, theo [README_LIVE.md](README_LIVE.md).

Luồng sử dụng: nhập URL → chọn CDP/CDP + AI/Proxy → mở trình duyệt test → thao tác và xem event → đối chiếu đặc tả → xuất báo cáo. Người truy cập không cần cài Node trên máy.

Render Static Site đang dùng không chạy được trình duyệt trên máy chủ; hãy tạo Web Service mới từ cùng repo.

## Cập nhật repo hiện có

Trong `Event_QA_Live_Update.zip`:

- `UPLOAD_UPDATE/`: file mới/thay đổi để cập nhật repo `tuananhhday/Event`. Kéo **nội dung bên trong** lên **Add file → Upload files**, rồi commit.
- `FULL_SOURCE/`: toàn bộ mã nguồn sau sửa để giữ lại hoặc tạo repo khác.
- `HUONG_DAN_CAP_NHAT.md`: hướng dẫn upload và cấu hình Render.

Không upload cả hai thư mục vào cùng repo. Sau cập nhật, `Dockerfile` và `render.yaml` phải ở gốc, bên cạnh `cloud/`, `src/`, `web/`.

| Vị trí | Công dụng |
|---|---|
| `cloud/` | Backend phiên test, trình duyệt từ xa và giao diện live |
| `Dockerfile`, `render.yaml` | Chromium/mitmproxy và cấu hình Render Web Service |
| `web/` | Công cụ HAR dự phòng, xử lý file trong tab |
| `src/`, `solutions/`, `proxy/`, `scripts/`, `test/`, `tests/` | Ứng dụng local và các collector gốc |
| `UPSTREAM_SOURCE.json` | Hash của 74 file tại commit nguồn gốc, trước các thay đổi tích hợp |

Nguồn: `tuananhhday/Event-Tracking`, commit `c98e0c88795cd07b15988e7de06fd39d80f25451`. Không bao gồm lịch sử Git, dependency đã cài, khóa API, profile hoặc dữ liệu test riêng.

**Tiếp theo:** đọc README_LIVE, cập nhật GitHub, tạo Docker Web Service và smoke test. Mã nguồn này chưa được push/deploy thay cho bạn.
