# Kiểm tra bản web live

Kiểm tra ngày 2026-10-30 cho bản giảm sử dụng bộ nhớ:

- `npm test`: **170 đạt, 3 bỏ qua, 0 lỗi**. Ba test Chromium thật được chạy riêng bên dưới.
- `NODE_ENV=production CHROME_NO_SANDBOX=1 MITMDUMP_PATH=/workspace/.eventqa/proxy/bin/mitmdump EVENTQA_REAL_BROWSER=1 MAX_SESSIONS=1 NODE_OPTIONS=--max-old-space-size=128 node --test cloud/tests/browser-real.test.mjs`: kiểm tra Chromium thật, mở demo, thu request HTTP 204; giao diện CDP/Proxy vẫn bấm/gõ được khi bỏ ảnh SSE, mở rộng màn hình và khôi phục phiên sau reload.
- Đã build Dockerfile bằng Node 24 / Chromium Bookworm / mitmproxy 12.3.1. Trong môi trường kiểm tra có proxy HTTPS, CA của môi trường được mount riêng cho bước pip; không tắt xác minh TLS và không lưu CA vào image.
- Container production bị giới hạn cứng **512 MiB**, không swap thêm. Mở/đóng hai phiên CDP rồi hai phiên Proxy tuần tự: cả bốn phiên mở demo, lấy ảnh, bấm tìm kiếm và thu `search_submit` có phản hồi HTTP 204.
- Đỉnh cgroup `memory.peak`: **286.691.328 byte (~274 MiB)** sau hai phiên CDP, **347.283.456 byte (~332 MiB)** sau hai phiên Proxy. `memory.events` ghi `oom 0`, `oom_kill 0`. Phép đo bao gồm cả tiến trình Node smoke test chạy trong container.

Đây là kết quả với demo nội bộ, không bảo đảm website nặng hoạt động trong 512 MiB. Giới hạn heap Node 128 MiB không giới hạn tổng bộ nhớ Chromium. Gói nhiều RAM hơn hoặc bản local vẫn có thể cần thiết.

Chưa xác minh bản deploy Render thực tế, Vinpearl, thử thách xác nhận của ChatGPT hoặc OpenRouter với key thật. Môi trường kiểm tra chưa kết nối được tới domain Render do proxy từ chối HTTPS CONNECT. Không diễn giải kết quả proxy này thành phản hồi CloudFront của website đích. Có thể xem `/health` trên Render để đối chiếu trường `version` với commit đã deploy.
