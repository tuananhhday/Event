# Kiểm tra bản web live

- `npm run test:cloud`: **27/27 đạt** (11 test cloud/API và 16 test HAR/parser/export).
- `node --check`: các module backend và điều khiển giao diện hợp lệ.
- `npm --prefix web run bundle`: tạo lại hai bản HTML HAR độc lập.
- Kiểm tra UI trong Chrome: giao diện tải được, kết nối backend/SSE, mở hướng dẫn, nhập XLSX có nén, chọn sheet và mở chi tiết đối chiếu. Không có event thì trả Chưa thấy, không tạo bằng chứng giả.
- **Chưa xác minh**: Chromium thật trong preview, build Docker, thao tác website thật, Proxy thực tế và OpenRouter với key thật. Browser giả lập chỉ nằm trong test API.
- Chưa push GitHub hoặc deploy Render. Cần smoke test trong README_LIVE.md sau khi tạo Docker Web Service.

Không diễn giải test API bằng browser giả lập thành kiểm thử đầu cuối của Chromium.
